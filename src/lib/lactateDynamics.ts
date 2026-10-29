import { fuelFromGasExchange, rerAtLoad } from './metabolicFuel';

export type LactateLoadUnit = 'W' | 'km/h';

export interface LactateDynamicsInput {
  vlamaxMmolLSecond: number;
  vo2maxMlKgMin: number;
  bodyMassKg: number;
  distributionVolumeLPerKg: number;
  baselineLactateMmol: number;
  maxLoad: number;
  lt1Load?: number | null;
  lt2Load?: number | null;
  lt2LactateMmol?: number | null;
  loadUnit: LactateLoadUnit;
  oxidationFractionOfVo2?: number;
  lactateKmMmol?: number;
  bloodLagSeconds?: number;
}

export interface LactateModelParameters {
  maxProductionMmolLMin: number;
  maxOxidationMmolLMin: number;
  productionExponent: number;
  oxidationPeakLoad: number;
  oxidationWidth: number;
  lactateKmMmol: number;
  bloodLagSeconds: number;
  distributionVolumeLitres: number;
  lt1Load: number;
  lt2Load: number;
  inferredThresholds: boolean;
}

export interface LactateFlux {
  load: number;
  productionMmolLMin: number;
  oxidationCapacityMmolLMin: number;
  oxidationMmolLMin: number;
  netMmolLMin: number;
  equilibriumLactateMmol: number | null;
  stable: boolean;
}

export interface LactateProtocolSegment {
  label: string;
  load: number;
  durationSeconds: number;
}

export interface LactateSimulationPoint {
  timeSeconds: number;
  label: string;
  load: number;
  metabolicLactateMmol: number;
  bloodLactateMmol: number;
  productionMmolLMin: number;
  oxidationMmolLMin: number;
  netMmolLMin: number;
}

export interface LactateDynamicsModel {
  input: LactateDynamicsInput;
  parameters: LactateModelParameters;
  issues: string[];
}

export interface ConstantLoadLactateTrial {
  id: string;
  athleteId?: string;
  assessmentId?: string;
  modality?: string;
  protocolVersion?: string;
  durationMinutes?: number;
  loadUnit?: LactateLoadUnit;
  stabilityDeltaLimitMmol?: number;
  maxLoadDeviationPercent?: number;
  loadConstantVerified?: boolean;
  actualLoadValues?: number[];
  samples?: Array<{ timeMinutes: number; lactateMmol: number }>;
  qualityFlags?: string[];
  load: number;
  lactate10Mmol?: number;
  lactate20Mmol?: number;
  lactate30Mmol?: number;
  date?: string;
}

export interface EvaluatedConstantLoadTrial extends ConstantLoadLactateTrial {
  drift10To30Mmol: number | null;
  slopeMmolLMin: number | null;
  stability: 'stable' | 'unstable' | 'inconclusive' | 'invalid';
  stable: boolean | null;
  qualityFlags: string[];
}

export interface MeasuredMLSSResult {
  load: number | null;
  lactateMmol: number | null;
  status: 'confirmed' | 'lower_bound' | 'not_found' | 'review';
  upperLoad: number | null;
  contradictoryTrials: boolean;
  trials: EvaluatedConstantLoadTrial[];
}

export interface MetabolicDemandSample {
  load: number;
  vo2MlKgMin?: number | null;
  vco2MlKgMin?: number | null;
}

export interface MetabolicDemandPoint {
  load: number;
  oxygenDemandMlKgMin: number;
  actualVo2MlKgMin: number;
  oxygenDeficitMlKgMin: number;
  aerobicPercent: number;
  anaerobicPercent: number;
  unmetPercent: number;
  fatPercent: number | null;
  carbohydratePercent: number | null;
  rer: number | null;
  rerSource: 'measured' | 'estimated' | 'unavailable';
}

