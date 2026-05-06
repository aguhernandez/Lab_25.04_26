import { HeatHistoryEntry } from './heatAdaptation';
import { HydrationHistoryEntry } from './hydration';

export interface CoupledDataPoint {
  date: string;
  hrDrift: number;
  correctedDrift: number | null;
  percentDehydration: number;
  temperature_c: number;
  humidity_percent: number | null;
  rpe: number | null;
  sweatRate: number | null;
  limitingFactor: 'Hydration' | 'Aerobic Capacity' | 'Combined' | 'Unknown';
  driftReduction: number | null;
}

export interface CouplingAnalysis {
  dataPoints: CoupledDataPoint[];
  correlation: 'Strong' | 'Moderate' | 'Weak' | 'Insufficient Data';
  performanceSensitivity: 'High' | 'Moderate' | 'Low' | 'Unknown';
  primaryLimitingFactor: 'Hydration' | 'Aerobic Capacity' | 'Combined' | 'Unknown';
  recommendation: string;
  performanceDecayEstimate: number | null;
  avgDriftAtOptimalHydration: number | null;
  avgDriftAtSuboptimalHydration: number | null;
  stabilityIndex: number | null;
  stabilityClassification: 'High Stability' | 'Moderate Stability' | 'Low Stability' | 'Insufficient Data';
  hydrationPerformanceCoupling: {
    driftCorrelation: 'Strong' | 'Moderate' | 'Weak' | 'None' | 'Insufficient Data';
    performanceSensitivity: 'High' | 'Moderate' | 'Low' | 'Unknown';
    recommendation: string;
  };
  heatAdaptationSummary: {
    score: number | null;
    trend: 'improving' | 'stable' | 'declining' | 'insufficient';
    avgHRDrift_hot_sessions: number | null;
    avgSweatRate_L_h: number | null;
    heatToleranceClassification: 'Well Adapted' | 'Adapting' | 'Poor Tolerance' | 'Insufficient Data';
  };
}

export function matchHydrationToHeatSessions(
  heatHistory: HeatHistoryEntry[],
  hydrationHistory: HydrationHistoryEntry[],
  windowDays = 2
): CoupledDataPoint[] {
  const points: CoupledDataPoint[] = [];

  for (const heatEntry of heatHistory) {
    if (heatEntry.hrDriftPercent === null) continue;

    const heatDate = new Date(heatEntry.date).getTime();
    const matchedHydration = hydrationHistory.find(h => {
      const hydDate = new Date(h.date).getTime();
      return Math.abs(heatDate - hydDate) <= windowDays * 86400000;
    });

    const dehydration = matchedHydration
      ? matchedHydration.percentDehydration
      : heatEntry.percentDehydration ?? 0;

    const corrected = heatEntry.correctedDriftPercent !== undefined
      ? heatEntry.correctedDriftPercent
      : computeCorrectedDrift(heatEntry.hrDriftPercent, dehydration);

    const driftReduction = corrected !== null
      ? Math.round((heatEntry.hrDriftPercent - corrected) * 100) / 100
      : null;

    const limitingFactor = determineLimitingFactor(
      heatEntry.hrDriftPercent,
      corrected,
      dehydration
    );

    points.push({
      date: heatEntry.date,
      hrDrift: heatEntry.hrDriftPercent,
      correctedDrift: corrected,
      percentDehydration: dehydration,
      temperature_c: heatEntry.temperature_c,
      humidity_percent: heatEntry.humidity_percent,
      rpe: heatEntry.rpe,
      sweatRate: matchedHydration?.sweatRate_L_h ?? heatEntry.sweatRate_L_h ?? null,
      limitingFactor,
      driftReduction,
    });
  }

  return points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function computeCorrectedDrift(hrDrift: number, dehydration: number): number | null {
  if (dehydration <= 0) return hrDrift;
  const factor = 1 + dehydration * 0.2;
  return Math.round((hrDrift / factor) * 100) / 100;
}

function determineLimitingFactor(
  rawDrift: number,
  correctedDrift: number | null,
  dehydration: number
): CoupledDataPoint['limitingFactor'] {
  if (correctedDrift === null) return 'Unknown';

  const driftReduction = rawDrift - correctedDrift;
  const reductionRatio = driftReduction / rawDrift;

  if (dehydration < 1.5 && rawDrift > 5) {
    return 'Aerobic Capacity';
  }
  if (reductionRatio > 0.4 && dehydration > 2) {
    return 'Hydration';
  }
  if (reductionRatio > 0.2 && rawDrift > 3) {
    return 'Combined';
  }
  return 'Unknown';
}

function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - meanX) * (y[i] - meanY);
    denomX += (x[i] - meanX) ** 2;
    denomY += (y[i] - meanY) ** 2;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return null;
  return num / denom;
}

