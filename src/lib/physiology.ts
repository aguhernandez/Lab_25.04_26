import { Athlete, TestDataPoint, TrainingZone, Sport, AdvancedMetrics, ThresholdOverrides, UnifiedThresholds, VTSource, ThresholdData } from '../types';
import { buildTrainingZonesData, calculateZones7, convertTo5Zones, TrainingZonesData, ZoneCalculationOptions } from './trainingZones';
import { getCurrentLanguage } from '../contexts/LanguageContext';

export type ConfidenceLevel = 'measured' | 'estimated' | 'inferred';

/**
 * Converts VO2 from ml/kg/min (relative) to L/min (absolute)
 * @param vo2_ml_kg_min - VO2 in ml/kg/min
 * @param weight_kg - Body weight in kg
 * @returns VO2 in L/min
 */
function convertVO2ToAbsolute(vo2_ml_kg_min: number, weight_kg: number): number {
  return (vo2_ml_kg_min * weight_kg) / 1000;
}

export interface EnergyMix {
  fat_percent: number;
  carb_percent: number;
  fat_grams_per_min: number;
  carb_grams_per_min: number;
}

export interface StageAnalysis extends TestDataPoint {
  vo2_percent_max: number | null;
  hr_percent_max: number;
  energy_mix: EnergyMix | null;
}

export interface PhysiologyResults {
  vo2max: number | null;
  vo2max_confidence: ConfidenceLevel;
  vo2max_ml_kg_min: number | null;
  vo2max_ml_kg_lbm_min: number | null;
  vo2max_ml_kg_ffm_min: number | null;
  vo2max_ml_kg_muscle_min: number | null;
  vo2max_ml_min: number | null;
  lt1_hr: number | null;
  lt1_power: number | null;
  lt1_pace: string | null;
  lt1_vo2: number | null;
  lt1_percent_vo2max: number | null;
  lt1_percent_hrmax: number | null;
  lt1_confidence: ConfidenceLevel;
  lt2_hr: number | null;
  lt2_power: number | null;
  lt2_pace: string | null;
  lt2_vo2: number | null;
  lt2_percent_vo2max: number | null;
  lt2_percent_hrmax: number | null;
  lt2_confidence: ConfidenceLevel;
  fatmax_hr: number | null;
  fatmax_power: number | null;
  fatmax_pace: string | null;
  fatmax_vo2: number | null;
  fatmax_confidence: ConfidenceLevel;
  fatmax_method: 'calorimetry' | 'lt1_proxy' | 'inferred';
  vam_kmh: number | null;
  pam_watts: number | null;
  hr_drift_percent: number | null;
  hrmax: number;
  hrmax_confidence: ConfidenceLevel;
  training_zones: TrainingZone[];
  zones_data: TrainingZonesData;
  data_quality: string;
  data_quality_score: number;
  metabolic_profile: {
    aerobic_capacity: string;
    fat_utilization: string;
    anaerobic_contribution: string;
    durability: string;
  };
  stage_analysis: StageAnalysis[];
  has_power: boolean;
  has_lactate: boolean;
  has_vo2: boolean;
  has_rer: boolean;
  has_pace: boolean;
  threshold_source: 'ventilatory' | 'lactate';
  // Unified thresholds (LT + VT)
  thresholds: UnifiedThresholds;
}

function normalizeDataPoints(dataPoints: TestDataPoint[]): TestDataPoint[] {
  return dataPoints.map(p => ({
    ...p,
    stage_number: Number(p.stage_number),
    duration_seconds: Number(p.duration_seconds),
    heart_rate: Number(p.heart_rate),
    power_watts: p.power_watts != null ? Number(p.power_watts) : null,
    vo2_ml_kg_min: p.vo2_ml_kg_min != null ? Number(p.vo2_ml_kg_min) : null,
    vco2_ml_kg_min: p.vco2_ml_kg_min != null ? Number(p.vco2_ml_kg_min) : null,
    lactate: p.lactate != null ? Number(p.lactate) : null,
    rpe: p.rpe != null ? Number(p.rpe) : null,
  }));
}

function normalizeAthlete(athlete: Athlete): Athlete {
  return {
    ...athlete,
    weight_kg: athlete.weight_kg != null ? Number(athlete.weight_kg) : undefined,
    height_cm: athlete.height_cm != null ? Number(athlete.height_cm) : undefined,
    body_fat_percent: athlete.body_fat_percent != null ? Number(athlete.body_fat_percent) : undefined,
    lean_body_mass_kg: athlete.lean_body_mass_kg != null ? Number(athlete.lean_body_mass_kg) : undefined,
  };
}

