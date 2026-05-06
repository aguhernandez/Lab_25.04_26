import { Athlete, Test, TestDataPoint, TestType, Sport, AnthropometryData } from '../types';
import { PhysiologyResults } from './physiology';
import { AdvancedMetrics } from '../types';
import { AthleteTrainingZones } from './physiologyProfile';

export type LabPhase =
  | 'selection'
  | 'pretest'
  | 'stages'
  | 'processing'
  | 'results'
  | 'apply'
  | 'report';

export interface OutdoorWeather {
  temperature_c: number | null;
  humidity_percent: number | null;
  wind_speed_kmh: number | null;
  pressure_hpa: number | null;
  weather_code: number | null;
  description: string | null;
  fetched_at: string | null;
}

export interface PreTestData {
  anthropometry: AnthropometryData;
  test_time: string | null;
  city: string | null;
  elevation_m: number | null;
  outdoor_weather: OutdoorWeather | null;
  indoor_temp_c: number | null;
  indoor_humidity_percent: number | null;
  indoor_conditions_notes: string | null;
  usg: number | null;
  hr_rest: number | null;
  hrv_ms: number | null;
  basal_lactate: number | null;
  rmr_kcal: number | null;
}

export interface ManualResults {
  vo2max: number | null;
  vo2max_absolute: number | null;
  lt1_hr: number | null;
  lt1_power: number | null;
  lt1_vo2: number | null;
  lt2_hr: number | null;
  lt2_power: number | null;
  lt2_vo2: number | null;
  fatmax_hr: number | null;
  fatmax_power: number | null;
  hrmax: number | null;
  vam_kmh: number | null;
  pam_watts: number | null;
  rmr_kcal: number | null;
}

export interface LabSession {
  phase: LabPhase;
  athlete: Athlete | null;
  testType: TestType | null;
  sport: Sport | null;
  numStages: number;
  stageDurationSeconds: number;
  includeCooldown: boolean;
  customProtocol: boolean;
  customStageDurations: number[];
  skipPretest: boolean;
  preTestData: PreTestData | null;
  test: Test | null;
  dataPoints: TestDataPoint[];
  results: PhysiologyResults | null;
  advancedMetrics: AdvancedMetrics | null;
  trainingZones: AthleteTrainingZones | null;
  testId: string | null;
  manualResultsMode: boolean;
  manualResults: ManualResults | null;
}

export const initialLabSession = (): LabSession => ({
  phase: 'selection',
  athlete: null,
  testType: null,
  sport: null,
  numStages: 8,
  stageDurationSeconds: 180,
  includeCooldown: false,
  customProtocol: false,
  customStageDurations: [],
  skipPretest: false,
  preTestData: null,
  test: null,
  dataPoints: [],
  results: null,
  advancedMetrics: null,
  trainingZones: null,
  testId: null,
  manualResultsMode: false,
  manualResults: null,
});

export const LAB_TEST_TYPES: { value: TestType; label: string; description: string; icon: string }[] = [
  { value: 'ramp', label: 'Ramp VO\u2082', description: 'Progressive intensity until exhaustion', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { value: 'step', label: 'Lactate Threshold', description: 'Fixed stages with lactate measurements', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { value: 'steady_state', label: 'Submax Economy', description: 'Constant intensity for movement economy', icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4' },
  { value: 'manual', label: 'Mixed Protocol', description: 'Custom field test or combined protocol', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
];

export const PHASE_LABELS: Record<LabPhase, string> = {
  selection: 'Select',
  pretest: 'Pre-Test',
  stages: 'Data Entry',
  processing: 'Processing',
  results: 'Results',
  apply: 'Apply Zones',
  report: 'Report',
};

export const PHASE_ORDER: LabPhase[] = ['selection', 'pretest', 'stages', 'processing', 'results', 'apply', 'report'];
