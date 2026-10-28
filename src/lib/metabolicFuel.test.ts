import { expect, it } from 'vitest';
import { fuelFromGasExchange, estimatedRerFromVo2Percent } from './metabolicFuel';
import { analyzeLactate } from './lactateAnalysis';
import { calculatePhysiology, calculateAdvancedMetrics } from './physiology';
import type { Athlete, TestDataPoint } from '../types';

const athlete = { id: 'fuel', sport: 'cycling', weight_kg: 70, date_of_birth: '1990-01-01' } as Athlete;
const points = [1, 2, 3, 4].map((stage): TestDataPoint => ({
  id: String(stage), test_id: 'fuel', stage_number: stage, duration_seconds: 180,
  heart_rate: 105 + stage * 15, power_watts: 100 + stage * 40,
  speed_pace: null, vo2_ml_kg_min: 20 + stage * 5,
  vco2_ml_kg_min: (20 + stage * 5) * 0.8, lactate: [1, 1.5, 2.5, 5][stage - 1],
  rpe: null, vt1_marker: false, vt2_marker: false, created_at: '2026-10-28',
}));

it('uses the same measured gas equations for lactate, stages and charts/PDF data', () => {
  const physiology = calculatePhysiology(athlete, points);
  const analysis = analyzeLactate(points, 70);
  const chart = calculateAdvancedMetrics(athlete, points, physiology).energyProfile;
  expect(physiology.stage_analysis[0].energy_mix?.fat_percent).toBe(analysis.fuelProfile[0].fatPercent);
  expect(physiology.stage_analysis[0].energy_mix?.carb_grams_per_min).toBeCloseTo(analysis.fuelProfile[0].carbohydrateGramsPerMin, 2);
  expect(chart.percent_fat_vs_stage[0]).toBe(Math.round(analysis.fuelProfile[0].fatPercent));
  expect(chart.rer_source_vs_stage?.[0]).toBe('measured_vco2');
});

it('marks VO2-only substrate as estimated in results and chart data', () => {
  const noVco2 = points.map(p => ({ ...p, vco2_ml_kg_min: null }));
  const physiology = calculatePhysiology(athlete, noVco2);
  const chart = calculateAdvancedMetrics(athlete, noVco2, physiology).energyProfile;
  expect(physiology.stage_analysis[0].energy_mix?.source).toBe('estimated_rer');
  expect(chart.rer_source_vs_stage?.[0]).toBe('estimated_rer');
});

it('excludes invalid measured RER instead of replacing it with an estimate', () => {
  const invalid = points.map((p, i) => i ? p : { ...p, vco2_ml_kg_min: 40 });
  const physiology = calculatePhysiology(athlete, invalid);
  expect(physiology.stage_analysis[0].energy_mix).toBeNull();
  expect(calculateAdvancedMetrics(athlete, invalid, physiology).energyProfile.rer_vs_stage[0]).toBeNull();
});

it('uses caloric shares consistently with gram rates', () => {
  const fuel = fuelFromGasExchange(2, 1.6)!;
  const expected = 100 * fuel.fatGramsPerMin * 9 / (fuel.fatGramsPerMin * 9 + fuel.carbohydrateGramsPerMin * 4);
  expect(fuel.fatPercent).toBeCloseTo(expected);
  expect(fuel.fatPercent + fuel.carbohydratePercent).toBeCloseTo(100);
});

it('rejects invalid gas inputs and bounds the estimated scenario RER', () => {
  expect(fuelFromGasExchange(2, 2.2)).toBeNull();
  expect(fuelFromGasExchange(Infinity, 1)).toBeNull();
  expect(estimatedRerFromVo2Percent(120)).toBe(1);
  expect(estimatedRerFromVo2Percent(-1)).toBeNull();
});
