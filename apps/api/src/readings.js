import { one } from './database.js';
import { getTankStatus } from './domain.js';
import { HttpError } from './security.js';

export const tankForUpdate = 'SELECT * FROM tanks WHERE id = $1 FOR UPDATE';
export const readingsSql = 'SELECT * FROM readings WHERE tank_id = $1 ORDER BY measured_at DESC, id DESC LIMIT $2';

export async function refreshAlert(connection, tank, timestamp) {
  const status = getTankStatus(tank);
  const existing = await one('SELECT id, severity FROM alerts WHERE tank_id = $1 AND is_active', [tank.id], connection);
  if (existing?.severity === status) return;
  if (existing) await connection.query('UPDATE alerts SET is_active = false, resolved_at = $1 WHERE id = $2', [timestamp, existing.id]);
  if (status === 'normal') return;

  const title = tank.name + (status === 'critical' ? ': nível crítico' : ': nível de atenção');
  const action = tank.kind === 'clean' ? 'necessidade de reposição de óleo limpo' : 'retirada de óleo usado';
  const message = `O nível está em ${tank.level_percent.toFixed(1)}%. Verifique a ${action}.`;
  await connection.query('INSERT INTO alerts (tank_id, severity, title, message, created_at) VALUES ($1, $2, $3, $4, $5)',
    [tank.id, status, title, message, timestamp]);
}

export async function recordReading(connection, { tankId, levelPercent, measuredAt, receivedAt, deviceId }) {
  const tank = await one(tankForUpdate, [tankId], connection);
  if (!tank) throw new HttpError(404, 'Compartimento não encontrado.');
  const latest = await one(readingsSql, [tank.id, 1], connection);
  await connection.query(`INSERT INTO readings (tank_id, level_percent, measured_at, received_at, device_id)
    VALUES ($1, $2, $3, $4, $5)`, [tank.id, levelPercent, measuredAt, receivedAt, deviceId]);
  if (latest && measuredAt < latest.measured_at) return tank;
  const current = await one('UPDATE tanks SET level_percent = $1, updated_at = $2 WHERE id = $3 RETURNING *',
    [levelPercent, receivedAt, tank.id], connection);
  await refreshAlert(connection, current, receivedAt);
  return current;
}
