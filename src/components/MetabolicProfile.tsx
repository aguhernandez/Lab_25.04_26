import { PhysiologyResults, ConfidenceLevel } from '../lib/physiology';

interface MetabolicProfileProps {
  results: PhysiologyResults;
  onEdit?: () => void;
}

function getConfidenceBadge(confidence: ConfidenceLevel) {
  const colors = {
    measured: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    estimated: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    inferred: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
  };

  const labels = {
    measured: 'MEASURED',
    estimated: 'ESTIMATED',
    inferred: 'INFERRED'
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[confidence]}`}>
      {labels[confidence]}
    </span>
  );
}

export default function MetabolicProfile({ results, onEdit }: MetabolicProfileProps) {
  const fatmaxPercentVO2max = results.fatmax_vo2 && results.vo2max
    ? ((results.fatmax_vo2 / results.vo2max) * 100).toFixed(1)
    : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Metabolic Profile</h3>
          </div>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all"
              title="Edit metabolic data"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            HRmax
          </h4>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-3xl font-bold text-[#514163] dark:text-[#fdda36]">
                {results.hrmax} <span className="text-lg">bpm</span>
              </div>
            </div>
            {getConfidenceBadge(results.hrmax_confidence)}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            VO₂max
          </h4>
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="text-3xl font-bold text-[#514163] dark:text-[#fdda36]">
                {results.vo2max ? results.vo2max.toFixed(1) : 'N/A'} <span className="text-lg">ml/kg/min</span>
              </div>
              {results.vo2max_ml_min && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {Math.round(results.vo2max_ml_min)} ml/min
                </div>
              )}
            </div>
            {getConfidenceBadge(results.vo2max_confidence)}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            LT1 (Aerobic Threshold)
          </h4>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-[#514163] dark:text-[#fdda36]">
                {results.lt1_hr ? `${results.lt1_hr} bpm` : 'N/A'}
              </div>
              {results.lt1_power && (
                <div className="text-lg text-gray-700 dark:text-gray-300 font-semibold">
                  {Math.round(results.lt1_power)} W
                </div>
              )}
              {results.lt1_vo2 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {results.lt1_vo2.toFixed(1)} ml/kg/min
                </div>
              )}
              {results.lt1_percent_vo2max && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {results.lt1_percent_vo2max.toFixed(0)}% VO₂max
                </div>
              )}
            </div>
            {getConfidenceBadge(results.lt1_confidence)}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            LT2 (Lactate Threshold)
          </h4>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-[#514163] dark:text-[#fdda36]">
                {results.lt2_hr ? `${results.lt2_hr} bpm` : 'N/A'}
              </div>
              {results.lt2_power && (
                <div className="text-lg text-gray-700 dark:text-gray-300 font-semibold">
                  {Math.round(results.lt2_power)} W
                </div>
              )}
              {results.lt2_vo2 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {results.lt2_vo2.toFixed(1)} ml/kg/min
                </div>
              )}
              {results.lt2_percent_vo2max && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {results.lt2_percent_vo2max.toFixed(0)}% VO₂max
                </div>
              )}
            </div>
            {getConfidenceBadge(results.lt2_confidence)}
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            FatMax
          </h4>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="text-3xl font-bold text-[#514163] dark:text-[#fdda36]">
                {results.fatmax_hr ? `${results.fatmax_hr} bpm` : 'N/A'}
              </div>
              {results.fatmax_power && (
                <div className="text-lg text-gray-700 dark:text-gray-300 font-semibold">
                  {Math.round(results.fatmax_power)} W
                </div>
              )}
              {results.fatmax_vo2 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {results.fatmax_vo2.toFixed(1)} ml/kg/min
                </div>
              )}
              {fatmaxPercentVO2max && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {fatmaxPercentVO2max}% VO₂max
                </div>
              )}
            </div>
            {getConfidenceBadge(results.fatmax_confidence)}
          </div>
        </div>

        {results.hr_drift_percent !== null && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              HR Drift
            </h4>
            <div className="flex justify-between items-start">
              <div>
                <div className={`text-3xl font-bold ${
                  Math.abs(results.hr_drift_percent) > 5
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}>
                  {results.hr_drift_percent > 0 ? '+' : ''}{results.hr_drift_percent}%
                </div>
              </div>
              {getConfidenceBadge('measured')}
            </div>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
          <div className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Qualitative Assessment
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Aerobic Capacity:</span>{' '}
              <span className="text-gray-900 dark:text-white font-semibold">
                {results.metabolic_profile.aerobic_capacity}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Fat Utilization:</span>{' '}
              <span className="text-gray-900 dark:text-white font-semibold">
                {results.metabolic_profile.fat_utilization}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Anaerobic:</span>{' '}
              <span className="text-gray-900 dark:text-white font-semibold">
                {results.metabolic_profile.anaerobic_contribution}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Durability:</span>{' '}
              <span className="text-gray-900 dark:text-white font-semibold">
                {results.metabolic_profile.durability}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Note:</strong>{' '}
            {results.has_lactate
              ? 'Thresholds determined from direct lactate measurements.'
              : results.has_vo2
              ? 'Thresholds estimated from VO₂ and HR data.'
              : 'Thresholds estimated from heart rate progression and physiological models.'}
          </div>
        </div>
      </div>
    </div>
  );
}
