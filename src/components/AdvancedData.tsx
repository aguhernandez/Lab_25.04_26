import { createContext, useContext, useMemo, useState } from 'react';
import { TestDataPoint, AdvancedMetrics, Sport } from '../types';
import { PhysiologyResults, computeStageHRFromTimeline, interpolateHRAtLoad, computeHRLoadRegression, STAGE_HR_WINDOW_S, type TimelineHRSample, type StageHRResult } from '../lib/physiology';
import { calculateMovementEconomy } from '../lib/movementEconomy';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ScatterChart, Scatter, ReferenceLine, BarChart, Bar, ReferenceDot
} from 'recharts';
import VLamaxPanel from './VLamaxPanel';
import LactateDynamicsPanel from './LactateDynamicsPanel';

type AnalysisSurface = 'results' | 'dashboard';

interface AdvancedDataProps {
  testId?: string;
  bodyMassKg?: number | null;
  leanBodyMassKg?: number | null;
  sport?: Sport;
  dataPoints: TestDataPoint[];
  results: PhysiologyResults;
  advancedMetrics?: AdvancedMetrics | null;
  timelineSamples?: TimelineHRSample[] | null;
  surface?: AnalysisSurface;
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

const AnalysisSurfaceContext = createContext<AnalysisSurface>('dashboard');

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  const surface = useContext(AnalysisSurfaceContext);
  if (surface === 'results') {
    return (
      <section className="border-t border-gray-200 pt-5 dark:border-gray-700">
        <div className="mb-4 flex items-center gap-3">
          <span className="h-7 w-1 bg-[#5A4E6B] dark:bg-[#c4b8d4]" />
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h4>
        </div>
        <div>{children}</div>
      </section>
    );
  }
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D7B] px-6 py-4">
        <h4 className="text-lg font-semibold text-white">{title}</h4>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function parseSpeedKmh(value: string | null | undefined, sport?: Sport): number | null {
  if (!value) return null;
  if (sport === 'other') {
    const unit = value.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*(km\/h|kmh|m\/s)$/i);
    if (!unit) return null;
    const speed = Number(unit[1].replace(',', '.'));
    return speed > 0 ? (unit[2].toLowerCase() === 'm/s' ? speed * 3.6 : speed) : null;
  }
  // Accept both a speed (12.5 km/h) and a running pace (5:00/km).
  const pace = value.match(/^(\d+):([0-5]\d)(?:\.([0-9]+))?\s*(?:\/\s*(km|100\s*m))?$/i);
  if (pace) {
    const minutes = Number(pace[1]) + Number(`${pace[2]}.${pace[3] ?? '0'}`) / 60;
    if (minutes <= 0) return null;
    return sport === 'swimming' || pace[4]?.replace(/\s/g, '').toLowerCase() === '100m'
      ? 6 / minutes
      : 60 / minutes;
  }
  const match = value.match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}

