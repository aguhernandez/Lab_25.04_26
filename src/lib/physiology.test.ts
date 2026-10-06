import {
  computeStageHRFromTimeline,
  interpolateHRAtLoad,
  computeHRLoadRegression,
  type TimelineHRSample,
} from './physiology';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}

function approxEqual(a: number | null, b: number, tolerance = 1): boolean {
  return a !== null && Math.abs(a - b) <= tolerance;
}

// ── computeStageHRFromTimeline ─────────────────────────────────────────

function testStageAveraging() {
  console.log('test: stage averaging — last 30s window');

  const stages = [
    { stage_number: 1, duration_seconds: 180 },
    { stage_number: 2, duration_seconds: 180 },
    { stage_number: 3, duration_seconds: 180 },
  ];

  // Samples every 30s: timestamps 0,30,60,...,540
  // Stage 1: 0–180, Stage 2: 180–360, Stage 3: 360–540
  // Stage 1 last 30s: 150–180 → sample at 150 (HR=150)
  // Stage 2 last 30s: 330–360 → sample at 330 (HR=180)
  // Stage 3 last 30s: 510–540 → sample at 510 (HR=210)
  const timeline: TimelineHRSample[] = [];
  for (let t = 0; t < 540; t += 30) {
    timeline.push({ timestamp_s: t, heart_rate: 100 + Math.floor(t / 30) * 5 });
  }

  const result = computeStageHRFromTimeline(stages, timeline, 30);

  assert(result.length === 3, 'should return 3 stages');
  assert(result[0].hr_last_window != null, 'stage 1 should have last-window HR');
  assert(result[0].hr_max != null, 'stage 1 should have max HR');
  assert(result[0].short_stage === false, '180s stage should not be short');
  assert(result[0].hr_mean != null, 'stage 1 should have mean HR');

  // Stage 1: samples at 0,30,60,90,120,150 → HRs 100,105,110,115,120,125
  // mean = (100+105+110+115+120+125)/6 = 112.5 → round = 113 (or 112)
  assert(approxEqual(result[0].hr_mean, 112, 1), `stage 1 mean ~112, got ${result[0].hr_mean}`);
  // max = 125
  assert(result[0].hr_max === 125, `stage 1 max = 125, got ${result[0].hr_max}`);
  // last 30s: sample at 150 → HR=125
  assert(result[0].hr_last_window === 125, `stage 1 last-30s = 125, got ${result[0].hr_last_window}`);

  console.log('  PASSED');
}

function testShortStage() {
  console.log('test: stage shorter than window');

  const stages = [
    { stage_number: 1, duration_seconds: 20 }, // shorter than 30s window
  ];

  const timeline: TimelineHRSample[] = [
    { timestamp_s: 0, heart_rate: 130 },
    { timestamp_s: 10, heart_rate: 140 },
    { timestamp_s: 15, heart_rate: 145 },
  ];

  const result = computeStageHRFromTimeline(stages, timeline, 30);

  assert(result[0].short_stage === true, '20s stage should be marked short');
  assert(result[0].hr_last_window != null, 'short stage should still compute HR from full stage');
  // Mean of 130,140,145 = 138.33 → round = 138
  assert(approxEqual(result[0].hr_last_window, 138, 1), `short stage last-window ~138, got ${result[0].hr_last_window}`);

  console.log('  PASSED');
}

function testEmptyTimeline() {
  console.log('test: empty timeline returns nulls');

  const stages = [
    { stage_number: 1, duration_seconds: 180 },
    { stage_number: 2, duration_seconds: 180 },
  ];

  const result = computeStageHRFromTimeline(stages, [], 30);

  assert(result.length === 2, 'should return 2 stages');
  assert(result[0].hr_last_window === null, 'empty timeline → null HR');
  assert(result[0].hr_max === null, 'empty timeline → null max');
  assert(result[0].hr_mean === null, 'empty timeline → null mean');

  console.log('  PASSED');
}

// ── interpolateHRAtLoad ────────────────────────────────────────────────

