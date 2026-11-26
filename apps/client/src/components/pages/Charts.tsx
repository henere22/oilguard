import type { DashboardData } from '../../types/oilguard';
import { HistoryChart } from '../ui/HistoryChart';
import { ForecastCard } from '../ui/ForecastCard';

interface ChartsProps {
  data: DashboardData;
}

export function Charts({ data }: ChartsProps) {
  return (
    <>
      <section className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <span className="eyebrow">ANÁLISE DE DADOS</span>
          <h1>Gráficos</h1>
          <p>Acompanhe a evolução do nível nos dois compartimentos.</p>
        </div>
      </section>

      <article className="panel-card chart-page-panel">
        <div className="panel-header">
          <div>
            <h2>Variação dos níveis</h2>
            <p>Histórico das medições registradas</p>
          </div>
          <span className="panel-chip">0–100%</span>
        </div>
        <div className="chart-wrap" style={{ height: 360 }}>
          <HistoryChart data={data.history} height={360} />
        </div>
      </article>

      <div className="forecast-grid" style={{ marginTop: 15 }}>
        {data.forecasts.map((forecast) => (
          <ForecastCard key={forecast.tankId} forecast={forecast} />
        ))}
      </div>
    </>
  );
}