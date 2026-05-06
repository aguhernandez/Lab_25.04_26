import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HeatHistoryEntry, getTrendArrow } from '../../lib/heatAdaptation';

interface Props {
  history: HeatHistoryEntry[];
}

export default function HeatAdaptationTrends({ history }: Props) {
  if (history.length < 2) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500 font-body text-sm">
        At least 2 sessions required to display trends.
      </div>
    );
  }

  const chartData = [...history].reverse().map((h, i) => ({
    session: `S${i + 1}`,
    date: h.date,
    cardiacLoad: h.heatCardiacLoad !== null ? Math.round(h.heatCardiacLoad * 10000) / 10000 : null,
    hrDrift: h.hrDriftPercent !== null ? Math.round(h.hrDriftPercent * 10) / 10 : null,
    rpe: h.rpe,
    sweatRate: h.sweatRate_L_h !== null ? Math.round(h.sweatRate_L_h * 1000) / 1000 : null,
    score: h.heatAdaptationScore,
  }));

  const latest = history[0];
  const oldest = history[history.length - 1];

  const cardiacTrend = getTrendArrow(
    latest.heatCardiacLoad !== null && oldest.heatCardiacLoad !== null
      ? latest.heatCardiacLoad - oldest.heatCardiacLoad
      : null,
    true
  );
  const driftTrend = getTrendArrow(
    latest.hrDriftPercent !== null && oldest.hrDriftPercent !== null
      ? latest.hrDriftPercent - oldest.hrDriftPercent
      : null,
    true
  );
  const rpeTrend = getTrendArrow(
    latest.rpe !== null && oldest.rpe !== null
      ? latest.rpe - oldest.rpe
      : null,
    true
  );
  const sweatTrend = getTrendArrow(
    latest.sweatRate_L_h !== null && oldest.sweatRate_L_h !== null
      ? latest.sweatRate_L_h - oldest.sweatRate_L_h
      : null,
    false
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TrendStat
          label="Cardiac Load"
          value={latest.heatCardiacLoad !== null ? latest.heatCardiacLoad.toFixed(4) : '—'}
          trend={cardiacTrend}
          hint="Lower = better adaptation"
        />
        <TrendStat
          label="HR Drift"
          value={latest.hrDriftPercent !== null ? `${latest.hrDriftPercent.toFixed(1)}%` : '—'}
          trend={driftTrend}
          hint="Lower = more stable"
        />
        <TrendStat
          label="RPE"
          value={latest.rpe !== null ? `${latest.rpe}/20` : '—'}
          trend={rpeTrend}
          hint="Lower = less effort"
        />
        <TrendStat
          label="Sweat Rate"
          value={latest.sweatRate_L_h !== null ? `${latest.sweatRate_L_h.toFixed(3)} L/h` : '—'}
          trend={sweatTrend}
          hint="Increasing = better thermoreg."
        />
      </div>

      {chartData.some(d => d.score !== null) && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-3">Heat Adaptation Score Over Time</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="session" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                <Tooltip
                  formatter={(val: number) => [`${val}`, 'Score']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) return payload[0].payload.date;
                    return label;
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} name="Adaptation Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.some(d => d.hrDrift !== null) && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-3">HR Drift % — Target: Below 3%</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="session" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                <YAxis tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                <Tooltip
                  formatter={(val: number) => [`${val}%`, 'HR Drift']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) return payload[0].payload.date;
                    return label;
                  }}
                />
                <Line type="monotone" dataKey="hrDrift" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} name="HR Drift %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.some(d => d.cardiacLoad !== null) && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-3">Heat Cardiac Load — Decreasing = Positive Adaptation</h4>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="session" tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                <YAxis tick={{ fontSize: 11, fontFamily: 'inherit' }} />
                <Tooltip
                  formatter={(val: number) => [val.toFixed(4), 'Cardiac Load']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) return payload[0].payload.date;
                    return label;
                  }}
                />
                <Line type="monotone" dataKey="cardiacLoad" stroke="#14b8a6" strokeWidth={2} dot={{ r: 4 }} name="Cardiac Load" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-3">Session History</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Temp</th>
                <th className="px-3 py-2 text-right">HR avg</th>
                <th className="px-3 py-2 text-right">HR Drift</th>
                <th className="px-3 py-2 text-right">Corrected</th>
                <th className="px-3 py-2 text-right">Cardiac Load</th>
                <th className="px-3 py-2 text-right">Sweat Rate</th>
                <th className="px-3 py-2 text-right">RPE</th>
                <th className="px-3 py-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{h.date}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{h.temperature_c}°C</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{h.avgHR ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{h.hrDriftPercent !== null ? `${h.hrDriftPercent.toFixed(1)}%` : '—'}</td>
                  <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">{h.correctedDriftPercent !== null ? `${h.correctedDriftPercent.toFixed(1)}%` : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{h.heatCardiacLoad !== null ? h.heatCardiacLoad.toFixed(4) : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{h.sweatRate_L_h !== null ? `${h.sweatRate_L_h.toFixed(3)} L/h` : '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{h.rpe ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-orange-600 dark:text-orange-400">{h.heatAdaptationScore !== null ? h.heatAdaptationScore.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrendStat({ label, value, trend, hint }: { label: string; value: string; trend: { symbol: string; color: string }; hint: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">{label}</p>
      <div className="flex items-center gap-1">
        <span className="text-lg font-bold text-gray-900 dark:text-white">{value}</span>
        <span className={`text-lg font-bold ${trend.color}`}>{trend.symbol}</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-body">{hint}</p>
    </div>
  );
}