function MetricTile({ 
  label, value, unit, note
}: {
  label: string;
  value: string | number | null | undefined;
  unit?: string;
  note?: string;
}) {
  const surface = useContext(AnalysisSurfaceContext);
  const hasValue = value !== null && value !== undefined && value !== '';
  return (
    <div className={surface === 'results' ? 'border-l border-gray-200 px-3 text-left first:border-l-0 dark:border-gray-700' : 'bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center'}>
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

export default function AdvancedData({ testId, bodyMassKg, leanBodyMassKg, sport, dataPoints, results, advancedMetrics, timelineSamples, surface = 'dashboard' }: AdvancedDataProps) {
  const [activeTab, setActiveTab] = useState<Tab>('charts');
  const [selectedStage, setSelectedStage] = useState<number | null>(null);
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
  const hasPower = results.has_power || sorted.some(p => p.power_watts != null);
  const hasSpeed = sorted.some(p => parseSpeedKmh(p.speed_pace, sport) != null);
  const hasLoad = hasPower || hasSpeed;
  const loadUnit = hasPower ? 'W' : 'km/h';
  const hrRegression = useMemo(() => {
    if (!hasLoad) return null;
    const loadValues = sorted.map(p => hasPower ? (p.power_watts ?? 0) : (parseSpeedKmh(p.speed_pace, sport) ?? 0));
    const validPairs = loadValues.map((load, i) => ({ load, hr: effectiveHR[i] })).filter(p => p.load > 0 && p.hr > 0);
    if (validPairs.length < 3) return null;
    return computeHRLoadRegression(validPairs.map(p => p.load), validPairs.map(p => p.hr), loadUnit);
  }, [sorted, effectiveHR, hasLoad, hasPower, loadUnit, sport]);

  // Interpolated HR at thresholds
  const hrAtLT1 = useMemo(() => {
    if (!hasPower || !results.lt1_power) return null;
    const loads = sorted.map(p => p.power_watts ?? 0).filter(v => v > 0);
    if (loads.length < 2) return null;
    return interpolateHRAtLoad(loads, effectiveHR, results.lt1_power);
  }, [sorted, effectiveHR, hasPower, results.lt1_power]);

  const hrAtLT2 = useMemo(() => {
    if (!hasPower || !results.lt2_power) return null;
    const loads = sorted.map(p => p.power_watts ?? 0).filter(v => v > 0);
    if (loads.length < 2) return null;
    return interpolateHRAtLoad(loads, effectiveHR, results.lt2_power);
  }, [sorted, effectiveHR, hasPower, results.lt2_power]);

  const hasTimelineHR = stageHR.length > 0 && stageHR.some(s => s.hr_last_window != null);
  const hasShortStages = stageHR.some(s => s.short_stage && s.hr_last_window != null);

  const chartData = sorted.map((p, i) => ({
    stage: p.stage_number,
    hr: effectiveHR[i] ?? p.heart_rate,
    hr_timeline: stageHR[i]?.hr_last_window ?? null,
    power: p.power_watts ?? null,
    load: hasPower ? (p.power_watts ?? null) : parseSpeedKmh(p.speed_pace, sport),
    lactate: p.lactate ?? null,
    vo2: p.vo2_ml_kg_min ?? null,
    rpe: p.rpe ?? null,
    rer: advancedMetrics?.energyProfile.rer_vs_stage[i] ?? null,
    fat_pct: advancedMetrics?.energyProfile.percent_fat_vs_stage[i] ?? null,
    carb_pct: advancedMetrics?.energyProfile.percent_carb_vs_stage[i] ?? null,
  }));
  const selectedPoint = selectedStage == null ? null : chartData.find(point => point.stage === selectedStage) ?? null;
  const selectChartPoint = (event: any) => {
    const point = event?.activePayload?.[0]?.payload;
    if (point?.stage != null) setSelectedStage(Number(point.stage));
    else if (point?.load != null) {
      const closest = chartData.reduce((best, candidate) => Math.abs(Number(candidate.load) - Number(point.load)) < Math.abs(Number(best.load) - Number(point.load)) ? candidate : best, chartData[0]);
      if (closest) setSelectedStage(closest.stage);
    }
  };

  const lactatePoints = chartData.filter(d => d.lactate != null && d.load != null);
  const lactateCurve = results.lactate_analysis?.curve.map(point => ({
    load: point.load,
    measured: point.measured,
    smoothed: point.smoothed,
  })) ?? lactatePoints.map(point => ({ load: Number(point.load), measured: Number(point.lactate), smoothed: Number(point.lactate) }));
  const lt1Point = results.lactate_analysis?.lt1 ?? null;
  const lt2Point = results.lactate_analysis?.lt2 ?? null;

  const hasVO2 = results.has_vo2;
  const hasLactate = results.has_lactate;
  const hasRpe = sorted.some(p => p.rpe != null);
  const hasEnergyData = advancedMetrics?.energyProfile.rer_vs_stage.some(v => v !== null) ?? false;
  const economySport: Sport = sport ?? (hasPower ? 'cycling' : hasSpeed ? 'running' : 'other');
  const economyMode = economySport === 'triathlon'
    ? (hasPower ? 'cycling' : sorted.some(point => /\/\s*100\s*m\b/i.test(point.speed_pace ?? '')) ? 'swimming' : 'running')
    : economySport;
  const measuredVO2Peak = sorted.reduce((peak, point) => Math.max(peak, point.vo2_ml_kg_min ?? 0), 0);
  const economyChartData = sorted
    .filter(point => point.vo2_ml_kg_min != null
      && point.duration_seconds >= 120
      && measuredVO2Peak > 0
      && point.vo2_ml_kg_min <= measuredVO2Peak * 0.85)
    .map(point => ({
      stage: point.stage_number,
      load: economyMode === 'cycling' || (economyMode === 'other' && hasPower)
        ? point.power_watts ?? null
        : parseSpeedKmh(point.speed_pace, economyMode === 'swimming' ? 'swimming' : economyMode === 'other' ? 'other' : 'running'),
      vo2: point.vo2_ml_kg_min,
    }))
    .filter(point => point.load != null && point.load > 0);
  const economyLoadLabel = economyMode === 'cycling' || (economyMode === 'other' && hasPower)
    ? 'Potencia (W)'
    : 'Velocidad (km/h)';
  const freshEconomy = calculateMovementEconomy(
    sorted,
    economySport,
    bodyMassKg,
    leanBodyMassKg,
    measuredVO2Peak || null,
  );
  const economyMetrics = {
    ...freshEconomy,
    cycling: {
      ...freshEconomy.cycling,
      watts_per_kg_lbm: freshEconomy.cycling.watts_per_kg_lbm ?? advancedMetrics?.movementEconomy?.cycling?.watts_per_kg_lbm ?? null,
    },
  };

  const hrLoadSection = hasLoad ? (
    <SectionCard title={`HR vs ${hasPower ? 'Power' : 'Speed'}`}>
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
        <LineChart data={chartData} onClick={selectChartPoint}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="stage" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend />
          <Line type="monotone" dataKey="load" stroke="#f97316" strokeWidth={2} name={hasPower ? 'Power (W)' : 'Speed (km/h)'} dot={{ r: 4, fill: '#f97316' }} />
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
    <AnalysisSurfaceContext.Provider value={surface}>
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

      {surface === 'results' && selectedPoint && (
        <div className="grid grid-cols-2 gap-y-3 border-y border-gray-200 py-3 text-sm sm:grid-cols-5 dark:border-gray-700">
          <Reading label="Etapa" value={selectedPoint.stage} />
          <Reading label={hasPower ? 'Potencia' : 'Velocidad'} value={selectedPoint.load ?? '—'} unit={hasPower ? 'W' : 'km/h'} />
          <Reading label="FC" value={selectedPoint.hr ?? '—'} unit="bpm" />
          <Reading label="Lactato" value={selectedPoint.lactate ?? '—'} unit="mmol/L" />
          <Reading label="VO₂" value={selectedPoint.vo2 ?? '—'} unit="ml/kg/min" />
        </div>
      )}

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
              {results.lactate_analysis && (
                <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${results.lactate_analysis.quality.validForThresholds ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'}`}>
                  <strong>Data quality: {results.lactate_analysis.quality.grade} ({results.lactate_analysis.quality.score}/100)</strong>
                  {' · '}{results.lactate_analysis.quality.sampleCount} samples · {results.lactate_analysis.quality.monotonicityPercent}% monotonic · load {results.lactate_analysis.quality.loadMonotonic ? 'valid' : 'invalid'}
                  {results.lactate_analysis.quality.issues.length > 0 && (
                    <ul className="mt-1 list-disc pl-4">
                      {results.lactate_analysis.quality.issues.map(issue => <li key={`${issue.code}-${issue.stage ?? 'all'}`}>{issue.message}</li>)}
                    </ul>
                  )}
                </div>
              )}
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Measured lactate</span>
                <span><i className="mr-1 inline-block h-0.5 w-4 align-middle bg-purple-500" />Quality-controlled trend</span>
                {lt1Point && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />LT1 {lt1Point.method} ({lt1Point.lactate.toFixed(1)} mmol/L)</span>}
                {lt2Point && <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-purple-600" />LT2 {lt2Point.method} ({lt2Point.lactate.toFixed(1)} mmol/L)</span>}
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={lactateCurve} margin={{ top: 12, right: 18, bottom: 18, left: 8 }} onClick={selectChartPoint}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="load" type="number" domain={['dataMin', 'dataMax']}
                    name={hasPower ? 'Power (W)' : hasSpeed ? 'Speed (km/h)' : 'Stage'}
                    label={{ value: hasPower ? 'Power (W)' : hasSpeed ? 'Speed (km/h)' : 'Stage', position: 'insideBottom', offset: -5 }}
                    stroke="#9ca3af" />
                  <YAxis type="number" domain={[0, 'dataMax + 1']} name="Lactate"
                    label={{ value: 'Lactate (mmol/L)', angle: -90, position: 'insideLeft' }} stroke="#9ca3af" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="linear" dataKey="measured" stroke="transparent" name="Measured (mmol/L)" dot={{ r: 5, fill: '#dc2626', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="smoothed" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="7 4" name="Quality-controlled trend" dot={false} />
                  {lt1Point && <ReferenceLine x={lt1Point.load} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: 'LT1', fill: '#b45309', fontSize: 11, position: 'top' }} />}
                  {lt2Point && <ReferenceLine x={lt2Point.load} stroke="#7c3aed" strokeDasharray="5 4" label={{ value: 'LT2', fill: '#6d28d9', fontSize: 11, position: 'top' }} />}
                  {selectedPoint?.load != null && <ReferenceLine x={selectedPoint.load} stroke="#5A4E6B" strokeDasharray="2 3" strokeOpacity={0.65} />}
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Red dots are untouched measurements. The dashed trend uses isotonic regression for threshold detection; it never replaces the raw samples.</p>
            </SectionCard>
          )}

          {hasRpe && (
            <SectionCard title="RPE vs Stage">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Borg Scale 1–10</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} onClick={selectChartPoint}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="load" stroke="#9ca3af" name={hasPower ? 'Power (W)' : hasSpeed ? 'Speed (km/h)' : 'Stage'} />
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
                <LineChart data={chartData} onClick={selectChartPoint}>
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
          <SectionCard title="Dinámica de lactato · Producción, oxidación y recuperación">
            <LactateDynamicsPanel testId={testId} bodyMassKg={bodyMassKg} dataPoints={dataPoints} results={results} />
          </SectionCard>
          {(results.lactate_analysis?.fuelProfile.length ?? 0) > 0 && (
            <SectionCard title="Measured Fuel Profile (VO₂ + VCO₂)">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MetricTile label="Max fat oxidation" value={results.lactate_analysis?.maxFatOxidation?.fatGramsPerMin.toFixed(2)} unit="g/min" note="Measured gas exchange" />
                <MetricTile label="FatMax stage" value={results.lactate_analysis?.maxFatOxidation?.stage} />
                <MetricTile label="RER at FatMax" value={results.lactate_analysis?.maxFatOxidation?.rer.toFixed(2)} />
                <MetricTile label="Valid gas stages" value={results.lactate_analysis?.fuelProfile.length} />
              </div>
            </SectionCard>
          )}
          {hasEnergyData ? (
            <>
              <SectionCard title="RER per Stage (Estimated from VO₂)">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Estimated Respiratory Exchange Ratio. RER 0.70 = 100% fat · RER 1.0 = 100% carbohydrates.
                  Yellow line = substrate crossover threshold (RER 0.85)
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData} onClick={selectChartPoint}>
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
                    Estimated distribution of fat and carbohydrates as energy source by test intensity
                </p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="load" stroke="#9ca3af" name={hasPower ? 'Power (W)' : hasSpeed ? 'Speed (km/h)' : 'Stage'} />
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
          {economyMode === 'cycling' && (
            <SectionCard title="Cycling economy">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <MetricTile label="Peak power / lean mass" value={economyMetrics?.cycling.watts_per_kg_lbm?.toFixed(2)} unit="W/kg LBM" note="Peak power normalized to lean mass" />
                <MetricTile label="VO₂ per 100 W" value={economyMetrics?.cycling.vo2_ml_kg_min_per_100w?.toFixed(1)} unit="ml/kg/min" note="Mean of valid submax stages" />
                <MetricTile label="Gross efficiency" value={economyMetrics?.cycling.efficiency_percent?.toFixed(1)} unit="%" note={economyMetrics?.cycling.efficiency_basis === 'measured_rer' ? 'Calculated with measured VO₂ + VCO₂ (RER)' : economyMetrics?.cycling.efficiency_basis === 'oxygen_only_estimate' ? 'Estimated from VO₂ alone; caloric equivalent assumed' : 'Requires measured VO₂ and power'} />
              </div>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Uses stages lasting at least 2 minutes and at or below 85% of measured VO₂peak. Gross efficiency is averaged across valid stages.
              </p>
            </SectionCard>
          )}

          {economyMode === 'running' && (
            <SectionCard title="Running economy">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MetricTile label="Oxygen cost per distance" value={economyMetrics?.running.cost_per_km_ml_o2_kg?.toFixed(1)} unit="ml O₂/kg/km" note="Lower cost means less oxygen for each kilometre" />
                <MetricTile label="VO₂–speed slope" value={economyMetrics?.running.vo2_slope_ml_kg_min_per_kmh?.toFixed(2)} unit="ml/kg/min per km/h" note={`${economyMetrics?.running.valid_stage_count ?? 0} measured submax stages`} />
              </div>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Oxygen cost is calculated as VO₂ × 60 ÷ speed (km/h), using measured VO₂ and stages of at least 2 minutes at or below 85% of measured VO₂peak.
              </p>
            </SectionCard>
          )}

          {economyMode === 'swimming' && (
            <SectionCard title="Swimming economy">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MetricTile label="Oxygen cost per 100 m" value={economyMetrics?.swimming?.cost_per_100m_ml_o2_kg?.toFixed(1)} unit="ml O₂/kg/100 m" note="Based on measured pace and VO₂" />
                <MetricTile label="VO₂–speed slope" value={economyMetrics?.swimming?.vo2_slope_ml_kg_min_per_kmh?.toFixed(2)} unit="ml/kg/min per km/h" note={`${economyMetrics?.swimming?.valid_stage_count ?? 0} measured submax stages`} />
              </div>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                This is oxygen cost, not total metabolic cost. Hydrodynamic resistance is not estimated from speed and VO₂ alone; it needs a specific drag or resisted-swimming protocol.
              </p>
            </SectionCard>
          )}

          {economyMode === 'other' && (
            <SectionCard title="Sport-specific economy">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {hasPower && hasVO2
                  ? 'The graph below shows measured VO₂ against external power. A sport-specific energy cost is not calculated until the sport, load units and protocol are defined.'
                  : 'A sport-specific model needs measured VO₂ plus a clearly defined speed, distance or external-load measure for each stage.'}
              </p>
            </SectionCard>
          )}

          {hasVO2 && economyChartData.length >= 2 && (
            <SectionCard title={`Measured VO₂ vs ${economyLoadLabel.toLowerCase()}`}>
              <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                Measured stage values only. No extrapolation is shown; valid points require a stage of at least 2 minutes and intensity at or below 85% of measured VO₂peak.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="load" type="number" name={economyLoadLabel}
                    label={{ value: economyLoadLabel, position: 'insideBottom', offset: -5 }} stroke="#9ca3af" />
                  <YAxis dataKey="vo2" type="number" name="VO₂"
                    label={{ value: 'VO₂ (ml/kg/min)', angle: -90, position: 'insideLeft' }} stroke="#9ca3af" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [value, name]} />
                  <Scatter data={economyChartData} fill="#14b8a6" line={{ stroke: '#14b8a6', strokeWidth: 2 }} />
                </ScatterChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {hasVO2 && economyMode !== 'other' && economyChartData.length < 2 && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Economy requires at least two measured submaximal stages with VO₂, speed or power, each lasting at least 2 minutes.
            </p>
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
                <LineChart data={chartData} onClick={selectChartPoint}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="load" stroke="#9ca3af" name={hasPower ? 'Power (W)' : hasSpeed ? 'Speed (km/h)' : 'Stage'} />
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
          {testId && (
            <SectionCard title="VLamax / Glycolytic Capacity">
              <VLamaxPanel testId={testId} bodyMassKg={bodyMassKg} />
            </SectionCard>
          )}
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
    </AnalysisSurfaceContext.Provider>
  );
}

function Reading({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return <div className="border-l border-gray-200 px-3 first:border-l-0 dark:border-gray-700"><p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p><p className="mt-0.5 font-semibold text-gray-900 dark:text-white">{typeof value === 'number' ? value.toFixed(1).replace(/\.0$/, '') : value} {unit && <span className="text-xs font-normal text-gray-500">{unit}</span>}</p></div>;
}
