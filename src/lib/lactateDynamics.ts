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
