export type TankKind = 'clean' | 'used';
export type TankStatus = 'normal' | 'attention' | 'critical' | 'unknown';
export type AlertSeverity = 'attention' | 'critical';

// Aliases para compatibilidade com componentes
export type TankData = Tank;
export type ForecastData = Forecast;

export interface Tank {
  id: string;
  name: string;
  kind: TankKind;
  capacityLiters: number | null;
  levelPercent: number | null;
  attentionThreshold: number;
  criticalThreshold: number;
  status: TankStatus;
  statusLabel: string;
  updatedAt: string | null;
}

export interface OilAlert {
  id: number;
  tankId: string;
  tankName: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAt: string;
}

export interface Forecast {
  tankId: string;
  tankName: string;
  available: boolean;
  message: string;
  hoursRemaining: number | null;
  ratePerHour: number | null;
}

export interface HistoryPoint {
  time: string;
  [tankId: string]: string | number | undefined;
}

export interface DashboardData {
  generatedAt: string;
  dataMode: 'simulation' | 'operational';
  tanks: Tank[];
  alerts: OilAlert[];
  forecasts: Forecast[];
  history: HistoryPoint[];
  summary: {
    tankCount: number;
    activeAlerts: number;
    criticalAlerts: number;
    averageLevel: number | null;
  };
}
