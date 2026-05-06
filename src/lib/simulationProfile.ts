import { supabase } from './supabase';
import { fetchAthletePhysiologyProfile } from './physiologyProfile';
import type { Athlete, TestResults } from '../types';
import type { AthletePhysioProfile } from './simulationEngine';


export async function loadSimulationProfile(
  athlete: Athlete
): Promise<AthletePhysioProfile> {
  const base: AthletePhysioProfile = {
    vo2max: 50,
    weight_kg: athlete.weight_kg ?? 70,
  };

  const physProfile = await fetchAthletePhysiologyProfile(athlete.id);

  if (physProfile) {
    const hrmax = physProfile.hrmax ?? undefined;

    let runningEconomy: number | undefined;
    const { data: latestResults } = await supabase
      .from('test_results')
      .select('advanced_metrics, vo2max')
      .in(
        'test_id',
        (await supabase
          .from('tests')
          .select('id')
          .eq('athlete_id', athlete.id)
          .eq('status', 'completed')
          .order('test_date', { ascending: false })
          .limit(5)
        ).data?.map(t => t.id) ?? []
      )
      .not('vo2max', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const r = latestResults?.[0] as TestResults | undefined;
    const re = r?.advanced_metrics?.movementEconomy?.running?.cost_per_km_ml_o2_kg;
    if (re && re > 150 && re < 300) runningEconomy = re;

    return {
      vo2max: physProfile.vo2max_relative_ml_kg_min ?? base.vo2max,
      weight_kg: athlete.weight_kg ?? 70,
      lt1_hr: physProfile.lt1_hr ?? undefined,
      lt2_hr: physProfile.lt2_hr ?? undefined,
      lt1_power: physProfile.lt1_power ?? undefined,
      lt2_power: physProfile.lt2_power ?? undefined,
      lt1_pace: physProfile.lt1_pace ?? undefined,
      lt2_pace: physProfile.lt2_pace ?? undefined,
      hr_max: hrmax,
      running_economy: runningEconomy,
      lt1_vo2: physProfile.lt1_percent_vo2max
        ? parseFloat(((physProfile.lt1_percent_vo2max / 100) * (physProfile.vo2max_relative_ml_kg_min ?? 50)).toFixed(1))
        : undefined,
      lt2_vo2: physProfile.lt2_percent_vo2max
        ? parseFloat(((physProfile.lt2_percent_vo2max / 100) * (physProfile.vo2max_relative_ml_kg_min ?? 50)).toFixed(1))
        : undefined,
    };
  }

  const { data: tests } = await supabase
    .from('tests')
    .select('id')
    .eq('athlete_id', athlete.id)
    .eq('status', 'completed')
    .order('test_date', { ascending: false })
    .limit(5);

  if (!tests || tests.length === 0) return base;

  const { data: results } = await supabase
    .from('test_results')
    .select('*')
    .in('test_id', tests.map(t => t.id))
    .not('vo2max', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const r = results?.[0] as TestResults | undefined;
  if (!r) return base;

  const re = r?.advanced_metrics?.movementEconomy?.running?.cost_per_km_ml_o2_kg;

  return {
    vo2max: r.vo2max ?? 50,
    weight_kg: athlete.weight_kg ?? 70,
    lt1_hr: r.lt1_hr ?? undefined,
    lt2_hr: r.lt2_hr ?? undefined,
    lt1_power: r.lt1_power ?? undefined,
    lt2_power: r.lt2_power ?? undefined,
    fatmax_hr: r.fatmax_hr ?? undefined,
    running_economy: re && re > 150 && re < 300 ? re : undefined,
  };
}

export function buildProfileSummary(profile: AthletePhysioProfile, lang: 'en' | 'es' = 'en'): string[] {
  const items: string[] = [];
  if (profile.lt1_hr) items.push(`LT1: ${profile.lt1_hr} bpm`);
  if (profile.lt2_hr) items.push(`LT2: ${profile.lt2_hr} bpm`);
  if (profile.lt2_pace) items.push(`${lang === 'es' ? 'Ritmo LT2' : 'LT2 Pace'}: ${profile.lt2_pace}/km`);
  if (profile.hr_max) items.push(`${lang === 'es' ? 'FCmax' : 'HRmax'}: ${profile.hr_max} bpm`);
  if (profile.running_economy) items.push(`RE: ${profile.running_economy} mlO2/kg/km`);
  return items;
}
