import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { PhysiologyResults } from './physiology';
import { Athlete, Test, TrainingZone } from '../types';
import { calculateZones7, convertTo5Zones, ZoneDefinition } from './trainingZones';
import { Sport } from '../types';

export interface PhysiologyProfileSnapshot {
  date: string;
  test_id: string | null;
  source: 'lab' | 'manual';
  vo2max_relative_ml_kg_min: number | null;
  lt1_hr: number | null;
  lt1_power: number | null;
  lt2_hr: number | null;
  lt2_power: number | null;
  vam_kmh: number | null;
  pam_watts: number | null;
}

export interface ZoneHistoryEntry {
  date: string;
  source: 'lab_auto_update' | 'manual_override_coach' | 'manual_override_athlete';
  modified_by?: string;
  zones_snapshot: TrainingZone[];
}

export interface AthletePhysiologyProfile {
  id: string;
  athlete_id: string;
  source: 'lab' | 'manual';
  last_test_date: string | null;
  last_test_id: string | null;
  vo2max_absolute_l_min: number | null;
  vo2max_relative_ml_kg_min: number | null;
  vo2max_relative_ml_ffm_min: number | null;
  vo2max_confidence: string | null;
  lt1_hr: number | null;
  lt1_power: number | null;
  lt1_pace: string | null;
  lt1_percent_vo2max: number | null;
  lt1_percent_hrmax: number | null;
  lt1_confidence: string | null;
  lt2_hr: number | null;
  lt2_power: number | null;
  lt2_pace: string | null;
  lt2_percent_vo2max: number | null;
  lt2_percent_hrmax: number | null;
  lt2_confidence: string | null;
  fatmax_hr: number | null;
  fatmax_power: number | null;
  fatmax_pace: string | null;
  fatmax_confidence: string | null;
  vam_kmh: number | null;
  pam_watts: number | null;
  hrmax: number | null;
  physiology_zones: TrainingZone[];
  history: PhysiologyProfileSnapshot[];
  created_at: string;
  updated_at: string;
}

export interface AthleteTrainingZones {
  id: string;
  athlete_id: string;
  mode: 'physiology_based' | 'manual_override';
  locked_to_lab: boolean;
  last_modified_by: 'lab_auto' | 'coach' | 'athlete';
  last_modified_at: string;
  heart_rate_zones: TrainingZone[];
  power_zones: TrainingZone[];
  pace_zones: TrainingZone[];
  physiology_reference: {
    lt1_hr: number | null;
    lt2_hr: number | null;
    lt1_power: number | null;
    lt2_power: number | null;
    lt1_pace: string | null;
    lt2_pace: string | null;
    vam_kmh: number | null;
    pam_watts: number | null;
  };
  zone_history: ZoneHistoryEntry[];
  created_at: string;
  updated_at: string;
}

