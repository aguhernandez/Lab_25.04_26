export interface HeatSessionInput {
  sessionDate: string;
  temperature_c: number;
  humidity_percent?: number;
  sport: 'cycling' | 'running' | 'other';
  duration_min: number;
  avgHR?: number;
  hrFirstHalf?: number;
  hrSecondHalf?: number;
  externalLoad?: number;
  loadUnit: 'watts' | 'km_h';
  preWeight_kg?: number;
  postWeight_kg?: number;
  fluidIntake_mL?: number;
  rpe?: number;
  notes?: string;
}

export interface HeatSessionResults {
  percentDehydration: number | null;
  sweatRate_L_h: number | null;
  heatCardiacLoad: number | null;
  hrDriftPercent: number | null;
  correctedDriftPercent: number | null;
  heatAdaptationScore: number | null;
  hrDriftClassification: 'Stable' | 'Moderate' | 'High Stress' | 'N/A';
  cardiacLoadInterpretation: string;
  adaptationClassification: 'Insufficient Data' | 'Minimal' | 'Moderate' | 'Good' | 'Excellent';
}

export interface HeatHistoryEntry {
  date: string;
  temperature_c: number;
  humidity_percent: number | null;
  avgHR: number | null;
  heatCardiacLoad: number | null;
  hrDriftPercent: number | null;
  correctedDriftPercent: number | null;
  rpe: number | null;
  sweatRate_L_h: number | null;
  percentDehydration: number | null;
  heatAdaptationScore: number | null;
  adaptationClassification: string;
}

export interface HeatProfile {
  id?: string;
  athlete_id: string;
  total_sessions: number;
  baseline_cardiac_load: number | null;
  latest_cardiac_load: number | null;
  cardiac_load_trend: number | null;
  baseline_hr_drift: number | null;
  latest_hr_drift: number | null;
  hr_drift_trend: number | null;
  baseline_rpe: number | null;
  latest_rpe: number | null;
  rpe_trend: number | null;
  avg_sweat_rate_l_h: number | null;
  latest_sweat_rate_l_h: number | null;
  adaptation_score: number | null;
  adaptation_classification: string;
  last_session_date: string | null;
  history: HeatHistoryEntry[];
}

export function calculateHeatSession(input: HeatSessionInput): HeatSessionResults {
  let percentDehydration: number | null = null;
  let sweatRate_L_h: number | null = null;

  if (input.preWeight_kg && input.postWeight_kg && input.duration_min > 0) {
    const weightLoss_kg = input.preWeight_kg - input.postWeight_kg;
    const fluidIntake_kg = (input.fluidIntake_mL ?? 0) / 1000;
    const adjustedSweatLoss = weightLoss_kg + fluidIntake_kg;
    percentDehydration = (adjustedSweatLoss / input.preWeight_kg) * 100;
    sweatRate_L_h = (adjustedSweatLoss / input.duration_min) * 60;
    percentDehydration = Math.max(0, Math.round(percentDehydration * 1000) / 1000);
    sweatRate_L_h = Math.max(0, Math.round(sweatRate_L_h * 1000) / 1000);
  }

  let heatCardiacLoad: number | null = null;
  let cardiacLoadInterpretation = 'Insufficient data — enter HR and external load';
  if (input.avgHR && input.externalLoad && input.externalLoad > 0) {
    heatCardiacLoad = Math.round((input.avgHR / input.externalLoad) * 10000) / 10000;
    cardiacLoadInterpretation = 'Baseline established — track across sessions to detect adaptation';
  }

  let hrDriftPercent: number | null = null;
  let correctedDriftPercent: number | null = null;
  let hrDriftClassification: HeatSessionResults['hrDriftClassification'] = 'N/A';
  if (input.hrFirstHalf && input.hrSecondHalf && input.hrFirstHalf > 0) {
    hrDriftPercent = ((input.hrSecondHalf - input.hrFirstHalf) / input.hrFirstHalf) * 100;
    hrDriftPercent = Math.round(hrDriftPercent * 100) / 100;
    if (hrDriftPercent < 3) hrDriftClassification = 'Stable';
    else if (hrDriftPercent < 5) hrDriftClassification = 'Moderate';
    else hrDriftClassification = 'High Stress';

    if (percentDehydration !== null) {
      const dehydrationFactor = 1 + percentDehydration * 0.2;
      correctedDriftPercent = Math.round((hrDriftPercent / dehydrationFactor) * 100) / 100;
    }
  }

  const score = computeAdaptationScore({
    heatCardiacLoad,
    hrDriftPercent,
    rpe: input.rpe ?? null,
    sweatRate_L_h,
  });

  const adaptationClassification = classifyAdaptation(score);

  return {
    percentDehydration,
    sweatRate_L_h,
    heatCardiacLoad,
    hrDriftPercent,
    correctedDriftPercent,
    heatAdaptationScore: score,
    hrDriftClassification,
    cardiacLoadInterpretation,
    adaptationClassification,
  };
}

