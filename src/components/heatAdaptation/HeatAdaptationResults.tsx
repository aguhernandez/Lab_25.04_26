import {
  HeatSessionInput,
  HeatSessionResults,
  getDriftBg,
  getAdaptationBg,
} from '../../lib/heatAdaptation';

interface Props {
  input: HeatSessionInput;
  results: HeatSessionResults;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}

function MetricCard({ label, value, unit, sub, badge }: { label: string; value: string; unit?: string; sub?: string; badge?: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
        {unit && <span className="text-sm text-gray-500 dark:text-gray-400 font-body">{unit}</span>}
      </div>
      {badge && (
        <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold font-body ${badge}`}>
          {badge.includes('green') ? 'Stable' : badge.includes('yellow') ? 'Moderate' : badge.includes('red') ? 'High Stress' : ''}
        </span>
      )}
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-body">{sub}</p>}
    </div>
  );
}

export default function HeatAdaptationResults({ input, results, onSave, onReset, saving }: Props) {
  const fmt = (v: number | null, decimals = 2) => v !== null ? v.toFixed(decimals) : '—';

  const driftBadge = results.hrDriftClassification !== 'N/A' ? getDriftBg(results.hrDriftClassification) : '';
  const adaptBadge = getAdaptationBg(results.adaptationClassification);

  return (
    <div className="space-y-6">
      <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 text-sm font-body">
          <span><span className="text-orange-600 dark:text-orange-400 font-medium">Date: </span><span className="text-gray-700 dark:text-gray-300">{input.sessionDate}</span></span>
          <span><span className="text-orange-600 dark:text-orange-400 font-medium">Sport: </span><span className="text-gray-700 dark:text-gray-300 capitalize">{input.sport}</span></span>
          <span><span className="text-orange-600 dark:text-orange-400 font-medium">Temp: </span><span className="text-gray-700 dark:text-gray-300">{input.temperature_c}°C{input.humidity_percent ? ` / ${input.humidity_percent}% RH` : ''}</span></span>
          <span><span className="text-orange-600 dark:text-orange-400 font-medium">Duration: </span><span className="text-gray-700 dark:text-gray-300">{input.duration_min} min</span></span>
          {input.rpe && <span><span className="text-orange-600 dark:text-orange-400 font-medium">RPE: </span><span className="text-gray-700 dark:text-gray-300">{input.rpe}/20</span></span>}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 font-body">A) Cardiac Cost Under Heat</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 col-span-2 md:col-span-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">Heat Cardiac Load</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {results.heatCardiacLoad !== null ? fmt(results.heatCardiacLoad, 4) : '—'}
              </span>
              {results.heatCardiacLoad !== null && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-body">bpm/{input.loadUnit === 'watts' ? 'W' : 'km/h'}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-body">{results.cardiacLoadInterpretation}</p>
          </div>

          {input.avgHR && (
            <MetricCard label="Avg HR" value={String(input.avgHR)} unit="bpm" />
          )}
          {input.externalLoad && (
            <MetricCard label="External Load" value={String(input.externalLoad)} unit={input.loadUnit === 'watts' ? 'W' : 'km/h'} />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 font-body">B) HR Drift (Heat-Corrected)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 col-span-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">HR Drift %</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">
                {results.hrDriftPercent !== null ? `${fmt(results.hrDriftPercent, 1)}%` : '—'}
              </span>
            </div>
            {results.hrDriftClassification !== 'N/A' && (
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold font-body ${driftBadge}`}>
                {results.hrDriftClassification}
              </span>
            )}
            {results.hrDriftPercent === null && (
              <p className="text-xs text-gray-400 mt-1 font-body">Enter HR first half and second half to calculate</p>
            )}
          </div>
          {results.correctedDriftPercent !== null && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">Corrected Drift</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {fmt(results.correctedDriftPercent, 1)}%
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 font-body">HR Drift / (1 + %Dehyd × 0.2)</p>
            </div>
          )}
          {input.hrFirstHalf && (
            <MetricCard label="HR First Half" value={String(input.hrFirstHalf)} unit="bpm" />
          )}
          {input.hrSecondHalf && (
            <MetricCard label="HR Second Half" value={String(input.hrSecondHalf)} unit="bpm" />
          )}
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 font-body space-y-0.5 pl-1">
          <p>{'< 3%'} → Stable cardiovascular response</p>
          <p>3–5% → Moderate heat stress, adaptation may be developing</p>
          <p>{'> 5%'} → Significant cardiovascular strain</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3 font-body">C) Sweat Efficiency</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard
            label="Sweat Rate"
            value={results.sweatRate_L_h !== null ? fmt(results.sweatRate_L_h, 3) : '—'}
            unit="L/h"
            sub={results.sweatRate_L_h === null ? 'Enter pre/post weights' : undefined}
          />
          <MetricCard
            label="% Dehydration"
            value={results.percentDehydration !== null ? `${fmt(results.percentDehydration, 2)}%` : '—'}
            sub={results.percentDehydration === null ? 'Enter pre/post weights' : undefined}
          />
          {input.rpe && (
            <MetricCard label="RPE" value={`${input.rpe}/20`} sub="Borg scale" />
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide font-body mb-1">Heat Adaptation Score</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                {results.heatAdaptationScore !== null ? fmt(results.heatAdaptationScore, 1) : '—'}
              </span>
              {results.heatAdaptationScore !== null && (
                <span className="text-lg text-gray-500 dark:text-gray-400 font-body">/ 100</span>
              )}
            </div>
            {results.heatAdaptationScore !== null && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-1">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-orange-400 to-teal-500 transition-all"
                    style={{ width: `${Math.min(100, results.heatAdaptationScore)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-semibold font-body ${adaptBadge}`}>
              {results.adaptationClassification}
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-body max-w-[200px]">
              {results.heatAdaptationScore === null
                ? 'Add HR drift and/or RPE to generate score'
                : 'Score improves as drift and RPE decrease at same external load'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-colors font-body text-sm"
        >
          New Session
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors font-body text-sm"
        >
          {saving ? 'Saving...' : 'Save Session'}
        </button>
      </div>
    </div>
  );
}
