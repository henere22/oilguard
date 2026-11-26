import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import type { DashboardData, HistoryPoint } from '../../types/oilguard';
import { formatTime } from '../../utils/formatters';

interface ChartPoint extends HistoryPoint {
  label: string;
}

interface HistoryChartProps {
  data: DashboardData['history'];
  height?: number;
}

export function HistoryChart({ data, height = 280 }: HistoryChartProps) {
  const chartData = useMemo<ChartPoint[]>(() =>
    data.map((point) => ({
      ...point,
      label: formatTime(point.time),
    })),
    [data]
  );

  const hasData = chartData.length >= 2;
  const hasClean = chartData.some((p) => (p as Record<string, unknown>)['oil-clean-01'] !== undefined);
  const hasUsed = chartData.some((p) => (p as Record<string, unknown>)['oil-used-01'] !== undefined);

  return (
    <div className="chart-wrap" style={{ width: '100%', height }}>
      {!hasData ? (
        <div
          className="chart-empty"
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            color: '#827c91',
            fontSize: '11px',
            textAlign: 'center',
            padding: 20,
          }}
        >
          <Activity size={28} style={{ color: '#555066' }} />
          <span>
            {chartData.length === 0
              ? 'Nenhum dado histórico disponível'
              : 'Aguardando mais leituras para exibir o gráfico'}
          </span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
          >
            <CartesianGrid
              stroke="#29263a"
              strokeDasharray="3 5"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: '#858198', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
              tickFormatter={(value) => value}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#858198', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value: number) => `${value}%`}
              width={35}
            />
            <Tooltip
              contentStyle={{
                background: '#171522',
                border: '1px solid #39344d',
                borderRadius: 12,
                color: '#fff',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#aaa5bc', fontSize: '11px' }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                value !== undefined && value !== null ? `${Number(value).toFixed(1)}%` : '—',
                name === 'oil-clean-01' ? 'Óleo limpo' : 'Óleo usado',
              ] as [string, string]}
              labelFormatter={(label: any) => String(label)}
            />
            <Legend
              formatter={(value: React.ReactNode) => String(value) === 'oil-clean-01' ? 'Óleo limpo' : 'Óleo usado'}
              wrapperStyle={{ color: '#c6c1d7', fontSize: 12 }}
              layout="horizontal"
              align="center"
              verticalAlign="top"
              iconSize={12}
              iconType="line"
              height={30}
            />
            {hasClean && (
              <Line
                type="monotone"
                dataKey="oil-clean-01"
                name="oil-clean-01"
                stroke="#9b7cff"
                strokeWidth={2.5}
                dot={false}
                connectNulls
                activeDot={{ r: 4 }}
              />
            )}
            {hasUsed && (
              <Line
                type="monotone"
                dataKey="oil-used-01"
                name="oil-used-01"
                stroke="#e1a64b"
                strokeWidth={2.5}
                dot={false}
                connectNulls
                activeDot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}