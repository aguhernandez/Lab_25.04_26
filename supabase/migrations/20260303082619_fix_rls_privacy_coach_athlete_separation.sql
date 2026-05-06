/*
  # Fix RLS Privacy: Coach-Athlete Separation

  ## Summary
  Removes all overly permissive policies (USING (true)) that allow any authenticated
  or anonymous user to read/write ALL athletes and test data. Replaces them with
  strict role-based policies:

  - Athletes: can only read their own record (matched by hub_user_id → auth.uid via profiles)
  - Coaches: can only read/write athletes where coach_id = their profile.id
  - Admins: full access to everything
  - Anon: NO read access (anon policies restricted to insert-only for lab workflow)

  ## Tables Affected
  - athletes
  - tests
  - test_results
  - test_data_points

  ## Helper Functions
  - Updates/creates is_coach_of_athlete(athlete_uuid) using coach_id column
*/

-- ============================================================
-- HELPER: is_coach_of_athlete using the coach_id column
-- ============================================================
CREATE OR REPLACE FUNCTION is_coach_of_athlete(athlete_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM athletes a
    JOIN profiles p ON p.id = a.coach_id
    WHERE a.id = athlete_uuid
    AND p.user_id = auth.uid()
  );
$$;

-- ============================================================
-- HELPER: is_athlete_self using hub_user_id or profiles.user_id
-- ============================================================
CREATE OR REPLACE FUNCTION is_athlete_self(athlete_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM athletes a
    JOIN profiles p ON (
      p.hub_user_id = a.hub_user_id
      OR p.id = a.coach_id  -- fallback for direct profile link
    )
    WHERE a.id = athlete_uuid
    AND p.user_id = auth.uid()
    AND p.role = 'athlete'
  )
  OR EXISTS (
    SELECT 1 FROM athletes a
    WHERE a.id = athlete_uuid
    AND a.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;

-- ============================================================
-- ATHLETES TABLE: Drop overly permissive policies
-- ============================================================
DROP POLICY IF EXISTS "Allow all operations on athletes" ON athletes;
DROP POLICY IF EXISTS "Anon can view athletes" ON athletes;
DROP POLICY IF EXISTS "Anon can update athletes" ON athletes;
DROP POLICY IF EXISTS "Anon can delete athletes" ON athletes;
DROP POLICY IF EXISTS "Coaches can view all athletes" ON athletes;
DROP POLICY IF EXISTS "Coaches can update athletes" ON athletes;
DROP POLICY IF EXISTS "Coaches can delete athletes" ON athletes;
DROP POLICY IF EXISTS "Coaches can update assigned athletes" ON athletes;

-- Coaches: see only their own athletes (coach_id matches their profile.id)
CREATE POLICY "Coaches can view own athletes"
  ON athletes FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR is_coach_of_athlete(id)
    OR is_athlete_self(id)
  );

-- Coaches: insert athletes they own
CREATE POLICY "Coaches can insert own athletes"
  ON athletes FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin()
    OR is_coach()
  );

-- Coaches: update only their assigned athletes
CREATE POLICY "Coaches can update own athletes"
  ON athletes FOR UPDATE
  TO authenticated
  USING (is_admin() OR is_coach_of_athlete(id))
  WITH CHECK (is_admin() OR is_coach_of_athlete(id));

-- Coaches: delete only their assigned athletes
CREATE POLICY "Coaches can delete own athletes"
  ON athletes FOR DELETE
  TO authenticated
  USING (is_admin() OR is_coach_of_athlete(id));

-- ============================================================
-- TESTS TABLE: Drop overly permissive policies
-- ============================================================
DROP POLICY IF EXISTS "Coaches can view all tests" ON tests;
DROP POLICY IF EXISTS "Coaches can update tests" ON tests;
DROP POLICY IF EXISTS "Coaches can delete tests" ON tests;
DROP POLICY IF EXISTS "Anon can view tests" ON tests;
DROP POLICY IF EXISTS "Anon can update tests" ON tests;
DROP POLICY IF EXISTS "Anon can delete tests" ON tests;

-- Coaches: see only tests for their athletes
CREATE POLICY "Coaches can view tests for own athletes"
  ON tests FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR is_coach_of_athlete(athlete_id)
    OR (EXISTS (
      SELECT 1 FROM athletes a WHERE a.id = tests.athlete_id AND is_athlete_self(a.id)
    ))
  );

