import { useCallback, useEffect, useRef, useState } from 'react';

type AlertSeverity = 'attention' | 'critical';

interface AudioAlertOptions {
  enabled?: boolean;
  volume?: number;
}

interface UseAudioAlertsResult {
  playAlert: (severity: AlertSeverity) => void;
  stopAlert: () => void;
  checkAndPlayCriticalTransition: (tankId: string, severity: AlertSeverity | null) => void;
  isEnabled: boolean;
  toggleEnabled: () => void;
  isPlaying: boolean;
  volume: number;
  setVolume: (volume: number) => void;
}

const ALERT_FREQUENCIES = {
  attention: [440, 554.37], // A4 + C#5 - intervalo menor, menos urgente
  critical: [523.25, 659.25, 783.99], // C5 + E5 + G5 - acorde maior, mais urgente
};

const ALERT_PATTERNS = {
  attention: { beepDuration: 300, gapDuration: 700, repeatCount: 2 },
  critical: { beepDuration: 200, gapDuration: 200, repeatCount: 4 },
};

function createBeep(
  audioContext: AudioContext,
  frequency: number,
  duration: number,
  volume: number,
  when: number
): OscillatorNode {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gainNode.gain.value = volume;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(when);
  oscillator.stop(when + duration / 1000);

  return oscillator;
}

function playPattern(
  audioContext: AudioContext,
  frequencies: number[],
  pattern: { beepDuration: number; gapDuration: number; repeatCount: number },
  volume: number
): Promise<void> {
  return new Promise((resolve) => {
    const { beepDuration, gapDuration, repeatCount } = pattern;
    const cycleDuration = beepDuration + gapDuration;
    let currentTime = audioContext.currentTime;
    let completedCycles = 0;

    const playCycle = () => {
      if (completedCycles >= repeatCount) {
        resolve();
        return;
      }

      frequencies.forEach((freq, index) => {
        const when = currentTime + index * 0.1; // Pequeno delay entre frequências
        createBeep(audioContext, freq, beepDuration, volume, when);
      });

      completedCycles++;
      currentTime += cycleDuration / 1000;

      setTimeout(playCycle, cycleDuration);
    };

    playCycle();
  });
}

export const audioPreferencesEvent = 'oilguard:audio-preferences';

export function useAudioAlerts(options: AudioAlertOptions = {}): UseAudioAlertsResult {
  const { enabled: initialEnabled = true, volume: initialVolume = 0.3 } = options;

  const [isEnabled, setIsEnabled] = useState(() => {
    const stored = localStorage.getItem('oilguard-audio-enabled');
    return stored === null ? initialEnabled : stored !== 'false';
  });

  const [volume, setVolume] = useState(() => {
    const stored = localStorage.getItem('oilguard-audio-volume');
    return stored !== null ? Number(stored) : initialVolume;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentPatternRef = useRef<{ stop: () => void } | null>(null);
  const userInteractedRef = useRef(false);
  // Rastrear se cada tanque já esteve em estado crítico para tocar som apenas na transição
  const wasCriticalRef = useRef<Record<string, boolean>>({});

  // Inicializar AudioContext na primeira interação do usuário
  const ensureAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resumir contexto se estiver suspenso (política de autoplay)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    userInteractedRef.current = true;
  }, []);

  // Capturar primeira interação do usuário
  useEffect(() => {
    const handleInteraction = () => {
      ensureAudioContext();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };

    document.addEventListener('click', handleInteraction, { once: true, passive: true });
    document.addEventListener('keydown', handleInteraction, { once: true, passive: true });
    document.addEventListener('touchstart', handleInteraction, { once: true, passive: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [ensureAudioContext]);

  const playAlert = useCallback(
    (severity: AlertSeverity) => {
      if (!isEnabled || !userInteractedRef.current) return;

      ensureAudioContext();
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      // Parar alerta anterior se houver
      if (currentPatternRef.current) {
        currentPatternRef.current.stop();
      }

      setIsPlaying(true);

      const frequencies = ALERT_FREQUENCIES[severity];
      const pattern = ALERT_PATTERNS[severity];

      let stopped = false;
      const stop = () => {
        stopped = true;
      };
      currentPatternRef.current = { stop };

      playPattern(audioContext, frequencies, pattern, volume)
        .then(() => {
          if (!stopped) {
            setIsPlaying(false);
            currentPatternRef.current = null;
          }
        })
        .catch(() => {
          setIsPlaying(false);
          currentPatternRef.current = null;
        });
    },
    [isEnabled, volume, ensureAudioContext]
  );

  // Nova função: tocar alerta apenas na transição PARA crítico
  const checkAndPlayCriticalTransition = useCallback(
    (tankId: string, severity: AlertSeverity | null) => {
      const isNowCritical = severity === 'critical';
      const wasCritical = wasCriticalRef.current[tankId] === true;

      // Tocar apenas se transicionou PARA crítico (não estava crítico, agora está)
      if (isNowCritical && !wasCritical) {
        playAlert('critical');
      }

      // Atualizar estado anterior
      wasCriticalRef.current[tankId] = isNowCritical;
    },
    [playAlert]
  );

  const stopAlert = useCallback(() => {
    if (currentPatternRef.current) {
      currentPatternRef.current.stop();
      currentPatternRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    function synchronize() {
      const storedEnabled = localStorage.getItem('oilguard-audio-enabled');
      const enabled = storedEnabled === null ? initialEnabled : storedEnabled !== 'false';
      const storedVolume = localStorage.getItem('oilguard-audio-volume');
      const level = storedVolume === null ? initialVolume : Number(storedVolume);
      setIsEnabled(enabled);
      setVolume(Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : initialVolume);
      if (!enabled) stopAlert();
    }
    window.addEventListener(audioPreferencesEvent, synchronize);
    return () => window.removeEventListener(audioPreferencesEvent, synchronize);
  }, [initialEnabled, initialVolume, stopAlert]);

  const toggleEnabled = useCallback(() => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    localStorage.setItem('oilguard-audio-enabled', JSON.stringify(newEnabled));
    window.dispatchEvent(new Event(audioPreferencesEvent));
    if (!newEnabled) {
      stopAlert();
    }
  }, [isEnabled, stopAlert]);

  const setVolumeLevel = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(1, newVolume));
    setVolume(clamped);
    localStorage.setItem('oilguard-audio-volume', String(clamped));
    window.dispatchEvent(new Event(audioPreferencesEvent));
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopAlert();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopAlert]);

  return {
    playAlert,
    stopAlert,
    checkAndPlayCriticalTransition,
    isEnabled,
    toggleEnabled,
    isPlaying,
    volume,
    setVolume: setVolumeLevel,
  };
}
