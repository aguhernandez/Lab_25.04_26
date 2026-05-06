# HUB Authentication with Local Profile Validation

## Fecha de Implementación
2026-01-12

## Resumen

Se ha actualizado el sistema de autenticación para que después de validar con el HUB, busque y valide un perfil local en la base de datos del satélite. El acceso a la aplicación requiere tanto autenticación en el HUB como un perfil local existente.

## Flujo de Autenticación Actualizado

### 1. Validación en el HUB

```
1. Usuario abre la app
2. AuthContext llama GET https://hub.asciende.pro/functions/v1/auth-me
3. HUB valida la cookie y responde con datos del usuario
```

### 2. Búsqueda de Perfil Local (NUEVO)

```
4. Si HUB autentica exitosamente, extraer user_id
5. Buscar en tabla profiles WHERE external_hub_user_id = user_id
6. Si existe perfil → Cargar en memoria
7. Si NO existe perfil → Mostrar mensaje de "sin perfil local"
```

### 3. Control de Acceso

```
- Usuario autenticado + Perfil local existe → Acceso permitido
- Usuario autenticado + Sin perfil local → Mensaje de error amigable
- Usuario no autenticado → Redirigir al HUB
```

## Cambios en el Código

### AuthContext.tsx

**Agregado:**

1. **Interface `LocalProfile`** (exportada)
   ```typescript
   export interface LocalProfile {
     id: string;
     user_id: string | null;
     external_hub_user_id: string | null;
     role: string;
     full_name: string | null;
     created_at: string;
     updated_at: string;
   }
   ```

2. **Estado `profile`**
   ```typescript
   const [profile, setProfile] = useState<LocalProfile | null>(null);
   ```

3. **Función `loadLocalProfile()`**
   ```typescript
   async function loadLocalProfile(hubUserId: string) {
     const { data } = await supabase
       .from('profiles')
       .select('*')
       .eq('external_hub_user_id', hubUserId)
       .maybeSingle();

     setProfile(data);
   }
   ```

4. **Profile agregado al contexto**
   ```typescript
   <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
   ```

### ProtectedRoute.tsx

**Agregado:**

1. **Validación de perfil local**
   ```typescript
   const { user, profile, loading, login } = useAuth();
   ```

2. **Pantalla de "Sin Perfil Local"**
   - Muestra mensaje amigable si usuario autenticado pero sin perfil
   - Indica que debe contactar al administrador
   - No permite acceso a la aplicación

### Layout.tsx

**Restaurado:**

1. **Uso de `profile` del contexto**
   - Menú basado en `profile.role` (local) en lugar de `user.role` (HUB)
   - Muestra `profile.full_name` si existe
   - Fallback a `user.email` si no hay full_name

### ProfileView.tsx

**Actualizado:**

1. **Muestra ambos roles**
   - Role (Local): Del perfil local
   - Role (HUB): Del JWT del HUB

2. **Información de debug**
   - HUB User ID
   - Local Profile ID
   - Active Plans del HUB

## Base de Datos

### Tabla `profiles`

La tabla ya existe con la siguiente estructura:

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id),  -- NO SE USA
  external_hub_user_id uuid,  -- ESTE SE USA para linking con HUB
  role text NOT NULL DEFAULT 'coach' CHECK (role IN ('admin', 'coach', 'athlete')),
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Campo Crítico:**
- `external_hub_user_id`: Se usa para vincular con el `user.id` del HUB

**Campo Obsoleto:**
- `user_id`: Apunta a `auth.users` local (Supabase Auth), ya no se usa

## Escenarios de Usuario

### Escenario 1: Usuario con Perfil Local

```
1. Usuario autenticado en HUB
2. Perfil local existe con external_hub_user_id = hub.user.id
3. ✅ Acceso permitido
4. Ve la aplicación normal
```

### Escenario 2: Usuario sin Perfil Local

```
1. Usuario autenticado en HUB
2. No existe perfil local con ese external_hub_user_id
3. ❌ Acceso denegado
4. Ve mensaje: "No Local Profile Found"
5. Debe contactar administrador
```

### Escenario 3: Usuario No Autenticado

```
1. Sin cookie del HUB o cookie inválida
2. HUB responde 401
3. 🔄 Redirigir a https://hub.asciende.pro/login
4. Después de login, vuelve al flujo normal
```

## Creación de Perfiles Locales

**IMPORTANTE**: La aplicación NO crea perfiles automáticamente.

Para que un usuario del HUB acceda a esta aplicación satélite:

1. **Administrador debe crear el perfil manualmente**
   ```sql
   INSERT INTO profiles (external_hub_user_id, role, full_name)
   VALUES (
     'hub-user-id-uuid',  -- ID del usuario en el HUB
     'coach',             -- Rol en esta aplicación
     'Nombre Completo'    -- Nombre del usuario
   );
   ```

