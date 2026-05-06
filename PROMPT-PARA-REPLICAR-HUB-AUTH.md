# PROMPT COMPLETO PARA REPLICAR SISTEMA DE AUTENTICACIÓN CON HUB

Copia y pega este prompt completo en un nuevo chat con Bolt para implementar el sistema de autenticación con HUB exactamente igual.

---

## PROMPT INICIO

Necesito implementar un sistema completo de autenticación e importación de usuarios desde Asciende HUB. El sistema debe permitir:

1. Importar usuarios (admin, coach, athlete) desde una base de datos central (HUB)
2. Los usuarios importados deben poder iniciar sesión usando sus credenciales del HUB
3. Sincronización automática de contraseñas entre HUB y sistema local
4. Interfaz para gestionar usuarios con detección visual de estado de importación

### REQUISITOS TÉCNICOS

**Stack:**
- React + TypeScript
- Supabase (base de datos local)
- Supabase Edge Functions
- Variables de entorno para conectar al HUB

**Variables de entorno necesarias (.env):**
```env
VITE_SUPABASE_URL=your_local_supabase_url
VITE_SUPABASE_ANON_KEY=your_local_supabase_anon_key
VITE_HUB_SUPABASE_URL=hub_supabase_url
VITE_HUB_SUPABASE_ANON_KEY=hub_supabase_anon_key
```

### PASO 1: MIGRACIONES DE BASE DE DATOS

Crea las siguientes migraciones de Supabase:

#### Migración 1: Agregar external_hub_user_id a profiles

Nombre: `add_external_hub_user_id_to_profiles.sql`

```sql
/*
  # Add external_hub_user_id to profiles

  1. Changes
    - Add `external_hub_user_id` column to profiles table
    - Add index for faster lookups

  2. Security
    - Column is nullable to support both HUB and non-HUB users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'external_hub_user_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN external_hub_user_id uuid;
    CREATE INDEX IF NOT EXISTS idx_profiles_external_hub_user_id ON profiles(external_hub_user_id);
  END IF;
END $$;
```

#### Migración 2: Agregar external_hub_user_id a athletes (si tienes tabla athletes)

Nombre: `add_external_hub_user_id_to_athletes.sql`

```sql
/*
  # Add external_hub_user_id to athletes

  1. Changes
    - Add `external_hub_user_id` column to athletes table
    - Add index for faster lookups

  2. Security
    - Column is nullable to support both HUB and non-HUB athletes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'external_hub_user_id'
  ) THEN
    ALTER TABLE athletes ADD COLUMN external_hub_user_id uuid;
    CREATE INDEX IF NOT EXISTS idx_athletes_external_hub_user_id ON athletes(external_hub_user_id);
  END IF;
END $$;
```

### PASO 2: EDGE FUNCTIONS

Crea dos edge functions en Supabase:

#### Edge Function 1: hub-auth

Ruta: `supabase/functions/hub-auth/index.ts`