function computeAdaptationScore(params: {
  heatCardiacLoad: number | null;
  hrDriftPercent: number | null;
  rpe: number | null;
  sweatRate_L_h: number | null;
}): number | null {
  const components: number[] = [];

  if (params.hrDriftPercent !== null) {
    const driftScore = Math.max(0, Math.min(100, 100 - (params.hrDriftPercent / 10) * 100));
    components.push(driftScore);
  }

  if (params.rpe !== null) {
    const rpeScore = Math.max(0, Math.min(100, ((20 - params.rpe) / 14) * 100));
    components.push(rpeScore);
  }

  if (components.length === 0) return null;

  const score = components.reduce((a, b) => a + b, 0) / components.length;
  return Math.round(score * 10) / 10;
}

export function classifyAdaptation(score: number | null): HeatSessionResults['adaptationClassification'] {
  if (score === null) return 'Insufficient Data';
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Moderate';
  return 'Minimal';
}

export function computeTrend(history: HeatHistoryEntry[]): {
  cardiacLoadTrend: number | null;
  hrDriftTrend: number | null;
  rpeTrend: number | null;
} {
  if (history.length < 2) {
    return { cardiacLoadTrend: null, hrDriftTrend: null, rpeTrend: null };
  }

  const last3 = history.slice(0, Math.min(3, history.length));
  const oldest = history[history.length - 1];

  const avgCardiac = last3
    .filter(h => h.heatCardiacLoad !== null)
    .reduce((s, h, _, a) => s + (h.heatCardiacLoad! / a.length), 0) || null;

  const avgDrift = last3
    .filter(h => h.hrDriftPercent !== null)
    .reduce((s, h, _, a) => s + (h.hrDriftPercent! / a.length), 0) || null;

  const avgRpe = last3
    .filter(h => h.rpe !== null)
    .reduce((s, h, _, a) => s + (h.rpe! / a.length), 0) || null;

  const cardiacLoadTrend =
    avgCardiac !== null && oldest.heatCardiacLoad !== null
      ? Math.round((avgCardiac - oldest.heatCardiacLoad) * 10000) / 10000
      : null;

  const hrDriftTrend =
    avgDrift !== null && oldest.hrDriftPercent !== null
      ? Math.round((avgDrift - oldest.hrDriftPercent) * 100) / 100
      : null;

  const rpeTrend =
    avgRpe !== null && oldest.rpe !== null
      ? Math.round((avgRpe - oldest.rpe) * 10) / 10
      : null;

  return { cardiacLoadTrend, hrDriftTrend, rpeTrend };
}

export function getDriftColor(classification: HeatSessionResults['hrDriftClassification']): string {
  switch (classification) {
    case 'Stable': return 'text-green-600 dark:text-green-400';
    case 'Moderate': return 'text-yellow-600 dark:text-yellow-400';
    case 'High Stress': return 'text-red-600 dark:text-red-400';
    default: return 'text-gray-400';
  }
}

export function getDriftBg(classification: HeatSessionResults['hrDriftClassification']): string {
  switch (classification) {
    case 'Stable': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    case 'Moderate': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    case 'High Stress': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-500';
  }
}

export function getAdaptationColor(classification: string): string {
  switch (classification) {
    case 'Excellent': return 'text-green-600 dark:text-green-400';
    case 'Good': return 'text-teal-600 dark:text-teal-400';
    case 'Moderate': return 'text-yellow-600 dark:text-yellow-400';
    case 'Minimal': return 'text-orange-600 dark:text-orange-400';
    default: return 'text-gray-400';
  }
}

export function getAdaptationBg(classification: string): string {
  switch (classification) {
    case 'Excellent': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    case 'Good': return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300';
    case 'Moderate': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    case 'Minimal': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-500';
  }
}

export function getTrendArrow(trend: number | null, invertPositive = false): { symbol: string; color: string } {
  if (trend === null || Math.abs(trend) < 0.001) return { symbol: '→', color: 'text-gray-400' };
  const isImproving = invertPositive ? trend < 0 : trend > 0;
  if (isImproving) {
    return { symbol: '↓', color: 'text-green-500' };
  }
  return { symbol: '↑', color: 'text-red-500' };
}
