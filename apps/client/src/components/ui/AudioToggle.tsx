import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAudioAlerts } from '../../hooks/useAudioAlerts';

interface AudioToggleProps {
  size?: 'sm' | 'md';
}

export function AudioToggle({ size = 'md' }: AudioToggleProps) {
  const { isEnabled, toggleEnabled, isPlaying } = useAudioAlerts();

  const sizeConfig = {
    sm: { iconSize: 16, fontSize: '10px', padding: '6px 8px' },
    md: { iconSize: 18, fontSize: '11px', padding: '8px 10px' },
  };

  const s = sizeConfig[size];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={toggleEnabled}
        aria-label={isEnabled ? 'Desativar alertas sonoros' : 'Ativar alertas sonoros'}
        title={isEnabled ? 'Alertas sonoros ativados (clique para desativar)' : 'Alertas sonoros desativados (clique para ativar)'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: 'none',
          backgroundColor: isEnabled ? 'rgba(150,114,255,.15)' : 'rgba(255,255,255,.05)',
          color: isEnabled ? '#ad91ff' : '#767083',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = isEnabled ? 'rgba(150,114,255,.25)' : 'rgba(255,255,255,.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isEnabled ? 'rgba(150,114,255,.15)' : 'rgba(255,255,255,.05)';
        }}
      >
        {isEnabled ? (
          <Volume2 size={s.iconSize} />
        ) : (
          <VolumeX size={s.iconSize} />
        )}
      </button>

      {isPlaying && (
        <React.Fragment>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              fontSize: '9px',
              fontWeight: 600,
              color: '#ad91ff',
              background: 'rgba(150,114,255,.1)',
              borderRadius: '999px',
              animation: 'pulse 1s ease-in-out infinite',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ad91ff',
                animation: 'blink 0.5s ease-in-out infinite alternate',
              }}
            />
            Tocando
          </span>
        </React.Fragment>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes blink {
          0% { opacity: 1; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}