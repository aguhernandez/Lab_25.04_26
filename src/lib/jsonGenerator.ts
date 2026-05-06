import { Athlete, Test, TestDataPoint, AnthropometryData, AdvancedMetrics } from '../types';
import { PhysiologyResults } from './physiology';

export interface MetabolicLabJSON {
  athleteID: string;
  athleteName: string;
  testID: string;
  testDate: string;
  sport: string;
  anthropometry: {
    weight_kg: number;
    height_cm: number;
    age: number;
    sex: string;
    bodyFatPercent?: number;
    leanBodyMassKg?: number;
    source: 'HUB' | 'manual' | 'mixed';
  };
  testType: string;
  stages: Array<{
    stage: number;
    duration_min: number;
    HR: number;
    VO2_ml_kg_min?: number | null;
    VO2_L_min?: number | null;
    lactate_mmol_L?: number | null;
    RPE?: number | null;
    power_watts?: number | null;
    speed_pace?: string | null;
  }>;
  VO2max: {
    absolute_L_min: number | null;
    relative_ml_kg_min: number | null;
    relative_ml_kg_LBM_min: number | null;
    confidence: string;
  };
  thresholds: {
    LT1: {
      VO2_L_min: number | null;
      HR_bpm: number | null;
      Power_W: number | null;
      percent_VO2max: number | null;
      percent_HRmax: number | null;
      confidence: string;
    };
    LT2: {
      VO2_L_min: number | null;
      HR_bpm: number | null;
      Power_W: number | null;
      percent_VO2max: number | null;
      percent_HRmax: number | null;
      confidence: string;
    };
  };
  FatMax: {
    HR_bpm: number | null;
    Power_W: number | null;
    VO2_L_min: number | null;
    Speed_km_h: string | null;
    confidence: string;
  };
  trainingZones: Array<{
    zone: number;
    name: string;
    HR_range: string;
    VO2_range_L_min?: string;
    Power_range_W?: string;
    description: string;
  }>;
  HR_drift_percent: number | null;
  energyMix: {
    fat_percent: number;
    carb_percent: number;
    confidence: string;
  };
  metabolicProfile: {
    aerobicCapacity: string;
    fatUtilization: string;
    anaerobicContribution: string;
    durability: string;
  };
  dataQuality: string;
  dataQualityScore: number;
  curves: {
    VO2_ml_kg_min_vs_stage: Array<number | null>;
    HR_vs_stage: number[];
    lactate_vs_stage: Array<number | null>;
    FatMix_vs_stage: Array<number | null>;
    RPE_vs_stage: Array<number | null>;
    Power_vs_stage?: Array<number | null>;
  };
  validation: {
    missingFields: string[];
    warnings: string[];
    isComplete: boolean;
  };
  advancedMetrics?: AdvancedMetrics;
  metadata: {
    generatedAt: string;
    labVersion: string;
    calculationEngine: string;
  };
}

export function generateCompleteJSON(
  athlete: Athlete,
  test: Test,
  dataPoints: TestDataPoint[],
  results: PhysiologyResults,
  advancedMetrics?: AdvancedMetrics
): MetabolicLabJSON {
  const sortedPoints = [...dataPoints].sort((a, b) => a.stage_number - b.stage_number);

  const anthropometry = extractAnthropometry(test, athlete);
  const stages = generateStages(sortedPoints, anthropometry.weight_kg);
  const vo2max = generateVO2maxData(results);
  const thresholds = generateThresholds(results);
  const fatmax = generateFatMax(results);
  const trainingZones = generateTrainingZonesJSON(results, anthropometry.weight_kg);
  const energyMix = generateEnergyMix(results);
  const curves = generateCurves(sortedPoints, results);
  const validation = validateData(
    anthropometry,
    stages,
    results
  );

  return {
    athleteID: athlete.id,
    athleteName: athlete.name,
    testID: test.id,
    testDate: test.test_date,
    sport: test.sport,
    anthropometry: {
      weight_kg: anthropometry.weight_kg,
      height_cm: anthropometry.height_cm,
      age: anthropometry.age,
      sex: anthropometry.sex,
      bodyFatPercent: anthropometry.bodyFatPercent,
      leanBodyMassKg: anthropometry.leanBodyMassKg,
      source: anthropometry.source === 'hub' ? 'HUB' : anthropometry.source === 'manual' ? 'manual' : 'mixed'
    },
    testType: test.test_type,
    stages,
    VO2max: vo2max,
    thresholds,
    FatMax: fatmax,
    trainingZones,
    HR_drift_percent: results.hr_drift_percent,
    energyMix,
    metabolicProfile: {
      aerobicCapacity: results.metabolic_profile.aerobic_capacity,
      fatUtilization: results.metabolic_profile.fat_utilization,
      anaerobicContribution: results.metabolic_profile.anaerobic_contribution,
      durability: results.metabolic_profile.durability
    },
    dataQuality: results.data_quality,
    dataQualityScore: results.data_quality_score,
    curves,
    validation,
    advancedMetrics,
    metadata: {
      generatedAt: new Date().toISOString(),
      labVersion: '1.0.0',
      calculationEngine: 'Asciende Metabolic Lab Engine v1.0'
    }
  };
}

