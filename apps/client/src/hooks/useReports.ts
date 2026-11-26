import { useCallback, useEffect, useState } from 'react';
import { api, type DailyReport, type PeriodReport } from '../services/api';

export interface UseDailyReportResult {
  report: DailyReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UsePeriodReportResult {
  report: PeriodReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseDaysWithDataResult {
  days: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDailyReport(date: string): UseDailyReportResult {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDailyReport(date);
      setReport(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar relatório diário');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { report, loading, error, refresh };
}

export function usePeriodReport(start: string, end: string): UsePeriodReportResult {
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!start || !end) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPeriodReport(start, end);
      setReport(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar relatório do período');
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { report, loading, error, refresh };
}

export function useDaysWithData(): UseDaysWithDataResult {
  const [days, setDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDaysWithData();
      setDays(data.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro ao carregar dias com dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { days, loading, error, refresh };
}