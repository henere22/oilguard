import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { one } from './database.js';

export const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export const newToken = () => randomBytes(32).toString('base64url');
export const digest = (value) => createHash('sha256').update(value).digest('hex');

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function audit(connection, action, actorId = null, targetId = null, details = {}) {
  await connection.query(
    'INSERT INTO audit_logs(action, actor_id, target_user_id, details) VALUES ($1, $2, $3, $4)',
    [action, actorId, targetId, details],
  );
}

export async function enforceLimit(bucket, max) {
  const { attempts } = await one(`INSERT INTO login_limits(bucket, attempts, expires_at)
    VALUES ($1, 1, now() + interval '15 minutes')
    ON CONFLICT (bucket) DO UPDATE SET
      attempts = CASE WHEN login_limits.expires_at <= now() THEN 1 ELSE LEAST(login_limits.attempts + 1, $2 + 1) END,
      expires_at = CASE WHEN login_limits.expires_at <= now() THEN EXCLUDED.expires_at ELSE login_limits.expires_at END
    RETURNING attempts`, [digest(bucket), max]);
  if (attempts > max) throw new HttpError(429, 'Muitas tentativas. Aguarde até 15 minutos.');
}

export function matchesSecret(value, expected) {
  return typeof value === 'string' && typeof expected === 'string' &&
    timingSafeEqual(Buffer.from(digest(value)), Buffer.from(digest(expected)));
}

export function rateLimit({ max, windowMs = 60_000 }) {
  const buckets = new Map();
  let resetAt = Date.now() + windowMs;
  return (req, _res, next) => {
    if (Date.now() >= resetAt) {
      buckets.clear();
      resetAt = Date.now() + windowMs;
    }
    const key = req.ip;
    const count = (buckets.get(key) ?? 0) + 1;
    if (count > max || (!buckets.has(key) && buckets.size >= 10000)) {
      return next(new HttpError(429, 'Muitas requisições. Tente novamente em instantes.'));
    }
    buckets.set(key, count);
    next();
  };
}
