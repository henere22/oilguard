import { db, one, rows, transaction } from './database.js';

const getTank = (id, connection) => one('SELECT * FROM tanks WHERE id = $1', [id], connection);
const getReadings = (id, start, end, connection) => rows(
  'SELECT * FROM readings WHERE tank_id = $1 AND measured_at BETWEEN $2 AND $3 ORDER BY measured_at, id',
  [id, start, end], connection,
);
const getAlerts = (start, end, connection) => rows(
  'SELECT * FROM alerts WHERE created_at BETWEEN $1 AND $2 ORDER BY created_at DESC, id DESC',
  [start, end], connection,
);

function dataQuality(readingCount, durationSeconds) {
  if (!readingCount) return 'no_data';
  const interval = Number(process.env.EXPECTED_READING_INTERVAL_SECONDS);
  if (!Number.isFinite(interval) || interval <= 0) return 'unconfigured';
  const expected = Math.ceil(durationSeconds / interval);
  if (readingCount >= expected * 0.8) return 'good';
  if (readingCount >= expected * 0.5) return 'partial';
  return 'low';
}

/**
 * Calcula o relatório diário para um compartimento
 */
async function calculateDailyReport(tankId, dateStr, allAlerts, connection) {
  const tank = await getTank(tankId, connection);
  if (!tank) return null;

  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const readings = await getReadings(tankId, startOfDay, endOfDay, connection);

  if (readings.length === 0) {
    return {
      tankId,
      tankName: tank.name,
      kind: tank.kind,
      date: dateStr,
      hasData: false,
      initialLevel: null,
      finalLevel: null,
      variation: null,
      estimatedConsumption: null,
      estimatedAccumulation: null,
      readings: [],
      alerts: [],
      attentionDurationMinutes: 0,
      criticalDurationMinutes: 0,
      dataQuality: 'no_data',
      readingCount: 0,
    };
  }

  const initialLevel = Number(readings[0].level_percent);
  const finalLevel = Number(readings[readings.length - 1].level_percent);
  const variation = Number((finalLevel - initialLevel).toFixed(1));

  // Estimar consumo/acumulação baseado na tendência
  let estimatedConsumption = null;
  let estimatedAccumulation = null;

  if (readings.length >= 2) {
    const firstTime = Date.parse(readings[0].measured_at);
    const lastTime = Date.parse(readings[readings.length - 1].measured_at);
    const hoursDiff = (lastTime - firstTime) / 3_600_000;

    if (hoursDiff > 0) {
      const ratePerHour = (finalLevel - initialLevel) / hoursDiff;

      if (tank.kind === 'clean' && ratePerHour < 0) {
        estimatedConsumption = Number((Math.abs(ratePerHour) * 24).toFixed(1)); // %/dia
      } else if (tank.kind === 'used' && ratePerHour > 0) {
        estimatedAccumulation = Number((ratePerHour * 24).toFixed(1)); // %/dia
      }
    }
  }

  // Buscar alertas do dia
  const alerts = allAlerts.filter(a => a.tank_id === tankId);

  // Calcular tempo em atenção e crítico
  let attentionDurationMinutes = 0;
  let criticalDurationMinutes = 0;

  for (const alert of alerts) {
    const created = Date.parse(alert.created_at);
    const resolved = alert.resolved_at ? Date.parse(alert.resolved_at) : Date.parse(endOfDay);
    const durationMinutes = Math.max(0, Math.min(resolved, Date.parse(endOfDay), Date.now()) - created) / 60_000;

    if (alert.severity === 'attention') {
      attentionDurationMinutes += durationMinutes;
    } else if (alert.severity === 'critical') {
      criticalDurationMinutes += durationMinutes;
    }
  }

  // Qualidade dos dados
  return {
    tankId,
    tankName: tank.name,
    kind: tank.kind,
    date: dateStr,
    hasData: true,
    initialLevel: Number(initialLevel.toFixed(1)),
    finalLevel: Number(finalLevel.toFixed(1)),
    variation: Number(variation.toFixed(1)),
    estimatedConsumption,
    estimatedAccumulation,
    readings: readings.map(r => ({
      id: r.id,
      levelPercent: Number(r.level_percent),
      measuredAt: r.measured_at,
      receivedAt: r.received_at,
      deviceId: r.device_id,
    })),
    alerts: alerts.map(a => ({
      id: a.id,
      severity: a.severity,
      title: a.title,
      message: a.message,
      createdAt: a.created_at,
      resolvedAt: a.resolved_at,
      active: Boolean(a.is_active),
    })),
    attentionDurationMinutes: Math.round(attentionDurationMinutes),
    criticalDurationMinutes: Math.round(criticalDurationMinutes),
    dataQuality: dataQuality(readings.length, 86400),
    readingCount: readings.length,
  };
}

/**
 * Obtém os dias que possuem dados no banco
 */
async function getDaysWithData() {
  const days = await rows("SELECT DISTINCT (measured_at AT TIME ZONE 'UTC')::date::text AS day FROM readings ORDER BY day DESC");
  return days.map(({ day }) => day);
}

/**
 * Obtém o relatório completo (ambos tanques) para uma data
 */
