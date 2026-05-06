export interface AnthropometryVariable {
  name: string;
  label: string;
  unit: string;
  category: 'basic' | 'skinfolds' | 'girths' | 'lengths' | 'breadths';
  required: boolean;
  min?: number;
  max?: number;
  description?: string;
}

export const ISAK_VARIABLES: AnthropometryVariable[] = [
  { name: 'body_mass_kg', label: 'Body Mass', unit: 'kg', category: 'basic', required: true, min: 20, max: 300 },
  { name: 'stature_cm', label: 'Stature', unit: 'cm', category: 'basic', required: true, min: 50, max: 250 },
  { name: 'sitting_height_cm', label: 'Sitting Height', unit: 'cm', category: 'basic', required: false, min: 30, max: 150 },
  { name: 'arm_span_cm', label: 'Arm Span', unit: 'cm', category: 'basic', required: false, min: 50, max: 250 },

  { name: 'triceps_sf_mm', label: 'Triceps Skinfold', unit: 'mm', category: 'skinfolds', required: true, min: 1, max: 100 },
  { name: 'subscapular_sf_mm', label: 'Subscapular Skinfold', unit: 'mm', category: 'skinfolds', required: true, min: 1, max: 100 },
  { name: 'biceps_sf_mm', label: 'Biceps Skinfold', unit: 'mm', category: 'skinfolds', required: false, min: 1, max: 100 },
  { name: 'iliac_crest_sf_mm', label: 'Iliac Crest Skinfold', unit: 'mm', category: 'skinfolds', required: false, min: 1, max: 100 },
  { name: 'supraspinale_sf_mm', label: 'Supraspinale Skinfold', unit: 'mm', category: 'skinfolds', required: true, min: 1, max: 100 },
  { name: 'abdominal_sf_mm', label: 'Abdominal Skinfold', unit: 'mm', category: 'skinfolds', required: true, min: 1, max: 100 },
  { name: 'front_thigh_sf_mm', label: 'Front Thigh Skinfold', unit: 'mm', category: 'skinfolds', required: true, min: 1, max: 100 },
  { name: 'medial_calf_sf_mm', label: 'Medial Calf Skinfold', unit: 'mm', category: 'skinfolds', required: true, min: 1, max: 100 },

  { name: 'head_girth_cm', label: 'Head Girth', unit: 'cm', category: 'girths', required: false, min: 30, max: 80 },
  { name: 'neck_girth_cm', label: 'Neck Girth', unit: 'cm', category: 'girths', required: false, min: 20, max: 60 },
  { name: 'arm_relaxed_girth_cm', label: 'Arm Relaxed Girth', unit: 'cm', category: 'girths', required: false, min: 15, max: 60 },
  { name: 'arm_flexed_girth_cm', label: 'Arm Flexed Girth', unit: 'cm', category: 'girths', required: true, min: 15, max: 60 },
  { name: 'forearm_girth_cm', label: 'Forearm Girth', unit: 'cm', category: 'girths', required: false, min: 15, max: 50 },
  { name: 'wrist_girth_cm', label: 'Wrist Girth', unit: 'cm', category: 'girths', required: false, min: 10, max: 30 },
  { name: 'chest_girth_cm', label: 'Chest Girth', unit: 'cm', category: 'girths', required: true, min: 50, max: 150 },
  { name: 'waist_girth_cm', label: 'Waist Girth', unit: 'cm', category: 'girths', required: false, min: 40, max: 150 },
  { name: 'gluteal_girth_cm', label: 'Gluteal Girth', unit: 'cm', category: 'girths', required: false, min: 50, max: 150 },
  { name: 'thigh_upper_girth_cm', label: 'Thigh Max Girth', unit: 'cm', category: 'girths', required: true, min: 30, max: 100 },
  { name: 'thigh_mid_girth_cm', label: 'Thigh Mid Girth', unit: 'cm', category: 'girths', required: false, min: 30, max: 100 },
  { name: 'calf_max_girth_cm', label: 'Calf Max Girth', unit: 'cm', category: 'girths', required: true, min: 20, max: 60 },
  { name: 'ankle_min_girth_cm', label: 'Ankle Min Girth', unit: 'cm', category: 'girths', required: false, min: 15, max: 40 },

  { name: 'acromiale_radiale_length_cm', label: 'Acromiale-Radiale Length', unit: 'cm', category: 'lengths', required: false, min: 20, max: 50 },
  { name: 'radiale_stylion_length_cm', label: 'Radiale-Stylion Length', unit: 'cm', category: 'lengths', required: false, min: 15, max: 40 },
  { name: 'midstylion_dactylion_length_cm', label: 'Midstylion-Dactylion Length', unit: 'cm', category: 'lengths', required: false, min: 10, max: 30 },
  { name: 'iliospinale_height_cm', label: 'Iliospinale Height', unit: 'cm', category: 'lengths', required: false, min: 50, max: 150 },
  { name: 'trochanterion_height_cm', label: 'Trochanterion Height', unit: 'cm', category: 'lengths', required: false, min: 40, max: 130 },
  { name: 'trochanterion_tibiale_length_cm', label: 'Trochanterion-Tibiale Length', unit: 'cm', category: 'lengths', required: false, min: 30, max: 80 },
  { name: 'tibiale_laterale_height_cm', label: 'Tibiale Laterale Height', unit: 'cm', category: 'lengths', required: false, min: 30, max: 80 },
  { name: 'tibiale_mediale_sphyrion_length_cm', label: 'Tibiale Mediale-Sphyrion Length', unit: 'cm', category: 'lengths', required: false, min: 5, max: 20 },

  { name: 'biacromial_breadth_cm', label: 'Biacromial Breadth', unit: 'cm', category: 'breadths', required: false, min: 25, max: 60 },
  { name: 'biiliocristal_breadth_cm', label: 'Biiliocristal Breadth', unit: 'cm', category: 'breadths', required: false, min: 20, max: 50 },
  { name: 'foot_length_cm', label: 'Foot Length', unit: 'cm', category: 'breadths', required: false, min: 15, max: 40 },
  { name: 'transverse_chest_diameter_cm', label: 'Transverse Chest Diameter', unit: 'cm', category: 'breadths', required: false, min: 15, max: 50 },
  { name: 'ap_chest_diameter_cm', label: 'AP Chest Diameter', unit: 'cm', category: 'breadths', required: false, min: 10, max: 40 },
  { name: 'humerus_diameter_cm', label: 'Humerus Diameter', unit: 'cm', category: 'breadths', required: false, min: 4, max: 12 },
  { name: 'femur_diameter_cm', label: 'Femur Diameter', unit: 'cm', category: 'breadths', required: false, min: 6, max: 15 },
];

