import { expect, it } from 'vitest';
import { calculateObjectiveZone, type ObjectiveTemplate } from './objectiveZones';
import type { TestDataPoint } from '../types';

const points = [1, 2, 3, 4].map(i => ({ stage_number: i, power_watts: i * 100, vo2_ml_kg_min: i * 10, lactate: i, speed_pace: `${i * 4} km/h` } as TestDataPoint));
const target: ObjectiveTemplate = { name: '90%', kind: 'vo2_percent', minimum: 90, maximum: 90, durationSeconds: 180 };
it('interpolates measured VO2 at 90% for a three minute prescription', () => {
  const result = calculateObjectiveZone(points, 'cycling', 40, true, target);
  expect(result).toMatchObject({ unit: 'W', minLoad: 360, maxLoad: 360 });
});
it('calculates a lactate target range without VO2', () => {
  const result = calculateObjectiveZone(points, 'cycling', null, false, { ...target, kind: 'lactate', minimum: 1.5, maximum: 2.5 });
  expect(result).toMatchObject({ minLoad: 150, maxLoad: 250 });
});
it('requires measured VO2max and does not extrapolate', () => {
  expect(calculateObjectiveZone(points, 'cycling', 40, false, target)).toEqual({ error: 'measured_vo2_required' });
  expect(calculateObjectiveZone(points, 'cycling', 40, true, { ...target, maximum: 120 })).toEqual({ error: 'outside_observed_range' });
});
it('refuses ambiguous nonmonotonic curves and insufficient data', () => {
  const bad = points.map((p, i) => i === 2 ? { ...p, lactate: 1 } : p);
  expect(calculateObjectiveZone(bad, 'cycling', null, false, { ...target, kind: 'lactate', minimum: 1, maximum: 2 })).toEqual({ error: 'ambiguous_curve' });
  expect(calculateObjectiveZone(points.slice(0, 1), 'cycling', 40, true, target)).toEqual({ error: 'insufficient_stages' });
});
it('converts swimming pace with 100m units to speed', () => {
  const swim = [{ ...points[0], speed_pace: '2:00/100m' }, { ...points[1], speed_pace: '1:30/100m' }];
  const result = calculateObjectiveZone(swim, 'swimming', 20, true, { ...target, minimum: 75, maximum: 75 });
  expect(result).toMatchObject({ unit: 'km/h', minLoad: 3.5 });
});