function buildPhysiologyZones(results: PhysiologyResults): TrainingZone[] {
  const hrmax = results.hrmax;
  const lt1 = results.lt1_hr || Math.round(hrmax * 0.70);
  const lt2 = results.lt2_hr || Math.round(hrmax * 0.90);

  return [
    {
      zone: 1,
      name: 'Zone 1 — Recovery',
      hr_min: Math.round(hrmax * 0.50),
      hr_max: lt1,
      power_min: results.pam_watts ? Math.round(results.pam_watts * 0.40) : undefined,
      power_max: results.lt1_power ? Math.round(results.lt1_power * 0.90) : undefined,
      pace_max: results.lt1_pace || undefined,
      description: '< LT1 — Recovery and base aerobic development'
    },
    {
      zone: 2,
      name: 'Zone 2 — Aerobic',
      hr_min: lt1 + 1,
      hr_max: results.fatmax_hr || Math.round(lt1 * 1.05),
      power_min: results.lt1_power ? Math.round(results.lt1_power * 0.90) + 1 : undefined,
      power_max: results.fatmax_power ? Math.round(results.fatmax_power) : undefined,
      pace_min: results.lt1_pace || undefined,
      pace_max: results.fatmax_pace || undefined,
      description: 'LT1 to FatMax — Aerobic endurance and fat oxidation'
    },
    {
      zone: 3,
      name: 'Zone 3 — Tempo',
      hr_min: (results.fatmax_hr || Math.round(lt1 * 1.05)) + 1,
      hr_max: lt2,
      power_min: results.fatmax_power ? Math.round(results.fatmax_power) + 1 : undefined,
      power_max: results.lt2_power ? Math.round(results.lt2_power * 0.95) : undefined,
      pace_min: results.fatmax_pace || undefined,
      pace_max: results.lt2_pace || undefined,
      description: 'FatMax to LT2 — Tempo and sustained effort'
    },
    {
      zone: 4,
      name: 'Zone 4 — Threshold',
      hr_min: lt2 + 1,
      hr_max: results.vo2max_ml_kg_min
        ? Math.round(hrmax * 0.95)
        : Math.round(lt2 * 1.05),
      power_min: results.lt2_power ? Math.round(results.lt2_power * 0.95) + 1 : undefined,
      power_max: results.pam_watts ? Math.round(results.pam_watts * 0.95) : undefined,
      pace_min: results.lt2_pace || undefined,
      description: 'LT2 to 95% VO2max — Lactate threshold training'
    },
    {
      zone: 5,
      name: 'Zone 5 — VO2max',
      hr_min: results.vo2max_ml_kg_min
        ? Math.round(hrmax * 0.95) + 1
        : Math.round(lt2 * 1.05) + 1,
      hr_max: hrmax,
      power_min: results.pam_watts ? Math.round(results.pam_watts * 0.95) + 1 : undefined,
      power_max: results.pam_watts ? Math.round(results.pam_watts * 1.20) : undefined,
      description: '95% VO2max+ — Maximal aerobic and anaerobic capacity'
    }
  ];
}

export async function fetchAthletePhysiologyProfile(
  athleteId: string
): Promise<AthletePhysiologyProfile | null> {
  const { data, error } = await supabase
    .from('athlete_physiology_profiles')
    .select('*')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching physiology profile:', error);
    return null;
  }
  return data as AthletePhysiologyProfile | null;
}

export async function fetchAthleteTrainingZones(
  athleteId: string
): Promise<AthleteTrainingZones | null> {
  const { data, error } = await supabase
    .from('athlete_training_zones')
    .select('*')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching training zones:', error);
    return null;
  }
  return data as AthleteTrainingZones | null;
}

