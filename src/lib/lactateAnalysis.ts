import type { LactateThresholdConfig, Sport, TestDataPoint } from '../types';
import { fuelFromGasExchange } from './metabolicFuel';

export type LactateIssueSeverity = 'error' | 'warning' | 'info';

export interface LactateQualityIssue {
  code: string;
  severity: LactateIssueSeverity;
  message: string;
  stage?: number;
}

export interface LactateQualityReport {
  score: number;
  grade: 'excellent' | 'good' | 'limited' | 'invalid';
  sampleCount: number;
  unit: 'mmol/L';
  monotonicityPercent: number;
  loadMonotonic: boolean;
  duplicateLoads: number;
  validForThresholds: boolean;
  issues: LactateQualityIssue[];
}

export interface LactateCurvePoint {
  stage: number;
  load: number;
  loadType: 'power' | 'speed' | 'stage';
  measured: number;
  smoothed: number;
  heartRate: number;
  power: number | null;
  speedKmh: number | null;
  pace: string | null;
  vo2: number | null;
  vco2: number | null;
}

export interface LactateThresholdResult {
  method: LactateThresholdConfig['lt1Method'] | LactateThresholdConfig['lt2Method'];
  targetLactate: number | null;
  stage: number;
  load: number;
  loadType: LactateCurvePoint['loadType'];
  lactate: number;
  heartRate: number;
  power: number | null;
  speedKmh: number | null;
  pace: string | null;
  vo2: number | null;
}

export interface FuelStageResult {
  stage: number;
  rer: number;
  fatGramsPerMin: number;
  carbohydrateGramsPerMin: number;
  fatPercent: number;
  carbohydratePercent: number;
  source: 'measured_vco2';
}

export interface LactateAnalysisResult {
  config: LactateThresholdConfig;
  quality: LactateQualityReport;
  curve: LactateCurvePoint[];
  lt1: LactateThresholdResult | null;
  lt2: LactateThresholdResult | null;
  fuelProfile: FuelStageResult[];
  maxFatOxidation: FuelStageResult | null;
}

export interface LongitudinalLactateSession {
  id: string;
  date: string;
  points: TestDataPoint[];
  weightKg?: number | null;
  sport?: Sport;
}

export interface NormalizedLactateSession {
  id: string;
  date: string;
  basis: 'W/kg' | 'km/h';
  points: Array<{ load: number; lactate: number }>;
}

export const DEFAULT_LACTATE_CONFIG: LactateThresholdConfig = {
  lt1Method: 'baseline_plus_0_5',
  lt2Method: 'dmax',
  iatDeltaMmol: 1.5,
};

export function parseSpeedKmh(value: string | null | undefined, sport?: Sport): number | null {
  if (!value) return null;
  const text = value.trim();
  const pace = text.match(/^(\d+):([0-5]\d(?:[.,]\d+)?)\s*(?:\/\s*(km|100\s*m))?$/i);
  if (pace) {
    const minutes = Number(pace[1]) + Number(pace[2].replace(',', '.')) / 60;
    const suffix = pace[3]?.replace(/\s/g, '').toLowerCase();
    const distanceKm = suffix === '100m' || (!suffix && sport === 'swimming') ? 0.1 : 1;
    return minutes > 0 ? 60 * distanceKm / minutes : null;
  }
  // Do not interpret an unrecognised pace (e.g. 5:99/km) as a numeric speed.
  const numeric = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:km\/h|kmh|kph)?$/i);
  if (!numeric) return null;
  const speed = Number(numeric[1].replace(',', '.'));
  return Number.isFinite(speed) && speed > 0 ? speed : null;
}

function loadForPoint(point: TestDataPoint, sport?: Sport): Pick<LactateCurvePoint, 'load' | 'loadType' | 'speedKmh'> {
  if (sport !== 'running' && sport !== 'swimming' && point.power_watts != null && Number(point.power_watts) > 0) {
    return { load: Number(point.power_watts), loadType: 'power', speedKmh: parseSpeedKmh(point.speed_pace, sport) };
  }
  const speedKmh = parseSpeedKmh(point.speed_pace, sport);
  if (speedKmh != null) return { load: speedKmh, loadType: 'speed', speedKmh };
  return { load: Number(point.stage_number), loadType: 'stage', speedKmh: null };
}

