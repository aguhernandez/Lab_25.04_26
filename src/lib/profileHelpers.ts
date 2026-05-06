import { supabase } from './supabase';
import { fetchHubProfile, HubProfile } from './hubLink';
import type { Profile } from '../types';

export interface ProfileWithHubData extends Profile {
  hubProfile?: HubProfile | null;
}

export async function getProfile(userId: string): Promise<ProfileWithHubData | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  if (!profile) {
    return null;
  }

  if (profile.hub_user_id) {
    const hubProfile = await fetchHubProfile(profile.hub_user_id);
    return {
      ...profile,
      hubProfile,
    };
  }

  return profile;
}

export async function updateHubUserId(
  userId: string,
  hubUserId: string | null
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      hub_user_id: hubUserId,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating hub_user_id:', error);
    return null;
  }

  return data;
}

export async function createProfile(userId: string, hubUserId?: string | null): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: userId,
      hub_user_id: hubUserId || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating profile:', error);
    return null;
  }

  return data;
}
