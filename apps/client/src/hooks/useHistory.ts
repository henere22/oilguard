import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

export type HistoryPeriod = '1h' | '6h' | '24h' | '7d' | 'custom';

export interface HistoryFilters {
  period: HistoryPeriod;
  customStart?: Date;
  customEnd?: Date;
  tankId?: string;
  limit?: number;
}

export interface HistoryReading {
  id: number;
  tankId: string;
  levelPercent: number;
  measuredAt: string;
  receivedAt: string;
  deviceId: string | null;
}

export interface UseHistoryResult {
  readings: HistoryReading[];
  loading: boolean;
  error: string | null;
  filters: HistoryFilters;
  setFilters: (filters: Partial<HistoryFilters>) => void;
  refresh: () => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

function periodToMs(period: HistoryPeriod): number {
  switch (period) {
    case '1h':
      return 60 * 60 * 1000;
    case '6h':
      return 6 * 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

export function useHistory(initialFilters: Partial<HistoryFilters> = {}): UseHistoryResult {
  const defaultFilters: HistoryFilters = {
    period: '24h',
    limit: 100,
    ...initialFilters,
  };

  const [readings, setReadings] = useState<HistoryReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<HistoryFilters>(defaultFilters);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setOffset(0);

    try {
      // A API atual não suporta query params para /readings, vamos adaptar
      // Por enquanto, buscar todos e filtrar no frontend
      let { data } = await api.getReadings(new URLSearchParams({ limit: '1000' }));

      // Filtrar por período
      const now = Date.now();
      let startTime: number;
      if (filters.period === 'custom' && filters.customStart) {
        startTime = filters.customStart.getTime();
      } else {
        startTime = now - periodToMs(filters.period);
      }

      data = data.filter((r) => new Date(r.measuredAt).getTime() >= startTime);

      if (filters.period === 'custom' && filters.customEnd) {
        const endTime = filters.customEnd.getTime();
        data = data.filter((r) => new Date(r.measuredAt).getTime() <= endTime);
      }

      if (filters.tankId) {
        data = data.filter((r) => r.tankId === filters.tankId);
      }

      // Ordenar por data decrescente (mais recente primeiro)
      data.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());

      // Limitar
      data = data.slice(0, filters.limit ?? 100);

      setReadings(data);
      setHasMore(data.length >= (filters.limit ?? 100));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const nextOffset = offset + (filters.limit ?? 100);
      let { data } = await api.getReadings(new URLSearchParams({ limit: '1000' }));

      // Aplicar mesmos filtros
      const now = Date.now();
      let startTime: number;
      if (filters.period === 'custom' && filters.customStart) {
        startTime = filters.customStart.getTime();
      } else {
        startTime = now - periodToMs(filters.period);
      }

      data = data.filter((r) => new Date(r.measuredAt).getTime() >= startTime);

      if (filters.period === 'custom' && filters.customEnd) {
        const endTime = filters.customEnd.getTime();
        data = data.filter((r) => new Date(r.measuredAt).getTime() <= endTime);
      }

      if (filters.tankId) {
        data = data.filter((r) => r.tankId === filters.tankId);
      }

      data.sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime());
      const newData = data.slice(nextOffset, nextOffset + (filters.limit ?? 100));

      setReadings((prev) => [...prev, ...newData]);
      setOffset(nextOffset);
      setHasMore(newData.length >= (filters.limit ?? 100));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar mais histórico');
    } finally {
      setLoading(false);
    }
  }, [filters, offset, loading, hasMore]);

  const setFilters = useCallback((newFilters: Partial<HistoryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...newFilters }));
    setOffset(0);
  }, []);

  // Carregar inicial
  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    readings,
    loading,
    error,
    filters,
    setFilters,
    refresh,
    hasMore,
    loadMore,
  };
}

// Adicionar método getReadings à api para compatibilidade
declare module '../services/api' {
  interface Api {
    getReadings?: (query: string) => Promise<{ data: HistoryReading[] }>;
  }
}