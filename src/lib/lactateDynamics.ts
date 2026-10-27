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
  load: number;
  lactate10Mmol: number;
  lactate20Mmol: number;
  lactate30Mmol: number;
  date?: string;
}

export interface EvaluatedConstantLoadTrial extends ConstantLoadLactateTrial {
  drift10To30Mmol: number;
  stable: boolean;
}

export interface MeasuredMLSSResult {
  load: number | null;
  lactateMmol: number | null;
  status: 'confirmed' | 'lower_bound' | 'not_found';
  trials: EvaluatedConstantLoadTrial[];
}

export interface EstimatedMLSSResult {
  load: number;
  lactateMmol: number;
  drift10To30Mmol: number;
  productionMmolLMin: number;
  oxidationMmolLMin: number;
  confidence: 'moderate' | 'low';
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
  fatPercent: number;
  carbohydratePercent: number;
  rer: number;
  rerSource: 'measured' | 'estimated';
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
      maxProductionMmolLMin: round(maxProductionMmolLMin),
      maxOxidationMmolLMin: round(maxOxidationMmolLMin),
      productionExponent: round(productionExponent, 2),
      oxidationPeakLoad: round(oxidationPeakLoad, 1),
      oxidationWidth: round(oxidationWidth, 1),
      lactateKmMmol,
      bloodLagSeconds,
      distributionVolumeLitres: round(distributionVolumeLitres, 1),
      lt1Load: round(lt1Load, 1),
      lt2Load: round(lt2Load, 1),
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
    productionMmolLMin: round(production),
    oxidationCapacityMmolLMin: round(oxidationCapacity),
    oxidationMmolLMin: round(oxidation),
    netMmolLMin: round(net),
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
  let metabolicLactate = Math.max(model.input.baselineLactateMmol, initialLactateMmol);
  let bloodLactate = metabolicLactate;
  let timeSeconds = 0;
  const points: LactateSimulationPoint[] = [];

