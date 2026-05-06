import { PHANTOM_REFERENCE, PHANTOM_BODY_MASS, PHANTOM_TISSUE_MASSES, type KerrResults, type AnthropometryData } from '../types/anthropometry.types';

function getMedianValue(triple: any): number | undefined {
  if (typeof triple === 'number') return triple;
  if (typeof triple === 'object' && triple !== null && 'median' in triple) {
    const v = triple.median;
    if (v === null || v === undefined) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

const PHANTOM_BONE_HEAD = {
  mean: 56.0,
  sd: 1.44,
  tissue_mass: 1.2093,
};

const PHANTOM_BONE_BODY = {
  mean: 98.88,
  sd: 5.33,
  tissue_mass: 6.9349,
};

export function calculateSurfaceArea(bodyMass: number, stature: number, sex?: string, age?: number): number {
  let constant: number;
  if (age !== undefined && age < 12) {
    constant = 70.691;
  } else if (sex === 'female') {
    constant = 73.074;
  } else {
    constant = 68.308;
  }
  return (constant * Math.pow(bodyMass, 0.425) * Math.pow(stature, 0.725)) / 10000;
}

export function calculateSkinMass(surfaceArea: number, sex: string): number {
  const skinThickness = sex === 'male' ? 2.07 : 1.96;
  return surfaceArea * skinThickness * 1.05;
}

export function calculateAdiposeMass(
  sum6Skinfolds: number,
  stature: number,
  _bodyMass: number
): number {
  const scaledSum = sum6Skinfolds * (170.18 / stature);
  const zScore = (scaledSum - PHANTOM_REFERENCE.adipose.mean) / PHANTOM_REFERENCE.adipose.sd;
  const heightRatio = 170.18 / stature;
  return ((zScore * 5.85) + 25.6) / Math.pow(heightRatio, 3);
}

export function calculateMuscleMass(
  armRelaxedGirth: number,
  thighMaxGirth: number,
  calfMaxGirth: number,
  chestGirth: number,
  forearmGirth: number,
  tricepsSF: number,
  frontThighSF: number,
  medialCalfSF: number,
  subscapularSF: number,
  stature: number,
  _bodyMass?: number
): number {
  const PI = Math.PI;
  const armCorr = armRelaxedGirth - (tricepsSF * PI / 10);
  const thighCorr = thighMaxGirth - (frontThighSF * PI / 10);
  const calfCorr = calfMaxGirth - (medialCalfSF * PI / 10);
  const chestCorr = chestGirth - (subscapularSF * PI / 10);
  const sumGirthsCorr = armCorr + thighCorr + calfCorr + chestCorr + forearmGirth;
  const scaledSum = sumGirthsCorr * (170.18 / stature);
  const zScore = (scaledSum - PHANTOM_REFERENCE.muscle.mean) / PHANTOM_REFERENCE.muscle.sd;
  const heightRatio = 170.18 / stature;
  return ((zScore * 5.4) + 24.5) / Math.pow(heightRatio, 3);
}

export function calculateMuscleMassNoChest(
  armRelaxedGirth: number,
  thighMaxGirth: number,
  calfMaxGirth: number,
  forearmGirth: number,
  tricepsSF: number,
  frontThighSF: number,
  medialCalfSF: number,
  stature: number,
  _bodyMass?: number
): number {
  const PI = Math.PI;
  const armCorr = armRelaxedGirth - (tricepsSF * PI / 10);
  const thighCorr = thighMaxGirth - (frontThighSF * PI / 10);
  const calfCorr = calfMaxGirth - (medialCalfSF * PI / 10);
  const sumGirthsCorr = armCorr + thighCorr + calfCorr + forearmGirth;
  const scaledSum = sumGirthsCorr * (170.18 / stature);
  const zScore = (scaledSum - PHANTOM_REFERENCE.muscle.mean) / PHANTOM_REFERENCE.muscle.sd;
  const heightRatio = 170.18 / stature;
  return ((zScore * 5.4) + 24.5) / Math.pow(heightRatio, 3);
}

export function calculateResidualMass(
  chestTransverse: number,
  chestAP: number,
  waist: number,
  stature: number,
  bodyMass: number,
  sittingHeight?: number
): number {
  const estimatedSittingHeight = sittingHeight || (stature * 0.52);
  const sumTorso = chestTransverse + chestAP + waist;
  const scaledSum = sumTorso * (89.92 / estimatedSittingHeight);
  return bodyMass * (PHANTOM_TISSUE_MASSES.residual / PHANTOM_BODY_MASS) * (scaledSum / PHANTOM_REFERENCE.residual.mean);
}

export function calculateBoneMassHead(
  headGirth: number,
  _bodyMass?: number
): number {
  const zScore = (headGirth - PHANTOM_BONE_HEAD.mean) / PHANTOM_BONE_HEAD.sd;
  return (zScore * 0.18) + 1.2;
}

export function calculateBoneMassBody(
  stature: number,
  humerusDiameter: number,
  femurDiameter: number,
  biacromialBreadth: number,
  biiliocristalBreadth: number,
  _bodyMass?: number
): number {
  const sumBreadths = biacromialBreadth + biiliocristalBreadth + (humerusDiameter * 2) + (femurDiameter * 2);
  const heightRatio = 170.18 / stature;
  const scaledSum = sumBreadths * heightRatio;
  const zScore = (scaledSum - PHANTOM_BONE_BODY.mean) / PHANTOM_BONE_BODY.sd;
  return ((zScore * 1.34) + 6.7) / Math.pow(heightRatio, 3);
}

export function calculateBoneMass(
  stature: number,
  humerusDiameter: number,
  femurDiameter: number,
  biacromialBreadth: number,
  biiliocristalBreadth: number,
  bodyMass: number,
  headGirth?: number
): number {
  const boneBody = calculateBoneMassBody(stature, humerusDiameter, femurDiameter, biacromialBreadth, biiliocristalBreadth, bodyMass);
  if (headGirth) {
    const boneHead = calculateBoneMassHead(headGirth, bodyMass);
    return boneHead + boneBody;
  }
  return boneBody;
}

export function calculateZScore(value: number, phantomMean: number, phantomSD: number): number {
  return (value - phantomMean) / phantomSD;
}

export function calculateBoneMassHeadZScore(headGirth: number): number {
  return calculateZScore(headGirth, PHANTOM_BONE_HEAD.mean, PHANTOM_BONE_HEAD.sd);
}

export function calculateBoneMassBodyZScore(stature: number, sumBreadths: number): number {
  const scaledSum = sumBreadths * (170.18 / stature);
  return calculateZScore(scaledSum, PHANTOM_BONE_BODY.mean, PHANTOM_BONE_BODY.sd);
}

export function calculateZScores(scaledSums: {
  adiposeScaled: number;
  muscleScaled: number;
  residualScaled: number;
  boneScaled: number;
}): {
  adiposeZScore: number;
  muscleZScore: number;
  residualZScore: number;
  boneZScore: number;
} {
  return {
    adiposeZScore: calculateZScore(scaledSums.adiposeScaled, PHANTOM_REFERENCE.adipose.mean, PHANTOM_REFERENCE.adipose.sd),
    muscleZScore: calculateZScore(scaledSums.muscleScaled, PHANTOM_REFERENCE.muscle.mean, PHANTOM_REFERENCE.muscle.sd),
    residualZScore: calculateZScore(scaledSums.residualScaled, PHANTOM_REFERENCE.residual.mean, PHANTOM_REFERENCE.residual.sd),
    boneZScore: calculateZScore(scaledSums.boneScaled, PHANTOM_BONE_BODY.mean, PHANTOM_BONE_BODY.sd),
  };
}

export function calculateBMI(bodyMass: number, stature: number): number {
  const statureM = stature / 100;
  return bodyMass / (statureM * statureM);
}

export function calculateMuscleBoneRatio(muscleMass: number, boneMass: number): number {
  return boneMass > 0 ? muscleMass / boneMass : 0;
}

export function calculateAdiposeMuscleRatio(adiposeMass: number, muscleMass: number): number {
  return muscleMass > 0 ? adiposeMass / muscleMass : 0;
}

export function calculateBallastIndex(boneMass: number, muscleMass: number, bodyMass: number): number {
  return bodyMass > 0 ? ((boneMass + muscleMass) / bodyMass) * 100 : 0;
}

function calculateCrossSection(correctedGirth: number): number {
  return Math.pow(correctedGirth / (2 * Math.PI), 2) * Math.PI;
}

function calculateAdiposeCrossSection(totalGirth: number, correctedGirth: number): number {
  const totalArea = Math.pow(totalGirth / (2 * Math.PI), 2) * Math.PI;
  const muscleArea = calculateCrossSection(correctedGirth);
  return totalArea - muscleArea;
}

export function calculateSomatotype(
  bodyMass: number,
  stature: number,
  tricepsSF: number,
  subscapularSF: number,
  supraspinaleSF: number,
  medialCalfSF: number,
  armFlexedGirth: number,
  calfMaxGirth: number,
  humerusDiameter: number,
  femurDiameter: number
): { endomorphy: number; mesomorphy: number; ectomorphy: number } {
  const heightCorrectionFactor = 170.18 / stature;
  const sum3SF = (tricepsSF + subscapularSF + supraspinaleSF) * heightCorrectionFactor;

  const endomorphy = -0.7182 + 0.1451 * sum3SF
    - 0.00068 * Math.pow(sum3SF, 2)
    + 0.0000014 * Math.pow(sum3SF, 3);

  const armCorrMeso = armFlexedGirth - (tricepsSF * Math.PI / 10);
  const calfCorrMeso = calfMaxGirth - (medialCalfSF * Math.PI / 10);

  const mesomorphy = 0.858 * humerusDiameter
    + 0.601 * femurDiameter
    + 0.188 * armCorrMeso
    + 0.161 * calfCorrMeso
    - 0.131 * stature
    + 4.5;

  const HWR = stature / Math.pow(bodyMass, 1 / 3);
  let ectomorphy: number;
  if (HWR >= 40.75) {
    ectomorphy = 0.732 * HWR - 28.58;
  } else if (HWR > 38.25) {
    ectomorphy = 0.463 * HWR - 17.63;
  } else {
    ectomorphy = 0.1;
  }

  return {
    endomorphy: Math.max(0.1, endomorphy),
    mesomorphy: Math.max(0.1, mesomorphy),
    ectomorphy: Math.max(0.1, ectomorphy),
  };
}

export interface FullKerrResults {
  skinMass: number;
  skinMassPct: number;
  skinMassZScore: number;
  skinMassAdjustment: number;
  skinMassAdjusted: number;

  adiposeMass: number;
  adiposeMassPct: number;
  adiposeMassZScore: number;
  adiposeMassAdjustment: number;
  adiposeMassAdjusted: number;

  muscleMass: number;
  muscleMassPct: number;
  muscleMassZScore: number;
  muscleMassAdjustment: number;
  muscleMassAdjusted: number;

  muscleMassNoChest: number;
  muscleMassNoChestPct: number;
  muscleMassNoChestAdjustment: number;
  muscleMassNoChestAdjusted: number;

  residualMass: number;
  residualMassPct: number;
  residualMassZScore: number;
  residualMassAdjustment: number;
  residualMassAdjusted: number;

  boneMassHead: number;
  boneMassHeadPct: number;
  boneMassHeadZScore: number;
  boneMassHeadAdjustment: number;
  boneMassHeadAdjusted: number;

  boneMassBody: number;
  boneMassBodyPct: number;
  boneMassBodyZScore: number;
  boneMassBodyAdjustment: number;
  boneMassBodyAdjusted: number;

  boneMass: number;
  boneMassPct: number;
  boneMassZScore: number;
  boneMassAdjustment: number;
  boneMassAdjusted: number;

  structuredWeight: number;
  structuredWeightDiff: number;
  structuredWeightDiffPct: number;
  technicianErrorPct: number;

  skinMassReadjusted: number;
  adiposeMassReadjusted: number;
  muscleMassReadjusted: number;
  residualMassReadjusted: number;
  boneMassReadjusted: number;

  skinMassReadjustedPct: number;
  adiposeMassReadjustedPct: number;
  muscleMassReadjustedPct: number;
  residualMassReadjustedPct: number;
  boneMassReadjustedPct: number;

  indexAdipose: number;
  indexMuscle: number;
  indexResidual: number;
  indexBone: number;
  indexSkin: number;
  indexMuscleBone: number;
  indexMuscleBallast: number;
  indexBallast: number;

  crossSectionArmMuscle: number;
  crossSectionArmAdipose: number;
  crossSectionThighMuscle: number;
  crossSectionThighAdipose: number;
  crossSectionCalfMuscle: number;
  crossSectionCalfAdipose: number;

  sumCorrectedGirths: number;
  sumCorrectedGirthsNoChest: number;
  sum6Skinfolds: number;
  sumDiameters: number;

  surfaceArea: number;
  bmi: number;
  muscleBoneRatio: number;
  adiposeMuscleRatio: number;
  ballastIndex: number;

  somatotype: { endomorphy: number; mesomorphy: number; ectomorphy: number };

  zScores: {
    adiposeZScore: number;
    muscleZScore: number;
    residualZScore: number;
    boneZScore: number;
  };
}

export function calculateKerrResults(data: AnthropometryData, technicianErrorPct: number = 2.0): FullKerrResults | null {
  const bodyMass = getMedianValue(data.body_mass_kg);
  const stature = getMedianValue(data.stature_cm);
  const age = data.age_years;
  const sex = data.sex;

  if (!bodyMass || !stature || !age || !sex) return null;

  const tricepsSF = getMedianValue(data.triceps_sf_mm);
  const subscapularSF = getMedianValue(data.subscapular_sf_mm);
  const supraspinaleSF = getMedianValue(data.supraspinale_sf_mm);
  const abdominalSF = getMedianValue(data.abdominal_sf_mm);
  const frontThighSF = getMedianValue(data.front_thigh_sf_mm);
  const medialCalfSF = getMedianValue(data.medial_calf_sf_mm);

  if (!tricepsSF || !subscapularSF || !supraspinaleSF || !abdominalSF || !frontThighSF || !medialCalfSF) {
    return null;
  }

  const sum6Skinfolds = tricepsSF + subscapularSF + supraspinaleSF + abdominalSF + frontThighSF + medialCalfSF;

  const armRelaxedGirth = getMedianValue(data.arm_relaxed_girth_cm);
  const armFlexedGirth = getMedianValue(data.arm_flexed_girth_cm);
  const thighMaxGirth = getMedianValue(data.thigh_upper_girth_cm);
  const thighMidGirth = getMedianValue(data.thigh_mid_girth_cm);
  const calfMaxGirth = getMedianValue(data.calf_max_girth_cm);
  const chestGirth = getMedianValue(data.chest_girth_cm);
  const forearmGirth = getMedianValue(data.forearm_girth_cm);
  const waistGirth = getMedianValue(data.waist_girth_cm);
  const headGirth = getMedianValue(data.head_girth_cm);

  const thighGirthForMuscle = thighMaxGirth || thighMidGirth;

  if (!armRelaxedGirth || !armFlexedGirth || !thighGirthForMuscle || !calfMaxGirth || !chestGirth) {
    return null;
  }

  const chestTransverse = getMedianValue(data.transverse_chest_diameter_cm);
  const chestAP = getMedianValue(data.ap_chest_diameter_cm);
  const biacromialBreadth = getMedianValue(data.biacromial_breadth_cm);
  const biiliocristalBreadth = getMedianValue(data.biiliocristal_breadth_cm);
  const humerusDiameter = getMedianValue(data.humerus_diameter_cm);
  const femurDiameter = getMedianValue(data.femur_diameter_cm);
  const sittingHeight = getMedianValue(data.sitting_height_cm);

  const forearmGirthVal = forearmGirth || stature * 0.14;
  const chestTransverseVal = chestTransverse || stature * 0.17;
  const chestAPVal = chestAP || stature * 0.11;
  const waistGirthRaw = waistGirth || stature * 0.45;
  const humerusDiameterVal = humerusDiameter || stature * 0.04;
  const femurDiameterVal = femurDiameter || stature * 0.06;
  const biacromialBreadthVal = biacromialBreadth || stature * 0.23;
  const biiliocristalBreadthVal = biiliocristalBreadth || stature * 0.18;
  const estimatedSittingHeight = sittingHeight || (stature * 0.52);

  const PI_val = Math.PI;
  const waistGirthVal = waistGirthRaw - (abdominalSF * PI_val / 10);
  const armCorr = armRelaxedGirth - (tricepsSF * PI_val / 10);
  const thighCorr = thighGirthForMuscle - (frontThighSF * PI_val / 10);
  const calfCorr = calfMaxGirth - (medialCalfSF * PI_val / 10);
  const chestCorr = chestGirth - (subscapularSF * PI_val / 10);

  const sumCorrectedGirths = armCorr + thighCorr + calfCorr + chestCorr + forearmGirthVal;
  const sumCorrectedGirthsNoChest = armCorr + thighCorr + calfCorr + forearmGirthVal;

  const adiposeScaled = sum6Skinfolds * (170.18 / stature);
  const muscleScaled = sumCorrectedGirths * (170.18 / stature);
  const muscleScaledNoChest = sumCorrectedGirthsNoChest * (170.18 / stature);
  const residualScaled = (chestTransverseVal + chestAPVal + waistGirthVal) * (89.92 / estimatedSittingHeight);
  const sumDiameters = biacromialBreadthVal + biiliocristalBreadthVal + (humerusDiameterVal * 2) + (femurDiameterVal * 2);
  const boneBodyScaled = sumDiameters * (170.18 / stature);

  const surfaceArea = calculateSurfaceArea(bodyMass, stature, sex, age);

  const skinMass = calculateSkinMass(surfaceArea, sex);
  const adiposeZScoreRaw = (adiposeScaled - PHANTOM_REFERENCE.adipose.mean) / PHANTOM_REFERENCE.adipose.sd;
  const heightRatio = 170.18 / stature;
  const adiposeMass = ((adiposeZScoreRaw * 5.85) + 25.6) / Math.pow(heightRatio, 3);
  const muscleZScoreRaw = (muscleScaled - PHANTOM_REFERENCE.muscle.mean) / PHANTOM_REFERENCE.muscle.sd;
  const muscleMass = ((muscleZScoreRaw * 5.4) + 24.5) / Math.pow(heightRatio, 3);
  const muscleZScoreRawNoChest = (muscleScaledNoChest - PHANTOM_REFERENCE.muscle.mean) / PHANTOM_REFERENCE.muscle.sd;
  const muscleMassNoChest = ((muscleZScoreRawNoChest * 5.4) + 24.5) / Math.pow(heightRatio, 3);
  const residualZScoreRaw = (residualScaled - PHANTOM_REFERENCE.residual.mean) / PHANTOM_REFERENCE.residual.sd;
  const sittingHeightRatio = 89.92 / estimatedSittingHeight;
  const residualMass = ((residualZScoreRaw * 1.24) + 6.1) / Math.pow(sittingHeightRatio, 3);
  const boneMassBodyZScoreRaw = (boneBodyScaled - PHANTOM_BONE_BODY.mean) / PHANTOM_BONE_BODY.sd;
  const boneMassBody = ((boneMassBodyZScoreRaw * 1.34) + 6.7) / Math.pow(heightRatio, 3);
  const boneMassHead = headGirth
    ? (() => { const z = (headGirth - PHANTOM_BONE_HEAD.mean) / PHANTOM_BONE_HEAD.sd; return (z * 0.18) + 1.2; })()
    : 0;
  const boneMass = boneMassHead + boneMassBody;

  const structuredWeight = skinMass + adiposeMass + muscleMass + residualMass + boneMass;
  const structuredWeightDiff = structuredWeight - bodyMass;
  const structuredWeightDiffPct = bodyMass > 0 ? (structuredWeightDiff / bodyMass) * 100 : 0;

  const skinMassPctOfStructured = structuredWeight > 0 ? skinMass / structuredWeight : 0;
  const adiposeMassPctOfStructured = structuredWeight > 0 ? adiposeMass / structuredWeight : 0;
  const muscleMassPctOfStructured = structuredWeight > 0 ? muscleMass / structuredWeight : 0;
  const muscleMassNoChestPctOfStructured = structuredWeight > 0 ? muscleMassNoChest / structuredWeight : 0;
  const residualMassPctOfStructured = structuredWeight > 0 ? residualMass / structuredWeight : 0;
  const boneMassHeadPctOfStructured = structuredWeight > 0 ? boneMassHead / structuredWeight : 0;
  const boneMassBodyPctOfStructured = structuredWeight > 0 ? boneMassBody / structuredWeight : 0;
  const boneMassPctOfStructured = structuredWeight > 0 ? boneMass / structuredWeight : 0;

  const skinMassAdjustment = structuredWeightDiff * skinMassPctOfStructured;
  const adiposeMassAdjustment = structuredWeightDiff * adiposeMassPctOfStructured;
  const muscleMassAdjustment = structuredWeightDiff * muscleMassPctOfStructured;
  const muscleMassNoChestAdjustment = structuredWeightDiff * muscleMassNoChestPctOfStructured;
  const residualMassAdjustment = structuredWeightDiff * residualMassPctOfStructured;
  const boneMassHeadAdjustment = structuredWeightDiff * boneMassHeadPctOfStructured;
  const boneMassBodyAdjustment = structuredWeightDiff * boneMassBodyPctOfStructured;
  const boneMassAdjustment = structuredWeightDiff * boneMassPctOfStructured;

  const skinMassAdjusted = skinMass - skinMassAdjustment;
  const adiposeMassAdjusted = adiposeMass - adiposeMassAdjustment;
  const muscleMassAdjusted = muscleMass - muscleMassAdjustment;
  const muscleMassNoChestAdjusted = muscleMassNoChest - muscleMassNoChestAdjustment;
  const residualMassAdjusted = residualMass - residualMassAdjustment;
  const boneMassHeadAdjusted = boneMassHead - boneMassHeadAdjustment;
  const boneMassBodyAdjusted = boneMassBody - boneMassBodyAdjustment;
  const boneMassAdjusted = boneMass - boneMassAdjustment;

  const skinMassPct = bodyMass > 0 ? (skinMass / bodyMass) * 100 : 0;
  const adiposeMassPct = bodyMass > 0 ? (adiposeMass / bodyMass) * 100 : 0;
  const muscleMassPct = bodyMass > 0 ? (muscleMass / bodyMass) * 100 : 0;
  const muscleMassNoChestPct = bodyMass > 0 ? (muscleMassNoChest / bodyMass) * 100 : 0;
  const residualMassPct = bodyMass > 0 ? (residualMass / bodyMass) * 100 : 0;
  const boneMassHeadPct = bodyMass > 0 ? (boneMassHead / bodyMass) * 100 : 0;
  const boneMassBodyPct = bodyMass > 0 ? (boneMassBody / bodyMass) * 100 : 0;
  const boneMassPct = bodyMass > 0 ? (boneMass / bodyMass) * 100 : 0;

  const sumNonAdipose = muscleMassAdjusted + residualMassAdjusted + skinMassAdjusted + boneMassAdjusted;
  const nonAdiposeReadjustFactor = sumNonAdipose > 0 ? (bodyMass - adiposeMassAdjusted) / sumNonAdipose : 1;

  const muscleMassReadjusted = muscleMassAdjusted * nonAdiposeReadjustFactor;
  const residualMassReadjusted = residualMassAdjusted * nonAdiposeReadjustFactor;
  const skinMassReadjusted = skinMassAdjusted * nonAdiposeReadjustFactor;
  const boneMassReadjusted = boneMassAdjusted * nonAdiposeReadjustFactor;
  const adiposeMassReadjusted = bodyMass - muscleMassReadjusted - residualMassReadjusted - skinMassReadjusted - boneMassReadjusted;

  const adiposeMassReadjustedPct = bodyMass > 0 ? (adiposeMassReadjusted / bodyMass) * 100 : 0;
  const muscleMassReadjustedPct = bodyMass > 0 ? (muscleMassReadjusted / bodyMass) * 100 : 0;
  const residualMassReadjustedPct = bodyMass > 0 ? (residualMassReadjusted / bodyMass) * 100 : 0;
  const skinMassReadjustedPct = bodyMass > 0 ? (skinMassReadjusted / bodyMass) * 100 : 0;
  const boneMassReadjustedPct = bodyMass > 0 ? (boneMassReadjusted / bodyMass) * 100 : 0;

  const statureM = stature / 100;
  const indexAdipose = adiposeMassReadjusted / (statureM * statureM);
  const indexMuscle = muscleMassReadjusted / (statureM * statureM);
  const indexResidual = residualMassReadjusted / (statureM * statureM);
  const indexBone = boneMassReadjusted / (statureM * statureM);
  const indexSkin = skinMassReadjusted / (statureM * statureM);
  const indexMuscleBone = boneMass > 0 ? muscleMassReadjusted / boneMassReadjusted : 0;
  const ballastMass = adiposeMassReadjusted + residualMassReadjusted + skinMassReadjusted;
  const indexMuscleBallast = ballastMass > 0 ? muscleMassReadjusted / ballastMass : 0;
  const indexBallast = muscleMassReadjusted > 0 ? ballastMass / muscleMassReadjusted : 0;

  const crossSectionArmMuscle = calculateCrossSection(armCorr);
  const crossSectionArmAdipose = calculateAdiposeCrossSection(armRelaxedGirth, armCorr);
  const crossSectionThighMuscle = calculateCrossSection(thighCorr);
  const crossSectionThighAdipose = calculateAdiposeCrossSection(thighGirthForMuscle, thighCorr);
  const crossSectionCalfMuscle = calculateCrossSection(calfCorr);
  const crossSectionCalfAdipose = calculateAdiposeCrossSection(calfMaxGirth, calfCorr);

  const adiposeZScore = calculateZScore(adiposeScaled, PHANTOM_REFERENCE.adipose.mean, PHANTOM_REFERENCE.adipose.sd);
  const muscleZScore = calculateZScore(muscleScaled, PHANTOM_REFERENCE.muscle.mean, PHANTOM_REFERENCE.muscle.sd);
  const residualZScore = calculateZScore(residualScaled, PHANTOM_REFERENCE.residual.mean, PHANTOM_REFERENCE.residual.sd);
  const boneBodyZScore = boneMassBodyZScoreRaw;
  const boneHeadZScore = headGirth ? calculateZScore(headGirth, PHANTOM_BONE_HEAD.mean, PHANTOM_BONE_HEAD.sd) : 0;
  const boneZScore = boneBodyZScore;

  const skinMassZScore = 0;

  const bmi = calculateBMI(bodyMass, stature);
  const muscleBoneRatio = boneMass > 0 ? muscleMass / boneMass : 0;
  const adiposeMuscleRatio = muscleMass > 0 ? adiposeMass / muscleMass : 0;
  const ballastIndex = bodyMass > 0 ? ((boneMass + muscleMass) / bodyMass) * 100 : 0;

  const somatotype = calculateSomatotype(
    bodyMass,
    stature,
    tricepsSF,
    subscapularSF,
    supraspinaleSF,
    medialCalfSF,
    armFlexedGirth,
    calfMaxGirth,
    humerusDiameterVal,
    femurDiameterVal
  );

  return {
    skinMass,
    skinMassPct,
    skinMassZScore,
    skinMassAdjustment,
    skinMassAdjusted,

    adiposeMass,
    adiposeMassPct,
    adiposeMassZScore: adiposeZScore,
    adiposeMassAdjustment,
    adiposeMassAdjusted,

    muscleMass,
    muscleMassPct,
    muscleMassZScore: muscleZScore,
    muscleMassAdjustment,
    muscleMassAdjusted,

    muscleMassNoChest,
    muscleMassNoChestPct,
    muscleMassNoChestAdjustment,
    muscleMassNoChestAdjusted,

    residualMass,
    residualMassPct,
    residualMassZScore: residualZScore,
    residualMassAdjustment,
    residualMassAdjusted,

    boneMassHead,
    boneMassHeadPct,
    boneMassHeadZScore: boneHeadZScore,
    boneMassHeadAdjustment,
    boneMassHeadAdjusted,

    boneMassBody,
    boneMassBodyPct,
    boneMassBodyZScore: boneBodyZScore,
    boneMassBodyAdjustment,
    boneMassBodyAdjusted,

    boneMass,
    boneMassPct,
    boneMassZScore: boneZScore,
    boneMassAdjustment,
    boneMassAdjusted,

    structuredWeight,
    structuredWeightDiff,
    structuredWeightDiffPct,
    technicianErrorPct,

    skinMassReadjusted,
    adiposeMassReadjusted,
    muscleMassReadjusted,
    residualMassReadjusted,
    boneMassReadjusted,

    skinMassReadjustedPct,
    adiposeMassReadjustedPct,
    muscleMassReadjustedPct,
    residualMassReadjustedPct,
    boneMassReadjustedPct,

    indexAdipose,
    indexMuscle,
    indexResidual,
    indexBone,
    indexSkin,
    indexMuscleBone,
    indexMuscleBallast,
    indexBallast,

    crossSectionArmMuscle,
    crossSectionArmAdipose,
    crossSectionThighMuscle,
    crossSectionThighAdipose,
    crossSectionCalfMuscle,
    crossSectionCalfAdipose,

    sumCorrectedGirths,
    sumCorrectedGirthsNoChest,
    sum6Skinfolds,
    sumDiameters,

    surfaceArea,
    bmi,
    muscleBoneRatio,
    adiposeMuscleRatio,
    ballastIndex,

    somatotype,
    zScores: {
      adiposeZScore,
      muscleZScore,
      residualZScore,
      boneZScore,
    },
  };
}

export function calculateBodyCompositionGoals(
  currentResults: KerrResults,
  targetBodyMass: number
): {
  targetSkinMass: number;
  targetAdiposeMass: number;
  targetMuscleMass: number;
  targetResidualMass: number;
  targetBoneMass: number;
  massChanges: {
    skin: number;
    adipose: number;
    muscle: number;
    residual: number;
    bone: number;
  };
} {
  const currentTotal = currentResults.skin_mass_kg + currentResults.adipose_mass_kg +
                       currentResults.muscle_mass_kg + currentResults.residual_mass_kg +
                       currentResults.bone_mass_kg;

  const ratio = targetBodyMass / currentTotal;

  const targetSkinMass = currentResults.skin_mass_kg * ratio;
  const targetAdiposeMass = currentResults.adipose_mass_kg * ratio;
  const targetMuscleMass = currentResults.muscle_mass_kg * ratio;
  const targetResidualMass = currentResults.residual_mass_kg * ratio;
  const targetBoneMass = currentResults.bone_mass_kg * ratio;

  return {
    targetSkinMass,
    targetAdiposeMass,
    targetMuscleMass,
    targetResidualMass,
    targetBoneMass,
    massChanges: {
      skin: targetSkinMass - currentResults.skin_mass_kg,
      adipose: targetAdiposeMass - currentResults.adipose_mass_kg,
      muscle: targetMuscleMass - currentResults.muscle_mass_kg,
      residual: targetResidualMass - currentResults.residual_mass_kg,
      bone: targetBoneMass - currentResults.bone_mass_kg,
    },
  };
}
