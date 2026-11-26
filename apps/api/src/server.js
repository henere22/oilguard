import { db } from './database.js';
import { createApp } from './app.js';
import { migrate } from './migrate.js';

try {
  const app = createApp();
  await migrate();
  const port = Number(process.env.PORT ?? 3333);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = app.listen(port, host);
  server.on('listening', () => {
    console.log(`OILGUARD API ouvindo em ${host}:${port} com PostgreSQL.`);
  });
  server.on('error', async (error) => {
    console.error('Falha ao iniciar o servidor.', error.code ?? error.name);
    await db.end();
    process.exitCode = 1;
  });
  const shutdown = () => server.close(() => db.end());
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  console.error('Inicialização da API falhou.', error.code ?? error.message);
  await db.end();
  process.exitCode = 1;
}
