import { Gauge, TrendingDown, TrendingUp, Info } from 'lucide-react';
import type { Forecast } from '../../types/oilguard';
import { formatDuration, formatRatePerHour } from '../../utils/formatters';

interface ForecastCardProps {
  forecast: Forecast;
  variant?: 'default' | 'compact';
}

export function ForecastCard({ forecast, variant = 'default' }: ForecastCardProps) {
  if (variant === 'compact') {
    return (
      <div
        className="forecast-card-compact"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'linear-gradient(145deg, #191724, #15131e)',
          border: '1px solid #292538',
          borderRadius: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background: 'rgba(150,114,255,.12)',
            color: '#a891ec',
          }}
        >
          <Gauge size={16} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#898398',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            {forecast.tankName.toUpperCase()}
          </div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: forecast.available ? '#f3f0fb' : '#827c91',
            }}
          >
            {forecast.available ? formatDuration(forecast.hoursRemaining) : 'Indisponível'}
          </div>
          {forecast.available && forecast.ratePerHour !== null && (
            <div style={{ fontSize: '10px', color: '#827c91', marginTop: 2 }}>
              Taxa: {formatRatePerHour(forecast.ratePerHour)}
            </div>
          )}
        </div>
        {!forecast.available && (
          <Info
            size={16}
            style={{ color: '#827c91', flexShrink: 0 }}
          />
        )}
      </div>
    );
  }

  return (
    <article
      className="forecast-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '16px',
        background: 'linear-gradient(145deg, #191724, #15131e)',
        border: '1px solid #292538',
        borderRadius: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 10,
            background: 'rgba(150,114,255,.12)',
            color: '#a891ec',
          }}
        >
          <Gauge size={18} />
        </div>
        <div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#898398',
              textTransform: 'uppercase',
            }}
          >
            PREVISÃO · {forecast.tankName.toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: forecast.available ? '#f3f0fb' : '#827c91',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          {forecast.available ? formatDuration(forecast.hoursRemaining) : 'Indisponível'}
        </div>
        {forecast.available && forecast.ratePerHour !== null && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#a99acb',
              fontSize: '11px',
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            {forecast.tankId === 'oil-clean-01' ? (
              <TrendingDown size={14} />
            ) : (
              <TrendingUp size={14} />
            )}
            <span>Taxa: {formatRatePerHour(forecast.ratePerHour)}</span>
          </div>
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: '11px',
          lineHeight: 1.5,
          color: forecast.available ? '#c6c1d7' : '#827c91',
        }}
      >
        {forecast.message}
      </p>

      {forecast.available && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingTop: 4,
            borderTop: '1px solid #2a2637',
            fontSize: '9px',
            color: '#716b7e',
            lineHeight: 1.5,
          }}
        >
          <Info size={12} />
          <span>
            Estimativa indicativa baseada em tendência linear. Não substitui procedimentos operacionais.
          </span>
        </div>
      )}
    </article>
  );
}