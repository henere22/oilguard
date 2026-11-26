// Funções de formatação centralizadas

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatPercent(value: number | null): string {
  if (value === null) return '?';
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export function formatDuration(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return 'Sem estimativa';
  if (hours < 1) return `Aprox. ${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `Aprox. ${hours.toFixed(1).replace('.', ',')} h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `Aprox. ${days} dia(s) ${remainingHours > 0 ? `e ${remainingHours} h` : ''}`;
}

export function formatDurationShort(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}min`;
  if (hours < 24) return `${hours.toFixed(1).replace('.', ',')}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `${days}d ${remainingHours > 0 ? `${remainingHours}h` : ''}`;
}

export function formatRatePerHour(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(2).replace('.', ',')}%/h`;
}

// Alias para compatibilidade
export const formatRate = formatRatePerHour;

export function formatRelativeTime(dateString: string | null): string {
  if (dateString === null) return '?';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 30) return 'agora mesmo';
  if (diffSec < 60) return `${diffSec}s atrás`;
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHour < 24) return `${diffHour}h atrás`;
  if (diffDay < 7) return `${diffDay}d atrás`;

  return formatDateTime(dateString);
}

export function getConnectionStatusText(status: 'connected' | 'delayed' | 'disconnected'): string {
  switch (status) {
    case 'connected':
      return 'Conectado';
    case 'delayed':
      return 'Comunicação atrasada';
    case 'disconnected':
      return 'Desconectado';
  }
}

export function getConnectionStatusColor(status: 'connected' | 'delayed' | 'disconnected'): string {
  switch (status) {
    case 'connected':
      return '#7cd5a5';
    case 'delayed':
      return '#f0c376';
    case 'disconnected':
      return '#ff909b';
  }
}