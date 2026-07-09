import { supabase } from './supabase';
import { getAuthenticatedHubClient } from './hubLink';


export type UserRole = 'admin' | 'coach' | 'athlete';

export interface HubProfile {
  user_id: string;
  role: UserRole;
  full_name?: string;
  email?: string;
}

export interface LocalProfile {
  user_id: string;
  role: UserRole;
  full_name?: string;
  hub_user_id?: string;
}

export async function getHubAdminsAndCoaches(): Promise<HubProfile[]> {
  try {
    const client = getAuthenticatedHubClient();
    if (!client) {
      console.error('HUB client not configured');
      return [];
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, role, full_name, email')
      .in('role', ['admin', 'coach', 'trainer']);

    if (error) {
      console.error('Error fetching HUB profiles:', error);
      console.error('Supabase request failed', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }

    return (data || []).map(profile => ({
      user_id: profile.id,
      role: profile.role === 'trainer' ? 'coach' : profile.role,
      full_name: profile.full_name,
      email: profile.email,
    }));
  } catch (err) {
    console.error('Unexpected error fetching HUB profiles:', err);
    return [];
  }
}

export async function syncHubUserToLocal(hubUserId: string, email: string): Promise<LocalProfile | null> {
  const hubAuthClient = getAuthenticatedHubClient();
  if (!hubAuthClient) {
    console.error('HUB client not configured');
    return null;
  }

  const { data: hubProfile, error: hubError } = await hubAuthClient
    .from('profiles')
    .select('id, role, full_name, email')
    .eq('id', hubUserId)
    .maybeSingle();

  if (hubError || !hubProfile) {
    console.error('Error fetching HUB profile:', hubError);
    return null;
  }

  const mappedRole = hubProfile.role === 'trainer' ? 'coach' : hubProfile.role;

  const { data: existingLocal } = await supabase
    .from('profiles')
    .select('*')
    .eq('hub_user_id', hubUserId)
    .maybeSingle();

  if (existingLocal) {
    return existingLocal;
  }

  const { data: localUser, error: localUserError } = await supabase.auth.signUp({
    email,
    password: Math.random().toString(36).slice(-16),
    options: {
      data: {
        full_name: hubProfile.full_name || '',
        hub_linked: true,
      }
    }
  });

  if (localUserError || !localUser.user) {
    console.error('Error creating local user:', localUserError);
    return null;
  }

  const { data: newProfile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: localUser.user.id,
      role: mappedRole,
      full_name: hubProfile.full_name,
      hub_user_id: hubUserId,
    })
    .select()
    .single();

  if (profileError) {
    console.error('Error creating local profile:', profileError);
    return null;
  }

  return newProfile;
}

export async function loginWithCredentials(email: string, password: string) {
  const { data: localAuth, error: localError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!localError && localAuth.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', localAuth.user.id)
      .maybeSingle();

    return {
      user: localAuth.user,
      profile,
      source: 'local' as const,
    };
  }

  try {
    const hubAuthUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hub-auth`;
    const hubAuthResponse = await fetch(hubAuthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const hubAuthData = await hubAuthResponse.json();

    if (!hubAuthResponse.ok || !hubAuthData.success) {
      throw new Error('Invalid credentials');
    }

    const { data: finalAuth, error: finalError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (finalError || !finalAuth.user) {
      throw new Error('Authentication failed');
    }

    const { data: finalProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', finalAuth.user.id)
      .maybeSingle();

    return {
      user: finalAuth.user,
      profile: finalProfile,
      source: 'hub' as const,
    };
  } catch (error) {
    throw new Error('Invalid credentials');
  }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  return { user, profile };
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getHubAthletes(): Promise<HubProfile[]> {
  try {
    const client = getAuthenticatedHubClient();
    if (!client) {
      console.error('HUB client not configured');
      return [];
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, role, full_name, email')
      .eq('role', 'athlete');

    if (error) {
      console.error('Error fetching HUB athletes:', error);
      return [];
    }

    return (data || []).map(profile => ({
      user_id: profile.id,
      role: profile.role,
      full_name: profile.full_name,
      email: profile.email,
    }));
  } catch (err) {
    console.error('Unexpected error fetching HUB athletes:', err);
    return [];
  }
}

export async function importAthleteFromHub(hubUserId: string, email: string, full_name: string): Promise<boolean> {
  try {
    const { data: existingAthlete } = await supabase
      .from('athletes')
      .select('*')
      .eq('hub_user_id', hubUserId)
      .maybeSingle();

    if (existingAthlete) {
      const { error: updateError } = await supabase
        .from('athletes')
        .update({
          name: full_name || 'Athlete',
          email: email,
        })
        .eq('hub_user_id', hubUserId);

      if (updateError) {
        console.error('Error updating athlete:', updateError);
        return false;
      }

      return true;
    }

    const { data: newAthlete, error: athleteError } = await supabase
      .from('athletes')
      .insert({
        name: full_name || 'Athlete',
        email: email,
        hub_user_id: hubUserId,
      })
      .select()
      .maybeSingle();

    if (athleteError || !newAthlete) {
      console.error('Error creating athlete:', athleteError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error importing athlete from HUB:', error);
    return false;
  }
}

export async function checkImportedAthletes(hubUserIds: string[]): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('athletes')
      .select('hub_user_id')
      .in('hub_user_id', hubUserIds);

    if (error) {
      console.error('Error checking imported athletes:', error);
      return new Set();
    }

    return new Set((data || []).map(a => a.hub_user_id).filter(Boolean));
  } catch (error) {
    console.error('Error checking imported athletes:', error);
    return new Set();
  }
}

export async function importAdminOrCoachFromHub(hubUserId: string, email: string): Promise<boolean> {
  const profile = await syncHubUserToLocal(hubUserId, email);
  return profile !== null;
}

export async function checkImportedAdminsAndCoaches(hubUserIds: string[]): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('hub_user_id')
      .in('hub_user_id', hubUserIds)
      .in('role', ['admin', 'coach']);

    if (error) {
      console.error('Error checking imported admins/coaches:', error);
      return new Set();
    }

    return new Set((data || []).map(p => p.hub_user_id).filter(Boolean));
  } catch (error) {
    console.error('Error checking imported admins/coaches:', error);
    return new Set();
  }
}

export async function getAllHubProfiles(): Promise<HubProfile[]> {
  try {
    const client = getAuthenticatedHubClient();
    if (!client) {
      console.error('HUB client not configured');
      return [];
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, role, full_name, email')
      .order('full_name');

    if (error) {
      console.error('Error fetching all HUB profiles:', error);
      return [];
    }

    return (data || []).map(profile => ({
      user_id: profile.id,
      role: profile.role === 'trainer' ? 'coach' : profile.role,
      full_name: profile.full_name,
      email: profile.email,
    }));
  } catch (err) {
    console.error('Unexpected error fetching all HUB profiles:', err);
    return [];
  }
}

export async function importHubProfileAsCoach(
  hubUserId: string,
  email: string,
  fullName: string,
  role: UserRole = 'coach'
): Promise<boolean> {
  try {
    const hubAuthClient = getAuthenticatedHubClient();
    if (!hubAuthClient) return false;

    const { data: existingLocal } = await supabase
      .from('profiles')
      .select('*')
      .eq('hub_user_id', hubUserId)
      .maybeSingle();

    if (existingLocal) {
      await supabase.from('profiles').update({ role, full_name: fullName || existingLocal.full_name }).eq('hub_user_id', hubUserId);
      return true;
    }

    const { data: localUser, error: localUserError } = await supabase.auth.signUp({
      email,
      password: Math.random().toString(36).slice(-16),
      options: { data: { full_name: fullName || '', hub_linked: true } }
    });

    if (localUserError || !localUser.user) {
      console.error('Error creating local user:', localUserError);
      return false;
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: localUser.user.id,
      role,
      full_name: fullName,
      hub_user_id: hubUserId,
    });

    if (profileError) {
      console.error('Error creating local profile:', profileError);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error importing hub profile as coach:', err);
    return false;
  }
}

export async function checkImportedHubProfiles(hubUserIds: string[]): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('hub_user_id')
      .in('hub_user_id', hubUserIds);

    if (error) return new Set();
    return new Set((data || []).map(p => p.hub_user_id).filter(Boolean));
  } catch {
    return new Set();
  }
}

