import { Router } from 'express';
import { z } from 'zod';
import { lockAdmin } from './auth.js';
import { one, transaction } from './database.js';
import { audit, HttpError } from './security.js';
import { getSimulatorState, scenarios, simulatorAvailable, workerOfflineMs } from './simulator.js';

const updatesSchema = z.strictObject({
  enabled: z.boolean().optional(),
  scenario: z.enum(Object.keys(scenarios)).optional(),
  intervalMs: z.number().int().min(1000).max(60000).optional(),
}).refine((input) => Object.keys(input).length > 0);

function serialize(state) {
  const available = simulatorAvailable();
  const workerOnline = available && Boolean(state.worker_seen_at) &&
    Date.parse(state.checked_at) - Date.parse(state.worker_seen_at) < workerOfflineMs;
  return {
    available, workerOnline, scenarios, enabled: available && state.enabled,
    scenario: state.scenario, intervalMs: state.interval_ms, tickCount: state.tick_count,
    cleanLevel: state.clean_level, usedLevel: state.used_level, lastTickAt: state.last_tick_at,
  };
}

export function simulatorRoutes() {
  const router = Router();
  router.get('/', async (_req, res) => res.json(serialize(await getSimulatorState())));

  async function change(req, res, updates, reset = false) {
    if (!simulatorAvailable()) throw new HttpError(403, 'Simulação desabilitada neste ambiente.');
    const current = await transaction(async (connection) => {
      await lockAdmin(req, connection);
      const state = await getSimulatorState(connection, true);
      const scenario = updates.scenario ?? state.scenario;
      const intervalMs = updates.intervalMs ?? state.interval_ms;
      const enabled = updates.enabled ?? state.enabled;
      const restarting = reset || scenario !== state.scenario;
      const reschedule = restarting || !state.enabled || intervalMs !== state.interval_ms;
      const config = scenarios[scenario];
      const updated = await one(`UPDATE simulator_state SET enabled = $1, scenario = $2, interval_ms = $3,
        clean_level = $4, used_level = $5, tick_count = $6, last_tick_at = $7, next_tick_at = $8
        WHERE singleton RETURNING *, clock_timestamp() AS checked_at`, [
        enabled, scenario, intervalMs, restarting ? config.clean.start : state.clean_level,
        restarting ? config.used.start : state.used_level, restarting ? 0 : state.tick_count,
        restarting ? null : state.last_tick_at, enabled ? (reschedule ? state.checked_at : state.next_tick_at) : null,
      ], connection);
      await audit(connection, reset ? 'simulator.reset' : 'simulator.configured', req.user.id, null,
        { enabled, scenario, intervalMs });
      return updated;
    });
    res.json(serialize(current));
  }

  router.patch('/', async (req, res) => {
    const parsed = updatesSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Configure um cenário válido, o estado ou um intervalo entre 1000 e 60000 ms.');
    await change(req, res, parsed.data);
  });
  router.post('/reset', (req, res) => change(req, res, {}, true));
  return router;
}