export function calculatePhysiology(
  athlete: Athlete,
  dataPoints: TestDataPoint[],
  overrides?: ThresholdOverrides,
  breathVT?: { VT1: ThresholdData; VT2: ThresholdData; vt_source: VTSource } | null
): PhysiologyResults {
  const athlete_ = normalizeAthlete(athlete);
  const sortedPoints = normalizeDataPoints([...dataPoints]).sort((a, b) => a.stage_number - b.stage_number);

  if (sortedPoints.length === 0) {
    return emptyPhysiologyResults();
  }
  // shadow original parameters so all downstream code uses normalized values
  athlete = athlete_;
  dataPoints = sortedPoints;

  const has_power = sortedPoints.some(p => p.power_watts !== null && p.power_watts !== undefined);
  const has_lactate = sortedPoints.some(p => p.lactate !== null && p.lactate !== undefined);
  const has_vo2 = sortedPoints.some(p => p.vo2_ml_kg_min !== null && p.vo2_ml_kg_min !== undefined);
  const has_rer = sortedPoints.some(p => p.vco2_ml_kg_min != null && p.vco2_ml_kg_min > 0);
  const has_pace = sortedPoints.some(p => p.speed_pace !== null && p.speed_pace !== undefined && p.speed_pace !== '');

  const leanBodyMassKg = calculateLeanBodyMass(athlete);

  const { hrmax, hrmax_confidence } = determineHRMax(athlete, sortedPoints);

  const { vo2max, vo2max_ml_kg_min, vo2max_ml_kg_lbm_min, vo2max_ml_kg_ffm_min, vo2max_ml_kg_muscle_min, vo2max_ml_min, vo2max_confidence } = calculateVO2max(
    athlete,
    sortedPoints,
    has_vo2,
    has_power,
    leanBodyMassKg
  );

  let { lt1_hr, lt1_power, lt1_pace, lt1_vo2, lt1_percent_vo2max, lt1_percent_hrmax, lt1_confidence } = calculateLT1(
    sortedPoints,
    has_lactate,
    vo2max,
    hrmax,
    athlete.weight_kg || null
  );

  let { lt2_hr, lt2_power, lt2_pace, lt2_vo2, lt2_percent_vo2max, lt2_percent_hrmax, lt2_confidence } = calculateLT2(
    sortedPoints,
    has_lactate,
    vo2max,
    hrmax,
    athlete.weight_kg || null
  );

  let { fatmax_hr, fatmax_power, fatmax_pace, fatmax_vo2, fatmax_confidence, fatmax_method } = calculateFatMax(
    sortedPoints,
    null,
    hrmax,
    has_lactate,
    has_rer,
    lt1_hr,
    lt1_confidence,
    athlete.weight_kg || null
  );

  // Apply manual threshold overrides if provided
  if (overrides && sortedPoints.length > 0) {
    const weightKg = athlete.weight_kg || null;
    if (overrides.lt1_hr) {
      const closest = sortedPoints.reduce((prev, curr) =>
        Math.abs(curr.heart_rate - overrides.lt1_hr!) < Math.abs(prev.heart_rate - overrides.lt1_hr!) ? curr : prev
      );
      lt1_hr = overrides.lt1_hr;
      lt1_power = closest.power_watts || null;
      lt1_pace = closest.speed_pace || null;
      lt1_vo2 = closest.vo2_ml_kg_min && weightKg ? convertVO2ToAbsolute(closest.vo2_ml_kg_min, weightKg) : null;
      lt1_percent_vo2max = vo2max && closest.vo2_ml_kg_min ? Math.round((closest.vo2_ml_kg_min / vo2max) * 1000) / 10 : null;
      lt1_percent_hrmax = Math.round((overrides.lt1_hr / hrmax) * 1000) / 10;
      lt1_confidence = 'measured';
    }
    if (overrides.lt2_hr) {
      const closest = sortedPoints.reduce((prev, curr) =>
        Math.abs(curr.heart_rate - overrides.lt2_hr!) < Math.abs(prev.heart_rate - overrides.lt2_hr!) ? curr : prev
      );
      lt2_hr = overrides.lt2_hr;
      lt2_power = closest.power_watts || null;
      lt2_pace = closest.speed_pace || null;
      lt2_vo2 = closest.vo2_ml_kg_min && weightKg ? convertVO2ToAbsolute(closest.vo2_ml_kg_min, weightKg) : null;
      lt2_percent_vo2max = vo2max && closest.vo2_ml_kg_min ? Math.round((closest.vo2_ml_kg_min / vo2max) * 1000) / 10 : null;
      lt2_percent_hrmax = Math.round((overrides.lt2_hr / hrmax) * 1000) / 10;
      lt2_confidence = 'measured';
    }
    if (overrides.fatmax_hr) {
      const closest = sortedPoints.reduce((prev, curr) =>
        Math.abs(curr.heart_rate - overrides.fatmax_hr!) < Math.abs(prev.heart_rate - overrides.fatmax_hr!) ? curr : prev
      );
      fatmax_hr = overrides.fatmax_hr;
      fatmax_power = closest.power_watts || null;
      fatmax_pace = closest.speed_pace || null;
      fatmax_vo2 = closest.vo2_ml_kg_min || null;
      fatmax_confidence = 'measured';
    }
  }

  const { vam_kmh, pam_watts } = calculateVAMandPAM(sortedPoints, has_power, athlete.sport);

  const hr_drift_percent = calculateHRDrift(sortedPoints);

  const thresholdSource: 'ventilatory' | 'lactate' = has_lactate ? 'lactate' : 'ventilatory';
  const zoneOptions: ZoneCalculationOptions = {
    vam_kmh,
    pam_watts,
    threshold_source: thresholdSource,
    threshold_confidence: lt1_confidence,
    language: getCurrentLanguage(),
  };

  const zones7 = calculateZones7(lt1_hr, lt2_hr, hrmax, athlete.sport, sortedPoints, zoneOptions);
  const training_zones: TrainingZone[] = convertTo5Zones(zones7, athlete.sport, getCurrentLanguage()).map(z => ({
    ...z,
    power_min: z.power_min ?? undefined,
    power_max: z.power_max ?? undefined,
  }));

  const zones_data = buildTrainingZonesData(
    lt1_hr,
    lt2_hr,
    hrmax,
    athlete.sport,
    '5',
    sortedPoints,
    zoneOptions
  );

  const { quality_text, quality_score } = assessDataQuality(
    sortedPoints,
    has_power,
    has_lactate,
    has_vo2,
    has_rer
  );

  const metabolic_profile = generateMetabolicProfile(
    vo2max,
    lt2_hr,
    fatmax_hr,
    hr_drift_percent,
    hrmax,
    has_vo2
  );

  const stage_analysis = generateStageAnalysis(
    sortedPoints,
    vo2max,
    hrmax,
    has_vo2,
    athlete.weight_kg || null
  );

  // Build unified thresholds (LT + VT)
  const thresholds = buildUnifiedThresholds(
    { lt1_hr, lt1_power, lt1_pace, lt1_vo2, lt1_percent_vo2max, lt1_percent_hrmax, lt1_confidence },
    { lt2_hr, lt2_power, lt2_pace, lt2_vo2, lt2_percent_vo2max, lt2_percent_hrmax, lt2_confidence },
    overrides,
    hrmax,
    vo2max,
    breathVT
  );

  return {
    vo2max,
    vo2max_confidence,
    vo2max_ml_kg_min,
    vo2max_ml_kg_lbm_min,
    vo2max_ml_kg_ffm_min,
    vo2max_ml_kg_muscle_min,
    vo2max_ml_min,
    lt1_hr,
    lt1_power,
    lt1_pace,
    lt1_vo2,
    lt1_percent_vo2max,
    lt1_percent_hrmax,
    lt1_confidence,
    lt2_hr,
    lt2_power,
    lt2_pace,
    lt2_vo2,
    lt2_percent_vo2max,
    lt2_percent_hrmax,
    lt2_confidence,
    fatmax_hr,
    fatmax_power,
    fatmax_pace,
    fatmax_vo2,
    fatmax_confidence,
    fatmax_method,
    vam_kmh,
    pam_watts,
    hr_drift_percent,
    hrmax,
    hrmax_confidence,
    training_zones,
    zones_data,
    data_quality: quality_text,
    data_quality_score: quality_score,
    metabolic_profile,
    stage_analysis,
    has_power,
    has_lactate,
    has_vo2,
    has_rer,
    has_pace,
    threshold_source: thresholdSource,
    thresholds
  };
}

