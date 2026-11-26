// Configurações centralizadas do OILGUARD
// Valores operacionais devem ser confirmados com a equipe de mecatrônica

export const TANK_CONFIG = {
  'oil-clean-01': {
    id: 'oil-clean-01',
    name: 'Óleo limpo',
    kind: 'clean' as const,
    // Thresholds PROVISÓRIOS - confirmar com equipe
    attentionThreshold: 30,
    criticalThreshold: 15,
    // Capacidade em litros - aguardando confirmação
    capacityLiters: null,
    // Cores específicas do compartimento
    colors: {
      primary: '#9b7cff',
      light: '#ad91ff',
      dark: '#6c4dbb',
      liquid: 'linear-gradient(180deg, #ab91ff, #6c4dbb)',
      track: 'linear-gradient(90deg, #7756c5, #a78aff)',
      trackAttention: 'linear-gradient(90deg, #b78335, #edc071)',
      trackCritical: 'linear-gradient(90deg, #b94b5a, #f47c88)',
    },
    icon: 'droplet',
    description: 'Compartimento de reposição',
    trendDirection: 'down' as const,
  },
  'oil-used-01': {
    id: 'oil-used-01',
    name: 'Óleo usado',
    kind: 'used' as const,
    // Thresholds PROVISÓRIOS - confirmar com equipe
    attentionThreshold: 70,
    criticalThreshold: 85,
    // Capacidade em litros - aguardando confirmação
    capacityLiters: null,
    // Cores específicas do compartimento
    colors: {
      primary: '#e1a64b',
      light: '#e9b45d',
      dark: '#9c6328',
      liquid: 'linear-gradient(180deg, #e9bd70, #9c6328)',
      track: 'linear-gradient(90deg, #7756c5, #a78aff)',
      trackAttention: 'linear-gradient(90deg, #b78335, #edc071)',
      trackCritical: 'linear-gradient(90deg, #b94b5a, #f47c88)',
    },
    icon: 'droplet',
    description: 'Compartimento de descarte',
    trendDirection: 'up' as const,
  },
} as const;

export const STATUS_CONFIG = {
  unknown: {
    label: 'Aguardando leitura',
    color: '#b7afc4',
    bg: 'rgba(183,175,196,.12)',
  },
  normal: {
    label: 'Normal',
    color: '#7cd5a5',
    bg: 'rgba(82,198,139,.11)',
    border: '#52c68b',
    icon: 'check-circle',
  },
  attention: {
    label: 'Atenção',
    color: '#f0c376',
    bg: 'rgba(233,180,93,.12)',
    border: '#e9b45d',
    icon: 'alert-triangle',
  },
  critical: {
    label: 'Crítico',
    color: '#ff909b',
    bg: 'rgba(240,106,121,.12)',
    border: '#f06a79',
    icon: 'alert-triangle',
  },
} as const;

export const UI_CONFIG = {
  // Cores da marca OILGUARD
  brand: {
    primary: '#9672ff',
    bright: '#ad91ff',
    dark: '#6c4dbb',
  },
  // Paleta semântica
  semantic: {
    success: '#52c68b',
    warning: '#e9b45d',
    danger: '#f06a79',
    info: '#9672ff',
  },
  // Superfícies
  surfaces: {
    bg: '#0c0b13',
    panel: '#15131f',
    panelSoft: '#1b1828',
    border: '#292538',
    borderLight: '#373149',
  },
  // Texto
  text: {
    primary: '#f3f0fb',
    secondary: '#c6c1d7',
    muted: '#9691a8',
    disabled: '#767083',
  },
  // Espaçamento
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  // Border radius
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    full: 999,
  },
  // Transições
  transition: {
    fast: '0.15s ease',
    normal: '0.2s ease',
    slow: '0.3s ease',
  },
  // Breakpoints
  breakpoints: {
    mobile: 820,
    tablet: 1120,
    desktop: 1440,
  },
  // Refresh interval (ms)
  refreshInterval: 5000,
  // Stale threshold multiplier
  staleMultiplier: 3,
} as const;

export const HISTORY_PERIODS = [
  { value: '1h' as const, label: 'Última hora', ms: 60 * 60 * 1000 },
  { value: '6h' as const, label: 'Últimas 6h', ms: 6 * 60 * 60 * 1000 },
  { value: '24h' as const, label: 'Últimas 24h', ms: 24 * 60 * 60 * 1000 },
  { value: '7d' as const, label: 'Últimos 7 dias', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: 'custom' as const, label: 'Personalizado', ms: 0 },
] as const;

export type TankId = keyof typeof TANK_CONFIG;
export type TankKind = 'clean' | 'used';
export type TankStatus = 'normal' | 'attention' | 'critical';
export type AlertSeverity = 'attention' | 'critical';
export type HistoryPeriod = '1h' | '6h' | '24h' | '7d' | 'custom';
