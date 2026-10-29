import type { Athlete, Test, TestDataPoint, ThresholdOverrides } from '../types';

/** Bump whenever a physiology formula or its interpretation changes. */
export const PHYSIOLOGY_ALGORITHM_ID = 'asciende-physiology-core';
export const PHYSIOLOGY_ALGORITHM_VERSION = '1.2.0';

export interface PairedObservation {
  subjectId: string;
  candidate: number;
  reference: number;
}

export interface BlandAltmanSummary {
  n: number;
  bias: number;
  biasCi95: [number, number];
  standardDeviationOfDifferences: number;
  lowerLimit: number;
  upperLimit: number;
  lowerLimitCi95: [number, number];
  upperLimitCi95: [number, number];
  differences: Array<{ subjectId: string; mean: number; difference: number }>;
  caveat: string;
}

export interface TestRetestSummary {
  n: number;
  meanDifference: number;
  standardDeviationOfDifferences: number;
  typicalError: number;
  minimalDetectableChange95: number;
  coefficientOfVariationPercent: number | null;
}

const T_975 = [
  0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262,
  2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093,
  2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045,
  2.042,
];

function t975(degreesOfFreedom: number): number {
  if (degreesOfFreedom <= 0) return Number.NaN;
  if (degreesOfFreedom < T_975.length) return T_975[degreesOfFreedom];
  // Cornish–Fisher expansion, accurate above 30 df.
  const z = 1.959963984540054, d = degreesOfFreedom;
  return z + (z ** 3 + z) / (4 * d) + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * d ** 2) + (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / (384 * d ** 3);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values: number[], center = mean(values)): number {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}

/**
 * Agreement analysis for one paired candidate/reference value per participant.
 * Acceptability limits must be set by the study team before looking at results.
 */
export function calculateBlandAltman(observations: PairedObservation[]): BlandAltmanSummary | null {
  if (observations.some(r => !r.subjectId.trim()) || new Set(observations.map(r => r.subjectId.trim())).size !== observations.length) return null;
  if (observations.some(row => !Number.isFinite(row.candidate) || !Number.isFinite(row.reference))) return null;
  const valid = observations;
  if (valid.length < 2) return null;

  const differences = valid.map(row => row.candidate - row.reference);
  const averages = valid.map(row => (row.candidate + row.reference) / 2);
  const bias = mean(differences);
  const sd = sampleSd(differences, bias);
  const t = t975(valid.length - 1);
  const lowerLimit = bias - 1.96 * sd;
  const upperLimit = bias + 1.96 * sd;
  const biasHalfWidth = t * sd / Math.sqrt(valid.length);
  const limitHalfWidth = t * sd * Math.sqrt(1 / valid.length + (1.96 ** 2) / (2 * (valid.length - 1)));

  return {
    n: valid.length,
    bias,
    biasCi95: [bias - biasHalfWidth, bias + biasHalfWidth],
    standardDeviationOfDifferences: sd,
    lowerLimit,
    upperLimit,
    lowerLimitCi95: [lowerLimit - limitHalfWidth, lowerLimit + limitHalfWidth],
    upperLimitCi95: [upperLimit - limitHalfWidth, upperLimit + limitHalfWidth],
    differences: valid.map((row, index) => ({ subjectId: row.subjectId, mean: averages[index], difference: differences[index] })),
    caveat: 'Approximate 95% intervals assume independent paired participants and approximately normal differences. Define acceptable limits a priori; this analysis alone does not establish validity.',
  };
}

/** Summarizes within-athlete test–retest error from one pair per athlete. */
export function calculateTestRetest(observations: PairedObservation[]): TestRetestSummary | null {
  if (observations.some(r => !r.subjectId.trim()) || new Set(observations.map(r => r.subjectId.trim())).size !== observations.length) return null;
  if (observations.some(row => !Number.isFinite(row.candidate) || !Number.isFinite(row.reference))) return null;
  const valid = observations;
  if (valid.length < 2) return null;

  const differences = valid.map(row => row.candidate - row.reference);
  const sd = sampleSd(differences);
  const typicalError = sd / Math.sqrt(2);
  const grandMean = mean(valid.flatMap(row => [row.candidate, row.reference]));
  return {
    n: valid.length,
    meanDifference: mean(differences),
    standardDeviationOfDifferences: sd,
    typicalError,
    minimalDetectableChange95: 1.96 * Math.sqrt(2) * typicalError,
    coefficientOfVariationPercent: grandMean === 0 ? null : (typicalError / Math.abs(grandMean)) * 100,
  };
}

