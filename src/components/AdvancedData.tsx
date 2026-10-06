import { useState, useMemo } from 'react';
import { TestDataPoint, AdvancedMetrics } from '../types';
import { PhysiologyResults, computeStageHRFromTimeline, interpolateHRAtLoad, computeHRLoadRegression, STAGE_HR_WINDOW_S, type TimelineHRSample, type StageHRResult } from '../lib/physiology';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ReferenceLine, BarChart, Bar, ReferenceDot
} from 'recharts';

interface AdvancedDataProps {
  dataPoints: TestDataPoint[];
  results: PhysiologyResults;
  advancedMetrics?: AdvancedMetrics | null;
  timelineSamples?: TimelineHRSample[] | null;
}

type Tab = 'charts' | 'energy' | 'economy' | 'recovery' | 'anaerobic' | 'rawdata';

const TABS: { id: Tab; label: string }[] = [
  { id: 'charts', label: 'Charts' },
  { id: 'energy', label: 'Energy Profile' },
  { id: 'economy', label: 'Economy' },
  { id: 'recovery', label: 'Recovery' },
  { id: 'anaerobic', label: 'Anaerobic Test' },
  { id: 'rawdata', label: 'Raw Data' },
];

const tooltipStyle = {
  backgroundColor: 'rgba(255,255,255,0.97)',
  border: '1px solid #e5e7eb',
  borderRadius: '0.5rem',
  color: '#1f2937',
  fontSize: '13px',
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D7B] px-6 py-4">
        <h4 className="text-lg font-semibold text-white">{title}</h4>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function MetricTile({
  label, value, unit, note
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  note?: string;
}) {
  const hasValue = value !== null && value !== undefined && value !== '';
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {hasValue ? value : '—'}
        {hasValue && unit && (
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span>
        )}
      </p>
      {note && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{note}</p>}
    </div>
  );
}