/** Pool-adjacent-violators isotonic regression. Keeps raw samples untouched. */
export function isotonicSmooth(values: number[]): number[] {
  const blocks = values.map((value, index) => ({ sum: value, count: 1, start: index, end: index }));
  for (let i = 0; i < blocks.length - 1;) {
    const current = blocks[i].sum / blocks[i].count;
    const next = blocks[i + 1].sum / blocks[i + 1].count;
    if (current <= next) { i += 1; continue; }
    blocks[i] = {
      sum: blocks[i].sum + blocks[i + 1].sum,
      count: blocks[i].count + blocks[i + 1].count,
      start: blocks[i].start,
      end: blocks[i + 1].end,
    };
    blocks.splice(i + 1, 1);
    if (i > 0) i -= 1;
  }
  const smoothed = Array<number>(values.length);
  blocks.forEach(block => {
    const mean = block.sum / block.count;
    for (let i = block.start; i <= block.end; i += 1) smoothed[i] = mean;
  });
  return smoothed;
}

export function assessLactateQuality(points: TestDataPoint[], sport?: Sport): LactateQualityReport {
  const issues: LactateQualityIssue[] = [];
  const samples = points
    .filter(point => point.lactate != null && Number.isFinite(Number(point.lactate)))
    .sort((a, b) => Number(a.stage_number) - Number(b.stage_number));
  const loads = samples.map(point => loadForPoint(point, sport).load);
  const lactates = samples.map(point => Number(point.lactate));

  if (samples.length < 4) issues.push({ code: 'too_few_samples', severity: 'error', message: 'At least 4 valid lactate samples are required for threshold analysis.' });
  else if (samples.length < 6) issues.push({ code: 'limited_samples', severity: 'warning', message: 'Six or more samples are recommended for stable threshold detection.' });

  lactates.forEach((value, index) => {
    if (value < 0.3 || value > 25) issues.push({ code: 'lactate_out_of_range', severity: 'error', stage: samples[index].stage_number, message: `Lactate ${value} mmol/L is outside the accepted physiological range (0.3–25).` });
    if (index > 0 && Math.abs(value - lactates[index - 1]) > 8) issues.push({ code: 'abrupt_lactate_change', severity: 'warning', stage: samples[index].stage_number, message: 'Lactate changed by more than 8 mmol/L between adjacent stages.' });
  });

  const duplicateLoads = loads.length - new Set(loads.map(value => value.toFixed(4))).size;
  if (duplicateLoads > 0) issues.push({ code: 'duplicate_load', severity: 'warning', message: `${duplicateLoads} repeated load value(s) can make interpolation ambiguous.` });
  const loadMonotonic = loads.every((value, index) => index === 0 || value > loads[index - 1]);
  if (!loadMonotonic) issues.push({ code: 'non_monotonic_load', severity: 'error', message: 'External load must increase strictly between stages.' });

  const risingPairs = lactates.slice(1).filter((value, index) => value >= lactates[index]).length;
  const monotonicityPercent = lactates.length > 1 ? Math.round((risingPairs / (lactates.length - 1)) * 100) : 0;
  if (monotonicityPercent < 60) issues.push({ code: 'low_monotonicity', severity: 'warning', message: 'The lactate sequence has excessive reversals; review sampling timing and measurement quality.' });

  let score = 100;
  issues.forEach(issue => { score -= issue.severity === 'error' ? 25 : issue.severity === 'warning' ? 10 : 3; });
  score = Math.max(0, score);
  const validForThresholds = samples.length >= 4 && loadMonotonic && monotonicityPercent >= 60 && !issues.some(issue => issue.severity === 'error' && issue.code === 'lactate_out_of_range');
  const grade = !validForThresholds ? 'invalid' : score >= 90 ? 'excellent' : score >= 70 ? 'good' : 'limited';
  return { score, grade, sampleCount: samples.length, unit: 'mmol/L', monotonicityPercent, loadMonotonic, duplicateLoads, validForThresholds, issues };
}

