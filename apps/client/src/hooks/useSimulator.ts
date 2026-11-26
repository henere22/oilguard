import { useEffect, useRef, useState } from 'react';
import { api, type SimulatorSettings, type SimulatorState } from '../services/api';

export function useSimulator(allowed: boolean) {
  const [state, setState] = useState<SimulatorState | null>(null);
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    let fetching = false;
    async function refresh() {
      if (pending.current || fetching) return;
      const requestedRevision = revision.current;
      fetching = true;
      try {
        const result = await api.getSimulator(controller.signal);
        if (!controller.signal.aborted && requestedRevision === revision.current) {
          setState(result);
          setPollError('');
        }
      } catch (cause) {
        if (!controller.signal.aborted && requestedRevision === revision.current) {
          setPollError(cause instanceof Error ? cause.message : 'Não foi possível consultar o Worker.');
        }
      } finally {
        fetching = false;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [allowed]);

  async function mutate(action: () => Promise<SimulatorState>) {
    if (!allowed || !state?.available || pending.current) return;
    pending.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    try {
      setState(await action());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o simulador.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return {
    state, error: error || pollError, busy,
    updateConfig: (updates: Partial<SimulatorSettings>) => mutate(() => api.updateSimulator(updates)),
    resetScenario: () => mutate(api.resetSimulator),
  };
}
