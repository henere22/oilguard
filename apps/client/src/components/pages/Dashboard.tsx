import { useEffect } from 'react';
import { Waves, Bell, AlertTriangle, Activity } from 'lucide-react';
import type { DashboardData } from '../../types/oilguard';
import { TankCard } from '../ui/TankCard';
import { HistoryChart } from '../ui/HistoryChart';
import { AlertItem } from '../ui/AlertItem';
import { ForecastCard } from '../ui/ForecastCard';
import { formatTime } from '../../utils/formatters';

interface DashboardProps {
  data: DashboardData;
  onAlertChange?: (alerts: DashboardData['alerts']) => void;
}

export function Dashboard({ data, onAlertChange }: DashboardProps) {
  useEffect(() => {
    onAlertChange?.(data.alerts);
  }, [data.alerts, onAlertChange]);

  return (
    <>
      {/* Cabeçalho */}
      <section className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow">VISÃO OPERACIONAL</span>
          <h1>Monitoramento geral</h1>
          <p>Acompanhe os níveis de óleo e antecipe situações de risco.</p>
        </div>
        <div className="last-update">
          <span className="live-indicator">
            <i />
            Atualizado {formatTime(data.generatedAt)}
          </span>
        </div>
      </section>

      {/* 4 Indicadores Principais */}
      <section style={{ marginBottom: 24 }}>
        <div className="metric-grid">
          <article className="metric-card">
            <div className="metric-icon accent">
              <Waves size={18} />
            </div>
            <span>Compartimentos</span>
            <strong>{data.summary.tankCount}</strong>
            <small>Monitorados</small>
          </article>
          <article className="metric-card">
            <div className="metric-icon used">
              <Bell size={18} />
            </div>
            <span>Alertas ativos</span>
            <strong>{data.summary.activeAlerts}</strong>
            <small>Requerem acompanhamento</small>
          </article>
          <article className="metric-card">
            <div className="metric-icon danger">
              <AlertTriangle size={18} />
            </div>
            <span>Alertas críticos</span>
            <strong>{data.summary.criticalAlerts}</strong>
            <small>Prioridade imediata</small>
          </article>
          <article className="metric-card">
            <div className="metric-icon success">
              <Activity size={18} />
            </div>
            <span>Nível médio</span>
            <strong>{data.summary.averageLevel === null ? '?' : `${data.summary.averageLevel.toFixed(1).replace('.', ',')}%` }</strong>
            <small>Média dos compartimentos</small>
          </article>
        </div>
      </section>

      {/* 2 Cards de Tanque */}
      <section style={{ marginBottom: 24 }}>
        <div className="tank-grid">
          {data.tanks.map((tank) => (
            <TankCard key={tank.id} tank={tank} forecast={data.forecasts.find((f) => f.tankId === tank.id)} />
          ))}
        </div>
      </section>

      {/* Gráfico + Alertas lado a lado */}
      <section className="dashboard-lower" style={{ marginBottom: 24 }}>
        {/* Gráfico de Histórico */}
        <article className="panel-card chart-panel">
          <div className="panel-header">
            <div>
              <h2>Histórico de níveis</h2>
              <p>Evolução das últimas leituras — tempo real</p>
            </div>
            <span className="panel-chip">TEMPO REAL</span>
          </div>
          <div className="chart-wrap" style={{ height: 280 }}>
            <HistoryChart data={data.history} height={280} />
          </div>
        </article>

        {/* Alertas Recentes */}
        <article className="panel-card alerts-panel">
          <div className="panel-header">
            <div>
              <h2>Alertas recentes</h2>
              <p>Ocorrências que exigem atenção</p>
            </div>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
            {data.alerts.length > 0 ? (
              data.alerts.slice(0, 6).map((alert) => <AlertItem key={alert.id} alert={alert} variant="compact" />)
            ) : (
              <div className="empty-state">
                <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <strong>Nenhum alerta ativo</strong>
                <span style={{ maxWidth: 260 }}>Os compartimentos estão dentro dos limites configurados. O monitoramento continua ativo.</span>
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Previsões de Tendência */}
      <section style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div>
            <h2>Previsões de tendência</h2>
            <p>Estimativas calculadas a partir do histórico disponível</p>
          </div>
        </div>
        <div className="forecast-grid">
          {data.forecasts.map((forecast) => (
            <ForecastCard key={forecast.tankId} forecast={forecast} />
          ))}
        </div>
        <p className="disclaimer">
          As estimativas são indicativas e dependem de histórico suficiente e leituras válidas. Não substituem os procedimentos operacionais de segurança.
        </p>
      </section>
    </>
  );
}