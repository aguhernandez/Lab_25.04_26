import { useState, useEffect } from 'react';
import { X, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ISAK_VARIABLES,
  calculateMedian,
  calculateStdev,
  calculateErrorPct,
  sanitizeInput,
  adaptDataFromDatabase,
  adaptDataForDatabase,
  type AnthropometryData,
  type AnthropometryMeasurement,
  type TripleMeasurement,
} from '../../types/anthropometry.types';

interface EditMeasurementModalProps {
  measurement: AnthropometryMeasurement;
  onClose: () => void;
  onSave: (updatedMeasurement: AnthropometryMeasurement) => void;
  saving?: boolean;
}

const TABS = [
  { key: 'basic', label: 'Basic' },
  { key: 'skinfolds', label: 'Skinfolds' },
  { key: 'girths', label: 'Girths' },
  { key: 'lengths', label: 'Lengths' },
  { key: 'breadths', label: 'Breadths' },
] as const;

type TabKey = typeof TABS[number]['key'];

const SIMPLE_COLUMNS = new Set(['body_mass_kg', 'stature_cm', 'sitting_height_cm', 'arm_span_cm']);

export default function EditMeasurementModal({ measurement, onClose, onSave, saving }: EditMeasurementModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [data, setData] = useState<AnthropometryData>({});

  useEffect(() => {
    setData(adaptDataFromDatabase(measurement));
  }, [measurement.id]);

  const handleTripleInput = (varName: string, measurementNum: 'm1' | 'm2' | 'm3', value: string) => {
    const numValue = sanitizeInput(value);
    const currentTriple = (data[varName] as TripleMeasurement) || {};
    const updatedTriple: TripleMeasurement = { ...currentTriple, [measurementNum]: numValue };
    const median = calculateMedian(updatedTriple.m1, updatedTriple.m2, updatedTriple.m3);
    const stdev = calculateStdev(updatedTriple.m1, updatedTriple.m2, updatedTriple.m3, median);
    const error_pct = calculateErrorPct(stdev, median);
    updatedTriple.median = median;
    updatedTriple.stdev = stdev;
    updatedTriple.error_pct = error_pct;
    setData({ ...data, [varName]: updatedTriple });
  };

  const handleBasicInput = (varName: string, value: string) => {
    const numValue = sanitizeInput(value);
    setData({ ...data, [varName]: numValue !== undefined ? { median: numValue } : undefined });
  };

  const handleSave = () => {
    const dbData = adaptDataForDatabase(data);
    const updated: AnthropometryMeasurement = { ...measurement, ...dbData };
    onSave(updated);
  };

  const variables = ISAK_VARIABLES.filter(v => v.category === activeTab);
  const tabIndex = TABS.findIndex(t => t.key === activeTab);

  const getTriple = (varName: string): TripleMeasurement => {
    return (data[varName] as TripleMeasurement) || {};
  };

  const getBasicValue = (varName: string): string => {
    const val = data[varName] as TripleMeasurement | undefined;
    if (!val) return '';
    return val.median !== undefined ? String(val.median) : '';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Measurement</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(measurement.measurement_date).toLocaleDateString()} — After saving, use Recalculate to update results.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-[#fdda36] text-[#514163] dark:text-yellow-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {variables.map(variable => {
              const isSimple = SIMPLE_COLUMNS.has(variable.name);
              if (isSimple) {
                return (
                  <div key={variable.name} className="grid grid-cols-3 gap-3 items-center">
                    <label className="col-span-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {variable.label}
                      {variable.required && <span className="text-red-500 ml-1">*</span>}
                      <span className="text-gray-400 ml-1 text-xs">({variable.unit})</span>
                    </label>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.1"
                        min={variable.min}
                        max={variable.max}
                        value={getBasicValue(variable.name)}
                        onChange={e => handleBasicInput(variable.name, e.target.value)}
                        className="input w-full"
                        placeholder={`${variable.min}–${variable.max} ${variable.unit}`}
                      />
                    </div>
                  </div>
                );
              }

              const triple = getTriple(variable.name);
              const hasError = triple.error_pct !== undefined && triple.error_pct > 10;
              return (
                <div key={variable.name} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {variable.label}
                      {variable.required && <span className="text-red-500 ml-1">*</span>}
                      <span className="text-gray-400 ml-1 text-xs">({variable.unit})</span>
                    </span>
                    {triple.median != null && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        hasError
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        Median: {triple.median.toFixed(1)} {variable.unit}
                        {triple.error_pct !== undefined && ` (${triple.error_pct.toFixed(1)}%)`}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['m1', 'm2', 'm3'] as const).map((m, i) => (
                      <div key={m}>
                        <label className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">M{i + 1}</label>
                        <input
                          type="number"
                          step="0.1"
                          min={variable.min}
                          max={variable.max}
                          value={triple[m] !== undefined ? String(triple[m]) : ''}
                          onChange={e => handleTripleInput(variable.name, m, e.target.value)}
                          className="input w-full text-sm"
                          placeholder="—"
                        />
                      </div>
                    ))}
                  </div>
                  {hasError && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Error &gt;10% — review measurements
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-2xl">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab(TABS[Math.max(0, tabIndex - 1)].key)}
              disabled={tabIndex === 0}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button
              onClick={() => setActiveTab(TABS[Math.min(TABS.length - 1, tabIndex + 1)].key)}
              disabled={tabIndex === TABS.length - 1}
              className="flex items-center gap-1 px-3 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              style={{ background: '#fdda36', color: '#514163' }}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
