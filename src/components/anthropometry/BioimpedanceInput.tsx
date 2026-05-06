import { useState } from 'react';
import { Activity } from 'lucide-react';

interface BioimpedanceInputProps {
  onSave: (data: any) => void;
}

export default function BioimpedanceInput({ onSave }: BioimpedanceInputProps) {
  const [bodyMass, setBodyMass] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [muscleMassPct, setMuscleMassPct] = useState('');

  const handleSave = () => {
    const data = {
      body_mass_kg: parseFloat(bodyMass),
      body_fat_pct: parseFloat(bodyFatPct),
      muscle_mass_pct: parseFloat(muscleMassPct),
      measurement_method: 'bioimpedance',
    };
    onSave(data);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <Activity className="w-6 h-6 text-blue-600 mr-2" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bioimpedance Measurement
        </h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Body Mass (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={bodyMass}
            onChange={(e) => setBodyMass(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Body Fat (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={bodyFatPct}
            onChange={(e) => setBodyFatPct(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Muscle Mass (%)
          </label>
          <input
            type="number"
            step="0.1"
            value={muscleMassPct}
            onChange={(e) => setMuscleMassPct(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Save Bioimpedance Data
        </button>
      </div>
    </div>
  );
}
