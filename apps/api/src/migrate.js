import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dataMode, one, rows, transaction } from './database.js';

export async function migrate() {
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
  await transaction(async (connection) => {
    await connection.query('SELECT pg_advisory_xact_lock(403331)');
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = await rows('SELECT version, checksum FROM schema_migrations', [], connection);
    const previous = new Map(applied.map(({ version, checksum }) => [version, checksum]));
    if (applied.some(({ version }) => !files.includes(version))) {
      throw new Error('O banco contém migrações ausentes nesta versão do código.');
    }

    for (const file of files) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      if (previous.has(file)) {
        if (previous.get(file) !== checksum) throw new Error(`Migração alterada após aplicação: ${file}`);
        continue;
      }
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)', [file, checksum]);
    }

    await connection.query(
      'INSERT INTO system_settings (data_mode) VALUES ($1) ON CONFLICT DO NOTHING', [dataMode],
    );
    const settings = await one('SELECT data_mode FROM system_settings', [], connection);
    if (settings.data_mode !== dataMode) {
      throw new Error('DATA_MODE diverge do modo registrado no banco. Use um banco separado.');
    }
  });
}
