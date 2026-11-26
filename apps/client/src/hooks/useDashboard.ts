import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import type { DashboardData } from '../types/oilguard';

interface UseDashboardOptions {
  refreshIntervalMs?: number;
  enabled?: boolean;
}

interface UseDashboardResult {
  data: DashboardData | null;
  error: string | null;
  loading: boolean;
  lastRefresh: Date | null;
  refresh: () => Promise<void>;
  connectionStatus: 'connected' | 'delayed' | 'disconnected';
  isStale: boolean;
  staleThresholdMs: number;
}

export function useDashboard(options: UseDashboardOptions = {}): UseDashboardResult {
  const { refreshIntervalMs = 5000, enabled = true } = options;

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'delayed' | 'disconnected'>('disconnected');

  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);

  // Threshold para considerar dados atrasados (3x intervalo de refresh)
  const staleThresholdMs = refreshIntervalMs * 3;

  const checkStaleData = useCallback(() => {
    if (!data) return true;
    const now = Date.now();
    const latestUpdate = Math.max(
      ...data.tanks.map((tank) => tank.updatedAt ? Date.parse(tank.updatedAt) : 0)
    );
    return now - latestUpdate > staleThresholdMs;
  }, [data, staleThresholdMs]);

  const refresh = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const result = await api.getDashboard(abortControllerRef.current.signal);
      setData(result);
      setError(null);
      setConnectionStatus('connected');
      setLastRefresh(new Date());
      retryCountRef.current = 0;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Erro desconhecido ao conectar à API.';
      setError(message);

      // Determinar status de conexão baseado no erro
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        // Ignorado - request cancelado
      } else if (cause instanceof TypeError && cause.message.includes('fetch')) {
        setConnectionStatus('disconnected');
      } else {
        setConnectionStatus('delayed');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Agendar retry com backoff exponencial
  const scheduleRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000); // max 30s
    retryCountRef.current += 1;
    retryTimeoutRef.current = window.setTimeout(() => {
      void refresh();
    }, delay);
  }, [refresh]);

  // Effect principal de refresh
  useEffect(() => {
    if (!enabled) return;

    void refresh();

    intervalRef.current = window.setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, refresh, refreshIntervalMs]);

  // Effect para detectar dados atrasados e agendar retry em caso de erro
  useEffect(() => {
    if (error && connectionStatus !== 'connected') {
      scheduleRetry();
    }
  }, [error, connectionStatus, scheduleRetry]);

  const isStale = checkStaleData();

  return {
    data,
    error,
    loading,
    lastRefresh,
    refresh,
    connectionStatus,
    isStale,
    staleThresholdMs,
  };
}