export function analyzeCoupling(
  heatHistory: HeatHistoryEntry[],
  hydrationHistory: HydrationHistoryEntry[]
): CouplingAnalysis {
  const dataPoints = matchHydrationToHeatSessions(heatHistory, hydrationHistory);

  const insufficient: CouplingAnalysis = {
    dataPoints,
    correlation: 'Insufficient Data',
    performanceSensitivity: 'Unknown',
    primaryLimitingFactor: 'Unknown',
    recommendation: 'Record at least 3 heat sessions with HR drift data to generate coupling analysis.',
    performanceDecayEstimate: null,
    avgDriftAtOptimalHydration: null,
    avgDriftAtSuboptimalHydration: null,
    stabilityIndex: null,
    stabilityClassification: 'Insufficient Data',
    hydrationPerformanceCoupling: {
      driftCorrelation: 'Insufficient Data',
      performanceSensitivity: 'Unknown',
      recommendation: 'Insufficient data.',
    },
    heatAdaptationSummary: buildAdaptationSummary(heatHistory),
  };

  if (dataPoints.length < 3) return insufficient;

  const dehydrations = dataPoints.map(d => d.percentDehydration);
  const drifts = dataPoints.map(d => d.hrDrift);

  const r = pearsonCorrelation(dehydrations, drifts);
  const rAbs = r !== null ? Math.abs(r) : 0;

  const correlationLabel: CouplingAnalysis['correlation'] =
    r === null ? 'Insufficient Data'
    : rAbs >= 0.6 ? 'Strong'
    : rAbs >= 0.35 ? 'Moderate'
    : 'Weak';

  const wellHydrated = dataPoints.filter(d => d.percentDehydration <= 1.5);
  const suboptimal = dataPoints.filter(d => d.percentDehydration > 2);

  const avgOptimal = wellHydrated.length > 0
    ? Math.round((wellHydrated.reduce((s, d) => s + d.hrDrift, 0) / wellHydrated.length) * 100) / 100
    : null;

  const avgSuboptimal = suboptimal.length > 0
    ? Math.round((suboptimal.reduce((s, d) => s + d.hrDrift, 0) / suboptimal.length) * 100) / 100
    : null;

  const sensitivityDelta = avgOptimal !== null && avgSuboptimal !== null
    ? avgSuboptimal - avgOptimal
    : null;

  const sensitivity: CouplingAnalysis['performanceSensitivity'] =
    sensitivityDelta === null ? 'Unknown'
    : sensitivityDelta >= 3 ? 'High'
    : sensitivityDelta >= 1.5 ? 'Moderate'
    : 'Low';

  const hydrationLimitedCount = dataPoints.filter(d => d.limitingFactor === 'Hydration').length;
  const aerobicLimitedCount = dataPoints.filter(d => d.limitingFactor === 'Aerobic Capacity').length;
  const combinedCount = dataPoints.filter(d => d.limitingFactor === 'Combined').length;

  let primaryLimiter: CouplingAnalysis['primaryLimitingFactor'] = 'Unknown';
  if (hydrationLimitedCount > aerobicLimitedCount && hydrationLimitedCount > combinedCount) {
    primaryLimiter = 'Hydration';
  } else if (aerobicLimitedCount > hydrationLimitedCount && aerobicLimitedCount > combinedCount) {
    primaryLimiter = 'Aerobic Capacity';
  } else if (combinedCount > 0) {
    primaryLimiter = 'Combined';
  }

  const avgDrift = drifts.reduce((a, b) => a + b, 0) / drifts.length;
  const performanceDecayEstimate =
    correlationLabel !== 'Insufficient Data' && avgDrift > 3
      ? Math.round((avgDrift * 0.6) * 10) / 10
      : null;

  const correctedDrifts = dataPoints
    .filter(d => d.correctedDrift !== null)
    .map(d => d.correctedDrift!);
  const avgCorrected = correctedDrifts.length > 0
    ? correctedDrifts.reduce((a, b) => a + b, 0) / correctedDrifts.length
    : null;
  const stabilityIndex = avgCorrected !== null
    ? Math.round(Math.max(0, Math.min(100, 100 - avgCorrected * 10)) * 10) / 10
    : null;

  const stabilityClassification: CouplingAnalysis['stabilityClassification'] =
    stabilityIndex === null ? 'Insufficient Data'
    : stabilityIndex >= 70 ? 'High Stability'
    : stabilityIndex >= 45 ? 'Moderate Stability'
    : 'Low Stability';

  const recommendation = buildRecommendation(primaryLimiter, sensitivity, correlationLabel, avgOptimal);

  return {
    dataPoints,
    correlation: correlationLabel,
    performanceSensitivity: sensitivity,
    primaryLimitingFactor: primaryLimiter,
    recommendation,
    performanceDecayEstimate,
    avgDriftAtOptimalHydration: avgOptimal,
    avgDriftAtSuboptimalHydration: avgSuboptimal,
    stabilityIndex,
    stabilityClassification,
    hydrationPerformanceCoupling: {
      driftCorrelation: correlationLabel as CouplingAnalysis['hydrationPerformanceCoupling']['driftCorrelation'],
      performanceSensitivity: sensitivity,
      recommendation,
    },
    heatAdaptationSummary: buildAdaptationSummary(heatHistory),
  };
}

