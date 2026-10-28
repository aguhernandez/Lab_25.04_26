import { expect, it } from 'vitest';
import { classifyDifference, measuredAtLoad } from './longitudinalComparison';
import type { TestDataPoint } from '../types';
const points = [{ power_watts: 100, lactate: 1, heart_rate: 120 }, { power_watts: 200, lactate: 3, heart_rate: 160 }] as TestDataPoint[];
it('interpolates measured lactate at an equal load', () => expect(measuredAtLoad(points, 'cycling', 'W', 150, 'lactate')).toBe(2));
it('never extrapolates beyond measured loads', () => expect(measuredAtLoad(points, 'cycling', 'W', 220, 'lactate')).toBeNull());
it('refuses duplicate loads and absent measurements', () => {
  expect(measuredAtLoad([...points, points[0]], 'cycling', 'W', 150, 'lactate')).toBeNull();
  expect(measuredAtLoad(points, 'cycling', 'W', 150, 'vo2_ml_kg_min')).toBeNull();
});
it('leaves the interpretation unknown without a verified threshold', () => expect(classifyDifference(5, null)).toBe('unknown'));
it('distinguishes exceeding the entered error threshold without asserting improvement', () => {
  expect(classifyDifference(2, 3)).toBe('within'); expect(classifyDifference(-4, 3)).toBe('exceeds');
});