function extractAnthropometry(test: Test, athlete: Athlete): AnthropometryData {
  if (test.anthropometry_snapshot) {
    return test.anthropometry_snapshot;
  }

  const age = athlete.date_of_birth
    ? new Date().getFullYear() - new Date(athlete.date_of_birth).getFullYear()
    : 30;

  return {
    weight_kg: athlete.weight_kg || 70,
    height_cm: athlete.height_cm || 175,
    age,
    sex: athlete.sex || 'male',
    bodyFatPercent: athlete.body_fat_percent,
    leanBodyMassKg: athlete.lean_body_mass_kg,
    source: 'manual'
  };
}

function generateStages(dataPoints: TestDataPoint[], weightKg: number | null) {
  return dataPoints.map(point => {
    let vo2_l_min = null;
    if (point.vo2_ml_kg_min && weightKg) {
      vo2_l_min = (point.vo2_ml_kg_min * weightKg) / 1000;
    }

    return {
      stage: point.stage_number,
      duration_min: Math.round((point.duration_seconds / 60) * 100) / 100,
      HR: point.heart_rate,
      VO2_ml_kg_min: point.vo2_ml_kg_min || null,
      VO2_L_min: vo2_l_min,
      lactate_mmol_L: point.lactate || null,
      RPE: point.rpe || null,
      power_watts: point.power_watts || null,
      speed_pace: point.speed_pace || null
    };
  });
}

function generateVO2maxData(results: PhysiologyResults) {
  const absolute_L_min = results.vo2max_ml_min ? results.vo2max_ml_min / 1000 : null;

  return {
    absolute_L_min,
    relative_ml_kg_min: results.vo2max_ml_kg_min,
    relative_ml_kg_LBM_min: results.vo2max_ml_kg_lbm_min,
    confidence: results.vo2max_confidence
  };
}

function generateThresholds(results: PhysiologyResults) {
  return {
    LT1: {
      VO2_L_min: results.lt1_vo2,
      HR_bpm: results.lt1_hr,
      Power_W: results.lt1_power,
      percent_VO2max: results.lt1_percent_vo2max,
      percent_HRmax: results.lt1_percent_hrmax,
      confidence: results.lt1_confidence
    },
    LT2: {
      VO2_L_min: results.lt2_vo2,
      HR_bpm: results.lt2_hr,
      Power_W: results.lt2_power,
      percent_VO2max: results.lt2_percent_vo2max,
      percent_HRmax: results.lt2_percent_hrmax,
      confidence: results.lt2_confidence
    }
  };
}

function generateFatMax(results: PhysiologyResults) {
  return {
    HR_bpm: results.fatmax_hr,
    Power_W: results.fatmax_power,
    VO2_L_min: results.fatmax_vo2,
    Speed_km_h: null,
    confidence: results.fatmax_confidence
  };
}

function generateTrainingZonesJSON(results: PhysiologyResults, weightKg: number) {
  return results.training_zones.map(zone => {
    const hr_range = `${zone.hr_min}-${zone.hr_max}`;

    let vo2_range_L_min: string | undefined = undefined;
    if (results.has_vo2 && results.vo2max_ml_kg_min) {
      const vo2_min_L = ((zone.hr_min / results.hrmax) * results.vo2max_ml_kg_min * weightKg) / 1000;
      const vo2_max_L = ((zone.hr_max / results.hrmax) * results.vo2max_ml_kg_min * weightKg) / 1000;
      vo2_range_L_min = `${vo2_min_L.toFixed(2)}-${vo2_max_L.toFixed(2)}`;
    }

    let power_range_W: string | undefined = undefined;
    if (zone.power_min !== undefined && zone.power_max !== undefined) {
      power_range_W = `${zone.power_min}-${zone.power_max}`;
    }

    return {
      zone: zone.zone,
      name: zone.name,
      HR_range: hr_range,
      VO2_range_L_min: vo2_range_L_min,
      Power_range_W: power_range_W,
      description: zone.description
    };
  });
}

