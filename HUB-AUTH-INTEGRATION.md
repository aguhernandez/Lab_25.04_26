# Integración de Autenticación Centralizada con HUB

## Fecha de Implementación
2026-01-12

## Resumen

Se ha implementado autenticación centralizada usando Asciende HUB como servidor de autenticación único. La aplicación ahora actúa como un "satélite" que confía completamente en el HUB para la gestión de usuarios y sesiones.

## Cambios Implementados

### 1. AuthContext Completamente Reescrito

**Archivo**: `src/contexts/AuthContext.tsx`

- **Eliminado**: Todo el código relacionado con Supabase Auth local
- **Eliminado**: Funciones `login(email, password)` que autenticaban localmente
- **Agregado**: Interface `User` que coincide con la respuesta del HUB:
  ```typescript
  interface User {
    id: string;
    email: string;
    role: string;
    active_plan: string[];
    issued_at?: number;
    expires_at?: number;
  }
  ```

#### Funciones Nuevas

1. **checkAuth()**
   - Llama a `GET https://hub.asciende.pro/functions/v1/auth-me`
   - Usa `credentials: 'include'` para enviar la cookie
   - Si autenticado, guarda el usuario en el estado
   - Si no autenticado, limpia el estado

2. **login()**
   - No recibe parámetros
   - Redirige a `https://hub.asciende.pro/login?redirect=${currentUrl}`
   - El HUB maneja la autenticación y redirige de vuelta

3. **logout()**
   - Llama a `POST https://hub.asciende.pro/functions/v1/auth-logout`
   - Usa `credentials: 'include'`
   - Redirige a `https://hub.asciende.pro`

### 2. Componente ProtectedRoute

**Archivo**: `src/components/ProtectedRoute.tsx` (NUEVO)

- Envuelve la aplicación completa
- Si no hay usuario y loading terminó, llama a `login()` para redirigir
- Muestra pantalla de carga mientras verifica autenticación
- Si no hay usuario, no renderiza nada (para evitar flash de contenido)

### 3. App.tsx Actualizado

**Cambios principales**:
- Removido código de verificación de setup inicial
- Removido componente `InitialSetup`
- Removido componente `Login` de la renderización principal
- Envuelto todo en `<ProtectedRoute>`
- Simplificado: solo verifica loading, luego deja que ProtectedRoute maneje el resto

### 4. Login.tsx Simplificado

**Cambios**:
- Eliminado formulario de email/password
- Eliminado estado de error y loading
- Ahora solo muestra un botón que llama a `login()` para redirigir al HUB
- Mensaje: "Redirecting to Asciende HUB..."

### 5. Layout.tsx Actualizado

**Cambios**:
- Eliminada dependencia de `profile` del AuthContext
- Ahora usa directamente `user.role` del HUB
- Actualizado perfil de usuario para mostrar email y role del HUB
- Cast agregado para tipos: `(user?.role || 'athlete') as 'admin' | 'coach' | 'athlete'`

### 6. ProfileView.tsx Actualizado

**Cambios**:
- Eliminada dependencia de `profile`
- Ahora muestra datos directamente del `user` del HUB:
  - Email
  - Role
  - Active Plans (nuevo campo del HUB)

## Flujo de Autenticación

### Primera Visita (Usuario No Autenticado)

```
1. Usuario abre la app → App.tsx
2. AuthContext.checkAuth() llama al HUB
3. HUB responde 401 (no autenticado)
4. ProtectedRoute detecta !user && !loading
5. ProtectedRoute llama a login()
6. Usuario es redirigido a: https://hub.asciende.pro/login?redirect=currentUrl
7. Usuario inicia sesión en el HUB
8. HUB setea cookie en .asciende.pro
9. HUB redirige de vuelta a la app
10. App carga nuevamente
11. AuthContext.checkAuth() llama al HUB
12. HUB responde 200 con datos del usuario (la cookie va automáticamente)
13. Usuario queda autenticado en la app
```

### Usuario Ya Autenticado

```
1. Usuario abre la app
2. AuthContext.checkAuth() llama al HUB
3. Browser incluye automáticamente la cookie asciende_auth
4. HUB verifica el JWT de la cookie
5. HUB responde 200 con datos del usuario
6. Usuario ve la app inmediatamente
```

### Logout

