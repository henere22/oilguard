import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import pg from 'pg';

test('configuração operacional, HTTPS no proxy e credencial de ingestão', async () => {
  assert(process.env.TEST_DATABASE_URL, 'Defina TEST_DATABASE_URL para um PostgreSQL local de testes.');
  const schema = 'oilguard_production_test_' + randomBytes(8).toString('hex');
  const root = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const connection = new URL(process.env.TEST_DATABASE_URL);
  connection.searchParams.set('options', `-c search_path=${schema}`);
  const headers = { 'x-forwarded-proto': 'https', 'content-type': 'application/json' };
  const origin = 'https://oilguard.example';
  const token = randomBytes(32).toString('hex');
  process.env.DATABASE_URL = connection.toString();
  process.env.DATA_MODE = 'operational';
  process.env.NODE_ENV = 'production';
  process.env.PUBLIC_ORIGIN = origin;
  process.env.TRUST_PROXY_HOPS = '1';
  process.env.INGEST_TOKEN = token;
  process.env.SIMULATOR_ENABLED = 'true';
  const { db, one } = await import('../src/database.js');
  const { migrate } = await import('../src/migrate.js');
  const { createApp } = await import('../src/app.js');
  const { bootstrapPrimary } = await import('../src/auth.js');

  let server;
  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    await migrate();
    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api`;
    assert.equal((await fetch(new URL('/healthz', url))).status, 200);
    assert.equal((await fetch(url + '/health')).status, 426);
    assert.equal((await fetch(url + '/health', { headers })).status, 200);
    const username = 'principal';
    const password = randomBytes(24).toString('hex');
    await bootstrapPrimary({ username, name: 'Administrador de teste', password });
    const login = await fetch(url + '/v1/auth/login', {
      method: 'POST', headers: { ...headers, origin }, body: JSON.stringify({ username, password }),
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /; Secure/);
    const rejectedControl = await fetch(url + '/v1/admin/simulator', {
      method: 'PATCH', headers: { ...headers, origin, cookie: login.headers.get('set-cookie').split(';')[0] },
      body: JSON.stringify({ enabled: true }),
    });
    assert.equal(rejectedControl.status, 403);

    const send = (deviceId, credential) => fetch(url + '/v1/readings', {
      method: 'POST', headers: { ...headers, 'x-ingest-token': credential },
      body: JSON.stringify({ tankId: 'oil-clean-01', levelPercent: 62, deviceId }),
    });
    assert.equal((await send('simulator-01', token)).status, 403);
    assert.equal((await send('esp32-teste', 'inválido')).status, 401);
    assert.equal((await send('esp32-teste', token)).status, 201);
    assert.equal((await one('SELECT count(*) AS total FROM readings')).total, '1');
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await db.end();
    await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await root.end();
  }
});
