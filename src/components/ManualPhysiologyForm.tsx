import { useState } from 'react';
import { ManualPhysiologyInput, saveManualPhysiologyProfile } from '../lib/physiologyProfile';
import { Sport } from '../types';

interface ManualPhysiologyFormProps {
  athleteId: string;
  sport: Sport;
  onSaved: () => void;
  onCancel: () => void;
  onToast?: (message: string, type: 'success' | 'error') => void;
  initialValues?: Partial<Record<string, string | number | null>>;
}

type FieldKey = keyof ManualPhysiologyInput;

interface FieldDef {
  key: FieldKey;
  label: string;
  unit: string;
  placeholder: string;
  required?: boolean;
  section: 'vo2' | 'hr' | 'lt1' | 'lt2' | 'fatmax' | 'speed';
}

const FIELDS: FieldDef[] = [
  { key: 'vo2max_relative_ml_kg_min', label: 'VO2max (relative)', unit: 'ml/kg/min', placeholder: 'e.g. 58.5', section: 'vo2' },
  { key: 'vo2max_absolute_l_min', label: 'VO2max (absolute)', unit: 'L/min', placeholder: 'e.g. 4.2', section: 'vo2' },
  { key: 'hrmax', label: 'HRmax', unit: 'bpm', placeholder: 'e.g. 190', required: true, section: 'hr' },
  { key: 'lt1_hr', label: 'LT1 Heart Rate', unit: 'bpm', placeholder: 'e.g. 145', section: 'lt1' },
  { key: 'lt1_power', label: 'LT1 Power', unit: 'W', placeholder: 'e.g. 220', section: 'lt1' },
  { key: 'lt2_hr', label: 'LT2 Heart Rate', unit: 'bpm', placeholder: 'e.g. 168', section: 'lt2' },
  { key: 'lt2_power', label: 'LT2 Power', unit: 'W', placeholder: 'e.g. 290', section: 'lt2' },
  { key: 'fatmax_hr', label: 'FatMax Heart Rate', unit: 'bpm', placeholder: 'e.g. 135', section: 'fatmax' },
  { key: 'fatmax_power', label: 'FatMax Power', unit: 'W', placeholder: 'e.g. 180', section: 'fatmax' },
  { key: 'pam_watts', label: 'Peak Aerobic Power (PAM)', unit: 'W', placeholder: 'e.g. 380', section: 'speed' },
  { key: 'vam_kmh', label: 'VAM / Peak Speed', unit: 'km/h', placeholder: 'e.g. 22.5', section: 'speed' },
];

const PACE_FIELDS: { key: 'lt1_pace' | 'lt2_pace' | 'fatmax_pace'; label: string; section: 'lt1' | 'lt2' | 'fatmax' }[] = [
  { key: 'lt1_pace', label: 'LT1 Pace', section: 'lt1' },
  { key: 'lt2_pace', label: 'LT2 Pace', section: 'lt2' },
  { key: 'fatmax_pace', label: 'FatMax Pace', section: 'fatmax' },
];

const SECTIONS: { key: string; title: string; color: string }[] = [
  { key: 'vo2', title: 'VO2max', color: 'blue' },
  { key: 'hr', title: 'Heart Rate', color: 'slate' },
  { key: 'lt1', title: 'LT1 — Aerobic Threshold', color: 'green' },
  { key: 'lt2', title: 'LT2 — Anaerobic Threshold', color: 'red' },
  { key: 'fatmax', title: 'FatMax', color: 'amber' },
  { key: 'speed', title: 'Peak Outputs', color: 'slate' },
];

const COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10',
  green: 'text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10',
  red: 'text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10',
  amber: 'text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10',
  slate: 'text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40',
};

const PACE_PLACEHOLDER: Record<Sport, string> = {
  cycling: 'e.g. 32.5 km/h',
  running: 'e.g. 4:30',
  triathlon: 'e.g. 4:45',
  swimming: 'e.g. 1:30',
  other: 'e.g. value',
};

