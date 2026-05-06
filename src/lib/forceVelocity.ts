export interface FVRepInput {
  load_kg: number;
  body_mass_kg: number;
  displacement_m: number;
  duration_s: number;
  set_number?: number;
  rep_number?: number;
  data_source?: 'encoder' | 'video' | 'manual';
}

export interface FVRepResult {
  load_kg: number;
  set_number: number;
  rep_number: number;
  mean_velocity_ms: number;
  peak_velocity_ms: number;
  mean_force_n: number;
  peak_force_n: number;
  mean_power_w: number;
  peak_power_w: number;
  displacement_m: number;
  duration_s: number;
  data_source: 'encoder' | 'video' | 'manual';
  is_valid: boolean;
  validation_note: string | null;
}

export interface FVProfile {
  f0: number;
  v0: number;
  pmax: number;
  slope: number;
  r_squared: number;
  optimal_velocity: number;
  optimal_force: number;
  f0_relative: number;
  pmax_relative: number;
  fv_imbalance_percent: number;
  fv_imbalance_direction: 'force_deficit' | 'velocity_deficit' | 'balanced';
}

export interface FVCurvePoint {
  velocity: number;
  force: number;
  power: number;
  label: string;
}

const G = 9.81;

export function calculateRepMetrics(rep: FVRepInput): FVRepResult {
  const totalMass = rep.load_kg + rep.body_mass_kg;
  const meanVelocity = rep.displacement_m / rep.duration_s;

  const peakVelocity = meanVelocity * 1.6;

  const acceleration = meanVelocity / rep.duration_s;
  const meanForce = totalMass * (G + acceleration);
  const peakForce = totalMass * (G + acceleration * 2.5);

  const meanPower = meanForce * meanVelocity;
  const peakPower = peakForce * peakVelocity;

  const validation = validateRep(meanVelocity, meanForce, rep.duration_s);

  return {
    load_kg: rep.load_kg,
    set_number: rep.set_number ?? 1,
    rep_number: rep.rep_number ?? 1,
    mean_velocity_ms: Math.round(meanVelocity * 1000) / 1000,
    peak_velocity_ms: Math.round(peakVelocity * 1000) / 1000,
    mean_force_n: Math.round(meanForce * 10) / 10,
    peak_force_n: Math.round(peakForce * 10) / 10,
    mean_power_w: Math.round(meanPower * 10) / 10,
    peak_power_w: Math.round(peakPower * 10) / 10,
    displacement_m: rep.displacement_m,
    duration_s: rep.duration_s,
    data_source: rep.data_source ?? 'manual',
    is_valid: validation.is_valid,
    validation_note: validation.note,
  };
}

function validateRep(velocity: number, force: number, duration: number): { is_valid: boolean; note: string | null } {
  if (velocity > 3.5) return { is_valid: false, note: 'Velocity too high (> 3.5 m/s) — check displacement/duration' };
  if (velocity < 0.05) return { is_valid: false, note: 'Rep too slow (< 0.05 m/s) — insufficient velocity for analysis' };
  if (force < 50) return { is_valid: false, note: 'Force too low — check load and body mass values' };
  if (duration < 0.1) return { is_valid: false, note: 'Duration too short — check timing data' };
  if (duration > 10) return { is_valid: false, note: 'Duration too long — likely a tracking error' };
  return { is_valid: true, note: null };
}

export function computeFVProfile(reps: FVRepResult[], bodyMassKg: number): FVProfile | null {
  const validReps = reps.filter(r => r.is_valid && r.mean_velocity_ms > 0 && r.mean_force_n > 0);

  if (validReps.length < 2) return null;

  const uniqueLoads = [...new Set(validReps.map(r => r.load_kg))];
  if (uniqueLoads.length < 2) return null;

  const loadAverages = uniqueLoads.map(load => {
    const atLoad = validReps.filter(r => r.load_kg === load);
    const avgVelocity = atLoad.reduce((sum, r) => sum + r.mean_velocity_ms, 0) / atLoad.length;
    const avgForce = atLoad.reduce((sum, r) => sum + r.mean_force_n, 0) / atLoad.length;
    return { velocity: avgVelocity, force: avgForce };
  });

  loadAverages.sort((a, b) => a.velocity - b.velocity);

  const regression = linearRegression(
    loadAverages.map(p => p.velocity),
    loadAverages.map(p => p.force)
  );

  if (!regression) return null;

  const f0 = regression.intercept;
  const v0 = -regression.intercept / regression.slope;

  if (f0 <= 0 || v0 <= 0) return null;

  const pmax = (f0 * v0) / 4;
  const slope = regression.slope;
  const optimalVelocity = v0 / 2;
  const optimalForce = f0 / 2;

  const theoreticalSlope = -f0 / v0;
  const actualSlope = slope;
  const fvImbalancePercent = Math.abs(((actualSlope - theoreticalSlope) / theoreticalSlope) * 100);
  let fvImbalanceDirection: FVProfile['fv_imbalance_direction'] = 'balanced';
  if (fvImbalancePercent > 10) {
    fvImbalanceDirection = slope < theoreticalSlope ? 'force_deficit' : 'velocity_deficit';
  }

  return {
    f0: Math.round(f0 * 10) / 10,
    v0: Math.round(v0 * 1000) / 1000,
    pmax: Math.round(pmax * 10) / 10,
    slope: Math.round(slope * 100) / 100,
    r_squared: Math.round(regression.r_squared * 10000) / 10000,
    optimal_velocity: Math.round(optimalVelocity * 1000) / 1000,
    optimal_force: Math.round(optimalForce * 10) / 10,
    f0_relative: Math.round((f0 / (bodyMassKg * G)) * 100) / 100,
    pmax_relative: Math.round((pmax / bodyMassKg) * 100) / 100,
    fv_imbalance_percent: Math.round(fvImbalancePercent * 10) / 10,
    fv_imbalance_direction: fvImbalanceDirection,
  };
}

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r_squared: number } | null {
  const n = x.length;
  if (n < 2) return null;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
  const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2), 0);
  const r_squared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r_squared };
}

