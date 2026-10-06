import { describe, it, expect } from 'vitest';
import {
  computeStageHRFromTimeline,
  interpolateHRAtLoad,
  computeHRLoadRegression,
  type TimelineHRSample,
} from './physiology';

function approxEqual(a: number | null, b: number, tolerance = 1): boolean {
  return a !== null && Math.abs(a - b) <= tolerance;
}

// ── computeStageHRFromTimeline ─────────────────────────────────────────

describe('computeStageHRFromTimeline', () => {
  it('averages HR over the last 30s window of each stage', () => {
    const stages = [
      { stage_number: 1, duration_seconds: 180 },
      { stage_number: 2, duration_seconds: 180 },
      { stage_number: 3, duration_seconds: 180 },
    ];

    // Samples every 30s: timestamps 0,30,60,...,540
    // Stage 1: 0–180, Stage 2: 180–360, Stage 3: 360–540
    const timeline: TimelineHRSample[] = [];
    for (let t = 0; t < 540; t += 30) {
      timeline.push({ timestamp_s: t, heart_rate: 100 + Math.floor(t / 30) * 5 });
    }

    const result = computeStageHRFromTimeline(stages, timeline, 30);

    expect(result).toHaveLength(3);
    expect(result[0].hr_last_window).not.toBeNull();
    expect(result[0].hr_max).not.toBeNull();
    expect(result[0].short_stage).toBe(false);
    expect(result[0].hr_mean).not.toBeNull();

    // Stage 1: samples at 0,30,60,90,120,150 → HRs 100,105,110,115,120,125
    // mean = 112.5 → round = 113 (or 112)
    expect(approxEqual(result[0].hr_mean, 112, 1)).toBe(true);
    // max = 125
    expect(result[0].hr_max).toBe(125);
    // last 30s: sample at 150 → HR=125
    expect(result[0].hr_last_window).toBe(125);
  });

  it('uses the full stage when duration is shorter than the window and marks it short', () => {
    const stages = [
      { stage_number: 1, duration_seconds: 20 }, // shorter than 30s window
    ];

    const timeline: TimelineHRSample[] = [
      { timestamp_s: 0, heart_rate: 130 },
      { timestamp_s: 10, heart_rate: 140 },
      { timestamp_s: 15, heart_rate: 145 },
    ];

    const result = computeStageHRFromTimeline(stages, timeline, 30);

    expect(result[0].short_stage).toBe(true);
    expect(result[0].hr_last_window).not.toBeNull();
    // Mean of 130,140,145 = 138.33 → round = 138
    expect(approxEqual(result[0].hr_last_window, 138, 1)).toBe(true);
  });

  it('returns nulls for all HR fields when timeline is empty', () => {
    const stages = [
      { stage_number: 1, duration_seconds: 180 },
      { stage_number: 2, duration_seconds: 180 },
    ];

    const result = computeStageHRFromTimeline(stages, [], 30);

    expect(result).toHaveLength(2);
    expect(result[0].hr_last_window).toBeNull();
    expect(result[0].hr_max).toBeNull();
    expect(result[0].hr_mean).toBeNull();
  });
});

// ── interpolateHRAtLoad ────────────────────────────────────────────────

describe('interpolateHRAtLoad', () => {
  it('interpolates HR at a given load value', () => {
    const loads = [100, 150, 200, 250, 300];
    const hrs = [120, 135, 150, 165, 180];

    // Exact match → 150
    expect(interpolateHRAtLoad(loads, hrs, 200)).toBe(150);

    // Between 150(135) and 200(150) → slope = 0.3 → 135 + 0.3*25 = 142.5 → round = 143
    expect(approxEqual(interpolateHRAtLoad(loads, hrs, 175), 143, 1)).toBe(true);

    // Below range → return first HR
    expect(interpolateHRAtLoad(loads, hrs, 50)).toBe(120);

    // Above range → return last HR
    expect(interpolateHRAtLoad(loads, hrs, 400)).toBe(180);
  });

  it('returns null when fewer than 2 valid points', () => {
    expect(interpolateHRAtLoad([100], [120], 100)).toBeNull();
    expect(interpolateHRAtLoad([], [], 100)).toBeNull();
  });
});

// ── computeHRLoadRegression ────────────────────────────────────────────

describe('computeHRLoadRegression', () => {
  it('computes slope, intercept and R² for perfect linear data', () => {
    // HR = 0.5 * load + 70
    const loads = [100, 150, 200, 250, 300];
    const hrs = [120, 145, 170, 195, 220];

    const result = computeHRLoadRegression(loads, hrs, 'W');

    expect(result).not.toBeNull();
    expect(result!.slope).toBe(0.5);
    expect(result!.intercept).toBe(70);
    expect(result!.r_squared).toBe(1);
    expect(result!.unit).toBe('W');
  });

  it('computes R² < 1 for noisy data', () => {
    const loads = [100, 150, 200, 250, 300];
    const hrs = [125, 140, 175, 190, 215];

    const result = computeHRLoadRegression(loads, hrs, 'W');

    expect(result).not.toBeNull();
    expect(result!.r_squared).toBeLessThan(1);
    expect(result!.r_squared).toBeGreaterThan(0.8);
  });

  it('returns null when fewer than 3 points', () => {
    expect(computeHRLoadRegression([100, 150], [120, 140], 'W')).toBeNull();
    expect(computeHRLoadRegression([100], [120], 'W')).toBeNull();
    expect(computeHRLoadRegression([], [], 'W')).toBeNull();
  });

  it('returns null when all loads are identical (zero denominator)', () => {
    const loads = [200, 200, 200];
    const hrs = [120, 130, 140];

    expect(computeHRLoadRegression(loads, hrs, 'W')).toBeNull();
  });
});
