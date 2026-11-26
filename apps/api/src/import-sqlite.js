import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import Database from 'better-sqlite3';
import { dataMode, db, one, rows, transaction } from './database.js';
import { migrate } from './migrate.js';

const tables = {
  tanks: 'id,name,kind,capacity_liters,attention_threshold,critical_threshold,level_percent,updated_at',
  readings: 'id,tank_id,level_percent,measured_at,received_at,device_id',
  alerts: 'id,tank_id,severity,title,message,is_active,created_at,resolved_at',
};
const apiRoot = fileURLToPath(new URL('../', import.meta.url));
const legacyPath = process.argv[2] ?? resolve(apiRoot, process.env.DB_FILE ?? 'data/oilguard.sqlite');
const backupPath = resolve(dirname(legacyPath), `oilguard-before-postgres-${Date.now()}.sqlite`);
const timestampFields = ['updated_at', 'measured_at', 'received_at', 'created_at', 'resolved_at'];

async function snapshot() {
  const legacy = new Database(legacyPath, { readonly: true, fileMustExist: true });
  try {
    await mkdir(dirname(backupPath), { recursive: true });
    await legacy.backup(backupPath);
  } finally {
    legacy.close();
  }

  const backup = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    if (backup.pragma('integrity_check', { simple: true }) !== 'ok' || backup.pragma('foreign_key_check').length) {
      throw new Error('A cópia SQLite não passou nas verificações de integridade.');
    }
    const data = {};
    for (const [table, columns] of Object.entries(tables)) {
      data[table] = backup.prepare(`SELECT ${columns} FROM ${table} ORDER BY id`).all();
      for (const row of data[table]) {
        for (const field of timestampFields) {
          if (row[field] != null) row[field] = new Date(row[field]).toISOString();
        }
        if (table === 'alerts') row.is_active = Boolean(row.is_active);
      }
    }
    const sequences = backup.prepare("SELECT name, seq FROM sqlite_sequence WHERE name IN ('alerts', 'readings') ORDER BY name").all();
    return { data, sequences };
  } finally {
    backup.close();
  }
}

try {
  if (dataMode !== 'simulation') throw new Error('Importe o histórico legado em um banco de simulação.');
  const { data, sequences } = await snapshot();
  const fingerprint = createHash('sha256').update(JSON.stringify({ data, sequences })).digest('hex');
  const counts = Object.fromEntries(Object.entries(data).map(([table, records]) => [table, records.length]));
  await migrate();
  const imported = await transaction(async (connection) => {
    await connection.query('LOCK TABLE tanks, readings, alerts, legacy_imports IN ACCESS EXCLUSIVE MODE');
    if (await one('SELECT 1 FROM legacy_imports WHERE fingerprint = $1', [fingerprint], connection)) return false;

    const occupied = await one(`SELECT EXISTS (SELECT 1 FROM readings)
      OR EXISTS (SELECT 1 FROM alerts) OR EXISTS (SELECT 1 FROM legacy_imports)
      OR EXISTS (SELECT 1 FROM tanks WHERE updated_at IS NOT NULL OR level_percent IS NOT NULL)
      OR EXISTS (SELECT 1 FROM audit_logs WHERE action = 'tank.thresholds_changed') AS value`, [], connection);
    if (occupied.value) throw new Error('O destino contém dados. Utilize um banco PostgreSQL de simulação vazio.');

    for (const [table, columns] of Object.entries(tables)) {
      const fields = columns.split(',');
      const updates = fields.slice(1).map((column) => `${column} = EXCLUDED.${column}`).join(', ');
      const conflict = table === 'tanks' ? `ON CONFLICT (id) DO UPDATE SET ${updates}` : '';
      for (let offset = 0; offset < data[table].length; offset += 1000) {
        await connection.query(`INSERT INTO ${table} (${columns})
          SELECT ${columns} FROM json_populate_recordset(NULL::${table}, $1::json) ${conflict}`,
        [JSON.stringify(data[table].slice(offset, offset + 1000))]);
      }
      const received = await rows(`SELECT ${columns} FROM ${table} ORDER BY id`, [], connection);
      if (!isDeepStrictEqual(received, data[table])) {
        throw new Error(`Divergência nos registros de ${table}. A importação foi revertida.`);
      }
    }
    for (const table of ['readings', 'alerts']) {
      const nextId = Math.max(sequences.find(({ name }) => name === table)?.seq ?? 0, data[table].at(-1)?.id ?? 0) + 1;
      if (!Number.isSafeInteger(nextId) || nextId < 1 || nextId > 2147483647) {
        throw new Error(`A sequência legada de ${table} está fora do intervalo suportado.`);
      }
      await connection.query(`ALTER TABLE ${table} ALTER COLUMN id RESTART WITH ${nextId}`);
    }
    await connection.query('INSERT INTO legacy_imports (fingerprint, counts) VALUES ($1, $2)', [fingerprint, counts]);
    return true;
  });
  console.log(imported ? 'Importação concluída e conferida campo a campo.' : 'Cópia já importada e conferida anteriormente.');
  console.log(JSON.stringify(counts), `Cópia preservada em ${backupPath}`);
} catch (error) {
  console.error('Falha na importação SQLite.', error.code ?? error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