export async function updateAthletePhysiologyProfile(
  athlete: Athlete,
  test: Test,
  results: PhysiologyResults
): Promise<{ success: boolean; isNewProfile: boolean }> {
  const existing = await fetchAthletePhysiologyProfile(athlete.id);

  const physiologyZones = buildPhysiologyZones(results);

  const snapshot: PhysiologyProfileSnapshot = {
    date: test.test_date,
    test_id: test.id,
    source: 'lab',
    vo2max_relative_ml_kg_min: results.vo2max_ml_kg_min,
    lt1_hr: results.lt1_hr,
    lt1_power: results.lt1_power,
    lt2_hr: results.lt2_hr,
    lt2_power: results.lt2_power,
    vam_kmh: results.vam_kmh,
    pam_watts: results.pam_watts
  };

  const newHistory: PhysiologyProfileSnapshot[] = existing
    ? [snapshot, ...((existing.history as PhysiologyProfileSnapshot[]) || [])]
    : [snapshot];

  const profileData = {
    athlete_id: athlete.id,
    source: 'lab' as const,
    last_test_date: test.test_date,
    last_test_id: test.id,
    vo2max_absolute_l_min: results.vo2max_ml_min ? results.vo2max_ml_min / 1000 : null,
    vo2max_relative_ml_kg_min: results.vo2max_ml_kg_min,
    vo2max_relative_ml_ffm_min: results.vo2max_ml_kg_lbm_min,
    vo2max_confidence: results.vo2max_confidence,
    lt1_hr: results.lt1_hr,
    lt1_power: results.lt1_power,
    lt1_pace: results.lt1_pace,
    lt1_percent_vo2max: results.lt1_percent_vo2max,
    lt1_percent_hrmax: results.lt1_percent_hrmax,
    lt1_confidence: results.lt1_confidence,
    lt2_hr: results.lt2_hr,
    lt2_power: results.lt2_power,
    lt2_pace: results.lt2_pace,
    lt2_percent_vo2max: results.lt2_percent_vo2max,
    lt2_percent_hrmax: results.lt2_percent_hrmax,
    lt2_confidence: results.lt2_confidence,
    fatmax_hr: results.fatmax_hr,
    fatmax_power: results.fatmax_power,
    fatmax_pace: results.fatmax_pace,
    fatmax_confidence: results.fatmax_confidence,
    vam_kmh: results.vam_kmh,
    pam_watts: results.pam_watts,
    hrmax: results.hrmax,
    physiology_zones: physiologyZones,
    history: newHistory,
    updated_at: new Date().toISOString()
  };

  const { error: profileError } = await supabase
    .from('athlete_physiology_profiles')
    .upsert(profileData, { onConflict: 'athlete_id' });

  if (profileError) {
    console.error('Error saving physiology profile:', profileError);
    return { success: false, isNewProfile: !existing };
  }

  const existingZones = await fetchAthleteTrainingZones(athlete.id);

  if (!existingZones || !existingZones.locked_to_lab) {
    const zoneHistoryEntry: ZoneHistoryEntry = {
      date: new Date().toISOString(),
      source: 'lab_auto_update',
      zones_snapshot: physiologyZones
    };

    const zoneHistory: ZoneHistoryEntry[] = existingZones
      ? [zoneHistoryEntry, ...(existingZones.zone_history || [])]
      : [zoneHistoryEntry];

    const hrZones = physiologyZones;
    const powerZones = physiologyZones.filter(z => z.power_min !== undefined || z.power_max !== undefined);
    const paceZones = physiologyZones.filter(z => z.pace_min !== undefined || z.pace_max !== undefined);

    const zonesData = {
      athlete_id: athlete.id,
      mode: 'physiology_based' as const,
      locked_to_lab: false,
      last_modified_by: 'lab_auto' as const,
      last_modified_at: new Date().toISOString(),
      heart_rate_zones: hrZones,
      power_zones: powerZones,
      pace_zones: paceZones,
      physiology_reference: {
        lt1_hr: results.lt1_hr,
        lt2_hr: results.lt2_hr,
        lt1_power: results.lt1_power,
        lt2_power: results.lt2_power,
        lt1_pace: results.lt1_pace,
        lt2_pace: results.lt2_pace,
        vam_kmh: results.vam_kmh,
        pam_watts: results.pam_watts
      },
      zone_history: zoneHistory,
      updated_at: new Date().toISOString()
    };

    const { error: zonesError } = await supabase
      .from('athlete_training_zones')
      .upsert(zonesData, { onConflict: 'athlete_id' });

    if (zonesError) {
      console.error('Error saving training zones:', zonesError);
    }
  }

  await syncPhysiologyToHub(athlete, results, test);

  return { success: true, isNewProfile: !existing };
}

export interface ManualPhysiologyInput {
  vo2max_relative_ml_kg_min: number | null;
  vo2max_absolute_l_min: number | null;
  hrmax: number | null;
  lt1_hr: number | null;
  lt1_power: number | null;
  lt1_pace: string | null;
  lt2_hr: number | null;
  lt2_power: number | null;
  lt2_pace: string | null;
  fatmax_hr: number | null;
  fatmax_power: number | null;
  vam_kmh: number | null;
  pam_watts: number | null;
  zone_mode?: '5' | '7';
  sport?: Sport;
}

function toTrainingZones(zones: ZoneDefinition[]): TrainingZone[] {
  return zones.map(z => ({
    ...z,
    power_min: z.power_min ?? undefined,
    power_max: z.power_max ?? undefined,
  }));
}

function buildZonesFromManualInput(input: ManualPhysiologyInput): TrainingZone[] {
  const hrmax = input.hrmax || 190;
  const sport: Sport = input.sport || 'other';
  const zoneMode = input.zone_mode || '5';

  const dataPoints = buildManualDataPoints(input);
  const zones7 = calculateZones7(input.lt1_hr, input.lt2_hr, hrmax, sport, dataPoints);

  if (zoneMode === '7') {
    return toTrainingZones(zones7);
  }
  return toTrainingZones(convertTo5Zones(zones7, sport));
}

