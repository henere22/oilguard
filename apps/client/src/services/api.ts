import type { DashboardData, OilAlert, Tank } from '../types/oilguard';
import { Capacitor } from '@capacitor/core';

const native = Capacitor.isNativePlatform() || '__TAURI_INTERNALS__' in window;
export { native as isNativeApp };
const API_URL = (native ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3333') : '').replace(/\/$/, '');
let sessionToken: string | undefined;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'operator';
  active: boolean;
  primary: boolean;
}

export interface RecoveryCode {
  code: string;
  expiresAt: string;
}

export type SimulatorScenario = 'normal' | 'attention' | 'critical' | 'demo';

export interface SimulatorSettings {
  enabled: boolean;
  scenario: SimulatorScenario;
  intervalMs: number;
}

export interface SimulatorState extends SimulatorSettings {
  available: boolean;
  workerOnline: boolean;
  scenarios: Record<SimulatorScenario, {
    name: string;
    clean: { start: number; rate: number };
    used: { start: number; rate: number };
  }>;
  tickCount: number;
  cleanLevel: number;
  usedLevel: number;
  lastTickAt: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Accept', 'application/json');
  if (options?.body) headers.set('Content-Type', 'application/json');
  const token = sessionToken;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: native ? 'omit' : 'include',
  });

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/v1/auth/') && token === sessionToken) {
      sessionToken = undefined;
      window.dispatchEvent(new Event('oilguard:session-expired'));
    }
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body?.error ?? `API indisponível (${response.status}).`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function send<T>(path: string, method: 'POST' | 'PATCH', data?: unknown) {
  return request<T>(path, { method, body: data === undefined ? undefined : JSON.stringify(data) });
}

export const auth = {
  login: async (username: string, password: string) => {
    const result = await send<{ user: SessionUser; token?: string }>('/api/v1/auth/login', 'POST', { username, password, native });
    sessionToken = result.token;
    return result.user;
  },
  me: () => request<{ user: SessionUser }>('/api/v1/auth/me'),
  recover: (code: string, password: string) => send<void>('/api/v1/auth/recover', 'POST', { code, password }),
  logout: async () => {
    try {
      await send<void>('/api/v1/auth/logout', 'POST', {});
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    sessionToken = undefined;
  },
  users: () => request<{ data: SessionUser[] }>('/api/v1/admin/users'),
  createUser: (data: Pick<SessionUser, 'username' | 'name' | 'role'>) =>
    send<{ user: SessionUser } & RecoveryCode>('/api/v1/admin/users', 'POST', data),
  updateUser: (id: number, data: Partial<Pick<SessionUser, 'role' | 'active'>>) =>
    send<{ user: SessionUser }>(`/api/v1/admin/users/${id}`, 'PATCH', data),
  revokeUser: (id: number) => send<void>(`/api/v1/admin/users/${id}/revoke`, 'POST', {}),
  resetUser: (id: number) => send<RecoveryCode>(`/api/v1/admin/users/${id}/recovery`, 'POST', {}),
};

type Threshold = { attention_threshold: number; critical_threshold: number };

export interface DailyReportTank {
  tankId: string;
  tankName: string;
  kind: 'clean' | 'used';
  date: string;
  hasData: boolean;
  initialLevel: number | null;
  finalLevel: number | null;
  variation: number | null;
  estimatedConsumption: number | null;
  estimatedAccumulation: number | null;
  readings: Array<{
    id: number;
    levelPercent: number;
    measuredAt: string;
    receivedAt: string;
    deviceId: string | null;
  }>;
  alerts: Array<{
    id: number;
    severity: string;
    title: string;
    message: string;
    createdAt: string;
    resolvedAt: string | null;
    active: boolean;
  }>;
  attentionDurationMinutes: number;
  criticalDurationMinutes: number;
  dataQuality: 'good' | 'partial' | 'low' | 'no_data' | 'unconfigured';
  readingCount: number;
}

export interface DailyReport {
  date: string;
  hasData: boolean;
  oilClean: DailyReportTank | null;
  oilUsed: DailyReportTank | null;
  summary: {
    totalAlerts: number;
    criticalAlerts: number;
    attentionAlerts: number;
    totalAttentionMinutes: number;
    totalCriticalMinutes: number;
    dataQuality: 'available' | 'no_data';
  };
}

export interface PeriodReportTank {
  tankId: string;
  tankName: string;
  kind: 'clean' | 'used';
  hasData: boolean;
  initialLevel: number | null;
  finalLevel: number | null;
  variation: number | null;
  estimatedConsumption: number | null;
  estimatedAccumulation: number | null;
  readingCount: number;
  dataQuality: 'good' | 'partial' | 'low' | 'no_data' | 'unconfigured';
}

export interface PeriodReport {
  period: { start: string; end: string };
  oilClean: PeriodReportTank;
  oilUsed: PeriodReportTank;
  summary: {
    totalAlerts: number;
    criticalAlerts: number;
    attentionAlerts: number;
    daysWithData: number;
  };
}

export const api = {
  getDashboard: (signal?: AbortSignal) => request<DashboardData>('/api/v1/dashboard', { signal }),
  getTanks: (signal?: AbortSignal) => request<{ data: Tank[] }>('/api/v1/tanks', { signal }),
  updateThresholds: (data: Record<'oil-clean-01' | 'oil-used-01', Threshold>) =>
    send<{ data: Tank[] }>('/api/v1/tanks', 'PATCH', data),
  getSimulator: (signal?: AbortSignal) => request<SimulatorState>('/api/v1/admin/simulator', { signal }),
  updateSimulator: (data: Partial<SimulatorSettings>) =>
    send<SimulatorState>('/api/v1/admin/simulator', 'PATCH', data),
  resetSimulator: () => send<SimulatorState>('/api/v1/admin/simulator/reset', 'POST', {}),
  getAlerts: (signal?: AbortSignal) => request<{ data: OilAlert[] }>('/api/v1/alerts', { signal }),
  getReadings: (query: URLSearchParams, signal?: AbortSignal) => request<{ data: Array<{
    id: number;
    tankId: string;
    levelPercent: number;
    measuredAt: string;
    receivedAt: string;
    deviceId: string | null;
  }> }>(`/api/v1/readings?${query}`, { signal }),
  getDaysWithData: (signal?: AbortSignal) => request<{ data: string[] }>('/api/v1/reports/days', { signal }),
  getDailyReport: (date: string, signal?: AbortSignal) => request<DailyReport>(`/api/v1/reports/daily?date=${date}`, { signal }),
  getPeriodReport: (start: string, end: string, signal?: AbortSignal) => request<PeriodReport>(`/api/v1/reports/period?start=${start}&end=${end}`, { signal }),
  baseUrl: API_URL,
};
