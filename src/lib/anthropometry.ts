import { supabase } from './supabase';
import { fetchHubAnthropometry } from './hubLink';
import type { AnthropometryData, AnthropometrySource } from '../types';

export interface AnthropometryStatus {
  isComplete: boolean;
  missingFields: string[];
  data?: AnthropometryData;
}

export async function loadAnthropometryFromHub(athleteId: string): Promise<AnthropometryStatus> {
  const { data: athlete, error } = await supabase
    .from('athletes')
    .select('hub_user_id')
    .eq('id', athleteId)
    .maybeSingle();

  if (error || !athlete) {
    return {
      isComplete: false,
      missingFields: ['athlete not found'],
    };
  }

  if (!athlete.hub_user_id) {
    return {
      isComplete: false,
      missingFields: ['No HUB link configured for this athlete'],
    };
  }

  const hubResult = await fetchHubAnthropometry(athlete.hub_user_id);

  if (!hubResult.success || !hubResult.data) {
    return {
      isComplete: false,
      missingFields: [hubResult.error || 'No data available in HUB'],
    };
  }

  const hubData = hubResult.data;
  const missingFields: string[] = [];

  if (!hubData.weight_kg) missingFields.push('weight');
  if (!hubData.height_cm) missingFields.push('height');
  if (!hubData.age) missingFields.push('age/date of birth');
  if (!hubData.sex) missingFields.push('sex');

  if (missingFields.length > 0) {
    return {
      isComplete: false,
      missingFields,
      data: {
        weight_kg: hubData.weight_kg || 0,
        height_cm: hubData.height_cm || 0,
        age: hubData.age || 0,
        sex: (hubData.sex as 'male' | 'female' | 'other') || 'other',
        bodyFatPercent: hubData.bodyFatPercent,
        leanBodyMassKg: hubData.leanBodyMassKg,
        source: 'hub',
      }
    };
  }

  return {
    isComplete: true,
    missingFields: [],
    data: {
      weight_kg: hubData.weight_kg!,
      height_cm: hubData.height_cm!,
      age: hubData.age!,
      sex: hubData.sex as 'male' | 'female' | 'other',
      bodyFatPercent: hubData.bodyFatPercent,
      leanBodyMassKg: hubData.leanBodyMassKg,
      source: 'hub',
    },
  };
}

export async function updateAthleteAnthropometry(
  athleteId: string,
  anthropometry: Partial<{
    weight_kg: number;
    height_cm: number;
    date_of_birth: string;
    sex: string;
    body_fat_percent: number;
    lean_body_mass_kg: number;
  }>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('athletes')
    .update(anthropometry)
    .eq('id', athleteId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export function validateAnthropometryData(data: Partial<AnthropometryData>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.weight_kg || data.weight_kg <= 0 || data.weight_kg > 300) {
    errors.push('Weight is required and must be between 0 and 300 kg');
  }

  if (!data.height_cm || data.height_cm <= 0 || data.height_cm > 300) {
    errors.push('Height is required and must be between 0 and 300 cm');
  }

  if (!data.age || data.age <= 0 || data.age > 120) {
    errors.push('Age is required and must be between 0 and 120 years');
  }

  if (!data.sex) {
    errors.push('Sex is required');
  }

  if (data.bodyFatPercent !== undefined && data.bodyFatPercent !== null) {
    if (data.bodyFatPercent < 0 || data.bodyFatPercent > 60) {
      errors.push('Body fat percent must be between 0 and 60% (optional)');
    }
  }

  if (data.leanBodyMassKg !== undefined && data.leanBodyMassKg !== null) {
    if (data.leanBodyMassKg <= 0 || data.leanBodyMassKg > 200) {
      errors.push('Lean body mass must be between 0 and 200 kg (optional)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function createAnthropometrySnapshot(
  data: AnthropometryData
): AnthropometryData {
  return { ...data };
}

export async function saveTestAnthropometry(
  testId: string,
  anthropometry: AnthropometryData
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('tests')
    .update({
      anthropometry_source: anthropometry.source,
      anthropometry_snapshot: anthropometry,
    })
    .eq('id', testId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

export function mergeAnthropometry(
  hubData: Partial<AnthropometryData>,
  manualData: Partial<AnthropometryData>
): AnthropometryData {
  const merged = {
    weight_kg: manualData.weight_kg ?? hubData.weight_kg ?? 0,
    height_cm: manualData.height_cm ?? hubData.height_cm ?? 0,
    age: manualData.age ?? hubData.age ?? 0,
    sex: manualData.sex ?? hubData.sex ?? 'other' as const,
    bodyFatPercent: manualData.bodyFatPercent ?? hubData.bodyFatPercent,
    leanBodyMassKg: manualData.leanBodyMassKg ?? hubData.leanBodyMassKg,
    source: 'mixed' as AnthropometrySource,
  };

  return merged;
}