-- Coaches: update tests for their athletes
CREATE POLICY "Coaches can update tests for own athletes"
  ON tests FOR UPDATE
  TO authenticated
  USING (is_admin() OR is_coach_of_athlete(athlete_id))
  WITH CHECK (is_admin() OR is_coach_of_athlete(athlete_id));

-- Coaches: delete tests for their athletes
CREATE POLICY "Coaches can delete tests for own athletes"
  ON tests FOR DELETE
  TO authenticated
  USING (is_admin() OR is_coach_of_athlete(athlete_id));

-- ============================================================
-- TEST_RESULTS TABLE: Drop overly permissive policies
-- ============================================================
DROP POLICY IF EXISTS "Coaches can view all test results" ON test_results;
DROP POLICY IF EXISTS "Coaches can update test results" ON test_results;
DROP POLICY IF EXISTS "Coaches can delete test results" ON test_results;
DROP POLICY IF EXISTS "Anon can view test results" ON test_results;
DROP POLICY IF EXISTS "Anon can update test results" ON test_results;
DROP POLICY IF EXISTS "Anon can delete test results" ON test_results;

-- Coaches/athletes: view results for their athletes only
CREATE POLICY "Coaches can view test results for own athletes"
  ON test_results FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR (EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_results.test_id
      AND (is_coach_of_athlete(t.athlete_id) OR is_athlete_self(t.athlete_id))
    ))
  );

-- Coaches: update test results for their athletes
CREATE POLICY "Coaches can update test results for own athletes"
  ON test_results FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR (EXISTS (SELECT 1 FROM tests t WHERE t.id = test_results.test_id AND is_coach_of_athlete(t.athlete_id)))
  )
  WITH CHECK (
    is_admin()
    OR (EXISTS (SELECT 1 FROM tests t WHERE t.id = test_results.test_id AND is_coach_of_athlete(t.athlete_id)))
  );

-- Coaches: delete test results for their athletes
CREATE POLICY "Coaches can delete test results for own athletes"
  ON test_results FOR DELETE
  TO authenticated
  USING (
    is_admin()
    OR (EXISTS (SELECT 1 FROM tests t WHERE t.id = test_results.test_id AND is_coach_of_athlete(t.athlete_id)))
  );

-- ============================================================
-- TEST_DATA_POINTS TABLE: Drop overly permissive policies
-- ============================================================
DROP POLICY IF EXISTS "Coaches can view all test data points" ON test_data_points;
DROP POLICY IF EXISTS "Coaches can update test data points" ON test_data_points;
DROP POLICY IF EXISTS "Coaches can delete test data points" ON test_data_points;
DROP POLICY IF EXISTS "Anon can view test data points" ON test_data_points;
DROP POLICY IF EXISTS "Anon can update test data points" ON test_data_points;
DROP POLICY IF EXISTS "Anon can delete test_data_points" ON test_data_points;

-- Coaches/athletes: view data points for their athletes only
CREATE POLICY "Coaches can view test data points for own athletes"
  ON test_data_points FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR (EXISTS (
      SELECT 1 FROM tests t
      WHERE t.id = test_data_points.test_id
      AND (is_coach_of_athlete(t.athlete_id) OR is_athlete_self(t.athlete_id))
    ))
  );

-- Coaches: update data points for their athletes
CREATE POLICY "Coaches can update test data points for own athletes"
  ON test_data_points FOR UPDATE
  TO authenticated
  USING (
    is_admin()
    OR (EXISTS (SELECT 1 FROM tests t WHERE t.id = test_data_points.test_id AND is_coach_of_athlete(t.athlete_id)))
  )
  WITH CHECK (
    is_admin()
    OR (EXISTS (SELECT 1 FROM tests t WHERE t.id = test_data_points.test_id AND is_coach_of_athlete(t.athlete_id)))
  );

-- Coaches: delete data points for their athletes
CREATE POLICY "Coaches can delete test data points for own athletes"
  ON test_data_points FOR DELETE
  TO authenticated
  USING (
    is_admin()
    OR (EXISTS (SELECT 1 FROM tests t WHERE t.id = test_data_points.test_id AND is_coach_of_athlete(t.athlete_id)))
  );