function emptyPhysiologyResults(): PhysiologyResults {
  return {
    vo2max: null, vo2max_confidence: 'inferred', vo2max_ml_kg_min: null,
    vo2max_ml_kg_lbm_min: null, vo2max_ml_kg_ffm_min: null, vo2max_ml_kg_muscle_min: null, vo2max_ml_min: null,
    lt1_hr: null, lt1_power: null, lt1_pace: null, lt1_vo2: null, lt1_percent_vo2max: null, lt1_percent_hrmax: null, lt1_confidence: 'inferred',
    lt2_hr: null, lt2_power: null, lt2_pace: null, lt2_vo2: null, lt2_percent_vo2max: null, lt2_percent_hrmax: null, lt2_confidence: 'inferred',
    fatmax_hr: null, fatmax_power: null, fatmax_pace: null, fatmax_vo2: null, fatmax_confidence: 'inferred', fatmax_method: 'inferred',
    vam_kmh: null, pam_watts: null, hr_drift_percent: null, hrmax: 0, hrmax_confidence: 'inferred',
    training_zones: [], zones_data: {} as TrainingZonesData, data_quality: 'No data', data_quality_score: 0,
    metabolic_profile: { aerobic_capacity: 'Unknown', fat_utilization: 'Unknown', anaerobic_contribution: 'Unknown', durability: 'Unknown' },
    stage_analysis: [], has_power: false, has_lactate: false, has_vo2: false, has_rer: false, has_pace: false,
    threshold_source: 'lactate', thresholds: { LT1: { hr: null, vo2: null, power: null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'inferred' }, LT2: { hr: null, vo2: null, power: null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'inferred' }, VT1: { hr: null, vo2: null, power: null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'inferred' }, VT2: { hr: null, vo2: null, power: null, pace: null, percent_vo2max: null, percent_hrmax: null, confidence: 'inferred' }, vt_source: 'estimated_from_lt', delta_lt1_vt1_hr: null, delta_lt2_vt2_hr: null },
  };
}

function calculateLeanBodyMass(athlete: Athlete): number | null {
  if (!athlete.weight_kg || !athlete.body_fat_percent) return null;
  return athlete.weight_kg * (1 - athlete.body_fat_percent / 100);
}

function buildUnifiedThresholds(
  lt1: { lt1_hr: number | null; lt1_power: number | null; lt1_pace: string | null; lt1_vo2: number | null; lt1_percent_vo2max: number | null; lt1_percent_hrmax: number | null; lt1_confidence: ConfidenceLevel },
  lt2: { lt2_hr: number | null; lt2_power: number | null; lt2_pace: string | null; lt2_vo2: number | null; lt2_percent_vo2max: number | null; lt2_percent_hrmax: number | null; lt2_confidence: ConfidenceLevel },
  overrides: ThresholdOverrides | undefined,
  hrmax: number,
  vo2max: number | null,
  breathVT?: { VT1: ThresholdData; VT2: ThresholdData; vt_source: VTSource } | null
): UnifiedThresholds {
  const vt_source: VTSource = breathVT?.vt_source ?? overrides?.vt_source ?? 'estimated_from_lt';

  const LT1: ThresholdData = {
    hr: lt1.lt1_hr,
    vo2: lt1.lt1_vo2,
    power: lt1.lt1_power,
    pace: lt1.lt1_pace,
    percent_vo2max: lt1.lt1_percent_vo2max,
    percent_hrmax: lt1.lt1_percent_hrmax,
    confidence: lt1.lt1_confidence,
  };

  const LT2: ThresholdData = {
    hr: lt2.lt2_hr,
    vo2: lt2.lt2_vo2,
    power: lt2.lt2_power,
    pace: lt2.lt2_pace,
    percent_vo2max: lt2.lt2_percent_vo2max,
    percent_hrmax: lt2.lt2_percent_hrmax,
    confidence: lt2.lt2_confidence,
  };

  let VT1: ThresholdData;
  let VT2: ThresholdData;

  if (vt_source === 'direct_measurement' && breathVT) {
    VT1 = breathVT.VT1;
    VT2 = breathVT.VT2;
  } else if (vt_source === 'manual' && overrides) {
    const vt1_hr = overrides.vt1_hr ?? null;
    const vt2_hr = overrides.vt2_hr ?? null;
    VT1 = {
      hr: vt1_hr,
      vo2: overrides.vt1_vo2 ?? null,
      power: overrides.vt1_power ?? null,
      pace: overrides.vt1_pace ?? null,
      percent_vo2max: vo2max && overrides.vt1_vo2 ? Math.round((overrides.vt1_vo2 / vo2max) * 1000) / 10 : null,
      percent_hrmax: vt1_hr ? Math.round((vt1_hr / hrmax) * 1000) / 10 : null,
      confidence: 'manual',
    };
    VT2 = {
      hr: vt2_hr,
      vo2: overrides.vt2_vo2 ?? null,
      power: overrides.vt2_power ?? null,
      pace: overrides.vt2_pace ?? null,
      percent_vo2max: vo2max && overrides.vt2_vo2 ? Math.round((overrides.vt2_vo2 / vo2max) * 1000) / 10 : null,
      percent_hrmax: vt2_hr ? Math.round((vt2_hr / hrmax) * 1000) / 10 : null,
      confidence: 'manual',
    };
  } else {
    // Estimated from LT: VT1 = LT1, VT2 = LT2
    VT1 = { ...LT1, confidence: 'estimated' };
    VT2 = { ...LT2, confidence: 'estimated' };
  }

  const delta_lt1_vt1_hr = (LT1.hr != null && VT1.hr != null) ? VT1.hr - LT1.hr : null;
  const delta_lt2_vt2_hr = (LT2.hr != null && VT2.hr != null) ? VT2.hr - LT2.hr : null;

  return { LT1, LT2, VT1, VT2, vt_source, delta_lt1_vt1_hr, delta_lt2_vt2_hr };
}