function buildManualDataPoints(
  input: ManualPhysiologyInput
): Array<{ heart_rate: number; power_watts?: number | null; speed_pace?: string | null }> {
  const points: Array<{ heart_rate: number; power_watts?: number | null; speed_pace?: string | null }> = [];

  if (input.lt1_hr) {
    points.push({
      heart_rate: input.lt1_hr,
      power_watts: input.lt1_power ?? null,
      speed_pace: input.lt1_pace ?? null,
    });
  }
  if (input.lt2_hr) {
    points.push({
      heart_rate: input.lt2_hr,
      power_watts: input.lt2_power ?? null,
      speed_pace: input.lt2_pace ?? null,
    });
  }
  if (input.fatmax_hr) {
    points.push({
      heart_rate: input.fatmax_hr,
      power_watts: input.fatmax_power ?? null,
    });
  }
  if (input.pam_watts && input.hrmax) {
    points.push({
      heart_rate: input.hrmax,
      power_watts: input.pam_watts,
    });
  }

  return points;
}

export async function saveManualPhysiologyProfile(
  athleteId: string,
  input: ManualPhysiologyInput
): Promise<{ success: boolean }> {
  const existing = await fetchAthletePhysiologyProfile(athleteId);
  const zones = buildZonesFromManualInput(input);

  const now = new Date().toISOString();

  const snapshot: PhysiologyProfileSnapshot = {
    date: now.slice(0, 10),
    test_id: null,
    source: 'manual',
    vo2max_relative_ml_kg_min: input.vo2max_relative_ml_kg_min,
    lt1_hr: input.lt1_hr,
    lt1_power: input.lt1_power,
    lt2_hr: input.lt2_hr,
    lt2_power: input.lt2_power,
    vam_kmh: input.vam_kmh,
    pam_watts: input.pam_watts
  };

  const newHistory: PhysiologyProfileSnapshot[] = existing
    ? [snapshot, ...((existing.history as PhysiologyProfileSnapshot[]) || [])]
    : [snapshot];

  const profileData = {
    athlete_id: athleteId,
    source: 'manual' as const,
    last_test_date: now.slice(0, 10),
    last_test_id: null,
    vo2max_absolute_l_min: input.vo2max_absolute_l_min,
    vo2max_relative_ml_kg_min: input.vo2max_relative_ml_kg_min,
    vo2max_relative_ml_ffm_min: null,
    vo2max_confidence: 'measured',
    lt1_hr: input.lt1_hr,
    lt1_power: input.lt1_power,
    lt1_pace: input.lt1_pace,
    lt1_percent_vo2max: null,
    lt1_percent_hrmax: input.lt1_hr && input.hrmax ? Math.round((input.lt1_hr / input.hrmax) * 100 * 10) / 10 : null,
    lt1_confidence: 'measured',
    lt2_hr: input.lt2_hr,
    lt2_power: input.lt2_power,
    lt2_pace: input.lt2_pace,
    lt2_percent_vo2max: null,
    lt2_percent_hrmax: input.lt2_hr && input.hrmax ? Math.round((input.lt2_hr / input.hrmax) * 100 * 10) / 10 : null,
    lt2_confidence: 'measured',
    fatmax_hr: input.fatmax_hr,
    fatmax_power: input.fatmax_power,
    fatmax_pace: null,
    fatmax_confidence: 'measured',
    vam_kmh: input.vam_kmh,
    pam_watts: input.pam_watts,
    hrmax: input.hrmax,
    physiology_zones: zones,
    history: newHistory,
    updated_at: now
  };

  const { error: profileError } = await supabase
    .from('athlete_physiology_profiles')
    .upsert(profileData, { onConflict: 'athlete_id' });

  if (profileError) {
    console.error('Error saving manual physiology profile:', profileError);
    return { success: false };
  }

  const existingZones = await fetchAthleteTrainingZones(athleteId);

  if (!existingZones || !existingZones.locked_to_lab) {
    const zoneHistoryEntry: ZoneHistoryEntry = {
      date: now,
      source: 'manual_override_coach',
      modified_by: 'coach',
      zones_snapshot: zones
    };

    const zoneHistory: ZoneHistoryEntry[] = existingZones
      ? [zoneHistoryEntry, ...(existingZones.zone_history || [])]
      : [zoneHistoryEntry];

    const zonesData = {
      athlete_id: athleteId,
      mode: 'manual_override' as const,
      locked_to_lab: false,
      last_modified_by: 'coach' as const,
      last_modified_at: now,
      heart_rate_zones: zones,
      power_zones: zones.filter(z => z.power_min !== undefined || z.power_max !== undefined),
      pace_zones: zones.filter(z => z.pace_min !== undefined || z.pace_max !== undefined),
      physiology_reference: {
        lt1_hr: input.lt1_hr,
        lt2_hr: input.lt2_hr,
        lt1_power: input.lt1_power,
        lt2_power: input.lt2_power,
        lt1_pace: input.lt1_pace,
        lt2_pace: input.lt2_pace,
        vam_kmh: input.vam_kmh,
        pam_watts: input.pam_watts
      },
      zone_history: zoneHistory,
      updated_at: now
    };

    const { error: zonesError } = await supabase
      .from('athlete_training_zones')
      .upsert(zonesData, { onConflict: 'athlete_id' });

    if (zonesError) {
      console.error('Error saving zones from manual profile:', zonesError);
    }
  }

  return { success: true };
}

