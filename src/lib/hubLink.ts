import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

let hubClient: SupabaseClient | null = null;

function getHubClient(): SupabaseClient | null {
  const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
  const hubKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;

  if (!hubUrl || !hubKey) {
    return null;
  }

  if (!hubClient) {
    hubClient = createClient(hubUrl, hubKey);
  }

  return hubClient;
}

/**
 * Creates a Hub Supabase client authenticated with the user's Hub JWT token.
 * This makes Hub RLS apply correctly — coaches see their athletes, admins see all.
 * Without this, queries run as anon and Hub RLS only returns own profile.
 */
export function getAuthenticatedHubClient(): SupabaseClient | null {
  const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
  const hubKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;

  if (!hubUrl || !hubKey) return null;

  const token = localStorage.getItem('hub_session_token');

  return createClient(hubUrl, hubKey, {
    global: {
      headers: token
        ? { Authorization: `Bearer ${token}`, apikey: hubKey }
        : { apikey: hubKey },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface HubProfile {
  id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

export async function fetchHubProfile(externalHubUserId: string): Promise<HubProfile | null> {
  const client = getHubClient();

  if (!client) {
    console.warn('HUB client not configured');
    return null;
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', externalHubUserId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching HUB profile:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Failed to fetch HUB profile:', err);
    return null;
  }
}

export function isHubLinkingEnabled(): boolean {
  return getHubClient() !== null;
}

export async function searchHubProfilesByEmail(email: string): Promise<HubProfile[]> {
  const client = getHubClient();

  if (!client || !email.trim()) {
    return [];
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .ilike('email', `%${email}%`)
      .limit(20);

    if (error) {
      console.error('Error searching HUB profiles:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Failed to search HUB profiles:', err);
    return [];
  }
}

export async function fetchAllHubProfiles(): Promise<HubProfile[]> {
  const client = getHubClient();

  if (!client) {
    return [];
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .order('full_name');

    if (error) {
      console.error('Error fetching all HUB profiles:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Failed to fetch all HUB profiles:', err);
    return [];
  }
}

export interface HubAnthropometryData {
  id: string;
  athlete_id: string;
  measurement_date: string;
  sex?: string;
  date_of_birth?: string;
  weight_m1?: number;
  weight_m2?: number;
  weight_m3?: number;
  height_m1?: number;
  height_m2?: number;
  height_m3?: number;
  kerr_body_composition?: {
    fat_mass_kg?: number;
    lean_body_mass_kg?: number;
    body_fat_percent?: number;
  }[];
}

export interface HubBodyComposition {
  id: string;
  athlete_id: string;
  measurement_date: string;
  body_weight: number;
  fat_mass_kg?: number;
  fat_mass_pct?: number;
  muscle_mass_kg?: number;
  muscle_mass_pct?: number;
  bone_mass_kg?: number;
  bone_mass_pct?: number;
  skin_mass_kg?: number;
  skin_mass_pct?: number;
  residual_mass_kg?: number;
  residual_mass_pct?: number;
  calculation_method?: string;
  notes?: string;
}

function calculateMedian(values: (number | null | undefined)[]): number | undefined {
  const validValues = values.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));

  if (validValues.length === 0) return undefined;

  const sorted = [...validValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export async function fetchHubAnthropometry(athleteId: string): Promise<{
  success: boolean;
  data?: {
    weight_kg?: number;
    height_cm?: number;
    age?: number;
    sex?: string;
    bodyFatPercent?: number;
    leanBodyMassKg?: number;
    measurementDate?: string;
  };
  error?: string;
}> {
  const client = getHubClient();

  if (!client) {
    return { success: false, error: 'HUB client not configured' };
  }

  try {
    const { data, error } = await client
      .from('anthropometry_measurements')
      .select(`
        *,
        kerr_body_composition(
          fat_mass_kg,
          lean_body_mass_kg,
          body_fat_percent
        )
      `)
      .eq('athlete_id', athleteId)
      .order('measurement_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      const { data: dataSimple, error: errorSimple } = await client
        .from('anthropometry_measurements')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('measurement_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorSimple) {
        return { success: false, error: errorSimple.message };
      }

      if (!dataSimple) {
        return { success: false, error: 'No anthropometry data found in HUB' };
      }

      const measurementSimple = dataSimple as HubAnthropometryData;
      const weight_kg_s = calculateMedian([
        measurementSimple.weight_m1,
        measurementSimple.weight_m2,
        measurementSimple.weight_m3
      ]);
      const height_cm_s = calculateMedian([
        measurementSimple.height_m1,
        measurementSimple.height_m2,
        measurementSimple.height_m3
      ]);

      return {
        success: true,
        data: {
          weight_kg: weight_kg_s,
          height_cm: height_cm_s,
          age: undefined,
          sex: measurementSimple.sex,
          bodyFatPercent: undefined,
          leanBodyMassKg: undefined,
          measurementDate: measurementSimple.measurement_date
        }
      };
    }

    if (!data) {
      return { success: false, error: 'No anthropometry data found in HUB' };
    }

    const measurement = data as HubAnthropometryData;

    const weight_kg = calculateMedian([
      measurement.weight_m1,
      measurement.weight_m2,
      measurement.weight_m3
    ]);

    const height_cm = calculateMedian([
      measurement.height_m1,
      measurement.height_m2,
      measurement.height_m3
    ]);

    let age: number | undefined;
    if (measurement.date_of_birth) {
      const today = new Date();
      const birthDate = new Date(measurement.date_of_birth);
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    const kerrData = Array.isArray(measurement.kerr_body_composition) && measurement.kerr_body_composition.length > 0
      ? measurement.kerr_body_composition[0]
      : undefined;

    return {
      success: true,
      data: {
        weight_kg,
        height_cm,
        age,
        sex: measurement.sex,
        bodyFatPercent: kerrData?.body_fat_percent,
        leanBodyMassKg: kerrData?.lean_body_mass_kg,
        measurementDate: measurement.measurement_date
      }
    };
  } catch (err) {
    console.error('Failed to fetch HUB anthropometry:', err);
    return { success: false, error: 'Failed to fetch anthropometry from HUB' };
  }
}

export async function fetchHubBodyComposition(athleteId: string): Promise<{
  success: boolean;
  data?: HubBodyComposition[];
  error?: string;
}> {
  const client = getHubClient();

  if (!client) {
    return { success: false, error: 'HUB client not configured' };
  }

  try {
    const { data, error } = await client
      .from('kerr_body_composition')
      .select('*')
      .eq('athlete_id', athleteId)
      .order('measurement_date', { ascending: false });

    if (error) {
      console.error('Error fetching HUB body composition:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data || []
    };
  } catch (err) {
    console.error('Failed to fetch HUB body composition:', err);
    return { success: false, error: 'Failed to fetch body composition from HUB' };
  }
}

export interface HubAthleteProfile {
  id: string;
  email?: string;
  full_name?: string;
  sport?: string;
  date_of_birth?: string;
  sex?: string;
  coach_id?: string;
}

/**
 * Fetches all athletes assigned to a coach from the Hub.
 *
 * Strategy:
 * 1. Primary: call hub-data-proxy/coach-athletes edge function which forwards to
 *    Hub's planner-hub-api/coach-athletes using X-Planner-Token (bypasses Hub RLS).
 * 2. Fallback: query Hub profiles directly via authenticated Hub client.
 */
export async function fetchHubCoachAthletes(coachHubUserId: string): Promise<HubAthleteProfile[]> {
  if (!coachHubUserId) return [];

  // Primary: use hub-data-proxy which has X-Planner-Token access
  const proxyResult = await fetchCoachAthletesViaProxy(coachHubUserId);
  if (proxyResult.length > 0) return proxyResult;

  // Fallback: direct Hub query (may be limited by Hub RLS)
  const client = getAuthenticatedHubClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, email, full_name, sport, date_of_birth, sex, coach_id')
      .eq('coach_id', coachHubUserId)
      .eq('role', 'athlete');

    if (error) {
      console.warn('[HUB] fetchHubCoachAthletes direct query failed:', error.message);
      return [];
    }

    return (data || []).map(a => ({
      id: a.id as string,
      email: a.email as string | undefined,
      full_name: a.full_name as string | undefined,
      sport: a.sport as string | undefined,
      date_of_birth: a.date_of_birth as string | undefined,
      sex: a.sex as string | undefined,
      coach_id: a.coach_id as string | undefined,
    }));
  } catch (err) {
    console.warn('[HUB] fetchHubCoachAthletes exception:', err);
    return [];
  }
}

async function fetchCoachAthletesViaProxy(coachHubUserId: string): Promise<HubAthleteProfile[]> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return [];

    const token = localStorage.getItem('hub_session_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${supabaseUrl}/functions/v1/hub-data-proxy/coach-athletes?coach_id=${encodeURIComponent(coachHubUserId)}`;
    const response = await fetch(url, { method: 'GET', headers });

    if (!response.ok) {
      console.warn('[HUB] proxy coach-athletes returned', response.status);
      return [];
    }

    const data = await response.json();
    const athletes = Array.isArray(data) ? data : (data?.athletes || data?.data || []);

    return athletes.map((a: any) => ({
      id: a.id || a.user_id || '',
      email: a.email || undefined,
      full_name: a.full_name || a.name || undefined,
      sport: a.sport || a.sport_primary || undefined,
      date_of_birth: a.date_of_birth || undefined,
      sex: a.sex || undefined,
      coach_id: a.coach_id || undefined,
    }));
  } catch (err) {
    console.warn('[HUB] fetchCoachAthletesViaProxy error:', err);
    return [];
  }
}

/**
 * Syncs Hub athletes into the local athletes table.
 * For each Hub athlete not yet in the local DB:
 * 1. If an athlete with the same email exists, link it by setting hub_user_id.
 * 2. Otherwise, insert a new athlete record.
 * This avoids unique-constraint violations on both hub_user_id and email.
 */
export async function syncHubAthletesToLocal(
  hubAthletes: HubAthleteProfile[],
  coachProfileId: string | null
): Promise<number> {
  if (!hubAthletes.length || !coachProfileId) return 0;

  // Fetch all local athletes' hub_user_id and email in one query
  const { data: localAthletes, error: fetchErr } = await supabase
    .from('athletes')
    .select('id, hub_user_id, email');

  if (fetchErr) {
    console.error('[HUB sync] Failed to fetch local athletes:', fetchErr);
    return 0;
  }

  const localHubIds = new Set((localAthletes || []).map(a => a.hub_user_id).filter(Boolean));
  const localEmailMap = new Map((localAthletes || []).filter(a => a.email && !a.hub_user_id).map(a => [a.email!, a.id]));

  const missing = hubAthletes.filter(ha => !localHubIds.has(ha.id));
  if (!missing.length) return 0;

  let synced = 0;

  // Phase 1: link existing athletes by email
  const toLink = missing.filter(ha => ha.email && localEmailMap.has(ha.email));
  for (const ha of toLink) {
    const localId = localEmailMap.get(ha.email!)!;
    const { error: updateErr } = await supabase
      .from('athletes')
      .update({
        hub_user_id: ha.id,
        name: ha.full_name || undefined,
        sport: ha.sport || undefined,
      })
      .eq('id', localId);
    if (updateErr) {
      console.error(`[HUB sync] Failed to link ${ha.email}:`, updateErr);
    } else {
      synced++;
    }
  }

  // Phase 2: insert truly new athletes
  const linkedEmails = new Set(toLink.map(ha => ha.email!));
  const toInsert = missing
    .filter(ha => !linkedEmails.has(ha.email || ''))
    .map(ha => ({
      name: ha.full_name || ha.email || 'Hub Athlete',
      email: ha.email || null,
      sport: ha.sport || 'other',
      date_of_birth: ha.date_of_birth || null,
      sex: ha.sex || null,
      hub_user_id: ha.id,
      coach_id: coachProfileId,
    }));

  if (toInsert.length) {
    const { error: insertErr } = await supabase
      .from('athletes')
      .upsert(toInsert, { onConflict: 'hub_user_id' });
    if (insertErr) {
      console.error('[HUB sync] Insert error:', insertErr);
    } else {
      synced += toInsert.length;
    }
  }

  return synced;
}


