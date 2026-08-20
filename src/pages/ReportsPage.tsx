import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import AthleteSelector from '../components/AthleteSelector';
import ReportBuilder from '../components/reports/ReportBuilder';
import type { Athlete, Test, TestDataPoint } from '../types';
import type { PhysiologyResults } from '../lib/physiology';
import type { AdvancedMetrics } from '../types';
import type { AnthropometryMeasurement, KerrResults } from '../types/anthropometry.types';
import type { ReportData, ReportSection, ReportType } from '../lib/reportGenerator';
import { buildTrainingZonesData } from '../lib/trainingZones';
import type { AthletePhysiologyProfile } from '../lib/physiologyProfile';
import type { PreTestData } from '../lib/labSession';

interface TestRecord {
  id: string;
  test_date: string;
  sport: string;
  test_type: string;
  status: string;
}

interface TestResultRecord {
  test_id: string;
  training_zones?: unknown[];
  lt1_hr?: number;
  lt2_hr?: number;
  vo2max?: number;
  advanced_metrics?: AdvancedMetrics;
}

interface ReportsPageProps {
  initialAthlete?: Athlete | null;
}

export default function ReportsPage({ initialAthlete }: ReportsPageProps) {
  const { profile } = useAuth();
  const { t, language } = useLanguage();
  const effectiveRole = profile?.role === 'trainer' ? 'coach' : profile?.role;
  const isCoach = effectiveRole === 'admin' || effectiveRole === 'coach';

  const [step, setStep] = useState<'select-athlete' | 'select-test' | 'builder'>('select-athlete');
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const defaultType: ReportType = 'custom';
  const defaultSections: ReportSection[] | undefined = undefined;

  useEffect(() => {
    if (initialAthlete) {
      handleAthleteSelected(initialAthlete);
    } else if (!isCoach && profile) {
      loadAthleteFromProfile();
    }
  }, [profile, isCoach]);

  const loadAthleteFromProfile = async () => {
    if (!profile?.id) return;
    let athleteData: Athlete | null = null;

    if (profile.hub_user_id) {
      const { data } = await supabase
        .from('athletes')
        .select('*')
        .eq('hub_user_id', profile.hub_user_id)
        .maybeSingle();
      athleteData = data as Athlete;
    }

    if (!athleteData && profile.email) {
      const { data } = await supabase
        .from('athletes')
        .select('*')
        .eq('email', profile.email)
        .maybeSingle();
      athleteData = data as Athlete;
    }

    if (athleteData) {
      handleAthleteSelected(athleteData);
    }
  };

  const handleAthleteSelected = async (athlete: Athlete) => {
    setSelectedAthlete(athlete);
    setLoading(true);
    try {
      const { data: testData } = await supabase
        .from('tests')
        .select('id, test_date, sport, test_type, status')
        .eq('athlete_id', athlete.id)
        .eq('status', 'completed')
        .order('test_date', { ascending: false });
      setTests(testData || []);
      setStep('select-test');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSelected = async (testId: string | null) => {
    if (!selectedAthlete) return;
    setLoading(true);
    try {
      await buildReportData(selectedAthlete, testId);
      setStep('builder');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipTest = async () => {
    if (!selectedAthlete) return;
    setLoading(true);
    try {
      await buildReportData(selectedAthlete, null);
      setStep('builder');
    } finally {
      setLoading(false);
    }
  };

  const buildPhysiologyFromProfile = (p: AthletePhysiologyProfile): PhysiologyResults => {
    const hrmax = p.hrmax ?? 0;
    return {
      vo2max: p.vo2max_relative_ml_kg_min,
      vo2max_confidence: (p.vo2max_confidence as 'measured' | 'estimated') || 'estimated',
      vo2max_ml_kg_min: p.vo2max_relative_ml_kg_min,
      vo2max_ml_kg_lbm_min: p.vo2max_relative_ml_ffm_min,
      vo2max_ml_kg_ffm_min: null,
      vo2max_ml_kg_muscle_min: null,
      vo2max_ml_min: p.vo2max_absolute_l_min ? p.vo2max_absolute_l_min * 1000 : null,
      lt1_hr: p.lt1_hr,
      lt1_power: p.lt1_power,
      lt1_pace: p.lt1_pace,
      lt1_vo2: null,
      lt1_percent_vo2max: p.lt1_percent_vo2max,
      lt1_percent_hrmax: p.lt1_percent_hrmax,
      lt1_confidence: (p.lt1_confidence as 'measured' | 'estimated') || 'estimated',
      lt2_hr: p.lt2_hr,
      lt2_power: p.lt2_power,
      lt2_pace: p.lt2_pace,
      lt2_vo2: null,
      lt2_percent_vo2max: p.lt2_percent_vo2max,
      lt2_percent_hrmax: p.lt2_percent_hrmax,
      lt2_confidence: (p.lt2_confidence as 'measured' | 'estimated') || 'estimated',
      fatmax_hr: p.fatmax_hr,
      fatmax_power: p.fatmax_power,
      fatmax_pace: p.fatmax_pace,
      fatmax_vo2: null,
      fatmax_confidence: (p.fatmax_confidence as 'measured' | 'estimated') || 'estimated',
      vam_kmh: p.vam_kmh,
      pam_watts: p.pam_watts,
      hr_drift_percent: null,
      hrmax,
      hrmax_confidence: 'measured',
      training_zones: (p.physiology_zones as unknown[]) ?? [],
      zones_data: buildTrainingZonesData(p.lt1_hr, p.lt2_hr, hrmax, 'other', '5'),
      data_quality: 'profile',
      data_quality_score: 0,
      metabolic_profile: { aerobic_capacity: '', fat_utilization: '', anaerobic_contribution: '', durability: '' },
      stage_analysis: [],
      has_power: !!(p.lt1_power || p.lt2_power),
      has_lactate: false,
      has_vo2: !!(p.vo2max_relative_ml_kg_min),
      has_rer: false,
      has_pace: !!(p.lt1_pace || p.lt2_pace),
      threshold_source: 'lactate',
      thresholds: {
        LT1: { hr: p.lt1_hr, vo2: null, power: p.lt1_power, pace: p.lt1_pace, percent_vo2max: p.lt1_percent_vo2max, percent_hrmax: p.lt1_percent_hrmax, confidence: (p.lt1_confidence as 'measured' | 'estimated') || 'estimated' },
        LT2: { hr: p.lt2_hr, vo2: null, power: p.lt2_power, pace: p.lt2_pace, percent_vo2max: p.lt2_percent_vo2max, percent_hrmax: p.lt2_percent_hrmax, confidence: (p.lt2_confidence as 'measured' | 'estimated') || 'estimated' },
        VT1: { hr: p.lt1_hr, vo2: null, power: p.lt1_power, pace: p.lt1_pace, percent_vo2max: p.lt1_percent_vo2max, percent_hrmax: p.lt1_percent_hrmax, confidence: 'estimated' },
        VT2: { hr: p.lt2_hr, vo2: null, power: p.lt2_power, pace: p.lt2_pace, percent_vo2max: p.lt2_percent_vo2max, percent_hrmax: p.lt2_percent_hrmax, confidence: 'estimated' },
        vt_source: 'estimated_from_lt',
        delta_lt1_vt1_hr: null,
        delta_lt2_vt2_hr: null,
      },
    } as PhysiologyResults;
  };

  const buildReportData = async (athlete: Athlete, testId: string | null) => {
    let test: Test | null = null;
    let physiologyResults: PhysiologyResults | null = null;
    let dataPoints: TestDataPoint[] = [];
    let advancedMetrics: AdvancedMetrics | null = null;

    if (testId) {
      const [{ data: testRow }, { data: resultRow }, { data: pts }] = await Promise.all([
        supabase.from('tests').select('*').eq('id', testId).maybeSingle(),
        supabase.from('test_results').select('*').eq('test_id', testId).maybeSingle(),
        supabase.from('test_data_points').select('*').eq('test_id', testId).order('stage_number', { ascending: true }),
      ]);

      test = testRow as Test | null;
      dataPoints = (pts || []) as TestDataPoint[];

      if (resultRow) {
        const r = resultRow as TestResultRecord & Record<string, unknown>;
        const hrmax = (r.hrmax as number) ?? 0;
        physiologyResults = {
          vo2max: r.vo2max as number ?? null,
          vo2max_confidence: (r.vo2max_measured ? 'measured' : 'estimated') as 'measured' | 'estimated',
          vo2max_ml_kg_min: r.vo2max as number ?? null,
          vo2max_ml_kg_lbm_min: null,
          vo2max_ml_kg_ffm_min: null,
          vo2max_ml_kg_muscle_min: null,
          vo2max_ml_min: null,
          lt1_hr: r.lt1_hr as number ?? null,
          lt1_power: r.lt1_power as number ?? null,
          lt1_pace: null,
          lt1_vo2: null,
          lt1_percent_vo2max: r.lt1_percent_vo2max as number ?? null,
          lt1_percent_hrmax: r.lt1_percent_hrmax as number ?? (
            r.lt1_hr && hrmax ? Math.round(((r.lt1_hr as number) / hrmax) * 100) : null
          ),
          lt1_confidence: 'estimated',
          lt2_hr: r.lt2_hr as number ?? null,
          lt2_power: r.lt2_power as number ?? null,
          lt2_pace: null,
          lt2_vo2: null,
          lt2_percent_vo2max: r.lt2_percent_vo2max as number ?? null,
          lt2_percent_hrmax: r.lt2_percent_hrmax as number ?? (
            r.lt2_hr && hrmax ? Math.round(((r.lt2_hr as number) / hrmax) * 100) : null
          ),
          lt2_confidence: 'estimated',
          fatmax_hr: r.fatmax_hr as number ?? null,
          fatmax_power: null,
          fatmax_pace: null,
          fatmax_vo2: null,
          fatmax_confidence: 'estimated',
          vam_kmh: null,
          pam_watts: null,
          hr_drift_percent: r.hr_drift_percent as number ?? null,
          hrmax,
          hrmax_confidence: 'measured',
          training_zones: (r.training_zones as unknown[]) ?? [],
          zones_data: buildTrainingZonesData(
            r.lt1_hr as number ?? null,
            r.lt2_hr as number ?? null,
            hrmax,
            'other',
            '5'
          ),
          data_quality: (r.data_quality as string) || '',
          data_quality_score: 0,
          metabolic_profile: { aerobic_capacity: '', fat_utilization: '', anaerobic_contribution: '', durability: '' },
          stage_analysis: [],
          has_power: !!(r.lt1_power || r.lt2_power),
          has_lactate: false,
          has_vo2: !!(r.vo2max),
          has_rer: false,
          has_pace: false,
          threshold_source: 'lactate',
          thresholds: (r.thresholds as PhysiologyResults['thresholds']) ?? {
            LT1: { hr: r.lt1_hr as number ?? null, vo2: null, power: r.lt1_power as number ?? null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'estimated' },
            LT2: { hr: r.lt2_hr as number ?? null, vo2: null, power: r.lt2_power as number ?? null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'estimated' },
            VT1: { hr: r.lt1_hr as number ?? null, vo2: null, power: r.lt1_power as number ?? null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'estimated' },
            VT2: { hr: r.lt2_hr as number ?? null, vo2: null, power: r.lt2_power as number ?? null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'estimated' },
            vt_source: 'estimated_from_lt',
            delta_lt1_vt1_hr: null,
            delta_lt2_vt2_hr: null,
          },
        } as PhysiologyResults;
        advancedMetrics = (r.advanced_metrics as AdvancedMetrics) ?? null;
      }
    }

    const [{ data: anthroRows }, { data: kerrRow }, { data: hydrationRows }, { data: physiologyProfileRow }] = await Promise.all([
      supabase
        .from('anthropometry_measurements')
        .select('*')
        .eq('athlete_id', athlete.id)
        .order('measurement_date', { ascending: false })
        .limit(1),
      supabase
        .from('anthropometry_kerr_results')
        .select('*')
        .eq('athlete_id', athlete.id)
        .order('calculation_date', { ascending: false })
        .limit(1),
      supabase
        .from('athlete_hydration_sessions')
        .select('*')
        .eq('athlete_id', athlete.id)
        .order('session_date', { ascending: false })
        .limit(10),
      supabase
        .from('athlete_physiology_profiles')
        .select('*')
        .eq('athlete_id', athlete.id)
        .maybeSingle(),
    ]);

    if (!physiologyResults && physiologyProfileRow) {
      physiologyResults = buildPhysiologyFromProfile(physiologyProfileRow as AthletePhysiologyProfile);
    }

    const anthropometryMeasurement = (anthroRows?.[0] as AnthropometryMeasurement) ?? null;
    const kerrResults = (kerrRow?.[0] as KerrResults) ?? null;

    let preTestData: PreTestData | null = null;
    if (test) {
      const td = test as unknown as Record<string, unknown>;
      preTestData = {
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
      };
    }

    setReportData({
      athlete,
      test,
      physiologyResults,
      dataPoints,
      advancedMetrics,
      anthropometryMeasurement,
      kerrResults,
      hydrationSessions: hydrationRows ?? [],
      preTestData,
    });
  };

  const handleBack = () => {
    if (step === 'builder') {
      setStep('select-test');
      setReportData(null);
    } else if (step === 'select-test') {
      setStep('select-athlete');
      setSelectedAthlete(null);
      setTests([]);
    }
  };

  if (step === 'select-athlete' && isCoach) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.pageTitle')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('reports.selectAthlete')}</p>
        </div>
        <AthleteSelector
          onSelectAthlete={handleAthleteSelected}
          onCreateNew={() => {}}
        />
      </div>
    );
  }

  if (step === 'select-test' && selectedAthlete) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.pageTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{selectedAthlete.name}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('reports.selectTest')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('reports.selectTestDesc')}</p>
          </div>
          <div className="p-6 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-[#fdda36] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <button
                  onClick={handleSkipTest}
                  className="w-full text-left px-5 py-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 hover:border-[#fdda36]/60 hover:bg-[#fdda36]/5 transition-all group"
                >
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    {t('reports.athleteProfileOnly')}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('reports.athleteProfileDesc')}</p>
                </button>

                {tests.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">{t('reports.noTests')}</p>
                ) : (
                  tests.map(testRecord => (
                    <button
                      key={testRecord.id}
                      onClick={() => handleTestSelected(testRecord.id)}
                      className="w-full text-left px-5 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-[#fdda36]/60 hover:bg-[#fdda36]/5 transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                            {new Date(testRecord.test_date).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {(testRecord.sport.charAt(0).toUpperCase() + testRecord.sport.slice(1))} &middot; {testRecord.test_type.replace('_', ' ').toUpperCase()}
                          </p>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-[#fdda36] transition-colors mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'builder' && reportData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          {isCoach && (
            <button
              onClick={handleBack}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports.pageTitle')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {reportData.athlete.name}
              {reportData.test && ` · ${new Date(reportData.test.test_date).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <ReportBuilder
          data={reportData}
          defaultType={defaultType}
          defaultSections={defaultSections}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-[#fdda36] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
