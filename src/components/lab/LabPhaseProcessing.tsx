import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { LabSession } from '../../lib/labSession';
import { useLanguage } from '../../contexts/LanguageContext';
import { calculatePhysiology } from '../../lib/physiology';
import { calculateAdvancedMetrics } from '../../lib/physiology';
import { generateCompleteJSON } from '../../lib/jsonGenerator';
import { updateAthletePhysiologyProfile, fetchAthleteTrainingZones } from '../../lib/physiologyProfile';
import { PhysiologyResults } from '../../lib/physiology';
import { AdvancedMetrics } from '../../types';
import { AthleteTrainingZones } from '../../lib/physiologyProfile';

interface Props {
  session: LabSession;
  onUpdate: (updates: Partial<LabSession>) => void;
  onNext: () => void;
}

interface Step {
  label: string;
  done: boolean;
}

export default function LabPhaseProcessing({ session, onUpdate, onNext }: Props) {
  const { t } = useLanguage();
  const getSteps = () => [
    { label: t('processing.step1'), done: false },
    { label: t('processing.step2'), done: false },
    { label: t('processing.step3'), done: false },
    { label: t('processing.step4'), done: false },
    { label: t('processing.step5'), done: false },
    { label: t('processing.step6'), done: false },
    { label: t('processing.step7'), done: false },
    { label: t('processing.step8'), done: false },
  ];
  const [steps, setSteps] = useState<Step[]>(getSteps());
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const markStep = (idx: number) => {
    setSteps(prev => prev.map((s, i) => i <= idx ? { ...s, done: true } : s));
    setCurrentStep(idx + 1);
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  useEffect(() => {
    run();
  }, []);

  const run = async () => {
    try {
      const athlete = session.athlete!;
      const testId = session.testId!;

      await delay(300);

      const { data: testData } = await supabase
        .from('tests')
        .select('*')
        .eq('id', testId)
        .maybeSingle();

      const { data: rawPoints } = await supabase
        .from('test_data_points')
        .select('*')
        .eq('test_id', testId)
        .order('stage_number', { ascending: true });

      const dataPoints = rawPoints || [];
      markStep(0);
      await delay(400);

      const athleteForCalc = { ...athlete };
      if (testData?.anthropometry_snapshot) {
        const snap = testData.anthropometry_snapshot;
        athleteForCalc.weight_kg = snap.weight_kg;
        athleteForCalc.height_cm = snap.height_cm;
        athleteForCalc.sex = snap.sex;
        athleteForCalc.body_fat_percent = snap.bodyFatPercent;
        athleteForCalc.lean_body_mass_kg = snap.leanBodyMassKg;
        if (snap.age) {
          const birthYear = new Date().getFullYear() - snap.age;
          athleteForCalc.date_of_birth = `${birthYear}-01-01`;
        }
      } else if (session.preTestData) {
        const anthro = session.preTestData.anthropometry;
        athleteForCalc.weight_kg = anthro.weight_kg;
        athleteForCalc.height_cm = anthro.height_cm;
        athleteForCalc.body_fat_percent = anthro.bodyFatPercent;
        athleteForCalc.lean_body_mass_kg = anthro.leanBodyMassKg;
        athleteForCalc.sex = anthro.sex;
      }

      const breathVT = session.breathData && session.breathData.length >= 4 && session.breathVT
        ? { VT1: session.breathVT.VT1, VT2: session.breathVT.VT2, vt_source: 'direct_measurement' as const }
        : null;

      const results: PhysiologyResults = calculatePhysiology(
        athleteForCalc,
        dataPoints,
        undefined,
        breathVT
      );
      markStep(1);
      await delay(350);
      markStep(2);
      await delay(350);
      markStep(3);
      await delay(300);

      const advanced: AdvancedMetrics = calculateAdvancedMetrics(athleteForCalc, dataPoints, results, {
        recovery: session.preTestData?.hrv_ms ? {
          hrv_post_exercise_ms: null,
          time_to_hr_baseline_min: null,
          lactate_clearance: { min5: null, min10: null, min20: null },
          hr_drift_percent: results.hr_drift_percent,
        } : undefined,
      });
      markStep(4);
      await delay(300);
      markStep(5);
      await delay(300);

      generateCompleteJSON(athlete, testData, dataPoints, results, advanced);
      markStep(6);
      await delay(350);

      await supabase.from('test_results').upsert({
        test_id: testId,
        vo2max: results.vo2max,
        vo2max_measured: results.vo2max_confidence === 'measured',
        lt1_hr: results.lt1_hr,
        lt1_power: results.lt1_power,
        lt2_hr: results.lt2_hr,
        lt2_power: results.lt2_power,
        fatmax_hr: results.fatmax_hr,
        hr_drift_percent: results.hr_drift_percent,
        training_zones: results.training_zones,
        data_quality: results.data_quality,
        advanced_metrics: advanced,
        thresholds: results.thresholds,
        breath_data: session.breathData,
        device_profile_id: session.deviceProfile?.id ?? null,
      });

      const { success } = await updateAthletePhysiologyProfile(athlete, testData, results);
      const zones: AthleteTrainingZones | null = success ? await fetchAthleteTrainingZones(athlete.id) : null;
      markStep(7);
      await delay(400);

      onUpdate({
        results,
        advancedMetrics: advanced,
        trainingZones: zones,
        dataPoints,
      });

      await delay(300);
      onNext();
    } catch (err) {
      console.error('Processing error:', err);
      setError('An error occurred during processing. Please try again.');
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{t('processing.title')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('processing.subtitle')}</p>
        </div>

        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div
                key={step.label}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500 ${
                  step.done
                    ? 'bg-green-50 dark:bg-green-900/20'
                    : i === currentStep
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-gray-50 dark:bg-gray-700/30 opacity-40'
                }`}
              >
                <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                  step.done
                    ? 'bg-green-500'
                    : i === currentStep
                    ? 'border-2 border-blue-500'
                    : 'border-2 border-gray-300 dark:border-gray-600'
                }`}>
                  {step.done && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {i === currentStep && !step.done && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  )}
                </div>
                <span className={`text-sm font-medium ${
                  step.done
                    ? 'text-green-700 dark:text-green-400'
                    : i === currentStep
                    ? 'text-blue-700 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
