import { useState, useCallback, useEffect } from 'react';
import {
  Calendar,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { useDailyReport, usePeriodReport, useDaysWithData } from '../../hooks/useReports';
import { HistoryChart } from '../ui/HistoryChart';
import { HistoryTable } from '../ui/HistoryTable';
import { CalendarPicker } from '../ui/CalendarPicker';
import { api } from '../../services/api';
import type { DashboardData } from '../../types/oilguard';
import type { HistoryReading } from '../../hooks/useHistory';
import { formatDate, formatDuration, formatPercent, formatRatePerHour } from '../../utils/formatters';
import { exportDailyCSV, exportPeriodCSV, exportReadingsCSV } from '../../utils/export';

type TankId = 'oil-clean-01' | 'oil-used-01';

interface HistoryAndReportsProps {
  data: DashboardData;
}

type ViewMode = 'daily' | 'period';
type DatePickerMode = 'daily' | 'periodStart' | 'periodEnd' | null;

const formatCalendarDate = (date: string) => date.split('-').reverse().join('/');

function DataQualityBadge({ quality }: { quality: string }) {
  const config = {
    good: { label: 'Boa', color: 'var(--success)', bg: 'var(--success-soft)' },
    partial: { label: 'Parcial', color: 'var(--warning)', bg: 'var(--warning-soft)' },
    low: { label: 'Baixa', color: 'var(--danger)', bg: 'var(--danger-soft)' },
    unconfigured: { label: 'Frequ?ncia a confirmar', color: 'var(--text-dimmed)', bg: 'rgba(118,112,131,.15)' },
    no_data: { label: 'Sem dados', color: 'var(--text-dimmed)', bg: 'rgba(118,112,131,.15)' },
    available: { label: 'Disponível', color: 'var(--success)', bg: 'var(--success-soft)' },
  };
  const c = config[quality as keyof typeof config] || config.no_data;
  return (
    <span className={`badge ${quality}`} style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function TankReportCard({ tank, showDetails = false }: { tank: any; showDetails?: boolean }) {
  if (!tank?.hasData) {
    return (
      <article className="report-card report-card-empty">
        <div className="report-card-empty-icon">
          <FileText size={22} />
        </div>
        <strong className="report-card-empty-title">{tank?.tankName || 'Tanque'}</strong>
        <span className="report-card-empty-text">Nenhuma leitura neste período</span>
        <div className="report-card-empty-badge">
          <DataQualityBadge quality={tank?.dataQuality || 'no_data'} />
        </div>
      </article>
    );
  }

  const variation = tank.variation ?? 0;
  const isClean = tank.kind === 'clean';

  return (
    <article className="report-card">
      <div className="report-card-header">
        <div className={`report-card-icon ${isClean ? 'clean' : 'used'}`} />
        <div>
          <h4>{tank.tankName}</h4>
          <p>{tank.readingCount} leituras</p>
        </div>
        <DataQualityBadge quality={tank.dataQuality} />
      </div>

      <div className="report-metrics">
        <div className="report-metric">
          <p className="report-metric-label">Inicial</p>
          <strong className="report-metric-value" style={{ color: 'var(--text-secondary)' }}>{formatPercent(tank.initialLevel)}</strong>
        </div>
        <div className="report-metric">
          <p className="report-metric-label">Final</p>
          <strong className="report-metric-value" style={{ color: 'var(--text-secondary)' }}>{formatPercent(tank.finalLevel)}</strong>
        </div>
        <div className="report-metric">
          <p className="report-metric-label">Variação</p>
          <strong className={`report-metric-value ${variation < 0 ? 'normal' : variation > 0 ? 'critical' : 'attention'}`}>{variation >= 0 ? '+' : ''}{formatPercent(variation)}</strong>
        </div>
      </div>

      {showDetails && (tank.estimatedConsumption || tank.estimatedAccumulation) && (
        <div className="report-estimate">
          <div className="report-estimate-header">
            <BarChart2 size={13} style={{ color: 'var(--accent)' }} />
            <strong className="report-estimate-title">Estimativa baseada na tendência do período</strong>
          </div>
          <div className="report-estimate-values">
            {tank.estimatedConsumption && (
              <div className="report-estimate-item">
                <TrendingDown size={12} style={{ color: 'var(--success)' }} />
                <span>
                  Consumo: <strong style={{ color: 'var(--success)' }}>{formatRatePerHour(tank.estimatedConsumption / 24)}</strong>
                </span>
              </div>
            )}
            {tank.estimatedAccumulation && (
              <div className="report-estimate-item">
                <TrendingUp size={12} style={{ color: 'var(--danger)' }} />
                <span>
                  Acúmulo: <strong style={{ color: 'var(--danger)' }}>{formatRatePerHour(tank.estimatedAccumulation / 24)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {showDetails && tank.alerts?.length > 0 && (
        <div className="report-alerts">
          <p className="report-alerts-title">Alertas do período</p>
          <div className="report-alerts-list">
            {tank.alerts.map((alert: any) => (
              <div key={alert.id} className={`report-alert-item ${alert.severity}`}>
                <div className="report-alert-info">
                  <span className={`report-alert-dot ${alert.severity}`} />
                  <span className="report-alert-title">{alert.title}</span>
                </div>
                <div className="report-alert-meta">
                  <span>{formatDate(alert.createdAt)}</span>
                  {alert.resolvedAt && <span>{formatDuration((new Date(alert.resolvedAt).getTime() - new Date(alert.createdAt).getTime()) / 60000)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDetails && (tank.attentionDurationMinutes || tank.criticalDurationMinutes) && (
        <div className="report-durations">
          {tank.attentionDurationMinutes && (
            <div className="report-duration-item attention">
              <AlertTriangle size={11} style={{ color: 'var(--warning)' }} />
              <span>Atenção: <strong style={{ color: 'var(--warning)' }}>{formatDuration(tank.attentionDurationMinutes)}</strong></span>
            </div>
          )}
          {tank.criticalDurationMinutes && (
            <div className="report-duration-item critical">
              <AlertTriangle size={11} style={{ color: 'var(--danger)' }} />
              <span>Crítico: <strong style={{ color: 'var(--danger)' }}>{formatDuration(tank.criticalDurationMinutes)}</strong></span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function HistoryAndReports({ data }: HistoryAndReportsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [periodStart, setPeriodStart] = useState<Date | null>(null);
  const [periodEnd, setPeriodEnd] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<DatePickerMode>(null);
  const [showChart, setShowChart] = useState(false);
  const [selectedTank, setSelectedTank] = useState<TankId | 'all'>('all');
  const [limit, setLimit] = useState(100);

  const { days: availableDays, loading: daysLoading } = useDaysWithData();

  const currentDate = new Date().toISOString().slice(0, 10);
  const toCalendarDate = (value: Date) => [value.getFullYear(), value.getMonth() + 1, value.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-');
  const dailyReportDate = selectedDate ? toCalendarDate(selectedDate) : availableDays[0] || currentDate;
  const periodStartStr = periodStart ? toCalendarDate(periodStart) : '';
  const periodEndStr = periodEnd ? toCalendarDate(periodEnd) : '';
  const { report: dailyReport, error: dailyError } = useDailyReport(dailyReportDate);
  const { report: periodReport, error: periodError } = usePeriodReport(periodStartStr, periodEndStr);
  const effectiveStart = viewMode === 'daily' ? dailyReportDate : periodStartStr || dailyReportDate;
  const effectiveEnd = viewMode === 'daily' ? dailyReportDate : periodEndStr || currentDate;
  const [readings, setReadings] = useState<HistoryReading[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(true);
  const [readingsError, setReadingsError] = useState('');
  const simulation = data.dataMode === 'simulation';

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      start: effectiveStart + 'T00:00:00.000Z',
      end: effectiveEnd + 'T23:59:59.999Z',
      limit: String(limit),
    });
    if (selectedTank !== 'all') query.set('tankId', selectedTank);
    setReadingsLoading(true);
    setReadingsError('');
    void api.getReadings(query, controller.signal).then((result) => {
      if (!controller.signal.aborted) setReadings(result.data);
    }).catch((error: Error) => {
      if (!controller.signal.aborted) {
        setReadings([]);
        setReadingsError(error.message);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setReadingsLoading(false);
    });
    return () => controller.abort();
  }, [effectiveStart, effectiveEnd, selectedTank, limit]);

  const handleExportCSV = useCallback(() => {
    if (viewMode === 'daily' && dailyReport) {
      exportDailyCSV(dailyReport, simulation);
    } else if (viewMode === 'period' && periodReport) {
      exportPeriodCSV(periodReport, simulation);
    } else if (readings.length > 0) {
      exportReadingsCSV(readings, effectiveStart + '-' + effectiveEnd, simulation);
    }
  }, [viewMode, dailyReport, periodReport, readings, effectiveStart, effectiveEnd, simulation]);

  return (
    <div className="history-reports-page">
      <section className="page-header">
        <div>
          <span className="eyebrow">HISTÓRICO E RELATÓRIOS</span>
          <h1>Histórico e Relatórios</h1>
          <p>Consulte medições, visualize evolução dos níveis, alertas e exporte relatórios.</p>
        </div>
        <div className="page-header-actions">
          <button
            onClick={handleExportCSV}
            disabled={
              (viewMode === 'daily' && !dailyReport && readings.length === 0) ||
              (viewMode === 'period' && !periodReport && readings.length === 0)
            }
            className="btn btn-primary"
          >
            <Download size={13} /> Exportar CSV
          </button>
          <button
            onClick={() => setShowChart(!showChart)}
            className={`btn ${showChart ? 'btn-primary' : 'btn-secondary'}`}
          >
            {showChart ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{showChart ? 'Ocultar gráfico' : 'Mostrar gráfico'}</span>
          </button>
        </div>

        {/* View Mode Tabs */}
        <div className="reports-tabs">
          <button
            onClick={() => setViewMode('daily')}
            className={`reports-tab ${viewMode === 'daily' ? 'active' : ''}`}
          >
            <Calendar size={14} /> Consulta Diária
          </button>
          <button
            onClick={() => setViewMode('period')}
            className={`reports-tab ${viewMode === 'period' ? 'active' : ''}`}
          >
            <BarChart2 size={14} /> Consulta por Período
          </button>
        </div>
      </section>

      {/* Date Selection */}
      <article className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Seleção de Período</h2>
            <p>Escolha o modo de consulta e as datas desejadas</p>
          </div>
        </div>

        <div className="date-picker-group">
          {viewMode === 'daily' ? (
            <>
              <button
                onClick={() => setShowDatePicker('daily')}
                disabled={daysLoading}
                className="btn btn-secondary date-btn"
              >
                <div className="date-btn-content">
                  <Calendar size={15} style={{ color: selectedDate ? 'var(--success)' : 'var(--accent)' }} />
                  <span>
                    {formatCalendarDate(dailyReportDate)}
                    {!selectedDate && <span className="date-btn-default">(padrão)</span>}
                  </span>
                </div>
                <ChevronDown size={12} className="date-btn-chevron" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowDatePicker('periodStart')}
                disabled={daysLoading}
                className="btn btn-secondary date-btn"
              >
                <div className="date-btn-content">
                  <Calendar size={15} style={{ color: periodStart ? 'var(--success)' : 'var(--accent)' }} />
                  <span>
                    Início: {periodStart ? formatCalendarDate(periodStartStr) : 'Selecione'}
                  </span>
                </div>
                <ChevronDown size={12} className="date-btn-chevron" />
              </button>

              <span className="date-separator">até</span>

              <button
                onClick={() => setShowDatePicker('periodEnd')}
                disabled={daysLoading}
                className="btn btn-secondary date-btn"
              >
                <div className="date-btn-content">
                  <Calendar size={15} style={{ color: periodEnd ? 'var(--success)' : 'var(--accent)' }} />
                  <span>
                    Fim: {periodEnd ? formatCalendarDate(periodEndStr) : 'Selecione'}
                  </span>
                </div>
                <ChevronDown size={12} className="date-btn-chevron" />
              </button>
            </>
          )}

          {(viewMode === 'daily' && selectedDate) || (viewMode === 'period' && (periodStart || periodEnd)) ? (
            <button
              onClick={() => {
                if (viewMode === 'daily') setSelectedDate(null);
                else { setPeriodStart(null); setPeriodEnd(null); }
              }}
              className="btn btn-ghost"
            >
              Limpar
            </button>
          ) : null}

          {/* Tank Filter */}
          <div className="date-picker-tank-filter">
            <span className="date-picker-tank-label">Tanque:</span>
            <select
              value={selectedTank}
              onChange={(e) => setSelectedTank(e.target.value as TankId | 'all')}
              className="form-select"
            >
              <option value="all">Todos os tanques</option>
              <option value="oil-clean-01">Óleo limpo</option>
              <option value="oil-used-01">Óleo usado</option>
            </select>
          </div>
        </div>
      </article>

      {/* Calendar Picker Modal */}
      {showDatePicker && (
        <CalendarPicker
          selectedDate={
            showDatePicker === 'daily' ? selectedDate :
            showDatePicker === 'periodStart' ? periodStart : periodEnd
          }
          onSelect={(date) => {
            if (showDatePicker === 'daily') {
              setSelectedDate(date);
            } else if (showDatePicker === 'periodStart') {
              const start = new Date(date);
              start.setHours(0, 0, 0, 0);
              setPeriodStart(start);
              if (periodEnd && periodEnd < start) {
                const end = new Date(start);
                end.setHours(23, 59, 59, 999);
                setPeriodEnd(end);
              }
            } else if (showDatePicker === 'periodEnd') {
              const end = new Date(date);
              end.setHours(23, 59, 59, 999);
              setPeriodEnd(end);
            }
          }}
          availableDates={availableDays}
          isOpen
          onClose={() => setShowDatePicker(null)}
        />
      )}

      {/* Summary Cards */}
      {viewMode === 'daily' && dailyReport && (
        <div className="report-grid">
          <article className="report-card">
            <div className="report-card-header">
              <div className="report-card-icon danger" />
              <div>
                <h4>Total de Alertas</h4>
                <p>{dailyReport.summary.totalAlerts} {dailyReport.summary.totalAlerts === 1 ? 'alerta' : 'alertas'}</p>
              </div>
            </div>
            <div className="report-metrics">
              <div className="report-metric">
                <div className="report-metric-label">Críticos</div>
                <strong className="report-metric-value critical">{dailyReport.summary.criticalAlerts}</strong>
              </div>
              <div className="report-metric">
                <div className="report-metric-label">Atenção</div>
                <strong className="report-metric-value attention">{dailyReport.summary.attentionAlerts}</strong>
              </div>
            </div>
          </article>

          <article className="report-card">
            <div className="report-card-header">
              <div className="report-card-icon accent" />
              <div>
                <h4>Tempo Crítico</h4>
                <p>{formatDuration(dailyReport.summary.totalCriticalMinutes)}</p>
              </div>
            </div>
          </article>
        </div>
      )}

      {viewMode === 'period' && periodReport && periodStart && periodEnd && (
        <div className="report-grid">
          <article className="report-card">
            <div className="report-card-header">
              <div className="report-card-icon success" />
              <div>
                <h4>Dias com Dados</h4>
                <p>{periodReport.summary.daysWithData}</p>
              </div>
            </div>
          </article>

          <article className="report-card">
            <div className="report-card-header">
              <div className="report-card-icon danger" />
              <div>
                <h4>Total de Alertas</h4>
                <p>{periodReport.summary.totalAlerts} alertas</p>
              </div>
            </div>
            <div className="report-metrics">
              <div className="report-metric">
                <div className="report-metric-label">Críticos</div>
                <strong className="report-metric-value critical">{periodReport.summary.criticalAlerts}</strong>
              </div>
              <div className="report-metric">
                <div className="report-metric-label">Atenção</div>
                <strong className="report-metric-value attention">{periodReport.summary.attentionAlerts}</strong>
              </div>
            </div>
          </article>
        </div>
      )}

      {/* Error messages */}
      {(viewMode === 'daily' && dailyError) && (
        <div className="connection-warning">{dailyError}</div>
      )}

      {(viewMode === 'period' && periodError) && (
        <div className="connection-warning">{periodError}</div>
      )}

      {/* Chart */}
      {showChart && (
        <article className="panel-card chart-page-panel">
          <div className="panel-header">
            <div>
              <h2>Evolução dos níveis</h2>
              <p>
                Histórico visual das medições de {formatCalendarDate(effectiveStart)} a {formatCalendarDate(effectiveEnd)}
              </p>
            </div>
          </div>
          <div className="chart-wrap">
            <HistoryChart data={data.history} height={320} />
          </div>
        </article>
      )}

      {/* Tank Report Cards */}
      <article className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Informações dos Compartimentos</h2>
            <p>
              {viewMode === 'daily'
                ? `Dados de ${formatCalendarDate(effectiveStart)}`
                : `Período de ${formatCalendarDate(effectiveStart)} a ${formatCalendarDate(effectiveEnd)}`}
            </p>
          </div>
        </div>
        <div className="report-grid">
          {viewMode === 'daily' ? (
            <>
              <TankReportCard tank={dailyReport?.oilClean} showDetails />
              <TankReportCard tank={dailyReport?.oilUsed} showDetails />
            </>
          ) : (
            <>
              <TankReportCard tank={periodReport?.oilClean} showDetails />
              <TankReportCard tank={periodReport?.oilUsed} showDetails />
            </>
          )}
        </div>

        {viewMode === 'daily' && dailyReport && !dailyReport.hasData && (
          <div className="empty-state-panel">
            <FileText size={32} />
            <strong>Nenhum dado para esta data</strong>
            <p>Selecione um dia que possua leituras registradas.</p>
          </div>
        )}

        {viewMode === 'period' && periodReport && !periodReport.oilClean?.hasData && !periodReport.oilUsed?.hasData && (
          <div className="empty-state-panel">
            <FileText size={32} />
            <strong>Nenhum dado no período selecionado</strong>
            <p>Ajuste as datas para um intervalo com leituras registradas.</p>
          </div>
        )}
      </article>

      {/* Alerts History */}
      {(viewMode === 'daily' && dailyReport) || (viewMode === 'period' && periodReport) ? (
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Histórico de Alertas e Ocorrências</h2>
              <p>Alertas registrados no período selecionado</p>
            </div>
          </div>
          <div className="report-alerts-history">
            {(() => {
              const alerts = viewMode === 'daily'
                ? [...(dailyReport?.oilClean?.alerts || []), ...(dailyReport?.oilUsed?.alerts || [])]
                : [];

              if (viewMode === 'period') {
                return (
                  <p className="report-alerts-history-note">
                    Alertas do período são exibidos nas seções dos compartimentos acima.
                  </p>
                );
              }

              if (!alerts.length) {
                return <p className="report-alerts-history-none">Nenhum alerta neste dia.</p>;
              }

              return alerts.map((alert: any) => (
                <div key={alert.id} className={`report-alert-item ${alert.severity}`}>
                  <div className="report-alert-info">
                    <span className={`report-alert-dot ${alert.severity}`} />
                    <div>
                      <strong className="report-alert-title">{alert.title}</strong>
                      <div className="report-alert-message">{alert.message}</div>
                    </div>
                  </div>
                  <div className="report-alert-meta">
                    <span>{formatDate(alert.createdAt)}</span>
                    {alert.resolvedAt && <span>{formatDuration((new Date(alert.resolvedAt).getTime() - new Date(alert.createdAt).getTime()) / 60000)}</span>}
                  </div>
                </div>
              ));
            })()}
          </div>
        </article>
      ) : null}

      {/* Readings Table */}
      <article className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Tabela de Leituras Registradas</h2>
            <p>
              {readings.length} registro(s) de {formatCalendarDate(effectiveStart)} a {formatCalendarDate(effectiveEnd)}
              {selectedTank !== 'all' && ` • ${selectedTank === 'oil-clean-01' ? 'Óleo limpo' : 'Óleo usado'}`}
              {readingsLoading && <span className="loading-indicator">Carregando...</span>}
            </p>
          </div>
          <div className="panel-header-actions">
            <label className="show-more-label">
              <input
                type="checkbox"
                checked={limit >= 500}
                onChange={(e) => setLimit(e.target.checked ? 1000 : 100)}
              />
              <span>Mostrar mais (até 1000)</span>
            </label>
          </div>
        </div>
        {readingsError && <p role="alert">{readingsError}</p>}
        <HistoryTable
          readings={readings}
          simulation={simulation}
          loading={readingsLoading}
          tankIds={selectedTank === 'all' ? ['oil-clean-01', 'oil-used-01'] : [selectedTank]}
        />
      </article>
    </div>
  );
}
