import { useState } from 'react';
import { HeatSessionInput, HeatSessionResults, calculateHeatSession } from '../../lib/heatAdaptation';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  onCalculated: (input: HeatSessionInput, results: HeatSessionResults) => void;
}

export default function HeatAdaptationForm({ onCalculated }: Props) {
  const { t } = useLanguage();
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<HeatSessionInput>({
    sessionDate: today,
    temperature_c: 28,
    humidity_percent: undefined,
    sport: 'cycling',
    duration_min: 60,
    avgHR: undefined,
    hrFirstHalf: undefined,
    hrSecondHalf: undefined,
    externalLoad: undefined,
    loadUnit: 'watts',
    preWeight_kg: undefined,
    postWeight_kg: undefined,
    fluidIntake_mL: undefined,
    rpe: undefined,
    notes: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof HeatSessionInput, string>>>({});

  const set = (field: keyof HeatSessionInput, value: string | number | undefined) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const numOrUndef = (v: string) => v === '' ? undefined : parseFloat(v);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.sessionDate) newErrors.sessionDate = 'Required';
    if (!form.temperature_c || form.temperature_c < 20) newErrors.temperature_c = 'Must be ≥ 20°C for heat sessions';
    if (!form.duration_min || form.duration_min <= 0) newErrors.duration_min = 'Required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCalculate = () => {
    if (!validate()) return;
    const results = calculateHeatSession(form);
    onCalculated(form, results);
  };

  const inputClass = (field: keyof HeatSessionInput) =>
    `w-full px-3 py-2 rounded-lg border text-sm font-body bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors ${
      errors[field]
        ? 'border-red-400 dark:border-red-500'
        : 'border-gray-300 dark:border-gray-600'
    }`;

  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 font-body uppercase tracking-wide';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-4 border border-orange-100 dark:border-orange-800/30 space-y-4">
          <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide">{t('heat.sessionInfo') || 'Session Info'}</h3>

          <div>
            <label className={labelClass}>{t('heat.sessionDate')}</label>
            <input type="date" value={form.sessionDate} onChange={e => set('sessionDate', e.target.value)} className={inputClass('sessionDate')} />
            {errors.sessionDate && <p className="text-red-500 text-xs mt-1">{errors.sessionDate}</p>}
          </div>

          <div>
            <label className={labelClass}>{t('heat.sport')}</label>
            <select value={form.sport} onChange={e => set('sport', e.target.value as 'cycling' | 'running' | 'other')} className={inputClass('sport')}>
              <option value="cycling">Cycling</option>
              <option value="running">Running</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>{t('heat.duration')}</label>
            <input type="number" min={1} value={form.duration_min || ''} onChange={e => set('duration_min', numOrUndef(e.target.value) ?? 0)} className={inputClass('duration_min')} placeholder="60" />
            {errors.duration_min && <p className="text-red-500 text-xs mt-1">{errors.duration_min}</p>}
          </div>

          <div>
            <label className={labelClass}>{t('heat.rpe')}</label>
            <input type="number" min={6} max={20} step={0.5} value={form.rpe ?? ''} onChange={e => set('rpe', numOrUndef(e.target.value))} className={inputClass('rpe')} placeholder="13" />
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 border border-red-100 dark:border-red-800/30 space-y-4">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Environmental Conditions</h3>

          <div>
            <label className={labelClass}>{t('heat.temperature')}</label>
            <input type="number" step={0.1} value={form.temperature_c || ''} onChange={e => set('temperature_c', numOrUndef(e.target.value) ?? 0)} className={inputClass('temperature_c')} placeholder="28" />
            {errors.temperature_c && <p className="text-red-500 text-xs mt-1">{errors.temperature_c}</p>}
          </div>

          <div>
            <label className={labelClass}>{t('heat.humidity')}</label>
            <input type="number" min={0} max={100} step={1} value={form.humidity_percent ?? ''} onChange={e => set('humidity_percent', numOrUndef(e.target.value))} className={inputClass('humidity_percent')} placeholder="60" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 space-y-4">
          <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Cardiovascular Response</h3>

          <div>
            <label className={labelClass}>{t('heat.hrStart') || 'Average HR (bpm)'}</label>
            <input type="number" min={40} max={220} value={form.avgHR ?? ''} onChange={e => set('avgHR', numOrUndef(e.target.value))} className={inputClass('avgHR')} placeholder="155" />
          </div>

          <div>
            <label className={labelClass}>{t('heat.hrEnd') || 'HR First Half (bpm)'}</label>
            <input type="number" min={40} max={220} value={form.hrFirstHalf ?? ''} onChange={e => set('hrFirstHalf', numOrUndef(e.target.value))} className={inputClass('hrFirstHalf')} placeholder="150" />
          </div>

          <div>
            <label className={labelClass}>{t('heat.hrMax') || 'HR Second Half (bpm)'}</label>
            <input type="number" min={40} max={220} value={form.hrSecondHalf ?? ''} onChange={e => set('hrSecondHalf', numOrUndef(e.target.value))} className={inputClass('hrSecondHalf')} placeholder="162" />
          </div>

          <div>
            <label className={labelClass}>
              External Load ({form.sport === 'cycling' ? 'Watts' : 'Speed km/h'})
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.externalLoad ?? ''}
                onChange={e => set('externalLoad', numOrUndef(e.target.value))}
                className={`flex-1 ${inputClass('externalLoad')}`}
                placeholder={form.sport === 'cycling' ? '220' : '14.5'}
              />
              <select
                value={form.loadUnit}
                onChange={e => set('loadUnit', e.target.value as 'watts' | 'km_h')}
                className="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-body"
              >
                <option value="watts">W</option>
                <option value="km_h">km/h</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-teal-50 dark:bg-teal-900/10 rounded-xl p-4 border border-teal-100 dark:border-teal-800/30 space-y-4">
          <h3 className="text-sm font-semibold text-teal-700 dark:text-teal-400 uppercase tracking-wide">Hydration / Sweat Rate</h3>

          <div>
            <label className={labelClass}>Pre-session Weight (kg)</label>
            <input type="number" step={0.01} value={form.preWeight_kg ?? ''} onChange={e => set('preWeight_kg', numOrUndef(e.target.value))} className={inputClass('preWeight_kg')} placeholder="72.500" />
          </div>

          <div>
            <label className={labelClass}>Post-session Weight (kg)</label>
            <input type="number" step={0.01} value={form.postWeight_kg ?? ''} onChange={e => set('postWeight_kg', numOrUndef(e.target.value))} className={inputClass('postWeight_kg')} placeholder="71.200" />
          </div>

          <div>
            <label className={labelClass}>Fluid Intake During Session (mL)</label>
            <input type="number" min={0} step={10} value={form.fluidIntake_mL ?? ''} onChange={e => set('fluidIntake_mL', numOrUndef(e.target.value))} className={inputClass('fluidIntake_mL')} placeholder="750" />
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>{t('heat.notes')}</label>
        <textarea
          rows={2}
          value={form.notes ?? ''}
          onChange={e => set('notes', e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-body focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          placeholder="E.g., outdoor morning session, high humidity, felt heavier than usual..."
        />
      </div>

      <button
        onClick={handleCalculate}
        className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors font-body text-sm"
      >
        Calculate Heat Metrics
      </button>
    </div>
  );
}
