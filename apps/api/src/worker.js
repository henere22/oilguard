import { createServer } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { db, one, transaction } from './database.js';
import { migrate } from './migrate.js';
import { simulatorAvailable, simulatorTick, workerHeartbeatMs, workerOfflineMs } from './simulator.js';

const controller = new AbortController();
const { signal } = controller;
const stop = () => controller.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

const workerLock = 403333;
let lastDatabaseResponse = 0;
const health = createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/healthz') {
    res.writeHead(404).end();
    return;
  }
  const ready = Date.now() - lastDatabaseResponse < workerOfflineMs;
  res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ status: ready ? 'ok' : 'unavailable' }));
});

const wait = (ms) => delay(ms, undefined, { signal }).catch((error) => {
  if (!signal.aborted) throw error;
});

async function workerLoop() {
  while (!signal.aborted) {
    let client;
    try {
      if (!simulatorAvailable()) {
        await db.query('SELECT 1 FROM simulator_state');
        lastDatabaseResponse = Date.now();
        await wait(workerHeartbeatMs);
        continue;
      }

      client = await db.connect();
      let connected = true;
      client.on('error', () => {
        connected = false;
        lastDatabaseResponse = 0;
      });
      const { acquired } = await one('SELECT pg_try_advisory_lock($1, hashtext(current_schema())) AS acquired', [workerLock], client);
      lastDatabaseResponse = Date.now();
      if (acquired) {
        console.log('Worker OILGUARD assumiu a simulação.');
        while (connected && !signal.aborted) {
          await transaction(simulatorTick, { client });
          lastDatabaseResponse = Date.now();
          await wait(500);
        }
      }
    } catch (error) {
      lastDatabaseResponse = 0;
      if (!signal.aborted) console.error('Worker OILGUARD aguardando PostgreSQL.', error.code ?? error.name);
    } finally {
      // Encerrar a sessão libera o lock mesmo quando a conexão falha.
      client?.release(true);
    }
    await wait(2000);
  }
}

try {
  if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL para o Worker.');
  const port = Number(process.env.WORKER_HEALTH_PORT ?? 3336);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WORKER_HEALTH_PORT inválida.');
  await migrate();
  await new Promise((resolve, reject) => health.once('error', reject).listen(port, '127.0.0.1', resolve));
  console.log('Worker OILGUARD iniciado. A geração depende do comando de um administrador.');
  await workerLoop();
} catch (error) {
  console.error('Falha ao iniciar Worker OILGUARD.', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  if (health.listening) await new Promise((resolve) => health.close(resolve));
  await db.end();
}
