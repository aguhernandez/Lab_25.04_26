import type { KerrResults } from '../../types/anthropometry.types';
import { useLanguage } from '../../contexts/LanguageContext';

interface KerrBodyCompositionDashboardProps {
  allResults: KerrResults[];
}

export default function KerrBodyCompositionDashboard({ allResults }: KerrBodyCompositionDashboardProps) {
  const { t } = useLanguage();

  if (allResults.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <p className="text-gray-600 dark:text-gray-400 text-center">{t('kerr.dashboard.noData')}</p>
      </div>
    );
  }

  const avgAdipose = allResults.reduce((sum, r) => sum + r.adipose_mass_kg, 0) / allResults.length;
  const avgMuscle = allResults.reduce((sum, r) => sum + r.muscle_mass_kg, 0) / allResults.length;
  const avgBone = allResults.reduce((sum, r) => sum + r.bone_mass_kg, 0) / allResults.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        {t('kerr.dashboard.title')}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('kerr.dashboard.avgAdipose')}</div>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {avgAdipose.toFixed(1)} kg
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('kerr.dashboard.avgMuscle')}</div>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            {avgMuscle.toFixed(1)} kg
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{t('kerr.dashboard.avgBone')}</div>
          <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
            {avgBone.toFixed(1)} kg
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('kerr.dashboard.totalAssessments')}: {allResults.length}
        </h3>
      </div>
    </div>
  );
}
