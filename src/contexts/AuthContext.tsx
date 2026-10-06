import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSatelliteAuth, MembershipSlug } from '../hooks/useSatelliteAuth';
import { supabase } from '../lib/supabase';

interface HubUser {
  id: string;
  email: string;
  name?: string;
  role: 'athlete' | 'trainer' | 'admin';
  active_plan?: string[];
  membership_slug: MembershipSlug;
  membership_name: string;
}

export interface LocalProfile {
  id: string;
  user_id: string | null;
  hub_user_id: string | null;
  role: string;
  full_name: string | null;
  email: string;
  membership_slug: MembershipSlug;
  membership_name: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: HubUser | null;
  profile: LocalProfile | null;
  loading: boolean;
  hasToken: boolean;
  isDevMode: boolean;
  login: () => void;
  logout: () => Promise<void>;
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  selectProfile: (profileId: string) => Promise<void>;
  setDevProfile: (profile: LocalProfile) => void;
  setUser: (user: HubUser) => void;
  setProfile: (profile: LocalProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USE_LOCAL_AUTH = import.meta.env.VITE_USE_LOCAL_AUTH === 'true';
const FORCE_DEV_MODE = import.meta.env.VITE_FORCE_DEV_MODE === 'true';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<LocalProfile | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);

  const { user: hubUser, loading: hubLoading, hasToken, login: hubLogin, logout: hubLogout, loginWithCredentials: hubLoginWithCredentials } = useSatelliteAuth();

  const [user, setUserState] = useState<HubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [localHasToken, setLocalHasToken] = useState(false);

  useEffect(() => {
    const devMode = USE_LOCAL_AUTH || FORCE_DEV_MODE;
    setIsDevMode(devMode);

    if (devMode) {
      const savedProfileId = localStorage.getItem('local_profile_id');
      if (savedProfileId) {
        selectProfile(savedProfileId);
      } else {
        setLoading(false);
      }
    } else {
      setUserState(hubUser);
      setLoading(hubLoading);
      setLocalHasToken(hasToken);
    }
  }, [hubUser, hubLoading, hasToken]);

  useEffect(() => {
    if (!isDevMode && hubUser && !hubLoading) {
      syncProfile(hubUser);
    }
  }, [hubUser, hubLoading, isDevMode]);

  const syncProfile = async (hubUser: HubUser) => {
    try {
      const normalizedRole = hubUser.role === 'trainer' ? 'coach' : hubUser.role;

      // Use SECURITY DEFINER RPC to bypass anon RLS restrictions on profiles table
      const { data: profileList, error: fetchError } = await supabase
        .rpc('get_profile_by_hub_id', { hub_id: hubUser.id });

      if (fetchError) {
        console.error('❌ Error fetching profile by hub_user_id:', fetchError);
        return;
      }

      const existingProfile = profileList?.[0] ?? null;

      if (existingProfile) {
        await supabase
          .from('profiles')
          .update({
            membership_slug: hubUser.membership_slug,
            membership_name: hubUser.membership_name,
            role: normalizedRole,
            email: hubUser.email,
            full_name: existingProfile.full_name || hubUser.name || hubUser.email,
          })
          .eq('id', existingProfile.id);

        setProfileState({
          ...existingProfile,
          membership_slug: hubUser.membership_slug,
          membership_name: hubUser.membership_name,
          role: normalizedRole,
          email: hubUser.email,
        });
        return;
      }

      const { data: profileByEmail, error: emailFetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', hubUser.email)
        .is('hub_user_id', null)
        .maybeSingle();

      if (!emailFetchError && profileByEmail) {
        await supabase
          .from('profiles')
          .update({
            hub_user_id: hubUser.id,
            membership_slug: hubUser.membership_slug,
            membership_name: hubUser.membership_name,
            role: normalizedRole,
          })
          .eq('id', profileByEmail.id);

        setProfileState({
          ...profileByEmail,
          hub_user_id: hubUser.id,
          membership_slug: hubUser.membership_slug,
          membership_name: hubUser.membership_name,
          role: normalizedRole,
        });
        return;
      }

      const { data: profileByRole, error: roleFetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', normalizedRole)
        .is('hub_user_id', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!roleFetchError && profileByRole && normalizedRole === 'admin') {
        await supabase
          .from('profiles')
          .update({
            hub_user_id: hubUser.id,
            email: hubUser.email,
            full_name: profileByRole.full_name || hubUser.name || hubUser.email,
            membership_slug: hubUser.membership_slug,
            membership_name: hubUser.membership_name,
          })
          .eq('id', profileByRole.id);

        setProfileState({
          ...profileByRole,
          hub_user_id: hubUser.id,
          email: hubUser.email,
          membership_slug: hubUser.membership_slug,
          membership_name: hubUser.membership_name,
        });
        return;
      }

      const { error: createError } = await supabase
        .from('profiles')
        .insert({
          hub_user_id: hubUser.id,
          email: hubUser.email,
          full_name: hubUser.name || hubUser.email,
          role: normalizedRole,
          user_id: null,
          membership_slug: hubUser.membership_slug,
          membership_name: hubUser.membership_name,
        });

      if (createError) {
        console.error('❌ Error creating profile:', createError, JSON.stringify(createError));
        return;
      }

      const { data: newProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('hub_user_id', hubUser.id)
        .maybeSingle();

      if (newProfile) {
        setProfileState(newProfile);
      }
    } catch (error) {
      console.error('💥 Profile sync failed:', error);
    }
  };

  async function selectProfile(profileId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();

      if (error || !data) {
        console.error('Error loading profile:', error);
        setProfileState(null);
        setUserState(null);
        return;
      }

      setProfileState(data);
      setUserState({
        id: data.hub_user_id || data.id,
        email: data.email || data.full_name || 'Local User',
        role: data.role === 'coach' ? 'trainer' : data.role,
        active_plan: [],
        membership_slug: (data.membership_slug as MembershipSlug) || 'inicia',
        membership_name: data.membership_name || 'Inicia',
      });
      localStorage.setItem('local_profile_id', profileId);
    } catch (error) {
      console.error('Error selecting profile:', error);
    } finally {
      setLoading(false);
    }
  }

  const loginWithCredentials = async (email: string, password: string): Promise<void> => {
    await hubLoginWithCredentials(email, password);
  };

  const login = () => {
    if (isDevMode) {
      return;
    }
    hubLogin();
  };

  const logout = async () => {
    if (isDevMode) {
      localStorage.removeItem('local_profile_id');
      setUserState(null);
      setProfileState(null);
      window.location.replace('/');
      return;
    }
    hubLogout();
  };

  const setDevProfile = (devProfile: LocalProfile) => {
    setProfileState(devProfile);
    setUserState({
      id: devProfile.hub_user_id || devProfile.id,
      email: devProfile.email || devProfile.full_name || 'User',
      role: devProfile.role === 'coach' ? 'trainer' : (devProfile.role as 'athlete' | 'trainer' | 'admin'),
      membership_slug: devProfile.membership_slug || 'inicia',
      membership_name: devProfile.membership_name || 'Inicia',
    });
  };

  const setUser = (newUser: HubUser) => {
    setUserState(newUser);
  };

  const setProfile = (newProfile: LocalProfile) => {
    setProfileState(newProfile);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      hasToken: localHasToken,
      isDevMode,
      login,
      logout,
      loginWithCredentials,
      selectProfile,
      setDevProfile,
      setUser,
      setProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