export interface MetabolicDemandCurve {
  points: MetabolicDemandPoint[];
  demandSource: 'measured_regression' | 'inferred';
  vo2TimeConstantSeconds: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

export function createLactateDynamicsModel(input: LactateDynamicsInput): LactateDynamicsModel {
  const issues: string[] = [];
  const distributionVolumeLitres = input.bodyMassKg * input.distributionVolumeLPerKg;
  const inferredThresholds = !(input.lt1Load && input.lt2Load);
  const lt1Load = input.lt1Load && input.lt1Load > 0 ? input.lt1Load : input.maxLoad * 0.55;
  const lt2Load = input.lt2Load && input.lt2Load > lt1Load ? input.lt2Load : input.maxLoad * 0.78;
  const lt2Lactate = Math.max(input.baselineLactateMmol + 0.5, input.lt2LactateMmol ?? 4);
  const oxidationFraction = clamp(input.oxidationFractionOfVo2 ?? 0.7, 0.3, 0.95);
  const lactateKmMmol = clamp(input.lactateKmMmol ?? 1.5, 0.5, 5);
  const bloodLagSeconds = clamp(input.bloodLagSeconds ?? 45, 15, 180);

  if (inferredThresholds) issues.push('LT1 or LT2 load was unavailable; threshold loads were inferred from the maximal observed load.');
  if (input.vlamaxMmolLSecond <= 0) issues.push('VLamax must be greater than zero.');
  if (input.vo2maxMlKgMin <= 0) issues.push('VO₂max must be greater than zero.');
  if (distributionVolumeLitres <= 0) issues.push('Distribution volume must be greater than zero.');

  const maxProductionMmolLMin = Math.max(0, input.vlamaxMmolLSecond * 60);
  const absoluteVo2LMin = input.vo2maxMlKgMin * input.bodyMassKg / 1000;
  const oxygenMmolMin = absoluteVo2LMin / 22.414 * 1000;
  const lactateOxidationEquivalentMmolMin = oxygenMmolMin / 3;
  const maxOxidationMmolLMin = distributionVolumeLitres > 0
    ? lactateOxidationEquivalentMmolMin * oxidationFraction / distributionVolumeLitres
    : 0;

  const oxidationPeakLoad = clamp((lt1Load + lt2Load) / 2, input.maxLoad * 0.35, input.maxLoad * 0.9);
  const oxidationWidth = Math.max(input.maxLoad * 0.28, 0.1);
  const lt2Response = 0.12 + 0.88 * Math.exp(-0.5 * Math.pow((lt2Load - oxidationPeakLoad) / oxidationWidth, 2));
  const lt2Saturation = (lt2Lactate - input.baselineLactateMmol) / (lactateKmMmol + lt2Lactate - input.baselineLactateMmol);
  const targetProductionAtLt2 = Math.max(0.0001, maxOxidationMmolLMin * lt2Response * lt2Saturation);
  const normalizedLt2 = clamp(lt2Load / input.maxLoad, 0.2, 0.98);
  const productionRatio = maxProductionMmolLMin > 0 ? clamp(targetProductionAtLt2 / maxProductionMmolLMin, 0.0001, 0.95) : 0.1;
  const productionExponent = clamp(Math.log(productionRatio) / Math.log(normalizedLt2), 2, 24);

  return {
    input,
    parameters: {
      maxProductionMmolLMin: maxProductionMmolLMin,
      maxOxidationMmolLMin: maxOxidationMmolLMin,
      productionExponent: productionExponent,
      oxidationPeakLoad: oxidationPeakLoad,
      oxidationWidth: oxidationWidth,
      lactateKmMmol,
      bloodLagSeconds,
      distributionVolumeLitres: distributionVolumeLitres,
      lt1Load: lt1Load,
      lt2Load: lt2Load,
      inferredThresholds,
    },
    issues,
  };
}

export function lactateFluxAt(model: LactateDynamicsModel, load: number, lactateMmol: number): LactateFlux {
  const { input, parameters } = model;
  const normalizedLoad = clamp(load / input.maxLoad, 0, 1);
  const production = parameters.maxProductionMmolLMin * Math.pow(normalizedLoad, parameters.productionExponent);
  const loadResponse = 0.12 + 0.88 * Math.exp(-0.5 * Math.pow((load - parameters.oxidationPeakLoad) / parameters.oxidationWidth, 2));
  const oxidationCapacity = parameters.maxOxidationMmolLMin * loadResponse;
  const excess = Math.max(0, lactateMmol - input.baselineLactateMmol);
  const oxidation = oxidationCapacity * excess / (parameters.lactateKmMmol + excess);
  const net = production - oxidation;

  let equilibriumLactate: number | null = null;
  if (production < oxidationCapacity * 0.995) {
    const equilibriumExcess = production * parameters.lactateKmMmol / Math.max(0.0001, oxidationCapacity - production);
    const candidate = input.baselineLactateMmol + equilibriumExcess;
    if (candidate <= 25) equilibriumLactate = candidate;
  }

  return {
    load: round(load, 1),
    productionMmolLMin: production,
    oxidationCapacityMmolLMin: oxidationCapacity,
    oxidationMmolLMin: oxidation,
    netMmolLMin: net,
    equilibriumLactateMmol: equilibriumLactate == null ? null : round(equilibriumLactate, 2),
    stable: equilibriumLactate != null,
  };
}

export function buildLactateFluxCurve(model: LactateDynamicsModel, referenceLactateMmol: number, pointCount = 31): LactateFlux[] {
  return Array.from({ length: pointCount }, (_, index) => {
    const load = model.input.maxLoad * index / (pointCount - 1);
    return lactateFluxAt(model, load, referenceLactateMmol);
  });
}

export function simulateLactateProtocol(
  model: LactateDynamicsModel,
  segments: LactateProtocolSegment[],
  initialLactateMmol = model.input.baselineLactateMmol,
  stepSeconds = 5,
): LactateSimulationPoint[] {
  if (!Number.isFinite(stepSeconds) || stepSeconds <= 0 || !Number.isFinite(initialLactateMmol) || segments.some(s => !Number.isFinite(s.durationSeconds) || s.durationSeconds <= 0 || !Number.isFinite(s.load) || s.load < 0)) return [];
  let metabolicLactate = Math.max(model.input.baselineLactateMmol, initialLactateMmol);
  let bloodLactate = metabolicLactate;
  let timeSeconds = 0;
  const points: LactateSimulationPoint[] = [];

  segments.forEach(segment => {
    const steps = Math.max(1, Math.ceil(segment.durationSeconds / stepSeconds));
    for (let step = 0; step < steps; step += 1) {
      const elapsed = Math.min(stepSeconds, segment.durationSeconds - step * stepSeconds);
      if (elapsed <= 0) continue;
      let remaining = elapsed;
      while (remaining > 1e-9) {
        const dt = Math.min(1, remaining);
        const flux = lactateFluxAt(model, segment.load, metabolicLactate);
        const next = Math.max(model.input.baselineLactateMmol, metabolicLactate + flux.netMmolLMin * dt / 60);
        const tau = model.parameters.bloodLagSeconds;
        const response = -Math.expm1(-dt / tau);
        const rate = (next - metabolicLactate) / dt;
        bloodLactate += (metabolicLactate - bloodLactate) * response + rate * (dt - tau * response);
        metabolicLactate = next;
        remaining -= dt;
      }
      const flux = lactateFluxAt(model, segment.load, metabolicLactate);
      timeSeconds += elapsed;
      points.push({
        timeSeconds,
        label: segment.label,
        load: segment.load,
        metabolicLactateMmol: round(metabolicLactate, 2),
        bloodLactateMmol: round(bloodLactate, 2),
        productionMmolLMin: flux.productionMmolLMin,
        oxidationMmolLMin: flux.oxidationMmolLMin,
        netMmolLMin: flux.netMmolLMin,
      });
    }
  });
  return points;
}

export function estimateRecoveryMinutes(
  model: LactateDynamicsModel,
  startLactateMmol: number,
  recoveryLoad: number,
  targetLactateMmol = model.input.baselineLactateMmol + 0.5,
  maxMinutes = 60,
): number | null {
  if (startLactateMmol <= targetLactateMmol) return 0;
  const points = simulateLactateProtocol(model, [{ label: 'Recovery', load: recoveryLoad, durationSeconds: maxMinutes * 60 }], startLactateMmol, 5);
  const recovered = points.find(point => point.bloodLactateMmol <= targetLactateMmol);
  return recovered ? round(recovered.timeSeconds / 60, 1) : null;
}

/** Evaluates the MLSS criterion: rise of no more than the limit from minute 10 to 30. */
export function evaluateConstantLoadTrials(trials: ConstantLoadLactateTrial[]): MeasuredMLSSResult {
  const evaluated = trials.map(trial => {
    const flags = [...(trial.qualityFlags ?? [])];
    const duration = trial.durationMinutes ?? 30;
    const limit = trial.stabilityDeltaLimitMmol ?? 1;
    const samples = trial.samples ?? [
      ...(trial.lactate10Mmol == null ? [] : [{ timeMinutes: 10, lactateMmol: trial.lactate10Mmol }]),
      ...(trial.lactate20Mmol == null ? [] : [{ timeMinutes: 20, lactateMmol: trial.lactate20Mmol }]),
      ...(trial.lactate30Mmol == null ? [] : [{ timeMinutes: 30, lactateMmol: trial.lactate30Mmol }]),
    ];
    const ordered = [...samples].sort((a, b) => a.timeMinutes - b.timeMinutes);
    const invalidSamples = ordered.some(sample => !Number.isFinite(sample.timeMinutes) || !Number.isFinite(sample.lactateMmol) || sample.lactateMmol <= 0 || sample.lactateMmol > 25 || sample.timeMinutes < 0 || sample.timeMinutes > duration);
    const duplicateTimes = ordered.some((sample, index) => index > 0 && sample.timeMinutes === ordered[index - 1].timeMinutes);
    if (!(trial.load > 0) || !Number.isFinite(trial.load) || !Number.isFinite(duration) || duration < 30 || !Number.isFinite(limit) || limit <= 0 || invalidSamples || duplicateTimes) flags.push('invalid_protocol_or_measurement');
    if (trial.actualLoadValues?.length) {
      const deviationLimit = trial.maxLoadDeviationPercent ?? 3;
      const deviation = Math.max(...trial.actualLoadValues.map(value => Math.abs(value - trial.load) / trial.load * 100));
      if (trial.actualLoadValues.some(value => !Number.isFinite(value) || value <= 0) || deviation > deviationLimit) flags.push('load_not_constant');
    }
    if (trial.loadConstantVerified !== true) flags.push('load_constancy_unverified');
    const at10 = ordered.find(sample => sample.timeMinutes === 10)?.lactateMmol;
    const at30 = ordered.find(sample => sample.timeMinutes === 30)?.lactateMmol;
    let stability: EvaluatedConstantLoadTrial['stability'] = 'inconclusive';
    let drift: number | null = null;
    if (flags.includes('invalid_protocol_or_measurement') || flags.includes('load_not_constant')) stability = 'invalid';
    else if (at10 == null || at30 == null) flags.push('missing_required_10_or_30_min_sample');
    else {
      const rawDrift = at30 - at10;
      drift = round(rawDrift, 2);
      // Compare unrounded measurements; tolerate only floating-point representation noise.
      const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(at10), Math.abs(at30), limit);
      if (rawDrift < -1 - tolerance) flags.push('unexpected_lactate_decline');
      else if (trial.loadConstantVerified === true) stability = rawDrift <= limit + tolerance ? 'stable' : 'unstable';
    }
    return {
      ...trial,
      qualityFlags: [...new Set(flags)],
      drift10To30Mmol: drift,
      slopeMmolLMin: drift == null ? null : round(drift / 20, 3),
      stability,
      stable: stability === 'stable' ? true : stability === 'unstable' ? false : null,
    };
  }).sort((a, b) => a.load - b.load);
  const stable = evaluated.filter(trial => trial.stability === 'stable');
  const unstable = evaluated.filter(trial => trial.stability === 'unstable');
  if (!stable.length) return { load: null, lactateMmol: null, status: 'not_found', upperLoad: null, contradictoryTrials: false, trials: evaluated };
  const highestStable = stable[stable.length - 1];
  const lowerUnstable = unstable.some(trial => trial.load <= highestStable.load);
  const higherUnstable = unstable.filter(trial => trial.load > highestStable.load).sort((a, b) => a.load - b.load)[0];
  const contradictoryTrials = lowerUnstable;
  return {
    load: highestStable.load,
    lactateMmol: highestStable.samples?.find(sample => sample.timeMinutes === 30)?.lactateMmol ?? highestStable.lactate30Mmol ?? null,
    status: contradictoryTrials ? 'review' : higherUnstable ? 'confirmed' : 'lower_bound',
    upperLoad: higherUnstable?.load ?? null,
    contradictoryTrials,
    trials: evaluated,
  };
}