async function dailyReport(dateStr, connection) {
  const allAlerts = await getAlerts(`${dateStr}T00:00:00.000Z`, `${dateStr}T23:59:59.999Z`, connection);
  const cleanReport = await calculateDailyReport('oil-clean-01', dateStr, allAlerts, connection);
  const usedReport = await calculateDailyReport('oil-used-01', dateStr, allAlerts, connection);

  const totalAlerts = allAlerts.length;
  const criticalAlerts = allAlerts.filter(a => a.severity === 'critical').length;
  const attentionAlerts = allAlerts.filter(a => a.severity === 'attention').length;

  const hasAnyData = (cleanReport?.hasData || usedReport?.hasData);

  return {
    date: dateStr,
    hasData: hasAnyData,
    oilClean: cleanReport,
    oilUsed: usedReport,
    summary: {
      totalAlerts,
      criticalAlerts,
      attentionAlerts,
      totalAttentionMinutes: (cleanReport?.attentionDurationMinutes || 0) + (usedReport?.attentionDurationMinutes || 0),
      totalCriticalMinutes: (cleanReport?.criticalDurationMinutes || 0) + (usedReport?.criticalDurationMinutes || 0),
      dataQuality: hasAnyData ? 'available' : 'no_data',
    },
  };
}

/**
 * Obtém relatório de um período (intervalo de datas)
 */
async function periodReport(startDateStr, endDateStr, connection) {
  const startOfPeriod = `${startDateStr}T00:00:00.000Z`;
  const endOfPeriod = `${endDateStr}T23:59:59.999Z`;

  const cleanTank = await getTank('oil-clean-01', connection);
  const usedTank = await getTank('oil-used-01', connection);
  const cleanReadings = await getReadings('oil-clean-01', startOfPeriod, endOfPeriod, connection);
  const usedReadings = await getReadings('oil-used-01', startOfPeriod, endOfPeriod, connection);
  const allAlerts = await getAlerts(startOfPeriod, endOfPeriod, connection);

  function calcTankReport(tank, readings) {
    if (!tank || readings.length === 0) {
      return {
        tankId: tank?.id,
        tankName: tank?.name,
        kind: tank?.kind,
        hasData: false,
        initialLevel: null,
        finalLevel: null,
        variation: null,
        estimatedConsumption: null,
        estimatedAccumulation: null,
        readingCount: 0,
        dataQuality: 'no_data',
      };
    }

    const initialLevel = Number(readings[0].level_percent);
    const finalLevel = Number(readings[readings.length - 1].level_percent);
    const variation = Number((finalLevel - initialLevel).toFixed(1));

    let estimatedConsumption = null;
    let estimatedAccumulation = null;

    if (readings.length >= 2) {
      const firstTime = Date.parse(readings[0].measured_at);
      const lastTime = Date.parse(readings[readings.length - 1].measured_at);
      const hoursDiff = (lastTime - firstTime) / 3_600_000;

      if (hoursDiff > 0) {
        const ratePerHour = (finalLevel - initialLevel) / hoursDiff;
        if (tank.kind === 'clean' && ratePerHour < 0) {
          estimatedConsumption = Number((Math.abs(ratePerHour) * 24).toFixed(1));
        } else if (tank.kind === 'used' && ratePerHour > 0) {
          estimatedAccumulation = Number((ratePerHour * 24).toFixed(1));
        }
      }
    }

    const durationSeconds = (Date.parse(endOfPeriod) - Date.parse(startOfPeriod) + 1) / 1000;

    return {
      tankId: tank.id,
      tankName: tank.name,
      kind: tank.kind,
      hasData: true,
      initialLevel: Number(initialLevel.toFixed(1)),
      finalLevel: Number(finalLevel.toFixed(1)),
      variation: Number(variation.toFixed(1)),
      estimatedConsumption,
      estimatedAccumulation,
      readingCount: readings.length,
      dataQuality: dataQuality(readings.length, durationSeconds),
    };
  }

  return {
    period: { start: startDateStr, end: endDateStr },
    oilClean: calcTankReport(cleanTank, cleanReadings),
    oilUsed: calcTankReport(usedTank, usedReadings),
    summary: {
      totalAlerts: allAlerts.length,
      criticalAlerts: allAlerts.filter(a => a.severity === 'critical').length,
      attentionAlerts: allAlerts.filter(a => a.severity === 'attention').length,
      daysWithData: [...new Set([
        ...cleanReadings.map(r => r.measured_at.split('T')[0]),
        ...usedReadings.map(r => r.measured_at.split('T')[0]),
      ])].length,
    },
  };
}

async function generateReport(type, start, end, calculate) {
  const { payload, generatedAt } = await transaction(async (connection) => {
    const stamp = await one('SELECT statement_timestamp()::text AS generated_at', [], connection);
    return { payload: await calculate(connection), generatedAt: stamp.generated_at };
  }, { snapshot: true });
  await db.query(`INSERT INTO report_snapshots(report_type, start_date, end_date, generated_at, payload)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (report_type, start_date, end_date) DO UPDATE
    SET generated_at = EXCLUDED.generated_at, payload = EXCLUDED.payload
    WHERE report_snapshots.generated_at <= EXCLUDED.generated_at`, [type, start, end, generatedAt, payload]);
  return payload;
}

export const getDailyReport = (date) => generateReport('daily', date, date, (connection) => dailyReport(date, connection));
export const getPeriodReport = (start, end) => generateReport('period', start, end, (connection) => periodReport(start, end, connection));
export { getDaysWithData };
