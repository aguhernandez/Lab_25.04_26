import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { saveTestAnthropometry } from '../../lib/anthropometry';
import { LabSession } from '../../lib/labSession';
import { Test, TestDataPoint, UnifiedThresholds } from '../../types';
import DataInput from '../DataInput';
import BreathDataImport from './BreathDataImport';
import Toast from '../Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import type { BreathSample, DeviceProfile } from '../../types/breathData.types';

interface Props {
  session: LabSession;
  onUpdate: (updates: Partial<LabSession>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function LabPhaseStages({ session, onUpdate, onNext, onBack }: Props) {
  const { t } = useLanguage();
  const athlete = session.athlete!;
  const [currentTest, setCurrentTest] = useState<Test | null>(session.test);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [breathData, setBreathData] = useState<BreathSample[] | null>(session.breathData);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile | null>(session.deviceProfile);
  const [breathVT, setBreathVT] = useState<UnifiedThresholds | null>(null);

  useEffect(() => {
    if (!currentTest) {
      createTest();
    }
  }, []);

  const createTest = async () => {
    setCreating(true);
    setCreateError(false);
    try {
      const preTest = session.preTestData;
      const { data, error } = await supabase
        .from('tests')
        .insert([{
          athlete_id: athlete.id,
          test_date: new Date().toISOString().split('T')[0],
          sport: session.sport,
          test_type: session.testType,
          status: 'in_progress',
          test_time: preTest?.test_time ?? null,
          city: preTest?.city ?? null,
          elevation_m: preTest?.elevation_m ?? null,
          outdoor_weather: preTest?.outdoor_weather ?? null,
          indoor_temp_c: preTest?.indoor_temp_c ?? null,
          indoor_humidity_percent: preTest?.indoor_humidity_percent ?? null,
          indoor_conditions_notes: preTest?.indoor_conditions_notes ?? null,
        }])
        .select()
        .single();

      if (error) throw error;

      if (session.preTestData?.anthropometry) {
        await saveTestAnthropometry(data.id, session.preTestData.anthropometry);
      }

      setCurrentTest(data);
      onUpdate({ test: data, testId: data.id });
    } catch (err) {
      console.error('Failed to create test:', err);
      setCreateError(true);
      setToast({ message: 'Failed to create test. Please try again.', type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handleDataComplete = async (points: TestDataPoint[]) => {
    if (!currentTest) return;

    try {
      await supabase
        .from('tests')
        .update({ status: 'completed' })
        .eq('id', currentTest.id);

      onUpdate({ dataPoints: points, breathData, deviceProfile, breathVT });
      onNext();
    } catch (err) {
      console.error('Failed to complete test:', err);
      setToast({ message: 'Failed to save test. Please try again.', type: 'error' });
    }
  };

  const handleBreathDataChange = (
    samples: BreathSample[] | null,
    profile: DeviceProfile | null,
    vt: UnifiedThresholds | null
  ) => {
    setBreathData(samples);
    setDeviceProfile(profile);
    setBreathVT(vt);
  };

  const effectiveNumStages = session.numStages + (session.includeCooldown ? 1 : 0);
  const stageConfig = (session.testType === 'ramp' || session.testType === 'step')
    ? { numStages: effectiveNumStages, stageDurationSeconds: session.stageDurationSeconds }
    : undefined;

  if (creating) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('stages.preparing')}</p>
        </div>
      </div>
    );
  }

  if (createError || !currentTest) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-red-500 text-sm">{t('stages.failed')}</p>
        <button
          onClick={createTest}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
          {t('stages.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('stages.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {athlete.name} · {session.testType?.replace('_', ' ')} · {session.sport}
          </p>
        </div>
      </div>

      {session.preTestData && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl px-5 py-3 flex flex-wrap gap-4 text-sm text-green-800 dark:text-green-300">
          <span>{t('stages.weight')} <strong>{session.preTestData.anthropometry.weight_kg} kg</strong></span>
          <span>{t('stages.height')} <strong>{session.preTestData.anthropometry.height_cm} cm</strong></span>
          {session.preTestData.indoor_temp_c !== null && (
            <span>{t('stages.temp')} <strong>{session.preTestData.indoor_temp_c}°C</strong></span>
          )}
          {session.preTestData.indoor_humidity_percent !== null && (
            <span>{t('stages.humidity')} <strong>{session.preTestData.indoor_humidity_percent}%</strong></span>
          )}
          {session.preTestData.hr_rest !== null && (
            <span>{t('stages.hrRest')} <strong>{session.preTestData.hr_rest} bpm</strong></span>
          )}
        </div>
      )}

      <BreathDataImport
        breathData={breathData}
        deviceProfile={deviceProfile}
        onChange={handleBreathDataChange}
        hrmax={null}
        vo2max={null}
      />

      <DataInput
        test={currentTest}
        athlete={athlete}
        onComplete={handleDataComplete}
        onCancel={onBack}
        initialAnthropometry={session.preTestData?.anthropometry || null}
        anthropometrySource={session.preTestData?.anthropometry ? 'hub' : 'manual'}
        stageConfig={stageConfig}
      />
    </div>
  );
}
