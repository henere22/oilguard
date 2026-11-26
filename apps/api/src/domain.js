export function getTankStatus(tank) {
  const level = Number(tank.level_percent);
  if (tank.kind === 'clean') {
    if (level <= Number(tank.critical_threshold)) return 'critical';
    if (level <= Number(tank.attention_threshold)) return 'attention';
    return 'normal';
  }

  if (level >= Number(tank.critical_threshold)) return 'critical';
  if (level >= Number(tank.attention_threshold)) return 'attention';
  return 'normal';
}

export function getStatusLabel(status) {
  return ({ normal: 'Normal', attention: 'Atenção', critical: 'Crítico' })[status] ?? 'Indefinido';
}

export function calculateForecast(tank, readings) {
  const now = Date.now();
  const maxAgeHours = 6; // Only use readings from the last 6 hours
  const relevant = readings
    .filter((reading) => {
      const t = Date.parse(reading.measured_at);
      return Number.isFinite(t) && t <= now && now - t <= maxAgeHours * 3_600_000;
    })
    .slice(0, 20)
    .reverse();

  if (relevant.length < 4) {
    return {
      available: false,
      message: 'Aguardando histórico suficiente para calcular uma tendência.',
      hoursRemaining: null,
      ratePerHour: null,
    };
  }

  const origin = Date.parse(relevant[0].measured_at);
  const points = relevant.map((reading) => ({
    x: (Date.parse(reading.measured_at) - origin) / 3_600_000,
    y: Number(reading.level_percent),
  }));
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const numerator = points.reduce((sum, point) => sum + ((point.x - meanX) * (point.y - meanY)), 0);
  const denominator = points.reduce((sum, point) => sum + ((point.x - meanX) ** 2), 0);

  if (denominator <= 0) {
    return { available: false, message: 'Ainda não há intervalo de tempo suficiente entre as leituras.', hoursRemaining: null, ratePerHour: null };
  }

  const ratePerHour = numerator / denominator;
  const isMovingTowardLimit = tank.kind === 'clean' ? ratePerHour < -0.03 : ratePerHour > 0.03;
  if (!isMovingTowardLimit) {
    return {
      available: false,
      message: 'A tendência recente não indica aproximação do limite.',
      hoursRemaining: null,
      ratePerHour: Number(ratePerHour.toFixed(2)),
    };
  }

  const limit = tank.kind === 'clean' ? Number(tank.critical_threshold) : Number(tank.critical_threshold);
  const distance = tank.kind === 'clean'
    ? Number(tank.level_percent) - limit
    : limit - Number(tank.level_percent);
  const hoursRemaining = distance / Math.abs(ratePerHour);

  if (!Number.isFinite(hoursRemaining) || hoursRemaining < 0) {
    return { available: false, message: 'Não foi possível estimar o tempo restante com segurança.', hoursRemaining: null, ratePerHour: Number(ratePerHour.toFixed(2)) };
  }

  return {
    available: true,
    message: tank.kind === 'clean' ? 'Estimativa até atingir o limite mínimo crítico.' : 'Estimativa até atingir o limite máximo crítico.',
    hoursRemaining: Number(hoursRemaining.toFixed(1)),
    ratePerHour: Number(ratePerHour.toFixed(2)),
  };
}
