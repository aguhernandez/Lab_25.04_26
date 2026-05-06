import type { AnthropometryMeasurement } from '../../types/anthropometry.types';

interface IndicesAndProportionalityProps {
  measurement: AnthropometryMeasurement;
}

export default function IndicesAndProportionality({ measurement }: IndicesAndProportionalityProps) {
  const calculateCormicIndex = (): number | null => {
    if (!measurement.sitting_height_cm_median || !measurement.stature_cm_median) return null;
    return (measurement.sitting_height_cm_median / measurement.stature_cm_median) * 100;
  };

  const calculatePonderalIndex = (): number | null => {
    if (!measurement.body_mass_kg_median || !measurement.stature_cm_median) return null;
    const statureM = measurement.stature_cm_median / 100;
    return measurement.body_mass_kg_median / Math.pow(statureM, 3);
  };

  const calculateWaistHeightRatio = (): number | null => {
    if (!measurement.waist_girth_cm_median || !measurement.stature_cm_median) return null;
    return measurement.waist_girth_cm_median / measurement.stature_cm_median;
  };

  const cormicIndex = calculateCormicIndex();
  const ponderalIndex = calculatePonderalIndex();
  const waistHeightRatio = calculateWaistHeightRatio();

  const indices = [
    { name: 'Cormic Index', value: cormicIndex, unit: '%', description: 'Sitting height / Stature × 100' },
    { name: 'Ponderal Index', value: ponderalIndex, unit: '', description: 'Body mass / Stature³' },
    { name: 'Waist-Height Ratio', value: waistHeightRatio, unit: '', description: 'Waist girth / Stature' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Proportionality Indices
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {indices.map((index) => (
          <div key={index.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{index.name}</h3>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {index.value !== null ? `${index.value.toFixed(2)} ${index.unit}` : 'N/A'}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{index.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