function determineHRMax(
  _athlete: Athlete,
  points: TestDataPoint[]
): { hrmax: number; hrmax_confidence: ConfidenceLevel } {
  const observedMaxHR = Math.max(...points.map(p => p.heart_rate));
  return { hrmax: observedMaxHR, hrmax_confidence: 'measured' };
}

function calculateVO2max(
  athlete: Athlete,
  points: TestDataPoint[],
  hasVO2: boolean,
  hasPower: boolean,
  leanBodyMassKg: number | null
): {
  vo2max: number | null;
  vo2max_ml_kg_min: number | null;
  vo2max_ml_kg_lbm_min: number | null;
  vo2max_ml_kg_ffm_min: number | null;
  vo2max_ml_kg_muscle_min: number | null;
  vo2max_ml_min: number | null;
  vo2max_confidence: ConfidenceLevel;
} {
  if (hasVO2 && athlete.weight_kg) {
    const vo2Values = points.filter(p => p.vo2_ml_kg_min).map(p => p.vo2_ml_kg_min!);
    const vo2max_ml_kg_min = Math.max(...vo2Values);

    const vo2max_ml_min = vo2max_ml_kg_min * athlete.weight_kg;
    const vo2max_ml_kg_lbm_min = leanBodyMassKg ? vo2max_ml_min / leanBodyMassKg : null;

    return {
      vo2max: vo2max_ml_kg_min,
      vo2max_ml_kg_min,
      vo2max_ml_kg_lbm_min,
      vo2max_ml_kg_ffm_min: null,
      vo2max_ml_kg_muscle_min: null,
      vo2max_ml_min,
      vo2max_confidence: 'measured'
    };
  }

  if (hasPower && athlete.weight_kg) {
    const maxPower = Math.max(...points.map(p => p.power_watts || 0));
    const vo2_estimated = estimateVO2FromPower(maxPower, athlete.weight_kg);
    const vo2_ml_min = vo2_estimated * athlete.weight_kg;
    const vo2max_ml_kg_lbm_min = leanBodyMassKg ? vo2_ml_min / leanBodyMassKg : null;

    return {
      vo2max: vo2_estimated,
      vo2max_ml_kg_min: vo2_estimated,
      vo2max_ml_kg_lbm_min,
      vo2max_ml_kg_ffm_min: null,
      vo2max_ml_kg_muscle_min: null,
      vo2max_ml_min: vo2_ml_min,
      vo2max_confidence: 'estimated'
    };
  }

  if (!athlete.weight_kg || !athlete.sex) {
    return {
      vo2max: null,
      vo2max_ml_kg_min: null,
      vo2max_ml_kg_lbm_min: null,
      vo2max_ml_kg_ffm_min: null,
      vo2max_ml_kg_muscle_min: null,
      vo2max_ml_min: null,
      vo2max_confidence: 'inferred'
    };
  }

  const isMale = athlete.sex === 'male';
  const baseVO2max = isMale ? 45 : 38;
  const vo2_ml_min = baseVO2max * athlete.weight_kg;
  const vo2max_ml_kg_lbm_min = leanBodyMassKg ? vo2_ml_min / leanBodyMassKg : null;

  return {
    vo2max: baseVO2max,
    vo2max_ml_kg_min: baseVO2max,
    vo2max_ml_kg_lbm_min,
    vo2max_ml_kg_ffm_min: null,
    vo2max_ml_kg_muscle_min: null,
    vo2max_ml_min: vo2_ml_min,
    vo2max_confidence: 'inferred'
  };
}

function estimateVO2FromPower(powerWatts: number, weightKg: number): number {
  // Hawley & Noakes (1992): VO2max (ml/kg/min) = 10.8 * W/kg + 7
  return (10.8 * powerWatts) / weightKg + 7;
}

function calculateLT1(
  points: TestDataPoint[],
  hasLactate: boolean,
  vo2max: number | null,
  hrmax: number,
  weightKg: number | null
): {
  lt1_hr: number | null;
  lt1_power: number | null;
  lt1_pace: string | null;
  lt1_vo2: number | null;
  lt1_percent_vo2max: number | null;
  lt1_percent_hrmax: number | null;
  lt1_confidence: ConfidenceLevel;
} {
  let lt1Point: TestDataPoint | null = null;
  let confidence: ConfidenceLevel = 'estimated';

  if (hasLactate) {
    const lactatePoints = points.filter(p => p.lactate !== null && p.lactate !== undefined);

    if (lactatePoints.length >= 3) {
      // Modified Beaver et al. method: LT1 = first point where lactate rises >= 0.5 mmol/L above baseline
      // Baseline is the minimum lactate value in the test (resting or first stage value)
      const baseline = Math.min(...lactatePoints.map(p => p.lactate!));
      const lt1Threshold = baseline + 0.5;

      // Find the FIRST point that crosses the threshold (not just any point)
      const crossingPoint = lactatePoints.find(p => p.lactate! >= lt1Threshold) || null;

      if (crossingPoint) {
        // If there's a point just before the crossing, use linear interpolation to refine
        const crossingIndex = lactatePoints.indexOf(crossingPoint);
        if (crossingIndex > 0) {
          lt1Point = lactatePoints[crossingIndex - 1];
        } else {
          lt1Point = crossingPoint;
        }
        confidence = 'measured';
      }
    }

    // Fallback: use the point closest to 2.0 mmol/L (individual aerobic threshold, IAT)
    // Only if no crossing found
    if (!lt1Point && lactatePoints.length >= 2) {
      const targetLactate = 2.0;
      lt1Point = lactatePoints.reduce((prev, curr) =>
        Math.abs(curr.lactate! - targetLactate) < Math.abs(prev.lactate! - targetLactate) ? curr : prev
      );
      if (lt1Point) confidence = 'measured';
    }
  }

  if (!lt1Point) {
    const vt1Point = points.find(p => p.vt1_marker);
    if (vt1Point) {
      lt1Point = vt1Point;
      confidence = 'measured';
    }
  }

  if (!lt1Point && vo2max) {
    const targetVO2 = vo2max * 0.65;
    lt1Point = findClosestPointByVO2(points, targetVO2);
    if (lt1Point) {
      confidence = 'estimated';
    }
  }

  if (!lt1Point && points.length > 0) {
    const estimatedLT1_HR = Math.round(hrmax * 0.70);
    lt1Point = points.reduce((prev, curr) =>
      Math.abs(curr.heart_rate - estimatedLT1_HR) < Math.abs(prev.heart_rate - estimatedLT1_HR)
        ? curr
        : prev
    );
    confidence = 'estimated';
  }

  if (!lt1Point) {
    return {
      lt1_hr: null, lt1_power: null, lt1_pace: null, lt1_vo2: null,
      lt1_percent_vo2max: null, lt1_percent_hrmax: null, lt1_confidence: 'inferred',
    };
  }

  const lt1_vo2_ml_kg_min = lt1Point.vo2_ml_kg_min || null;
  const lt1_vo2 = lt1_vo2_ml_kg_min && weightKg ? convertVO2ToAbsolute(lt1_vo2_ml_kg_min, weightKg) : null;
  let lt1_percent_vo2max: number | null = null;
  if (vo2max && lt1_vo2_ml_kg_min) {
    lt1_percent_vo2max = Math.round((lt1_vo2_ml_kg_min / vo2max) * 100 * 10) / 10;
  }
  const lt1_percent_hrmax = Math.round((lt1Point.heart_rate / hrmax) * 100 * 10) / 10;

  return {
    lt1_hr: lt1Point.heart_rate,
    lt1_power: lt1Point.power_watts || null,
    lt1_pace: lt1Point.speed_pace || null,
    lt1_vo2,
    lt1_percent_vo2max,
    lt1_percent_hrmax,
    lt1_confidence: confidence
  };
}

