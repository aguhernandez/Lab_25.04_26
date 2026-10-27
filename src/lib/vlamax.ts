export interface TimedLactateSample { timeSeconds: number; lactateMmol: number }
export interface PowerSample { timeSeconds: number; powerWatts: number }
export type AlacticMethod = 'measured' | 'power_drop_proxy' | 'uncorrected';

export interface VLamaxInput {
  sprintDurationSeconds: number;
  preLactateSamples: number[];
  postLactateSamples: TimedLactateSample[];
  alacticMethod: AlacticMethod;
  alacticSeconds?: number | null;
  powerSamples?: PowerSample[];
  bodyMassKg: number;
  distributionVolumeLPerKg?: number;
  lactateMeasurementErrorMmol?: number;
  applyClearanceCorrection?: boolean;
}

export interface VLamaxIssue { severity: 'error' | 'warning' | 'info'; code: string; message: string }

export interface VLamaxResult {
  label: 'vLamax_blood' | 'vLapeak_blood';
  netRateMmolLSecond: number;
  clearanceCorrectedRateMmolLSecond: number | null;
  confidence95: { lower: number; upper: number };
  confidence: 'high' | 'medium' | 'low' | 'invalid';
  preLactateMmol: number;
  peakLactateMmol: number;
  deltaLactateMmol: number;
  timeToPeakSeconds: number;
  timeToPeakRangeSeconds: { lower: number; upper: number };
  glycolyticTimeSeconds: number;
  alacticSeconds: number;
  alacticMethod: AlacticMethod;
  distributionVolumeLitres: number;
  absoluteNetRateMmolSecond: number;
  clearanceConstantPerSecond: number | null;
  estimatedRemovedLactateMmol: number | null;
  issues: VLamaxIssue[];
}

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function estimateAlacticFromPower(samples: PowerSample[]): number | null {
  const sorted = samples.filter(s => s.timeSeconds >= 0 && s.powerWatts > 0).sort((a, b) => a.timeSeconds - b.timeSeconds);
  if (sorted.length < 4) return null;
  const peak = Math.max(...sorted.map(s => s.powerWatts));
  const peakIndex = sorted.findIndex(s => s.powerWatts === peak);
  const threshold = peak * 0.965;
  const decline = sorted.slice(peakIndex + 1).find(s => s.powerWatts < threshold);
  return decline ? decline.timeSeconds : null;
}

function estimateClearanceConstant(samples: TimedLactateSample[], baseline: number, peakIndex: number): number | null {
  const decay = samples.slice(peakIndex + 1)
    .map(sample => ({ time: sample.timeSeconds, excess: sample.lactateMmol - baseline }))
    .filter(sample => sample.excess > 0);
  if (decay.length < 2) return null;
  const xMean = mean(decay.map(sample => sample.time));
  const yMean = mean(decay.map(sample => Math.log(sample.excess)));
  const denominator = decay.reduce((sum, sample) => sum + Math.pow(sample.time - xMean, 2), 0);
  if (denominator === 0) return null;
  const slope = decay.reduce((sum, sample) => sum + (sample.time - xMean) * (Math.log(sample.excess) - yMean), 0) / denominator;
  return slope < 0 ? -slope : null;
}

