import { dataMode, one } from './database.js';
import { recordReading } from './readings.js';

export const scenarios = {
  normal: {
    name: 'Normal', clean: { start: 72, rate: -0.3, noise: 0.05 }, used: { start: 38, rate: 0.25, noise: 0.04 },
  },
  attention: {
    name: 'Atenção', clean: { start: 32, rate: -0.4, noise: 0.06 }, used: { start: 68, rate: 0.35, noise: 0.05 },
  },
  critical: {
    name: 'Crítico', clean: { start: 12, rate: -0.5, noise: 0.08 }, used: { start: 88, rate: 0.45, noise: 0.07 },
  },
  demo: {
    name: 'Demo Rápida', clean: { start: 72, rate: -2, noise: 0.2 }, used: { start: 38, rate: 1.8, noise: 0.15 },
  },
};

export const simulatorAvailable = () => dataMode === 'simulation' && process.env.SIMULATOR_ENABLED === 'true';
export const workerHeartbeatMs = 5000;
export const workerOfflineMs = 20000;

export async function getSimulatorState(connection, lock = false) {
  return one(`SELECT *, clock_timestamp() AS checked_at FROM simulator_state WHERE singleton${lock ? ' FOR UPDATE' : ''}`,
    [], connection);
}

function nextLevel(level, { rate, noise }) {
  return Math.min(100, Math.max(0, level + rate + (Math.random() - 0.5) * noise * 2));
}

// O chamador mantém o advisory lock na mesma conexão usada pela transação.
export async function simulatorTick(connection) {
  const state = await getSimulatorState(connection, true);
  const timestamp = state.checked_at;
  if (!state.enabled || state.next_tick_at > timestamp) {
    if (!state.worker_seen_at || Date.parse(timestamp) - Date.parse(state.worker_seen_at) >= workerHeartbeatMs) {
      await connection.query('UPDATE simulator_state SET worker_seen_at = $1 WHERE singleton', [timestamp]);
    }
    return;
  }

  const config = scenarios[state.scenario];
  const clean = nextLevel(state.clean_level, config.clean);
  const used = nextLevel(state.used_level, config.used);
  const base = { measuredAt: timestamp, receivedAt: timestamp, deviceId: 'simulator-worker' };
  await recordReading(connection, { ...base, tankId: 'oil-clean-01', levelPercent: Number(clean.toFixed(1)) });
  await recordReading(connection, { ...base, tankId: 'oil-used-01', levelPercent: Number(used.toFixed(1)) });
  await connection.query(`UPDATE simulator_state SET clean_level = $1, used_level = $2,
    tick_count = tick_count + 1, last_tick_at = $3, worker_seen_at = $3,
    next_tick_at = $3::timestamptz + interval '1 millisecond' * interval_ms WHERE singleton`,
  [clean, used, timestamp]);
}
