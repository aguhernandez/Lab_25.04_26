import { useState } from 'react';
import { LabSession } from '../../lib/labSession';
import { updateAthletePhysiologyProfile, lockZonesToLab, fetchAthleteTrainingZones } from '../../lib/physiologyProfile';
import { TrainingZone } from '../../types';
import Toast from '../Toast';
import { useLanguage } from '../../contexts/LanguageContext';

interface Props {
  session: LabSession;
  onUpdate: (updates: Partial<LabSession>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function LabPhaseApply({ session, onUpdate, onNext, onBack }: Props) {
  const { t } = useLanguage();
  const { results, trainingZones, athlete, test } = session;
  const [applyZones, setApplyZones] = useState(true);
  const [lockZones, setLockZones] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  if (!results || !athlete || !test) return null;

  const newZones: TrainingZone[] = results.training_zones || [];
  const oldZones: TrainingZone[] = [
    ...(trainingZones?.heart_rate_zones || []),
    ...(trainingZones?.power_zones || []),
    ...(trainingZones?.pace_zones || []),
  ];

  const handleConfirm = async () => {
    setApplying(true);
    try {
      if (applyZones) {
        const { success } = await updateAthletePhysiologyProfile(athlete, test, results);
        if (!success) {
          setToast({ message: 'Failed to update profile. Please try again.', type: 'error' });
          return;
        }

        if (lockZones) {
          await lockZonesToLab(athlete.id, true);
        }

        const updatedZones = await fetchAthleteTrainingZones(athlete.id);
        onUpdate({ trainingZones: updatedZones });
      }
      onNext();
    } catch (err) {
      console.error('Apply error:', err);
      setToast({ message: 'An error occurred. Please try again.', type: 'error' });
    } finally {
      setApplying(false);
    }
  };

  const formatZoneValue = (z: TrainingZone) => {
    if (z.power_min !== undefined || z.power_max !== undefined) {
      return `${z.power_min ?? ''}–${z.power_max ?? '∞'} W`;
    }
    return `${z.hr_min ?? ''}–${z.hr_max ?? '∞'} bpm`;
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('apply.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{athlete.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {oldZones.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('apply.currentZones')}</h3>
            </div>
            <div className="p-4 space-y-2">
              {oldZones.map((z, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{z.name}</span>
                    <p className="text-xs text-gray-400">{z.description}</p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatZoneValue(z)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">{t('apply.newZones')}</h3>
          </div>
          <div className="p-4 space-y-2">
            {newZones.map((z, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{z.name}</span>
                  <p className="text-xs text-gray-400">{z.description}</p>
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-mono font-semibold">{formatZoneValue(z)}</span>
              </div>
            ))}
            {newZones.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">{t('apply.noZones')}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">{t('apply.updateOptions')}</h3>

        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={applyZones}
              onChange={e => setApplyZones(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              applyZones ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
            }`}>
              {applyZones && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{t('apply.applyZones')}</span>
            <p className="text-xs text-gray-400 mt-0.5">{t('apply.applyZonesDesc')}</p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={lockZones}
              onChange={e => setLockZones(e.target.checked)}
              disabled={!applyZones}
              className="sr-only"
            />
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              lockZones && applyZones ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
            } ${!applyZones ? 'opacity-40' : ''}`}>
              {lockZones && applyZones && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <div className={!applyZones ? 'opacity-40' : ''}>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{t('apply.lockZones')}</span>
            <p className="text-xs text-gray-400 mt-0.5">{t('apply.lockZonesDesc')}</p>
          </div>
        </label>

        {!applyZones && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg px-4 py-3">
            <p className="text-xs text-yellow-700 dark:text-yellow-400">{t('apply.zonesNotUpdated')}</p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {t('apply.backToResults')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={applying}
          className="px-8 py-2.5 bg-[#fdda36] text-[#514163] rounded-xl font-semibold text-sm hover:bg-[#fdda36]/90 transition-colors shadow-sm disabled:opacity-60"
        >
          {applying ? t('apply.updating') : t('apply.confirmUpdate')}
        </button>
      </div>
    </div>
  );
}
