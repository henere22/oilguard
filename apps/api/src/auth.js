import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import { db, one, rows, transaction } from './database.js';
import { audit, digest, enforceLimit, HttpError, newToken, tokenPattern } from './security.js';

const username = z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,64}$/);
const password = z.string().min(12).max(128);
const name = z.string().trim().min(1).max(100);
const role = z.enum(['admin', 'operator']);
const sessionMs = 8 * 60 * 60 * 1000;
const authCookie = 'oilguard_session';
const fields = 'id, username, name, role, active, is_primary';
const hashOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
let dummyHash;

function parse(schema, input, message = 'Dados inválidos. Confira os campos informados.') {
  const result = schema.safeParse(input);
  if (!result.success) throw new HttpError(400, message);
  return result.data;
}

function publicUser(user) {
  return { id: user.id, username: user.username, name: user.name, role: user.role,
    active: user.active, primary: user.is_primary };
}

function getToken(req) {
  const authorization = req.get('authorization');
  if (authorization) return authorization.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  const cookie = req.get('cookie')?.split(';').map((value) => value.trim()).find((value) => value.startsWith(authCookie + '='));
  return cookie?.slice(authCookie.length + 1);
}

export async function requireUser(req, _res, next) {
  const token = getToken(req);
  if (!tokenPattern.test(token ?? '')) throw new HttpError(401, 'Entre para acessar o OILGUARD.');
  const tokenHash = digest(token);
  const user = await one(`SELECT u.id, u.username, u.name, u.role, u.active, u.is_primary
    FROM user_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > now() AND s.revoked_at IS NULL AND u.active`, [tokenHash]);
  if (!user) throw new HttpError(401, 'Sessão encerrada. Entre novamente.');
  req.user = user;
  req.sessionHash = tokenHash;
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user.role !== 'admin') throw new HttpError(403, 'Acesso reservado a administradores.');
  next();
}

// Revalida privilégios sob bloqueio nas transações que alteram o sistema.
export async function lockAdmin(req, connection) {
  const actor = await one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.user.id], connection);
  const session = await one(`SELECT 1 FROM user_sessions WHERE token_hash = $1
    AND revoked_at IS NULL AND expires_at > now()`, [req.sessionHash], connection);
  if (!actor.active || actor.role !== 'admin' || !session) throw new HttpError(403, 'Acesso administrativo revogado.');
  return actor;
}

