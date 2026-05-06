# Roles and Permissions System

## Overview

Metabolic Lab implements a three-tier role-based access control (RBAC) system with strict local control and read-only access to the HUB database.

**Core Principles:**
- All permissions are local to Metabolic Lab
- HUB access is always read-only
- Role enforcement is strict (no privilege escalation)
- Data ownership follows clear hierarchies

---

## Role Definitions

### 1. ADMIN Role

**Description:** Full system administrator with complete control over Metabolic Lab.

**Allowed Actions:**
| Action | Tables Affected | Description |
|--------|----------------|-------------|
| ✅ Create users | `auth.users`, `user_roles` | Can create new users and assign roles |
| ✅ Edit any user | `user_roles` | Can change roles and manage all users |
| ✅ Delete users | `user_roles`, `profiles` | Can remove users from system |
| ✅ Assign roles | `user_roles` | Can set users as admin, coach, or athlete |
| ✅ View all athletes | `athletes` | Can see all athlete profiles |
| ✅ Edit all athletes | `athletes` | Can modify any athlete information |
| ✅ Delete athletes | `athletes` | Can remove athlete records |
| ✅ Manage coach assignments | `coach_athlete_assignments` | Can assign coaches to athletes |
| ✅ View all tests | `tests`, `test_data_points`, `test_results` | Can see all evaluations and results |
| ✅ Create tests | `tests` | Can create evaluations for any athlete |
| ✅ Edit all tests | `tests`, `test_data_points`, `test_results` | Can modify any test data |
| ✅ Delete tests | `tests` | Can remove test records |
| ✅ View HUB links | `athletes.external_hub_user_id` | Can see which athletes are linked to HUB |
| ✅ Manage system settings | Environment variables | Can configure system settings |

**Forbidden Actions:**
| Action | Reason |
|--------|--------|
| ❌ Modify HUB user identities | HUB is read-only; enforced at application layer |
| ❌ Delete HUB user data | HUB is the source of truth for user identity |
| ❌ Change HUB user profiles | All HUB modifications must occur in HUB system |

**Table Access:**
```
user_roles:                 SELECT, INSERT, UPDATE, DELETE
coach_athlete_assignments:  SELECT, INSERT, DELETE
athletes:                   SELECT, INSERT, UPDATE, DELETE
tests:                      SELECT, INSERT, UPDATE, DELETE
test_data_points:          SELECT, INSERT, UPDATE, DELETE
test_results:              SELECT, INSERT, UPDATE, DELETE
profiles:                   SELECT, INSERT, UPDATE, DELETE
```

---

### 2. COACH Role

**Description:** Professional coach who conducts tests and manages assigned athletes.

**Allowed Actions:**
| Action | Tables Affected | Description |
|--------|----------------|-------------|
| ✅ View assigned athletes | `athletes` | Can see profiles of assigned athletes only |
| ✅ Edit assigned athletes | `athletes` | Can update information for assigned athletes |
| ✅ View HUB-linked athletes | `athletes` (read-only) | Can see HUB user info for linking purposes |
| ✅ Create new athletes | `athletes` | Can create local athlete profiles |
| ✅ Link HUB users | `athletes.external_hub_user_id` | Can link existing HUB users to local athletes |
| ✅ View own assignments | `coach_athlete_assignments` | Can see their athlete assignments |
| ✅ Create tests | `tests` | Can create evaluations for assigned athletes |
| ✅ Edit tests | `tests`, `test_data_points` | Can modify test data for assigned athletes |
| ✅ View test results | `test_results` | Can see results for assigned athletes |
| ✅ Add coach notes | `test_results.coach_notes` | Can add notes to test results |

**Forbidden Actions:**
| Action | Reason |
|--------|--------|
| ❌ Delete athletes | Only admins can delete athlete records |
| ❌ View unassigned athletes | Coaches only access their assigned athletes |
| ❌ Modify other coaches' athletes | Must be explicitly assigned |
| ❌ Assign themselves to athletes | Only admins manage assignments |
| ❌ Change user roles | Role management is admin-only |
| ❌ Delete tests | Tests are permanent records |
| ❌ Modify HUB user data | HUB is read-only |
| ❌ Manage system settings | System configuration is admin-only |

**Table Access:**
```
user_roles:                 SELECT (own role only)
coach_athlete_assignments:  SELECT (own assignments only)
athletes:                   SELECT (assigned + HUB-linked), INSERT, UPDATE (assigned only)
tests:                      SELECT, INSERT, UPDATE (assigned athletes only)
test_data_points:          SELECT, INSERT, UPDATE, DELETE (assigned athletes only)
test_results:              SELECT, INSERT, UPDATE, DELETE (assigned athletes only)
profiles:                   SELECT (own profile only)
```

**Assignment Logic:**
A coach can only access an athlete if:
```sql
EXISTS (
  SELECT 1 FROM coach_athlete_assignments
  WHERE coach_user_id = auth.uid()
  AND athlete_id = <target_athlete_id>
)
```

---

### 3. ATHLETE Role

