import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface KerrCalculationInput {
  measurementId: string;
  athleteId: string;
  bodyMass: number;
  stature: number;
  age: number;
  sex: 'male' | 'female';
  sum6Skinfolds: number;
  tricepsSF: number;
  subscapularSF: number;
  supraspinaleSF: number;
  abdominalSF: number;
  frontThighSF: number;
  medialCalfSF: number;
  armRelaxedGirth: number;
  armFlexedGirth: number;
  thighMaxGirth: number;
  calfMaxGirth: number;
  chestGirth: number;
  headGirth?: number;
  forearmGirth?: number;
  waistGirth?: number;
  transverseChestDiameter?: number;
  apChestDiameter?: number;
  sittingHeight?: number;
  biacromialBreadth?: number;
  biiliocristalBreadth?: number;
  humerusDiameter?: number;
  femurDiameter?: number;
  technicianErrorPct?: number;
}

const PHANTOM = {
  adipose: { mean: 116.41, sd: 34.79 },
  muscle: { mean: 207.21, sd: 13.74 },
  residual: { mean: 109.35, sd: 7.08 },
};

const PHANTOM_BONE_HEAD = { mean: 56.0, sd: 1.44, tissue_mass: 1.2093 };
const PHANTOM_BONE_BODY = { mean: 98.88, sd: 5.33, tissue_mass: 6.9349 };

const PHANTOM_BODY_MASS = 64.58;
const PHANTOM_TISSUE = {
  adipose: 16.14,
  muscle: 29.35,
  residual: 9.97,
};

