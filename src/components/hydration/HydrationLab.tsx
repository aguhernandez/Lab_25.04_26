import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Athlete } from '../../types';
import { HydrationInput, HydrationResults, HydrationProfile } from '../../lib/hydration';
import HydrationLabForm from './HydrationLabForm';
import HydrationResultsDisplay from './HydrationResults';
import Toast from '../Toast';
import { useLanguage } from '../../contexts/LanguageContext';

interface HydrationLabProps {
  athlete: Athlete;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

export default function HydrationLab({ athlete }: HydrationLabProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<'form' | 'results'>('form');
  const [currentInput, setCurrentInput] = useState<HydrationInput | null>(null);
  const [currentResults, setCurrentResults] = useState<HydrationResults | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [existingProfile, setExistingProfile] = useState<HydrationProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [athlete.id]);

  const loadProfile = async () => {
    try {
      setLoadingProfile(true);
      const { data } = await supabase
        .from('athlete_hydration_profiles')
        .select('*')
        .eq('athlete_id', athlete.id)
        .maybeSingle();
      setExistingProfile(data);
    } catch {
      // no profile yet
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCalculated = (input: HydrationInput, results: HydrationResults) => {
    setCurrentInput(input);
    setCurrentResults(results);
    setStep('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!currentInput || !currentResults) return;
    setSaving(true);

    try {
      const sessionPayload = {
        athlete_id: athlete.id,
        session_date: currentInput.sessionDate,
        pre_weight_kg: currentInput.preWeight_kg,
        post_weight_kg: currentInput.postWeight_kg,
        fluid_intake_ml: currentInput.fluidIntake_mL ?? 0,
        urine_output_ml: currentInput.urineOutput_mL ?? 0,
        duration_min: currentInput.duration_min,
        temperature_c: currentInput.temperature_C ?? null,
        humidity_percent: currentInput.humidity_percent ?? null,
        avg_hr: currentInput.avgHR ?? null,
        rpe: currentInput.rpe ?? null,
        usg_pre: currentInput.usg_pre ?? null,
        usg_post: currentInput.usg_post ?? null,
        adjusted_sweat_loss_kg: currentResults.adjustedSweatLoss_kg,
        percent_dehydration: currentResults.percentDehydration,
        sweat_rate_l_h: currentResults.sweatRate_L_h,
        heat_stress_factor: currentResults.heatStressFactor,
        hydration_stress_score: currentResults.hydrationStressScore,
        stress_classification: currentResults.stressClassification,
        usg_classification: currentResults.usgPreClassification,
        usg_post_classification: currentResults.usgPostClassification,
        notes: currentInput.notes ?? null,
      };

      const { error: sessionError } = await supabase
        .from('athlete_hydration_sessions')
        .insert(sessionPayload);

      if (sessionError) throw sessionError;

      const historyEntry = {
        date: currentInput.sessionDate,
        percentDehydration: currentResults.percentDehydration,
        sweatRate_L_h: currentResults.sweatRate_L_h,
        hydrationStressScore: currentResults.hydrationStressScore,
        classification: currentResults.stressClassification,
        temperature_C: currentInput.temperature_C ?? null,
        humidity_percent: currentInput.humidity_percent ?? null,
        usg_pre: currentInput.usg_pre ?? null,
        usg_post: currentInput.usg_post ?? null,
      };

      const prevHistory: typeof historyEntry[] = existingProfile?.history || [];
      const newHistory = [historyEntry, ...prevHistory];

      const allSweatRates = newHistory.map(h => h.sweatRate_L_h);
      const avgSweatRate = allSweatRates.reduce((a, b) => a + b, 0) / allSweatRates.length;

      const allDehydrations = newHistory.map(h => h.percentDehydration);
      const maxDehydration = Math.max(...allDehydrations);

      const profilePayload = {
        athlete_id: athlete.id,
        baseline_usg: currentInput.usg_pre ?? existingProfile?.baseline_usg ?? null,
        classification_pre_session: currentResults.usgPreClassification ?? existingProfile?.classification_pre_session ?? null,
        last_session_date: currentInput.sessionDate,
        last_percent_dehydration: currentResults.percentDehydration,
        last_sweat_rate_l_h: currentResults.sweatRate_L_h,
        last_hydration_stress_score: currentResults.hydrationStressScore,
        last_classification: currentResults.stressClassification,
        last_temperature_c: currentInput.temperature_C ?? null,
        last_humidity_percent: currentInput.humidity_percent ?? null,
        average_sweat_rate_l_h: Math.round(avgSweatRate * 1000) / 1000,
        max_observed_dehydration_percent: maxDehydration,
        total_sessions: newHistory.length,
        history: newHistory,
        hydration_warning: currentResults.hydrationWarning,
        performance_risk: currentResults.performanceRisk,
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('athlete_hydration_profiles')
        .upsert(profilePayload, { onConflict: 'athlete_id' });

      if (profileError) throw profileError;

      await loadProfile();
      setToast({ message: 'Hydration assessment saved and athlete profile updated.', type: 'success' });
      setStep('form');
      setCurrentInput(null);
      setCurrentResults(null);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to save assessment. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2.5">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('hydration.title')}</h2>
              <p className="text-blue-100 text-sm mt-0.5">{athlete.name}</p>
            </div>
          </div>
        </div>

        {!loadingProfile && existingProfile && (
          <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800">
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">{t('hydration.sessionsRecorded')} </span>
                <span className="text-gray-700 dark:text-gray-300">{existingProfile.total_sessions}</span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">{t('hydration.avgSweatRate')} </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {existingProfile.average_sweat_rate_l_h?.toFixed(3)} L/h
                </span>
              </div>
              <div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">{t('hydration.maxDehydration')} </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {existingProfile.max_observed_dehydration_percent?.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          {step === 'form' ? (
            <HydrationLabForm onCalculated={handleCalculated} />
          ) : (
            currentInput && currentResults && (
              <HydrationResultsDisplay
                input={currentInput}
                results={currentResults}
                onSave={handleSave}
                onReset={() => { setStep('form'); setCurrentInput(null); setCurrentResults(null); }}
                saving={saving}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
