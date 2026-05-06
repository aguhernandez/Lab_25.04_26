/*
  # Add Roles and Permissions System

  ## Overview
  Implements a three-role permission system for Metabolic Lab with strict local control
  and read-only HUB access.

  ## New Tables
  
  ### 1. `user_roles`
  Manages role assignments for authenticated users in the local Metabolic Lab system.
  - `id` (uuid, PK) - Unique identifier
  - `user_id` (uuid, unique, FK to auth.users) - Links to local authenticated user
  - `role` (text, check constraint) - Role assignment: 'admin', 'coach', or 'athlete'
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `coach_athlete_assignments`
  Tracks which coaches are assigned to which athletes.
  - `id` (uuid, PK) - Unique identifier
  - `coach_user_id` (uuid, FK to auth.users) - The coach's user ID
  - `athlete_id` (uuid, FK to athletes) - The athlete being managed
  - `created_at` (timestamptz) - Assignment creation timestamp

  ## Security (Row Level Security)
  
  All tables have RLS enabled with role-based policies:
  
  ### ADMIN Role
  - Full CRUD on all tables
  - Can assign roles
  - Can manage coach-athlete assignments
  - Cannot modify HUB data (enforced at application layer)
  
  ### COACH Role
  - Read/write access to assigned athletes only
  - Can create/manage tests for assigned athletes
  - Read-only access to HUB-linked athlete data
  - Cannot delete athletes or modify roles
  
  ### ATHLETE Role
  - Read-only access to own profile and test results
  - Cannot modify any data
  - Cannot view other athletes' data
  
  ## Helper Functions
  
  - `get_user_role()` - Returns current user's role
  - `is_admin()` - Checks if current user is admin
  - `is_coach()` - Checks if current user is coach
  - `is_assigned_coach()` - Checks if current user is coach assigned to specific athlete
  - `is_athlete_owner()` - Checks if current user owns the athlete profile
*/

-- =====================================================
-- STEP 1: Create user_roles table
-- =====================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'coach', 'athlete')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- =====================================================
-- STEP 2: Create coach_athlete_assignments table
-- =====================================================

