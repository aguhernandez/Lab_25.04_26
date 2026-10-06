import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Athlete, Test, TestDataPoint, AdvancedMetrics } from '../types';
import { calculatePhysiology, calculateAdvancedMetrics, PhysiologyResults } from '../lib/physiology';
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
import { RefreshCw, Save, FileDown, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';

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
}

export default function ResultsView({ testId, onTestDeleted }: ResultsViewProps) {
  const [test, setTest] = useState<Test | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [dataPoints, setDataPoints] = useState<TestDataPoint[]>([]);
  const [results, setResults] = useState<PhysiologyResults | null>(null);
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedMetrics | null>(null);
  const [completeJSON, setCompleteJSON] = useState<MetabolicLabJSON | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showJSONSummary, setShowJSONSummary] = useState(false);
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

      if (snapshot && snapshot.results) {
        // Load saved results — do NOT recalculate
        setResults(snapshot.results);
        setAdvancedMetrics(snapshot.advancedMetrics ?? null);
        setSavedSnapshot({ results: snapshot.results, advancedMetrics: snapshot.advancedMetrics ?? null, savedAt: savedAt ?? '' });
        setHasSavedResults(true);
        setIsSaved(true);
        setIsDirty(false);
        regenerateJSON(athleteData, testData, dataPointsData || [], snapshot.results, snapshot.advancedMetrics ?? null);
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
        const advanced = calculateAdvancedMetrics(athleteForCalculations, dataPointsData || [], calculated);

        setResults(calculated);
        setAdvancedMetrics(advanced);
        setHasSavedResults(false);
        setIsSaved(false);
        setIsDirty(true);
        regenerateJSON(athleteData, testData, dataPointsData || [], calculated, advanced);
      }

      // Load training zones
      const zones = await fetchAthleteTrainingZones(athleteData.id);
      setTrainingZones(zones);

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
    const advanced = calculateAdvancedMetrics(athleteForCalculations, dataPoints, calculated);

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
    if (!test || !results) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const snapshot: SavedSnapshot = {
        results,
        advancedMetrics: advancedMetrics ?? null,
        savedAt: now,
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

  const handleViewJSONSummary = () => {
    setShowJSONSummary(!showJSONSummary);
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
        heart_rate_zones: updatedZones as any,
        mode: 'manual_override',
        last_modified_by: 'coach',
        last_modified_at: new Date().toISOString(),
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
          manualTrainingZones={trainingZones?.heart_rate_zones}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Unsaved changes indicator */}
      {isDirty && !isSaved && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            {hasSavedResults ? 'You have unsaved changes. Click "Save" to persist them.' : 'New test — results calculated but not yet saved. Click "Save" to persist.'}
          </span>
        </div>
      )}
      {isSaved && !isDirty && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">
            Results saved{savedSnapshot?.savedAt ? ` · ${new Date(savedSnapshot.savedAt).toLocaleString()}` : ''}
          </span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="bg-gradient-to-r from-[#5A4E6B] to-[#6B5D7B] dark:from-[#4A3E5B] dark:to-[#5B4D6B] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-lg p-2">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-white">Test Results</h1>
              <p className="text-sm text-white/80">
                {new Date(test.test_date).toLocaleDateString()} · {test.test_type.replace('_', ' ').toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            {/* Recalculate */}
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
              Recalculate
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || (!isDirty && isSaved)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>

            {/* Export PDF */}
            <button
              onClick={() => setShowReportBuilder(true)}
              className="px-4 py-2 bg-[#fdda36] text-[#514163] rounded-lg font-semibold hover:bg-[#fdda36]/90 transition-colors shadow-md flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </button>

            {/* Apply Zones */}
            <button
              onClick={handleApplyPhysiologyToProfile}
              disabled={syncingProfile}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              {syncingProfile ? 'Applying...' : 'Apply Zones to Profile'}
            </button>

            {/* Secondary actions */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm"
            >
              {showAdvanced ? 'Hide Advanced Data' : 'View Advanced Data'}
            </button>
            <button
              onClick={() => setShowEditData(true)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Data
            </button>
            <button
              onClick={handleViewJSONSummary}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm"
            >
              {showJSONSummary ? 'Hide JSON Summary' : 'View JSON Summary'}
            </button>
            <button
              onClick={handleExportJSON}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm"
            >
              Export JSON
            </button>
            <button
              onClick={handleDeleteTest}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-md"
            >
              Delete Test
            </button>
          </div>

          <div className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 bg-gray-50 dark:bg-gray-700/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${profileSynced ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Athlete Physiology Profile
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {profileSynced
                      ? `Profile updated — zones applied from ${new Date(test.test_date).toLocaleDateString()}`
                      : 'Profile not yet synced with this test'}
                  </p>
                  {trainingZones && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Zones: {trainingZones.mode === 'manual_override' ? 'Manual override by coach' : 'Based on lab physiology'}

                    </p>
                  )}
                </div>
              </div>

            </div>
            {trainingZones && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Physiological reference — LT1: {trainingZones.physiology_reference?.lt1_hr ?? '—'} bpm
                  {trainingZones.physiology_reference?.lt1_power ? ` / ${trainingZones.physiology_reference.lt1_power}W` : ''}
                  {trainingZones.physiology_reference?.lt1_pace ? ` / ${trainingZones.physiology_reference.lt1_pace}` : ''}
                  {' · '}
                  LT2: {trainingZones.physiology_reference?.lt2_hr ?? '—'} bpm
                  {trainingZones.physiology_reference?.lt2_power ? ` / ${trainingZones.physiology_reference.lt2_power}W` : ''}
                  {trainingZones.physiology_reference?.lt2_pace ? ` / ${trainingZones.physiology_reference.lt2_pace}` : ''}
                  {trainingZones.physiology_reference?.vam_kmh ? ` · VAM: ${trainingZones.physiology_reference.vam_kmh} km/h` : ''}
                  {trainingZones.physiology_reference?.pam_watts ? ` · PAM: ${trainingZones.physiology_reference.pam_watts}W` : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {test.anthropometry_snapshot && (
        <div className={`border-l-4 rounded-lg p-4 ${
          test.anthropometry_source === 'hub'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
            : test.anthropometry_source === 'mixed'
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
            : 'bg-gray-50 dark:bg-gray-700 border-gray-400'
        }`}>
          <div className="flex items-start gap-3">
            <svg className={`w-5 h-5 mt-0.5 ${
              test.anthropometry_source === 'hub'
                ? 'text-green-600 dark:text-green-400'
                : test.anthropometry_source === 'mixed'
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-gray-600 dark:text-gray-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className={`font-semibold ${
                  test.anthropometry_source === 'hub'
                    ? 'text-green-900 dark:text-green-100'
                    : test.anthropometry_source === 'mixed'
                    ? 'text-yellow-900 dark:text-yellow-100'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  Anthropometry Data
                </h3>
                {test.anthropometry_source === 'hub' && (
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                    From HUB
                  </span>
                )}
                {test.anthropometry_source === 'mixed' && (
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium">
                    Mixed Sources
                  </span>
                )}
                {test.anthropometry_source === 'manual' && (
                  <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-xs font-medium">
                    Manual Entry
                  </span>
                )}
              </div>
              <p className={`text-sm ${
                test.anthropometry_source === 'hub'
                  ? 'text-green-700 dark:text-green-300'
                  : test.anthropometry_source === 'mixed'
                  ? 'text-yellow-700 dark:text-yellow-300'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                Weight: {test.anthropometry_snapshot.weight_kg} kg • Height: {test.anthropometry_snapshot.height_cm} cm •
                Age: {test.anthropometry_snapshot.age} • Sex: {test.anthropometry_snapshot.sex}
                {test.anthropometry_snapshot.bodyFatPercent && ` • Body Fat: ${test.anthropometry_snapshot.bodyFatPercent}%`}
                {test.anthropometry_snapshot.leanBodyMassKg && ` • LBM: ${test.anthropometry_snapshot.leanBodyMassKg.toFixed(1)} kg`}
              </p>
            </div>
          </div>
        </div>
      )}

      {showJSONSummary && completeJSON && (
        <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-l-4 p-6 ${
          completeJSON.validation.isComplete
            ? 'bg-green-50 dark:bg-green-900/10 border-green-500'
            : 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-500'
        }`}>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              JSON Export Summary
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              completeJSON.validation.isComplete
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
            }`}>
              {completeJSON.validation.isComplete ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <pre className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 bg-black/5 dark:bg-black/20 p-4 rounded-lg overflow-auto whitespace-pre-wrap">
            {getJSONSummary(completeJSON)}
          </pre>
          {completeJSON.validation.warnings.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <div className="font-semibold text-sm mb-2 text-yellow-800 dark:text-yellow-300">
                Validation Warnings ({completeJSON.validation.warnings.length})
              </div>
              <ul className="list-disc pl-6 text-sm text-yellow-700 dark:text-yellow-400">
                {completeJSON.validation.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {completeJSON.validation.missingFields.length > 0 && (
            <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <div className="font-semibold text-sm mb-2 text-red-800 dark:text-red-300">
                Missing Required Fields ({completeJSON.validation.missingFields.length})
              </div>
              <ul className="list-disc pl-6 text-sm text-red-700 dark:text-red-400">
                {completeJSON.validation.missingFields.map((field, i) => (
                  <li key={i}>{field}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!test.anthropometry_snapshot?.weight_kg && !athlete.weight_kg && (
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold text-amber-800 dark:text-amber-300">Athlete weight missing</p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              VO₂ calculations, energy profile, and training zones require body weight.
              Click <strong>Edit Data</strong> above to enter the athlete's weight and recalculate.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Data Quality</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            results.data_quality.includes('Excellent')
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : results.data_quality.includes('Good')
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          }`}>
            {results.data_quality}
          </span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Data Points:</span>{' '}
            <span className="text-gray-900 dark:text-white font-semibold">{dataPoints.length}</span>
          </div>
          {results.has_power && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
              Power ✓
            </span>
          )}
          {results.has_lactate && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
              Lactate ✓
            </span>
          )}
          {results.has_vo2 && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
              VO₂ ✓
            </span>
          )}
          {results.has_rer && (
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
              RER ✓
            </span>
          )}
          {results.vo2max_confidence !== 'measured' && (
            <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-medium">
              VO₂max {results.vo2max_confidence}
            </span>
          )}
        </div>
      </div>

      <div className={showAdvanced ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
        <MetabolicProfile results={results} onEdit={() => setShowEditData(true)} />
        {!showAdvanced && (
          <TrainingZonesTable
            zonesData={results.zones_data}
            zones={results.training_zones}
            sport={test.sport}
            defaultMode="5"
            lt1_hr={results.lt1_hr}
            lt2_hr={results.lt2_hr}
            hrmax={results.hrmax}
            thresholdSource={results.threshold_source}
            athleteId={athlete?.id}
            onSaved={handleZonesSaved}
          />
        )}
      </div>

      {showAdvanced && (
        <>
          <TrainingZonesTable
            zonesData={results.zones_data}
            zones={results.training_zones}
            sport={test.sport}
            defaultMode="5"
            lt1_hr={results.lt1_hr}
            lt2_hr={results.lt2_hr}
            hrmax={results.hrmax}
            thresholdSource={results.threshold_source}
            athleteId={athlete?.id}
            onSaved={handleZonesSaved}
          />
          <AdvancedData dataPoints={dataPoints} results={results} advancedMetrics={advancedMetrics} />
        </>
      )}

      {results.vo2max && (
        <VO2ReferenceComparison
          vo2max={results.vo2max}
          sex={(athlete.sex === 'male' || athlete.sex === 'female') ? athlete.sex : 'male'}
        />
      )}

      <CoachNotes testId={test.id} />

      {/* Recalculate confirmation */}
      <ConfirmDialog
        isOpen={showRecalculateConfirm}
        title="Confirm Recalculation"
        message="This will replace the currently saved values with newly calculated values from the raw test data. Are you sure you want to continue? You can still cancel and revert to the saved version."
        confirmLabel="Recalculate"
        cancelLabel="Cancel"
        onConfirm={confirmRecalculate}
        onCancel={cancelRecalculate}
        isDanger={false}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Test"
        message="Are you sure you want to delete this test? This action cannot be undone and all test data will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteTest}
        onCancel={() => setShowDeleteConfirm(false)}
        isDanger={true}
      />

      {showEditData && athlete && test && (
        <EditDataModal
          testId={testId}
          dataPoints={dataPoints}
          athlete={athlete}
          test={test}
          onClose={() => setShowEditData(false)}
          onRecalculate={() => {
            setShowEditData(false);
            // After editing raw data, trigger a recalculation flow
            const calc = doCalculation();
            if (calc) {
              setPendingResults(calc.results);
              setPendingAdvanced(calc.advanced);
              setShowRecalculateConfirm(true);
            }
          }}
        />
      )}
    </div>
  );
}