**Description:** Athlete who can view their own test results and profile.

**Allowed Actions:**
| Action | Tables Affected | Description |
|--------|----------------|-------------|
| ✅ View own profile | `athletes` | Can see their own athlete profile |
| ✅ View own tests | `tests` | Can see their evaluation history |
| ✅ View own test data | `test_data_points` | Can see detailed test measurements |
| ✅ View own results | `test_results` | Can see metabolic analysis and zones |
| ✅ View HUB link status | `athletes.external_hub_user_id` | Can see if profile is linked to HUB (read-only) |

**Forbidden Actions:**
| Action | Reason |
|--------|--------|
| ❌ Edit profile | Profile management is coach/admin responsibility |
| ❌ Create tests | Tests are created by coaches |
| ❌ Modify test data | Test data is immutable once entered |
| ❌ Delete any records | Athletes have read-only access |
| ❌ View other athletes | Privacy protection |
| ❌ Assign coaches | Assignment management is admin-only |
| ❌ Change roles | Role management is admin-only |
| ❌ Modify HUB data | HUB is read-only |

**Table Access:**
```
user_roles:        SELECT (own role only)
athletes:          SELECT (own profile only, matched by email)
tests:             SELECT (own tests only)
test_data_points: SELECT (own test data only)
test_results:     SELECT (own results only)
profiles:          SELECT (own profile only)
```

**Ownership Logic:**
An athlete can only access their own data if:
```sql
EXISTS (
  SELECT 1 FROM athletes a
  JOIN user_roles ur ON ur.user_id = auth.uid()
  WHERE a.id = <target_athlete_id>
  AND ur.role = 'athlete'
  AND a.email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
```

---

## Table-Level Permissions Matrix

| Table | ADMIN | COACH | ATHLETE |
|-------|-------|-------|---------|
| **user_roles** | Full CRUD | Read own | Read own |
| **coach_athlete_assignments** | Full CRUD | Read own | None |
| **athletes** | Full CRUD | Read (assigned+HUB), Create, Update (assigned) | Read own |
| **tests** | Full CRUD | CRUD (assigned athletes) | Read own |
| **test_data_points** | Full CRUD | CRUD (assigned athletes) | Read own |
| **test_results** | Full CRUD | CRUD (assigned athletes) | Read own |
| **profiles** | Full CRUD | Read own | Read own |

**Legend:**
- **Full CRUD**: Create, Read, Update, Delete
- **Read own**: Can only view their own record(s)
- **Read (assigned+HUB)**: Can view assigned athletes + HUB-linked profiles
- **CRUD (assigned)**: Full access but only for assigned athletes
- **None**: No access

---

## Field-Level Permissions

### Athletes Table

| Field | ADMIN | COACH | ATHLETE |
|-------|-------|-------|---------|
| `id` | ✅ Read/Write | ✅ Read | ✅ Read (own) |
| `name` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `email` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `sport` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `date_of_birth` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `sex` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `weight_kg` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `height_cm` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `body_fat_percent` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `lean_body_mass_kg` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `external_hub_user_id` | ✅ Read/Write | ✅ Read-only | ✅ Read-only (own) |

### Tests Table

| Field | ADMIN | COACH | ATHLETE |
|-------|-------|-------|---------|
| `id` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `athlete_id` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `test_date` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `sport` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `test_type` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `status` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `anthropometry_source` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `anthropometry_snapshot` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |

### Test Results Table

| Field | ADMIN | COACH | ATHLETE |
|-------|-------|-------|---------|
| `coach_notes` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read-only (own) |
| `training_zones` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `vo2max` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| `lt1_hr`, `lt2_hr` | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |
| All other fields | ✅ Read/Write | ✅ Read/Write (assigned) | ✅ Read (own) |

---

## HUB Integration Rules

### Read-Only Principle
**All HUB access is strictly read-only.**

| Operation | Allowed |
|-----------|---------|
| Search HUB users by email | ✅ Yes (Admin, Coach) |
| View HUB user profiles | ✅ Yes (Admin, Coach) |
| Link HUB user to local athlete | ✅ Yes (Admin, Coach) |
| View HUB link status | ✅ Yes (All roles, own data) |
| Modify HUB user data | ❌ Never |
| Delete HUB users | ❌ Never |
| Create HUB users from Metabolic Lab | ❌ Never |

### Data Flow
```
HUB → Metabolic Lab: ✅ Allowed (read-only)
Metabolic Lab → HUB: ❌ Forbidden
```

### Linking Logic
1. **Coach/Admin** searches HUB by email
2. System queries `HUB.profiles` (read-only)
3. System filters out already-linked users
4. **Coach/Admin** selects HUB user
5. System creates local athlete with `external_hub_user_id`
6. **No data is written to HUB**

---

## Implementation Details

### Database Schema