function interpolateThreshold(a: LactateCurvePoint, b: LactateCurvePoint, target: number, method: LactateThresholdResult['method']): LactateThresholdResult {
  const fraction = b.smoothed !== a.smoothed ? Math.max(0, Math.min(1, (target - a.smoothed) / (b.smoothed - a.smoothed))) : 0;
  const interpolate = (x: number | null, y: number | null): number | null => x != null && y != null ? x + (y - x) * fraction : (x ?? y);
  return {
    method,
    targetLactate: target,
    stage: a.stage + (b.stage - a.stage) * fraction,
    load: a.load + (b.load - a.load) * fraction,
    loadType: a.loadType,
    lactate: target,
    heartRate: Math.round(a.heartRate + (b.heartRate - a.heartRate) * fraction),
    power: interpolate(a.power, b.power),
    speedKmh: interpolate(a.speedKmh, b.speedKmh),
    pace: fraction < 0.5 ? a.pace : b.pace,
    vo2: interpolate(a.vo2, b.vo2),
  };
}

function thresholdAtTarget(curve: LactateCurvePoint[], target: number, method: LactateThresholdResult['method']): LactateThresholdResult | null {
  if (!curve.length || !Number.isFinite(target) || target < curve[0].smoothed || target > curve[curve.length - 1].smoothed) return null;
  const crossing = curve.findIndex(point => point.smoothed >= target);
  if (crossing < 0) return null;
  if (crossing === 0) return interpolateThreshold(curve[0], curve[0], target, method);
  return interpolateThreshold(curve[crossing - 1], curve[crossing], target, method);
}

function dmax(curve: LactateCurvePoint[]): LactateThresholdResult | null {
  if (curve.length < 4) return null;
  const first = curve[0];
  const last = curve[curve.length - 1];
  const denominator = Math.hypot(last.smoothed - first.smoothed, last.load - first.load);
  if (denominator === 0) return null;
  let selected: LactateCurvePoint | null = null;
  let maxDistance = -1;
  curve.slice(1, -1).forEach(point => {
    const distance = Math.abs((last.smoothed - first.smoothed) * point.load - (last.load - first.load) * point.smoothed + last.load * first.smoothed - last.smoothed * first.load) / denominator;
    if (distance > maxDistance) { maxDistance = distance; selected = point; }
  });
  if (!selected) return null;
  const point = selected as LactateCurvePoint;
  return { method: 'dmax', targetLactate: null, stage: point.stage, load: point.load, loadType: point.loadType, lactate: point.smoothed, heartRate: point.heartRate, power: point.power, speedKmh: point.speedKmh, pace: point.pace, vo2: point.vo2 };
}

function calculateFuelProfile(points: TestDataPoint[], weightKg?: number | null): FuelStageResult[] {
  if (!weightKg || !Number.isFinite(weightKg) || weightKg <= 0) return [];
  return points.flatMap(point => {
    const vo2 = point.vo2_ml_kg_min != null ? Number(point.vo2_ml_kg_min) : null;
    const vco2 = point.vco2_ml_kg_min != null ? Number(point.vco2_ml_kg_min) : null;
    if (!vo2 || !vco2 || !Number.isFinite(vo2) || !Number.isFinite(vco2) || vo2 <= 0 || vco2 <= 0) return [];
    const vo2L = vo2 * weightKg / 1000;
    const vco2L = vco2 * weightKg / 1000;
    const fuel = fuelFromGasExchange(vo2L, vco2L);
    if (!fuel) return [];
    return [{
      stage: Number(point.stage_number),
      rer: Math.round(fuel.rer * 1000) / 1000,
      fatGramsPerMin: Math.round(fuel.fatGramsPerMin * 1000) / 1000,
      carbohydrateGramsPerMin: Math.round(fuel.carbohydrateGramsPerMin * 1000) / 1000,
      fatPercent: Math.round(fuel.fatPercent * 10) / 10,
      carbohydratePercent: Math.round(fuel.carbohydratePercent * 10) / 10,
      source: 'measured_vco2' as const,
    }];
  });
}