async function revokeSessions(connection, userId) {
  await connection.query('UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

async function clearUserLoginLimit(connection, username) {
  await connection.query('DELETE FROM login_limits WHERE bucket = $1', [digest(`login-user:${username}`)]);
}

async function invalidateRecovery(connection, userId) {
  await connection.query('UPDATE password_recovery_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [userId]);
}

async function issueRecovery(connection, userId) {
  await invalidateRecovery(connection, userId);
  const code = newToken();
  const { expires_at: expiresAt } = await one(`INSERT INTO password_recovery_tokens (token_hash, user_id, expires_at)
    VALUES ($1, $2, now() + interval '30 minutes') RETURNING expires_at`, [digest(code), userId], connection);
  return { code, expiresAt };
}

export async function bootstrapPrimary(input) {
  const values = {
    username: parse(username, input.username, 'O usuário deve ter de 3 a 64 caracteres. Use letras sem acento, números, ponto, hífen ou sublinhado.'),
    name: parse(name, input.name, 'O nome deve ter de 1 a 100 caracteres.'),
    password: parse(password, input.password, 'A senha deve ter de 12 a 128 caracteres.'),
  };
  const hash = await argon2.hash(values.password, hashOptions);
  return transaction(async (connection) => {
    await connection.query('SELECT pg_advisory_xact_lock(403332)');
    if (await one('SELECT 1 FROM users WHERE is_primary', [], connection)) {
      throw new HttpError(409, 'O administrador principal já foi inicializado.');
    }
    const user = await one(`INSERT INTO users(username, name, password_hash, role, is_primary)
      VALUES ($1, $2, $3, 'admin', true) RETURNING ${fields}`, [values.username, values.name, hash], connection);
    await audit(connection, 'admin.bootstrapped', null, user.id);
    return publicUser(user);
  });
}

export async function recoverPrimary() {
  return transaction(async (connection) => {
    const user = await one('SELECT id FROM users WHERE is_primary FOR UPDATE', [], connection);
    if (!user) throw new HttpError(404, 'O administrador principal ainda não foi inicializado.');
    const recovery = await issueRecovery(connection, user.id);
    await audit(connection, 'admin.recovery_issued', null, user.id);
    return recovery;
  });
}

export function authRoutes({ secure }) {
  const router = Router();
  const cookie = { secure, httpOnly: true, sameSite: 'strict', path: '/api' };

  router.post('/login', async (req, res) => {
    const input = parse(z.object({ username, password: z.string().min(1).max(128), native: z.boolean().default(false) }), req.body);
    await enforceLimit(`login-ip:${req.ip}`, 40);
    await enforceLimit(`login-user:${input.username}`, 10);
    const user = await one('SELECT * FROM users WHERE username = $1', [input.username]);
    const hash = user?.password_hash ?? await (dummyHash ??= argon2.hash(newToken(), hashOptions));
    const valid = await argon2.verify(hash, input.password);
    if (!valid || !user?.active || !user.password_hash) {
      await audit(db, 'auth.login_failed', null, user?.id ?? null);
      throw new HttpError(401, 'Usuário ou senha inválidos.');
    }
    const token = newToken();
    const expiresAt = await transaction(async (connection) => {
      const current = await one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [user.id], connection);
      if (!current.active || current.password_hash !== user.password_hash || current.role !== user.role) {
        throw new HttpError(401, 'Usuário ou senha inválidos.');
      }
      const session = await one(`INSERT INTO user_sessions(token_hash, user_id, expires_at)
        VALUES ($1, $2, now() + interval '8 hours') RETURNING expires_at`, [digest(token), user.id], connection);
      await clearUserLoginLimit(connection, current.username);
      await audit(connection, 'auth.login', user.id, user.id);
      return session.expires_at;
    });
    if (!input.native) res.cookie(authCookie, token, { ...cookie, maxAge: sessionMs });
    res.json({ user: publicUser(user), expiresAt, ...(input.native ? { token } : {}) });
  });

  router.post('/recover', async (req, res) => {
    const input = parse(z.object({ code: z.string().regex(tokenPattern), password }), req.body,
      'Informe o código e uma senha de 12 a 128 caracteres.');
    await enforceLimit(`recovery-ip:${req.ip}`, 10);
    const tokenHash = digest(input.code);
    const candidate = await one(`SELECT user_id FROM password_recovery_tokens
      WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL`, [tokenHash]);
    if (!candidate) throw new HttpError(400, 'Código inválido, expirado ou já usado.');
    const hash = await argon2.hash(input.password, hashOptions);
    await transaction(async (connection) => {
      const user = await one('SELECT id, username, active FROM users WHERE id = $1 FOR UPDATE', [candidate.user_id], connection);
      const result = await connection.query(`UPDATE password_recovery_tokens SET used_at = now()
        WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL`, [tokenHash]);
      if (!user.active || !result.rowCount) throw new HttpError(400, 'Código inválido, expirado ou já usado.');
      await connection.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
      await revokeSessions(connection, user.id);
      await invalidateRecovery(connection, user.id);
      await clearUserLoginLimit(connection, user.username);
      await audit(connection, 'auth.password_reset', user.id, user.id);
    });
    res.status(204).end();
  });

  router.get('/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));
  router.post('/logout', async (req, res) => {
    const token = getToken(req);
    if (tokenPattern.test(token ?? '')) {
      await transaction(async (connection) => {
        const session = await one(`UPDATE user_sessions SET revoked_at = now()
          WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
          RETURNING user_id`, [digest(token)], connection);
        if (session) await audit(connection, 'auth.logout', session.user_id, session.user_id);
      });
    }
    res.clearCookie(authCookie, cookie).status(204).end();
  });
  return router;
}

async function withTarget(req, work) {
  const id = parse(z.coerce.number().int().positive().max(2147483647), req.params.id);
  return transaction(async (connection) => {
    await connection.query('SELECT pg_advisory_xact_lock(403332)');
    const actor = await lockAdmin(req, connection);
    const target = await one('SELECT * FROM users WHERE id = $1 FOR UPDATE', [id], connection);
    if (!target) throw new HttpError(404, 'Usuário não encontrado.');
    if (target.is_primary || (target.role === 'admin' && !actor.is_primary)) {
      throw new HttpError(403, 'A conta selecionada tem acesso protegido.');
    }
    return work(connection, target, actor);
  });
}

export function adminRoutes() {
  const router = Router();
  router.use(requireAdmin);
  router.get('/audit', async (req, res) => {
    const limit = parse(z.coerce.number().int().min(1).max(200), req.query.limit ?? 50);
    const data = await rows(`SELECT id, actor_id, target_user_id, action, details, created_at
      FROM audit_logs ORDER BY id DESC LIMIT $1`, [limit]);
    res.json({ data });
  });
  router.get('/users', async (_req, res) => {
    res.json({ data: (await rows(`SELECT ${fields} FROM users ORDER BY username`)).map(publicUser) });
  });
  router.post('/users', async (req, res) => {
    const input = parse(z.object({ username, name, role }), req.body);
    const result = await transaction(async (connection) => {
      const actor = await lockAdmin(req, connection);
      if (input.role === 'admin' && !actor.is_primary) throw new HttpError(403, 'Somente o administrador principal pode atribuir esse perfil.');
      const user = await one(`INSERT INTO users (username, name, role) VALUES ($1, $2, $3)
        ON CONFLICT (username) DO NOTHING RETURNING ${fields}`, [input.username, input.name, input.role], connection);
      if (!user) throw new HttpError(409, 'Já existe um usuário com esse identificador.');
      const recovery = await issueRecovery(connection, user.id);
      await audit(connection, 'user.created', actor.id, user.id, { role: user.role });
      return { user: publicUser(user), ...recovery };
    });
    res.status(201).json(result);
  });
  router.patch('/users/:id', async (req, res) => {
    const input = parse(z.object({ role: role.optional(), active: z.boolean().optional() })
      .refine((value) => value.role !== undefined || value.active !== undefined), req.body);
    const data = await withTarget(req, async (connection, target, actor) => {
      if (input.role === 'admin' && !actor.is_primary) throw new HttpError(403, 'Somente o administrador principal pode atribuir esse perfil.');
      const user = await one(`UPDATE users SET role = coalesce($1, role), active = coalesce($2, active)
        WHERE id = $3 RETURNING ${fields}`, [input.role, input.active, target.id], connection);
      if (user.role !== target.role || user.active !== target.active) {
        await revokeSessions(connection, target.id);
        await invalidateRecovery(connection, target.id);
        await audit(connection, 'user.updated', actor.id, target.id, { role: user.role, active: user.active });
      }
      return publicUser(user);
    });
    res.json({ user: data });
  });
  router.post('/users/:id/revoke', async (req, res) => {
    await withTarget(req, async (connection, target, actor) => {
      await revokeSessions(connection, target.id);
      await audit(connection, 'user.sessions_revoked', actor.id, target.id);
    });
    res.status(204).end();
  });
  router.post('/users/:id/recovery', async (req, res) => {
    const result = await withTarget(req, async (connection, target, actor) => {
      if (!target.active) throw new HttpError(409, 'Reative a conta antes de emitir um código.');
      const recovery = await issueRecovery(connection, target.id);
      await audit(connection, 'user.recovery_issued', actor.id, target.id);
      return recovery;
    });
    res.json(result);
  });
  return router;
}
