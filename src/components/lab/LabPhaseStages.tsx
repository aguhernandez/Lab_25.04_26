import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { saveTestAnthropometry } from '../../lib/anthropometry';
import { LabSession } from '../../lib/labSession';
import { Test, TestDataPoint } from '../../types';
import TimelineDataInput from './TimelineDataInput';
import Toast from '../Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import type { TimelineSample } from '../../types/timeline.types';

interface Props {
  session: LabSession;
  onUpdate: (updates: Partial<LabSession>) => void;
  onNext: () => void;
  onBack: () => void;
}

function samplesToDataPoints(samples: TimelineSample[]): TestDataPoint[] {
  const sorted = [...samples].sort((a, b) => a.timestamp_s - b.timestamp_s);
  const groups: TimelineSample[][] = [];
  let currentGroup: TimelineSample[] = [];
  let lastSpeed: string | null = null;

  for (const s of sorted) {
    if (s.speed_pace && s.speed_pace !== lastSpeed && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [];
    }
    currentGroup.push(s);
    if (s.speed_pace) lastSpeed = s.speed_pace;
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;

  return groups
    .map((group, idx) => {
      const heartRates = group.map(g => g.heart_rate).filter((v): v is number => v != null);
      const vo2s = group.map(g => g.vo2_ml_kg_min).filter((v): v is number => v != null);
      const lactates = group.map(g => g.lactate).filter((v): v is number => v != null);
      const rpes = group.map(g => g.rpe).filter((v): v is number => v != null);
      const speeds = group.map(g => g.speed_pace).filter((v): v is string => v != null);

      const hr = avg(heartRates);
      if (hr == null) return null;

      return {
        id: crypto.randomUUID(),
        test_id: '',
        stage_number: idx + 1,
        duration_seconds: group.length > 1
          ? Math.round(group[group.length - 1].timestamp_s - group[0].timestamp_s)
          : 180,
        heart_rate: hr,
        power_watts: null,
        speed_pace: speeds[0] ?? null,
        vo2_ml_kg_min: avg(vo2s),
        vco2_ml_kg_min: null,
        lactate: avg(lactates),
        rpe: avg(rpes),
        vt1_marker: false,
        vt2_marker: false,
        created_at: new Date().toISOString(),
      } as TestDataPoint;
    })
    .filter((p): p is TestDataPoint => p !== null);
}

export default function LabPhaseStages({ session, onUpdate, onNext, onBack }: Props) {
  const { t } = useLanguage();
  const athlete = session.athlete!;
  const [currentTest, setCurrentTest] = useState<Test | null>(session.test);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  const handleTimelineComplete = async (samples: TimelineSample[]) => {
    if (!currentTest) return;

    try {
      // Convert timeline samples to TestDataPoint format for the existing calculation engine
      const dataPoints = samplesToDataPoints(samples);

      // Also save as test_data_points for backward compatibility
      if (dataPoints.length > 0) {
        await supabase.from('test_data_points').delete().eq('test_id', currentTest.id);
        const pointsToInsert = dataPoints.map(p => ({
          test_id: currentTest.id,
          stage_number: Math.max(1, Math.round(Number(p.stage_number))),
          duration_seconds: Math.max(1, Math.round(Number(p.duration_seconds))),
          heart_rate: p.heart_rate,
          power_watts: p.power_watts,
          speed_pace: p.speed_pace,
          vo2_ml_kg_min: p.vo2_ml_kg_min,
          lactate: p.lactate,
          rpe: p.rpe,
          vt1_marker: p.vt1_marker,
          vt2_marker: p.vt2_marker,
        }));
        const { error: insertErr } = await supabase.from('test_data_points').insert(pointsToInsert);
        if (insertErr) throw insertErr;
      }

      await supabase
        .from('tests')
        .update({ status: 'completed' })
        .eq('id', currentTest.id);

      onUpdate({ dataPoints });
      onNext();
    } catch (err) {
      console.error('Failed to complete test:', err);
      setToast({ message: 'Failed to save test. Please try again.', type: 'error' });
    }
  };

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

      <TimelineDataInput
        testId={currentTest.id}
        onComplete={handleTimelineComplete}
        onCancel={onBack}
      />
    </div>
  );
}
