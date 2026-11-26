import { AlertTriangle } from 'lucide-react';
import type { OilAlert } from '../../types/oilguard';
import { formatDateTime } from '../../utils/formatters';

interface AlertItemProps {
  alert: OilAlert;
  variant?: 'default' | 'compact';
}

export function AlertItem({ alert, variant = 'default' }: AlertItemProps) {
  const isCritical = alert.severity === 'critical';
  const bgColor = isCritical ? 'rgba(240,106,121,.13)' : 'rgba(233,180,93,.13)';
  const iconColor = isCritical ? '#ff8995' : '#f0c376';
  const textColor = isCritical ? '#ff929d' : '#f0c376';
  const labelBg = isCritical ? 'rgba(240,106,121,.1)' : 'rgba(233,180,93,.1)';

  if (variant === 'compact') {
    return (
      <div
        className="alert-item-compact"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'linear-gradient(145deg, #191724, #15131e)',
          border: '1px solid #292538',
          borderRadius: 10,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background: bgColor,
            color: iconColor,
          }}
        >
          <AlertTriangle size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '11px', color: '#e9e5f1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {alert.title}
          </div>
          <div style={{ fontSize: '10px', color: '#a099ad', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {alert.message}
          </div>
        </div>
        <span
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: '8px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            background: labelBg,
            color: textColor,
          }}
        >
          {isCritical ? 'Crítico' : 'Atenção'}
        </span>
      </div>
    );
  }

  return (
    <div
      className="alert-item"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 0',
        borderBottom: '1px solid #2a2637',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          background: bgColor,
          color: iconColor,
        }}
      >
        <AlertTriangle size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '11px', color: '#e9e5f1', marginBottom: 4 }}>
          {alert.title}
        </div>
        <p style={{ margin: '0 0 6px', fontSize: '10px', lineHeight: 1.5, color: '#a099ad' }}>
          {alert.message}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '9px', color: '#767083' }}>
            Iniciado: {formatDateTime(alert.createdAt)}
          </span>
          <span
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: '8px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: labelBg,
              color: textColor,
            }}
          >
            {isCritical ? 'Crítico' : 'Atenção'}
          </span>
        </div>
      </div>
    </div>
  );
}