```
1. Usuario hace click en logout
2. logout() llama a POST https://hub.asciende.pro/functions/v1/auth-logout
3. HUB invalida la sesión y borra la cookie
4. Usuario es redirigido a https://hub.asciende.pro
```

## Endpoints del HUB

### GET /functions/v1/auth-me

Verifica si el usuario está autenticado.

**Request**:
```javascript
fetch('https://hub.asciende.pro/functions/v1/auth-me', {
  method: 'GET',
  credentials: 'include', // CRÍTICO: envía la cookie
});
```

**Response 200** (Autenticado):
```json
{
  "authenticated": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "athlete",
    "active_plan": ["asciende_pro"],
    "issued_at": 1234567890,
    "expires_at": 1234567890
  }
}
```

**Response 401** (No Autenticado):
```json
{
  "authenticated": false
}
```

### POST /functions/v1/auth-logout

Cierra la sesión del usuario.

**Request**:
```javascript
fetch('https://hub.asciende.pro/functions/v1/auth-logout', {
  method: 'POST',
  credentials: 'include', // CRÍTICO: envía la cookie
});
```

**Response**: 200 OK

## Cookie de Sesión

- **Nombre**: `asciende_auth`
- **Dominio**: `.asciende.pro`
- **Atributos**: `httpOnly`, `secure`, `sameSite=lax`
- **Duración**: 7 días
- **Contenido**: JWT firmado por el HUB

## Importante: NO Hacer

1. ❌ NO crear usuarios localmente
2. ❌ NO usar Supabase Auth (signIn, signUp, etc)
3. ❌ NO generar JWTs localmente
4. ❌ NO duplicar lógica de autenticación
5. ❌ NO intentar "mejorar" el flujo
6. ❌ NO almacenar credenciales localmente
7. ❌ NO modificar la cookie del HUB

## Importante: SÍ Hacer

1. ✅ Siempre usar `credentials: 'include'` en fetch
2. ✅ Confiar en la respuesta del HUB
3. ✅ Redirigir al HUB para login/logout
4. ✅ Usar los datos del `user` directamente
5. ✅ Permitir que el browser maneje la cookie automáticamente

## Testing Local

Para probar localmente, el HUB permite cookies en:
- Subdominios de `.asciende.pro`
- `localhost` (para desarrollo)

Si estás en `localhost:5173`, el HUB aceptará y seteará la cookie.

## Datos Disponibles del Usuario

Después de autenticación exitosa, tienes acceso a:

```typescript
user.id          // UUID del usuario
user.email       // Email del usuario
user.role        // 'admin' | 'coach' | 'athlete'
user.active_plan // Array de planes activos ['asciende_pro', etc]
user.issued_at   // Timestamp de emisión del token
user.expires_at  // Timestamp de expiración del token (7 días)
```

## Compatibilidad con Código Existente

Algunos componentes pueden necesitar ajustes si usan:
- `profile` del AuthContext (ya no existe)
- Funciones de auth como `signUp`, `signIn` (ya no existen)
- Supabase Auth directamente (debe ser reemplazado)

## Próximos Pasos

Si necesitas:
- **Permisos específicos**: Usa `user.role` y `user.active_plan`
- **Información adicional del usuario**: Solicita al HUB agregar campos al JWT
- **Sync con base de datos local**: Usa `user.id` como foreign key
- **Verificar planes**: Chequea `user.active_plan.includes('plan_name')`

## Archivos Modificados

```
src/contexts/AuthContext.tsx         (reescrito completamente)
src/components/ProtectedRoute.tsx    (nuevo)
src/App.tsx                          (simplificado)
src/components/Login.tsx             (simplificado)
src/components/Layout.tsx            (actualizado para usar user)
src/components/ProfileView.tsx       (actualizado para usar user)
```

## Archivos Ya No Necesarios

Los siguientes archivos/funciones ya no son necesarios pero se mantienen por compatibilidad con otras partes del sistema que aún los usan:

- `src/lib/auth.ts` - Funciones de autenticación local (ya no se usan para login/logout)
- `src/components/InitialSetup.tsx` - Ya no se renderiza
- Edge functions `hub-auth`, `import-hub-user` - Fueron parte del sistema anterior

**Nota**: Estos archivos pueden ser eliminados en el futuro una vez que se verifique que ninguna otra parte del sistema los necesita.