function calculateLT2(
  points: TestDataPoint[],
  hasLactate: boolean,
  vo2max: number | null,
  hrmax: number,
  weightKg: number | null
): {
  lt2_hr: number | null;
  lt2_power: number | null;
  lt2_pace: string | null;
  lt2_vo2: number | null;
  lt2_percent_vo2max: number | null;
  lt2_percent_hrmax: number | null;
  lt2_confidence: ConfidenceLevel;
} {
  let lt2Point: TestDataPoint | null = null;
  let confidence: ConfidenceLevel = 'estimated';

  if (hasLactate) {
    const lactatePoints = points.filter(p => p.lactate !== null && p.lactate !== undefined);

    // Primary method: Dmax (when sufficient points exist) — Cheng et al. 1992
    // Dmax uses HR or power as X-axis for physiological relevance
    if (lactatePoints.length >= 4) {
      const dmaxPoint = calculateDmax(lactatePoints);
      if (dmaxPoint) {
        lt2Point = dmaxPoint;
        confidence = 'measured';
      }
    }

    // If Dmax fails or lactate reaches 4.0 mmol/L (OBLA, Sjödin & Jacobs 1981),
    // prefer the 4.0 mmol/L point as it represents the onset of blood lactate accumulation
    const oblaPoint = lactatePoints.find(p => p.lactate! >= 4.0) || null;
    if (oblaPoint) {
      // Use the stage just before 4.0 mmol/L if available (as LT2 is the threshold, not above it)
      const oblaIndex = lactatePoints.indexOf(oblaPoint);
      if (oblaIndex > 0 && lactatePoints[oblaIndex - 1].lactate! < 4.0) {
        lt2Point = lactatePoints[oblaIndex - 1];
      } else {
        lt2Point = oblaPoint;
      }
      confidence = 'measured';
    }
  }

  if (!lt2Point) {
    const vt2Point = points.find(p => p.vt2_marker);
    if (vt2Point) {
      lt2Point = vt2Point;
      confidence = 'measured';
    }
  }

  if (!lt2Point && vo2max) {
    const targetVO2 = vo2max * 0.88;
    lt2Point = findClosestPointByVO2(points, targetVO2);
    if (lt2Point) {
      confidence = 'estimated';
    }
  }

  if (!lt2Point && points.length > 0) {
    const estimatedLT2_HR = Math.round(hrmax * 0.90);
    lt2Point = points.reduce((prev, curr) =>
      Math.abs(curr.heart_rate - estimatedLT2_HR) < Math.abs(prev.heart_rate - estimatedLT2_HR)
        ? curr
        : prev
    );
    confidence = 'estimated';
  }

  if (!lt2Point) {
    return {
      lt2_hr: null, lt2_power: null, lt2_pace: null, lt2_vo2: null,
      lt2_percent_vo2max: null, lt2_percent_hrmax: null, lt2_confidence: 'inferred',
    };
  }

  const lt2_vo2_ml_kg_min = lt2Point.vo2_ml_kg_min || null;
  const lt2_vo2 = lt2_vo2_ml_kg_min && weightKg ? convertVO2ToAbsolute(lt2_vo2_ml_kg_min, weightKg) : null;
  let lt2_percent_vo2max: number | null = null;
  if (vo2max && lt2_vo2_ml_kg_min) {
    lt2_percent_vo2max = Math.round((lt2_vo2_ml_kg_min / vo2max) * 100 * 10) / 10;
  }
  const lt2_percent_hrmax = Math.round((lt2Point.heart_rate / hrmax) * 100 * 10) / 10;

  return {
    lt2_hr: lt2Point.heart_rate,
    lt2_power: lt2Point.power_watts || null,
    lt2_pace: lt2Point.speed_pace || null,
    lt2_vo2,
    lt2_percent_vo2max,
    lt2_percent_hrmax,
    lt2_confidence: confidence
  };
}

function calculateDmax(lactatePoints: TestDataPoint[]): TestDataPoint | null {
  if (lactatePoints.length < 4) return null;

  const sorted = [...lactatePoints].sort((a, b) => a.stage_number - b.stage_number);

  // Use HR as X-axis if available (physiologically meaningful), otherwise power, otherwise stage number
  // Cheng et al. 1992: perpendicular distance from the line connecting first and last point of the lactate curve
  const getX = (p: TestDataPoint): number => {
    if (p.heart_rate > 0) return p.heart_rate;
    if (p.power_watts && p.power_watts > 0) return p.power_watts;
    return p.stage_number;
  };

  let maxDistance = 0;
  let dmaxPoint: TestDataPoint | null = null;

  const firstPoint = sorted[0];
  const lastPoint = sorted[sorted.length - 1];
  const x1 = getX(firstPoint);
  const y1 = firstPoint.lactate || 0;
  const x2 = getX(lastPoint);
  const y2 = lastPoint.lactate || 0;

  for (let i = 1; i < sorted.length - 1; i++) {
    const point = sorted[i];
    const x0 = getX(point);
    const y0 = point.lactate || 0;

    const numerator = Math.abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1);
    const denominator = Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));

    if (denominator === 0) continue;
    const distance = numerator / denominator;

    if (distance > maxDistance) {
      maxDistance = distance;
      dmaxPoint = point;
    }
  }

  return dmaxPoint;
}

