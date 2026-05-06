import { useState } from 'react';
import { ISAK_VARIABLES, calculateMedian, calculateStdev, calculateErrorPct, sanitizeInput, type AnthropometryData, type TripleMeasurement } from '../../types/anthropometry.types';
import { ArrowRight, ArrowLeft, Save } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface StepByStepMeasurementInputProps {
  data: AnthropometryData;
  onChange: (data: AnthropometryData) => void;
  onSave: () => void;
}

const STEPS = [
  { number: 1, titleKey: 'steps.basicMeasurements', category: 'basic' as const },
  { number: 2, titleKey: 'steps.skinfolds', category: 'skinfolds' as const },
  { number: 3, titleKey: 'steps.girths', category: 'girths' as const },
  { number: 4, titleKey: 'steps.lengths', category: 'lengths' as const },
  { number: 5, titleKey: 'steps.breadths', category: 'breadths' as const },
];

export default function StepByStepMeasurementInput({ data, onChange, onSave }: StepByStepMeasurementInputProps) {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);

  const currentStepData = STEPS[currentStep - 1];
  const variables = ISAK_VARIABLES.filter(v => v.category === currentStepData.category);

  const handleTripleInput = (varName: string, measurementNum: 'm1' | 'm2' | 'm3', value: string) => {
    const numValue = sanitizeInput(value);
    const currentTriple = (data[varName] as TripleMeasurement) || {};

    const updatedTriple: TripleMeasurement = {
      ...currentTriple,
      [measurementNum]: numValue,
    };

    const median = calculateMedian(updatedTriple.m1, updatedTriple.m2, updatedTriple.m3);
    const stdev = calculateStdev(updatedTriple.m1, updatedTriple.m2, updatedTriple.m3, median);
    const error_pct = calculateErrorPct(stdev, median);

    updatedTriple.median = median;
    updatedTriple.stdev = stdev;
    updatedTriple.error_pct = error_pct;

    onChange({
      ...data,
      [varName]: updatedTriple,
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinalSave = () => {
    onSave();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-5">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className={`flex items-center ${step.number < STEPS.length ? 'flex-1' : ''}`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm"
                style={
                  step.number === currentStep
                    ? { background: '#fdda36', color: '#514163', boxShadow: '0 0 0 4px rgba(253,218,54,0.2)' }
                    : step.number < currentStep
                    ? { background: '#514163', color: '#fdda36' }
                    : { background: '#f3f4f6', color: '#9ca3af' }
                }
              >
                {step.number < currentStep ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.number}
              </div>
              {step.number < STEPS.length && (
                <div
                  className="h-0.5 flex-1 mx-2 rounded-full transition-all"
                  style={{
                    background: step.number < currentStep ? '#514163' : '#e5e7eb',
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {t('steps.title')} {currentStep}: {t(currentStepData.titleKey)}
        </h3>
      </div>

      <div className="space-y-5">
        {variables.map((variable) => {
          const triple = (data[variable.name] as TripleMeasurement) || {};
          const isRequired = variable.required;

          return (
            <div key={variable.name} className="pb-5 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                {variable.label} <span className="font-normal text-gray-400">({variable.unit})</span>
                {isRequired && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="grid grid-cols-3 gap-3 mb-2">
                {(['m1', 'm2', 'm3'] as const).map((mKey, i) => (
                  <div key={mKey}>
                    <label className="block text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">M{i + 1}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={triple[mKey] ?? ''}
                      onChange={(e) => handleTripleInput(variable.name, mKey, e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#fdda36]/50 focus:border-[#fdda36] transition-colors"
                      placeholder={`M${i + 1}`}
                    />
                  </div>
                ))}
              </div>
              {triple.median !== undefined && (
                <div className="flex gap-4 mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('steps.median')}:</span> {triple.median.toFixed(2)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('steps.sd')}:</span>{' '}
                    {triple.stdev !== undefined ? triple.stdev.toFixed(2) : 'N/A'}
                  </span>
                  <span className={`text-xs font-medium ${
                    triple.error_pct !== undefined && triple.error_pct > 10
                      ? 'text-red-500'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('steps.error')}:</span>{' '}
                    {triple.error_pct !== undefined ? `${triple.error_pct.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-8 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('steps.previous')}
        </button>

        {currentStep < STEPS.length ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: '#fdda36', color: '#514163' }}
          >
            {t('steps.next')}
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleFinalSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: '#fdda36', color: '#514163' }}
          >
            <Save className="w-4 h-4" />
            {t('steps.save')}
          </button>
        )}
      </div>
    </div>
  );
}
