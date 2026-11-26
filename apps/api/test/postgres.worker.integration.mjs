import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

async function until(check, message) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(100);
  }
  assert.fail(message);
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

const close = (server) => new Promise((resolve) => server.close(resolve));

test('Worker autorizado e independente, com exclusão mútua e failover', async () => {
  assert(process.env.TEST_DATABASE_URL, 'Defina TEST_DATABASE_URL para um PostgreSQL local de testes.');
  const schema = 'oilguard_worker_test_' + randomBytes(8).toString('hex');
  const root = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const connection = new URL(process.env.TEST_DATABASE_URL);
  connection.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, {
    DATABASE_URL: connection.toString(), DATA_MODE: 'simulation', NODE_ENV: 'production',
    SIMULATOR_ENABLED: 'true', PUBLIC_ORIGIN: 'https://oilguard.example', TRUST_PROXY_HOPS: '1', INGEST_TOKEN: '',
  });
  const { db, one } = await import('../src/database.js');
  const { migrate } = await import('../src/migrate.js');
  const { createApp } = await import('../src/app.js');
  const { bootstrapPrimary } = await import('../src/auth.js');
  const workers = [];
  let api;

  async function startWorker(enabled) {
    const probe = createServer();
    const port = await listen(probe);
    await close(probe);
    const child = spawn(process.execPath, [fileURLToPath(new URL('../src/worker.js', import.meta.url))], {
      env: { ...process.env, SIMULATOR_ENABLED: String(enabled), WORKER_HEALTH_PORT: String(port), DB_POOL_MAX: '2' },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    const worker = { child, output: '' };
    workers.push(worker);
    for (const stream of [child.stdout, child.stderr]) {
      stream.on('data', (chunk) => { worker.output += chunk; });
    }
    await until(async () => {
      if (child.exitCode !== null) assert.fail(worker.output);
      return (await fetch(`http://127.0.0.1:${port}/healthz`).catch(() => null))?.ok;
    }, 'Worker não ficou saudável.');
    return worker;
  }

  async function stopWorker({ child }) {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill();
    await exited;
  }

  async function call(path, status, { method = 'GET', cookie, body } = {}) {
    const headers = { origin: process.env.PUBLIC_ORIGIN, 'x-forwarded-proto': 'https', 'content-type': 'application/json' };
    if (cookie) headers.cookie = cookie;
    const res = await fetch(`http://127.0.0.1:${api.address().port}/api/v1${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const response = await res.text();
    assert.equal(res.status, status, `${method} ${path}: ${response}`);
    return { data: response ? JSON.parse(response) : null, cookie: res.headers.get('set-cookie')?.split(';')[0] };
  }

  const path = '/admin/simulator';
  const state = () => one('SELECT tick_count, enabled, last_tick_at FROM simulator_state');
  const readingCount = async () => Number((await one('SELECT count(*) AS total FROM readings')).total);
  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    const leader = await startWorker(true); // inicializa e aplica migrações antes da API.
    const standby = await startWorker(true);
    await delay(700);
    assert.equal(await readingCount(), 0);
    assert.match(leader.output, /assumiu a simulação/);
    assert.doesNotMatch(standby.output, /assumiu a simulação/);
    await migrate();
    const password = randomBytes(24).toString('hex');
    await bootstrapPrimary({ username: 'principal', name: 'Administrador de teste', password });
    api = createApp().listen(0, '127.0.0.1');
    await once(api, 'listening');
    await call(path, 401);
    const { cookie } = await call('/auth/login', 200, { method: 'POST', body: { username: 'principal', password } });
    const { data: initial } = await call(path, 200, { cookie });
    assert.equal(initial.enabled, false);
    assert.equal(initial.workerOnline, true);
    const { data: operator } = await call('/admin/users', 201, {
      cookie, method: 'POST', body: { username: 'operador', name: 'Operador de teste', role: 'operator' },
    });
    await call('/auth/recover', 204, { method: 'POST', body: { code: operator.code, password } });
    const operatorLogin = await call('/auth/login', 200, { method: 'POST', body: { username: 'operador', password } });
    await call(path, 403, { method: 'PATCH', cookie: operatorLogin.cookie, body: { enabled: true } });
    await call('/readings', 401, { method: 'POST', cookie, body: { tankId: 'oil-clean-01', levelPercent: 10 } });
    await call(path, 200, { method: 'PATCH', cookie, body: { enabled: true, scenario: 'critical', intervalMs: 1000 } });
    await close(api);
    api = undefined;
    await until(async () => (await state()).tick_count >= 2, 'O Worker parou quando a API foi desligada.');
    const { rows: tags } = await db.query('SELECT DISTINCT device_id FROM readings');
    assert.deepEqual(tags, [{ device_id: 'simulator-worker' }]);
    assert.equal((await one("SELECT count(*) AS total FROM alerts WHERE severity = 'critical' AND is_active")).total, '2');

    await stopWorker(leader);
    const countBeforeFailover = (await state()).tick_count;
    await until(async () => (await state()).tick_count > countBeforeFailover, 'O suplente não assumiu após liberar o lock.');
    assert.match(standby.output, /assumiu a simulação/);

    api = createApp().listen(0, '127.0.0.1');
    await once(api, 'listening');
    const livePause = await call(path, 200, { method: 'PATCH', cookie, body: { enabled: false } });
    await delay(1200);
    assert.equal(await readingCount(), livePause.data.tickCount * 2);
    await call(path, 200, { method: 'PATCH', cookie, body: { enabled: true } });
    await until(async () => (await state()).tick_count > livePause.data.tickCount, 'A simulação não retomou.');
    await stopWorker(standby);
    const countBeforeDisabled = await readingCount();
    await startWorker(false);
    await delay(1200);
    assert.equal(await readingCount(), countBeforeDisabled);

    const paused = await call(path, 200, { method: 'PATCH', cookie, body: { enabled: false } });
    assert.equal(paused.data.enabled, false);
    assert.equal(countBeforeDisabled, paused.data.tickCount * 2);
    const reset = await call(path + '/reset', 200, { method: 'POST', cookie, body: {} });
    assert.equal(reset.data.tickCount, 0);
    assert.equal(reset.data.lastTickAt, null);
    assert.equal(reset.data.cleanLevel, 12);
    assert.equal(await readingCount(), countBeforeDisabled);
    assert(await one("SELECT 1 FROM audit_logs WHERE action = 'simulator.reset'"));
  } finally {
    if (api?.listening) await close(api);
    await Promise.all(workers.map(stopWorker));
    await db.end();
    await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await root.end();
  }
});