function interpolateSample(samples: Array<{ load: number; value: number }>, load: number): number | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a.load - b.load);
  if (load < sorted[0].load || load > sorted[sorted.length - 1].load) return null;
  if (load === sorted[0].load) return sorted[0].value;
  if (load === sorted[sorted.length - 1].load) return sorted[sorted.length - 1].value;
  const upperIndex = sorted.findIndex(sample => sample.load >= load);
  const lower = sorted[upperIndex - 1];
  const upper = sorted[upperIndex];
  const fraction = (load - lower.load) / Math.max(0.0001, upper.load - lower.load);
  return lower.value + (upper.value - lower.value) * fraction;
}

function linearRegression(samples: Array<{ load: number; vo2: number }>): { slope: number; intercept: number } | null {
  if (samples.length < 2) return null;
  const meanX = samples.reduce((sum, sample) => sum + sample.load, 0) / samples.length;
  const meanY = samples.reduce((sum, sample) => sum + sample.vo2, 0) / samples.length;
  const denominator = samples.reduce((sum, sample) => sum + Math.pow(sample.load - meanX, 2), 0);
  if (denominator <= 0) return null;
  const slope = samples.reduce((sum, sample) => sum + (sample.load - meanX) * (sample.vo2 - meanY), 0) / denominator;
  return Number.isFinite(slope) && slope > 0 ? { slope, intercept: meanY - slope * meanX } : null;
}

