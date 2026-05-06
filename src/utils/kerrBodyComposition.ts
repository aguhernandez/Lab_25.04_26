import type { AnthropometryData, TripleMeasurement } from '../types/anthropometry.types';
import { calculateKerrResults } from './kerrCalculations';

function getMedian(triple: any): number | undefined {
  if (typeof triple === 'number') return triple;
  if (typeof triple === 'object' && triple !== null && 'median' in triple) {
    const v = triple.median;
    if (v === null || v === undefined) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

export function prepareKerrInputFromMeasurement(measurement: any): AnthropometryData {
  const data: AnthropometryData = {
    age_years: measurement.age_years,
    sex: measurement.sex,
    measurement_method: measurement.measurement_method,
    measurement_date: measurement.measurement_date,
  };

  const simpleColumns = new Set(['body_mass_kg', 'stature_cm', 'sitting_height_cm', 'arm_span_cm']);

  const variableNames = [
    'body_mass_kg',
    'stature_cm',
    'sitting_height_cm',
    'arm_span_cm',
    'triceps_sf_mm',
    'subscapular_sf_mm',
    'biceps_sf_mm',
    'iliac_crest_sf_mm',
    'supraspinale_sf_mm',
    'abdominal_sf_mm',
    'front_thigh_sf_mm',
    'medial_calf_sf_mm',
    'head_girth_cm',
    'neck_girth_cm',
    'arm_relaxed_girth_cm',
    'arm_flexed_girth_cm',
    'forearm_girth_cm',
    'wrist_girth_cm',
    'chest_girth_cm',
    'waist_girth_cm',
    'gluteal_girth_cm',
    'thigh_upper_girth_cm',
    'thigh_mid_girth_cm',
    'calf_max_girth_cm',
    'ankle_min_girth_cm',
    'acromiale_radiale_length_cm',
    'radiale_stylion_length_cm',
    'midstylion_dactylion_length_cm',
    'iliospinale_height_cm',
    'trochanterion_height_cm',
    'trochanterion_tibiale_length_cm',
    'tibiale_laterale_height_cm',
    'tibiale_mediale_sphyrion_length_cm',
    'biacromial_breadth_cm',
    'biiliocristal_breadth_cm',
    'foot_length_cm',
    'transverse_chest_diameter_cm',
    'ap_chest_diameter_cm',
    'humerus_diameter_cm',
    'femur_diameter_cm',
  ];

  for (const varName of variableNames) {
    if (simpleColumns.has(varName)) {
      const value = measurement[varName];
      if (value !== undefined && value !== null) {
        data[varName] = { median: value } as TripleMeasurement;
      }
    } else {
      const m1 = measurement[`${varName}_m1`];
      const m2 = measurement[`${varName}_m2`];
      const m3 = measurement[`${varName}_m3`];
      const median = measurement[`${varName}_median`];
      const stdev = measurement[`${varName}_stdev`];
      const error_pct = measurement[`${varName}_error_pct`];

      if (m1 !== undefined || m2 !== undefined || m3 !== undefined || median !== undefined) {
        data[varName] = { m1, m2, m3, median, stdev, error_pct } as TripleMeasurement;
      }
    }
  }

  return data;
}

export async function calculateAndStoreKerrResults(
  measurementId: string,
  athleteId: string,
  measurement: any
): Promise<any> {
  const data = prepareKerrInputFromMeasurement(measurement);
  const results = calculateKerrResults(data);

  if (!results) {
    throw new Error('Unable to calculate Kerr results: missing required measurements');
  }

  const sum6Skinfolds =
    (getMedian(data.triceps_sf_mm) || 0) +
    (getMedian(data.subscapular_sf_mm) || 0) +
    (getMedian(data.supraspinale_sf_mm) || 0) +
    (getMedian(data.abdominal_sf_mm) || 0) +
    (getMedian(data.front_thigh_sf_mm) || 0) +
    (getMedian(data.medial_calf_sf_mm) || 0);

  const payload = {
    measurementId,
    athleteId,
    bodyMass: getMedian(data.body_mass_kg) || 0,
    stature: getMedian(data.stature_cm) || 0,
    age: data.age_years || 0,
    sex: data.sex || 'male',
    sum6Skinfolds,
    armFlexedGirth: getMedian(data.arm_flexed_girth_cm) || 0,
    thighMaxGirth: getMedian(data.thigh_upper_girth_cm) || getMedian(data.thigh_mid_girth_cm) || 0,
    calfMaxGirth: getMedian(data.calf_max_girth_cm) || 0,
    chestGirth: getMedian(data.chest_girth_cm) || 0,
    tricepsSF: getMedian(data.triceps_sf_mm) || 0,
    frontThighSF: getMedian(data.front_thigh_sf_mm) || 0,
    medialCalfSF: getMedian(data.medial_calf_sf_mm) || 0,
    subscapularSF: getMedian(data.subscapular_sf_mm) || 0,
    transverseChestDiameter: getMedian(data.transverse_chest_diameter_cm),
    apChestDiameter: getMedian(data.ap_chest_diameter_cm),
    waistGirth: getMedian(data.waist_girth_cm),
    sittingHeight: getMedian(data.sitting_height_cm),
    biacromialBreadth: getMedian(data.biacromial_breadth_cm),
    biiliocristalBreadth: getMedian(data.biiliocristal_breadth_cm),
    humerusDiameter: getMedian(data.humerus_diameter_cm),
    femurDiameter: getMedian(data.femur_diameter_cm),
    headGirth: getMedian(data.head_girth_cm),
  };

  return payload;
}
