import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
      console.error('Error fetching HUB anthropometry:', error);
      return { success: false, error: error.message };
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
 * Hub schema: `profiles` table uses `assigned_trainer_id` for the coach FK,
 * `gender` instead of `sex`, and has `sport`, `date_of_birth`, etc.
 */
export async function fetchHubCoachAthletes(coachHubUserId: string): Promise<HubAthleteProfile[]> {
  if (!coachHubUserId) return [];

  const client = getAuthenticatedHubClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, email, full_name, sport, date_of_birth, gender, assigned_trainer_id')
      .eq('assigned_trainer_id', coachHubUserId)
      .eq('role', 'athlete');

    if (error) {
      console.warn('[HUB] fetchHubCoachAthletes query failed:', error.message);
      return [];
    }

    return (data || []).map(a => ({
      id: a.id as string,
      email: a.email as string | undefined,
      full_name: a.full_name as string | undefined,
      sport: a.sport as string | undefined,
      date_of_birth: a.date_of_birth as string | undefined,
      sex: (a.gender === 'male' || a.gender === 'female') ? a.gender : undefined,
      coach_id: a.assigned_trainer_id as string | undefined,
    }));
  } catch (err) {
    console.warn('[HUB] fetchHubCoachAthletes exception:', err);
    return [];
  }
}


