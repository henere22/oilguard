import { useState, useEffect, useCallback, useRef } from 'react';

import { api } from '../services/api';

/**
 * Simulador interno que roda no navegador
 * Gera leituras simuladas e envia para a API via HTTP
 */
interface SimulatorConfig {
  enabled: boolean;
  intervalMs: number;
  scenario: 'normal' | 'attention' | 'critical' | 'demo';
}

interface ScenarioConfig {
  name: string;
  clean: { start: number; rate: number; noise: number };
  used: { start: number; rate: number; noise: number };
}

export const SCENARIOS: Record<SimulatorConfig['scenario'], ScenarioConfig> = {
  normal: {
    name: 'Normal',
    clean: { start: 72, rate: -0.3, noise: 0.05 },
    used: { start: 38, rate: 0.25, noise: 0.04 },
  },
  attention: {
    name: 'Atenção',
    clean: { start: 32, rate: -0.4, noise: 0.06 },
    used: { start: 68, rate: 0.35, noise: 0.05 },
  },
  critical: {
    name: 'Crítico',
    clean: { start: 12, rate: -0.5, noise: 0.08 },
    used: { start: 88, rate: 0.45, noise: 0.07 },
  },
  demo: {
    name: 'Demo Rápida',
    clean: { start: 72, rate: -2.0, noise: 0.2 },
    used: { start: 38, rate: 1.8, noise: 0.15 },
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function useSimulator(allowed: boolean) {
  const [config, setConfig] = useState<SimulatorConfig>(() => {
    const stored = localStorage.getItem('oilguard-simulator');
    if (stored) {
      try { return { ...JSON.parse(stored), enabled: false }; } catch { }
    }
    return { enabled: false, intervalMs: 5000, scenario: 'normal' };
  });

  const [status, setStatus] = useState<{
    running: boolean;
    tickCount: number;
    cleanLevel: number;
    usedLevel: number;
    lastError: string | null;
    lastTick: string | null;
  }>({
    running: false,
    tickCount: 0,
    cleanLevel: SCENARIOS.normal.clean.start,
    usedLevel: SCENARIOS.normal.used.start,
    lastError: null,
    lastTick: null,
  });

  const intervalRef = useRef<number | null>(null);
  const cleanLevelRef = useRef(config.scenario === 'normal' ? 72 : SCENARIOS[config.scenario].clean.start);
  const usedLevelRef = useRef(config.scenario === 'normal' ? 38 : SCENARIOS[config.scenario].used.start);

  // Salvar config no localStorage
  useEffect(() => {
    localStorage.setItem('oilguard-simulator', JSON.stringify(config));
  }, [config]);

  // Resetar níveis ao mudar cenário
  useEffect(() => {
    const scenario = SCENARIOS[config.scenario];
    cleanLevelRef.current = scenario.clean.start;
    usedLevelRef.current = scenario.used.start;
    setStatus(prev => ({
      ...prev,
      cleanLevel: scenario.clean.start,
      usedLevel: scenario.used.start,
      tickCount: 0,
      lastError: null,
    }));
  }, [config.scenario]);

  const tick = useCallback(async () => {
    const scenario = SCENARIOS[config.scenario];
    const now = new Date();

    // Calcular novos níveis com tendência + ruído
    const cleanChange = scenario.clean.rate + (Math.random() - 0.5) * scenario.clean.noise * 2;
    const usedChange = scenario.used.rate + (Math.random() - 0.5) * scenario.used.noise * 2;

    cleanLevelRef.current = clamp(cleanLevelRef.current + cleanChange, 0, 100);
    usedLevelRef.current = clamp(usedLevelRef.current + usedChange, 0, 100);

    try {
      await Promise.all([
        api.simulateReading('oil-clean-01', Number(cleanLevelRef.current.toFixed(1)), now.toISOString()),
        api.simulateReading('oil-used-01', Number(usedLevelRef.current.toFixed(1)), now.toISOString()),
      ]);

      setStatus(prev => ({
        ...prev,
        tickCount: prev.tickCount + 1,
        cleanLevel: cleanLevelRef.current,
        usedLevel: usedLevelRef.current,
        lastError: null,
        lastTick: now.toLocaleTimeString('pt-BR'),
      }));
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Erro desconhecido',
      }));
    }
  }, [config.scenario]);

  // Iniciar/parar simulador
  useEffect(() => {
    if (allowed && config.enabled) {
      // Primeira leitura imediata
      tick();

      // Interval
      intervalRef.current = window.setInterval(tick, config.intervalMs);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [allowed, config.enabled, config.intervalMs, tick]);

  // Atualizar status.running baseado em config.enabled
  useEffect(() => {
    setStatus(prev => ({ ...prev, running: config.enabled }));
  }, [config.enabled]);

  const updateConfig = useCallback((updates: Partial<SimulatorConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const resetScenario = useCallback(() => {
    const scenario = SCENARIOS[config.scenario];
    cleanLevelRef.current = scenario.clean.start;
    usedLevelRef.current = scenario.used.start;
    setStatus(prev => ({
      ...prev,
      cleanLevel: scenario.clean.start,
      usedLevel: scenario.used.start,
      tickCount: 0,
      lastError: null,
    }));
  }, [config.scenario]);

  const getStatusText = useCallback(() => {
    const scenario = SCENARIOS[config.scenario];
    return {
      scenario: scenario.name,
      clean: `${cleanLevelRef.current.toFixed(1)}%`,
      used: `${usedLevelRef.current.toFixed(1)}%`,
      tickCount: status.tickCount,
      running: status.running,
    };
  }, [config.scenario, status.tickCount, status.running]);

  return {
    config,
    status,
    updateConfig,
    resetScenario,
    getStatusText,
    scenarios: Object.keys(SCENARIOS) as SimulatorConfig['scenario'][],
  };
}