Esta función autentica contra el HUB y sincroniza la contraseña local.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const hubUrl = Deno.env.get("VITE_HUB_SUPABASE_URL")!;
    const hubAnonKey = Deno.env.get("VITE_HUB_SUPABASE_ANON_KEY")!;

    if (!hubUrl || !hubAnonKey) {
      return new Response(
        JSON.stringify({ error: "HUB configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const hubClient = createClient(hubUrl, hubAnonKey);

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: hubAuth, error: hubError } = await hubClient.auth.signInWithPassword({
      email,
      password,
    });

    if (hubError || !hubAuth.user) {
      return new Response(
        JSON.stringify({ error: "Invalid HUB credentials" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("user_id, external_hub_user_id")
      .eq("external_hub_user_id", hubAuth.user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User not imported in local system" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.user_id,
      { password }
    );

    if (updateError) {
      console.error("Error updating local password:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to sync password" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Password synced successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in hub-auth function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

#### Edge Function 2: import-hub-user

Ruta: `supabase/functions/import-hub-user/index.ts`

Esta función importa usuarios del HUB al sistema local.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { email, full_name, external_hub_user_id, role } = await req.json();

    if (!email || !external_hub_user_id) {
      return new Response(
        JSON.stringify({ error: "email and external_hub_user_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("external_hub_user_id", external_hub_user_id)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "User already imported", profile: existingUser }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const password = crypto.randomUUID();

    const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || "",
      },
    });

    if (createUserError) {
      console.error("Error creating user:", createUserError);
      return new Response(
        JSON.stringify({ error: createUserError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userData.user.id,
        external_hub_user_id: external_hub_user_id,
        full_name: full_name || "",
        role: role || "athlete",
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error creating profile:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);

      return new Response(
        JSON.stringify({ error: profileError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let athleteData = null;

    if (role === "athlete" || !role) {
      const { data: existingAthlete } = await supabaseAdmin
        .from("athletes")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (existingAthlete) {
        const { data: updatedAthlete, error: updateError } = await supabaseAdmin
          .from("athletes")
          .update({
            external_hub_user_id: external_hub_user_id,
            name: full_name || existingAthlete.name,
          })
          .eq("id", existingAthlete.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating athlete record:", updateError);
          await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
          await supabaseAdmin.auth.admin.deleteUser(userData.user.id);

          return new Response(
            JSON.stringify({ error: updateError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        athleteData = updatedAthlete;
      } else {
        const { data: newAthlete, error: athleteError } = await supabaseAdmin
          .from("athletes")
          .insert({
            name: full_name || email.split('@')[0],
            email: email,
            external_hub_user_id: external_hub_user_id,
            sport: "running",
          })
          .select()
          .single();

        if (athleteError) {
          console.error("Error creating athlete record:", athleteError);
          await supabaseAdmin.from("profiles").delete().eq("id", profileData.id);
          await supabaseAdmin.auth.admin.deleteUser(userData.user.id);

          return new Response(
            JSON.stringify({ error: athleteError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        athleteData = newAthlete;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: userData.user,
        profile: profileData,
        athlete: athleteData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in import-hub-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

### PASO 3: ACTUALIZAR src/lib/supabase.ts

Agrega el cliente del HUB:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const hubUrl = import.meta.env.VITE_HUB_SUPABASE_URL;
const hubAnonKey = import.meta.env.VITE_HUB_SUPABASE_ANON_KEY;

export const hubClient = hubUrl && hubAnonKey
  ? createClient(hubUrl, hubAnonKey)
  : null;
```

### PASO 4: ACTUALIZAR src/lib/auth.ts

Agrega al archivo existente (o crea uno nuevo) las siguientes funciones. IMPORTANTE: Este archivo debe tener TODAS estas funciones:

```typescript
import { supabase, hubClient } from './supabase';

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
  external_hub_user_id?: string;
}

export async function getHubAdminsAndCoaches(): Promise<HubProfile[]> {
  try {
    if (!hubClient) {
      console.error('HUB client not configured');
      return [];
    }

    const { data, error } = await hubClient
      .from('profiles')
      .select('id, role, full_name, email')
      .in('role', ['admin', 'coach', 'trainer']);

    if (error) {
      console.error('Error fetching HUB profiles:', error);
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

export async function getHubAthletes(): Promise<HubProfile[]> {
  try {
    if (!hubClient) {
      console.error('HUB client not configured');
      return [];
    }

    const { data, error } = await hubClient
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

export async function syncHubUserToLocal(hubUserId: string, email: string): Promise<LocalProfile | null> {
  if (!hubClient) {
    console.error('HUB client not configured');
    return null;
  }

  const { data: hubProfile, error: hubError } = await hubClient
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
    .eq('external_hub_user_id', hubUserId)
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
      external_hub_user_id: hubUserId,
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

export async function importAthleteFromHub(hubUserId: string, email: string, full_name: string): Promise<boolean> {
  try {
    const { data: existingAthlete } = await supabase
      .from('athletes')
      .select('*')
      .eq('external_hub_user_id', hubUserId)
      .maybeSingle();

    if (existingAthlete) {
      const { error: updateError } = await supabase
        .from('athletes')
        .update({
          name: full_name || 'Athlete',
          email: email,
        })
        .eq('external_hub_user_id', hubUserId);

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
        external_hub_user_id: hubUserId,
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
      .select('external_hub_user_id')
      .in('external_hub_user_id', hubUserIds);

    if (error) {
      console.error('Error checking imported athletes:', error);
      return new Set();
    }

    return new Set((data || []).map(a => a.external_hub_user_id).filter(Boolean));
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
      .select('external_hub_user_id')
      .in('external_hub_user_id', hubUserIds)
      .in('role', ['admin', 'coach']);

    if (error) {
      console.error('Error checking imported admins/coaches:', error);
      return new Set();
    }

    return new Set((data || []).map(p => p.external_hub_user_id).filter(Boolean));
  } catch (error) {
    console.error('Error checking imported admins/coaches:', error);
    return new Set();
  }
}
```

### PASO 5: ACTUALIZAR Login Component

Modifica el componente de Login para usar la nueva función de autenticación:

```typescript
// En src/components/Login.tsx (o como se llame tu componente)

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  // ... resto del componente con el form
}
```

### PASO 6: ACTUALIZAR Auth Context

En tu AuthContext, asegúrate de que la función login use `loginWithCredentials`:

```typescript
// En src/contexts/AuthContext.tsx

import { loginWithCredentials } from '../lib/auth';

// En la función login del contexto:
async function login(email: string, password: string) {
  const result = await loginWithCredentials(email, password);
  setUser(result.user);
  setProfile(result.profile);
}
```

### PASO 7: CREAR COMPONENTE UserManagement

Crea un nuevo componente `src/components/UserManagement.tsx` con gestión completa de usuarios:

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getHubAdminsAndCoaches, getHubAthletes, importAdminOrCoachFromHub, importAthleteFromHub, checkImportedAthletes, checkImportedAdminsAndCoaches, HubProfile } from '../lib/auth';

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  user_id: string;
}

export default function UserManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hubUsers, setHubUsers] = useState<HubProfile[]>([]);
  const [hubAthletes, setHubAthletes] = useState<HubProfile[]>([]);
  const [importedAthletes, setImportedAthletes] = useState<Set<string>>(new Set());
  const [importedAdminsAndCoaches, setImportedAdminsAndCoaches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingHubUsers, setLoadingHubUsers] = useState(false);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importingAthlete, setImportingAthlete] = useState<string | null>(null);
  const [hubMessage, setHubMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [athleteMessage, setAthleteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadProfiles();
    loadHubUsers();
    loadHubAthletes();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, role')
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadHubUsers() {
    setLoadingHubUsers(true);
    setHubMessage(null);

    try {
      const users = await getHubAdminsAndCoaches();

      if (users.length === 0) {
        setHubMessage({
          type: 'error',
          text: 'No admin or coach users found in HUB.'
        });
        setHubUsers([]);
        setLoadingHubUsers(false);
        return;
      }

      setHubUsers(users);

      const hubUserIds = users.map(u => u.user_id);
      const imported = await checkImportedAdminsAndCoaches(hubUserIds);
      setImportedAdminsAndCoaches(imported);
    } catch (error) {
      console.error('Error loading HUB users:', error);
      setHubMessage({ type: 'error', text: 'Failed to load HUB users.' });
    } finally {
      setLoadingHubUsers(false);
    }
  }

  async function loadHubAthletes() {
    setLoadingAthletes(true);
    setAthleteMessage(null);

    try {
      const athletes = await getHubAthletes();

      if (athletes.length === 0) {
        setAthleteMessage({
          type: 'error',
          text: 'No athletes found in HUB.'
        });
        setHubAthletes([]);
        setLoadingAthletes(false);
        return;
      }

      setHubAthletes(athletes);

      const hubAthleteIds = athletes.map(a => a.user_id);
      const imported = await checkImportedAthletes(hubAthleteIds);
      setImportedAthletes(imported);
    } catch (error) {
      console.error('Error loading HUB athletes:', error);
      setAthleteMessage({ type: 'error', text: 'Failed to load HUB athletes.' });
    } finally {
      setLoadingAthletes(false);
    }
  }

  async function handleImport(userId: string, email: string, isUpdate: boolean) {
    setImporting(userId);
    setHubMessage(null);
    try {
      const success = await importAdminOrCoachFromHub(userId, email);
      if (success) {
        const message = isUpdate ? 'User updated successfully' : 'User imported successfully';
        setHubMessage({ type: 'success', text: message });
        await loadProfiles();

        const updatedImported = new Set(importedAdminsAndCoaches);
        updatedImported.add(userId);
        setImportedAdminsAndCoaches(updatedImported);
      } else {
        const message = isUpdate ? 'Failed to update user' : 'Failed to import user';
        setHubMessage({ type: 'error', text: message });
      }
    } catch (error) {
      console.error('Error importing user:', error);
      const message = isUpdate ? 'Failed to update user' : 'Failed to import user';
      setHubMessage({ type: 'error', text: message });
    } finally {
      setImporting(null);
    }
  }

  async function handleImportAthlete(userId: string, email: string, fullName: string, isUpdate: boolean) {
    setImportingAthlete(userId);
    setAthleteMessage(null);
    try {
      const success = await importAthleteFromHub(userId, email, fullName);
      if (success) {
        const message = isUpdate ? 'Athlete updated successfully' : 'Athlete imported successfully';
        setAthleteMessage({ type: 'success', text: message });

        const updatedImported = new Set(importedAthletes);
        updatedImported.add(userId);
        setImportedAthletes(updatedImported);
      } else {
        const message = isUpdate ? 'Failed to update athlete' : 'Failed to import athlete';
        setAthleteMessage({ type: 'error', text: message });
      }
    } catch (error) {
      console.error('Error importing athlete:', error);
      const message = isUpdate ? 'Failed to update athlete' : 'Failed to import athlete';
      setAthleteMessage({ type: 'error', text: message });
    } finally {
      setImportingAthlete(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          User Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Manage user roles and import from HUB
        </p>
      </div>

      {/* All Users Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">All Users</h3>
        </div>
        <div className="p-6">
          {loading && profiles.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-4 px-4 text-gray-900 dark:text-white">{profile.full_name || 'N/A'}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          {profile.role.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Import HUB Admin/Coach Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Import HUB Admin/Coach</h2>
        </div>

        <div className="p-6">
          {hubMessage && (
            <div className={`mb-4 p-4 rounded-lg border-l-4 ${
              hubMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300'
            }`}>
              {hubMessage.text}
            </div>
          )}

          {loadingHubUsers ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              Loading HUB users...
            </div>
          ) : hubUsers.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                No admin or coach users found in HUB
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hubUsers.map((user) => {
                    const isImported = importedAdminsAndCoaches.has(user.user_id);
                    const isProcessing = importing === user.user_id;

                    return (
                      <tr key={user.user_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="py-4 px-4 text-gray-900 dark:text-white font-medium">
                          {user.full_name || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                          {user.email}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          }`}>
                            {user.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isImported && (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Imported
                              </span>
                            )}
                            <button
                              onClick={() => user.email && handleImport(user.user_id, user.email, isImported)}
                              disabled={isProcessing || !user.email}
                              className={`px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-md ${
                                isImported
                                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
                              }`}
                            >
                              {isProcessing ? (isImported ? 'Updating...' : 'Importing...') : (isImported ? 'Update' : 'Import')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Import HUB Athletes Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Import HUB Athletes</h2>
        </div>

        <div className="p-6">
          {athleteMessage && (
            <div className={`mb-4 p-4 rounded-lg border-l-4 ${
              athleteMessage.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300'
            }`}>
              {athleteMessage.text}
            </div>
          )}

          {loadingAthletes ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              Loading HUB athletes...
            </div>
          ) : hubAthletes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">
                No athletes found in HUB
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Name</th>
                    <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Email</th>
                    <th className="text-right py-4 px-4 font-semibold text-gray-700 dark:text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {hubAthletes.map((athlete) => {
                    const isImported = importedAthletes.has(athlete.user_id);
                    const isProcessing = importingAthlete === athlete.user_id;

                    return (
                      <tr key={athlete.user_id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="py-4 px-4 text-gray-900 dark:text-white font-medium">
                          {athlete.full_name || 'N/A'}
                        </td>
                        <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                          {athlete.email}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isImported && (
                              <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Imported
                              </span>
                            )}
                            <button
                              onClick={() => athlete.email && handleImportAthlete(athlete.user_id, athlete.email, athlete.full_name || '', isImported)}
                              disabled={isProcessing || !athlete.email}
                              className={`px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-md ${
                                isImported
                                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                                  : 'bg-yellow-500 text-white hover:bg-yellow-600'
                              }`}
                            >
                              {isProcessing ? (isImported ? 'Updating...' : 'Importing...') : (isImported ? 'Update' : 'Import')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### PASO 8: DEPLOY DE EDGE FUNCTIONS

Asegúrate de deployar ambas edge functions:
- `hub-auth`
- `import-hub-user`

### VERIFICACIÓN FINAL

Para verificar que todo funciona:

1. Configura las variables de entorno en `.env`
2. Ejecuta las migraciones de base de datos
3. Deploya las edge functions
4. Importa un usuario del HUB
5. Intenta hacer login con las credenciales del HUB
6. Verifica que aparece como "Imported" en la lista
7. Verifica que el botón cambia a "Update"

### CARACTERÍSTICAS CLAVE

- **Autenticación Híbrida**: Los usuarios pueden usar credenciales del HUB o locales
- **Sincronización Automática**: Las contraseñas se sincronizan automáticamente
- **Detección Visual**: Badges verdes para usuarios importados
- **Actualización**: Botones cambian de "Import" (amarillo) a "Update" (azul)
- **Seguridad**: Contraseñas random, las reales se sincronizan en primer login

---

## FIN DEL PROMPT

Cuando copies este prompt a Bolt, debe implementar TODO el sistema exactamente como está descrito aquí. No omitas ningún paso.
