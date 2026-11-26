import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

export const dataMode = process.env.DATA_MODE ?? 'simulation';
if (!['simulation', 'operational'].includes(dataMode)) throw new Error('DATA_MODE inválido.');

const poolMax = Number(process.env.DB_POOL_MAX ?? 10);
if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 100) throw new Error('DB_POOL_MAX inválido.');
pg.types.setTypeParser(1184, (value) => new Date(value).toISOString());

export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
  application_name: 'oilguard',
});
db.on('error', (error) => console.error('Conexão PostgreSQL interrompida.', error.code ?? error.name));

export async function rows(sql, values = [], connection = db) {
  return (await connection.query(sql, values)).rows;
}

export async function one(sql, values = [], connection = db) {
  return (await rows(sql, values, connection))[0];
}

export async function transaction(work, { snapshot = false, client } = {}) {
  const connection = client ?? await db.connect();
  let discard = false;
  try {
    await connection.query(snapshot ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await work(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await connection.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    if (!client) connection.release(discard);
  }
}
