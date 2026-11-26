import { ChevronUp, ChevronDown, Download } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { HistoryReading } from '../../hooks/useHistory';
import { formatDateTime, formatPercent } from '../../utils/formatters';
import { exportReadingsCSV } from '../../utils/export';

interface HistoryTableProps {
  readings: HistoryReading[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  tankIds?: string[];
  simulation: boolean;
}

export function HistoryTable({
  readings,
  simulation,
  loading = false,
  onLoadMore,
  hasMore = false,
  tankIds = ['oil-clean-01', 'oil-used-01'],
}: HistoryTableProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'measuredAt',
    direction: 'desc',
  });

  const sortedReadings = useMemo(() => {
    return [...readings].sort((a, b) => {
      let aVal: string | number | null = a[sortConfig.key as keyof HistoryReading];
      let bVal: string | number | null = b[sortConfig.key as keyof HistoryReading];

      if (sortConfig.key === 'measuredAt' || sortConfig.key === 'receivedAt') {
        aVal = aVal ? new Date(aVal as string).getTime() : 0;
        bVal = bVal ? new Date(bVal as string).getTime() : 0;
      } else if (sortConfig.key === 'deviceId') {
        aVal = aVal ?? '';
        bVal = bVal ?? '';
      } else if (aVal === null || bVal === null) {
        return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [readings, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
      if (onLoadMore && hasMore && !loading) {
        onLoadMore();
      }
    }
  };

  const exportCSV = () => exportReadingsCSV(sortedReadings, new Date().toISOString().slice(0, 10), simulation);

  return (
    <div className="history-table-wrap">
      <div className="history-table-toolbar">
        <div style={{ fontSize: '11px', color: '#827c91' }}>
          {readings.length} registro(s)
          {hasMore && <span style={{ marginLeft: 8, color: '#ad91ff' }}>• Mais disponíveis</span>}
        </div>
        <button
          onClick={exportCSV}
          disabled={readings.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'rgba(255,255,255,.03)',
            border: '1px solid #292538',
            borderRadius: 6,
            color: '#c6c1d7',
            fontSize: '10px',
            fontWeight: 500,
            cursor: readings.length === 0 ? 'not-allowed' : 'pointer',
            opacity: readings.length === 0 ? 0.5 : 1,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (readings.length > 0) {
              e.currentTarget.style.background = 'rgba(255,255,255,.06)';
              e.currentTarget.style.borderColor = '#373149';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.03)';
            e.currentTarget.style.borderColor = '#292538';
          }}
        >
          <Download size={12} />
          Exportar CSV
        </button>
      </div>

      <div
        onScroll={handleScroll}
        style={{
          maxHeight: 500,
          overflowY: 'auto',
          border: '1px solid #292538',
          borderRadius: 10,
          background: '#15131f',
        }}
      >
        {loading && readings.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#827c91' }}>Carregando histórico...</div>
        ) : readings.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#827c91' }}>Nenhum registro encontrado para o período selecionado.</div>
        ) : (
          <table className="history-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid #302b40' }}>
                <th
                  onClick={() => handleSort('measuredAt')}
                  style={{
                    padding: '12px 10px',
                    color: '#898398',
                    fontSize: '9px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    background: '#15131f',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Horário
                    {sortConfig.key === 'measuredAt' && (
                      sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('receivedAt')}
                  style={{
                    padding: '12px 10px',
                    color: '#898398',
                    fontSize: '9px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    background: '#15131f',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    Recebido em
                    {sortConfig.key === 'receivedAt' && (
                      sortConfig.direction === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />
                    )}
                  </div>
                </th>
                {tankIds.map((tankId) => (
                  <th
                    key={tankId}
                    style={{
                      padding: '12px 10px',
                      color: '#898398',
                      fontSize: '9px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      background: '#15131f',
                    }}
                  >
                    {tankId === 'oil-clean-01' ? 'Óleo limpo' : 'Óleo usado'}
                  </th>
                ))}
                <th
                  style={{
                    padding: '12px 10px',
                    color: '#898398',
                    fontSize: '9px',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    background: '#15131f',
                  }}
                >
                  Dispositivo
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedReadings.map((reading, index) => (
                <tr
                  key={reading.id}
                  style={{
                    borderBottom: index < sortedReadings.length - 1 ? '1px solid #272435' : 'none',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1b1828')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '12px 10px', color: '#d4cfdf', fontSize: '10px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {formatDateTime(reading.measuredAt)}
                  </td>
                  <td style={{ padding: '12px 10px', color: '#9691a8', fontSize: '9px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {formatDateTime(reading.receivedAt)}
                  </td>
                  {tankIds.map((tankId) => (
                    <td
                      key={tankId}
                      style={{
                        padding: '12px 10px',
                        color: reading.tankId === tankId ? '#f3f0fb' : '#767083',
                        fontSize: '10px',
                        fontWeight: reading.tankId === tankId ? 600 : 400,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {reading.tankId === tankId ? formatPercent(reading.levelPercent) : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '12px 10px', color: '#827c91', fontSize: '9px' }}>
                    {reading.deviceId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {hasMore && loading && (
          <div style={{ padding: 16, textAlign: 'center', color: '#827c91', fontSize: '10px' }}>
            Carregando mais...
          </div>
        )}

        {hasMore && !loading && (
          <div
            onClick={onLoadMore}
            style={{
              padding: 16,
              textAlign: 'center',
              color: '#ad91ff',
              fontSize: '10px',
              fontWeight: 500,
              cursor: 'pointer',
              borderTop: '1px solid #272435',
            }}
          >
            Carregar mais registros
          </div>
        )}
      </div>
    </div>
  );
}