CREATE TABLE IF NOT EXISTS coach_athlete_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(coach_user_id, athlete_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_athlete_coach ON coach_athlete_assignments(coach_user_id);
CREATE INDEX IF NOT EXISTS idx_coach_athlete_athlete ON coach_athlete_assignments(athlete_id);

-- =====================================================
-- STEP 3: Create helper functions for role checking
-- =====================================================

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM user_roles WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'coach'
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user is assigned coach for specific athlete
CREATE OR REPLACE FUNCTION is_assigned_coach(athlete_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM coach_athlete_assignments 
    WHERE coach_user_id = auth.uid() AND athlete_id = athlete_uuid
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Function to check if user owns athlete profile
CREATE OR REPLACE FUNCTION is_athlete_owner(athlete_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM athletes a
    JOIN user_roles ur ON ur.user_id = auth.uid()
    WHERE a.id = athlete_uuid 
    AND ur.role = 'athlete'
    AND a.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =====================================================
-- STEP 4: Enable RLS and create policies for user_roles
-- =====================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;

CREATE POLICY "Admins can view all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Users can view own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- STEP 5: Enable RLS and create policies for coach_athlete_assignments
-- =====================================================

ALTER TABLE coach_athlete_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all assignments" ON coach_athlete_assignments;
DROP POLICY IF EXISTS "Admins can insert assignments" ON coach_athlete_assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON coach_athlete_assignments;
DROP POLICY IF EXISTS "Coaches can view own assignments" ON coach_athlete_assignments;

CREATE POLICY "Admins can view all assignments"
  ON coach_athlete_assignments FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert assignments"
  ON coach_athlete_assignments FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete assignments"
  ON coach_athlete_assignments FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE POLICY "Coaches can view own assignments"
  ON coach_athlete_assignments FOR SELECT
  TO authenticated
  USING (coach_user_id = auth.uid() AND is_coach());

-- =====================================================
-- STEP 6: Update RLS policies for athletes
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON athletes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON athletes;
DROP POLICY IF EXISTS "Enable update for users based on email" ON athletes;
DROP POLICY IF EXISTS "Coaches can create athletes" ON athletes;
DROP POLICY IF EXISTS "Admins have full access to athletes" ON athletes;
DROP POLICY IF EXISTS "Coaches can view assigned athletes" ON athletes;
DROP POLICY IF EXISTS "Coaches can update assigned athletes" ON athletes;
DROP POLICY IF EXISTS "Athletes can view own profile" ON athletes;

CREATE POLICY "Admins have full access to athletes"
  ON athletes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Coaches can view assigned athletes"
  ON athletes FOR SELECT
  TO authenticated
  USING (
    is_coach() AND (
      is_assigned_coach(id) OR
      external_hub_user_id IS NOT NULL
    )
  );

CREATE POLICY "Coaches can create athletes"
  ON athletes FOR INSERT
  TO authenticated
  WITH CHECK (is_coach());

CREATE POLICY "Coaches can update assigned athletes"
  ON athletes FOR UPDATE
  TO authenticated
  USING (is_coach() AND is_assigned_coach(id))
  WITH CHECK (is_coach() AND is_assigned_coach(id));

CREATE POLICY "Athletes can view own profile"
  ON athletes FOR SELECT
  TO authenticated
  USING (is_athlete_owner(id));

-- =====================================================
-- STEP 7: Update RLS policies for tests
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON tests;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON tests;
DROP POLICY IF EXISTS "Enable update for users based on email" ON tests;
DROP POLICY IF EXISTS "Admins have full access to tests" ON tests;
DROP POLICY IF EXISTS "Coaches can view tests for assigned athletes" ON tests;
DROP POLICY IF EXISTS "Coaches can create tests for assigned athletes" ON tests;
DROP POLICY IF EXISTS "Coaches can update tests for assigned athletes" ON tests;
DROP POLICY IF EXISTS "Athletes can view own tests" ON tests;

CREATE POLICY "Admins have full access to tests"
  ON tests FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Coaches can view tests for assigned athletes"
  ON tests FOR SELECT
  TO authenticated
  USING (is_coach() AND is_assigned_coach(athlete_id));

CREATE POLICY "Coaches can create tests for assigned athletes"
  ON tests FOR INSERT
  TO authenticated
  WITH CHECK (is_coach() AND is_assigned_coach(athlete_id));

CREATE POLICY "Coaches can update tests for assigned athletes"
  ON tests FOR UPDATE
  TO authenticated
  USING (is_coach() AND is_assigned_coach(athlete_id))
  WITH CHECK (is_coach() AND is_assigned_coach(athlete_id));

CREATE POLICY "Athletes can view own tests"
  ON tests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = tests.athlete_id
      AND is_athlete_owner(a.id)
    )
  );

-- =====================================================
-- STEP 8: Update RLS policies for test_data_points
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON test_data_points;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON test_data_points;
DROP POLICY IF EXISTS "Enable update for users based on email" ON test_data_points;
DROP POLICY IF EXISTS "Admins have full access to test_data_points" ON test_data_points;
DROP POLICY IF EXISTS "Coaches can manage test_data_points for assigned athletes" ON test_data_points;
DROP POLICY IF EXISTS "Athletes can view own test_data_points" ON test_data_points;

CREATE POLICY "Admins have full access to test_data_points"
  ON test_data_points FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Coaches can manage test_data_points for assigned athletes"
  ON test_data_points FOR ALL
  TO authenticated
  USING (
    is_coach() AND EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_data_points.test_id
      AND is_assigned_coach(t.athlete_id)
    )
  )
  WITH CHECK (
    is_coach() AND EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_data_points.test_id
      AND is_assigned_coach(t.athlete_id)
    )
  );

CREATE POLICY "Athletes can view own test_data_points"
  ON test_data_points FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests t
      JOIN athletes a ON a.id = t.athlete_id
      WHERE t.id = test_data_points.test_id
      AND is_athlete_owner(a.id)
    )
  );

-- =====================================================
-- STEP 9: Update RLS policies for test_results
-- =====================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON test_results;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON test_results;
DROP POLICY IF EXISTS "Enable update for users based on email" ON test_results;
DROP POLICY IF EXISTS "Admins have full access to test_results" ON test_results;
DROP POLICY IF EXISTS "Coaches can manage test_results for assigned athletes" ON test_results;
DROP POLICY IF EXISTS "Athletes can view own test_results" ON test_results;

CREATE POLICY "Admins have full access to test_results"
  ON test_results FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Coaches can manage test_results for assigned athletes"
  ON test_results FOR ALL
  TO authenticated
  USING (
    is_coach() AND EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_results.test_id
      AND is_assigned_coach(t.athlete_id)
    )
  )
  WITH CHECK (
    is_coach() AND EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_results.test_id
      AND is_assigned_coach(t.athlete_id)
    )
  );

CREATE POLICY "Athletes can view own test_results"
  ON test_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests t
      JOIN athletes a ON a.id = t.athlete_id
      WHERE t.id = test_results.test_id
      AND is_athlete_owner(a.id)
    )
  );

-- =====================================================
-- STEP 10: Update RLS policies for profiles
-- =====================================================

DROP POLICY IF EXISTS "Users can read own data" ON profiles;
DROP POLICY IF EXISTS "Admins have full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

CREATE POLICY "Admins have full access to profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- STEP 11: Create trigger for updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