export function analyzeLactate(points: TestDataPoint[], weightKg?: number | null, config: Partial<LactateThresholdConfig> = {}, sport?: Sport): LactateAnalysisResult {
  const resolvedConfig: LactateThresholdConfig = {
    lt1Method: config.lt1Method ?? DEFAULT_LACTATE_CONFIG.lt1Method,
    lt2Method: config.lt2Method ?? DEFAULT_LACTATE_CONFIG.lt2Method,
    iatDeltaMmol: config.iatDeltaMmol ?? DEFAULT_LACTATE_CONFIG.iatDeltaMmol,
  };
  const valid = points
    .filter(point => point.lactate != null && Number.isFinite(Number(point.lactate)))
    .map(point => ({ point, ...loadForPoint(point, sport) }))
    .sort((a, b) => a.load - b.load);
  const smooth = isotonicSmooth(valid.map(item => Number(item.point.lactate)));
  const curve: LactateCurvePoint[] = valid.map((item, index) => ({
    stage: Number(item.point.stage_number), load: item.load, loadType: item.loadType,
    measured: Number(item.point.lactate), smoothed: Math.round(smooth[index] * 1000) / 1000,
    heartRate: Number(item.point.heart_rate), power: item.point.power_watts != null ? Number(item.point.power_watts) : null,
    speedKmh: item.speedKmh, pace: item.point.speed_pace ?? null,
    vo2: item.point.vo2_ml_kg_min != null ? Number(item.point.vo2_ml_kg_min) : null,
    vco2: item.point.vco2_ml_kg_min != null ? Number(item.point.vco2_ml_kg_min) : null,
  }));
  const quality = assessLactateQuality(points, sport);
  const baseline = curve.length ? Math.min(...curve.map(point => point.smoothed)) : null;

  let lt1: LactateThresholdResult | null = null;
  if (baseline != null) {
    lt1 = resolvedConfig.lt1Method === 'fixed_2mmol'
      ? thresholdAtTarget(curve, 2, 'fixed_2mmol')
      : thresholdAtTarget(curve, baseline + 0.5, 'baseline_plus_0_5');
  }

  let lt2: LactateThresholdResult | null = null;
  if (resolvedConfig.lt2Method === 'dmax') lt2 = dmax(curve);
  else if (resolvedConfig.lt2Method === 'obla_4mmol') lt2 = thresholdAtTarget(curve, 4, 'obla_4mmol');
  else if (baseline != null) lt2 = thresholdAtTarget(curve, baseline + resolvedConfig.iatDeltaMmol, 'iat');

  if (!quality.validForThresholds) { lt1 = null; lt2 = null; }
  const fuelProfile = calculateFuelProfile(points, weightKg);
  const maxFatOxidation = fuelProfile.reduce<FuelStageResult | null>((best, point) => !best || point.fatGramsPerMin > best.fatGramsPerMin ? point : best, null);
  return { config: resolvedConfig, quality, curve, lt1, lt2, fuelProfile, maxFatOxidation };
}

export function normalizeLongitudinalLactate(sessions: LongitudinalLactateSession[]): NormalizedLactateSession[] {
  return sessions.flatMap(session => {
    const lactatePoints = session.points.filter(point => point.lactate != null);
    const usePower = Boolean(session.weightKg && lactatePoints.some(point => point.power_watts != null));
    const normalized = lactatePoints.flatMap(point => {
      if (usePower && point.power_watts != null && session.weightKg) return [{ load: Number(point.power_watts) / session.weightKg, lactate: Number(point.lactate) }];
      const speed = parseSpeedKmh(point.speed_pace, session.sport);
      return speed != null ? [{ load: speed, lactate: Number(point.lactate) }] : [];
    });
    return normalized.length ? [{ id: session.id, date: session.date, basis: usePower ? 'W/kg' as const : 'km/h' as const, points: normalized }] : [];
  });
}