  segments.forEach(segment => {
    const steps = Math.max(1, Math.ceil(segment.durationSeconds / stepSeconds));
    for (let step = 0; step < steps; step += 1) {
      const elapsed = Math.min(stepSeconds, segment.durationSeconds - step * stepSeconds);
      if (elapsed <= 0) continue;
      const flux = lactateFluxAt(model, segment.load, metabolicLactate);
      metabolicLactate = Math.max(model.input.baselineLactateMmol, metabolicLactate + flux.netMmolLMin * elapsed / 60);
      const bloodResponse = 1 - Math.exp(-elapsed / model.parameters.bloodLagSeconds);
      bloodLactate += (metabolicLactate - bloodLactate) * bloodResponse;
      timeSeconds += elapsed;
      points.push({
        timeSeconds,
        label: segment.label,
        load: round(segment.load, 1),
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

/**
 * Estimates the highest load with <=1 mmol/L blood-lactate drift from minute 10
 * to minute 30. This mirrors the operational MLSS confirmation criterion, but
 * remains a model estimate until constant-load trials confirm it.
 */
export function estimateMLSS(model: LactateDynamicsModel, resolution = 101): EstimatedMLSSResult {
  let best: EstimatedMLSSResult | null = null;
  const startLoad = model.input.maxLoad * 0.35;
  const endLoad = model.input.maxLoad * 0.98;
  const count = Math.max(20, resolution);

  for (let index = 0; index < count; index += 1) {
    const load = startLoad + (endLoad - startLoad) * index / (count - 1);
    const simulation = simulateLactateProtocol(model, [{ label: 'MLSS', load, durationSeconds: 30 * 60 }], model.input.baselineLactateMmol, 10);
    const at10 = simulation.find(point => point.timeSeconds >= 10 * 60);
    const at30 = simulation[simulation.length - 1];
    if (!at10 || !at30) continue;
    const drift = at30.bloodLactateMmol - at10.bloodLactateMmol;
    if (drift <= 1 && at30.bloodLactateMmol <= 25) {
      const flux = lactateFluxAt(model, load, at30.metabolicLactateMmol);
      best = {
        load: round(load, 1),
        lactateMmol: round(at30.bloodLactateMmol, 2),
        drift10To30Mmol: round(drift, 2),
        productionMmolLMin: flux.productionMmolLMin,
        oxidationMmolLMin: flux.oxidationMmolLMin,
        confidence: model.parameters.inferredThresholds ? 'low' : 'moderate',
      };
    }
  }

  if (best) return best;
  return {
    load: round(startLoad, 1),
    lactateMmol: model.input.baselineLactateMmol,
    drift10To30Mmol: 0,
    productionMmolLMin: 0,
    oxidationMmolLMin: 0,
    confidence: 'low',
  };
}

export function evaluateConstantLoadTrials(trials: ConstantLoadLactateTrial[]): MeasuredMLSSResult {
  const evaluated = trials
    .filter(trial => trial.load > 0 && [trial.lactate10Mmol, trial.lactate20Mmol, trial.lactate30Mmol].every(value => value >= 0.3 && value <= 25))
    .map(trial => {
      const drift = trial.lactate30Mmol - trial.lactate10Mmol;
      return { ...trial, drift10To30Mmol: round(drift, 2), stable: drift <= 1 };
    })
    .sort((a, b) => a.load - b.load);
  const stable = evaluated.filter(trial => trial.stable);
  if (!stable.length) return { load: null, lactateMmol: null, status: 'not_found', trials: evaluated };
  const highestStable = stable[stable.length - 1];
  const higherUnstable = evaluated.some(trial => trial.load > highestStable.load && !trial.stable);
  return {
    load: highestStable.load,
    lactateMmol: highestStable.lactate30Mmol,
    status: higherUnstable ? 'confirmed' : 'lower_bound',
    trials: evaluated,
  };
}

function interpolateSample(samples: Array<{ load: number; value: number }>, load: number): number | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a.load - b.load);
  if (load <= sorted[0].load) return sorted[0].value;
  if (load >= sorted[sorted.length - 1].load) return sorted[sorted.length - 1].value;
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
  return { slope: Math.max(0, slope), intercept: Math.max(0, meanY - slope * meanX) };
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
): MetabolicDemandCurve {
  const validVo2 = samples.flatMap(sample => sample.vo2MlKgMin != null && sample.vo2MlKgMin > 0
    ? [{ load: sample.load, vo2: sample.vo2MlKgMin }]
    : []);
  const submaximal = validVo2.filter(sample => sample.vo2 <= model.input.vo2maxMlKgMin * 0.9);
  const regression = linearRegression(submaximal.length >= 2 ? submaximal : validVo2);
  const demandSource = regression ? 'measured_regression' as const : 'inferred' as const;
  const fallbackIntercept = 3.5;
  const fallbackSlope = (model.input.vo2maxMlKgMin - fallbackIntercept) / Math.max(1, model.input.maxLoad * 0.9);
  const vo2Samples = validVo2.map(sample => ({ load: sample.load, value: sample.vo2 }));
  const rerSamples = samples.flatMap(sample => {
    if (!(sample.vo2MlKgMin && sample.vco2MlKgMin) || sample.vo2MlKgMin <= 0 || sample.vco2MlKgMin <= 0) return [];
    const rer = sample.vco2MlKgMin / sample.vo2MlKgMin;
    return rer >= 0.65 && rer <= 1.15 ? [{ load: sample.load, value: rer }] : [];
  });
  const kineticsFraction = clamp(1 - Math.exp(-Math.max(1, effortDurationSeconds) / Math.max(10, vo2TimeConstantSeconds)), 0, 1);

  const points = Array.from({ length: Math.max(2, pointCount) }, (_, index): MetabolicDemandPoint => {
    const load = model.input.maxLoad * index / (Math.max(2, pointCount) - 1);
    const oxygenDemand = Math.max(0, (regression?.intercept ?? fallbackIntercept) + (regression?.slope ?? fallbackSlope) * load);
    const interpolatedVo2 = interpolateSample(vo2Samples, load);
    const steadyVo2 = Math.min(model.input.vo2maxMlKgMin, interpolatedVo2 ?? oxygenDemand);
    const actualVo2 = Math.min(oxygenDemand, steadyVo2 * kineticsFraction);
    const oxygenDeficit = Math.max(0, oxygenDemand - actualVo2);
    const production = lactateFluxAt(model, load, model.input.baselineLactateMmol + 3).productionMmolLMin;
    const glycolyticCapacity = production * 3;
    const anaerobic = Math.min(oxygenDeficit, glycolyticCapacity);
    const unmet = Math.max(0, oxygenDeficit - anaerobic);
    const total = Math.max(0.001, oxygenDemand);
    const measuredRer = interpolateSample(rerSamples, load);
    const rer = clamp(measuredRer ?? (0.7 + 0.3 * load / Math.max(1, model.input.maxLoad)), 0.7, 1);
    const aerobicCarbFraction = clamp((rer - 0.7) / 0.3, 0, 1);
    const fatEquivalent = actualVo2 * (1 - aerobicCarbFraction);
    const carbohydrateEquivalent = actualVo2 * aerobicCarbFraction + anaerobic;
    const substrateTotal = Math.max(0.001, fatEquivalent + carbohydrateEquivalent);
    return {
      load: round(load, 1),
      oxygenDemandMlKgMin: round(oxygenDemand, 1),
      actualVo2MlKgMin: round(actualVo2, 1),
      oxygenDeficitMlKgMin: round(oxygenDeficit, 1),
      aerobicPercent: round(actualVo2 / total * 100, 1),
      anaerobicPercent: round(anaerobic / total * 100, 1),
      unmetPercent: round(unmet / total * 100, 1),
      fatPercent: round(fatEquivalent / substrateTotal * 100, 1),
      carbohydratePercent: round(carbohydrateEquivalent / substrateTotal * 100, 1),
      rer: round(rer, 2),
      rerSource: measuredRer == null ? 'estimated' : 'measured',
    };
  });

  return { points, demandSource, vo2TimeConstantSeconds };
}
