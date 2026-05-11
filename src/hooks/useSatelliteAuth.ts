import { useState, useEffect } from 'react';

export type MembershipSlug = 'inicia' | 'intermediate' | 'pro';

export interface HubUser {
  id: string;
  email: string;
  name?: string;
  role: 'athlete' | 'trainer' | 'admin';
  active_plan?: string[];
  membership_slug: MembershipSlug;
  membership_name: string;
}

const HUB_URL = 'https://hub.asciende.pro';
const SESSION_TOKEN_KEY = 'hub_session_token';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(payload: Record<string, unknown>): boolean {
  if (typeof payload.exp !== 'number') return false;
  return Date.now() / 1000 > payload.exp;
}

function extractUserFromPayload(payload: Record<string, unknown>): HubUser | null {
  const sub = payload.sub ?? payload.user_id ?? payload.id;
  const email = payload.email;
  if (!sub || !email) return null;
  return {
    id: String(sub),
    email: String(email),
    name: payload.name ? String(payload.name) : undefined,
    role: (payload.role as HubUser['role']) ?? 'athlete',
    active_plan: Array.isArray(payload.active_plan) ? payload.active_plan : undefined,
    membership_slug: (payload.membership_slug as MembershipSlug) ?? 'inicia',
    membership_name: payload.membership_name ? String(payload.membership_name) : 'Asciende Inicia',
  };
}

export function useSatelliteAuth() {
  const [user, setUser] = useState<HubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('session_token');
    if (tokenFromUrl) {
      console.log('[Auth] session_token found in URL, storing...');
      localStorage.setItem(SESSION_TOKEN_KEY, tokenFromUrl);
      const cleanUrl = window.location.href.split('?')[0];
      window.history.replaceState({}, '', cleanUrl);
    }
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!token) {
        console.log('[Auth] No session token found');
        setUser(null);
        return;
      }

      console.log('[Auth] Decoding session token...');
      const payload = decodeJwtPayload(token);

      if (!payload) {
        console.log('[Auth] Invalid JWT format');
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setUser(null);
        return;
      }

      if (isTokenExpired(payload)) {
        console.log('[Auth] Token expired');
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setUser(null);
        return;
      }

      console.log('[Auth] JWT payload:', payload);
      const hubUser = extractUserFromPayload(payload);

      if (hubUser) {
        console.log('[Auth] User authenticated from token:', hubUser.email);
        setUser(hubUser);
      } else {
        console.log('[Auth] Could not extract user from token payload, trying proxy...');
        await checkAuthViaProxy(token);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.error('[Auth] Check failed:', errorMsg);
      setAuthError(errorMsg);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const checkAuthViaProxy = async (token: string) => {
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hub-auth-proxy`;
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    });
    if (response.ok) {
      const data = await response.json();
      const hubUser = data.user ?? (data.id ? data : null);
      if (hubUser?.id) {
        console.log('[Auth] User authenticated via proxy:', hubUser.email);
        setUser({
          id: hubUser.id,
          email: hubUser.email,
          name: hubUser.name,
          role: hubUser.role ?? 'athlete',
          active_plan: hubUser.active_plan,
          membership_slug: hubUser.membership_slug ?? 'inicia',
          membership_name: hubUser.membership_name ?? 'Asciende Inicia',
        });
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setUser(null);
      }
    } else {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setUser(null);
    }
  };

  const loginWithCredentials = async (email: string, password: string): Promise<void> => {
    setAuthError(null);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hub-auth`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? 'Invalid credentials');
    }

    localStorage.setItem(SESSION_TOKEN_KEY, data.token);
    setUser({
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
      membership_slug: data.user.membership_slug,
      membership_name: data.user.membership_name,
    });
  };

  const login = () => {
    const currentUrl = window.location.href.split('?')[0];
    window.location.href = `${HUB_URL}?redirect=${encodeURIComponent(currentUrl)}`;
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setUser(null);
    const currentUrl = window.location.href.split('?')[0];
    window.location.href = `${HUB_URL}/logout?redirect=${encodeURIComponent(currentUrl)}`;
  };

  const hasToken = user !== null;

  return { user, loading, hasToken, authError, login, logout, loginWithCredentials };
}
