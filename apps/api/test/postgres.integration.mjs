import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import pg from 'pg';

test('PostgreSQL, monitoramento e permissões', async () => {
  assert(process.env.TEST_DATABASE_URL, 'Defina TEST_DATABASE_URL para um PostgreSQL local de testes.');
  const origin = 'http://localhost:5173';
  const schema = 'oilguard_test_' + randomBytes(8).toString('hex');
  const root = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const connection = new URL(process.env.TEST_DATABASE_URL);
  connection.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = connection.toString();
  process.env.DATA_MODE = 'simulation';
  process.env.NODE_ENV = 'test';
  process.env.INGEST_TOKEN = randomBytes(32).toString('hex');
  const { db, one } = await import('../src/database.js');
  const { migrate } = await import('../src/migrate.js');
  const { createApp } = await import('../src/app.js');
  const { bootstrapPrimary } = await import('../src/auth.js');
  let server;
  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    await migrate();
    await migrate();
    assert.equal((await one('SELECT count(*) AS total FROM schema_migrations')).total, '4');
    process.env.DATA_MODE = 'operational';
    process.env.NODE_ENV = 'production';
    assert.throws(() => createApp(), /Produção requer/);
    process.env.DATA_MODE = 'simulation';
    process.env.NODE_ENV = 'test';
    const adminPassword = randomBytes(24).toString('hex');
    const operatorPassword = randomBytes(24).toString('hex');
    await assert.rejects(bootstrapPrimary({ username: 'principal', name: 'Administrador de teste', password: 'curta123' }),
      { status: 400, message: 'A senha deve ter de 12 a 128 caracteres.' });
    assert.equal((await one('SELECT count(*) AS total FROM users')).total, '0');
    const admin = await bootstrapPrimary({ username: 'principal', name: 'Administrador de teste', password: adminPassword });
    assert(admin.primary);
    assert.match((await one('SELECT password_hash FROM users WHERE id = $1', [admin.id])).password_hash, /^\$argon2id\$/);
    await assert.rejects(bootstrapPrimary({ username: 'outro', name: 'Outro', password: adminPassword }), { status: 409 });
    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api`;

    async function call(path, { status = 200, method = 'GET', body, headers = {} } = {}) {
      const reply = await fetch(url + path, {
        method, headers: { origin, 'content-type': 'application/json', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await reply.text();
      assert.equal(reply.status, status, `${method} ${path}: ${data && reply.status !== status ? data : ''}`);
      return { data: data ? JSON.parse(data) : null, headers: reply.headers };
    }
    const auth = '/v1/auth';
    await call('/health');
    await call('/v1/dashboard', { status: 401 });
    await call(auth + '/login', { method: 'POST', status: 403, headers: { origin: 'https://desautorizada.example' },
      body: { username: 'principal', password: adminPassword } });
    const web = await call(auth + '/login', { method: 'POST', body: { username: 'principal', password: adminPassword } });
    assert(!web.data.token);
    const cookie = web.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const adminHeaders = { cookie: cookie.split(';')[0] };
    const empty = await call('/v1/dashboard', { headers: adminHeaders });
    assert.deepEqual(empty.data.tanks.map((tank) => tank.status), ['unknown', 'unknown']);

    const usersPath = '/v1/admin/users';
    const { data: added } = await call(usersPath, {
      method: 'POST', status: 201, headers: adminHeaders, body: { username: 'operador', name: 'Operador de teste', role: 'operator' },
    });
    assert.notEqual((await one('SELECT token_hash FROM password_recovery_tokens')).token_hash, added.code);
    await call(auth + '/recover', { method: 'POST', status: 204, body: { code: added.code, password: operatorPassword } });
    await call(auth + '/recover', { method: 'POST', status: 400, body: { code: added.code, password: operatorPassword } });
    const loginBody = { username: 'operador', password: operatorPassword, native: true };
    const login = () => call(auth + '/login', { method: 'POST', body: loginBody, headers: { origin: 'https://localhost' } });
    const operator = await login();
    const operatorHeaders = { authorization: 'Bearer ' + operator.data.token };
    const userPath = usersPath + '/' + added.user.id;
    assert(!operator.headers.get('set-cookie'));
    assert.equal((await call(auth + '/me', { headers: operatorHeaders })).data.user.role, 'operator');
    await call(usersPath, { status: 403, headers: operatorHeaders });
    await call('/v1/admin/audit', { status: 403, headers: operatorHeaders });
    await call('/v1/tanks/oil-clean-01', { status: 403, method: 'PATCH', body: { critical_threshold: 13 }, headers: operatorHeaders });
    await call('/v1/readings', { status: 401, method: 'POST', body: { tankId: 'oil-clean-01', levelPercent: 20 }, headers: operatorHeaders });
    await call('/v1/tanks', { status: 400, method: 'PATCH', headers: adminHeaders, body: {
      'oil-clean-01': { attention_threshold: 35, critical_threshold: 13 },
      'oil-used-01': { attention_threshold: 90, critical_threshold: 85 },
    } });
    assert.equal((await one("SELECT attention_threshold FROM tanks WHERE kind = 'clean'")).attention_threshold, 30);

    const start = Date.now() - 60 * 60000;
    const when = (minute) => new Date(start + minute * 60000).toISOString();
    const reading = (tankId, levelPercent, minute) => call('/v1/readings', {
      method: 'POST', status: 201, headers: { 'x-ingest-token': process.env.INGEST_TOKEN },
      body: { tankId, levelPercent, measuredAt: when(minute), deviceId: 'test' },
    });
    for (let index = 0; index < 4; index++) {
      await Promise.all([
        reading('oil-clean-01', 60 - index * 5, 10 + index * 10),
        reading('oil-used-01', 40 + index * 5, 10 + index * 10),
      ]);
    }
    const monitored = await call('/v1/dashboard', { headers: operatorHeaders });
    assert.equal(monitored.data.dataMode, 'simulation');
    assert.equal(monitored.data.history.length, 4);
    assert(monitored.data.forecasts.every(({ available }) => available));
    await Promise.all([reading('oil-clean-01', 9, 49), reading('oil-clean-01', 10, 49)]);
    assert.equal((await one('SELECT count(*) AS total FROM alerts WHERE is_active')).total, '1');
    await reading('oil-clean-01', 90, 2);
    assert.equal((await call('/v1/alerts', { headers: operatorHeaders })).data.data[0].active, true);
    await reading('oil-clean-01', 60, 55);
    assert.equal((await call('/v1/alerts', { headers: operatorHeaders })).data.data[0].active, false);
    assert.equal((await call('/v1/readings?limit=500', { headers: operatorHeaders })).data.data.length, 12);
    const filtered = await call('/v1/readings?' + new URLSearchParams({
      start: when(10), end: when(20), tankId: 'oil-used-01',
    }), { headers: operatorHeaders });
    assert.deepEqual(filtered.data.data.map(({ levelPercent }) => levelPercent), [45, 40]);
    assert.equal((await call('/v1/forecasts', { headers: operatorHeaders })).data.data.length, 2);
    const dates = [...new Set([when(2).slice(0, 10), when(55).slice(0, 10)])];
    const report = await call('/v1/reports/daily?date=' + dates[0], { headers: operatorHeaders });
    assert(report.data.hasData);
    const range = await call(`/v1/reports/period?start=${dates[0]}&end=${dates.at(-1)}`, { headers: operatorHeaders });
    assert.equal(range.data.oilClean.readingCount + range.data.oilUsed.readingCount, 12);
    const persistedReport = await one("SELECT payload FROM report_snapshots WHERE report_type = 'period'");
    assert.deepEqual(persistedReport.payload, range.data);
    assert.equal((await call('/v1/reports/days', { headers: operatorHeaders })).data.data.length, dates.length);

    await call(userPath + '/revoke', { method: 'POST', status: 204, headers: adminHeaders });
    await call(auth + '/me', { status: 401, headers: operatorHeaders });
    await call(userPath, { method: 'PATCH', headers: adminHeaders, body: { active: false } });
    await call(auth + '/login', { method: 'POST', status: 401, body: loginBody });
    await call(userPath, { method: 'PATCH', headers: adminHeaders, body: { active: true, role: 'admin' } });
    const promoted = await login();
    assert.equal(promoted.data.user.role, 'admin');
    await call(usersPath + '/' + admin.id, {
      method: 'PATCH', status: 403, headers: { authorization: 'Bearer ' + promoted.data.token }, body: { active: false },
    });
    for (let attempt = 1; attempt <= 10; attempt++) {
      await call(auth + '/login', {
        method: 'POST', status: 401, body: { ...loginBody, password: 'senha incorreta de teste' },
      });
    }
    await call(auth + '/login', { method: 'POST', status: 429, body: loginBody });
    const renewed = await call(userPath + '/recovery', { method: 'POST', headers: adminHeaders });
    const newPassword = randomBytes(24).toString('hex');
    await call(auth + '/recover', { method: 'POST', status: 204, body: { code: renewed.data.code, password: newPassword } });
    await call(auth + '/me', { status: 401, headers: { authorization: 'Bearer ' + promoted.data.token } });
    await call(auth + '/login', { method: 'POST', status: 401, body: loginBody });
    const fresh = await call(auth + '/login', {
      method: 'POST', body: { username: loginBody.username, password: newPassword },
    });
    const expiredCookie = { cookie: fresh.headers.get('set-cookie').split(';')[0] };
    await db.query("UPDATE user_sessions SET expires_at = now() - interval '1 second' WHERE user_id = $1", [added.user.id]);
    await call(auth + '/me', { status: 401, headers: expiredCookie });
    const expiredLogout = await call(auth + '/logout', { method: 'POST', status: 204, headers: expiredCookie });
    assert.match(expiredLogout.headers.get('set-cookie'), /^oilguard_session=;/);
    for (let attempt = 1; attempt <= 11; attempt++) {
      await call(auth + '/login', { method: 'POST', status: attempt > 10 ? 429 : 401, body: { username: 'desconhecido', password: 'incorreta' } });
    }
    assert(await one("SELECT 1 FROM audit_logs WHERE action = 'auth.password_reset' AND target_user_id = $1", [added.user.id]));
    const auditLog = await call('/v1/admin/audit?limit=10', { headers: adminHeaders });
    assert.equal(auditLog.data.data.length, 10);
    assert(auditLog.data.data.some(({ action }) => action === 'auth.login_failed'));
    await call(auth + '/logout', {
      method: 'POST', status: 403, headers: { ...adminHeaders, origin: 'https://desautorizada.example' },
    });
    await call(auth + '/me', { headers: adminHeaders });
    await call(auth + '/logout', { method: 'POST', status: 204, headers: adminHeaders });
    await call(auth + '/logout', { method: 'POST', status: 204, headers: adminHeaders });
    assert.equal((await one("SELECT count(*) AS total FROM audit_logs WHERE action = 'auth.logout'")).total, '1');
    await call('/v1/dashboard', { status: 401, headers: adminHeaders });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await db.end();
    await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await root.end();
  }
});