export interface TripleMeasurement {
  m1?: number;
  m2?: number;
  m3?: number;
  median?: number;
  stdev?: number;
  error_pct?: number;
}

export type AnthropometryData = {
  [key: string]: TripleMeasurement | number | string | undefined;
  age_years?: number;
  sex?: 'male' | 'female';
  measurement_method?: 'manual' | 'bioimpedance';
  measurement_date?: string;
  technician_name?: string;
  notes?: string;
};

export interface KerrResults {
  id: string;
  measurement_id: string;
  athlete_id: string;
  calculation_date: string;

  skin_mass_kg: number;
  skin_mass_pct: number;
  skin_mass_z_score: number;
  skin_mass_adjustment: number;
  skin_mass_adjusted_kg: number;

  adipose_mass_kg: number;
  adipose_mass_pct: number;
  adipose_mass_z_score: number;
  adipose_mass_adjustment: number;
  adipose_mass_adjusted_kg: number;

  muscle_mass_kg: number;
  muscle_mass_pct: number;
  muscle_mass_z_score: number;
  muscle_mass_adjustment: number;
  muscle_mass_adjusted_kg: number;

  muscle_mass_no_chest_kg: number;
  muscle_mass_no_chest_pct: number;
  muscle_mass_no_chest_adjustment: number;
  muscle_mass_no_chest_adjusted_kg: number;

  residual_mass_kg: number;
  residual_mass_pct: number;
  residual_mass_z_score: number;
  residual_mass_adjustment: number;
  residual_mass_adjusted_kg: number;