2. **O usar una interfaz administrativa** (futuro)
   - Panel de admin para vincular usuarios del HUB
   - Importar usuarios desde el HUB
   - Asignar roles locales

## Permisos y Roles

### Doble Sistema de Roles

La aplicación ahora maneja dos sistemas de roles:

1. **Role del HUB** (`user.role`)
   - Viene del JWT del HUB
   - Rol global en el ecosistema Asciende
   - Se muestra en ProfileView para referencia

2. **Role Local** (`profile.role`)
   - Almacenado en la BD local
   - Controla permisos en esta aplicación específica
   - **ESTE ES EL QUE SE USA PARA CONTROL DE ACCESO**

### ¿Por qué dos roles?

- Un usuario puede ser `admin` en el HUB
- Pero solo `coach` en Metabolic Lab
- Permite control granular por aplicación satélite

## Datos Disponibles

### Del HUB (`user`)

```typescript
user.id           // UUID - Se usa para buscar perfil local
user.email        // Email del usuario
user.role         // Rol en el HUB (informativo)
user.active_plan  // Planes activos del usuario
user.issued_at    // Timestamp de emisión
user.expires_at   // Timestamp de expiración
```

### Del Perfil Local (`profile`)

```typescript
profile.id                    // UUID - ID del perfil local
profile.external_hub_user_id  // UUID - Link al user.id del HUB
profile.role                  // Rol local (usado para permisos)
profile.full_name             // Nombre completo
profile.user_id               // UUID - Obsoleto (auth.users local)
profile.created_at            // Timestamp
profile.updated_at            // Timestamp
```

## Testing

### Verificar que funciona:

1. **Usuario con perfil:**
   - Login en HUB → Debe ver la app normal

2. **Usuario sin perfil:**
   - Login en HUB → Debe ver "No Local Profile Found"

3. **Usuario no autenticado:**
   - Abrir app → Debe redirigir al HUB login

### Crear perfil de prueba:

```sql
-- 1. Obtener el user.id del HUB (desde el JWT o logs)
-- 2. Crear perfil:
INSERT INTO profiles (external_hub_user_id, role, full_name)
VALUES ('paste-hub-user-id-here', 'coach', 'Test User');
```

## Migración desde Sistema Anterior

Si ya tienes usuarios en `auth.users` local:

```sql
-- Migrar perfiles existentes (si aplica)
UPDATE profiles
SET external_hub_user_id = 'hub-user-id'
WHERE user_id = 'local-auth-user-id';
```

**Nota:** Esto requiere conocer el mapeo entre usuarios locales y usuarios del HUB.

## Seguridad

### ✅ Lo que SÍ hace:

1. Valida autenticación con el HUB
2. Verifica existencia de perfil local
3. Usa roles locales para control de acceso
4. No permite acceso sin perfil local

### ❌ Lo que NO hace:

1. No crea perfiles automáticamente
2. No modifica la base de datos del HUB
3. No genera o valida JWTs localmente
4. No almacena credenciales

## Archivos Modificados

```
src/contexts/AuthContext.tsx         - Agregado profile y loadLocalProfile
src/components/ProtectedRoute.tsx    - Agregado validación de profile
src/components/Layout.tsx            - Restaurado uso de profile
src/components/ProfileView.tsx       - Muestra datos de ambos sistemas
```

## Próximos Pasos Sugeridos

1. **Panel de Administración**
   - Interfaz para crear/vincular perfiles
   - Asignar roles locales
   - Ver usuarios del HUB disponibles

2. **Sincronización**
   - Script para importar usuarios del HUB
   - Actualizar full_name automáticamente
   - Webhook cuando usuario se crea en HUB

3. **Mejoras UX**
   - Solicitud automática de acceso
   - Notificación a admins cuando usuario sin perfil intenta acceder
   - Página de "pending approval"

## Troubleshooting

### Usuario no puede acceder

1. **Verificar autenticación HUB:**
   ```javascript
   // En consola del browser
   fetch('https://hub.asciende.pro/functions/v1/auth-me', {
     credentials: 'include'
   }).then(r => r.json()).then(console.log)
   ```

2. **Verificar perfil local:**
   ```sql
   SELECT * FROM profiles
   WHERE external_hub_user_id = 'hub-user-id';
   ```

3. **Verificar cookie:**
   - Abrir DevTools → Application → Cookies
   - Buscar cookie `asciende_auth` en `.asciende.pro`

### Error al cargar perfil

- Verificar que Supabase client está configurado correctamente
- Verificar RLS policies en tabla `profiles`
- Verificar que `external_hub_user_id` no está NULL

## Conclusión

El sistema ahora requiere:
1. ✅ Autenticación válida en el HUB
2. ✅ Perfil local existente con `external_hub_user_id` correcto

Esto proporciona:
- Control granular de acceso por aplicación
- Separación entre autenticación global y permisos locales
- Seguridad: no todos los usuarios del HUB acceden automáticamente