export function calculateVLamax(input: VLamaxInput): VLamaxResult {
  const issues: VLamaxIssue[] = [];
  const pre = input.preLactateSamples.filter(Number.isFinite);
  const post = input.postLactateSamples
    .filter(sample => Number.isFinite(sample.timeSeconds) && Number.isFinite(sample.lactateMmol))
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
  const invalid = (code: string, message: string) => issues.push({ severity: 'error', code, message });
  const warning = (code: string, message: string) => issues.push({ severity: 'warning', code, message });
  const info = (code: string, message: string) => issues.push({ severity: 'info', code, message });

  if (input.sprintDurationSeconds <= 0) invalid('invalid_duration', 'Sprint duration must be greater than zero.');
  if (input.sprintDurationSeconds < 8 || input.sprintDurationSeconds > 30) invalid('duration_out_of_range', 'Supported sprint duration is 8–30 seconds.');
  else if (input.sprintDurationSeconds < 10 || input.sprintDurationSeconds > 12) warning('non_standard_duration', 'A 10–12 second all-out sprint is recommended; other durations should be interpreted as vLapeak.');
  if (pre.length === 0) invalid('missing_baseline', 'At least one pre-sprint lactate sample is required.');
  else if (pre.length < 2) warning('single_baseline', 'Use the mean of 2–3 nearby pre-sprint samples.');
  if (post.length < 3) invalid('insufficient_post_samples', 'At least three post-sprint samples are required to identify peak lactate.');
  if (pre.some(value => value < 0)) invalid('invalid_baseline_value', 'Pre-sprint lactate cannot be negative.');
  if (post.some(sample => sample.timeSeconds < 0 || sample.lactateMmol < 0)) invalid('invalid_post_sample', 'Post-sprint time and lactate values cannot be negative.');
  if (new Set(post.map(sample => sample.timeSeconds)).size !== post.length) invalid('duplicate_post_time', 'Post-sprint sample times must be unique.');
  if (post.length && post[0].timeSeconds > 90) warning('late_first_sample', 'Take the first post-sprint sample within 60–90 seconds to reduce the chance of missing an early peak.');
  const largestPostGap = post.slice(1).reduce((largest, sample, index) => Math.max(largest, sample.timeSeconds - post[index].timeSeconds), 0);
  if (largestPostGap > 180) warning('sparse_post_sampling', 'Post-sprint sampling gaps over three minutes make peak timing and clearance estimates less reliable.');

  const baseline = pre.length ? mean(pre) : 0;
  if (baseline > 1.5) warning('high_baseline', 'Pre-sprint lactate is above 1.5 mmol/L; recovery or protocol standardization may be insufficient.');
  const peakLactate = post.length ? Math.max(...post.map(sample => sample.lactateMmol)) : baseline;
  const peakIndex = post.findIndex(sample => sample.lactateMmol === peakLactate);
  const peakSample = peakIndex >= 0 ? post[peakIndex] : { timeSeconds: 0, lactateMmol: baseline };
  const previousPeakNeighbour = peakIndex > 0 ? post[peakIndex - 1] : null;
  const nextPeakNeighbour = peakIndex >= 0 && peakIndex < post.length - 1 ? post[peakIndex + 1] : null;
  const peakRange = {
    lower: previousPeakNeighbour ? (previousPeakNeighbour.timeSeconds + peakSample.timeSeconds) / 2 : Math.max(0, peakSample.timeSeconds - ((nextPeakNeighbour?.timeSeconds ?? peakSample.timeSeconds) - peakSample.timeSeconds) / 2),
    upper: nextPeakNeighbour ? (peakSample.timeSeconds + nextPeakNeighbour.timeSeconds) / 2 : peakSample.timeSeconds,
  };
  const delta = peakLactate - baseline;
  if (delta <= 0) invalid('no_lactate_rise', 'Post-sprint peak must exceed pre-sprint lactate.');
  if (peakIndex === post.length - 1 && post.length) warning('peak_not_confirmed', 'The last sample is the highest; continue sampling until lactate clearly declines.');
  const postPeak = peakIndex >= 0 ? post.slice(peakIndex + 1) : [];
  const consecutiveDeclines = postPeak.length >= 2 && postPeak[0].lactateMmol < peakLactate && postPeak[1].lactateMmol < postPeak[0].lactateMmol;
  if (!consecutiveDeclines) warning('decline_not_confirmed', 'Two consecutive post-peak decreases are recommended to confirm the true peak.');
  if (peakSample.timeSeconds < 60 || peakSample.timeSeconds > 600) warning('atypical_peak_time', 'Time to peak is outside the expected 1–10 minute observation window; review sampling times and recovery conditions.');

  let alacticSeconds = 0;
  if (input.alacticMethod === 'measured') {
    alacticSeconds = Number(input.alacticSeconds ?? 0);
    if (alacticSeconds <= 0) invalid('missing_alactic_time', 'Measured alactic time is required.');
  } else if (input.alacticMethod === 'power_drop_proxy') {
    alacticSeconds = estimateAlacticFromPower(input.powerSamples ?? []) ?? 0;
    if (alacticSeconds <= 0) invalid('power_proxy_failed', 'Power samples could not identify a >3.5% decline after peak power.');
    else warning('proxy_alactic_time', 'Alactic time is a power-drop proxy, not a direct phosphocreatine measurement.');
  } else {
    warning('uncorrected_rate', 'No alactic correction applied; report this result as vLapeak, not vLamax.');
  }

  const glycolyticTime = input.sprintDurationSeconds - alacticSeconds;
  if (glycolyticTime <= 1) invalid('invalid_glycolytic_time', 'Sprint duration minus alactic time must exceed one second.');
  const netRate = glycolyticTime > 0 ? delta / glycolyticTime : 0;
  const distributionCoefficient = input.distributionVolumeLPerKg ?? 0.5;
  if (!Number.isFinite(distributionCoefficient) || distributionCoefficient <= 0) invalid('invalid_distribution_volume', 'Distribution volume must be greater than zero.');
  if (distributionCoefficient < 0.35 || distributionCoefficient > 0.65) warning('distribution_volume_unusual', 'Distribution volume is outside the typical modelling range of 0.35–0.65 L/kg.');
  const volume = Math.max(0, input.bodyMassKg * distributionCoefficient);
  if (input.bodyMassKg <= 0) invalid('invalid_body_mass', 'Body mass must be greater than zero.');

  const clearanceConstant = estimateClearanceConstant(post, baseline, peakIndex);
  let correctedRate: number | null = null;
  let estimatedRemovedLactate: number | null = null;
  if (input.applyClearanceCorrection) {
    if (clearanceConstant == null) warning('clearance_unavailable', 'Clearance correction requires at least two valid samples after the confirmed peak.');
    else {
      // One-compartment sensitivity estimate. It assumes mean excess lactate equals half the observed rise
      // from effective glycolytic onset until the observed blood peak. Continued muscle-to-blood appearance
      // cannot be separated from removal with this protocol, so this is not a validated gross VLamax value.
      const accumulationWindow = Math.max(0, glycolyticTime) + Math.max(0, peakSample.timeSeconds);
      estimatedRemovedLactate = clearanceConstant * Math.max(0, delta) / 2 * accumulationWindow;
      correctedRate = glycolyticTime > 0 ? (delta + estimatedRemovedLactate) / glycolyticTime : null;
      warning('experimental_clearance_correction', 'The time-to-peak clearance correction is a one-compartment sensitivity estimate, not a validated gross VLamax measurement. Report it beside the classical net rate.');
      if (correctedRate != null && netRate > 0 && correctedRate > netRate * 1.75) warning('unstable_clearance_correction', 'The correction changes the estimate by more than 75%; do not use it for decisions without a richer kinetic model.');
    }
  }

  const measurementError = input.lactateMeasurementErrorMmol ?? 0.3;
  if (!Number.isFinite(measurementError) || measurementError <= 0) invalid('invalid_measurement_error', 'Lactate measurement error must be greater than zero.');
  const alacticError = input.alacticMethod === 'measured' ? 0.3 : input.alacticMethod === 'power_drop_proxy' ? 0.75 : 0;
  const timingError = 0.1 + alacticError;
  const baselineMeasurementError = measurementError / Math.sqrt(Math.max(1, pre.length));
  const deltaMeasurementError = Math.sqrt(Math.pow(measurementError, 2) + Math.pow(baselineMeasurementError, 2));
  const standardError = glycolyticTime > 0
    ? Math.sqrt(Math.pow(deltaMeasurementError / glycolyticTime, 2) + Math.pow(delta * timingError / Math.pow(glycolyticTime, 2), 2))
    : 0;
  const margin = 1.96 * standardError;

  let confidence: VLamaxResult['confidence'] = 'high';
  if (issues.some(issue => issue.severity === 'error')) confidence = 'invalid';
  else {
    const warnings = issues.filter(issue => issue.severity === 'warning').length;
    if (input.alacticMethod === 'uncorrected' || warnings >= 3) confidence = 'low';
    else if (input.alacticMethod === 'power_drop_proxy' || warnings > 0) confidence = 'medium';
  }

  const label: VLamaxResult['label'] = input.alacticMethod === 'uncorrected' || input.sprintDurationSeconds < 10 || input.sprintDurationSeconds > 12 ? 'vLapeak_blood' : 'vLamax_blood';
  info('indirect_blood_estimate', 'This is an indirect blood-lactate accumulation estimate and is not interchangeable with a muscle glycolytic flux measurement or INSCYD’s current proprietary model.');
  return {
    label,
    netRateMmolLSecond: round(netRate),
    clearanceCorrectedRateMmolLSecond: correctedRate == null ? null : round(correctedRate),
    confidence95: { lower: round(Math.max(0, netRate - margin)), upper: round(netRate + margin) },
    confidence,
    preLactateMmol: round(baseline, 2), peakLactateMmol: round(peakLactate, 2), deltaLactateMmol: round(delta, 2),
    timeToPeakSeconds: peakSample.timeSeconds,
    timeToPeakRangeSeconds: { lower: round(peakRange.lower, 1), upper: round(peakRange.upper, 1) },
    glycolyticTimeSeconds: round(glycolyticTime, 2), alacticSeconds: round(alacticSeconds, 2),
    alacticMethod: input.alacticMethod, distributionVolumeLitres: round(volume, 1),
    absoluteNetRateMmolSecond: round(netRate * volume), clearanceConstantPerSecond: clearanceConstant == null ? null : round(clearanceConstant, 5),
    estimatedRemovedLactateMmol: estimatedRemovedLactate == null ? null : round(estimatedRemovedLactate, 2),
    issues,
  };
}
