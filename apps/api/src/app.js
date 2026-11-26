import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { dataMode, db, one, rows, transaction } from './database.js';
import { adminRoutes, authRoutes, lockAdmin, requireAdmin, requireUser } from './auth.js';
import { audit, HttpError, matchesSecret, rateLimit } from './security.js';
import { calculateForecast, getStatusLabel, getTankStatus } from './domain.js';
import { readingsSql, recordReading, refreshAlert, tankForUpdate } from './readings.js';
import { getDailyReport, getPeriodReport, getDaysWithData } from './reports.js';
import { simulatorRoutes } from './simulator-routes.js';

const nowIso = () => new Date().toISOString();
const tanksSql = "SELECT * FROM tanks ORDER BY kind";
const alertsSql = 'SELECT a.*, t.name AS tank_name FROM alerts a JOIN tanks t ON t.id = a.tank_id';
const readingSchema = z.object({
  tankId: z.string().min(1).max(80),
  levelPercent: z.number().min(0).max(100),
  measuredAt: z.iso.datetime({ offset: true }).optional(),
  deviceId: z.string().min(1).max(80).optional(),
});

function serializeTank(tank) {
  const status = tank.level_percent === null ? 'unknown' : getTankStatus(tank);
  return {
    id: tank.id,
    name: tank.name,
    kind: tank.kind,
    capacityLiters: tank.capacity_liters,
    levelPercent: tank.level_percent,
    attentionThreshold: tank.attention_threshold,
    criticalThreshold: tank.critical_threshold,
    status,
    statusLabel: status === 'unknown' ? 'Aguardando leitura' : getStatusLabel(status),
    updatedAt: tank.updated_at,
  };
}

function serializeAlert(alert) {
  return {
    id: alert.id, tankId: alert.tank_id, tankName: alert.tank_name,
    severity: alert.severity, title: alert.title, message: alert.message,
    active: alert.is_active, createdAt: alert.created_at, resolvedAt: alert.resolved_at,
  };
}

function forecast(tank, history) {
  return { tankId: tank.id, tankName: tank.name, ...calculateForecast(tank, history) };
}

function parseLimit(value, fallback, max) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (typeof value !== 'string' || !Number.isInteger(number) || number < 1) throw new HttpError(400, 'Limite inválido.');
  return Math.min(number, max);
}