#### user_roles Table
```sql
CREATE TABLE user_roles (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES auth.users(id),
  role text CHECK (role IN ('admin', 'coach', 'athlete')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### coach_athlete_assignments Table
```sql
CREATE TABLE coach_athlete_assignments (
  id uuid PRIMARY KEY,
  coach_user_id uuid REFERENCES auth.users(id),
  athlete_id uuid REFERENCES athletes(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_user_id, athlete_id)
);
```

### Helper Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_user_role()` | `TEXT` | Returns current user's role |
| `is_admin()` | `BOOLEAN` | Checks if user is admin |
| `is_coach()` | `BOOLEAN` | Checks if user is coach |
| `is_assigned_coach(athlete_uuid)` | `BOOLEAN` | Checks if user is assigned to athlete |
| `is_athlete_owner(athlete_uuid)` | `BOOLEAN` | Checks if user owns athlete profile |

### Row Level Security (RLS)

All tables have RLS enabled. Policies use helper functions to enforce role-based access:

```sql
-- Example: Coaches can only view assigned athletes
CREATE POLICY "Coaches can view assigned athletes"
  ON athletes FOR SELECT
  TO authenticated
  USING (
    is_coach() AND is_assigned_coach(id)
  );
```

---

## Security Considerations

### Principle of Least Privilege
- Users only get permissions necessary for their role
- No role can escalate privileges
- All actions are audited via timestamps

### Data Isolation
- Athletes cannot see other athletes' data
- Coaches cannot see unassigned athletes
- HUB data remains isolated and read-only

### Role Assignment
- Only admins can assign roles
- Role changes are logged with timestamps
- No self-service role elevation

### Coach-Athlete Assignments
- Only admins can create assignments
- Coaches cannot assign themselves
- Assignments are explicit, never implicit

---

## Usage Examples

### Creating a New Coach
```sql
-- 1. Admin creates user account (via Supabase Auth)
-- 2. Admin assigns coach role
INSERT INTO user_roles (user_id, role)
VALUES ('coach-uuid', 'coach');
```

### Assigning Coach to Athlete
```sql
-- Admin creates assignment
INSERT INTO coach_athlete_assignments (coach_user_id, athlete_id)
VALUES ('coach-uuid', 'athlete-uuid');
```

### Coach Creating Test
```sql
-- Coach creates test for assigned athlete
INSERT INTO tests (athlete_id, test_date, sport, test_type)
VALUES ('athlete-uuid', '2025-12-16', 'cycling', 'ramp');
-- RLS automatically enforces assignment check
```

### Athlete Viewing Results
```sql
-- Athlete queries own tests
SELECT * FROM tests WHERE athlete_id IN (
  SELECT id FROM athletes WHERE email = auth.email()
);
-- RLS automatically filters to own records only
```

---

## Migration Path

The roles system was implemented via migration:
- **File**: `supabase/migrations/..._add_roles_and_permissions_system_v3.sql`
- **Date**: 2025-12-16

### Upgrading Existing Data
If you have existing users without roles:

```sql
-- Assign default roles to existing users
-- Review and customize based on your needs
INSERT INTO user_roles (user_id, role)
SELECT id, 'coach' FROM auth.users
WHERE email LIKE '%@yourcompany.com'
ON CONFLICT (user_id) DO NOTHING;
```

---

## Testing Permissions

### Test as Admin
```sql
-- Set role
INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'admin');

-- Should succeed: view all athletes
SELECT * FROM athletes;

-- Should succeed: assign coach
INSERT INTO coach_athlete_assignments (coach_user_id, athlete_id)
VALUES ('coach-uuid', 'athlete-uuid');
```

### Test as Coach
```sql
-- Set role
INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'coach');

-- Should succeed: view assigned athletes
SELECT * FROM athletes WHERE is_assigned_coach(id);

-- Should fail: view unassigned athletes
SELECT * FROM athletes WHERE NOT is_assigned_coach(id);

-- Should succeed: create test for assigned athlete
INSERT INTO tests (athlete_id, sport) VALUES ('assigned-athlete-uuid', 'cycling');

-- Should fail: create test for unassigned athlete
INSERT INTO tests (athlete_id, sport) VALUES ('unassigned-athlete-uuid', 'cycling');
```

### Test as Athlete
```sql
-- Set role
INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'athlete');

-- Should succeed: view own profile
SELECT * FROM athletes WHERE email = auth.email();

-- Should fail: view other athlete
SELECT * FROM athletes WHERE email != auth.email();

-- Should fail: create test
INSERT INTO tests (athlete_id, sport) VALUES ('athlete-uuid', 'cycling');
```

---

## Summary

| Role | Primary Purpose | Key Capability | Key Restriction |
|------|----------------|----------------|-----------------|
| **ADMIN** | System management | Full control over all data | Cannot modify HUB |
| **COACH** | Conduct tests | Manage assigned athletes | Cannot access unassigned athletes |
| **ATHLETE** | View results | See own test history | Read-only access only |

**Golden Rules:**
1. Local control only - Metabolic Lab manages its own data
2. HUB is read-only - Never write to HUB from Metabolic Lab
3. Strict role enforcement - No privilege escalation
4. Explicit assignments - Coaches must be assigned to athletes
5. Data privacy - Users only see data they're authorized for
