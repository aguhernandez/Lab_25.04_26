import { describe, expect, it } from 'vitest';
import { calculateVLamax, estimateAlacticFromPower } from './vlamax';

const post = [
  { timeSeconds: 60, lactateMmol: 5 }, { timeSeconds: 180, lactateMmol: 8 },
  { timeSeconds: 300, lactateMmol: 10 }, { timeSeconds: 420, lactateMmol: 9 },
  { timeSeconds: 540, lactateMmol: 7.5 },
];

describe('VLamax engine', () => {
  it('calculates classical blood vLamax and absolute distribution-space rate', () => {
    const result = calculateVLamax({ sprintDurationSeconds: 12, preLactateSamples: [1, 1.2], postLactateSamples: post, alacticMethod: 'measured', alacticSeconds: 3, bodyMassKg: 70 });
    expect(result.label).toBe('vLamax_blood');
    expect(result.netRateMmolLSecond).toBeCloseTo((10 - 1.1) / 9, 3);
    expect(result.distributionVolumeLitres).toBe(35);
    expect(result.absoluteNetRateMmolSecond).toBeCloseTo(result.netRateMmolLSecond * 35, 1);
    expect(result.confidence).toBe('high');
    expect(result.timeToPeakRangeSeconds).toEqual({ lower: 240, upper: 360 });
  });

  it('labels uncorrected or long protocols as vLapeak', () => {
    const result = calculateVLamax({ sprintDurationSeconds: 15, preLactateSamples: [1, 1.1], postLactateSamples: post, alacticMethod: 'uncorrected', bodyMassKg: 70 });
    expect(result.label).toBe('vLapeak_blood');
    expect(result.confidence).toBe('low');
  });

  it('derives an alactic proxy from power decline', () => {
    expect(estimateAlacticFromPower([{ timeSeconds: 0, powerWatts: 900 }, { timeSeconds: 1, powerWatts: 1000 }, { timeSeconds: 2, powerWatts: 980 }, { timeSeconds: 3, powerWatts: 960 }])).toBe(3);
  });

  it('rejects an unconfirmed and insufficient protocol', () => {
    const result = calculateVLamax({ sprintDurationSeconds: 5, preLactateSamples: [], postLactateSamples: [{ timeSeconds: 60, lactateMmol: 2 }], alacticMethod: 'measured', bodyMassKg: 0 });
    expect(result.confidence).toBe('invalid');
    expect(result.issues.some(issue => issue.code === 'missing_baseline')).toBe(true);
  });

  it('adds an explicitly experimental clearance correction when decay supports it', () => {
    const result = calculateVLamax({ sprintDurationSeconds: 12, preLactateSamples: [1, 1.2], postLactateSamples: post, alacticMethod: 'measured', alacticSeconds: 3, bodyMassKg: 70, applyClearanceCorrection: true });
    expect(result.clearanceConstantPerSecond).toBeGreaterThan(0);
    expect(result.clearanceCorrectedRateMmolLSecond).toBeGreaterThan(result.netRateMmolLSecond);
    expect(result.estimatedRemovedLactateMmol).toBeGreaterThan(0);
    expect(result.issues.some(issue => issue.code === 'experimental_clearance_correction')).toBe(true);
  });

  it('rejects duplicate or physiologically invalid samples', () => {
    const result = calculateVLamax({
      sprintDurationSeconds: 12,
      preLactateSamples: [1, -0.2],
      postLactateSamples: [{ timeSeconds: 60, lactateMmol: 5 }, { timeSeconds: 60, lactateMmol: 8 }, { timeSeconds: 180, lactateMmol: 7 }],
      alacticMethod: 'measured', alacticSeconds: 3, bodyMassKg: 70,
    });
    expect(result.confidence).toBe('invalid');
    expect(result.issues.some(issue => issue.code === 'duplicate_post_time')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'invalid_baseline_value')).toBe(true);
  });
});
