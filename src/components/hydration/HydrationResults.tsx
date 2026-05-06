import { HydrationInput, HydrationResults as HydrationResultsType, getStressBgColor, getUsgColor } from '../../lib/hydration';

interface HydrationResultsProps {
  input: HydrationInput;
  results: HydrationResultsType;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}

function MetricCard({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function HydrationResultsDisplay({ input, results, onSave, onReset, saving }: HydrationResultsProps) {
  return (
    <div className="space-y-5">
      {results.performanceRisk && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl p-4 flex gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Performance Risk</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">{results.performanceRisk}</p>
          </div>
        </div>
      )}

      {results.hydrationWarning && !results.performanceRisk && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl p-4 flex gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Hydration Warning</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-0.5">{results.hydrationWarning}</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Core Results</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetricCard
            label="Adjusted Sweat Loss"
            value={results.adjustedSweatLoss_kg.toFixed(3)}
            unit="kg"
            sub="≈ L of sweat"
          />
          <MetricCard
            label="% Dehydration"
            value={results.percentDehydration.toFixed(2)}
            unit="%"
          />
          <MetricCard
            label="Sweat Rate"
            value={results.sweatRate_L_h.toFixed(3)}
            unit="L/h"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Risk Assessment</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Hydration Stress Score</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{results.hydrationStressScore.toFixed(2)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Heat factor: ×{results.heatStressFactor.toFixed(2)}</div>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getStressBgColor(results.stressClassification)}`}>
              {results.stressClassification}
            </span>
          </div>

          {results.usgPreClassification && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">USG Pre-session</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{input.usg_pre?.toFixed(3)}</div>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getUsgColor(results.usgPreClassification)}`}>
                {results.usgPreClassification}
              </span>
            </div>
          )}

          {results.usgPostClassification && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">USG Post-session</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{input.usg_post?.toFixed(3)}</div>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${getUsgColor(results.usgPostClassification)}`}>
                {results.usgPostClassification}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Session Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400 text-xs">Duration</div>
            <div className="font-semibold text-gray-900 dark:text-white">{input.duration_min} min</div>
          </div>
          {input.temperature_C !== undefined && (
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-xs">Temperature</div>
              <div className="font-semibold text-gray-900 dark:text-white">{input.temperature_C}°C</div>
            </div>
          )}
          {input.humidity_percent !== undefined && (
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-xs">Humidity</div>
              <div className="font-semibold text-gray-900 dark:text-white">{input.humidity_percent}%</div>
            </div>
          )}
          {input.avgHR !== undefined && (
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-xs">Avg HR</div>
              <div className="font-semibold text-gray-900 dark:text-white">{input.avgHR} bpm</div>
            </div>
          )}
          {input.rpe !== undefined && (
            <div className="text-center">
              <div className="text-gray-500 dark:text-gray-400 text-xs">RPE</div>
              <div className="font-semibold text-gray-900 dark:text-white">{input.rpe}/10</div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReset}
          className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
        >
          New Assessment
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors shadow-md"
        >
          {saving ? 'Saving...' : 'Save & Update Athlete Profile'}
        </button>
      </div>
    </div>
  );
}