  bone_mass_head_kg: number;
  bone_mass_head_pct: number;
  bone_mass_head_z_score: number;
  bone_mass_head_adjustment: number;
  bone_mass_head_adjusted_kg: number;

  bone_mass_body_kg: number;
  bone_mass_body_pct: number;
  bone_mass_body_z_score: number;
  bone_mass_body_adjustment: number;
  bone_mass_body_adjusted_kg: number;

  bone_mass_kg: number;
  bone_mass_pct: number;
  bone_mass_z_score: number;
  bone_mass_adjustment: number;
  bone_mass_adjusted_kg: number;

  structured_weight_kg: number;
  structured_weight_diff_kg: number;
  structured_weight_diff_pct: number;
  technician_error_pct: number;

  skin_mass_readjusted_kg: number;
  adipose_mass_readjusted_kg: number;
  muscle_mass_readjusted_kg: number;
  residual_mass_readjusted_kg: number;
  bone_mass_readjusted_kg: number;

  skin_mass_readjusted_pct: number;
  adipose_mass_readjusted_pct: number;
  muscle_mass_readjusted_pct: number;
  residual_mass_readjusted_pct: number;
  bone_mass_readjusted_pct: number;

  index_adipose: number;
  index_muscle: number;
  index_residual: number;
  index_bone: number;
  index_skin: number;
  index_muscle_bone: number;
  index_muscle_ballast: number;
  index_ballast: number;

  cross_section_arm_muscle: number;
  cross_section_arm_adipose: number;
  cross_section_thigh_muscle: number;
  cross_section_thigh_adipose: number;
  cross_section_calf_muscle: number;
  cross_section_calf_adipose: number;

  sum_corrected_girths: number;
  sum_corrected_girths_no_chest: number;
  sum_6_skinfolds: number;
  sum_diameters: number;

  muscle_bone_ratio: number;
  adipose_muscle_ratio: number;
  ballast_index: number;
  bmi: number;
  surface_area_m2: number;

  somatotype_endomorphy: number;
  somatotype_mesomorphy: number;
  somatotype_ectomorphy: number;