function calculateSurfaceArea(bodyMass: number, stature: number, sex?: string, age?: number): number {
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

function calculateSkinMass(surfaceArea: number, sex: string): number {
  const skinThickness = sex === 'male' ? 2.07 : 1.96;
  return surfaceArea * skinThickness * 1.05;
}

function calculateZScore(value: number, mean: number, sd: number): number {
  return (value - mean) / sd;
}

function calculateBMI(bodyMass: number, stature: number): number {
  const sm = stature / 100;
  return bodyMass / (sm * sm);
}

function calculateCrossSection(correctedGirth: number): number {
  return Math.pow(correctedGirth / (2 * Math.PI), 2) * Math.PI;
}

function calculateAdiposeCrossSection(totalGirth: number, correctedGirth: number): number {
  const totalArea = Math.pow(totalGirth / (2 * Math.PI), 2) * Math.PI;
  return totalArea - calculateCrossSection(correctedGirth);
}

function calculateSomatotype(
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
  const hcf = 170.18 / stature;
  const sum3SF = (tricepsSF + subscapularSF + supraspinaleSF) * hcf;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const input: KerrCalculationInput = await req.json();

    const technicianErrorPct = input.technicianErrorPct ?? 2.0;

    const forearmGirthVal = input.forearmGirth || input.stature * 0.14;
    const chestTransverseVal = input.transverseChestDiameter || input.stature * 0.17;
    const chestAPVal = input.apChestDiameter || input.stature * 0.11;
    const waistGirthRaw = input.waistGirth || input.stature * 0.45;
    const humerusDiameterVal = input.humerusDiameter || input.stature * 0.04;
    const femurDiameterVal = input.femurDiameter || input.stature * 0.06;
    const biacromialVal = input.biacromialBreadth || input.stature * 0.23;
    const biiliocristalVal = input.biiliocristalBreadth || input.stature * 0.18;
    const sittingHeightVal = input.sittingHeight || (input.stature * 0.52);

    const waistGirthVal = waistGirthRaw - (input.abdominalSF * Math.PI / 10);
    const armCorr = input.armRelaxedGirth - (input.tricepsSF * Math.PI / 10);
    const thighCorr = input.thighMaxGirth - (input.frontThighSF * Math.PI / 10);
    const calfCorr = input.calfMaxGirth - (input.medialCalfSF * Math.PI / 10);
    const chestCorr = input.chestGirth - (input.subscapularSF * Math.PI / 10);

    const sumCorrectedGirths = armCorr + thighCorr + calfCorr + chestCorr + forearmGirthVal;
    const sumCorrectedGirthsNoChest = armCorr + thighCorr + calfCorr + forearmGirthVal;

    const adiposeScaled = input.sum6Skinfolds * (170.18 / input.stature);
    const muscleScaled = sumCorrectedGirths * (170.18 / input.stature);
    const muscleScaledNoChest = sumCorrectedGirthsNoChest * (170.18 / input.stature);
    const residualScaled = (chestTransverseVal + chestAPVal + waistGirthVal) * (89.92 / sittingHeightVal);
    const sumDiameters = biacromialVal + biiliocristalVal + (humerusDiameterVal * 2) + (femurDiameterVal * 2);
    const boneBodyScaled = sumDiameters * (170.18 / input.stature);

    const surfaceArea = calculateSurfaceArea(input.bodyMass, input.stature, input.sex, input.age);
    const skinMass = calculateSkinMass(surfaceArea, input.sex);
    const adiposeZScore = calculateZScore(adiposeScaled, PHANTOM.adipose.mean, PHANTOM.adipose.sd);
    const heightRatio = 170.18 / input.stature;
    const adiposeMass = ((adiposeZScore * 5.85) + 25.6) / Math.pow(heightRatio, 3);
    const muscleZScore = calculateZScore(muscleScaled, PHANTOM.muscle.mean, PHANTOM.muscle.sd);
    const muscleMass = ((muscleZScore * 5.4) + 24.5) / Math.pow(heightRatio, 3);
    const muscleZScoreNoChest = calculateZScore(muscleScaledNoChest, PHANTOM.muscle.mean, PHANTOM.muscle.sd);
    const muscleMassNoChest = ((muscleZScoreNoChest * 5.4) + 24.5) / Math.pow(heightRatio, 3);
    const residualZScoreRaw = calculateZScore(residualScaled, PHANTOM.residual.mean, PHANTOM.residual.sd);
    const sittingHeightRatio = 89.92 / sittingHeightVal;
    const residualMass = ((residualZScoreRaw * 1.24) + 6.1) / Math.pow(sittingHeightRatio, 3);
    const boneMassBodyZScore = calculateZScore(boneBodyScaled, PHANTOM_BONE_BODY.mean, PHANTOM_BONE_BODY.sd);
    const boneMassBody = ((boneMassBodyZScore * 1.34) + 6.7) / Math.pow(heightRatio, 3);
    const boneMassHead = input.headGirth
      ? (() => { const z = calculateZScore(input.headGirth, PHANTOM_BONE_HEAD.mean, PHANTOM_BONE_HEAD.sd); return (z * 0.18) + 1.2; })()
      : 0;
    const boneMass = boneMassHead + boneMassBody;

    const structuredWeight = skinMass + adiposeMass + muscleMass + residualMass + boneMass;
    const structuredWeightDiff = structuredWeight - input.bodyMass;
    const structuredWeightDiffPct = input.bodyMass > 0 ? (structuredWeightDiff / input.bodyMass) * 100 : 0;

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

    const skinMassPct = input.bodyMass > 0 ? (skinMass / input.bodyMass) * 100 : 0;
    const adiposeMassPct = input.bodyMass > 0 ? (adiposeMass / input.bodyMass) * 100 : 0;
    const muscleMassPct = input.bodyMass > 0 ? (muscleMass / input.bodyMass) * 100 : 0;
    const muscleMassNoChestPct = input.bodyMass > 0 ? (muscleMassNoChest / input.bodyMass) * 100 : 0;
    const residualMassPct = input.bodyMass > 0 ? (residualMass / input.bodyMass) * 100 : 0;
    const boneMassHeadPct = input.bodyMass > 0 ? (boneMassHead / input.bodyMass) * 100 : 0;
    const boneMassBodyPct = input.bodyMass > 0 ? (boneMassBody / input.bodyMass) * 100 : 0;
    const boneMassPct = input.bodyMass > 0 ? (boneMass / input.bodyMass) * 100 : 0;

    const sumNonAdipose = muscleMassAdjusted + residualMassAdjusted + skinMassAdjusted + boneMassAdjusted;
    const nonAdiposeReadjustFactor = sumNonAdipose > 0 ? (input.bodyMass - adiposeMassAdjusted) / sumNonAdipose : 1;

    const muscleMassReadjusted = muscleMassAdjusted * nonAdiposeReadjustFactor;
    const residualMassReadjusted = residualMassAdjusted * nonAdiposeReadjustFactor;
    const skinMassReadjusted = skinMassAdjusted * nonAdiposeReadjustFactor;
    const boneMassReadjusted = boneMassAdjusted * nonAdiposeReadjustFactor;
    const adiposeMassReadjusted = input.bodyMass - muscleMassReadjusted - residualMassReadjusted - skinMassReadjusted - boneMassReadjusted;

    const adiposeMassReadjustedPct = input.bodyMass > 0 ? (adiposeMassReadjusted / input.bodyMass) * 100 : 0;
    const muscleMassReadjustedPct = input.bodyMass > 0 ? (muscleMassReadjusted / input.bodyMass) * 100 : 0;
    const residualMassReadjustedPct = input.bodyMass > 0 ? (residualMassReadjusted / input.bodyMass) * 100 : 0;
    const skinMassReadjustedPct = input.bodyMass > 0 ? (skinMassReadjusted / input.bodyMass) * 100 : 0;
    const boneMassReadjustedPct = input.bodyMass > 0 ? (boneMassReadjusted / input.bodyMass) * 100 : 0;

    const statureM = input.stature / 100;
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
    const crossSectionArmAdipose = calculateAdiposeCrossSection(input.armRelaxedGirth, armCorr);
    const crossSectionThighMuscle = calculateCrossSection(thighCorr);
    const crossSectionThighAdipose = calculateAdiposeCrossSection(input.thighMaxGirth, thighCorr);
    const crossSectionCalfMuscle = calculateCrossSection(calfCorr);
    const crossSectionCalfAdipose = calculateAdiposeCrossSection(input.calfMaxGirth, calfCorr);

    const muscleZScore = calculateZScore(muscleScaled, PHANTOM.muscle.mean, PHANTOM.muscle.sd);
    const residualZScore = calculateZScore(residualScaled, PHANTOM.residual.mean, PHANTOM.residual.sd);
    const boneBodyZScore = calculateZScore(boneBodyScaled, PHANTOM_BONE_BODY.mean, PHANTOM_BONE_BODY.sd);
    const boneHeadZScore = input.headGirth ? calculateZScore(input.headGirth, PHANTOM_BONE_HEAD.mean, PHANTOM_BONE_HEAD.sd) : 0;

    const bmi = calculateBMI(input.bodyMass, input.stature);
    const muscleBoneRatio = boneMass > 0 ? muscleMass / boneMass : 0;
    const adiposeMuscleRatio = muscleMass > 0 ? adiposeMass / muscleMass : 0;
    const ballastIndex = input.bodyMass > 0 ? ((boneMass + muscleMass) / input.bodyMass) * 100 : 0;

    const somatotype = calculateSomatotype(
      input.bodyMass, input.stature, input.tricepsSF, input.subscapularSF,
      input.supraspinaleSF, input.medialCalfSF, input.armFlexedGirth,
      input.calfMaxGirth, humerusDiameterVal, femurDiameterVal
    );

    const { data: insertedData, error: insertError } = await supabase
      .from('anthropometry_kerr_results')
      .insert({
        measurement_id: input.measurementId,
        athlete_id: input.athleteId,

        skin_mass_kg: skinMass,
        skin_mass_pct: skinMassPct,
        skin_mass_z_score: 0,
        skin_mass_adjustment: skinMassAdjustment,
        skin_mass_adjusted_kg: skinMassAdjusted,

        adipose_mass_kg: adiposeMass,
        adipose_mass_pct: adiposeMassPct,
        adipose_mass_z_score: adiposeZScore,
        adipose_mass_adjustment: adiposeMassAdjustment,
        adipose_mass_adjusted_kg: adiposeMassAdjusted,

        muscle_mass_kg: muscleMass,
        muscle_mass_pct: muscleMassPct,
        muscle_mass_z_score: muscleZScore,
        muscle_mass_adjustment: muscleMassAdjustment,
        muscle_mass_adjusted_kg: muscleMassAdjusted,

        muscle_mass_no_chest_kg: muscleMassNoChest,
        muscle_mass_no_chest_pct: muscleMassNoChestPct,
        muscle_mass_no_chest_adjustment: muscleMassNoChestAdjustment,
        muscle_mass_no_chest_adjusted_kg: muscleMassNoChestAdjusted,

        residual_mass_kg: residualMass,
        residual_mass_pct: residualMassPct,
        residual_mass_z_score: residualZScore,
        residual_mass_adjustment: residualMassAdjustment,
        residual_mass_adjusted_kg: residualMassAdjusted,

        bone_mass_head_kg: boneMassHead,
        bone_mass_head_pct: boneMassHeadPct,
        bone_mass_head_z_score: boneHeadZScore,
        bone_mass_head_adjustment: boneMassHeadAdjustment,
        bone_mass_head_adjusted_kg: boneMassHeadAdjusted,

        bone_mass_body_kg: boneMassBody,
        bone_mass_body_pct: boneMassBodyPct,
        bone_mass_body_z_score: boneBodyZScore,
        bone_mass_body_adjustment: boneMassBodyAdjustment,
        bone_mass_body_adjusted_kg: boneMassBodyAdjusted,

        bone_mass_kg: boneMass,
        bone_mass_pct: boneMassPct,
        bone_mass_z_score: boneBodyZScore,
        bone_mass_adjustment: boneMassAdjustment,
        bone_mass_adjusted_kg: boneMassAdjusted,

        structured_weight_kg: structuredWeight,
        structured_weight_diff_kg: structuredWeightDiff,
        structured_weight_diff_pct: structuredWeightDiffPct,
        technician_error_pct: technicianErrorPct,

        skin_mass_readjusted_kg: skinMassReadjusted,
        adipose_mass_readjusted_kg: adiposeMassReadjusted,
        muscle_mass_readjusted_kg: muscleMassReadjusted,
        residual_mass_readjusted_kg: residualMassReadjusted,
        bone_mass_readjusted_kg: boneMassReadjusted,

        skin_mass_readjusted_pct: skinMassReadjustedPct,
        adipose_mass_readjusted_pct: adiposeMassReadjustedPct,
        muscle_mass_readjusted_pct: muscleMassReadjustedPct,
        residual_mass_readjusted_pct: residualMassReadjustedPct,
        bone_mass_readjusted_pct: boneMassReadjustedPct,

        index_adipose: indexAdipose,
        index_muscle: indexMuscle,
        index_residual: indexResidual,
        index_bone: indexBone,
        index_skin: indexSkin,
        index_muscle_bone: indexMuscleBone,
        index_muscle_ballast: indexMuscleBallast,
        index_ballast: indexBallast,

        cross_section_arm_muscle: crossSectionArmMuscle,
        cross_section_arm_adipose: crossSectionArmAdipose,
        cross_section_thigh_muscle: crossSectionThighMuscle,
        cross_section_thigh_adipose: crossSectionThighAdipose,
        cross_section_calf_muscle: crossSectionCalfMuscle,
        cross_section_calf_adipose: crossSectionCalfAdipose,

        sum_corrected_girths: sumCorrectedGirths,
        sum_corrected_girths_no_chest: sumCorrectedGirthsNoChest,
        sum_6_skinfolds: input.sum6Skinfolds,
        sum_diameters: sumDiameters,

        muscle_bone_ratio: muscleBoneRatio,
        adipose_muscle_ratio: adiposeMuscleRatio,
        ballast_index: ballastIndex,
        bmi: bmi,
        surface_area_m2: surfaceArea,
        somatotype_endomorphy: somatotype.endomorphy,
        somatotype_mesomorphy: somatotype.mesomorphy,
        somatotype_ectomorphy: somatotype.ectomorphy,
        calculation_version: '3.0',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting Kerr results:', insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: insertedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in calculate-kerr-results:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
