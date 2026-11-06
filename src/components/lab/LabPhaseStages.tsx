import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { saveTestAnthropometry } from '../../lib/anthropometry';
import { LabSession } from '../../lib/labSession';
import { Test } from '../../types';
import TimelineDataInput from './TimelineDataInput';
import Toast from '../Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import type { TimelineSample } from '../../types/timeline.types';
import { validateProtocolRun } from '../../lib/protocolEngine';
import { timelineToStages, timelineToBreath, breathToTimeline } from '../../lib/labImportPipeline';
import { calculateVentilatoryThresholds } from '../../lib/ventilatoryThresholds';

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
          protocol_id: session.protocolId,
          protocol_version: session.protocolSettings?.version ?? '1.0',
          protocol_metadata: makeProtocolMetadata(session),
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
      const mass = session.preTestData?.anthropometry.weight_kg ?? athlete.weight_kg;
      const breathData = timelineToBreath(samples, mass);
      const dataPoints = timelineToStages(samples, session.sport ?? athlete.sport, mass, session.stageDurationSeconds, session.customProtocol ? session.customStageDurations : undefined);
      if (!dataPoints.length && !breathData.some(s => s.vo2_rel_mlkgmin != null || s.vo2_abs_mlmin != null)) throw new Error('No usable measurements. Map time and at least heart rate, lactate, VO₂ or external load.');
      const maxHR = Math.max(0, ...samples.map(s => s.heart_rate ?? 0));
      const vt = maxHR > 0 && breathData.length >= 4 ? calculateVentilatoryThresholds(breathData, maxHR, null, breathData.some(s => s.vco2_mlmin != null)) : null;
      const emptyThreshold = { hr: null, vo2: null, power: null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'estimated' as const };
      const breathVT: LabSession['breathVT'] = vt ? { LT1: emptyThreshold, LT2: emptyThreshold, VT1: vt.VT1, VT2: vt.VT2, vt_source: 'direct_measurement', delta_lt1_vt1_hr: null, delta_lt2_vt2_hr: null } : null;
      const imports = collectImports(samples, session.protocolSettings?.imports ?? [], session.breathImportMetadata);
      const firstImport = imports[0];
      const environment = makeProtocolMetadata(session).environment as NonNullable<NonNullable<LabSession['protocolSettings']>['environment']>;
      const validationSettings = session.protocolSettings ? {
        ...session.protocolSettings,
        imports,
        deviceName: session.protocolSettings.deviceName ?? firstImport?.deviceName ?? null,
        deviceCalibrationDate: session.protocolSettings.deviceCalibrationDate ?? firstImport?.calibrationDate ?? null,
        samplingFrequencyHz: session.protocolSettings.samplingFrequencyHz ?? firstImport?.sampleFrequencyHz ?? null,
        environment: session.protocolSettings.environment ?? environment,
      } : null;
      const validation = session.protocolId && session.protocolSettings
        ? validateProtocolRun({ protocolId: session.protocolId, settings: validationSettings!, timelineSamples: samples, breathSamples: breathData })
        : null;
      const updatedProtocolSettings = session.protocolSettings && validation
        ? { ...validationSettings!, validation }
        : session.protocolSettings;
      if (updatedProtocolSettings) {
        const { error: protocolError } = await supabase.from('tests').update({
          protocol_version: updatedProtocolSettings.version,
          protocol_metadata: { ...makeProtocolMetadata(session), ...updatedProtocolSettings, validation },
        }).eq('id', currentTest.id);
        if (protocolError) throw protocolError;
      }

      // Also save as test_data_points for backward compatibility
      if (dataPoints.length > 0) {
        const { error: deleteError } = await supabase.from('test_data_points').delete().eq('test_id', currentTest.id);
        if (deleteError) throw deleteError;
        const pointsToInsert = dataPoints.map(p => ({
          test_id: currentTest.id,
          stage_number: Math.max(1, Math.round(Number(p.stage_number))),
          duration_seconds: Math.max(1, Math.round(Number(p.duration_seconds))),
          heart_rate: Math.round(Number(p.heart_rate)),
          power_watts: p.power_watts,
          speed_pace: p.speed_pace,
          vo2_ml_kg_min: p.vo2_ml_kg_min,
          lactate: p.lactate,
          rpe: p.rpe != null ? Math.round(Number(p.rpe)) : null,
          vt1_marker: p.vt1_marker,
          vt2_marker: p.vt2_marker,
        }));
        const { error: insertErr } = await supabase.from('test_data_points').insert(pointsToInsert);
        if (insertErr) throw insertErr;
      }

      const { error: completeError } = await supabase.from('tests').update({ status: 'completed' }).eq('id', currentTest.id);
      if (completeError) throw completeError;

      onUpdate({ dataPoints, breathData: breathData.length ? breathData : null, breathVT, protocolSettings: updatedProtocolSettings });
      if (validation?.status === 'incomplete') {
        setToast({ message: `Protocol saved for review: ${validation.errors[0]?.replace(/_/g, ' ')}`, type: 'error' });
      } else if (validation?.status === 'review') {
        setToast({ message: `Protocol saved with ${validation.warnings.length} quality note(s).`, type: 'success' });
      }
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
        initialSamples={session.breathData?.length ? breathToTimeline(session.breathData, session.preTestData?.anthropometry.weight_kg ?? athlete.weight_kg) : undefined}
        recordedCalibration={session.protocolSettings?.deviceCalibrationDate ?? session.breathImportMetadata?.calibrationDate}
        plannedStages={session.protocolId === 'incremental_lactate' ? Array.from({ length: session.numStages }, (_, index) => { const duration = session.customProtocol ? session.customStageDurations[index] ?? session.stageDurationSeconds : session.stageDurationSeconds; return { step: index + 1, label: `Estadio ${index + 1}`, speed_pace: '', target_duration_s: duration, lactate_at_s: duration }; }) : undefined}
        onComplete={handleTimelineComplete}
        onCancel={onBack}
      />
    </div>
  );
}

