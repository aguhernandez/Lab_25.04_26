import { describe, expect, it } from 'vitest';
import type { TestDataPoint } from '../types';
import { analyzeLactate, assessLactateQuality, isotonicSmooth, normalizeLongitudinalLactate, parseSpeedKmh } from './lactateAnalysis';

function point(stage: number, lactate: number, power = stage * 50 + 50, vo2?: number, vco2?: number): TestDataPoint {
  return {
    id: `p${stage}`, test_id: 'test', stage_number: stage, duration_seconds: 180,
    heart_rate: 100 + stage * 10, power_watts: power, speed_pace: null,
    vo2_ml_kg_min: vo2 ?? null, vco2_ml_kg_min: vco2 ?? null,
    lactate, rpe: stage, vt1_marker: false, vt2_marker: false,
    created_at: '2026-01-01T00:00:00Z',
  };
}

const validCurve = [
  point(1, 1.0, 100), point(2, 1.2, 150), point(3, 1.6, 200),
  point(4, 2.4, 250), point(5, 4.2, 300), point(6, 7.5, 350),
];

describe('lactate data validation', () => {
  it('accepts a complete monotonic protocol', () => {
    const quality = assessLactateQuality(validCurve);
    expect(quality.validForThresholds).toBe(true);
    expect(quality.sampleCount).toBe(6);
    expect(quality.monotonicityPercent).toBe(100);
  });

  it('rejects insufficient samples, repeated loads and implausible values', () => {
    const quality = assessLactateQuality([point(1, 1, 100), point(2, 30, 100), point(3, 2, 150)]);
    expect(quality.validForThresholds).toBe(false);
    expect(quality.issues.map(issue => issue.code)).toEqual(expect.arrayContaining(['too_few_samples', 'lactate_out_of_range', 'duplicate_load']));
  });
});

describe('threshold selection', () => {
  it('interpolates baseline + 0.5 for LT1', () => {
    const result = analyzeLactate(validCurve, 70, { lt1Method: 'baseline_plus_0_5' });
    expect(result.lt1?.lactate).toBeCloseTo(1.5);
    expect(result.lt1?.load).toBeGreaterThan(150);
    expect(result.lt1?.load).toBeLessThan(200);
  });

  it('supports OBLA and IAT as explicit LT2 methods', () => {
    const obla = analyzeLactate(validCurve, 70, { lt2Method: 'obla_4mmol' });
    expect(obla.lt2?.lactate).toBe(4);
    expect(obla.lt2?.method).toBe('obla_4mmol');
    const iat = analyzeLactate(validCurve, 70, { lt2Method: 'iat', iatDeltaMmol: 2 });
    expect(iat.lt2?.lactate).toBe(3);
    expect(iat.lt2?.method).toBe('iat');
  });

  it('returns no thresholds when quality is invalid', () => {
    const result = analyzeLactate(validCurve.slice(0, 3));
    expect(result.lt1).toBeNull();
    expect(result.lt2).toBeNull();
  });
});

describe('curve and metabolic profile', () => {
  it('smooths reversals while preserving raw measurements', () => {
    expect(isotonicSmooth([1, 2, 1.5, 4])).toEqual([1, 1.75, 1.75, 4]);
    const result = analyzeLactate([point(1, 1), point(2, 2), point(3, 1.5), point(4, 4)]);
    expect(result.curve.map(item => item.measured)).toEqual([1, 2, 1.5, 4]);
    expect(result.curve.map(item => item.smoothed)).toEqual([1, 1.75, 1.75, 4]);
  });

  it('uses measured VO2 and VCO2 for fuel oxidation', () => {
    const points = validCurve.map((item, index) => ({ ...item, vo2_ml_kg_min: 30 + index, vco2_ml_kg_min: 24 + index }));
    const result = analyzeLactate(points, 70);
    expect(result.fuelProfile).toHaveLength(6);
    expect(result.maxFatOxidation?.source).toBe('measured_vco2');
    expect(result.maxFatOxidation?.fatGramsPerMin).toBeGreaterThanOrEqual(0);
  });
});

describe('normalization', () => {
  it('parses pace and normalizes cycling loads by body mass', () => {
    expect(parseSpeedKmh('5:00/km')).toBe(12);
    const sessions = normalizeLongitudinalLactate([{ id: 'a', date: '2026-01-01', points: validCurve, weightKg: 50 }]);
    expect(sessions[0].basis).toBe('W/kg');
    expect(sessions[0].points[0].load).toBe(2);
  });
});
