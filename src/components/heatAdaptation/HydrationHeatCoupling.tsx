import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import {
  CouplingAnalysis,
  getCorrelationBg,
  getSensitivityBg,
  getLimiterBg,
  getToleranceBg,
} from '../../lib/hydrationHeatCoupling';

interface Props {
  analysis: CouplingAnalysis;
}

export default function HydrationHeatCoupling({ analysis }: Props) {
  const { dataPoints, heatAdaptationSummary: adapt } = analysis;

  const scatterData = dataPoints.map(d => ({
    x: d.percentDehydration,
    y: d.hrDrift,
    date: d.date,
    limiter: d.limitingFactor,
  }));

  const correctedScatterData = dataPoints
    .filter(d => d.correctedDrift !== null)
    .map(d => ({
      x: d.percentDehydration,
      y: d.correctedDrift!,
      date: d.date,
    }));

  if (analysis.correlation === 'Insufficient Data') {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-body text-sm font-medium">Insufficient data for coupling analysis</p>
        <p className="text-gray-400 dark:text-gray-500 font-body text-xs mt-1 max-w-sm mx-auto">
          {analysis.recommendation}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">Drift Correlation</p>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold font-body ${getCorrelationBg(analysis.correlation)}`}>
            {analysis.correlation}
          </span>
          <p className="text-xs text-gray-400 mt-1 font-body">Dehydration ↔ HR Drift</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">Sensitivity</p>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold font-body ${getSensitivityBg(analysis.performanceSensitivity)}`}>
            {analysis.performanceSensitivity}
          </span>
          <p className="text-xs text-gray-400 mt-1 font-body">Performance impact</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">Limiting Factor</p>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold font-body ${getLimiterBg(analysis.primaryLimitingFactor)}`}>
            {analysis.primaryLimitingFactor}
          </span>
          <p className="text-xs text-gray-400 mt-1 font-body">Primary driver of drift</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">Heat Tolerance</p>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold font-body ${getToleranceBg(adapt.heatToleranceClassification)}`}>
            {adapt.heatToleranceClassification}
          </span>
          <p className="text-xs text-gray-400 mt-1 font-body">
            {adapt.trend !== 'insufficient' ? `Trend: ${adapt.trend}` : 'Need more sessions'}
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-blue-800 dark:text-blue-300 font-body leading-relaxed">{analysis.recommendation}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-2">HR Drift at Optimal Hydration (≤1.5%)</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {analysis.avgDriftAtOptimalHydration !== null ? `${analysis.avgDriftAtOptimalHydration.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-body mt-1">avg drift when well-hydrated</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-2">HR Drift at Suboptimal Hydration ({'>'}2%)</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {analysis.avgDriftAtSuboptimalHydration !== null ? `${analysis.avgDriftAtSuboptimalHydration.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-body mt-1">avg drift when dehydrated</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-2">Est. Performance Decay</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {analysis.performanceDecayEstimate !== null ? `${analysis.performanceDecayEstimate.toFixed(1)}%` : '—'}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-body mt-1">estimated under typical heat conditions</p>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-2">Corrected Drift Formula</h4>
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4 font-mono text-sm text-gray-700 dark:text-gray-300">
          <p>Corrected Drift = HR Drift / (1 + %Dehydration × 0.2)</p>
          <p className="text-xs text-gray-400 mt-2 font-body font-normal">
            If corrected drift is high → problem is aerobic capacity.
            If corrected drift is low → dehydration was the primary driver.
          </p>
        </div>
      </div>

      {scatterData.length >= 3 && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-3">
            Dehydration vs HR Drift — Raw (orange) & Corrected (blue)
          </h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="x"
                  name="% Dehydration"
                  type="number"
                  label={{ value: '% Dehydration', position: 'bottom', offset: 0, fontSize: 11 }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  dataKey="y"
                  name="HR Drift %"
                  label={{ value: 'HR Drift %', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)}%`,
                    name === 'x' ? '% Dehydration' : 'HR Drift %'
                  ]}
                />
                <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Stable (3%)', fontSize: 10, fill: '#22c55e' }} />
                <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'High Stress (5%)', fontSize: 10, fill: '#ef4444' }} />
                <Scatter data={scatterData} fill="#f97316" name="Raw Drift" opacity={0.85} />
                {correctedScatterData.length >= 2 && (
                  <Scatter data={correctedScatterData} fill="#3b82f6" name="Corrected Drift" opacity={0.7} />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-xs font-body text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />Raw HR Drift</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" />Corrected for Hydration</span>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-3">Session-by-Session Coupling Detail</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-right">Temp</th>
                <th className="px-3 py-2 text-right">%Dehyd</th>
                <th className="px-3 py-2 text-right">HR Drift</th>
                <th className="px-3 py-2 text-right">Corrected</th>
                <th className="px-3 py-2 text-right">Drift Reduction</th>
                <th className="px-3 py-2 text-center">Limiter</th>
              </tr>
            </thead>
            <tbody>
              {[...dataPoints].reverse().map((d, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{d.date}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{d.temperature_c}°C</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{d.percentDehydration.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-medium text-orange-600 dark:text-orange-400">{d.hrDrift.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right font-medium text-blue-600 dark:text-blue-400">
                    {d.correctedDrift !== null ? `${d.correctedDrift.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">
                    {d.driftReduction !== null
                      ? <span className={d.driftReduction > 0 ? 'text-red-500' : 'text-gray-400'}>{d.driftReduction > 0 ? `+${d.driftReduction.toFixed(1)}%` : '—'}</span>
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getLimiterBg(d.limitingFactor)}`}>
                      {d.limitingFactor}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide font-body mb-3">Heat Adaptation Profile Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-xs text-gray-400 font-body">Adaptation Score</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white font-body">
              {adapt.score !== null ? `${adapt.score.toFixed(1)}/100` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-body">Score Trend</p>
            <p className={`text-lg font-bold font-body capitalize ${
              adapt.trend === 'improving' ? 'text-green-600 dark:text-green-400'
              : adapt.trend === 'declining' ? 'text-red-600 dark:text-red-400'
              : 'text-gray-600 dark:text-gray-400'
            }`}>{adapt.trend}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-body">Avg HR Drift (Heat)</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white font-body">
              {adapt.avgHRDrift_hot_sessions !== null ? `${adapt.avgHRDrift_hot_sessions.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-body">Avg Sweat Rate</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white font-body">
              {adapt.avgSweatRate_L_h !== null ? `${adapt.avgSweatRate_L_h.toFixed(3)} L/h` : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