export default function AdvancedData({ dataPoints, results, advancedMetrics, timelineSamples }: AdvancedDataProps) {
  const [activeTab, setActiveTab] = useState<Tab>('charts');
  const sorted = [...dataPoints].sort((a, b) => a.stage_number - b.stage_number);

  // Compute per-stage HR from timeline samples (last 30s window)
  const stageHR: StageHRResult[] = useMemo(() => {
    if (!timelineSamples || timelineSamples.length === 0) return [];
    return computeStageHRFromTimeline(sorted, timelineSamples, STAGE_HR_WINDOW_S);
  }, [sorted, timelineSamples]);

  // Determine which HR values to use: prefer timeline-derived last-30s HR, fall back to dataPoints HR
  const effectiveHR: number[] = useMemo(() => {
    if (stageHR.length === sorted.length && stageHR.some(s => s.hr_last_window != null)) {
      return sorted.map((_, i) => stageHR[i]?.hr_last_window ?? sorted[i].heart_rate);
    }
    return sorted.map(p => p.heart_rate);
  }, [sorted, stageHR]);

  // HR max for reference line
  const hrMax = useMemo(() => {
    const fromTimeline = stageHR.find(s => s.hr_max != null);
    if (fromTimeline?.hr_max) return fromTimeline.hr_max;
    return Math.max(...sorted.map(p => p.heart_rate));
  }, [sorted, stageHR]);

  // HR–load regression
  const loadUnit = results.has_power ? 'W' : 'km/h';
  const hrRegression = useMemo(() => {
    const loadValues = sorted.map(p => results.has_power ? (p.power_watts ?? 0) : 0);
    if (!results.has_power) return null;
    const validPairs = loadValues.map((load, i) => ({ load, hr: effectiveHR[i] })).filter(p => p.load > 0 && p.hr > 0);
    if (validPairs.length < 3) return null;
    return computeHRLoadRegression(validPairs.map(p => p.load), validPairs.map(p => p.hr), loadUnit);
  }, [sorted, effectiveHR, results.has_power]);

  // Interpolated HR at thresholds
  const hrAtLT1 = useMemo(() => {
    if (!results.has_power || !results.lt1_power) return null;
    const loads = sorted.map(p => p.power_watts ?? 0).filter(v => v > 0);
    if (loads.length < 2) return null;
    return interpolateHRAtLoad(loads, effectiveHR, results.lt1_power);
  }, [sorted, effectiveHR, results]);

  const hrAtLT2 = useMemo(() => {
    if (!results.has_power || !results.lt2_power) return null;
    const loads = sorted.map(p => p.power_watts ?? 0).filter(v => v > 0);
    if (loads.length < 2) return null;
    return interpolateHRAtLoad(loads, effectiveHR, results.lt2_power);
  }, [sorted, effectiveHR, results]);

  const hasTimelineHR = stageHR.length > 0 && stageHR.some(s => s.hr_last_window != null);
  const hasShortStages = stageHR.some(s => s.short_stage && s.hr_last_window != null);

  const chartData = sorted.map((p, i) => ({
    stage: p.stage_number,
    hr: effectiveHR[i] ?? p.heart_rate,
    hr_timeline: stageHR[i]?.hr_last_window ?? null,
    power: p.power_watts ?? null,
    lactate: p.lactate ?? null,
    vo2: p.vo2_ml_kg_min ?? null,
    rpe: p.rpe ?? null,
    rer: advancedMetrics?.energyProfile.rer_vs_stage[i] ?? null,
    fat_pct: advancedMetrics?.energyProfile.percent_fat_vs_stage[i] ?? null,
    carb_pct: advancedMetrics?.energyProfile.percent_carb_vs_stage[i] ?? null,
  }));

  const hasPower = results.has_power || sorted.some(p => p.power_watts != null);
  const hasVO2 = results.has_vo2;
  const hasLactate = results.has_lactate;
  const hasRpe = sorted.some(p => p.rpe != null);
  const hasEnergyData = advancedMetrics?.energyProfile.rer_vs_stage.some(v => v !== null) ?? false;

  const hrLoadSection = hasPower ? (
    <SectionCard title="HR vs Power">
      {hasTimelineHR && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          HR per stage uses the mean of the last {STAGE_HR_WINDOW_S}s of each stage (from timeline data).
          {hasShortStages && ' Some stages were shorter than the window — full stage used.'}
        </p>
      )}
      {!hasTimelineHR && (
        <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
          Timeline samples are not available for this test, so HR uses the recorded value for each complete stage.
        </p>
      )}
      {hrRegression && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          HR–Load slope: <strong className="text-gray-700 dark:text-gray-300">{hrRegression.slope} bpm/{hrRegression.unit}</strong>
          {' · R² = '}<strong className="text-gray-700 dark:text-gray-300">{hrRegression.r_squared}</strong>
        </p>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="stage" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="power" stroke="#f97316" strokeWidth={2} name="Power (W)" dot={{ r: 4, fill: '#f97316' }} />
          <Line type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} name="HR (bpm)" dot={{ r: 4, fill: '#ef4444' }} />
          {hrAtLT1 != null && results.lt1_power != null && (
            <ReferenceDot
              x={sorted.findIndex(p => p.power_watts === results.lt1_power) >= 0 ? sorted[sorted.findIndex(p => p.power_watts === results.lt1_power)].stage_number : sorted[0].stage_number}
              y={hrAtLT1}
              r={6}
              fill="#f59e0b"
              stroke="#fff"
              strokeWidth={1.5}
              label={{ value: 'LT1', fill: '#f59e0b', fontSize: 11, position: 'top' }}
            />
          )}
          {hrAtLT2 != null && results.lt2_power != null && (
            <ReferenceDot
              x={sorted.findIndex(p => p.power_watts === results.lt2_power) >= 0 ? sorted[sorted.findIndex(p => p.power_watts === results.lt2_power)].stage_number : sorted[sorted.length - 1].stage_number}
              y={hrAtLT2}
              r={6}
              fill="#dc2626"
              stroke="#fff"
              strokeWidth={1.5}
              label={{ value: 'LT2', fill: '#dc2626', fontSize: 11, position: 'top' }}
            />
          )}
          <ReferenceLine y={hrMax} stroke="#ef4444" strokeDasharray="2 4" strokeOpacity={0.4}
            label={{ value: `HR max ${hrMax}`, fill: '#ef4444', fontSize: 10, position: 'right' }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
        HR lags behind load in short stages — the last-30s window helps capture steady-state HR.
      </p>
    </SectionCard>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D7B] rounded-lg p-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-white">Advanced Analysis</h3>
      </div>

      {hrLoadSection}

      <div className="flex gap-1 flex-wrap border-b border-gray-200 dark:border-gray-700">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[#6B5D7B] text-[#5A4E6B] dark:text-[#c4b8d4] bg-[#6B5D7B]/5 dark:bg-[#6B5D7B]/10'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'charts' && (
        <div className="space-y-6">
          {hasVO2 && hasPower && (
            <SectionCard title="VO₂ vs Power">
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="power" type="number" name="Power (W)"
                    label={{ value: 'Power (W)', position: 'insideBottom', offset: -5 }} stroke="#9ca3af" />
                  <YAxis dataKey="vo2" type="number" name="VO₂"
                    label={{ value: 'VO₂ (ml/kg/min)', angle: -90, position: 'insideLeft' }} stroke="#9ca3af" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Scatter data={chartData.filter(d => d.power && d.vo2)} fill="#3b82f6"
                    line={{ stroke: '#3b82f6', strokeWidth: 2 }} />
                </ScatterChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {hasLactate && (
            <SectionCard title="Lactate Curve">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey={hasPower ? 'power' : 'stage'} type="number"
                    name={hasPower ? 'Power (W)' : 'Stage'}
                    label={{ value: hasPower ? 'Power (W)' : 'Stage', position: 'insideBottom', offset: -5 }}
                    stroke="#9ca3af" />
                  <YAxis dataKey="lactate" type="number" name="Lactate"
                    label={{ value: 'Lactate (mmol/L)', angle: -90, position: 'insideLeft' }} stroke="#9ca3af" />
                  <ReferenceLine y={2} stroke="#f59e0b" strokeDasharray="4 4"
                    label={{ value: 'LT1 ~2', fill: '#f59e0b', fontSize: 11 }} />
                  <ReferenceLine y={4} stroke="#ef4444" strokeDasharray="4 4"
                    label={{ value: 'LT2 ~4', fill: '#ef4444', fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Scatter data={chartData.filter(d => d.lactate != null)} fill="#ef4444"
                    line={{ stroke: '#ef4444', strokeWidth: 2 }} />
                </ScatterChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {hasRpe && (
            <SectionCard title="RPE vs Stage">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Borg Scale 1–10</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="stage" stroke="#9ca3af" />
                  <YAxis domain={[0, 10]} stroke="#9ca3af" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="rpe" stroke="#10b981" strokeWidth={2} name="RPE"
                    dot={{ r: 4, fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {hasVO2 && hasPower && (
            <SectionCard title="Estimated Fat Oxidation vs Power">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Estimated from VO₂ and intensity. Peak at ~40–60% VO₂max.
              </p>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="stage" stroke="#9ca3af" />
                  <YAxis domain={[0, 100]} stroke="#9ca3af" unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="fat_pct" stroke="#f59e0b" strokeWidth={2}
                    name="% Fat" dot={{ r: 4, fill: '#f59e0b' }} />
                  <Line type="monotone" dataKey="carb_pct" stroke="#3b82f6" strokeWidth={2}
                    name="% Carbohydrates" dot={{ r: 4, fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>
      )}

      {activeTab === 'energy' && (
        <div className="space-y-6">
          {hasEnergyData ? (
            <>
              <SectionCard title="RER per Stage (Estimated from VO₂)">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Estimated Respiratory Exchange Ratio. RER 0.70 = 100% fat · RER 1.0 = 100% carbohydrates.
                  Yellow line = substrate crossover threshold (RER 0.85)
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="stage" stroke="#9ca3af" />
                    <YAxis domain={[0.65, 1.05]} stroke="#9ca3af" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => v?.toFixed(3)} />
                    <ReferenceLine y={0.85} stroke="#f59e0b" strokeDasharray="4 4"
                      label={{ value: 'RER 0.85', fill: '#f59e0b', fontSize: 11 }} />
                    <ReferenceLine y={1.0} stroke="#ef4444" strokeDasharray="4 4"
                      label={{ value: 'RER 1.0', fill: '#ef4444', fontSize: 11 }} />
                    <Line type="monotone" dataKey="rer" stroke="#14b8a6" strokeWidth={2} name="RER"
                      dot={{ r: 4, fill: '#14b8a6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </SectionCard>

              <SectionCard title="% Energy by Substrate vs Stage">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Estimated distribution of fat and carbohydrates as energy source per stage
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="stage" stroke="#9ca3af" />
                    <YAxis domain={[0, 100]} stroke="#9ca3af" unit="%" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                    <Legend />
                    <Bar dataKey="fat_pct" name="Fat %" fill="#f59e0b" stackId="a" />
                    <Bar dataKey="carb_pct" name="Carbohydrates %" fill="#3b82f6" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </SectionCard>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {chartData.filter(d => d.fat_pct !== null).map(d => (
                  <div key={d.stage} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Stage {d.stage}</p>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{d.fat_pct}% fat</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{d.carb_pct}% CHO</p>
                    <p className="text-xs text-gray-400 mt-1">RER {d.rer?.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <p className="font-medium">No VO₂ data available to calculate energy profile.</p>
              <p className="text-sm mt-2">Enter VO₂ measurements per stage to see this module.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'economy' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard title="Movement Economy — Cycling">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <MetricTile
                  label="W/kg Lean Mass"
                  value={advancedMetrics?.movementEconomy.cycling.watts_per_kg_lbm?.toFixed(2)}
                  unit="W/kg LBM"
                  note="Power relative to lean body mass"
                />
                <MetricTile
                  label="Mechanical Efficiency"
                  value={advancedMetrics?.movementEconomy.cycling.efficiency_percent?.toFixed(1)}
                  unit="%"
                  note="Useful work / energy consumed"
                />
              </div>
              {!advancedMetrics?.movementEconomy.cycling.watts_per_kg_lbm && (
                <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                  Requires: power data + body fat % (sport: cycling)
                </p>
              )}
              <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Reference:</strong> Elite cyclists: 5–6 W/kg LBM · Normal mechanical efficiency: 20–26%
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Movement Economy — Running">
              <div className="flex justify-center mb-4">
                <MetricTile
                  label="Energy Cost"
                  value={advancedMetrics?.movementEconomy.running.cost_per_km_ml_o2_kg?.toFixed(0)}
                  unit="ml O₂/kg/km"
                  note="Lower value = more economical"
                />
              </div>
              {!advancedMetrics?.movementEconomy.running.cost_per_km_ml_o2_kg && (
                <p className="text-xs text-center text-gray-400 dark:text-gray-500">
                  Requires: VO₂ data + speed (sport: running)
                </p>
              )}
              <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>Reference:</strong> Elite: ~180–210 ml O₂/kg/km · Recreational: ~220–260 ml O₂/kg/km
                </p>
              </div>
            </SectionCard>
          </div>

          {hasPower && hasVO2 && (
            <SectionCard title="Submaximal VO₂ vs Power — Delta Efficiency">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                The slope of this curve reflects metabolic efficiency. Greater curvature = worse economy.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="power" type="number" name="Power"
                    label={{ value: 'Power (W)', position: 'insideBottom', offset: -5 }} stroke="#9ca3af" />
                  <YAxis dataKey="vo2" type="number" name="VO₂"
                    label={{ value: 'VO₂ (ml/kg/min)', angle: -90, position: 'insideLeft' }} stroke="#9ca3af" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Scatter data={chartData.filter(d => d.power && d.vo2)} fill="#14b8a6"
                    line={{ stroke: '#14b8a6', strokeWidth: 2 }} />
                </ScatterChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>
      )}

      {activeTab === 'recovery' && (
        <div className="space-y-6">
          <SectionCard title="Post-Test Recovery Metrics">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              HR Drift is calculated automatically from the test. HRV, HR return, and lactate clearance
              must be recorded manually post-exercise.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricTile
                label="HRV Post-Exercise"
                value={advancedMetrics?.recovery.hrv_post_exercise_ms}
                unit="ms"
                note="Higher = better recovery"
              />
              <MetricTile
                label="HR Return to Baseline"
                value={advancedMetrics?.recovery.time_to_hr_baseline_min}
                unit="min"
                note="Lower = better aerobic fitness"
              />
              <MetricTile
                label="HR Drift"
                value={
                  results.hr_drift_percent != null
                    ? `${results.hr_drift_percent > 0 ? '+' : ''}${results.hr_drift_percent}`
                    : null
                }
                unit="%"
                note="Calculated from test"
              />
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Lactate Clearance</p>
                {advancedMetrics?.recovery.lactate_clearance.min5 ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">5 min</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {advancedMetrics.recovery.lactate_clearance.min5} mmol/L
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">10 min</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {advancedMetrics.recovery.lactate_clearance.min10 ?? '—'} mmol/L
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">20 min</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {advancedMetrics.recovery.lactate_clearance.min20 ?? '—'} mmol/L
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">No data</p>
                )}
              </div>
            </div>
          </SectionCard>

          {results.hr_drift_percent !== null && (
            <SectionCard title="HR vs Stage — Drift Analysis">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                HR Drift detected:{' '}
                <strong className={Math.abs(results.hr_drift_percent) >= 5 ? 'text-orange-500' : 'text-green-600'}>
                  {results.hr_drift_percent > 0 ? '+' : ''}{results.hr_drift_percent}%
                </strong>
                {' · '}
                {Math.abs(results.hr_drift_percent) < 5
                  ? 'Good cardiovascular durability'
                  : 'Significant drift — possible dehydration or thermal fatigue'}
              </p>
              {hasTimelineHR && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  HR per stage from last {STAGE_HR_WINDOW_S}s of timeline data.
                </p>
              )}
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="stage" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="hr" stroke="#ef4444" strokeWidth={2} name="HR (bpm)"
                    dot={{ r: 4, fill: '#ef4444' }} />
                  {hasTimelineHR && (
                    <Line type="monotone" dataKey="hr_timeline" stroke="#f59e0b" strokeWidth={2}
                      name="HR last-30s (bpm)" dot={{ r: 3, fill: '#f59e0b' }}
                      strokeDasharray="5 3" connectNulls />
                  )}
                  <ReferenceLine y={hrMax} stroke="#ef4444" strokeDasharray="2 4" strokeOpacity={0.4}
                    label={{ value: `HR max ${hrMax}`, fill: '#ef4444', fontSize: 10, position: 'right' }} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Post-test measurement protocol</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc pl-4">
              <li><strong>HRV:</strong> Record 5–10 min post-test with HRV device at rest</li>
              <li><strong>HR return:</strong> Time until HR drops below 100 bpm</li>
              <li><strong>Lactate clearance:</strong> Capillary samples at 5, 10 and 20 min post-test</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'anaerobic' && (
        <div className="space-y-6">
          <SectionCard title="Anaerobic Test / Sprint (5–30 sec)">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Sprint or Wingate test data. Entered separately from the incremental test.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricTile
                label="Peak Power"
                value={advancedMetrics?.anaerobicTest.peak_power_watts}
                unit="W"
                note="Sprint maximum"
              />
              <MetricTile
                label="Mean Power"
                value={advancedMetrics?.anaerobicTest.mean_power_watts}
                unit="W"
                note="Sprint average"
              />
              <MetricTile
                label="Fatigue Index"
                value={advancedMetrics?.anaerobicTest.fatigue_index_percent?.toFixed(1)}
                unit="%"
                note="Lower = better anaerobic endurance"
              />
              <MetricTile
                label="Test Duration"
                value={advancedMetrics?.anaerobicTest.test_duration_seconds}
                unit="sec"
                note="Sprint / Wingate"
              />
            </div>

            {advancedMetrics?.anaerobicTest.peak_power_watts && advancedMetrics?.anaerobicTest.mean_power_watts ? (
              <div className="mt-6">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { name: 'Peak Power', value: advancedMetrics.anaerobicTest.peak_power_watts },
                    { name: 'Mean Power', value: advancedMetrics.anaerobicTest.mean_power_watts },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" unit=" W" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">No anaerobic test data recorded.</p>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Aerobic / Anaerobic Capacity Relationship">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricTile
                label="VO₂max"
                value={results.vo2max?.toFixed(1)}
                unit="ml/kg/min"
                note="Aerobic capacity"
              />
              <MetricTile
                label="MAP"
                value={results.pam_watts}
                unit="W"
                note="Maximal aerobic power"
              />
              <MetricTile
                label="Peak Sprint Power"
                value={advancedMetrics?.anaerobicTest.peak_power_watts}
                unit="W"
                note="Peak anaerobic power"
              />
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === 'rawdata' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D7B] px-6 py-4">
            <h4 className="text-lg font-semibold text-white">Raw Data Table</h4>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Stage summary</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Calculated values for each completed stage.</p>
                </div>
                {timelineSamples && timelineSamples.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                    {timelineSamples.length} timeline samples
                  </span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Stage</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Dur (s)</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">HR (bpm)</th>
                  {hasTimelineHR && <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">HR last-{STAGE_HR_WINDOW_S}s</th>}
                  {hasTimelineHR && <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">HR max</th>}
                  {hasPower && <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Power (W)</th>}
                  {hasVO2 && <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">VO₂ (ml/kg/min)</th>}
                  {hasLactate && <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Lactate (mmol/L)</th>}
                  {hasRpe && <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">RPE</th>}
                  {hasEnergyData && <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">RER</th>}
                  {hasEnergyData && <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">% Fat</th>}
                  <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Markers</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((point, i) => (
                  <tr key={point.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-3 font-semibold text-gray-900 dark:text-white">{point.stage_number}</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{point.duration_seconds}</td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{point.heart_rate}</td>
                    {hasTimelineHR && (
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                        {stageHR[i]?.hr_last_window ?? '—'}
                        {stageHR[i]?.short_stage && stageHR[i]?.hr_last_window != null && (
                          <span className="ml-1 text-xs text-amber-500" title="Stage shorter than 30s window">⏱</span>
                        )}
                      </td>
                    )}
                    {hasTimelineHR && (
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{stageHR[i]?.hr_max ?? '—'}</td>
                    )}
                    {hasPower && <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{point.power_watts ? Math.round(point.power_watts) : '—'}</td>}
                    {hasVO2 && <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{point.vo2_ml_kg_min?.toFixed(1) ?? '—'}</td>}
                    {hasLactate && <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{point.lactate?.toFixed(1) ?? '—'}</td>}
                    {hasRpe && <td className="py-3 px-3 text-gray-700 dark:text-gray-300">{point.rpe ?? '—'}</td>}
                    {hasEnergyData && (
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                        {advancedMetrics?.energyProfile.rer_vs_stage[i]?.toFixed(3) ?? '—'}
                      </td>
                    )}
                    {hasEnergyData && (
                      <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                        {advancedMetrics?.energyProfile.percent_fat_vs_stage[i] != null
                          ? `${advancedMetrics.energyProfile.percent_fat_vs_stage[i]}%`
                          : '—'}
                      </td>
                    )}
                    <td className="py-3 px-3">
                      {point.vt1_marker && (
                        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium mr-1">VT1</span>
                      )}
                      {point.vt2_marker && (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">VT2</span>
                      )}
                      {!point.vt1_marker && !point.vt2_marker && <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            </div>

            {timelineSamples && timelineSamples.length > 0 ? (
              <div>
                <div className="mb-3">
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Timeline raw data</h5>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Timestamped samples saved for this test. These are the values used for the last-30-second HR analysis.</p>
                </div>
                <div className="max-h-[28rem] overflow-auto border border-gray-100 dark:border-gray-700 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300">Time (s)</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300">HR (bpm)</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300">Speed / pace</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300">Lactate</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300">RPE</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-700 dark:text-gray-300">VO₂</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timelineSamples.map((sample, index) => (
                        <tr key={`${sample.timestamp_s}-${index}`} className="border-t border-gray-100 dark:border-gray-700">
                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{sample.timestamp_s}</td>
                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{sample.heart_rate ?? '—'}</td>
                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{sample.speed_pace ?? '—'}</td>
                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{sample.lactate ?? '—'}</td>
                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{sample.rpe ?? '—'}</td>
                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{sample.vo2_ml_kg_min ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200">
                No timestamped timeline samples are saved for this test. Stage-level data is shown above, but last-30-second HR analysis cannot be calculated without timestamps.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