export function createApp() {
  const production = process.env.NODE_ENV === 'production';
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  const ingestToken = process.env.INGEST_TOKEN;
  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 3) throw new Error('TRUST_PROXY_HOPS inválido.');
  if (production && (!publicOrigin?.startsWith('https://') || new URL(publicOrigin).origin !== publicOrigin ||
      !proxyHops || !process.env.DATABASE_URL || process.env.DATA_MODE !== dataMode ||
      ((dataMode === 'operational' || ingestToken) && (ingestToken?.length ?? 0) < 32))) {
    throw new Error('Produção requer PUBLIC_ORIGIN HTTPS, proxy confiável, DATABASE_URL e DATA_MODE explícitos. A ingestão requer INGEST_TOKEN forte.');
  }

  const origins = new Set([
    'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost',
    'https://localhost', 'capacitor://localhost',
    ...(production ? [publicOrigin] : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost']),
    ...(process.env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  ]);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', proxyHops);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    upgradeInsecureRequests: production ? [] : null,
  } } }));
  // O health check interno fala HTTP diretamente com o container.
  app.get('/healthz', async (_req, res) => {
    await db.query('SELECT 1 FROM system_settings');
    res.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });
  app.use((req, _res, next) => {
    if (production && !req.secure) throw new HttpError(426, 'Use HTTPS.');
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', cors({
    credentials: true,
    origin(origin, callback) {
      if (origin && !origins.has(origin)) return callback(new HttpError(403, 'Origem não autorizada.'));
      callback(null, Boolean(origin));
    },
  }));
  app.use('/api', (req, _res, next) => {
    if (['POST', 'PATCH'].includes(req.method) && (req.get('cookie') || req.path.startsWith('/v1/auth/')) &&
        !origins.has(req.get('origin'))) throw new HttpError(403, 'Origem da solicitação inválida.');
    next();
  });
  app.use('/api', rateLimit({ max: 600 }));
  app.use('/api', express.json({ limit: '32kb' }));

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1 FROM system_settings');
    res.json({ status: 'ok', service: 'oilguard-api', timestamp: nowIso() });
  });
  app.use('/api/v1/auth', authRoutes({ secure: production }));

  app.post('/api/v1/readings', async (req, res) => {
    const parsed = readingSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Dados de leitura inválidos.');
    if (dataMode === 'operational' && /simulat|^seed$|^test$/i.test(parsed.data.deviceId ?? '')) {
      throw new HttpError(403, 'A ingestão simulada exige um banco de simulação.');
    }
    if (!ingestToken || !matchesSecret(req.get('x-ingest-token'), ingestToken)) {
      throw new HttpError(401, 'Credencial de ingestão inválida.');
    }

    const input = parsed.data;
    const receivedAt = nowIso();
    const measuredAt = input.measuredAt ? new Date(input.measuredAt).toISOString() : receivedAt;
    if (Date.parse(measuredAt) > Date.parse(receivedAt) + 300000) throw new HttpError(400, 'Horário da medição está no futuro.');
    const updated = await transaction((connection) => recordReading(connection, {
      ...input, measuredAt, receivedAt, deviceId: input.deviceId ?? (dataMode === 'simulation' ? 'simulator' : null),
    }));
    res.status(201).json({ accepted: true, tank: serializeTank(updated), receivedAt });
  });

  app.use('/api/v1', requireUser);
  app.use('/api/v1/admin/simulator', requireAdmin, simulatorRoutes());
  app.use('/api/v1/admin', adminRoutes());

  app.get('/api/v1/dashboard', async (_req, res) => {
    const result = await transaction(async (connection) => {
      const source = await rows(tanksSql, [], connection);
      const tanks = source.map(serializeTank);
      const alerts = (await rows(alertsSql + ' WHERE a.is_active ORDER BY a.created_at DESC', [], connection)).map(serializeAlert);
      const forecasts = [];
      const seriesByTime = new Map();
      for (const tank of source) {
        const history = await rows(readingsSql, [tank.id, 24], connection);
        forecasts.push(forecast(tank, history.slice(0, 20)));
        for (const reading of history.reverse()) {
          const point = seriesByTime.get(reading.measured_at) ?? { time: reading.measured_at };
          point[tank.id] = reading.level_percent;
          seriesByTime.set(reading.measured_at, point);
        }
      }
      const measured = tanks.filter((tank) => tank.levelPercent !== null);
      return {
        generatedAt: nowIso(), dataMode, tanks, alerts, forecasts,
        history: [...seriesByTime.values()].sort((a, b) => a.time.localeCompare(b.time)),
        summary: {
          tankCount: tanks.length, activeAlerts: alerts.length,
          criticalAlerts: alerts.filter((alert) => alert.severity === 'critical').length,
          averageLevel: measured.length ? Number((measured.reduce((sum, tank) => sum + tank.levelPercent, 0) / measured.length).toFixed(1)) : null,
        },
      };
    }, { snapshot: true });
    res.json(result);
  });

  app.get('/api/v1/tanks', async (_req, res) => res.json({ data: (await rows(tanksSql)).map(serializeTank) }));
  const thresholds = z.object({
    attention_threshold: z.number().min(0).max(100).optional(),
    critical_threshold: z.number().min(0).max(100).optional(),
  }).refine((value) => value.attention_threshold !== undefined || value.critical_threshold !== undefined);

  async function changeThresholds(req, updates) {
    return transaction(async (connection) => {
      await lockAdmin(req, connection);
      const result = [];
      for (const { id, values } of updates.sort((a, b) => a.id.localeCompare(b.id))) {
        const tank = await one(tankForUpdate, [id], connection);
        if (!tank) throw new HttpError(404, 'Compartimento não encontrado.');
        const attention = values.attention_threshold ?? tank.attention_threshold;
        const critical = values.critical_threshold ?? tank.critical_threshold;
        if (tank.kind === 'clean' ? critical >= attention : critical <= attention) {
          throw new HttpError(400, 'O limite crítico deve ficar além do limite de atenção.');
        }
        const updated = await one('UPDATE tanks SET attention_threshold = $1, critical_threshold = $2 WHERE id = $3 RETURNING *',
          [attention, critical, tank.id], connection);
        if (updated.level_percent !== null) await refreshAlert(connection, updated, nowIso());
        await audit(connection, 'tank.thresholds_changed', req.user.id, null, { tankId: id, attention, critical });
        result.push(serializeTank(updated));
      }
      return result;
    });
  }
  app.patch('/api/v1/tanks', requireAdmin, async (req, res) => {
    const schema = z.object({ 'oil-clean-01': thresholds, 'oil-used-01': thresholds });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Informe os limites dos dois compartimentos.');
    const updates = Object.entries(parsed.data).map(([id, values]) => ({ id, values }));
    res.json({ data: await changeThresholds(req, updates) });
  });
  app.patch('/api/v1/tanks/:id', requireAdmin, async (req, res) => {
    const parsed = thresholds.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Informe limites entre 0 e 100.');
    const [tank] = await changeThresholds(req, [{ id: req.params.id, values: parsed.data }]);
    res.json({ data: tank });
  });

  app.get('/api/v1/alerts', async (req, res) => {
    const result = await rows(alertsSql + ' ORDER BY a.created_at DESC, a.id DESC LIMIT $1', [parseLimit(req.query.limit, 30, 200)]);
    res.json({ data: result.map(serializeAlert) });
  });
  app.get('/api/v1/readings', async (req, res) => {
    const limit = parseLimit(req.query.limit, 100, 1000);
    const filters = z.object({
      tankId: z.string().max(80).optional(),
      start: z.iso.datetime({ offset: true }).optional(),
      end: z.iso.datetime({ offset: true }).optional(),
    }).safeParse(req.query);
    if (!filters.success) throw new HttpError(400, 'Filtros de leitura inválidos.');
    const { tankId, start, end } = filters.data;
    if (start && end && Date.parse(start) > Date.parse(end)) {
      throw new HttpError(400, 'A data inicial deve anteceder a data final.');
    }
    const result = await rows(`SELECT * FROM readings
      WHERE ($1::text IS NULL OR tank_id = $1)
        AND ($2::timestamptz IS NULL OR measured_at >= $2)
        AND ($3::timestamptz IS NULL OR measured_at <= $3)
      ORDER BY measured_at DESC, id DESC LIMIT $4`, [tankId, start, end, limit]);
    res.json({ data: result.map((reading) => ({
      id: reading.id, tankId: reading.tank_id, levelPercent: reading.level_percent, measuredAt: reading.measured_at,
      receivedAt: reading.received_at, deviceId: reading.device_id,
    })) });
  });
  app.get('/api/v1/forecasts', async (_req, res) => {
    const data = await transaction(async (connection) => {
      const tanks = await rows(tanksSql, [], connection);
      return Promise.all(tanks.map(async (tank) => forecast(tank, await rows(readingsSql, [tank.id, 20], connection))));
    }, { snapshot: true });
    res.json({ data });
  });

  const validDate = z.iso.date();
  app.get('/api/v1/reports/days', async (_req, res) => res.json({ data: await getDaysWithData() }));
  app.get('/api/v1/reports/daily', async (req, res) => {
    const date = validDate.safeParse(req.query.date ?? nowIso().slice(0, 10));
    if (!date.success || date.data.startsWith('0000')) throw new HttpError(400, 'Data inválida. Use YYYY-MM-DD.');
    res.json(await getDailyReport(date.data));
  });
  app.get('/api/v1/reports/period', async (req, res) => {
    const range = z.object({ start: validDate, end: validDate }).safeParse(req.query);
    if (!range.success || range.data.start.startsWith('0000') || range.data.start > range.data.end) {
      throw new HttpError(400, 'Informe um intervalo válido no formato YYYY-MM-DD.');
    }
    res.json(await getPeriodReport(range.data.start, range.data.end));
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

  if (process.env.SERVE_WEB === 'true') {
    app.use(express.static(fileURLToPath(new URL('../../client/dist', import.meta.url))));
  }
  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Requisição grande demais.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    const unavailable = /^(08|53|57P0|ECONN|ENOTFOUND|ETIMEDOUT)/.test(error.code ?? '') ||
      /connection|timeout|terminated/i.test(error.message ?? '');
    console.error('Falha na API.', error.code ?? error.name);
    return res.status(unavailable ? 503 : 500).json({
      error: unavailable ? 'Banco de dados temporariamente indisponível.' : 'Erro interno no servidor.',
    });
  });
  return app;
}
