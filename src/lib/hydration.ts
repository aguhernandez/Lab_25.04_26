export interface HydrationInput {
  sessionDate: string;
  preWeight_kg: number;
  postWeight_kg: number;
  fluidIntake_mL: number;
  urineOutput_mL: number;
  duration_min: number;
  temperature_C?: number;
  humidity_percent?: number;
  avgHR?: number;
  rpe?: number;
  usg_pre?: number;
  usg_post?: number;
  notes?: string;
}

export interface HydrationResults {
  adjustedSweatLoss_kg: number;
  percentDehydration: number;
  sweatRate_L_h: number;
  heatStressFactor: number;
  hydrationStressScore: number;
  stressClassification: 'Low' | 'Moderate' | 'High' | 'Severe';
  usgPreClassification: string | null;
  usgPostClassification: string | null;
  hydrationWarning: string | null;
  performanceRisk: string | null;
}

export interface HydrationSessionRecord {
  id: string;
  athlete_id: string;
  session_date: string;
  pre_weight_kg: number;
  post_weight_kg: number;
  fluid_intake_ml: number;
  urine_output_ml: number;
  duration_min: number;
  temperature_c: number | null;
  humidity_percent: number | null;
  avg_hr: number | null;
  rpe: number | null;
  usg_pre: number | null;
  usg_post: number | null;
  adjusted_sweat_loss_kg: number | null;
  percent_dehydration: number | null;
  sweat_rate_l_h: number | null;
  heat_stress_factor: number | null;
  hydration_stress_score: number | null;
  stress_classification: string | null;
  usg_classification: string | null;
  usg_post_classification: string | null;
  notes: string | null;
  created_at: string;
}

export interface HydrationProfile {
  id: string;
  athlete_id: string;
  baseline_usg: number | null;
  classification_pre_session: string | null;
  last_session_date: string | null;
  last_percent_dehydration: number | null;
  last_sweat_rate_l_h: number | null;
  last_hydration_stress_score: number | null;
  last_classification: string | null;
  last_temperature_c: number | null;
  last_humidity_percent: number | null;
  average_sweat_rate_l_h: number | null;
  max_observed_dehydration_percent: number | null;
  total_sessions: number;
  history: HydrationHistoryEntry[];
  hydration_warning: string | null;
  performance_risk: string | null;
}

export interface HydrationHistoryEntry {
  date: string;
  percentDehydration: number;
  sweatRate_L_h: number;
  hydrationStressScore: number;
  classification: 'Low' | 'Moderate' | 'High' | 'Severe';
  temperature_C: number | null;
  humidity_percent: number | null;
  usg_pre: number | null;
  usg_post: number | null;
}

export function classifyUSG(usg: number): string {
  if (usg <= 1.010) return 'Well Hydrated';
  if (usg <= 1.020) return 'Euhydrated';
  if (usg <= 1.030) return 'Mild Hypohydration';
  return 'Significant Hypohydration';
}

export function calculateHydration(input: HydrationInput): HydrationResults {
  const fluidIntake_L = input.fluidIntake_mL / 1000;
  const urineOutput_L = input.urineOutput_mL / 1000;

  const adjustedSweatLoss_kg =
    (input.preWeight_kg - input.postWeight_kg) +
    fluidIntake_L -
    urineOutput_L;

  const percentDehydration = (adjustedSweatLoss_kg / input.preWeight_kg) * 100;

  const duration_h = input.duration_min / 60;
  const sweatRate_L_h = adjustedSweatLoss_kg / duration_h;

  let heatStressFactor = 1;
  if (input.temperature_C !== undefined) {
    if (input.temperature_C >= 28) {
      heatStressFactor += 0.4;
    } else if (input.temperature_C >= 20) {
      heatStressFactor += 0.2;
    }
  }
  if (input.humidity_percent !== undefined && input.humidity_percent >= 70) {
    heatStressFactor += 0.2;
  }

  const hydrationStressScore = percentDehydration * heatStressFactor;

  let stressClassification: HydrationResults['stressClassification'];
  if (hydrationStressScore < 1.5) {
    stressClassification = 'Low';
  } else if (hydrationStressScore < 3) {
    stressClassification = 'Moderate';
  } else if (hydrationStressScore < 5) {
    stressClassification = 'High';
  } else {
    stressClassification = 'Severe';
  }

  const usgPreClassification = input.usg_pre !== undefined ? classifyUSG(input.usg_pre) : null;
  const usgPostClassification = input.usg_post !== undefined ? classifyUSG(input.usg_post) : null;

  let hydrationWarning: string | null = null;
  let performanceRisk: string | null = null;

  if (percentDehydration > 3) {
    performanceRisk = 'Performance impairment likely (3–5% VO2max reduction expected).';
  } else if (percentDehydration > 2) {
    hydrationWarning = 'Dehydration >2% may increase HR drift and alter threshold interpretation.';
  }

  return {
    adjustedSweatLoss_kg: Math.round(adjustedSweatLoss_kg * 1000) / 1000,
    percentDehydration: Math.round(percentDehydration * 100) / 100,
    sweatRate_L_h: Math.round(sweatRate_L_h * 1000) / 1000,
    heatStressFactor: Math.round(heatStressFactor * 100) / 100,
    hydrationStressScore: Math.round(hydrationStressScore * 100) / 100,
    stressClassification,
    usgPreClassification,
    usgPostClassification,
    hydrationWarning,
    performanceRisk,
  };
}

export function getStressColor(classification: string): string {
  switch (classification) {
    case 'Low': return 'text-green-600 dark:text-green-400';
    case 'Moderate': return 'text-yellow-600 dark:text-yellow-400';
    case 'High': return 'text-orange-600 dark:text-orange-400';
    case 'Severe': return 'text-red-600 dark:text-red-400';
    default: return 'text-gray-600 dark:text-gray-400';
  }
}

export function getStressBgColor(classification: string): string {
  switch (classification) {
    case 'Low': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'Moderate': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    case 'High': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400';
    case 'Severe': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  }
}

export function getUsgColor(classification: string): string {
  switch (classification) {
    case 'Well Hydrated': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'Euhydrated': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    case 'Mild Hypohydration': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    case 'Significant Hypohydration': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  }
}