function testInterpolationBasic() {
  console.log('test: interpolation at threshold — basic');

  const loads = [100, 150, 200, 250, 300];
  const hrs = [120, 135, 150, 165, 180];

  // Target 200 → exact match → 150
  const r1 = interpolateHRAtLoad(loads, hrs, 200);
  assert(r1 === 150, `interpolate at 200 → 150, got ${r1}`);

  // Target 175 → between 150(135) and 200(150) → slope = (150-135)/(200-150) = 0.3 → 135 + 0.3*25 = 142.5 → round = 143 (or 142)
  const r2 = interpolateHRAtLoad(loads, hrs, 175);
  assert(approxEqual(r2, 143, 1), `interpolate at 175 → ~143, got ${r2}`);

  // Target 50 → below range → return first HR
  const r3 = interpolateHRAtLoad(loads, hrs, 50);
  assert(r3 === 120, `interpolate below range → 120, got ${r3}`);

  // Target 400 → above range → return last HR
  const r4 = interpolateHRAtLoad(loads, hrs, 400);
  assert(r4 === 180, `interpolate above range → 180, got ${r4}`);

  console.log('  PASSED');
}

function testInterpolationFewPoints() {
  console.log('test: interpolation with < 2 points → null');

  const r1 = interpolateHRAtLoad([100], [120], 100);
  assert(r1 === null, 'single point → null');

  const r2 = interpolateHRAtLoad([], [], 100);
  assert(r2 === null, 'empty → null');

  console.log('  PASSED');
}

// ── computeHRLoadRegression ────────────────────────────────────────────

function testRegressionBasic() {
  console.log('test: HR–load regression — basic');

  // Perfect linear: HR = 0.5 * load + 70
  const loads = [100, 150, 200, 250, 300];
  const hrs = [120, 145, 170, 195, 220];

  const result = computeHRLoadRegression(loads, hrs, 'W');

  assert(result !== null, 'should return regression');
  assert(result!.slope === 0.5, `slope = 0.5, got ${result!.slope}`);
  assert(result!.intercept === 70, `intercept = 70, got ${result!.intercept}`);
  assert(result!.r_squared === 1, `R² = 1, got ${result!.r_squared}`);
  assert(result!.unit === 'W', 'unit should be W');

  console.log('  PASSED');
}

function testRegressionNoisy() {
  console.log('test: HR–load regression — noisy data');

  const loads = [100, 150, 200, 250, 300];
  const hrs = [125, 140, 175, 190, 215];

  const result = computeHRLoadRegression(loads, hrs, 'W');

  assert(result !== null, 'should return regression');
  assert(result!.r_squared < 1 && result!.r_squared > 0.8, `R² should be <1 and >0.8, got ${result!.r_squared}`);

  console.log('  PASSED');
}

function testRegressionFewPoints() {
  console.log('test: HR–load regression with < 3 points → null');

  const r1 = computeHRLoadRegression([100, 150], [120, 140], 'W');
  assert(r1 === null, '2 points → null');

  const r2 = computeHRLoadRegression([100], [120], 'W');
  assert(r2 === null, '1 point → null');

  const r3 = computeHRLoadRegression([], [], 'W');
  assert(r3 === null, 'empty → null');

  console.log('  PASSED');
}

function testRegressionDegenerate() {
  console.log('test: HR–load regression — all same load (zero denominator)');

  const loads = [200, 200, 200];
  const hrs = [120, 130, 140];

  const result = computeHRLoadRegression(loads, hrs, 'W');
  assert(result === null, 'degenerate (all same load) → null');

  console.log('  PASSED');
}

// ── Run all tests ──────────────────────────────────────────────────────

function main() {
  console.log('Running HR analysis tests...\n');

  testStageAveraging();
  testShortStage();
  testEmptyTimeline();
  testInterpolationBasic();
  testInterpolationFewPoints();
  testRegressionBasic();
  testRegressionNoisy();
  testRegressionFewPoints();
  testRegressionDegenerate();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main();
