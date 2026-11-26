import { useState } from 'react';
import { CircleCheck, Bell } from 'lucide-react';
import type { DashboardData } from '../../types/oilguard';
import { AlertItem } from '../ui/AlertItem';

interface AlertsProps {
  data: DashboardData;
}

export function Alerts({ data }: AlertsProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'attention'>('all');

  // Buscar alertas resolvidos do backend
  // Por enquanto, usar apenas os ativos do dashboard
  const activeAlerts = data.alerts;

  const filteredAlerts = activeAlerts.filter((alert) => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    return true;
  });

  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;
  const attentionCount = activeAlerts.filter((a) => a.severity === 'attention').length;

  type FilterSeverity = 'all' | 'critical' | 'attention';

  return (
    <div className="page-content alerts-page">
      <section className="page-header">
        <div>
          <span className="eyebrow">CENTRAL DE NOTIFICAÇÕES</span>
          <h1>Alertas</h1>
          <p>Identificação de níveis de atenção e críticos.</p>
        </div>
      </section>

      {/* Filtros */}
      <div className="alert-filters">
        {([
          { value: 'all', label: 'Todos', count: activeAlerts.length },
          { value: 'critical', label: 'Críticos', count: criticalCount },
          { value: 'attention', label: 'Atenção', count: attentionCount },
        ] as Array<{ value: FilterSeverity; label: string; count: number }>).map((filter) => (
          <button
            key={filter.value}
            onClick={() => setFilterSeverity(filter.value)}
            className={`alert-filter-btn ${filter.value} ${filterSeverity === filter.value ? 'active' : ''}`}
          >
            <span>{filter.label}</span>
            <span className="badge">{filter.count}</span>
          </button>
        ))}
      </div>

      {/* Alertas Ativos */}
      <article className="panel-card">
        <div className="panel-header">
          <div>
            <h2>Alertas ativos</h2>
            <p>{activeAlerts.length} ocorrência(s) ativa(s)</p>
          </div>
        </div>
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => <AlertItem key={alert.id} alert={alert} />)
        ) : (
          <div className="empty-state">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)' }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <strong>
              {filterSeverity === 'all' ? 'Tudo dentro dos limites' : `Nenhum alerta ${filterSeverity === 'critical' ? 'crítico' : 'de atenção'} ativo`}
            </strong>
            <span style={{ maxWidth: 280 }}>
              {filterSeverity === 'all'
                ? 'Quando uma leitura ultrapassar os limites configurados, o alerta aparecerá aqui.'
                : `Não há alertas ${filterSeverity === 'critical' ? 'críticos' : 'de atenção'} no momento.`}
            </span>
          </div>
        )}
      </article>

      {/* Alertas Resolvidos (Histórico) */}
      <article className="panel-card">
        <div className="panel-header">
          <div className="alerts-history-controls">
            <h2>Histórico de alertas</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
              />
              Mostrar resolvidos
            </label>
          </div>
        </div>
        {showResolved ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '10px', textAlign: 'center', padding: 20 }}>
            <Bell size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p>Buscando histórico de alertas resolvidos...</p>
            <p style={{ marginTop: 4, color: 'var(--text-dimmed)' }}>Esta funcionalidade requer endpoint dedicado no backend.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, color: 'var(--text-dimmed)', fontSize: '10px' }}>
            <CircleCheck size={16} />
            <span>Ative "Mostrar resolvidos" para ver o histórico de alertas encerrados.</span>
          </div>
        )}
      </article>
    </div>
  );
}
