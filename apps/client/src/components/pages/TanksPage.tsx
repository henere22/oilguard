import { Droplets, AlertTriangle, CheckCircle, Clock3, TrendingUp } from 'lucide-react';
import type { DashboardData, Tank, TankStatus } from '../../types/oilguard';
import { formatPercent, formatRelativeTime } from '../../utils/formatters';

interface TanksPageProps {
  data: DashboardData;
}

function StatusBadge({ status, label }: { status: TankStatus; label: string }) {
  const config = {
    normal: { color: 'var(--success)', bg: 'var(--success-soft)', icon: CheckCircle },
    attention: { color: 'var(--warning)', bg: 'var(--warning-soft)', icon: AlertTriangle },
    critical: { color: 'var(--danger)', bg: 'var(--danger-soft)', icon: AlertTriangle },
    unknown: { color: 'var(--text-dim)', bg: 'var(--bg)', icon: Clock3 },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={`badge ${status}`} style={{ background: c.bg, color: c.color }}>
      <Icon size={10} />
      {label}
    </span>
  );
}

function TankDetailCard({ tank }: { tank: Tank }) {
  const isClean = tank.kind === 'clean';

  return (
    <article className="tank-detail-card">
      <div className="tank-detail-header">
        <div className="tank-detail-icon clean" />
        <div className="tank-detail-info">
          <h2>{tank.name}</h2>
          <p>{isClean ? 'Compartimento de óleo limpo — nível deve diminuir com o consumo' : 'Compartimento de óleo usado — nível aumenta com o descarte'}</p>
        </div>
        <StatusBadge status={tank.status} label={tank.statusLabel} />
      </div>

      {/* Nível Principal */}
      <div style={{ padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 16, textAlign: 'center' }}>
        <p style={{ margin: '0 0 8px', color: 'var(--text-dim)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Nível Atual</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
          <strong style={{ fontSize: '48px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {formatPercent(tank.levelPercent)}
          </strong>
        </div>
        <p style={{ margin: '8px 0 0', color: 'var(--text-dimmed)', fontSize: '10px' }}>
          Última atualização: {formatRelativeTime(tank.updatedAt)}
        </p>
      </div>

      {/* Barra de progresso visual */}
      <div className="tank-detail-progress" style={{ marginBottom: 16 }}>
        <div className="tank-detail-progress-label">
          <span>0%</span>
          <span>100%</span>
        </div>
        <div className="tank-detail-progress-bar">
          <div className={`tank-detail-progress-fill ${isClean ? 'clean' : 'used'}`}
            style={{ width: `${Math.max(0, Math.min(100, tank.levelPercent ?? 0))}%` }} />
        </div>
      </div>

      {/* Métricas */}
      <div className="tank-detail-stats" style={{ marginBottom: 16 }}>
        <div className="tank-detail-stat">
          <div className="tank-detail-stat-label">Limite Atenção</div>
          <div className="tank-detail-stat-value" style={{ color: 'var(--warning)' }}>{formatPercent(tank.attentionThreshold)}</div>
        </div>
        <div className="tank-detail-stat">
          <div className="tank-detail-stat-label">Limite Crítico</div>
          <div className="tank-detail-stat-value" style={{ color: 'var(--danger)' }}>{formatPercent(tank.criticalThreshold)}</div>
        </div>
        <div className="tank-detail-stat">
          <div className="tank-detail-stat-label">Capacidade</div>
          <div className="tank-detail-stat-value">{tank.capacityLiters ? `${tank.capacityLiters} L` : 'Não informado'}</div>
        </div>
        <div className="tank-detail-stat">
          <div className="tank-detail-stat-label">Status</div>
          <div className={`tank-detail-stat-value ${tank.status}`}>{tank.statusLabel}</div>
        </div>
      </div>

      {/* Limiares */}
      <div className="tank-detail-thresholds">
        <div className="tank-detail-threshold">
          <label>Limite Atenção (%)</label>
          <input type="number" min="0" max="100" defaultValue={tank.attentionThreshold} readOnly />
        </div>
        <div className="tank-detail-threshold">
          <label>Limite Crítico (%)</label>
          <input type="number" min="0" max="100" defaultValue={tank.criticalThreshold} readOnly />
        </div>
      </div>

      {/* Ação recomendada */}
      {(tank.status === 'critical' || tank.status === 'attention') && (
        <div style={{
          padding: '12px 14px',
          background: tank.status === 'critical' ? 'var(--danger-soft)' : 'var(--warning-soft)',
          border: `1px solid ${tank.status === 'critical' ? 'var(--danger-soft-strong)' : 'var(--warning-soft-strong)'}`,
          borderRadius: 10,
          display: 'flex', alignItems: 'flex-start', gap: 10,
          marginBottom: 16,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: tank.status === 'critical' ? 'var(--danger-soft-strong)' : 'var(--warning-soft-strong)',
            color: tank.status === 'critical' ? 'var(--danger)' : 'var(--warning)'
          }}>
            <AlertTriangle size={14} />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', color: tank.status === 'critical' ? 'var(--danger)' : 'var(--warning)', marginBottom: 2, fontSize: '11px' }}>
              Ação recomendada: {isClean ? 'Reposição de óleo limpo' : 'Retirada de óleo usado'}
            </strong>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.5 }}>
              {isClean
                ? `O nível de óleo limpo (${formatPercent(tank.levelPercent)}) atingiu o limite ${tank.statusLabel}. Programe a reposição para evitar interrupção.`
                : `O nível de óleo usado (${formatPercent(tank.levelPercent)}) atingiu o limite ${tank.statusLabel}. Programe a retirada para evitar transbordamento.`}
            </p>
          </div>
        </div>
      )}

      {tank.status === 'normal' && (
        <div style={{
          padding: '12px 14px',
          background: 'var(--success-soft)',
          border: '1px solid var(--success-soft-strong)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--success-soft-strong)', color: 'var(--success)'
          }}>
            <CheckCircle size={14} />
          </div>
          <div>
            <strong style={{ display: 'block', color: 'var(--success)', marginBottom: 2, fontSize: '11px' }}>Operação normal</strong>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '10px' }}>
              {isClean
                ? `O nível de óleo limpo está dentro dos parâmetros. Monitoramento contínuo ativo.`
                : `O nível de óleo usado está dentro dos parâmetros. Monitoramento contínuo ativo.`}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

export function TanksPage({ data }: TanksPageProps) {
  const { tanks } = data;

  return (
    <>
      <section className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow">COMPARTIMENTOS MONITORADOS</span>
          <h1>Tanques</h1>
          <p>Detalhes de nível, limites e status de cada compartimento do reservatório.</p>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        {tanks.map((tank) => (
          <TankDetailCard key={tank.id} tank={tank} />
        ))}
      </div>

      {/* Resumo geral */}
      <article className="panel-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: '0 0 14px', font: '700 14px Manrope, sans-serif' }}>Resumo do Sistema</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <SummaryItem label="Tanques Monitorados" value={tanks.length} icon={Droplets} color="var(--accent)" />
          <SummaryItem label="Alertas Ativos" value={data.summary?.activeAlerts || 0} icon={AlertTriangle} color="var(--danger)" />
          <SummaryItem label="Críticos" value={data.summary?.criticalAlerts || 0} icon={AlertTriangle} color="var(--danger)" />
          <SummaryItem label="Nível Médio" value={data.summary?.averageLevel ? formatPercent(data.summary.averageLevel) : '—'} icon={TrendingUp} color="var(--success)" />
        </div>
      </article>
    </>
  );
}

function SummaryItem({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ComponentType<{ size?: number }>; color: string }) {
  return (
    <div style={{ padding: '14px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
      <div style={{ color, marginBottom: 8 }}>
        <Icon size={20} />
      </div>
      <p style={{ margin: '0 0 4px', color: 'var(--text-dim)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
      <strong style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 700 }}>{value}</strong>
    </div>
  );
}
