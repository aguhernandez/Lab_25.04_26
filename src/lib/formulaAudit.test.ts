import { expect, it } from 'vitest';
import { analyzeLactate, parseSpeedKmh } from './lactateAnalysis';
import type { TestDataPoint } from '../types';

const stages = (lactates = [1, 2, 3, 5]): TestDataPoint[] => lactates.map((lactate, index) => ({
  id: String(index), test_id: 'audit', stage_number: index + 1, duration_seconds: 180,
  heart_rate: 110 + index * 10, power_watts: 100 + index * 50, speed_pace: null,
  vo2_ml_kg_min: 30, vco2_ml_kg_min: 24, lactate, rpe: null,
  vt1_marker: false, vt2_marker: false, created_at: '2026-10-28',
}));

it('converts swimming and fractional running paces to km/h', () => {
  expect(parseSpeedKmh('1:30/100 m')).toBe(4);
  expect(parseSpeedKmh('5:00.5/km')).toBeCloseTo(60 / (5 + 0.5 / 60));
  expect(parseSpeedKmh('12,5 km/h')).toBe(12.5);
});
it('rejects malformed pace instead of silently reading its first number', () => {
  for (const text of ['5:99/km', '1:30/50m', '-5', 'abc12']) expect(parseSpeedKmh(text)).toBeNull();
});
it('does not manufacture fixed thresholds below the sampled range', () => {
  const result = analyzeLactate(stages([5, 6, 7, 9]), 70, { lt1Method: 'fixed_2mmol', lt2Method: 'obla_4mmol' });
  expect(result.quality.validForThresholds).toBe(true);
  expect(result.lt1).toBeNull();
  expect(result.lt2).toBeNull();
  expect(analyzeLactate(stages([2, 3, 4, 5]), 70, { lt1Method: 'fixed_2mmol' }).lt1?.load).toBe(100);
});
it('excludes invalid substrate RER while retaining usable gas measurements', () => {
  const points = stages().map((point, index) => ({ ...point, vco2_ml_kg_min: [19.5, 24, 30, 33][index] }));
  expect(analyzeLactate(points, 70).fuelProfile.map(row => row.stage)).toEqual([2, 3]);
});
it('excludes nonfinite gas exchange and body mass from substrate estimates', () => {
  expect(analyzeLactate(stages(), Infinity).fuelProfile).toEqual([]);
  expect(analyzeLactate(stages().map(point => ({ ...point, vo2_ml_kg_min: Infinity, vco2_ml_kg_min: Infinity })), 70).fuelProfile).toEqual([]);
});
