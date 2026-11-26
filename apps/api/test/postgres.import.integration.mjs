import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import pg from 'pg';

const run = promisify(execFile);
const importer = fileURLToPath(new URL('../src/import-sqlite.js', import.meta.url));
const timestamp = '2026-11-16T14:30:00.000Z';

function seedLegacy(database) {
  database.pragma('journal_mode = WAL');
  database.pragma('wal_autocheckpoint = 0');
  database.exec(`
    CREATE TABLE tanks (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, capacity_liters REAL,
      attention_threshold REAL NOT NULL, critical_threshold REAL NOT NULL,
      level_percent REAL NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tank_id TEXT NOT NULL REFERENCES tanks(id),
      level_percent REAL NOT NULL, measured_at TEXT NOT NULL, received_at TEXT NOT NULL, device_id TEXT
    );
    CREATE TABLE alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tank_id TEXT NOT NULL REFERENCES tanks(id),
      severity TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL,
      is_active INTEGER NOT NULL, created_at TEXT NOT NULL, resolved_at TEXT
    );
    INSERT INTO tanks VALUES
      ('oil-clean-01', 'Óleo limpo', 'clean', NULL, 30, 15, 24.5, '${timestamp}'),
      ('oil-used-01', 'Óleo usado', 'used', NULL, 70, 85, 75, '${timestamp}');
    INSERT INTO readings VALUES
      (7, 'oil-clean-01', 24.5, '${timestamp}', '${timestamp}', 'simulator-01'),
      (120, 'oil-used-01', 75, '${timestamp}', '${timestamp}', NULL);
    DELETE FROM readings WHERE id = 120;
    INSERT INTO alerts VALUES
      (9, 'oil-clean-01', 'attention', 'Nível de atenção', 'Verifique o nível.', 1, '${timestamp}', NULL),
      (12, 'oil-used-01', 'critical', 'Nível crítico', 'Verifique o nível.', 0, '${timestamp}', '${timestamp}');
  `);
}

test('importação SQLite com WAL, verificação e rollback no PostgreSQL', async () => {
  assert(process.env.TEST_DATABASE_URL, 'Defina TEST_DATABASE_URL para um PostgreSQL local de testes.');
  const schema = 'oilguard_import_test_' + randomBytes(8).toString('hex');
  const url = new URL(process.env.TEST_DATABASE_URL);
  const root = new pg.Pool({ connectionString: url.toString() });
  url.searchParams.set('options', `-c search_path=${schema}`);
  const target = new pg.Pool({ connectionString: url.toString() });
  const temporary = await mkdtemp(join(tmpdir(), 'oilguard-import-test-'));
  const source = join(temporary, 'source.sqlite');
  const sqlite = new Database(source);
  const importLegacy = (dataMode = 'simulation') => run(process.execPath, [importer, source], {
    env: { ...process.env, DATABASE_URL: url.toString(), DATA_MODE: dataMode },
    windowsHide: true,
  });

  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    seedLegacy(sqlite);
    assert((await stat(source + '-wal')).size > 32);
    await assert.rejects(importLegacy('operational'), { stderr: /Importe o histórico legado em um banco de simulação/ });

    sqlite.prepare('UPDATE alerts SET is_active = 2 WHERE id = 9').run();
    await assert.rejects(importLegacy(), { stderr: /Alerta legado 9 com indicador is_active inválido/ });
    sqlite.prepare("UPDATE alerts SET is_active = 1, severity = 'invalid' WHERE id = 9").run();
    await assert.rejects(importLegacy(), { stderr: /23514/ });
    const { rows: [rollback] } = await target.query(`SELECT
      (SELECT count(*) FROM readings) AS readings, (SELECT count(*) FROM legacy_imports) AS imports,
      (SELECT count(*) FROM tanks WHERE level_percent IS NOT NULL) AS updated_tanks`);
    assert.deepEqual(rollback, { readings: '0', imports: '0', updated_tanks: '0' });

    sqlite.prepare("UPDATE alerts SET severity = 'attention' WHERE id = 9").run();
    const [{ stdout: first }, { stdout: second }] = await Promise.all([importLegacy(), importLegacy()]);
    const attempts = [first, second];
    assert.equal(attempts.filter((output) => output.includes('concluída e conferida campo a campo')).length, 1);
    assert.equal(attempts.filter((output) => output.includes('já importada e conferida anteriormente')).length, 1);
    const { rows: [receipt] } = await target.query('SELECT counts FROM legacy_imports');
    assert.deepEqual(receipt.counts, { tanks: 2, readings: 1, alerts: 2 });
    const { rows: readings } = await target.query('SELECT id, tank_id, level_percent, device_id, measured_at FROM readings');
    assert.deepEqual(readings, [{ id: 7, tank_id: 'oil-clean-01', level_percent: 24.5, device_id: 'simulator-01', measured_at: new Date(timestamp) }]);
    const { rows: alerts } = await target.query('SELECT id, title, is_active, resolved_at FROM alerts ORDER BY id');
    assert.deepEqual(alerts, [
      { id: 9, title: 'Nível de atenção', is_active: true, resolved_at: null },
      { id: 12, title: 'Nível crítico', is_active: false, resolved_at: new Date(timestamp) },
    ]);

    const backups = (await readdir(temporary)).filter((file) => /^oilguard-before-postgres-.*\.sqlite$/.test(file));
    assert.equal(backups.length, 4);
    const backup = new Database(join(temporary, backups.find((file) => attempts.some((output) => output.includes(file)))), { readonly: true });
    try {
      assert.equal(backup.pragma('integrity_check', { simple: true }), 'ok');
      assert.deepEqual(backup.prepare('SELECT id, level_percent FROM readings').all(), [{ id: 7, level_percent: 24.5 }]);
    } finally {
      backup.close();
    }

    sqlite.prepare('UPDATE readings SET level_percent = 23 WHERE id = 7').run();
    await assert.rejects(importLegacy(), { stderr: /O destino contém dados/ });
    assert.equal((await target.query('SELECT level_percent FROM readings WHERE id = 7')).rows[0].level_percent, 24.5);
    const { rows: [next] } = await target.query(`INSERT INTO readings
      (tank_id, level_percent, measured_at, received_at) VALUES ('oil-used-01', 75, $1, $1) RETURNING id`, [timestamp]);
    assert.equal(next.id, 121);
  } finally {
    sqlite.close();
    await target.end();
    await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await root.end();
    await rm(temporary, { recursive: true, force: true });
  }
});
