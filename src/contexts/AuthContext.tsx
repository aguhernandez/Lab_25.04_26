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

      // Try multiple lookup strategies to find the existing profile
      let existingProfile: Record<string, unknown> | null = null;

      const { data: byHubId } = await supabase
        .from('profiles')
        .select('*')
        .eq('hub_user_id', hubUser.id)
        .maybeSingle();
      existingProfile = byHubId;

      if (!existingProfile) {
        const { data: byEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', hubUser.email)
          .maybeSingle();
        existingProfile = byEmail;
      }

      if (!existingProfile && hubUser.name) {
        const { data: byName } = await supabase
          .from('profiles')
          .select('*')
          .eq('full_name', hubUser.email)
          .maybeSingle();
        existingProfile = byName;
      }

      if (existingProfile) {
        await supabase
          .from('profiles')
          .update({
            hub_user_id: hubUser.id,
            membership_slug: hubUser.membership_slug,
            membership_name: hubUser.membership_name,
            role: normalizedRole,
            email: hubUser.email,
            full_name: (existingProfile.full_name as string) || hubUser.name || hubUser.email,
          })
          .eq('id', existingProfile.id as string);

        setProfileState({
          ...(existingProfile as unknown as LocalProfile),
          hub_user_id: hubUser.id,
          membership_slug: hubUser.membership_slug,
          membership_name: hubUser.membership_name,
          role: normalizedRole,
          email: hubUser.email,
        });
        return;
      }

      // Profile not found — create it
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

      if (!createError) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('hub_user_id', hubUser.id)
          .maybeSingle();
        if (newProfile) {
          setProfileState(newProfile);
          return;
        }
      } else {
        console.error('❌ Error creating profile:', createError);
      }

      // Last resort: attempt one more fetch in case the row existed all along
      const { data: finalAttempt } = await supabase
        .from('profiles')
        .select('*')
        .eq('hub_user_id', hubUser.id)
        .maybeSingle();

      if (finalAttempt) {
        setProfileState(finalAttempt);
        return;
      }

      // Absolute fallback — use hub_user_id as placeholder id so app unblocks.
      // NOTE: athlete queries will also check hub_user_id to compensate.
      console.warn('⚠️ Using fallback in-memory profile — DB unreachable');
      setProfileState({
        id: hubUser.id,
        user_id: null,
        hub_user_id: hubUser.id,
        role: normalizedRole,
        full_name: hubUser.name || hubUser.email,
        email: hubUser.email,
        membership_slug: hubUser.membership_slug,
        membership_name: hubUser.membership_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('💥 Profile sync failed:', error);
      if (hubUser) {
        const normalizedRole = hubUser.role === 'trainer' ? 'coach' : hubUser.role;
        setProfileState({
          id: hubUser.id,
          user_id: null,
          hub_user_id: hubUser.id,
          role: normalizedRole,
          full_name: hubUser.name || hubUser.email,
          email: hubUser.email,
          membership_slug: hubUser.membership_slug,
          membership_name: hubUser.membership_name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
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
      window.location.reload();
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
