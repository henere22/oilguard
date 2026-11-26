import { db } from './database.js';
import { migrate } from './migrate.js';

try {
  await migrate();
  console.log('Migrações PostgreSQL aplicadas e verificadas.');
} catch (error) {
  console.error('Falha nas migrações PostgreSQL.', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