function generateEnergyMix(results: PhysiologyResults) {
  if (!results.stage_analysis || results.stage_analysis.length === 0) {
    return {
      fat_percent: 50,
      carb_percent: 50,
      confidence: 'inferred'
    };
  }

  const midStageIndex = Math.floor(results.stage_analysis.length / 2);
  const midStage = results.stage_analysis[midStageIndex];

  if (midStage.energy_mix) {
    return {
      fat_percent: Math.round(midStage.energy_mix.fat_percent),
      carb_percent: Math.round(midStage.energy_mix.carb_percent),
      confidence: results.has_rer ? 'measured' : 'estimated'
    };
  }

  return {
    fat_percent: 50,
    carb_percent: 50,
    confidence: 'inferred'
  };
}

function generateCurves(dataPoints: TestDataPoint[], results: PhysiologyResults) {
  const curves = {
    VO2_ml_kg_min_vs_stage: dataPoints.map(p => p.vo2_ml_kg_min || null),
    HR_vs_stage: dataPoints.map(p => p.heart_rate),
    lactate_vs_stage: dataPoints.map(p => p.lactate || null),
    FatMix_vs_stage: results.stage_analysis.map(s =>
      s.energy_mix ? Math.round(s.energy_mix.fat_percent) : null
    ),
    RPE_vs_stage: dataPoints.map(p => p.rpe || null),
    Power_vs_stage: undefined as Array<number | null> | undefined
  };

  if (results.has_power) {
    curves.Power_vs_stage = dataPoints.map(p => p.power_watts || null);
  }

  return curves;
}

function validateData(
  anthropometry: AnthropometryData,
  stages: ReturnType<typeof generateStages>,
  results: PhysiologyResults
) {
  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!anthropometry.weight_kg || anthropometry.weight_kg <= 0) {
    missingFields.push('anthropometry.weight_kg');
  }

  if (!anthropometry.height_cm || anthropometry.height_cm <= 0) {
    missingFields.push('anthropometry.height_cm');
  }

  if (!anthropometry.age || anthropometry.age <= 0) {
    missingFields.push('anthropometry.age');
  }

  if (stages.length < 3) {
    warnings.push('Less than 3 stages - results may be less accurate');
  }

  if (!results.has_vo2) {
    warnings.push('No VO₂ measurements - using estimates');
  }

  if (!results.has_lactate) {
    warnings.push('No lactate measurements - thresholds are estimated');
  }

  if (results.vo2max_confidence === 'inferred') {
    warnings.push('VO₂max is inferred - direct measurement recommended');
  }

  if (!anthropometry.bodyFatPercent) {
    warnings.push('Body fat percentage not provided - LBM calculations unavailable');
  }

  if (!results.has_power && (stages[0]?.power_watts !== null || stages[0]?.power_watts !== undefined)) {
    warnings.push('Incomplete power data');
  }

  const isComplete = missingFields.length === 0 && stages.length >= 3;

  return {
    missingFields,
    warnings,
    isComplete
  };
}

export function exportJSONToFile(json: MetabolicLabJSON, filename?: string): void {
  const jsonString = JSON.stringify(json, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `metabolic_test_${json.athleteName}_${json.testDate}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getJSONSummary(json: MetabolicLabJSON): string {
  const lines = [
    `Athlete: ${json.athleteName}`,
    `Test Date: ${new Date(json.testDate).toLocaleDateString()}`,
    `Test Type: ${json.testType.replace('_', ' ').toUpperCase()}`,
    ``,
    `Anthropometry Source: ${json.anthropometry.source}`,
    `Data Quality: ${json.dataQuality} (Score: ${json.dataQualityScore})`,
    ``,
    `Key Results:`,
    `  VO₂max: ${json.VO2max.relative_ml_kg_min?.toFixed(1) || 'N/A'} ml/kg/min (${json.VO2max.confidence})`,
    `  LT1: ${json.thresholds.LT1.HR_bpm || 'N/A'} bpm (${json.thresholds.LT1.confidence})`,
    `  LT2: ${json.thresholds.LT2.HR_bpm || 'N/A'} bpm (${json.thresholds.LT2.confidence})`,
    `  FatMax: ${json.FatMax.HR_bpm || 'N/A'} bpm (${json.FatMax.confidence})`,
    ``,
    `Validation:`,
    `  Complete: ${json.validation.isComplete ? 'Yes' : 'No'}`,
    `  Warnings: ${json.validation.warnings.length}`,
    `  Missing Fields: ${json.validation.missingFields.length}`
  ];

  if (json.validation.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    json.validation.warnings.forEach(w => lines.push(`  - ${w}`));
  }

  return lines.join('\n');
}
