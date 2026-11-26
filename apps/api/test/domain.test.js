import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateForecast, getTankStatus } from '../src/domain.js';

test('óleo limpo: classifica atenção e crítico quando o nível diminui', () => {
  const tank = { kind: 'clean', level_percent: 25, attention_threshold: 30, critical_threshold: 15 };
  assert.equal(getTankStatus(tank), 'attention');
  assert.equal(getTankStatus({ ...tank, level_percent: 10 }), 'critical');
  assert.equal(getTankStatus({ ...tank, level_percent: 70 }), 'normal');
});

test('óleo usado: classifica atenção e crítico quando o nível aumenta', () => {
  const tank = { kind: 'used', level_percent: 75, attention_threshold: 70, critical_threshold: 85 };
  assert.equal(getTankStatus(tank), 'attention');
  assert.equal(getTankStatus({ ...tank, level_percent: 90 }), 'critical');
  assert.equal(getTankStatus({ ...tank, level_percent: 40 }), 'normal');
});

test('previsão só fica disponível após histórico suficiente e tendência em direção ao limite', () => {
  const tank = { kind: 'clean', level_percent: 54, critical_threshold: 15 };
  const now = Date.now();
  const readings = [60, 58, 56, 54].map((level, index) => ({
    level_percent: level,
    measured_at: new Date(now - (3 - index) * 10 * 60 * 1000).toISOString(),
  }));
  const forecast = calculateForecast(tank, readings);
  assert.equal(forecast.available, true);
  assert.ok(forecast.hoursRemaining > 0);
  assert.equal(calculateForecast(tank, readings.slice(0, 2)).available, false);
});
