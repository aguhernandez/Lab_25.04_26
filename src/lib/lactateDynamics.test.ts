import { describe, expect, it } from 'vitest';
import { createLactateDynamicsModel, estimateRecoveryMinutes, lactateFluxAt, simulateLactateProtocol } from './lactateDynamics';

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
});