function findClosestPointByVO2(points: TestDataPoint[], targetVO2_ml_kg_min: number): TestDataPoint | null {
  const vo2Points = points.filter(p => p.vo2_ml_kg_min !== null && p.vo2_ml_kg_min !== undefined);

  if (vo2Points.length === 0) return null;

  return vo2Points.reduce((prev, curr) =>
    Math.abs(curr.vo2_ml_kg_min! - targetVO2_ml_kg_min) < Math.abs(prev.vo2_ml_kg_min! - targetVO2_ml_kg_min) ? curr : prev
  );
}

const FATMAX_OFFSET_STEPS = 0;

interface FatMaxResult {
  fatmax_hr: number | null;
  fatmax_power: number | null;
  fatmax_pace: string | null;
  fatmax_vo2: number | null;
  fatmax_confidence: ConfidenceLevel;
  fatmax_method: 'calorimetry' | 'lt1_proxy' | 'inferred';
}

function calculateFatMax(
  points: TestDataPoint[],
  _vo2max: number | null,
  hrmax: number,
  hasLactate: boolean,
  hasRER: boolean,
  lt1Hr: number | null,
  _lt1Confidence: ConfidenceLevel,
  weightKg: number | null
): FatMaxResult {
  const sorted = [...points].sort((a, b) => a.stage_number - b.stage_number);

  // Path 1: Real indirect calorimetry via Frayn equation when VCO2/RQ is available
  if (hasRER && sorted.some(p => p.vo2_ml_kg_min && p.vco2_ml_kg_min)) {
    let maxFatOxidation = -1;
    let fatMaxPoint: TestDataPoint | null = null;

    for (const point of sorted) {
      if (!point.vo2_ml_kg_min || !point.vco2_ml_kg_min) continue;
      const vo2_L_min = (point.vo2_ml_kg_min * (weightKg ?? 1)) / 1000;
      const vco2_L_min = (point.vco2_ml_kg_min * (weightKg ?? 1)) / 1000;
      const fatOxidation = 1.695 * vo2_L_min - 1.701 * vco2_L_min;
      if (fatOxidation > maxFatOxidation) {
        maxFatOxidation = fatOxidation;
        fatMaxPoint = point;
      }
    }

    if (fatMaxPoint && maxFatOxidation > 0) {
      return {
        fatmax_hr: fatMaxPoint.heart_rate,
        fatmax_power: fatMaxPoint.power_watts || null,
        fatmax_pace: fatMaxPoint.speed_pace || null,
        fatmax_vo2: fatMaxPoint.vo2_ml_kg_min || null,
        fatmax_confidence: 'measured',
        fatmax_method: 'calorimetry',
      };
    }
  }

  // Path 2: LT1-proxy — FatMax estimated from LT1 crossing, with optional step offset
  if (hasLactate && lt1Hr != null && sorted.length >= 3) {
    const lactatePoints = sorted.filter(p => p.lactate !== null && p.lactate !== undefined);
    if (lactatePoints.length >= 3) {
      const baseline = Math.min(...lactatePoints.map(p => p.lactate!));
      const lt1Threshold = baseline + 0.5;
      const crossingIndex = lactatePoints.findIndex(p => p.lactate! >= lt1Threshold);

      if (crossingIndex >= 0) {
        // The step AT or just before the LT1 crossing is the proxy FatMax
        const proxyIndex = Math.max(0, crossingIndex + FATMAX_OFFSET_STEPS);
        const fatMaxPoint = lactatePoints[proxyIndex] ?? lactatePoints[crossingIndex];

        const fatmax_vo2 = fatMaxPoint.vo2_ml_kg_min || null;

        return {
          fatmax_hr: fatMaxPoint.heart_rate,
          fatmax_power: fatMaxPoint.power_watts || null,
          fatmax_pace: fatMaxPoint.speed_pace || null,
          fatmax_vo2: fatmax_vo2,
          fatmax_confidence: 'estimated' as const,
          fatmax_method: 'lt1_proxy',
        };
      }
    }
  }

  // Path 3: Fallback — estimate from 60% HRmax (no lactate, no RER)
  if (sorted.length === 0) {
    return {
      fatmax_hr: null,
      fatmax_power: null,
      fatmax_pace: null,
      fatmax_vo2: null,
      fatmax_confidence: 'inferred',
      fatmax_method: 'inferred',
    };
  }
  const estimatedFatMaxHR = Math.round(hrmax * 0.60);
  const fatMaxPoint = sorted.reduce((prev, curr) =>
    Math.abs(curr.heart_rate - estimatedFatMaxHR) < Math.abs(prev.heart_rate - estimatedFatMaxHR)
      ? curr
      : prev
  );

  return {
    fatmax_hr: fatMaxPoint.heart_rate,
    fatmax_power: fatMaxPoint.power_watts || null,
    fatmax_pace: fatMaxPoint.speed_pace || null,
    fatmax_vo2: fatMaxPoint.vo2_ml_kg_min || null,
    fatmax_confidence: 'inferred',
    fatmax_method: 'inferred',
  };
}

