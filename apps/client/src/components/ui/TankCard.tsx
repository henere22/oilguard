import { AlertTriangle, CheckCircle, TrendingUp, HelpCircle, Droplets } from 'lucide-react';
import type { Tank, Forecast } from '../../types/oilguard';
import { formatPercent, formatDuration, formatRate, formatRelativeTime } from '../../utils/formatters';

interface TankCardProps {
  tank: Tank;
  forecast?: Forecast;
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'normal': return 'status-normal';
    case 'attention': return 'status-attention';
    case 'critical': return 'status-critical';
    default: return 'status-unknown';
  }
}

export function TankCard({ tank, forecast }: TankCardProps) {
  const isClean = tank.kind === 'clean';
  const level = Math.max(0, Math.min(100, tank.levelPercent ?? 0));
  const statusClass = getStatusClass(tank.status);
  const symbolClass = isClean ? 'symbol-clean' : 'symbol-used';

  return (
    <article className="tank-card">
      <div className="tank-heading">
        <div className={`tank-symbol ${symbolClass}`}>
          <Droplets size={20} />
        </div>
        <div>
          <h3>{tank.name}</h3>
          <span className="subtle">{isClean ? 'Óleo limpo' : 'Óleo usado'}</span>
        </div>
        <span className={`status-badge ${statusClass}`}>
          <span className="status-dot" />
          {tank.status === 'normal' ? 'Normal' : tank.status === 'attention' ? 'Atenção' : 'Crítico'}
        </span>
      </div>

      <div className="tank-reading">
        <div className="tank-visual">
          <div className="tank-cap" />
          <div className={`tank-liquid`} style={{ height: `${level}%` }} />
        </div>
        <div className="tank-percentage">
          {formatPercent(tank.levelPercent)}
        </div>
        <div className="tank-updated">
          <span>{tank.updatedAt ? `Atualizado ${formatRelativeTime(tank.updatedAt)}` : 'Sem leitura recebida'}</span>
        </div>
      </div>

      <div className="tank-footer">
        <div>
          <strong>Limites</strong>
          <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: '10px' }}>
            <span style={{ color: '#e9b45d' }}>Atenção: {formatPercent(tank.attentionThreshold)}</span>
            <span style={{ color: '#f06a79' }}>Crítico: {formatPercent(tank.criticalThreshold)}</span>
          </div>
        </div>
        {forecast && (
          <div className="forecast-inline">
            {forecast.hoursRemaining !== null ? (
              <>
                <TrendingUp size={12} style={{ color: '#52c68b' }} />
                <span style={{ color: '#52c68b' }}>~{formatDuration(forecast.hoursRemaining)}</span>
                {forecast.ratePerHour !== null && (
                  <span style={{ color: '#827c91' }}>Taxa: {formatRate(forecast.ratePerHour)}</span>
                )}
              </>
            ) : (
              <>
                <HelpCircle size={12} style={{ color: '#ac92ff' }} />
                <span style={{ color: '#ac92ff' }}>Aguardando histórico</span>
                <span style={{ color: '#827c91' }}>{forecast.message}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="tank-footer" style={{ borderTop: 'none', marginTop: 8, paddingTop: 8 }}>
        {tank.status === 'unknown' ? null : tank.status !== 'normal' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: tank.status === 'critical' ? '#ff909b' : '#f0c376', fontSize: '10px' }}>
            <AlertTriangle size={12} />
            <span>
              <strong>Ação: </strong>
              {isClean ? 'Reposição de óleo limpo' : 'Retirada de óleo usado'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#7cd5a5', fontSize: '10px' }}>
            <CheckCircle size={12} />
            <span>Operação normal — monitoramento ativo</span>
          </div>
        )}
      </div>
    </article>
  );
}