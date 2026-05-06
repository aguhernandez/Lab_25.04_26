import type { AnthropometryMeasurement, KerrResults } from '../../types/anthropometry.types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComparativeAssessmentProps {
  currentMeasurement: AnthropometryMeasurement;
  previousMeasurement: AnthropometryMeasurement | null;
  currentResults: KerrResults | null;
  previousResults: KerrResults | null;
}

export default function ComparativeAssessment({
  currentMeasurement,
  previousMeasurement,
  currentResults,
  previousResults,
}: ComparativeAssessmentProps) {
  if (!previousMeasurement || !currentResults || !previousResults) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <p className="text-gray-600 dark:text-gray-400 text-center">
          No previous measurement available for comparison.
        </p>
      </div>
    );
  }

  const calculateChange = (current: number, previous: number) => {
    const change = current - previous;
    const pctChange = previous !== 0 ? (change / previous) * 100 : 0;
    return { absolute: change, percentage: pctChange };
  };

  const components = [
    { name: 'Adipose Mass', current: currentResults.adipose_mass_kg, previous: previousResults.adipose_mass_kg, unit: 'kg' },
    { name: 'Muscle Mass', current: currentResults.muscle_mass_kg, previous: previousResults.muscle_mass_kg, unit: 'kg' },
    { name: 'Bone Mass', current: currentResults.bone_mass_kg, previous: previousResults.bone_mass_kg, unit: 'kg' },
    { name: 'BMI', current: currentResults.bmi, previous: previousResults.bmi, unit: '' },
  ];

  const getTrendIcon = (change: number) => {
    if (change > 0.5) return <TrendingUp className="w-5 h-5 text-green-500" />;
    if (change < -0.5) return <TrendingDown className="w-5 h-5 text-red-500" />;
    return <Minus className="w-5 h-5 text-gray-500" />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Comparative Analysis
      </h2>

      <div className="space-y-4">
        {components.map((comp) => {
          const change = calculateChange(comp.current, comp.previous);

          return (
            <div key={comp.name} className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{comp.name}</h3>
                {getTrendIcon(change.absolute)}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Previous</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {comp.previous.toFixed(2)} {comp.unit}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Current</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {comp.current.toFixed(2)} {comp.unit}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Change</div>
                  <div className={`text-xl font-bold ${change.absolute > 0 ? 'text-green-600' : change.absolute < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {change.absolute > 0 ? '+' : ''}{change.absolute.toFixed(2)} {comp.unit}
                    <span className="text-sm ml-1">
                      ({change.percentage > 0 ? '+' : ''}{change.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Time Period:</strong>{' '}
          {new Date(previousMeasurement.measurement_date).toLocaleDateString()} →{' '}
          {new Date(currentMeasurement.measurement_date).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
