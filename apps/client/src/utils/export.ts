import type { DailyReport, PeriodReport } from '../services/api';
import type { HistoryReading } from '../hooks/useHistory';
import { formatPercent, formatDateTime } from './formatters';

function downloadCSV(rows: string[][], filename: string, simulation: boolean) {
  const csv = rows.map((row) => row.map((value) => {
    const text = /^[=+@\t\r\n]|^-(?!\d)/.test(value.trimStart()) ? "'" + value : value;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `oilguard-${simulation ? 'simulacao-' : ''}${filename}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function flattenObject(obj: any, prefix = ''): string[][] {
  const rows: string[][] = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      rows.push(...flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => rows.push(...flattenObject(v, `${newKey}[${i}]`)));
    } else {
      rows.push([newKey, String(value)]);
    }
  }
  return rows;
}

export function exportDailyCSV(report: DailyReport, simulation: boolean) {
  const rows = [['Campo', 'Valor'], ['Ambiente', simulation ? 'Simulação' : 'Operacional']];
  rows.push(...flattenObject(report));
  downloadCSV(rows, `relatorio-diario-${report.date}`, simulation);
}

export function exportPeriodCSV(report: PeriodReport, simulation: boolean) {
  const rows = [['Campo', 'Valor'], ['Ambiente', simulation ? 'Simulação' : 'Operacional']];
  rows.push(...flattenObject(report));
  downloadCSV(rows, `relatorio-periodo-${report.period.start}-${report.period.end}`, simulation);
}

export function exportReadingsCSV(
  readings: HistoryReading[],
  label: string,
  simulation: boolean,
) {
  const environment = simulation ? 'Simulação' : 'Operacional';
  const rows = [
    ['ID', 'Tanque', 'Nível (%)', 'Medição', 'Recebimento', 'Dispositivo', 'Ambiente'],
    ...readings.map(r => [
      String(r.id),
      r.tankId === 'oil-clean-01' ? 'Óleo limpo' : 'Óleo usado',
      formatPercent(r.levelPercent),
      formatDateTime(r.measuredAt),
      formatDateTime(r.receivedAt),
      r.deviceId || '—',
      environment,
    ]),
  ];
  downloadCSV(rows, `historico-${label}`, simulation);
}
