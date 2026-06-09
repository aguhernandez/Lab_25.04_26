export type Sport = 'cycling' | 'running' | 'triathlon' | 'swimming' | 'other';
export type Sex = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type TestType = 'ramp' | 'step' | 'steady_state' | 'manual';
export type TestStatus = 'in_progress' | 'completed' | 'archived';
export type AnthropometrySource = 'hub' | 'manual' | 'mixed';

export interface Profile {
  id: string;
  user_id: string;
  hub_user_id?: string | null;
  email?: string;
  role?: string;
  full_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Athlete {
  id: string;
  name: string;
  email?: string;
  sport: Sport;
  date_of_birth?: string;
  sex?: Sex;
  weight_kg?: number;
  height_cm?: number;
  body_fat_percent?: number;
  lean_body_mass_kg?: number;
  hub_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThresholdOverrides {
  lt1_hr?: number | null;
  lt2_hr?: number | null;
  fatmax_hr?: number | null;
}

export interface AnthropometryData {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
  bodyFatPercent?: number;
  leanBodyMassKg?: number;
  source: AnthropometrySource;
  threshold_overrides?: ThresholdOverrides;
}

export interface Test {
  id: string;
  athlete_id: string;
  test_date: string;
  sport: Sport;
  test_type: TestType;
  status: TestStatus;
  anthropometry_source?: AnthropometrySource;
  anthropometry_snapshot?: AnthropometryData;
  created_at: string;
  updated_at: string;
}

export interface TestDataPoint {
  id: string;
  test_id: string;
  stage_number: number;
  duration_seconds: number;
  heart_rate: number;
  power_watts?: number | null;
  speed_pace?: string | null;
  vo2_ml_kg_min?: number | null;
  lactate?: number | null;
  rpe?: number | null;
  vt1_marker: boolean;
  vt2_marker: boolean;
  created_at: string;
}

export interface TrainingZone {
  zone: number;
  name: string;
  hr_min: number;
  hr_max: number;
  power_min?: number;
  power_max?: number;
  pace_min?: string | null;
  pace_max?: string | null;
  description: string;
}

export interface TestResults {
  id: string;
  test_id: string;
  vo2max?: number | null;
  vo2max_measured: boolean;
  lt1_hr?: number | null;
  lt1_power?: number | null;
  lt2_hr?: number | null;
  lt2_power?: number | null;
  fatmax_hr?: number | null;
  hr_drift_percent?: number | null;
  training_zones?: TrainingZone[] | null;
  coach_notes?: string | null;
  data_quality?: string | null;
  advanced_metrics?: AdvancedMetrics | null;
  created_at: string;
  updated_at: string;
}

export interface TestWithData {
  test: Test;
  athlete: Athlete;
  dataPoints: TestDataPoint[];
  results?: TestResults;
}

export interface LactateClearance {
  min5: number | null;
  min10: number | null;
  min20: number | null;
}

export interface RecoveryMetrics {
  hrv_post_exercise_ms: number | null;
  time_to_hr_baseline_min: number | null;
  lactate_clearance: LactateClearance;
  hr_drift_percent: number | null;
}

export interface MovementEconomyCycling {
  watts_per_kg_lbm: number | null;
  efficiency_percent: number | null;
}

export interface MovementEconomyRunning {
  cost_per_km_ml_o2_kg: number | null;
}

export interface MovementEconomy {
  cycling: MovementEconomyCycling;
  running: MovementEconomyRunning;
}

export interface EnergyProfile {
  rer_vs_stage: (number | null)[];
  percent_fat_vs_stage: (number | null)[];
  percent_carb_vs_stage: (number | null)[];
}

export interface AnaerobicTest {
  peak_power_watts: number | null;
  mean_power_watts: number | null;
  fatigue_index_percent: number | null;
  test_duration_seconds: number | null;
}

export interface AdvancedMetrics {
  recovery: RecoveryMetrics;
  movementEconomy: MovementEconomy;
  energyProfile: EnergyProfile;
  anaerobicTest: AnaerobicTest;
}
