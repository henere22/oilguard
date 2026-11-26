import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { getConnectionStatusText, getConnectionStatusColor } from '../../utils/formatters';

interface ConnectionIndicatorProps {
  status: 'connected' | 'delayed' | 'disconnected';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  lastUpdate?: Date | null;
}

export function ConnectionIndicator({
  status,
  size = 'md',
  showLabel = true,
  lastUpdate,
}: ConnectionIndicatorProps) {
  const color = getConnectionStatusColor(status);
  const text = getConnectionStatusText(status);

  const Icons = {
    connected: Wifi,
    delayed: AlertCircle,
    disconnected: WifiOff,
  };

  const Icon = Icons[status];

  const sizeConfig = {
    sm: { iconSize: 12, fontSize: '9px', padding: '4px 8px', gap: 4 },
    md: { iconSize: 14, fontSize: '10px', padding: '6px 10px', gap: 6 },
  };

  const s = sizeConfig[size];

  return (
    <div
      className="connection-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        padding: s.padding,
        borderRadius: '999px',
        fontSize: s.fontSize,
        fontWeight: 600,
        backgroundColor: `${color}15`,
        color,
        border: `1px solid ${color}33`,
      }}
      title={lastUpdate ? `Última atualização: ${lastUpdate.toLocaleTimeString('pt-BR')}` : undefined}
    >
      <Icon size={s.iconSize} />
      {showLabel && <span>{text}</span>}
    </div>
  );
}