/**
 * Returns continuous energy-system estimates in oxygen equivalents. Anaerobic
 * glycolysis is constrained by the modelled lactate-production rate; substrate
 * use is derived from measured RER when available and otherwise estimated.
 */
export function buildMetabolicDemandCurve(
  model: LactateDynamicsModel,
  samples: MetabolicDemandSample[],
  effortDurationSeconds = 180,
  pointCount = 41,
  vo2TimeConstantSeconds = 30,
  requestedLoads?: number[],
): MetabolicDemandCurve {
  const validVo2 = samples.flatMap(sample => Number.isFinite(sample.load) && sample.load >= 0 && sample.vo2MlKgMin != null && Number.isFinite(sample.vo2MlKgMin) && sample.vo2MlKgMin > 0
    ? [{ load: sample.load, vo2: sample.vo2MlKgMin }]
    : []);
  const submaximal = validVo2.filter(sample => sample.vo2 <= model.input.vo2maxMlKgMin * 0.9);
  const regression = linearRegression(submaximal.length >= 2 ? submaximal : validVo2);
  const demandSource = regression ? 'measured_regression' as const : 'inferred' as const;
  const fallbackIntercept = 3.5;
  const fallbackSlope = (model.input.vo2maxMlKgMin - fallbackIntercept) / Math.max(1, model.input.maxLoad * 0.9);
  const vo2Samples = validVo2.map(sample => ({ load: sample.load, value: sample.vo2 }));
  const kineticsFraction = clamp(1 - Math.exp(-Math.max(1, effortDurationSeconds) / Math.max(10, vo2TimeConstantSeconds)), 0, 1);

  const loads = requestedLoads ?? Array.from({ length: Math.max(2, pointCount) }, (_, index) => model.input.maxLoad * index / (Math.max(2, pointCount) - 1));
  const points = loads.map((load): MetabolicDemandPoint => {
    const fittedDemand = (regression?.intercept ?? fallbackIntercept) + (regression?.slope ?? fallbackSlope) * load;
    const interpolatedVo2 = interpolateSample(vo2Samples.some(s => s.load === 0) ? vo2Samples : [{ load: 0, value: 3.5 }, ...vo2Samples], load);
    const oxygenDemand = Math.max(3.5, interpolatedVo2 ?? fittedDemand);
    const steadyVo2 = Math.min(model.input.vo2maxMlKgMin, oxygenDemand);
    const restingVo2 = Math.min(3.5, steadyVo2);
    const actualVo2 = restingVo2 + (steadyVo2 - restingVo2) * kineticsFraction;
    const oxygenDeficit = Math.max(0, oxygenDemand - actualVo2);
    const production = lactateFluxAt(model, load, model.input.baselineLactateMmol + 3).productionMmolLMin;
    // Scenario assumption: glycogen glycolysis yields 1.5 ATP per lactate;
    // oxidative ATP/O₂ = 5. This is an ATP equivalent, NOT lactate combustion
    // (3 O₂/lactate) or the empirical equivalent of peak blood accumulation.
    const glycolyticCapacity = production * model.input.distributionVolumeLPerKg * (1.5 / 5) * 22.414;
    const anaerobic = Math.min(oxygenDeficit, glycolyticCapacity);
    const unmet = Math.max(0, oxygenDeficit - anaerobic);
    const total = Math.max(0.001, oxygenDemand);
    const gas = rerAtLoad(samples, load, actualVo2 / model.input.vo2maxMlKgMin * 100);
    const absoluteVo2 = actualVo2 * model.input.bodyMassKg / 1000;
    const fuel = gas.rer == null ? null : fuelFromGasExchange(absoluteVo2, absoluteVo2 * gas.rer);
    return {
      load,
      oxygenDemandMlKgMin: oxygenDemand,
      actualVo2MlKgMin: actualVo2,
      oxygenDeficitMlKgMin: oxygenDeficit,
      aerobicPercent: round(actualVo2 / total * 100, 1),
      anaerobicPercent: round(anaerobic / total * 100, 1),
      unmetPercent: round(unmet / total * 100, 1),
      fatPercent: fuel?.fatPercent ?? null,
      carbohydratePercent: fuel?.carbohydratePercent ?? null,
      rer: gas.rer,
      rerSource: gas.source,
    };
  });

  return { points, demandSource, vo2TimeConstantSeconds };
}
