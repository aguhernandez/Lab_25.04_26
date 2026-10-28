import { describe, expect, it } from 'vitest';
import type { Sport, TestDataPoint } from '../types';
import { calculateMovementEconomy } from './movementEconomy';

function stage(
  stageNumber: number,
  overrides: Partial<TestDataPoint> = {},
): TestDataPoint {
  return {
    id: `stage-${stageNumber}`,
    test_id: 'test-1',
    stage_number: stageNumber,
    duration_seconds: 180,
    heart_rate: 140,
    power_watts: null,
    speed_pace: null,
    vo2_ml_kg_min: null,
    vco2_ml_kg_min: null,
    lactate: null,
    rpe: null,
    vt1_marker: false,
    vt2_marker: false,
    created_at: '',
    ...overrides,
  };
}

function calculate(points: TestDataPoint[], sport: Sport, bodyMass = 70, leanMass = 56, vo2max = 60) {
  return calculateMovementEconomy(points, sport, bodyMass, leanMass, vo2max);
}

describe('sport-specific movement economy', () => {
  it('converts running oxygen uptake to ml/kg/km using km/h stages', () => {
    const result = calculate([
      stage(1, { speed_pace: '12 km/h', vo2_ml_kg_min: 40 }),
      stage(2, { speed_pace: '6:00/km', vo2_ml_kg_min: 34 }),
      stage(3, { speed_pace: '5:00/km', vo2_ml_kg_min: 60 }),
    ], 'running');

    expect(result.running.cost_per_km_ml_o2_kg).toBe(202);
    expect(result.running.valid_stage_count).toBe(2);
  });

  it('calculates cycling VO2 per 100 W and gross efficiency from measured RER', () => {
    const result = calculate([
      stage(1, { power_watts: 200, vo2_ml_kg_min: 40, vco2_ml_kg_min: 36 }),
      stage(2, { power_watts: 240, vo2_ml_kg_min: 48, vco2_ml_kg_min: 43.2 }),
      stage(3, { power_watts: 400, vo2_ml_kg_min: 60, vco2_ml_kg_min: 66 }),
    ], 'cycling');

    expect(result.cycling.vo2_ml_kg_min_per_100w).toBe(20);
    expect(result.cycling.efficiency_basis).toBe('measured_rer');
    expect(result.cycling.efficiency_percent).toBeGreaterThan(20);
    expect(result.cycling.efficiency_percent).toBeLessThan(22);
    expect(result.cycling.valid_stage_count).toBe(2);

    const oxygenOnlyEstimate = calculate([
      stage(1, { power_watts: 200, vo2_ml_kg_min: 40 }),
      stage(2, { power_watts: 240, vo2_ml_kg_min: 48 }),
    ], 'cycling');
    expect(oxygenOnlyEstimate.cycling.efficiency_basis).toBe('oxygen_only_estimate');
  });

  it('calculates swimming oxygen cost per 100 m from pace per 100 m', () => {
    const result = calculate([
      stage(1, { speed_pace: '1:40/100m', vo2_ml_kg_min: 30 }),
      stage(2, { speed_pace: '1:30/100m', vo2_ml_kg_min: 32 }),
      stage(3, { speed_pace: '1:15/100m', vo2_ml_kg_min: 50 }),
    ], 'swimming', 70, 56, 50);

    expect(result.swimming?.cost_per_100m_ml_o2_kg).toBe(49);
    expect(result.swimming?.valid_stage_count).toBe(2);

    const triathlonSwim = calculate([
      stage(1, { speed_pace: '1:40/100m', vo2_ml_kg_min: 30 }),
      stage(2, { speed_pace: '1:30/100m', vo2_ml_kg_min: 32 }),
    ], 'triathlon', 70, 56, 50);
    expect(triathlonSwim.swimming?.cost_per_100m_ml_o2_kg).toBe(49);
  });

  it('excludes short stages and stages above 85% of measured VO2peak', () => {
    const result = calculate([
      stage(1, { duration_seconds: 90, speed_pace: '6:00/km', vo2_ml_kg_min: 30 }),
      stage(2, { duration_seconds: 180, speed_pace: '4:30/km', vo2_ml_kg_min: 55 }),
    ], 'running');

    expect(result.running.cost_per_km_ml_o2_kg).toBeNull();
    expect(result.running.valid_stage_count).toBe(0);
  });

  it('does not apply cycling, running or swimming cost formulas to an unspecified sport', () => {
    const result = calculate([
      stage(1, { power_watts: 150, vo2_ml_kg_min: 30 }),
      stage(2, { power_watts: 200, vo2_ml_kg_min: 40 }),
    ], 'other');

    expect(result.cycling.efficiency_percent).toBeNull();
    expect(result.running.cost_per_km_ml_o2_kg).toBeNull();
    expect(result.swimming?.cost_per_100m_ml_o2_kg).toBeNull();
  });
});