function makeProtocolMetadata(session: LabSession): Record<string, unknown> {
  const settings = session.protocolSettings;
  const environment = {
    temperatureC: session.preTestData?.indoor_temp_c ?? session.preTestData?.outdoor_weather?.temperature_c ?? null,
    humidityPercent: session.preTestData?.indoor_humidity_percent ?? session.preTestData?.outdoor_weather?.humidity_percent ?? null,
    altitudeM: session.preTestData?.elevation_m ?? null,
  };
  return {
    ...(settings ?? {}),
    stageDurationSeconds: session.customProtocol ? null : session.stageDurationSeconds,
    stageDurationsSeconds: session.customProtocol ? session.customStageDurations : [],
    environment,
    imports: collectImports([], settings?.imports ?? [], session.breathImportMetadata),
  };
}

function collectImports(
  samples: TimelineSample[],
  existing: NonNullable<LabSession['protocolSettings']>['imports'] = [],
  breathImport: LabSession['breathImportMetadata'] = null,
) {
  const imports = new Map((existing ?? []).map((item) => [item.importId, item]));
  if (breathImport) imports.set(breathImport.importId, breathImport);
  samples.forEach((sample) => {
    const provenance = sample.provenance;
    if (!provenance || imports.has(provenance.importId)) return;
    imports.set(provenance.importId, {
      importId: provenance.importId,
      format: provenance.format,
      fileName: provenance.fileName,
      importedAt: provenance.importedAt,
      source: provenance.source,
      deviceName: provenance.deviceName,
      deviceProfileId: provenance.deviceProfileId,
      sampleFrequencyHz: provenance.sampleFrequencyHz,
      units: provenance.units,
      calibrationDate: provenance.calibrationDate,
      calibrationNotes: provenance.calibrationNotes,
      columnMapping: provenance.columnMapping,
      transformations: provenance.transformations,
      recordCount: samples.filter((row) => row.provenance?.importId === provenance.importId).length,
    });
  });
  return [...imports.values()];
}
