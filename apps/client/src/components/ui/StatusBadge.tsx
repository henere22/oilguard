import { CircleCheck, AlertTriangle, Clock3 } from 'lucide-react';
import type { TankStatus } from '../../types/oilguard';
import { STATUS_CONFIG } from '../../config/constants';

interface StatusBadgeProps {
  status: TankStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = status === 'unknown' ? Clock3 : status === 'normal' ? CircleCheck : AlertTriangle;

  const sizeClasses = {
    sm: { icon: 10, padding: '3px 6px', fontSize: '8px', gap: 4 },
    md: { icon: 13, padding: '5px 8px', fontSize: '9px', gap: 5 },
    lg: { icon: 16, padding: '7px 10px', fontSize: '10px', gap: 6 },
  };

  const s = sizeClasses[size];

  return (
    <span
      className="status-badge"
      style={{
        backgroundColor: config.bg,
        color: config.color,
        padding: s.padding,
        fontSize: s.fontSize,
        borderRadius: '999px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
      aria-label={`Status: ${config.label}`}
    >
      <Icon size={s.icon} strokeWidth={2.4} />
      {config.label}
    </span>
  );
}