function buildAdaptationSummary(history: HeatHistoryEntry[]): CouplingAnalysis['heatAdaptationSummary'] {
  if (history.length < 2) {
    return {
      score: null,
      trend: 'insufficient',
      avgHRDrift_hot_sessions: null,
      avgSweatRate_L_h: null,
      heatToleranceClassification: 'Insufficient Data',
    };
  }

  const scores = history.filter(h => h.heatAdaptationScore !== null).map(h => h.heatAdaptationScore!);
  const latestScore = scores[0] ?? null;

  let trend: CouplingAnalysis['heatAdaptationSummary']['trend'] = 'insufficient';
  if (scores.length >= 3) {
    const recent = scores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const baseline = scores.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, scores.length);
    const delta = recent - baseline;
    trend = delta > 3 ? 'improving' : delta < -3 ? 'declining' : 'stable';
  }

  const drifts = history.filter(h => h.hrDriftPercent !== null).map(h => h.hrDriftPercent!);
  const avgDrift = drifts.length > 0 ? Math.round((drifts.reduce((a, b) => a + b, 0) / drifts.length) * 100) / 100 : null;

  const sweatRates = history.filter(h => h.sweatRate_L_h !== null).map(h => h.sweatRate_L_h!);
  const avgSweat = sweatRates.length > 0 ? Math.round((sweatRates.reduce((a, b) => a + b, 0) / sweatRates.length) * 1000) / 1000 : null;

  let tolerance: CouplingAnalysis['heatAdaptationSummary']['heatToleranceClassification'] = 'Insufficient Data';
  if (latestScore !== null) {
    tolerance = latestScore >= 75 ? 'Well Adapted' : latestScore >= 50 ? 'Adapting' : 'Poor Tolerance';
  }

  return {
    score: latestScore,
    trend,
    avgHRDrift_hot_sessions: avgDrift,
    avgSweatRate_L_h: avgSweat,
    heatToleranceClassification: tolerance,
  };
}

function buildRecommendation(
  limiter: CoupledDataPoint['limitingFactor'],
  sensitivity: CouplingAnalysis['performanceSensitivity'],
  correlation: CouplingAnalysis['correlation'],
  avgOptimal: number | null
): string {
  if (correlation === 'Insufficient Data') {
    return 'Record more sessions with HR drift and hydration data to generate personalized recommendations.';
  }
  if (limiter === 'Hydration' && sensitivity === 'High') {
    const threshold = avgOptimal !== null ? `${avgOptimal.toFixed(1)}%` : 'low';
    return `Strict hydration protocol required. Drift is ${threshold} when well-hydrated vs significantly higher when dehydrated. Prioritize pre-hydration and fluid intake strategies above 25°C.`;
  }
  if (limiter === 'Aerobic Capacity') {
    return 'HR drift persists even when well-hydrated — primary limiter is aerobic base, not plasma volume. Focus on aerobic capacity development before heat acclimation blocks.';
  }
  if (limiter === 'Combined') {
    return 'Both hydration and aerobic base are contributing to drift. Address hydration protocols in the short term while building aerobic foundation for long-term improvement.';
  }
  if (sensitivity === 'Low') {
    return 'Low sensitivity to hydration status — cardiovascular stability is relatively independent of hydration. Good aerobic base likely compensating. Maintain standard hydration protocols.';
  }
  return 'Continue monitoring. Ensure consistent pre-session hydration to isolate aerobic capacity as the key limiting variable.';
}

export function getCorrelationBg(c: string): string {
  switch (c) {
    case 'Strong': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    case 'Moderate': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    case 'Weak': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-500';
  }
}

export function getSensitivityBg(s: string): string {
  switch (s) {
    case 'High': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    case 'Moderate': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    case 'Low': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-500';
  }
}

export function getLimiterBg(l: string): string {
  switch (l) {
    case 'Hydration': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    case 'Aerobic Capacity': return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300';
    case 'Combined': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-500';
  }
}

export function getToleranceBg(t: string): string {
  switch (t) {
    case 'Well Adapted': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    case 'Adapting': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    case 'Poor Tolerance': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-500';
  }
}