  calculation_version: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProportionalityIndices {
  cormic_index?: number;
  leg_length_cm?: number;
  ponderal_index?: number;
  phv_age?: number;
  maturity_classification?: string;
}

export interface ComprehensiveIndices extends ProportionalityIndices {
  bmi?: number;
  waist_hip_ratio?: number;
  waist_height_ratio?: number;
  conicity_index?: number;
  bai?: number;
}

export interface AnthropometryMeasurement {
  id: string;
  athlete_id: string;
  measurement_date: string;
  measurement_method: 'manual' | 'bioimpedance';
  age_years?: number;
  sex?: 'male' | 'female';
  technician_name?: string;
  measurement_quality?: 'excellent' | 'good' | 'acceptable' | 'poor';
  validation_status?: 'pending' | 'validated' | 'rejected';
  notes?: string;
  coach_notes?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

export function calculateMedian(m1?: number, m2?: number, m3?: number): number | undefined {
  const values = [m1, m2, m3].filter(v => v !== undefined && v !== null && !isNaN(v)) as number[];
  if (values.length === 0) return undefined;
  if (values.length === 1) return values[0];
  if (values.length === 2) return (values[0] + values[1]) / 2;

  const sorted = values.sort((a, b) => a - b);
  return sorted[1];
}

export function calculateStdev(m1?: number, m2?: number, m3?: number, median?: number): number | undefined {
  const values = [m1, m2, m3].filter(v => v !== undefined && v !== null && !isNaN(v)) as number[];
  if (values.length < 2) return undefined;

  const med = median ?? calculateMedian(m1, m2, m3);
  if (med === undefined) return undefined;

  const squaredDiffs = values.map(v => Math.pow(v - med, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateErrorPct(stdev?: number, median?: number): number | undefined {
  if (stdev === undefined || median === undefined || median === 0) return undefined;
  return (stdev / median) * 100;
}

export function sanitizeInput(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'string' ? parseFloat(value.trim()) : value;
  return isNaN(parsed) ? undefined : parsed;
}

export function validateCriticalMeasurements(data: AnthropometryData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.body_mass_kg || typeof data.body_mass_kg !== 'number' || data.body_mass_kg < 20 || data.body_mass_kg > 300) {
    errors.push('Body mass must be between 20 and 300 kg');
  }

  if (!data.stature_cm || typeof data.stature_cm !== 'number' || data.stature_cm < 50 || data.stature_cm > 250) {
    errors.push('Stature must be between 50 and 250 cm');
  }

  if (data.age_years !== undefined && (data.age_years < 6 || data.age_years > 100)) {
    errors.push('Age must be between 6 and 100 years');
  }

  if (data.sex && data.sex !== 'male' && data.sex !== 'female') {
    errors.push('Sex must be either "male" or "female"');
  }

  return { valid: errors.length === 0, errors };
}

export function getVariablesByCategory(category: AnthropometryVariable['category']): AnthropometryVariable[] {
  return ISAK_VARIABLES.filter(v => v.category === category);
}

export function getRequiredVariables(): AnthropometryVariable[] {
  return ISAK_VARIABLES.filter(v => v.required);
}

const SIMPLE_COLUMNS = new Set(['body_mass_kg', 'stature_cm', 'sitting_height_cm', 'arm_span_cm']);

export function adaptDataForDatabase(data: AnthropometryData): Record<string, any> {
  const dbData: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'object' && value !== null && 'median' in value) {
      const triple = value as TripleMeasurement;
      if (SIMPLE_COLUMNS.has(key)) {
        dbData[key] = triple.median;
      } else {
        if (triple.m1 !== undefined) dbData[`${key}_m1`] = triple.m1;
        if (triple.m2 !== undefined) dbData[`${key}_m2`] = triple.m2;
        if (triple.m3 !== undefined) dbData[`${key}_m3`] = triple.m3;
        if (triple.median !== undefined) dbData[`${key}_median`] = triple.median;
        if (triple.stdev !== undefined) dbData[`${key}_stdev`] = triple.stdev;
        if (triple.error_pct !== undefined) dbData[`${key}_error_pct`] = triple.error_pct;
      }
    } else if (typeof value === 'object') {
      continue;
    } else {
      dbData[key] = value;
    }
  }

  return dbData;
}

export function adaptDataFromDatabase(dbData: Record<string, any>): AnthropometryData {
  const data: AnthropometryData = {};
  const processedVars = new Set<string>();

  for (const variable of ISAK_VARIABLES) {
    const varName = variable.name;
    if (processedVars.has(varName)) continue;

    if (SIMPLE_COLUMNS.has(varName)) {
      const value = dbData[varName];
      if (value !== null && value !== undefined) {
        data[varName] = { median: value };
      }
      processedVars.add(varName);
    } else {
      const medianKey = `${varName}_median`;
      if (medianKey in dbData) {
        const value = dbData[medianKey];
        if (value !== null && value !== undefined) {
          data[varName] = {
            m1: dbData[`${varName}_m1`],
            m2: dbData[`${varName}_m2`],
            m3: dbData[`${varName}_m3`],
            median: value,
            stdev: dbData[`${varName}_stdev`],
            error_pct: dbData[`${varName}_error_pct`],
          };
        }
        processedVars.add(varName);
      }
    }
  }

  data.age_years = dbData.age_years;
  data.sex = dbData.sex;
  data.measurement_method = dbData.measurement_method;
  data.measurement_date = dbData.measurement_date;
  data.technician_name = dbData.technician_name;
  data.notes = dbData.notes;

  return data;
}

export const PHANTOM_REFERENCE = {
  adipose: { mean: 116.41, sd: 34.79 },
  muscle: { mean: 207.21, sd: 13.74 },
  residual: { mean: 109.35, sd: 7.08 },
  bone: { mean: 98.88, sd: 5.33 },
};

export const PHANTOM_BODY_MASS = 64.58;

export const PHANTOM_TISSUE_MASSES = {
  adipose: 16.14,
  muscle: 29.35,
  residual: 9.97,
  bone: 5.879,
};
