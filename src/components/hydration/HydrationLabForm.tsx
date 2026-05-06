import { useState } from 'react';
import { HydrationInput, HydrationResults, calculateHydration } from '../../lib/hydration';
import { useLanguage } from '../../contexts/LanguageContext';

interface HydrationLabFormProps {
  onCalculated: (input: HydrationInput, results: HydrationResults) => void;
}

const defaultInput: HydrationInput = {
  sessionDate: new Date().toISOString().split('T')[0],
  preWeight_kg: 0,
  postWeight_kg: 0,
  fluidIntake_mL: 0,
  urineOutput_mL: 0,
  duration_min: 60,
  temperature_C: undefined,
  humidity_percent: undefined,
  avgHR: undefined,
  rpe: undefined,
  usg_pre: undefined,
  usg_post: undefined,
  notes: '',
};

export default function HydrationLabForm({ onCalculated }: HydrationLabFormProps) {
  const { t } = useLanguage();
  const [input, setInput] = useState<HydrationInput>(defaultInput);
  const [errors, setErrors] = useState<string[]>([]);

  const update = (field: keyof HydrationInput, value: string) => {
    const numFields = [
      'preWeight_kg', 'postWeight_kg', 'fluidIntake_mL', 'urineOutput_mL',
      'duration_min', 'temperature_C', 'humidity_percent', 'avgHR', 'rpe', 'usg_pre', 'usg_post'
    ];
    if (numFields.includes(field)) {
      setInput(prev => ({ ...prev, [field]: value === '' ? undefined : parseFloat(value) }));
    } else {
      setInput(prev => ({ ...prev, [field]: value }));
    }
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!input.preWeight_kg || input.preWeight_kg <= 0) errs.push('Pre-exercise weight is required');
    if (!input.postWeight_kg || input.postWeight_kg <= 0) errs.push('Post-exercise weight is required');
    if (!input.duration_min || input.duration_min <= 0) errs.push('Session duration is required');
    if (input.fluidIntake_mL === undefined || input.fluidIntake_mL < 0) errs.push('Fluid intake must be 0 or more');
    if (input.urineOutput_mL === undefined || input.urineOutput_mL < 0) errs.push('Urine output must be 0 or more');
    setErrors(errs);
    return errs.length === 0;
  };

  const handleCalculate = () => {
    if (!validate()) return;
    const results = calculateHydration({
      ...input,
      fluidIntake_mL: input.fluidIntake_mL ?? 0,
      urineOutput_mL: input.urineOutput_mL ?? 0,
    });
    onCalculated(input, results);
  };

  return (
    <div className="space-y-6">
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <ul className="space-y-1">
            {errors.map((e, i) => (
              <li key={i} className="text-sm text-red-700 dark:text-red-400">{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('hydration.sessionInfo')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.sessionDate')}</label>
            <input
              type="date"
              value={input.sessionDate}
              onChange={e => update('sessionDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.duration')}</label>
            <input
              type="number"
              min="1"
              value={input.duration_min || ''}
              onChange={e => update('duration_min', e.target.value)}
              placeholder="e.g. 75"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('hydration.weightMeasurements')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.preWeight')}</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={input.preWeight_kg || ''}
              onChange={e => update('preWeight_kg', e.target.value)}
              placeholder="e.g. 72.4"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.postWeight')}</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={input.postWeight_kg || ''}
              onChange={e => update('postWeight_kg', e.target.value)}
              placeholder="e.g. 71.6"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('hydration.fluidBalance')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.fluidIntake')}</label>
            <input
              type="number"
              step="10"
              min="0"
              value={input.fluidIntake_mL ?? ''}
              onChange={e => update('fluidIntake_mL', e.target.value)}
              placeholder="e.g. 750"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.urineOutput')}</label>
            <input
              type="number"
              step="10"
              min="0"
              value={input.urineOutput_mL ?? ''}
              onChange={e => update('urineOutput_mL', e.target.value)}
              placeholder="e.g. 200"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('hydration.usgSection')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.usgPre')}</label>
            <input
              type="number"
              step="0.001"
              min="1.000"
              max="1.040"
              value={input.usg_pre ?? ''}
              onChange={e => update('usg_pre', e.target.value)}
              placeholder="e.g. 1.022"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('hydration.usgPreHint')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.usgPost')}</label>
            <input
              type="number"
              step="0.001"
              min="1.000"
              max="1.040"
              value={input.usg_post ?? ''}
              onChange={e => update('usg_post', e.target.value)}
              placeholder="e.g. 1.028"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('hydration.usgPostHint')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{t('hydration.envContext')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.temperature')}</label>
            <input
              type="number"
              step="0.5"
              value={input.temperature_C ?? ''}
              onChange={e => update('temperature_C', e.target.value)}
              placeholder="e.g. 28"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.humidity')}</label>
            <input
              type="number"
              min="0"
              max="100"
              value={input.humidity_percent ?? ''}
              onChange={e => update('humidity_percent', e.target.value)}
              placeholder="e.g. 62"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.avgHR')}</label>
            <input
              type="number"
              min="40"
              max="220"
              value={input.avgHR ?? ''}
              onChange={e => update('avgHR', e.target.value)}
              placeholder="e.g. 154"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.rpe')}</label>
            <input
              type="number"
              min="1"
              max="10"
              value={input.rpe ?? ''}
              onChange={e => update('rpe', e.target.value)}
              placeholder="e.g. 7"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('hydration.notes')}</label>
        <textarea
          rows={2}
          value={input.notes ?? ''}
          onChange={e => update('notes', e.target.value)}
          placeholder={t('hydration.notesPlaceholder')}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <button
        onClick={handleCalculate}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors shadow-md"
      >
        {t('hydration.calculate')}
      </button>
    </div>
  );
}
