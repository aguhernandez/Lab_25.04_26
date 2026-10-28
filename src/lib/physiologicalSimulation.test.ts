import { describe, expect, it } from 'vitest';
import { buildPhysiologicalScenario, findLactateBalanceLoad } from './physiologicalSimulation';
import type { LactateDynamicsInput } from './lactateDynamics';

const base: LactateDynamicsInput = {
  vlamaxMmolLSecond: 0.45,
  vo2maxMlKgMin: 60,
  bodyMassKg: 70,
  distributionVolumeLPerKg: 0.5,
  baselineLactateMmol: 1,
  maxLoad: 300,
  lt1Load: 150,
  lt2Load: 240,
  lt2LactateMmol: 4,
  loadUnit: 'W',
};

describe('physiological scenario model', () => {
  it('reproduces the baseline when no scenario changes are applied', () => {
    const result = buildPhysiologicalScenario(base, {
      bodyMassKg: 70,
      absoluteVo2maxLMin: 4.2,
      vlamaxMmolLSecond: 0.45,
    });
    expect(result?.scenarioRelativeVo2maxMlKgMin).toBe(60);
    expect(result?.scenarioModel.parameters.maxProductionMmolLMin).toBe(result?.baselineModel.parameters.maxProductionMmolLMin);
    expect(result?.scenarioModel.parameters.maxOxidationMmolLMin).toBe(result?.baselineModel.parameters.maxOxidationMmolLMin);
  });

  it('shows relative VO2 rising when body mass falls and absolute VO2 is held constant', () => {
    const result = buildPhysiologicalScenario(base, {
      bodyMassKg: 65,
      absoluteVo2maxLMin: 4.2,
      vlamaxMmolLSecond: 0.45,
    });
    expect(result?.scenarioRelativeVo2maxMlKgMin).toBe(64.6);
    expect(result?.scenarioDistributionVolumeLitres).toBe(32.5);
  });

  it('scales modeled oxidation capacity with an absolute VO2max change', () => {
    const result = buildPhysiologicalScenario(base, {
      bodyMassKg: 70,
      absoluteVo2maxLMin: 4.41,
      vlamaxMmolLSecond: 0.45,
    });
    expect(result?.scenarioModel.parameters.maxOxidationMmolLMin).toBeCloseTo(result!.baselineModel.parameters.maxOxidationMmolLMin * 1.05, 2);
  });

  it('scales glycolytic production with the target VLamax while preserving the baseline exponent', () => {
    const result = buildPhysiologicalScenario(base, {
      bodyMassKg: 70,
      absoluteVo2maxLMin: 4.2,
      vlamaxMmolLSecond: 0.5,
    });
    expect(result?.scenarioModel.parameters.maxProductionMmolLMin).toBeCloseTo(result!.baselineModel.parameters.maxProductionMmolLMin * (0.5 / 0.45), 2);
    expect(result?.scenarioModel.parameters.productionExponent).toBe(result?.baselineModel.parameters.productionExponent);
  });

  it('applies the economy sensitivity to modeled load capacity and finds a balance load within range', () => {
    const result = buildPhysiologicalScenario(base, {
      bodyMassKg: 70,
      absoluteVo2maxLMin: 4.2,
      vlamaxMmolLSecond: 0.45,
      economyImprovementPercent: 10,
    });
    expect(result?.scenarioModel.input.maxLoad).toBeCloseTo(333.333333);
    expect(result!.scenarioModel.input.maxLoad * 0.9).toBeCloseTo(base.maxLoad);
    const worse = buildPhysiologicalScenario(base, { bodyMassKg: 70, absoluteVo2maxLMin: 4.2, vlamaxMmolLSecond: 0.45, economyImprovementPercent: -10 });
    expect(worse!.scenarioModel.input.maxLoad * 1.1).toBeCloseTo(base.maxLoad);
    for (const invalidValue of [NaN, Infinity, 0, -1]) {
      expect(buildPhysiologicalScenario(base, { bodyMassKg: invalidValue, absoluteVo2maxLMin: 4.2, vlamaxMmolLSecond: 0.45 })).toBeNull();
      expect(buildPhysiologicalScenario({ ...base, distributionVolumeLPerKg: invalidValue }, { bodyMassKg: 70, absoluteVo2maxLMin: 4.2, vlamaxMmolLSecond: 0.45 })).toBeNull();
    }
    expect(findLactateBalanceLoad(result!.baselineModel, 4)).toBeGreaterThan(0);
  });
});