export function generateFVCurvePoints(profile: FVProfile, numPoints = 50): FVCurvePoint[] {
  const points: FVCurvePoint[] = [];
  const step = profile.v0 / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const v = i * step;
    const f = Math.max(0, profile.f0 + profile.slope * v);
    const p = f * v;
    points.push({
      velocity: Math.round(v * 1000) / 1000,
      force: Math.round(f * 10) / 10,
      power: Math.round(p * 10) / 10,
      label: `v=${v.toFixed(2)} m/s`,
    });
  }

  return points;
}

export function getFVImbalanceLabel(profile: FVProfile): string {
  if (profile.fv_imbalance_direction === 'balanced') {
    return 'Well-balanced F-V profile';
  }
  if (profile.fv_imbalance_direction === 'force_deficit') {
    return `Force deficit (${profile.fv_imbalance_percent.toFixed(1)}%) — prioritize strength training`;
  }
  return `Velocity deficit (${profile.fv_imbalance_percent.toFixed(1)}%) — prioritize speed/power training`;
}

export function getFVQualityLabel(r_squared: number): { label: string; color: string } {
  if (r_squared >= 0.95) return { label: 'Excellent fit', color: 'green' };
  if (r_squared >= 0.85) return { label: 'Good fit', color: 'blue' };
  if (r_squared >= 0.70) return { label: 'Acceptable', color: 'amber' };
  return { label: 'Poor fit — check data', color: 'red' };
}

export interface FVLoadZone {
  stimulus: string;
  velocityRange: [number, number];
  targetVelocity: number;
  recommendedLoad_kg: number;
  recommendedLoad_percent1RM: number;
  description: string;
  color: string;
}

export interface FVLoadRecommendation {
  estimated1RM_kg: number;
  zones: FVLoadZone[];
}

export function computeLoadRecommendations(profile: FVProfile, bodyMassKg: number): FVLoadRecommendation {
  const ZONES: Array<{
    stimulus: string;
    velocityRange: [number, number];
    targetVelocity: number;
    description: string;
    color: string;
  }> = [
    { stimulus: 'Max Strength', velocityRange: [0.15, 0.35], targetVelocity: 0.25, description: 'Heavy loads — neural adaptation, maximal force production', color: 'red' },
    { stimulus: 'Strength-Speed', velocityRange: [0.35, 0.60], targetVelocity: 0.45, description: 'High load, moderate velocity — functional strength transfer', color: 'orange' },
    { stimulus: 'Power (Pmax)', velocityRange: [0.60, 0.85], targetVelocity: profile.optimal_velocity, description: 'Optimal power zone — maximum mechanical output', color: 'amber' },
    { stimulus: 'Speed-Strength', velocityRange: [0.85, 1.15], targetVelocity: 0.95, description: 'Moderate load, high velocity — rate of force development', color: 'green' },
    { stimulus: 'Max Speed', velocityRange: [1.15, profile.v0 * 0.95], targetVelocity: profile.v0 * 0.80, description: 'Light load — velocity, reactive & ballistic training', color: 'blue' },
  ];

  const estimated1RM_kg = Math.max(0, (-profile.f0 / profile.slope - bodyMassKg));

  const zones: FVLoadZone[] = ZONES.map(zone => {
    const targetV = Math.min(zone.targetVelocity, profile.v0 * 0.95);
    const forceAtV = Math.max(0, profile.f0 + profile.slope * targetV);
    const totalMass = forceAtV / 9.81;
    const loadKg = Math.max(0, Math.round((totalMass - bodyMassKg) * 2) / 2);
    const pct1RM = estimated1RM_kg > 0 ? Math.round((loadKg / estimated1RM_kg) * 100) : 0;

    return {
      stimulus: zone.stimulus,
      velocityRange: zone.velocityRange,
      targetVelocity: Math.round(targetV * 1000) / 1000,
      recommendedLoad_kg: loadKg,
      recommendedLoad_percent1RM: Math.min(100, Math.max(0, pct1RM)),
      description: zone.description,
      color: zone.color,
    };
  });

  return { estimated1RM_kg: Math.round(estimated1RM_kg * 2) / 2, zones };
}

export const COMMON_EXERCISES = [
  'Back Squat',
  'Front Squat',
  'Romanian Deadlift',
  'Deadlift',
  'Hip Thrust',
  'Bench Press',
  'Overhead Press',
  'Pull-up',
  'Jump Squat',
  'Power Clean',
  'Lunge',
  'Leg Press',
  'Hex Bar Deadlift',
  'Split Squat',
  'Other',
];