function calculateVAMandPAM(
  points: TestDataPoint[],
  hasPower: boolean,
  sport: Sport
): { vam_kmh: number | null; pam_watts: number | null } {
  const pacePoints = points.filter(p => p.speed_pace && p.speed_pace.trim() !== '');
  const powerPoints = points.filter(p => p.power_watts && p.power_watts > 0);

  let vam_kmh: number | null = null;
  let pam_watts: number | null = null;

  if (sport === 'cycling' && pacePoints.length > 0) {
    let maxSpeed = 0;
    for (const p of pacePoints) {
      const speed = parseSpeedToKmh(p.speed_pace!, sport);
      if (speed !== null && speed > maxSpeed) {
        maxSpeed = speed;
      }
    }
    if (maxSpeed > 0) vam_kmh = Math.round(maxSpeed * 10) / 10;
  }

  if (sport === 'running' && pacePoints.length > 0) {
    let maxSpeed = 0;
    for (const p of pacePoints) {
      const speed = parseSpeedToKmh(p.speed_pace!, sport);
      if (speed !== null && speed > maxSpeed) {
        maxSpeed = speed;
      }
    }
    if (maxSpeed > 0) vam_kmh = Math.round(maxSpeed * 10) / 10;
  }

  if (sport === 'swimming' && pacePoints.length > 0) {
    let maxSpeed = 0;
    for (const p of pacePoints) {
      const speed = parseSpeedToKmh(p.speed_pace!, sport);
      if (speed !== null && speed > maxSpeed) {
        maxSpeed = speed;
      }
    }
    if (maxSpeed > 0) vam_kmh = Math.round(maxSpeed * 10) / 10;
  }

  if (hasPower && powerPoints.length > 0) {
    pam_watts = Math.max(...powerPoints.map(p => p.power_watts!));
  }

  return { vam_kmh, pam_watts };
}

export function parseSpeedToKmh(speedPace: string, sport: Sport): number | null {
  if (!speedPace || speedPace.trim() === '') return null;
  const trimmed = speedPace.trim();

  if (sport === 'cycling') {
    const num = parseFloat(trimmed.replace(',', '.'));
    if (!isNaN(num) && num > 0) return num;
    return null;
  }

  if (sport === 'running') {
    if (trimmed.includes(':')) {
      const parts = trimmed.replace(/[^0-9:]/g, '').split(':');
      if (parts.length >= 2) {
        const mins = parseInt(parts[0]);
        const secs = parseInt(parts[1]);
        if (!isNaN(mins) && !isNaN(secs) && (mins + secs / 60) > 0) {
          return 60 / (mins + secs / 60);
        }
      }
    }
    const num = parseFloat(trimmed.replace(',', '.'));
    if (!isNaN(num) && num > 0) return num;
    return null;
  }

  if (sport === 'swimming') {
    if (trimmed.includes(':')) {
      const parts = trimmed.replace(/[^0-9:]/g, '').split(':');
      if (parts.length >= 2) {
        const mins = parseInt(parts[0]);
        const secs = parseInt(parts[1]);
        const totalMins = mins + secs / 60;
        if (!isNaN(totalMins) && totalMins > 0) {
          return (0.1 / totalMins) * 60;
        }
      }
    }
    return null;
  }

  if (sport === 'triathlon') {
    const num = parseFloat(trimmed.replace(',', '.'));
    if (!isNaN(num) && num > 0) return num;
    return null;
  }

  return null;
}

function calculateHRDrift(points: TestDataPoint[]): number | null {
  if (points.length < 4) return null;

  const totalDuration = points.reduce((sum, p) => sum + p.duration_seconds, 0);

  if (totalDuration < 1200) return null;

  const midPoint = Math.floor(points.length / 2);
  const first10min = points.slice(0, Math.max(2, midPoint));
  const last10min = points.slice(-Math.max(2, points.length - midPoint));

  if (first10min.length === 0 || last10min.length === 0) return null;

  const avgFirst = first10min.reduce((sum, p) => sum + p.heart_rate, 0) / first10min.length;
  const avgLast = last10min.reduce((sum, p) => sum + p.heart_rate, 0) / last10min.length;

  const drift = ((avgLast - avgFirst) / avgFirst) * 100;

  return Math.abs(drift) > 0.5 ? Math.round(drift * 10) / 10 : null;
}


function assessDataQuality(
  points: TestDataPoint[],
  hasPower: boolean,
  hasLactate: boolean,
  hasVO2: boolean,
  hasRER: boolean
): { quality_text: string; quality_score: number } {
  let score = 0;

  if (points.length >= 6) score += 3;
  else if (points.length >= 4) score += 2;
  else if (points.length >= 2) score += 1;

  if (hasVO2) score += 4;
  if (hasLactate) score += 3;
  if (hasRER) score += 2;
  if (hasPower) score += 2;

  let quality_text = '';

  if (score >= 10) {
    quality_text = 'Excellent - Direct metabolic measurements with lactate';
  } else if (score >= 7) {
    quality_text = 'Good - Multiple direct measurements available';
  } else if (score >= 4) {
    quality_text = 'Fair - Key metrics present, some estimation required';
  } else {
    quality_text = 'Basic - Primarily HR-based estimates';
  }

  return { quality_text, quality_score: score };
}

function generateMetabolicProfile(
  vo2max: number | null,
  lt2_hr: number | null,
  fatmax_hr: number | null,
  hr_drift: number | null,
  hrmax: number,
  hasVO2: boolean
): {
  aerobic_capacity: string;
  fat_utilization: string;
  anaerobic_contribution: string;
  durability: string;
} {
  let aerobic_capacity = 'Moderate';
  if (vo2max && hasVO2) {
    if (vo2max >= 55) aerobic_capacity = 'High';
    else if (vo2max >= 45) aerobic_capacity = 'Moderate';
    else aerobic_capacity = 'Low';
  }

  let fat_utilization = 'Moderate';
  if (fatmax_hr) {
    const fatmax_percent = (fatmax_hr / hrmax) * 100;
    if (fatmax_percent >= 65) fat_utilization = 'High';
    else if (fatmax_percent >= 55) fat_utilization = 'Moderate';
    else fat_utilization = 'Low';
  }

  let anaerobic_contribution = 'Moderate';
  if (lt2_hr) {
    const lt2_percent = (lt2_hr / hrmax) * 100;
    if (lt2_percent >= 92) anaerobic_contribution = 'High';
    else if (lt2_percent >= 88) anaerobic_contribution = 'Moderate';
    else anaerobic_contribution = 'Low';
  }

  let durability = 'Moderate';
  if (hr_drift !== null) {
    if (Math.abs(hr_drift) < 5) durability = 'High';
    else if (Math.abs(hr_drift) < 8) durability = 'Moderate';
    else durability = 'Low';
  }

  return {
    aerobic_capacity,
    fat_utilization,
    anaerobic_contribution,
    durability
  };
}

