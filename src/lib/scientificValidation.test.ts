import { describe, expect, it } from 'vitest';
import {
  calculateBlandAltman,
  calculateTestRetest,
  summarizeInputSensitivity,
} from './scientificValidation';

describe('scientific validation summaries', () => {
  it('computes Bland–Altman bias and limits from paired values', () => {
    const summary = calculateBlandAltman([
      { subjectId: 'a', candidate: 11, reference: 10 },
      { subjectId: 'b', candidate: 22, reference: 20 },
      { subjectId: 'c', candidate: 33, reference: 30 },
    ]);
    expect(summary?.bias).toBeCloseTo(2);
    expect(summary?.lowerLimit).toBeCloseTo(0.04);
    expect(summary?.upperLimit).toBeCloseTo(3.96);
  });

  it('returns confidence intervals for bias and both agreement limits', () => {
    const summary = calculateBlandAltman([
      { subjectId: 'a', candidate: 8, reference: 10 },
      { subjectId: 'b', candidate: 11, reference: 10 },
      { subjectId: 'c', candidate: 13, reference: 10 },
      { subjectId: 'd', candidate: 9, reference: 10 },
    ]);
    expect(summary?.biasCi95[0]).toBeLessThan(summary?.biasCi95[1] ?? 0);
    expect(summary?.lowerLimitCi95[0]).toBeLessThan(summary?.lowerLimitCi95[1] ?? 0);
    expect(summary?.upperLimitCi95[0]).toBeLessThan(summary?.upperLimitCi95[1] ?? 0);
  });

  it('rejects incomplete Bland–Altman pairs', () => {
    expect(calculateBlandAltman([{ subjectId: 'a', candidate: 1, reference: 2 }])).toBeNull();
  });

  it('calculates test–retest typical error and detectable change', () => {
    const summary = calculateTestRetest([
      { subjectId: 'a', candidate: 100, reference: 102 },
      { subjectId: 'b', candidate: 120, reference: 121 },
      { subjectId: 'c', candidate: 140, reference: 138 },
    ]);
    expect(summary).not.toBeNull();
    expect(summary!.typicalError).toBeGreaterThan(0);
    expect(summary!.minimalDetectableChange95).toBeCloseTo(1.96 * Math.sqrt(2) * summary!.typicalError);
  });

  it('labels a measurement-error scenario as a range around the baseline', () => {
    expect(summarizeInputSensitivity(250, 246, 255)).toEqual({
      baseline: 250,
      lowerScenario: 246,
      upperScenario: 255,
      minimum: 246,
      maximum: 255,
    });
  });
});

it('uses finite-df Student intervals above 30 df instead of jumping to a normal interval', () => {
  const rows = Array.from({ length: 32 }, (_, i) => ({ subjectId: String(i), candidate: 100 + i % 3, reference: 100 }));
  const s = calculateBlandAltman(rows)!;
  expect((s.biasCi95[1] - s.bias) * Math.sqrt(32) / s.standardDeviationOfDifferences).toBeCloseTo(2.039513446, 5);
});
it('rejects repeated participants and non-finite measurements in statistical cohorts', () => {
  const duplicate = [{ subjectId: 'a', candidate: 1, reference: 2 }, { subjectId: 'a', candidate: 3, reference: 2 }];
  expect(calculateBlandAltman(duplicate)).toBeNull();
  expect(calculateTestRetest(duplicate)).toBeNull();
  expect(calculateBlandAltman([...duplicate.slice(0, 1), { subjectId: 'b', candidate: NaN, reference: 1 }])).toBeNull();
});