export type SensitivitySummary = {
  baseline: number;
  lowerScenario: number;
  upperScenario: number;
  minimum: number;
  maximum: number;
};

/** Reports a user-specified input-error scenario; this is not a confidence interval. */
export function summarizeInputSensitivity(baseline: number, lowerScenario: number, upperScenario: number): SensitivitySummary {
  return {
    baseline,
    lowerScenario,
    upperScenario,
    minimum: Math.min(baseline, lowerScenario, upperScenario),
    maximum: Math.max(baseline, lowerScenario, upperScenario),
  };
}

export interface ModelResultProvenance {
  schemaVersion: 1;
  algorithm: { id: string; version: string };
  status: 'reproducible_input_snapshot';
  capturedAt: string;
  validationStatus: 'not_externally_validated';
  inputs: {
    test: Pick<Test, 'test_date' | 'sport' | 'test_type' | 'protocol_id' | 'protocol_version' | 'protocol_metadata'> & {
      threshold_overrides: ThresholdOverrides | null;
    };
    athlete: {
      weight_kg: number | null;
      height_cm: number | null;
      sex: string | null;
      age_years: number | null;
      body_fat_percent: number | null;
      lean_body_mass_kg: number | null;
      anthropometry_source: string | null;
      body_composition_method: string | null;
    };
    stages: Array<Pick<TestDataPoint,
      'stage_number' | 'duration_seconds' | 'heart_rate' | 'power_watts' | 'speed_pace' |
      'vo2_ml_kg_min' | 'vco2_ml_kg_min' | 'lactate' | 'rpe' | 'vt1_marker' | 'vt2_marker'>>;
  };
}

function ageAtTest(dateOfBirth: string | undefined, testDate: string): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const test = new Date(testDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(test.getTime())) return null;
  const birthdayNotReached = test.getMonth() < birth.getMonth()
    || (test.getMonth() === birth.getMonth() && test.getDate() < birth.getDate());
  return test.getFullYear() - birth.getFullYear() - Number(birthdayNotReached);
}

/** Keeps the exact non-identifying inputs needed to replay a calculated result. */
export function createModelResultProvenance(
  test: Test,
  athlete: Athlete,
  dataPoints: TestDataPoint[],
  capturedAt = new Date().toISOString(),
): ModelResultProvenance {
  const anthropometry = test.anthropometry_snapshot;
  return {
    schemaVersion: 1,
    algorithm: { id: PHYSIOLOGY_ALGORITHM_ID, version: PHYSIOLOGY_ALGORITHM_VERSION },
    status: 'reproducible_input_snapshot',
    capturedAt,
    validationStatus: 'not_externally_validated',
    inputs: {
      test: {
        test_date: test.test_date,
        sport: test.sport,
        test_type: test.test_type,
        protocol_id: test.protocol_id ?? null,
        protocol_version: test.protocol_version ?? null,
        protocol_metadata: test.protocol_metadata ?? null,
        threshold_overrides: anthropometry?.threshold_overrides ?? null,
      },
      athlete: {
        weight_kg: anthropometry?.weight_kg ?? athlete.weight_kg ?? null,
        height_cm: anthropometry?.height_cm ?? athlete.height_cm ?? null,
        sex: anthropometry?.sex ?? athlete.sex ?? null,
        age_years: anthropometry?.age ?? ageAtTest(athlete.date_of_birth, test.test_date),
        body_fat_percent: anthropometry?.bodyFatPercent ?? athlete.body_fat_percent ?? null,
        lean_body_mass_kg: anthropometry?.leanBodyMassKg ?? athlete.lean_body_mass_kg ?? null,
        anthropometry_source: anthropometry?.source ?? test.anthropometry_source ?? null,
        body_composition_method: anthropometry?.bodyCompositionMethod ?? null,
      },
      stages: dataPoints.map(({ stage_number, duration_seconds, heart_rate, power_watts, speed_pace, vo2_ml_kg_min, vco2_ml_kg_min, lactate, rpe, vt1_marker, vt2_marker }) => ({
        stage_number, duration_seconds, heart_rate, power_watts: power_watts ?? null,
        speed_pace: speed_pace ?? null, vo2_ml_kg_min: vo2_ml_kg_min ?? null,
        vco2_ml_kg_min: vco2_ml_kg_min ?? null, lactate: lactate ?? null, rpe: rpe ?? null,
        vt1_marker, vt2_marker,
      })),
    },
  };
}
