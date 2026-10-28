import {
  createLactateDynamicsModel,
  lactateFluxAt,
  type LactateDynamicsInput,
  type LactateDynamicsModel,
} from './lactateDynamics';

export interface PhysiologicalScenarioTargets {
  bodyMassKg: number;
  absoluteVo2maxLMin: number;
  vlamaxMmolLSecond: number;
  /** Positive values mean lower oxygen cost at a fixed external load. */
  economyImprovementPercent?: number;
}

export interface PhysiologicalScenarioResult {
  baselineModel: LactateDynamicsModel;
  scenarioModel: LactateDynamicsModel;
  baselineAbsoluteVo2maxLMin: number;
  scenarioAbsoluteVo2maxLMin: number;
  baselineRelativeVo2maxMlKgMin: number;
  scenarioRelativeVo2maxMlKgMin: number;
  baselineDistributionVolumeLitres: number;
  scenarioDistributionVolumeLitres: number;
  economyLoadFactor: number;
}

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

/**
 * Builds a sensitivity scenario from the existing one-compartment model.
 * It keeps the measured baseline production exponent and scales production,
 * oxidation, distribution volume and external load capacity transparently.
 */
export function buildPhysiologicalScenario(
  baseline: LactateDynamicsInput,
  targets: PhysiologicalScenarioTargets,
): PhysiologicalScenarioResult | null {
  const baseMass = baseline.bodyMassKg;
  const targetMass = targets.bodyMassKg;
  const baseAbsoluteVo2 = baseline.vo2maxMlKgMin * baseMass / 1000;
  const targetAbsoluteVo2 = targets.absoluteVo2maxLMin;
  const economyChange = targets.economyImprovementPercent ?? 0;

  if (
    !(baseMass > 0) || !(targetMass > 0) || !(baseAbsoluteVo2 > 0) ||
    !(targetAbsoluteVo2 > 0) || !(targets.vlamaxMmolLSecond > 0) ||
    !(baseline.vlamaxMmolLSecond > 0) || !Number.isFinite(economyChange) ||
    economyChange <= -50 || economyChange > 50
  ) return null;

  const baselineModel = createLactateDynamicsModel(baseline);
  const scenarioRelativeVo2 = targetAbsoluteVo2 * 1000 / targetMass;
  const distributionPerKg = baseline.distributionVolumeLPerKg;
  const targetDistributionVolume = targetMass * distributionPerKg;
  const economyLoadFactor = 1 + economyChange / 100;
  const scenarioInput: LactateDynamicsInput = {
    ...baseline,
    bodyMassKg: targetMass,
    vo2maxMlKgMin: scenarioRelativeVo2,
    vlamaxMmolLSecond: targets.vlamaxMmolLSecond,
    maxLoad: baseline.maxLoad * economyLoadFactor,
    lt1Load: baselineModel.parameters.lt1Load * economyLoadFactor,
    lt2Load: baselineModel.parameters.lt2Load * economyLoadFactor,
  };

  const absoluteVo2Ratio = targetAbsoluteVo2 / baseAbsoluteVo2;
  const distributionRatio = baselineModel.parameters.distributionVolumeLitres / targetDistributionVolume;
  const productionRatio = targets.vlamaxMmolLSecond / baseline.vlamaxMmolLSecond;
  const scenarioModel: LactateDynamicsModel = {
    input: scenarioInput,
    issues: [...baselineModel.issues],
    parameters: {
      ...baselineModel.parameters,
      maxProductionMmolLMin: round(baselineModel.parameters.maxProductionMmolLMin * productionRatio),
      maxOxidationMmolLMin: round(baselineModel.parameters.maxOxidationMmolLMin * absoluteVo2Ratio * distributionRatio),
      distributionVolumeLitres: round(targetDistributionVolume, 1),
      oxidationPeakLoad: round(baselineModel.parameters.oxidationPeakLoad * economyLoadFactor, 1),
      oxidationWidth: round(baselineModel.parameters.oxidationWidth * economyLoadFactor, 1),
      lt1Load: round(baselineModel.parameters.lt1Load * economyLoadFactor, 1),
      lt2Load: round(baselineModel.parameters.lt2Load * economyLoadFactor, 1),
    },
  };

  return {
    baselineModel,
    scenarioModel,
    baselineAbsoluteVo2maxLMin: round(baseAbsoluteVo2, 2),
    scenarioAbsoluteVo2maxLMin: round(targetAbsoluteVo2, 2),
    baselineRelativeVo2maxMlKgMin: round(baseline.vo2maxMlKgMin, 1),
    scenarioRelativeVo2maxMlKgMin: round(scenarioRelativeVo2, 1),
    baselineDistributionVolumeLitres: baselineModel.parameters.distributionVolumeLitres,
    scenarioDistributionVolumeLitres: round(targetDistributionVolume, 1),
    economyLoadFactor: round(economyLoadFactor, 3),
  };
}

/** Load where net flux changes from clearance to accumulation at a chosen lactate. */
export function findLactateBalanceLoad(
  model: LactateDynamicsModel,
  lactateMmol: number,
  pointCount = 200,
): number | null {
  if (!(lactateMmol >= model.input.baselineLactateMmol) || pointCount < 2) return null;
  let previousLoad = 0;
  let previousNet = lactateFluxAt(model, previousLoad, lactateMmol).netMmolLMin;
  for (let index = 1; index <= pointCount; index += 1) {
    const load = model.input.maxLoad * index / pointCount;
    const net = lactateFluxAt(model, load, lactateMmol).netMmolLMin;
    if (previousNet <= 0 && net >= 0) {
      const fraction = previousNet === net ? 0 : -previousNet / (net - previousNet);
      return round(previousLoad + (load - previousLoad) * fraction, 1);
    }
    previousLoad = load;
    previousNet = net;
  }
  return null;
}