export async function updateTrainingZonesManual(
  athleteId: string,
  zones: TrainingZone[],
  modifiedBy: 'coach' | 'athlete'
): Promise<boolean> {
  const existing = await fetchAthleteTrainingZones(athleteId);
  if (!existing) return false;

  const zoneHistoryEntry: ZoneHistoryEntry = {
    date: new Date().toISOString(),
    source: modifiedBy === 'coach' ? 'manual_override_coach' : 'manual_override_athlete',
    modified_by: modifiedBy,
    zones_snapshot: zones
  };

  const zoneHistory: ZoneHistoryEntry[] = [zoneHistoryEntry, ...(existing.zone_history || [])];

  const { error } = await supabase
    .from('athlete_training_zones')
    .update({
      mode: 'manual_override',
      last_modified_by: modifiedBy,
      last_modified_at: new Date().toISOString(),
      heart_rate_zones: zones,
      zone_history: zoneHistory,
      updated_at: new Date().toISOString()
    })
    .eq('athlete_id', athleteId);

  return !error;
}

export async function lockZonesToLab(athleteId: string, locked: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('athlete_training_zones')
    .update({
      locked_to_lab: locked,
      updated_at: new Date().toISOString()
    })
    .eq('athlete_id', athleteId);

  return !error;
}

function getHubClient() {
  const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
  const hubKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;
  if (!hubUrl || !hubKey) return null;
  return createClient(hubUrl, hubKey);
}

async function syncPhysiologyToHub(
  athlete: Athlete,
  results: PhysiologyResults,
  test: Test
): Promise<void> {
  if (!athlete.hub_user_id) return;

  const hub = getHubClient();
  if (!hub) return;

  try {
    const profilePayload = {
      hub_user_id: athlete.hub_user_id,
      lab_last_test_date: test.test_date,
      lab_vo2max_relative: results.vo2max_ml_kg_min,
      lab_vo2max_absolute: results.vo2max_ml_min ? results.vo2max_ml_min / 1000 : null,
      lab_lt1_hr: results.lt1_hr,
      lab_lt1_power: results.lt1_power,
      lab_lt1_pace: results.lt1_pace,
      lab_lt2_hr: results.lt2_hr,
      lab_lt2_power: results.lt2_power,
      lab_lt2_pace: results.lt2_pace,
      lab_fatmax_hr: results.fatmax_hr,
      lab_vam_kmh: results.vam_kmh,
      lab_pam_watts: results.pam_watts,
      lab_hrmax: results.hrmax,
      lab_training_zones: results.training_zones,
      lab_updated_at: new Date().toISOString()
    };

    const { error } = await hub
      .from('profiles')
      .update(profilePayload)
      .eq('hub_user_id', athlete.hub_user_id);

    if (error) {
      console.warn('Hub sync skipped (columns may not exist yet):', error.message);
    }
  } catch (e) {
    console.warn('Hub sync failed gracefully:', e);
  }
}