function generateStageAnalysis(
  points: TestDataPoint[],
  vo2max: number | null,
  hrmax: number,
  hasVO2: boolean,
  weightKg: number | null
): StageAnalysis[] {
  return points.map(point => {
    const hr_percent_max = Math.round((point.heart_rate / hrmax) * 100 * 10) / 10;

    let vo2_percent_max: number | null = null;
    if (vo2max && point.vo2_ml_kg_min) {
      vo2_percent_max = Math.round((point.vo2_ml_kg_min / vo2max) * 100 * 10) / 10;
    }

    let energy_mix: EnergyMix | null = null;
    if (hasVO2 && point.vo2_ml_kg_min && weightKg) {
      const vo2_l_min = convertVO2ToAbsolute(point.vo2_ml_kg_min, weightKg);
      const estimatedRER = estimateRERFromVO2Percent(vo2_percent_max || 0);
      energy_mix = calculateEnergyMix(estimatedRER, vo2_l_min);
    }

    return {
      ...point,
      vo2_percent_max,
      hr_percent_max,
      energy_mix
    };
  });
}

function calculateEnergyMix(rer: number, vo2_L_min: number): EnergyMix {
  const clampedRER = Math.max(0.70, Math.min(1.0, rer));

  const fat_percent = Math.max(0, Math.min(100, ((1.0 - clampedRER) / (1.0 - 0.70)) * 100));
  const carb_percent = 100 - fat_percent;

  const fat_grams_per_min = (1.695 * vo2_L_min) - (1.701 * vo2_L_min * clampedRER);
  const carb_grams_per_min = (4.585 * vo2_L_min * clampedRER) - (3.226 * vo2_L_min);

  return {
    fat_percent: Math.round(fat_percent * 10) / 10,
    carb_percent: Math.round(carb_percent * 10) / 10,
    fat_grams_per_min: Math.max(0, Math.round(fat_grams_per_min * 100) / 100),
    carb_grams_per_min: Math.max(0, Math.round(carb_grams_per_min * 100) / 100)
  };
}

function estimateRERFromVO2Percent(vo2Percent: number): number {
  if (vo2Percent < 50) return 0.75;
  if (vo2Percent < 70) return 0.80 + (vo2Percent - 50) * 0.003;
  if (vo2Percent < 85) return 0.85 + (vo2Percent - 70) * 0.004;
  return 0.95 + (vo2Percent - 85) * 0.003;
}

export function calculateAdvancedMetrics(
  athlete: Athlete,
  dataPoints: TestDataPoint[],
  results: PhysiologyResults,
  manualOverrides?: Partial<AdvancedMetrics>
): AdvancedMetrics {
  const normalizedAthlete = normalizeAthlete(athlete);
  const sorted = normalizeDataPoints([...dataPoints]).sort((a, b) => a.stage_number - b.stage_number);
  const lbm = normalizedAthlete.lean_body_mass_kg || null;
  const weight = normalizedAthlete.weight_kg || null;
  const vo2max = results.vo2max;

  const rer_vs_stage = sorted.map(p => {
    if (!p.vo2_ml_kg_min || !vo2max) return null;
    const pct = (p.vo2_ml_kg_min / vo2max) * 100;
    return Math.round(estimateRERFromVO2Percent(pct) * 1000) / 1000;
  });

  const energy_mixes = sorted.map((p, i) => {
    const rer = rer_vs_stage[i];
    if (!rer || !p.vo2_ml_kg_min || !weight) return null;
    const vo2_l = convertVO2ToAbsolute(p.vo2_ml_kg_min, weight);
    return calculateEnergyMix(rer, vo2_l);
  });

  const percent_fat_vs_stage = energy_mixes.map(m => m ? Math.round(m.fat_percent) : null);
  const percent_carb_vs_stage = energy_mixes.map(m => m ? Math.round(m.carb_percent) : null);

  let watts_per_kg_lbm: number | null = null;
  let efficiency_percent: number | null = null;
  if (athlete.sport === 'cycling' && lbm && sorted.length > 0) {
    const maxPowerPoint = sorted.reduce((best, p) =>
      (p.power_watts || 0) > (best.power_watts || 0) ? p : best, sorted[0]);    if (maxPowerPoint?.power_watts) {
      watts_per_kg_lbm = Math.round((maxPowerPoint.power_watts / lbm) * 100) / 100;
      if (maxPowerPoint.vo2_ml_kg_min && weight) {
        const vo2_l_min = convertVO2ToAbsolute(maxPowerPoint.vo2_ml_kg_min, weight);
        const energy_rate_watts = vo2_l_min * 20.9 * 1000 / 60;
        efficiency_percent = Math.round((maxPowerPoint.power_watts / energy_rate_watts) * 100 * 10) / 10;
      }
    }
  }

  let cost_per_km_ml_o2_kg: number | null = null;
  if (athlete.sport === 'running') {
    const subMaxPoints = sorted.filter(p => {
      if (!p.vo2_ml_kg_min || !vo2max) return false;
      return (p.vo2_ml_kg_min / vo2max) * 100 < 85 && p.speed_pace;
    });
    if (subMaxPoints.length > 0) {
      const costs = subMaxPoints
        .map(p => {
          if (!p.speed_pace || !p.vo2_ml_kg_min) return null;
          const speed = parseSpeedToKmh(p.speed_pace, 'running');
          if (!speed || speed <= 0) return null;
          return (p.vo2_ml_kg_min / speed) * 1000;
        })
        .filter((c): c is number => c !== null);
      if (costs.length > 0) {
        cost_per_km_ml_o2_kg = Math.round(costs.reduce((a, b) => a + b, 0) / costs.length);
      }
    }
  }

  const recovery = manualOverrides?.recovery ?? {
    hrv_post_exercise_ms: null,
    time_to_hr_baseline_min: null,
    lactate_clearance: { min5: null, min10: null, min20: null },
    hr_drift_percent: results.hr_drift_percent
  };

  const anaerobicTest = manualOverrides?.anaerobicTest ?? {
    peak_power_watts: null,
    mean_power_watts: null,
    fatigue_index_percent: null,
    test_duration_seconds: null
  };

  return {
    recovery,
    movementEconomy: {
      cycling: { watts_per_kg_lbm, efficiency_percent },
      running: { cost_per_km_ml_o2_kg }
    },
    energyProfile: {
      rer_vs_stage,
      percent_fat_vs_stage,
      percent_carb_vs_stage
    },
    anaerobicTest
  };
}
