import { describe, expect, it } from 'vitest';
import {
  buildMetabolicDemandCurve,
  createLactateDynamicsModel,
  estimateMLSS,
  estimateRecoveryMinutes,
  evaluateConstantLoadTrials,
  lactateFluxAt,
  simulateLactateProtocol,
} from './lactateDynamics';

const model = createLactateDynamicsModel({
  vlamaxMmolLSecond: 0.45, vo2maxMlKgMin: 60, bodyMassKg: 70,
  distributionVolumeLPerKg: 0.5, baselineLactateMmol: 1.1,
  maxLoad: 400, lt1Load: 220, lt2Load: 310, lt2LactateMmol: 4, loadUnit: 'W',
});

describe('dynamic lactate model', () => {
  it('calibrates LT2 close to production-removal equilibrium', () => {
    const flux = lactateFluxAt(model, 310, 4);
    expect(Math.abs(flux.netMmolLMin)).toBeLessThan(0.08);
    expect(flux.equilibriumLactateMmol).toBeCloseTo(4, 0);
  });

  it('accumulates during hard intervals and recovers at lower load', () => {
    const timeline = simulateLactateProtocol(model, [
      { label: 'Work', load: 380, durationSeconds: 180 },
      { label: 'Recovery', load: 150, durationSeconds: 600 },
    ]);
    const peak = Math.max(...timeline.map(point => point.bloodLactateMmol));
    expect(peak).toBeGreaterThan(1.1);
    expect(timeline[timeline.length - 1].bloodLactateMmol).toBeLessThan(peak);
    expect(estimateRecoveryMinutes(model, peak, 150)).not.toBeNull();
  });

  it('estimates MLSS with the 30-minute stability criterion', () => {
    const mlss = estimateMLSS(model);
    expect(mlss.load).toBeGreaterThan(250);
    expect(mlss.load).toBeLessThan(380);
    expect(mlss.drift10To30Mmol).toBeLessThanOrEqual(1);
  });

  it('only confirms measured MLSS when a higher unstable trial brackets it', () => {
    const result = evaluateConstantLoadTrials([
      { id: 'stable', load: 300, lactate10Mmol: 3.2, lactate20Mmol: 3.5, lactate30Mmol: 3.9 },
      { id: 'unstable', load: 315, lactate10Mmol: 3.8, lactate20Mmol: 4.5, lactate30Mmol: 5.2 },
    ]);
    expect(result.status).toBe('confirmed');
    expect(result.load).toBe(300);
  });

  it('separates oxygen demand, uptake and anaerobic contribution', () => {
    const curve = buildMetabolicDemandCurve(model, [
      { load: 100, vo2MlKgMin: 18, vco2MlKgMin: 14 },
      { load: 200, vo2MlKgMin: 32, vco2MlKgMin: 27 },
      { load: 300, vo2MlKgMin: 48, vco2MlKgMin: 45 },
    ], 60);
    const hard = curve.points[curve.points.length - 1];
    expect(curve.demandSource).toBe('measured_regression');
    expect(hard.oxygenDemandMlKgMin).toBeGreaterThan(hard.actualVo2MlKgMin);
    expect(hard.anaerobicPercent).toBeGreaterThan(0);
    expect(hard.fatPercent + hard.carbohydratePercent).toBeCloseTo(100, 0);
  });
});
