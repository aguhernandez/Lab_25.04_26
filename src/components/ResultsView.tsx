import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Athlete, Test, TestDataPoint, TrainingZone, AdvancedMetrics } from '../types';
import { calculatePhysiology, calculateAdvancedMetrics, PhysiologyResults, type TimelineHRSample } from '../lib/physiology';
import ReportBuilder from './reports/ReportBuilder';
import type { ReportData } from '../lib/reportGenerator';
import { generateCompleteJSON, exportJSONToFile, getJSONSummary, MetabolicLabJSON } from '../lib/jsonGenerator';
import { updateAthletePhysiologyProfile, fetchAthleteTrainingZones, AthleteTrainingZones } from '../lib/physiologyProfile';
import type { ZoneDefinition } from '../lib/trainingZones';
import type { PreTestData } from '../lib/labSession';
import type { AnthropometryMeasurement, KerrResults } from '../types/anthropometry.types';
import MetabolicProfile from './MetabolicProfile';
import TrainingZonesTable from './TrainingZonesTable';
import AdvancedData from './AdvancedData';
import CoachNotes from './CoachNotes';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';
import VO2ReferenceComparison from './VO2ReferenceComparison';
import EditDataModal from './EditDataModal';
import { RefreshCw, Save, FileDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { createModelResultProvenance, type ModelResultProvenance } from '../lib/scientificValidation';
import MetabolicFingerprint from './MetabolicFingerprint';
import ScientificModelPanel from './ScientificModelPanel';

interface ResultsViewProps {
  testId: string;
  onTestDeleted?: () => void;
}

interface ToastMessage {
  message: string;
  type: 'success' | 'error';
}

interface SavedSnapshot {
  results: PhysiologyResults;
  advancedMetrics: AdvancedMetrics | null;
  savedAt: string;
  modelProvenance?: ModelResultProvenance;
}

export default function ResultsView({ testId, onTestDeleted }: ResultsViewProps) {
  const { language } = useLanguage();
  const [test, setTest] = useState<Test | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [dataPoints, setDataPoints] = useState<TestDataPoint[]>([]);
  const [results, setResults] = useState<PhysiologyResults | null>(null);
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedMetrics | null>(null);
  const [completeJSON, setCompleteJSON] = useState<MetabolicLabJSON | null>(null);
  const [showJSONSummary, setShowJSONSummary] = useState(false);
  const [activeSection, setActiveSection] = useState<'overview' | 'curves' | 'thresholds' | 'quality'>('overview');
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [profileSynced, setProfileSynced] = useState(false);
  const [syncingProfile, setSyncingProfile] = useState(false);
  const [trainingZones, setTrainingZones] = useState<AthleteTrainingZones | null>(null);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [showEditData, setShowEditData] = useState(false);
  const [preTestData, setPreTestData] = useState<PreTestData | null>(null);
  const [anthropometryMeasurement, setAnthropometryMeasurement] = useState<AnthropometryMeasurement | null>(null);
  const [kerrResults, setKerrResults] = useState<KerrResults | null>(null);
  const [timelineSamples, setTimelineSamples] = useState<TimelineHRSample[] | null>(null);

  // Persisted state tracking
  const [hasSavedResults, setHasSavedResults] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showRecalculateConfirm, setShowRecalculateConfirm] = useState(false);
  const [pendingResults, setPendingResults] = useState<PhysiologyResults | null>(null);
  const [pendingAdvanced, setPendingAdvanced] = useState<AdvancedMetrics | null>(null);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Keep a reference to the saved snapshot so we can revert on cancel
  const [savedSnapshot, setSavedSnapshot] = useState<SavedSnapshot | null>(null);

  useEffect(() => {
    loadTestData();
  }, [testId]);

  const regenerateJSON = useCallback(
    (athleteData: Athlete, testData: Test, points: TestDataPoint[], calcResults: PhysiologyResults, advanced: AdvancedMetrics | null) => {
      const json = generateCompleteJSON(athleteData, testData, points, calcResults, advanced ?? undefined);
      setCompleteJSON(json);
    },
    []
  );

  const loadTestData = async () => {
    try {
      setLoading(true);

      const { data: testData, error: testError } = await supabase
        .from('tests')
        .select('*')
        .eq('id', testId)
        .maybeSingle();

      if (testError) throw testError;
      if (!testData) throw new Error('Test not found');

      setTest(testData);

      const td = testData as Record<string, unknown>;
      setPreTestData({
        anthropometry: {} as any,
        test_time: (td.test_time as string) ?? null,
        city: (td.city as string) ?? null,
        elevation_m: (td.elevation_m as number) ?? null,
        outdoor_weather: (td.outdoor_weather as any) ?? null,
        indoor_temp_c: (td.indoor_temp_c as number) ?? null,
        indoor_humidity_percent: (td.indoor_humidity_percent as number) ?? null,
        indoor_conditions_notes: (td.indoor_conditions_notes as string) ?? null,
        usg: null,
        hr_rest: null,
        hrv_ms: null,
        basal_lactate: null,
        rmr_kcal: null,
      });

      const { data: athleteData, error: athleteError } = await supabase
        .from('athletes')
        .select('*')
        .eq('id', testData.athlete_id)
        .maybeSingle();

      if (athleteError) throw athleteError;
      if (!athleteData) throw new Error('Athlete not found');

      setAthlete(athleteData);

      const { data: dataPointsData, error: dataPointsError } = await supabase
        .from('test_data_points')
        .select('*')
        .eq('test_id', testId)
        .order('stage_number', { ascending: true });

      if (dataPointsError) throw dataPointsError;

      setDataPoints(dataPointsData || []);

      const { data: timelineData } = await supabase
        .from('test_timeline_samples')
        .select('timestamp_s, heart_rate, speed_pace, lactate, rpe, vo2_ml_kg_min')
        .eq('test_id', testId)
        .order('timestamp_s', { ascending: true });
      setTimelineSamples((timelineData as TimelineHRSample[]) ?? null);

      // Load anthropometry for report
      const [{ data: anthroRow }, { data: kerrRow }] = await Promise.all([
        supabase
          .from('anthropometry_measurements')
          .select('*')
          .eq('athlete_id', athleteData.id)
          .order('measurement_date', { ascending: false })
          .limit(1),
        supabase
          .from('anthropometry_kerr_results')
          .select('*')
          .eq('athlete_id', athleteData.id)
          .order('calculation_date', { ascending: false })
          .limit(1),
      ]);
      setAnthropometryMeasurement((anthroRow?.[0] as AnthropometryMeasurement) ?? null);
      setKerrResults((kerrRow?.[0] as KerrResults) ?? null);

      // Fetch saved test_results row
      const { data: testResultsRow, error: trError } = await supabase
        .from('test_results')
        .select('*')
        .eq('test_id', testId)
        .maybeSingle();

      if (trError) {
        console.error('Failed to fetch test_results:', trError);
      }

      const snapshot = (testResultsRow as Record<string, unknown>)?.results_snapshot as SavedSnapshot | undefined;
      const savedAt = (testResultsRow as Record<string, unknown>)?.saved_at as string | undefined;
      let loadedAdvanced: AdvancedMetrics | null = snapshot?.advancedMetrics ?? null;

      if (snapshot && snapshot.results) {
        // Preserve saved results and manual metrics, but refresh economy from measured stages.
        const athleteForEconomy = { ...athleteData, sport: testData.sport };
        if (testData.anthropometry_snapshot) {
          athleteForEconomy.weight_kg = testData.anthropometry_snapshot.weight_kg;
          athleteForEconomy.body_fat_percent = testData.anthropometry_snapshot.bodyFatPercent;
          athleteForEconomy.lean_body_mass_kg = testData.anthropometry_snapshot.leanBodyMassKg;
        }
        const recalculatedAdvanced = calculateAdvancedMetrics(
          athleteForEconomy,
          (dataPointsData || []) as TestDataPoint[],
          snapshot.results,
          undefined,
          testData.sport,
        );
        loadedAdvanced = snapshot.advancedMetrics
          ? { ...snapshot.advancedMetrics, movementEconomy: recalculatedAdvanced.movementEconomy }
          : recalculatedAdvanced;
        setResults(snapshot.results);
        setAdvancedMetrics(loadedAdvanced);
        setSavedSnapshot({ results: snapshot.results, advancedMetrics: loadedAdvanced, savedAt: savedAt ?? '', modelProvenance: snapshot.modelProvenance });
        setHasSavedResults(true);
        setIsSaved(true);
        setIsDirty(false);
        regenerateJSON(athleteData, testData, dataPointsData || [], snapshot.results, loadedAdvanced);
      } else {
        // No saved snapshot — calculate from raw data (first load of a new test)
        const athleteForCalculations = { ...athleteData };

        if (testData.anthropometry_snapshot) {
          athleteForCalculations.weight_kg = testData.anthropometry_snapshot.weight_kg;
          athleteForCalculations.height_cm = testData.anthropometry_snapshot.height_cm;
          athleteForCalculations.sex = testData.anthropometry_snapshot.sex;
          athleteForCalculations.body_fat_percent = testData.anthropometry_snapshot.bodyFatPercent;
          athleteForCalculations.lean_body_mass_kg = testData.anthropometry_snapshot.leanBodyMassKg;

          const birthYear = new Date().getFullYear() - testData.anthropometry_snapshot.age;
          athleteForCalculations.date_of_birth = `${birthYear}-01-01`;
        }

        const thresholdOverrides = testData.anthropometry_snapshot?.threshold_overrides;
        const calculated = calculatePhysiology(athleteForCalculations, dataPointsData || [], thresholdOverrides);
        const advanced = calculateAdvancedMetrics(athleteForCalculations, dataPointsData || [], calculated, undefined, testData.sport);

        setResults(calculated);
        setAdvancedMetrics(advanced);
        setHasSavedResults(false);
        setIsSaved(false);
        setIsDirty(true);
        regenerateJSON(athleteData, testData, dataPointsData || [], calculated, advanced);
      }

      // Load training zones. Manual profile zones are authoritative for the test display.
      const zones = await fetchAthleteTrainingZones(athleteData.id);
      setTrainingZones(zones);

      if (zones?.mode === 'manual_override' && zones.heart_rate_zones.length > 0) {
        const currentResults = snapshot?.results;
        if (currentResults) {
          const profileZones = zones.heart_rate_zones as TrainingZone[];
          const mergedResults: PhysiologyResults = {
            ...currentResults,
            training_zones: profileZones,
            zones_data: {
              ...currentResults.zones_data,
              zones5: profileZones,
              defaultDisplay: '5',
            },
          };
          setResults(mergedResults);
          setSavedSnapshot({
            results: mergedResults,
            advancedMetrics: loadedAdvanced,
            savedAt: savedAt ?? '',
            modelProvenance: snapshot?.modelProvenance,
          });
          regenerateJSON(athleteData, testData, dataPointsData || [], mergedResults, loadedAdvanced);
        }
      }

      // Check if profile was previously synced
      if (testResultsRow) {
        setProfileSynced(true);
      }
    } catch (err) {
      console.error('Failed to load test data:', err);
    } finally {
      setLoading(false);
    }
  };

  const doCalculation = useCallback((): { results: PhysiologyResults; advanced: AdvancedMetrics } | null => {
    if (!test || !athlete || dataPoints.length === 0) return null;

    const athleteForCalculations = { ...athlete };

    if (test.anthropometry_snapshot) {
      athleteForCalculations.weight_kg = test.anthropometry_snapshot.weight_kg;
      athleteForCalculations.height_cm = test.anthropometry_snapshot.height_cm;
      athleteForCalculations.sex = test.anthropometry_snapshot.sex;
      athleteForCalculations.body_fat_percent = test.anthropometry_snapshot.bodyFatPercent;
      athleteForCalculations.lean_body_mass_kg = test.anthropometry_snapshot.leanBodyMassKg;

      const birthYear = new Date().getFullYear() - test.anthropometry_snapshot.age;
      athleteForCalculations.date_of_birth = `${birthYear}-01-01`;
    }

    const thresholdOverrides = test.anthropometry_snapshot?.threshold_overrides;
    const calculated = calculatePhysiology(athleteForCalculations, dataPoints, thresholdOverrides);
    const advanced = calculateAdvancedMetrics(athleteForCalculations, dataPoints, calculated, undefined, test.sport);

    return { results: calculated, advanced };
  }, [test, athlete, dataPoints]);

  const handleRecalculate = () => {
    if (!test || !athlete) return;
    setRecalculating(true);
    try {
      const calc = doCalculation();
      if (!calc) return;
      // Store pending results without overwriting current display
      setPendingResults(calc.results);
      setPendingAdvanced(calc.advanced);
      setShowRecalculateConfirm(true);
    } finally {
      setRecalculating(false);
    }
  };

  const confirmRecalculate = () => {
    if (pendingResults) {
      setResults(pendingResults);
      setAdvancedMetrics(pendingAdvanced);
      setIsDirty(true);
      setIsSaved(false);
      if (athlete && test) {
        regenerateJSON(athlete, test, dataPoints, pendingResults, pendingAdvanced);
      }
      setToast({ message: 'Results recalculated. Click "Save" to persist the new values.', type: 'success' });
    }
    setShowRecalculateConfirm(false);
    setPendingResults(null);
    setPendingAdvanced(null);
  };

  const cancelRecalculate = () => {
    // Revert to saved state
    if (savedSnapshot) {
      setResults(savedSnapshot.results);
      setAdvancedMetrics(savedSnapshot.advancedMetrics);
      if (athlete && test) {
        regenerateJSON(athlete, test, dataPoints, savedSnapshot.results, savedSnapshot.advancedMetrics);
      }
    }
    setShowRecalculateConfirm(false);
    setPendingResults(null);
    setPendingAdvanced(null);
  };

  const handleSave = async () => {
    if (!test || !results || !athlete) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const snapshot: SavedSnapshot = {
        results,
        advancedMetrics: advancedMetrics ?? null,
        savedAt: now,
        modelProvenance: createModelResultProvenance(test, athlete, dataPoints, now),
      };

      const { error } = await supabase
        .from('test_results')
        .upsert({
          test_id: test.id,
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
          advanced_metrics: advancedMetrics ?? null,
          thresholds: results.thresholds ?? null,
          results_snapshot: snapshot as unknown as Record<string, unknown>,
          saved_at: now,
        }, { onConflict: 'test_id' });

      if (error) throw error;

      setSavedSnapshot(snapshot);
      setHasSavedResults(true);
      setIsSaved(true);
      setIsDirty(false);
      setToast({ message: 'Results saved successfully.', type: 'success' });
    } catch (err) {
      console.error('Failed to save results:', err);
      setToast({ message: 'Failed to save results. Please try again.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportJSON = () => {
    if (completeJSON) {
      exportJSONToFile(completeJSON);
    }
  };

  const handleApplyPhysiologyToProfile = async () => {
    if (!athlete || !test || !results) return;
    setSyncingProfile(true);
    try {
      const { success } = await updateAthletePhysiologyProfile(athlete, test, results);
      if (success) {
        const zones = await fetchAthleteTrainingZones(athlete.id);
        setTrainingZones(zones);
        setProfileSynced(true);
        setToast({ message: 'Physiology profile updated and zones applied to athlete.', type: 'success' });
      } else {
        setToast({ message: 'Failed to update profile. Please try again.', type: 'error' });
      }
    } finally {
      setSyncingProfile(false);
    }
  };

  const handleZonesSaved = (updatedZones: ZoneDefinition[]) => {
    if (trainingZones) {
      setTrainingZones({
        ...trainingZones,
        ...(updatedZones.some(z => z.hr_min != null || z.hr_max != null) ? { heart_rate_zones: updatedZones as any } : {}),
        ...(updatedZones.some(z => z.power_min != null || z.power_max != null || z.power_label) ? { power_zones: updatedZones as any } : {}),
        ...(updatedZones.some(z => z.pace_min || z.pace_max) ? { pace_zones: updatedZones as any } : {}),
        mode: 'manual_override',
        last_modified_by: 'coach',
        last_modified_at: new Date().toISOString(),
      });
    }
    // Also update the results state so Save persists the edited zones in the snapshot
    if (results) {
      setResults({
        ...results,
        training_zones: updatedZones as any,
        zones_data: {
          ...results.zones_data,
          ...(updatedZones.length === 7 ? { zones7: updatedZones } : { zones5: updatedZones }),
          defaultDisplay: updatedZones.length === 7 ? '7' : '5',
        },
      });
    }
    setIsDirty(true);
    setIsSaved(false);
  };

  const handleDeleteTest = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteTest = async () => {
    try {
      const { error: dataPointsError } = await supabase
        .from('test_data_points')
        .delete()
        .eq('test_id', testId);

      if (dataPointsError) throw dataPointsError;

      const { error: resultsError } = await supabase
        .from('test_results')
        .delete()
        .eq('test_id', testId);

      if (resultsError) throw resultsError;

      const { error: testError } = await supabase
        .from('tests')
        .delete()
        .eq('id', testId);

      if (testError) throw testError;

      setShowDeleteConfirm(false);

      if (onTestDeleted) {
        onTestDeleted();
      }
    } catch (err) {
      console.error('Failed to delete test:', err);
      setToast({ message: 'Failed to delete test. Please try again.', type: 'error' });
    }
  };

  if (loading || !results || !test || !athlete) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400">Loading results...</p>
      </div>
    );
  }

  if (showReportBuilder) {
    const reportData: ReportData = {
      athlete,
      test,
      physiologyResults: results,
      dataPoints,
      advancedMetrics,
      anthropometryMeasurement,
      kerrResults,
      hydrationSessions: [],
      preTestData,
    };
    return (
      <div className="space-y-8">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <ReportBuilder
          data={reportData}
          defaultType="lab"
          onClose={() => setShowReportBuilder(false)}
          manualTrainingZones={results?.training_zones?.[0]?.calculation ? results.training_zones : trainingZones?.heart_rate_zones}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {isDirty && !isSaved && (
        <div className="flex items-center gap-2 border-l-4 border-amber-500 bg-amber-50 px-4 py-2.5 dark:bg-amber-900/20">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {hasSavedResults
              ? (language === 'es' ? 'Hay cambios sin guardar. Guarda para conservarlos.' : 'You have unsaved changes. Save to keep them.')
              : (language === 'es' ? 'Test nuevo: los resultados están calculados, pero aún no se guardaron.' : 'New test: results are calculated but have not been saved yet.')}
          </span>
        </div>
      )}
      {isSaved && !isDirty && (
        <div className="flex items-center gap-2 border-l-4 border-green-500 bg-green-50 px-4 py-2.5 dark:bg-green-900/20">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            {language === 'es' ? 'Resultados guardados' : 'Results saved'}
            {savedSnapshot?.savedAt ? ` · ${new Date(savedSnapshot.savedAt).toLocaleString()}` : ''}
          </span>
        </div>
      )}

      <header className="border-y border-gray-200 py-5 dark:border-gray-700">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <img src="/logo_transp.png" alt="Asciende" className="h-11 w-auto object-contain" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B5D7B] dark:text-violet-300">
                {language === 'es' ? 'Laboratorio metabólico' : 'Metabolic lab'}
              </p>
              <h1 className="mt-0.5 truncate text-2xl font-semibold text-gray-900 dark:text-white">
                {language === 'es' ? 'Resultados fisiológicos' : 'Physiology results'}
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-800 dark:text-gray-200">{athlete.name}</span>
                {' · '}{new Date(test.test_date).toLocaleDateString(language === 'es' ? 'es' : 'en')}
                {' · '}{test.sport.replace('_', ' ')}
                {' · '}{test.test_type.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleRecalculate} disabled={recalculating} className="inline-flex items-center gap-2 border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
              <RefreshCw className={`h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
              {language === 'es' ? 'Recalcular' : 'Recalculate'}
            </button>
            <button onClick={handleSave} disabled={saving || (!isDirty && isSaved)} className="inline-flex items-center gap-2 bg-[#5A4E6B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#493e58] disabled:opacity-50">
              <Save className="h-4 w-4" />
              {saving ? (language === 'es' ? 'Guardando…' : 'Saving…') : (language === 'es' ? 'Guardar' : 'Save')}
            </button>
            <button onClick={() => setShowReportBuilder(true)} className="inline-flex items-center gap-2 bg-[#fdda36] px-4 py-2 text-sm font-semibold text-[#514163] transition-colors hover:bg-[#fdda36]/90">
              <FileDown className="h-4 w-4" />
              {language === 'es' ? 'Exportar informe' : 'Export report'}
            </button>
            <details className="relative">
              <summary className="cursor-pointer list-none border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
                {language === 'es' ? 'Más acciones' : 'More actions'}
              </summary>
              <div className="absolute right-0 z-20 mt-1 flex min-w-56 flex-col border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button onClick={handleApplyPhysiologyToProfile} disabled={syncingProfile} className="px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">
                  {syncingProfile ? (language === 'es' ? 'Aplicando…' : 'Applying…') : (language === 'es' ? 'Aplicar zonas al perfil' : 'Apply zones to profile')}
                </button>
                <button onClick={() => setShowEditData(true)} className="px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">{language === 'es' ? 'Editar datos del test' : 'Edit test data'}</button>
                <button onClick={() => { if (showJSONSummary) setShowJSONSummary(false); else { setActiveSection('quality'); setShowJSONSummary(true); } }} className="px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">{showJSONSummary ? (language === 'es' ? 'Ocultar resumen JSON' : 'Hide JSON summary') : (language === 'es' ? 'Ver resumen JSON' : 'View JSON summary')}</button>
                <button onClick={handleExportJSON} className="px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700">{language === 'es' ? 'Exportar datos JSON' : 'Export JSON data'}</button>
                <button onClick={handleDeleteTest} className="px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">{language === 'es' ? 'Eliminar test' : 'Delete test'}</button>
              </div>
            </details>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-gray-200 pt-3 text-xs dark:border-gray-700">
          <span className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <span className={`h-2 w-2 rounded-full ${profileSynced ? 'bg-green-500' : 'bg-amber-500'}`} />
            {profileSynced ? (language === 'es' ? 'Perfil fisiológico actualizado' : 'Physiology profile updated') : (language === 'es' ? 'Perfil aún sin sincronizar' : 'Profile not yet synced')}
          </span>
          {trainingZones && <span className="text-gray-500 dark:text-gray-400">{language === 'es' ? 'Zonas' : 'Zones'}: {trainingZones.mode === 'manual_override' ? (language === 'es' ? 'ajuste manual' : 'coach adjusted') : (language === 'es' ? 'basadas en fisiología' : 'physiology based')}</span>}
          <span className="text-gray-500 dark:text-gray-400">{language === 'es' ? 'Interpretación estimada por nuestro modelo' : 'Interpretation estimated by our model'}</span>
        </div>
      </header>

      <nav role="tablist" aria-label={language === 'es' ? 'Secciones de resultados' : 'Result sections'} className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-200 px-1 dark:border-gray-700">
        {([
          ['overview', language === 'es' ? 'Resumen' : 'Overview'],
          ['curves', language === 'es' ? 'Perfil metabólico' : 'Metabolic profile'],
          ['thresholds', language === 'es' ? 'Umbrales y zonas' : 'Thresholds & zones'],
          ['quality', language === 'es' ? 'Calidad y método' : 'Quality & method'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeSection === id} onClick={() => setActiveSection(id)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${activeSection === id ? 'border-[#5A4E6B] text-[#5A4E6B] dark:border-violet-300 dark:text-violet-200' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}>
            {label}
          </button>
        ))}
      </nav>

      {activeSection === 'overview' && (
        <section role="tabpanel" className="space-y-6">
          <div className="grid grid-cols-2 border-y border-gray-200 py-4 sm:grid-cols-3 lg:grid-cols-5 dark:border-gray-700">
            {[
              { label: 'VO₂max', value: results.vo2max_ml_kg_min == null ? '—' : results.vo2max_ml_kg_min.toFixed(1), unit: 'ml/kg/min' },
              { label: 'LT1', value: results.lt1_power != null ? `${Math.round(results.lt1_power)} W` : results.lt1_pace ?? (results.lt1_hr != null ? `${results.lt1_hr} bpm` : '—'), unit: '' },
              { label: 'LT2', value: results.lt2_power != null ? `${Math.round(results.lt2_power)} W` : results.lt2_pace ?? (results.lt2_hr != null ? `${results.lt2_hr} bpm` : '—'), unit: '' },
              { label: 'FatMax', value: results.fatmax_power != null ? `${Math.round(results.fatmax_power)} W` : results.fatmax_pace ?? (results.fatmax_hr != null ? `${results.fatmax_hr} bpm` : '—'), unit: '' },
              { label: language === 'es' ? 'Muestras' : 'Samples', value: String(dataPoints.length), unit: language === 'es' ? 'estadios' : 'stages' },
            ].map((metric, index) => (
              <div key={metric.label} className={`px-4 py-2 ${index > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''}`}>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{metric.value}</p>
                {metric.unit && <p className="text-[11px] text-gray-500 dark:text-gray-400">{metric.unit}</p>}
              </div>
            ))}
          </div>

          <MetabolicFingerprint testId={test.id} sport={test.sport} results={results} advanced={advancedMetrics} language={language} />

          {results.vo2max && (
            <section aria-label="VO2max reference comparison" className="border-t border-gray-200 pt-5 dark:border-gray-700">
              <h2 className="mb-1 text-base font-bold text-gray-900 dark:text-white">
                {language === 'es' ? 'Referencia de VO₂máx' : 'VO₂max reference'}
              </h2>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{language === 'es' ? 'Compara con grupos disponibles por deporte y disciplina; no se muestran percentiles si el grupo no es compatible.' : 'Compare against available sport and discipline groups; percentiles are withheld when the cohort is not comparable.'}</p>
              <VO2ReferenceComparison vo2max={results.vo2max} sex={(athlete.sex === 'male' || athlete.sex === 'female') ? athlete.sex : 'male'} defaultSport={test.sport === 'cycling' ? 'cycling_road' : test.sport === 'running' ? 'running_road' : test.sport === 'swimming' ? 'swimming' : undefined} athleteAge={test.anthropometry_snapshot?.age} inline />
            </section>
          )}
        </section>
      )}

      {activeSection === 'curves' && (
        <section role="tabpanel" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{language === 'es' ? 'Perfil metabólico' : 'Metabolic profile'}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'es' ? 'Explora las respuestas por carga. Al seleccionar una muestra, se sincroniza la lectura entre gráficos.' : 'Explore responses by workload. Selecting a sample synchronizes the readout across charts.'}</p>
          </div>
          <AdvancedData testId={test.id} bodyMassKg={test.anthropometry_snapshot?.weight_kg ?? athlete.weight_kg} leanBodyMassKg={test.anthropometry_snapshot?.leanBodyMassKg ?? athlete.lean_body_mass_kg} sport={test.sport} dataPoints={dataPoints} results={results} advancedMetrics={advancedMetrics} timelineSamples={timelineSamples} surface="results" />
        </section>
      )}

      {activeSection === 'thresholds' && (
        <section role="tabpanel" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{language === 'es' ? 'Umbrales y prescripción' : 'Thresholds & prescription'}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'es' ? 'LT1, LT2, OBLA, IAT y MLSS describen criterios distintos. El MLSS solo aparece como medido cuando hay pruebas constantes de confirmación.' : 'LT1, LT2, OBLA, IAT and MLSS use different criteria. MLSS is labelled measured only when constant-load confirmation trials exist.'}</p>
          </div>
          <MetabolicProfile results={results} onEdit={() => setShowEditData(true)} />
          <TrainingZonesTable key={`${test.id}-${athlete.id}`} lt1_power={results.lt1_power} lt2_power={results.lt2_power} lt1_pace={results.lt1_pace} lt2_pace={results.lt2_pace} vam_kmh={results.vam_kmh} pam_watts={results.pam_watts} zonesData={results.zones_data} zones={results.training_zones} sport={test.sport} defaultMode="5" lt1_hr={results.lt1_hr} lt2_hr={results.lt2_hr} hrmax={results.hrmax} thresholdSource={results.threshold_source} athleteId={athlete.id} onSaved={handleZonesSaved} />
        </section>
      )}

      {activeSection === 'quality' && (
        <section role="tabpanel" className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{language === 'es' ? 'Calidad, método y trazabilidad' : 'Quality, method & provenance'}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'es' ? 'Revisa qué datos sostienen la interpretación y qué limitaciones conserva el resultado.' : 'Review the data supporting the interpretation and the limitations attached to this result.'}</p>
          </div>

          <section className="border-y border-gray-200 py-5 dark:border-gray-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">{language === 'es' ? 'Calidad de muestras' : 'Sample quality'}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{language === 'es' ? `${dataPoints.length} estadios · protocolo ${test.test_type.replace('_', ' ')} · ${test.sport.replace('_', ' ')}` : `${dataPoints.length} stages · ${test.test_type.replace('_', ' ')} protocol · ${test.sport.replace('_', ' ')}`}</p>
              </div>
              <span className={`px-3 py-1 text-xs font-semibold ${results.data_quality.includes('Excellent') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : results.data_quality.includes('Good') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>{results.data_quality}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
              {[
                ['Potencia', results.has_power], ['Lactato', results.has_lactate], ['VO₂', results.has_vo2], ['RER', results.has_rer],
              ].map(([label, valid]) => <div key={String(label)} className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><span className={`h-2 w-2 rounded-full ${valid ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />{language === 'es' ? label : ({ Potencia: 'Power', Lactato: 'Lactate', 'VO₂': 'VO₂', RER: 'RER' } as Record<string, string>)[String(label)]}</div>)}
              <div className="text-gray-600 dark:text-gray-400">{language === 'es' ? 'VO₂máx' : 'VO₂max'}: {results.vo2max_confidence}</div>
            </div>
            {results.lactate_analysis && (
              <div className="mt-4 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-gray-700 dark:text-gray-300">
                  <span>{language === 'es' ? 'Lactato' : 'Lactate'}: <strong>{results.lactate_analysis.quality.sampleCount} {language === 'es' ? 'muestras' : 'samples'}</strong></span>
                  <span>{language === 'es' ? 'Monotonicidad' : 'Monotonicity'}: <strong>{results.lactate_analysis.quality.monotonicityPercent}%</strong></span>
                  <span>{language === 'es' ? 'Carga' : 'Load'}: <strong>{results.lactate_analysis.quality.loadMonotonic ? (language === 'es' ? 'ordenada' : 'ordered') : (language === 'es' ? 'revisar' : 'review')}</strong></span>
                  <span>{language === 'es' ? 'Umbrales utilizables' : 'Threshold-ready'}: <strong>{results.lactate_analysis.quality.validForThresholds ? (language === 'es' ? 'sí' : 'yes') : (language === 'es' ? 'no' : 'no')}</strong></span>
                </div>
                {results.lactate_analysis.quality.issues.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300">{results.lactate_analysis.quality.issues.map(issue => <li key={`${issue.code}-${issue.stage ?? 'all'}`}>{issue.message}</li>)}</ul>}
              </div>
            )}
          </section>

          {test.anthropometry_snapshot ? (
            <section className="border-l-4 border-[#5A4E6B] py-3 pl-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{language === 'es' ? 'Antropometría usada en este test' : 'Anthropometry used for this test'}</h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">{test.anthropometry_source === 'hub' ? 'HUB' : test.anthropometry_source === 'mixed' ? (language === 'es' ? 'Fuentes mixtas' : 'Mixed sources') : (language === 'es' ? 'Entrada manual' : 'Manual entry')}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{test.anthropometry_snapshot.weight_kg} kg · {test.anthropometry_snapshot.height_cm} cm · {language === 'es' ? 'edad' : 'age'} {test.anthropometry_snapshot.age} · {test.anthropometry_snapshot.sex}{test.anthropometry_snapshot.bodyFatPercent ? ` · ${language === 'es' ? 'grasa' : 'body fat'} ${test.anthropometry_snapshot.bodyFatPercent}%` : ''}{test.anthropometry_snapshot.leanBodyMassKg ? ` · LBM ${test.anthropometry_snapshot.leanBodyMassKg.toFixed(1)} kg` : ''}</p>
            </section>
          ) : (!athlete.weight_kg && <p className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">{language === 'es' ? 'Falta el peso del atleta. VO₂ relativo, economía y algunas zonas pueden no estar disponibles. Edita los datos y recalcula.' : 'Athlete weight is missing. Relative VO₂, economy and some zones may be unavailable. Edit the data and recalculate.'}</p>)}

          {showJSONSummary && completeJSON && (
            <section className="border-y border-gray-200 py-5 dark:border-gray-700">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">JSON export summary</h3>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{completeJSON.validation.isComplete ? (language === 'es' ? 'Completo' : 'Complete') : (language === 'es' ? 'Incompleto' : 'Incomplete')}</span>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap bg-gray-50 p-4 text-xs leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-300">{getJSONSummary(completeJSON)}</pre>
              {completeJSON.validation.warnings.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300">{completeJSON.validation.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
              {completeJSON.validation.missingFields.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-red-700 dark:text-red-300">{completeJSON.validation.missingFields.map((field, i) => <li key={i}>{field}</li>)}</ul>}
            </section>
          )}

          <ScientificModelPanel results={results} points={dataPoints} language={language} savedAlgorithmVersion={savedSnapshot?.modelProvenance?.algorithm.version ?? null} saved={isSaved && !isDirty} sport={test.sport} calculate={(points) => {
            if (!athlete || !test) return results;
            const athleteForSensitivity = { ...athlete, sport: test.sport };
            if (test.anthropometry_snapshot) {
              athleteForSensitivity.weight_kg = test.anthropometry_snapshot.weight_kg;
              athleteForSensitivity.height_cm = test.anthropometry_snapshot.height_cm;
              athleteForSensitivity.sex = test.anthropometry_snapshot.sex;
              athleteForSensitivity.body_fat_percent = test.anthropometry_snapshot.bodyFatPercent;
              athleteForSensitivity.lean_body_mass_kg = test.anthropometry_snapshot.leanBodyMassKg;
            }
            return calculatePhysiology(athleteForSensitivity, points, test.anthropometry_snapshot?.threshold_overrides);
          }} />
          <CoachNotes testId={test.id} />
        </section>
      )}

      <ConfirmDialog isOpen={showRecalculateConfirm} title={language === 'es' ? 'Confirmar recálculo' : 'Confirm recalculation'} message={language === 'es' ? 'Esto reemplazará los valores guardados con nuevos cálculos hechos desde los datos originales. ¿Quieres continuar?' : 'This will replace saved values with newly calculated values from the raw test data. Continue?'} confirmLabel={language === 'es' ? 'Recalcular' : 'Recalculate'} cancelLabel={language === 'es' ? 'Cancelar' : 'Cancel'} onConfirm={confirmRecalculate} onCancel={cancelRecalculate} isDanger={false} />
      <ConfirmDialog isOpen={showDeleteConfirm} title={language === 'es' ? 'Eliminar test' : 'Delete test'} message={language === 'es' ? '¿Eliminar este test y todos sus datos? Esta acción no se puede deshacer.' : 'Delete this test and all its data? This cannot be undone.'} confirmLabel={language === 'es' ? 'Eliminar' : 'Delete'} cancelLabel={language === 'es' ? 'Cancelar' : 'Cancel'} onConfirm={confirmDeleteTest} onCancel={() => setShowDeleteConfirm(false)} isDanger />

      {showEditData && athlete && test && (
        <EditDataModal testId={testId} dataPoints={dataPoints} athlete={athlete} test={test} onClose={() => setShowEditData(false)} onRecalculate={async () => {
          setShowEditData(false);
          try {
            const { data: freshTest } = await supabase.from('tests').select('*').eq('id', testId).maybeSingle();
            const { data: freshPoints } = await supabase.from('test_data_points').select('*').eq('test_id', testId).order('stage_number', { ascending: true });
            if (freshTest) setTest(freshTest as Test);
            if (freshPoints) setDataPoints(freshPoints as TestDataPoint[]);
            if (freshTest && athlete && (freshPoints?.length ?? 0) > 0) {
              const ft = freshTest as Test;
              const athleteForCalc = { ...athlete };
              if (ft.anthropometry_snapshot) {
                athleteForCalc.weight_kg = ft.anthropometry_snapshot.weight_kg;
                athleteForCalc.height_cm = ft.anthropometry_snapshot.height_cm;
                athleteForCalc.sex = ft.anthropometry_snapshot.sex;
                athleteForCalc.body_fat_percent = ft.anthropometry_snapshot.bodyFatPercent;
                athleteForCalc.lean_body_mass_kg = ft.anthropometry_snapshot.leanBodyMassKg;
                const birthYear = new Date().getFullYear() - ft.anthropometry_snapshot.age;
                athleteForCalc.date_of_birth = `${birthYear}-01-01`;
              }
              const calcResults = calculatePhysiology(athleteForCalc, freshPoints as TestDataPoint[], ft.anthropometry_snapshot?.threshold_overrides);
              const calcAdvanced = calculateAdvancedMetrics(athleteForCalc, freshPoints as TestDataPoint[], calcResults, undefined, ft.sport);
              setPendingResults(calcResults);
              setPendingAdvanced(calcAdvanced);
              setShowRecalculateConfirm(true);
            }
          } catch (err) {
            console.error('Failed to reload test data after edit:', err);
            setToast({ message: language === 'es' ? 'No se pudieron recargar los datos editados.' : 'Failed to reload edited data. Please try again.', type: 'error' });
          }
        }} />
      )}
    </div>
  );
}
