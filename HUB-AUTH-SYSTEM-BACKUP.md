# Sistema Completo de Autenticación con HUB - Respaldo

Este archivo contiene toda la implementación del sistema de autenticación y gestión de usuarios integrado con Asciende HUB.

## Fecha de Respaldo
2026-01-12

## Descripción del Sistema

Sistema completo que permite:
- Importar usuarios (admin/coach/athlete) desde Asciende HUB
- Autenticación híbrida: usuarios pueden usar sus credenciales del HUB para iniciar sesión
- Sincronización automática de contraseñas entre HUB y la app local
- Detección de usuarios ya importados con estado visual
- Gestión completa de usuarios con roles y permisos

## Arquitectura

1. **Base de Datos**: Supabase con tabla `profiles` que incluye `external_hub_user_id` para vincular usuarios del HUB
2. **Edge Functions**:
   - `hub-auth`: Autentica contra el HUB y sincroniza contraseñas
   - `import-hub-user`: Importa usuarios del HUB al sistema local
3. **Frontend**: React con componentes para login y gestión de usuarios
4. **Backend**: Funciones de autenticación en `auth.ts`

## Variables de Entorno Requeridas

```env
# Local Supabase
VITE_SUPABASE_URL=your_local_supabase_url
VITE_SUPABASE_ANON_KEY=your_local_supabase_anon_key

# Asciende HUB
VITE_HUB_SUPABASE_URL=hub_supabase_url
VITE_HUB_SUPABASE_ANON_KEY=hub_supabase_anon_key
```

## Migración de Base de Datos

### Agregar columna external_hub_user_id a profiles

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

### Agregar columna external_hub_user_id a athletes (si existe tabla athletes)

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

## Edge Function: hub-auth

**Archivo**: `supabase/functions/hub-auth/index.ts`

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

## Edge Function: import-hub-user

**Archivo**: `supabase/functions/import-hub-user/index.ts`

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

    const { data: existingUser, error: checkError } = await supabaseAdmin
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

    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (resetError) {
      console.error("Error sending password reset email:", resetError);
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

## Archivo: src/lib/auth.ts

Ver archivo completo en el proyecto. Funciones clave:

```typescript
// Interfaces
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

// Funciones principales:
- getHubAdminsAndCoaches(): Obtiene admin/coach del HUB
- getHubAthletes(): Obtiene atletas del HUB
- syncHubUserToLocal(): Sincroniza usuario del HUB al sistema local
- loginWithCredentials(): Login híbrido (local o HUB)
- importAthleteFromHub(): Importa atleta del HUB
- importAdminOrCoachFromHub(): Importa admin/coach del HUB
- checkImportedAthletes(): Verifica qué atletas ya están importados
- checkImportedAdminsAndCoaches(): Verifica qué admin/coach ya están importados
```

## Archivo: src/components/UserManagement.tsx

Componente completo para gestión de usuarios con:
- Lista de usuarios locales con edición de roles
- Importación de admin/coach desde HUB con detección de ya importados
- Importación de atletas desde HUB con detección de ya importados
- Indicadores visuales de estado (badges "Imported", botones "Import"/"Update")

## Archivo: src/components/Login.tsx

Componente de login que usa `loginWithCredentials()` para autenticación híbrida.

## Archivo: src/lib/supabase.ts

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

## Flujo de Autenticación

1. Usuario ingresa credenciales en Login
2. Sistema intenta autenticar localmente
3. Si falla, verifica si el usuario tiene `external_hub_user_id`
4. Si tiene vinculación, llama a edge function `hub-auth`
5. Edge function autentica contra HUB y sincroniza contraseña
6. Usuario puede iniciar sesión con su contraseña del HUB

## Flujo de Importación

### Admin/Coach:
1. Admin carga lista de usuarios del HUB
2. Sistema marca usuarios ya importados
3. Al hacer click en "Import" o "Update":
   - Crea usuario local con contraseña random
   - Crea profile con `external_hub_user_id`
   - Usuario podrá usar sus credenciales del HUB para login

### Athletes:
1. Admin carga lista de atletas del HUB
2. Sistema marca atletas ya importados
3. Al hacer click en "Import" o "Update":
   - Crea o actualiza registro en tabla `athletes`
   - Vincula con `external_hub_user_id`

## Notas Importantes

1. **Seguridad**: Las edge functions usan service role key, no exponerla al cliente
2. **CORS**: Todas las edge functions deben tener headers CORS correctos
3. **Passwords**: Se sincronizan automáticamente, usuarios no necesitan crear nueva contraseña
4. **Detección**: Sistema detecta automáticamente usuarios ya importados por `external_hub_user_id`
5. **Estado Visual**: Badges y botones cambian de color según estado de importación

## Testing

1. Importar un usuario del HUB
2. Intentar login con credenciales del HUB
3. Verificar que se autentica correctamente
4. Verificar que aparece como "Imported" en la lista
5. Verificar que botón cambia a "Update"
