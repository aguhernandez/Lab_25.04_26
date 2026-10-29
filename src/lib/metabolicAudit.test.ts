import { expect, it } from 'vitest';
import type { Athlete, TestDataPoint } from '../types';
import { calculatePhysiology } from './physiology';
import { analyzeLactate, parseSpeedKmh } from './lactateAnalysis';
import { paceToKmh } from './trainingZones';

const points = ['3:00', '2:00', '1:30', '1:12'].map((pace, i) => ({
  id: String(i), test_id: 'audit', stage_number: i + 1, duration_seconds: 180,
  speed_pace: pace, power_watts: null, lactate: [1, 2, 3, 5][i], heart_rate: 110 + i * 15,
  vo2_ml_kg_min: null, vco2_ml_kg_min: null, vt1_marker: false, vt2_marker: false,
} as TestDataPoint));
it('keeps swimming speed identical in the lactate, objective and zone conversion paths', () => {
  expect(parseSpeedKmh('1:30', 'swimming')).toBe(4);
  expect(parseSpeedKmh('1:30/km', 'swimming')).toBe(40);
  const analysis = analyzeLactate(points, 70, { lt1Method: 'fixed_2mmol', lt2Method: 'obla_4mmol' }, 'swimming');
  expect(analysis.lt2?.speedKmh).toBe(4.5);
  const result = calculatePhysiology({ id: 'audit', sport: 'swimming', weight_kg: 70, date_of_birth: '1990-01-01' } as Athlete, points, { lactate_lt1_method: 'fixed_2mmol', lactate_lt2_method: 'obla_4mmol' });
  expect(result.lt2_pace).toBe('1:20');
  expect(paceToKmh(result.lt2_pace!, 'swimming')).toBe(4.5);
});
it('uses speed as the running lactate-curve load even when running power is also recorded', () => {
  const running = points.map((p, i) => ({ ...p, speed_pace: `${10 + i * 2} km/h`, power_watts: [100, 150, 155, 280][i] }));
  const analysis = analyzeLactate(running, 70, { lt2Method: 'obla_4mmol' }, 'running');
  expect(analysis.lt2?.loadType).toBe('speed');
  expect(analysis.lt2?.speedKmh).toBe(15);
  const result = calculatePhysiology({ id: 'audit', sport: 'running', weight_kg: 70, date_of_birth: '1990-01-01' } as Athlete, running, { lactate_lt2_method: 'obla_4mmol' });
  expect(result.lt2_pace).toBe('4:00');
});