export default function ManualPhysiologyForm({ athleteId, sport, onSaved, onCancel, onToast, initialValues }: ManualPhysiologyFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (!initialValues) return {};
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(initialValues)) {
      if (v != null) init[k] = String(v);
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [zoneMode, setZoneMode] = useState<'5' | '7'>('5');

  const setField = (key: string, val: string) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const parseNum = (val: string): number | null => {
    if (!val || val.trim() === '') return null;
    const n = parseFloat(val.replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!values.hrmax || parseNum(values.hrmax) === null) {
      newErrors.hrmax = 'HRmax is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const input: ManualPhysiologyInput = {
        vo2max_relative_ml_kg_min: parseNum(values.vo2max_relative_ml_kg_min),
        vo2max_absolute_l_min: parseNum(values.vo2max_absolute_l_min),
        hrmax: parseNum(values.hrmax),
        lt1_hr: parseNum(values.lt1_hr),
        lt1_power: parseNum(values.lt1_power),
        lt1_pace: values.lt1_pace?.trim() || null,
        lt2_hr: parseNum(values.lt2_hr),
        lt2_power: parseNum(values.lt2_power),
        lt2_pace: values.lt2_pace?.trim() || null,
        fatmax_hr: parseNum(values.fatmax_hr),
        fatmax_power: parseNum(values.fatmax_power),
        fatmax_pace: values.fatmax_pace?.trim() || null,
        vam_kmh: parseNum(values.vam_kmh),
        pam_watts: parseNum(values.pam_watts),
        zone_mode: zoneMode,
        sport: sport,
      };
      const result = await saveManualPhysiologyProfile(athleteId, input);
      if (result.success) {
        onToast?.('Physiology profile saved successfully.', 'success');
        onSaved();
      } else {
        onToast?.('Failed to save physiology profile.', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const paceLabel = sport === 'cycling' ? 'km/h' : sport === 'swimming' ? '/100m' : '/km';

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Enter data from external tools or previous assessments. At minimum, provide HRmax.
          Training zones will be automatically calculated from the values you enter.
        </p>
      </div>

      {SECTIONS.map(section => {
        const sectionFields = FIELDS.filter(f => f.section === section.key);
        const paceSectionFields = PACE_FIELDS.filter(f => f.section === section.key);
        if (sectionFields.length === 0 && paceSectionFields.length === 0) return null;

        return (
          <div key={section.key} className={`border rounded-xl p-4 ${COLOR_MAP[section.color]}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3 opacity-80">{section.title}</h4>
            <div className="grid grid-cols-2 gap-3">
              {sectionFields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                    <span className="text-gray-400 ml-1">({field.unit})</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder={field.placeholder}
                    value={values[field.key] || ''}
                    onChange={e => setField(field.key, e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors[field.key] ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {errors[field.key] && (
                    <p className="text-xs text-red-500 mt-0.5">{errors[field.key]}</p>
                  )}
                </div>
              ))}
              {paceSectionFields.map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}
                    <span className="text-gray-400 ml-1">({paceLabel})</span>
                  </label>
                  <input
                    type="text"
                    placeholder={PACE_PLACEHOLDER[sport]}
                    value={values[field.key] || ''}
                    onChange={e => setField(field.key, e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/40">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-3">
          Training Zone Model
        </h4>
        <div className="flex gap-3">
          {(['5', '7'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setZoneMode(mode)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                zoneMode === mode
                  ? 'border-slate-800 dark:border-slate-300 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {mode} Zones
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {zoneMode === '5'
            ? '5-zone model: Recovery / Endurance / Tempo / Threshold / VO2max'
            : '7-zone model: Recovery / Endurance Base / Aerobic / Tempo / Threshold / VO2max / Neuromuscular'}
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2.5 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-lg font-semibold text-sm hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : `Save Profile & Calculate ${zoneMode} Zones`}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
