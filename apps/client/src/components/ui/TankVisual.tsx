import type { TankKind } from '../../config/constants';
import { TANK_CONFIG } from '../../config/constants';

interface TankVisualProps {
  level: number;
  kind: TankKind;
  width?: number;
  height?: number;
  showLabels?: boolean;
}

export function TankVisual({ level, kind, width = 60, height = 100, showLabels = false }: TankVisualProps) {
  const config = TANK_CONFIG[kind === 'clean' ? 'oil-clean-01' : 'oil-used-01'];
  const clampedLevel = Math.max(0, Math.min(100, level));

  return (
    <div
      className="tank-visual"
      style={{
        width,
        height,
        position: 'relative',
        border: '2px solid #77718a',
        borderRadius: '8px 8px 12px 12px',
        background: 'rgba(255,255,255,.035)',
        boxShadow: 'inset 0 0 10px rgba(255,255,255,.05)',
        overflow: 'hidden',
      }}
      aria-label={`Nível ${formatPercent(clampedLevel)}`}
    >
      {/* Líquido */}
      <div
        className="tank-liquid"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${clampedLevel}%`,
          background: config.colors.liquid,
          opacity: 0.88,
          borderTop: '1px solid rgba(255,255,255,.3)',
          transition: 'height 0.5s ease-out',
        }}
      />

      {/* Tampa */}
      <div
        className="tank-cap"
        style={{
          position: 'absolute',
          top: -4,
          left: '50%',
          transform: 'translateX(-50%)',
          width: width * 0.4,
          height: 6,
          border: '1px solid #77718a',
          borderRadius: '3px',
          background: '#343044',
        }}
      />

      {showLabels && (
        <>
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 10,
              color: '#827c91',
            }}
          >
            100%
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: -20,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: 10,
              color: '#827c91',
            }}
          >
            0%
          </div>
        </>
      )}
    </div>
  );
}

// Re-export formatPercent for use in this component
function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
}