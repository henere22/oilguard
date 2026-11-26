import { Calendar, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { HistoryFilters, HistoryPeriod } from '../../hooks/useHistory';
import { HISTORY_PERIODS } from '../../config/constants';
import { formatDate } from '../../utils/formatters';

interface HistoryFiltersProps {
  filters: HistoryFilters;
  onChange: (filters: Partial<HistoryFilters>) => void;
}

export function HistoryFilters({ filters, onChange }: HistoryFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(filters.customStart ? formatDate(filters.customStart.toISOString()) : '');
  const [customEnd, setCustomEnd] = useState(filters.customEnd ? formatDate(filters.customEnd.toISOString()) : '');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePeriodChange = (period: HistoryPeriod) => {
    onChange({ period, customStart: undefined, customEnd: undefined });
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    if (customStart) {
      const start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      onChange({ period: 'custom', customStart: start });
    }
    if (customEnd) {
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      onChange({ period: 'custom', customEnd: end });
    }
    setIsOpen(false);
  };

  const handleCustomClear = () => {
    setCustomStart('');
    setCustomEnd('');
    onChange({ period: '24h', customStart: undefined, customEnd: undefined });
    setIsOpen(false);
  };

  const currentPeriod = HISTORY_PERIODS.find((p) => p.value === filters.period);

  return (
    <div className="history-filters" style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'rgba(255,255,255,.03)',
          border: '1px solid #292538',
          borderRadius: 8,
          color: '#c6c1d7',
          fontSize: '11px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,.06)';
          e.currentTarget.style.borderColor = '#373149';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,.03)';
          e.currentTarget.style.borderColor = '#292538';
        }}
      >
        <Calendar size={14} />
        <span>{currentPeriod?.label || 'Período'}</span>
        <ChevronDown size={12} style={{ transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 220,
            background: '#15131f',
            border: '1px solid #292538',
            borderRadius: 10,
            padding: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 50,
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#898398', letterSpacing: '0.08em', marginBottom: 8 }}>
              PERÍODO RÁPIDO
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {HISTORY_PERIODS.filter((p) => p.value !== 'custom').map((period) => (
                <button
                  key={period.value}
                  onClick={() => handlePeriodChange(period.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 12px',
                    background: filters.period === period.value ? 'rgba(150,114,255,.15)' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: filters.period === period.value ? '#ad91ff' : '#c6c1d7',
                    fontSize: '11px',
                    fontWeight: filters.period === period.value ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (filters.period !== period.value) {
                      e.currentTarget.style.background = 'rgba(255,255,255,.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (filters.period !== period.value) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <span>{period.label}</span>
                  {filters.period === period.value && (
                    <span style={{ color: '#ad91ff' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #292538', paddingTop: 10 }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#898398', letterSpacing: '0.08em', marginBottom: 10 }}>
              PERSONALIZADO
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#827c91', marginBottom: 4 }}>Início</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#0c0b13',
                    border: '1px solid #292538',
                    borderRadius: 6,
                    color: '#f3f0fb',
                    fontSize: '11px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#827c91', marginBottom: 4 }}>Fim</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: '#0c0b13',
                    border: '1px solid #292538',
                    borderRadius: 6,
                    color: '#f3f0fb',
                    fontSize: '11px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={handleCustomApply}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'linear-gradient(90deg, #7756c5, #a78aff)',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Aplicar
                </button>
                <button
                  onClick={handleCustomClear}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'transparent',
                    border: '1px solid #292538',
                    borderRadius: 6,
                    color: '#a49eb2',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}