
/*
  # Allow Anonymous Anthropometry Operations

  ## Summary
  The anthropometry tables (anthropometry_measurements, anthropometry_kerr_results,
  anthropometry_indices) were only accessible to authenticated users. This app operates
  in a development/local mode without Supabase Auth, so the anon role must be granted
  full CRUD access — consistent with the existing anonymous policies on tests,
  test_results, athletes, and other tables.

  ## Changes
  - Add SELECT, INSERT, UPDATE, DELETE policies for the `anon` role on:
    1. anthropometry_measurements
    2. anthropometry_kerr_results
    3. anthropometry_indices

  ## Security Note
  This matches the existing pattern in migrations:
    20260128074653_allow_anonymous_test_operations.sql
    20260128074713_allow_anonymous_operations_remaining_tables.sql
*/

DO $$
BEGIN
  -- anthropometry_measurements: SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_measurements'
    AND policyname = 'Anon can select anthropometry_measurements'
  ) THEN
    CREATE POLICY "Anon can select anthropometry_measurements"
      ON anthropometry_measurements FOR SELECT TO anon USING (true);
  END IF;

  -- anthropometry_measurements: INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_measurements'
    AND policyname = 'Anon can insert anthropometry_measurements'
  ) THEN
    CREATE POLICY "Anon can insert anthropometry_measurements"
      ON anthropometry_measurements FOR INSERT TO anon WITH CHECK (true);
  END IF;

  -- anthropometry_measurements: UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_measurements'
    AND policyname = 'Anon can update anthropometry_measurements'
  ) THEN
    CREATE POLICY "Anon can update anthropometry_measurements"
      ON anthropometry_measurements FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;

  -- anthropometry_measurements: DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_measurements'
    AND policyname = 'Anon can delete anthropometry_measurements'
  ) THEN
    CREATE POLICY "Anon can delete anthropometry_measurements"
      ON anthropometry_measurements FOR DELETE TO anon USING (true);
  END IF;

  -- anthropometry_kerr_results: SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_kerr_results'
    AND policyname = 'Anon can select anthropometry_kerr_results'
  ) THEN
    CREATE POLICY "Anon can select anthropometry_kerr_results"
      ON anthropometry_kerr_results FOR SELECT TO anon USING (true);
  END IF;

  -- anthropometry_kerr_results: INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_kerr_results'
    AND policyname = 'Anon can insert anthropometry_kerr_results'
  ) THEN
    CREATE POLICY "Anon can insert anthropometry_kerr_results"
      ON anthropometry_kerr_results FOR INSERT TO anon WITH CHECK (true);
  END IF;

  -- anthropometry_kerr_results: UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_kerr_results'
    AND policyname = 'Anon can update anthropometry_kerr_results'
  ) THEN
    CREATE POLICY "Anon can update anthropometry_kerr_results"
      ON anthropometry_kerr_results FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;

  -- anthropometry_kerr_results: DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_kerr_results'
    AND policyname = 'Anon can delete anthropometry_kerr_results'
  ) THEN
    CREATE POLICY "Anon can delete anthropometry_kerr_results"
      ON anthropometry_kerr_results FOR DELETE TO anon USING (true);
  END IF;

  -- anthropometry_indices: SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_indices'
    AND policyname = 'Anon can select anthropometry_indices'
  ) THEN
    CREATE POLICY "Anon can select anthropometry_indices"
      ON anthropometry_indices FOR SELECT TO anon USING (true);
  END IF;

  -- anthropometry_indices: INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_indices'
    AND policyname = 'Anon can insert anthropometry_indices'
  ) THEN
    CREATE POLICY "Anon can insert anthropometry_indices"
      ON anthropometry_indices FOR INSERT TO anon WITH CHECK (true);
  END IF;

  -- anthropometry_indices: UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_indices'
    AND policyname = 'Anon can update anthropometry_indices'
  ) THEN
    CREATE POLICY "Anon can update anthropometry_indices"
      ON anthropometry_indices FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;

  -- anthropometry_indices: DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anthropometry_indices'
    AND policyname = 'Anon can delete anthropometry_indices'
  ) THEN
    CREATE POLICY "Anon can delete anthropometry_indices"
      ON anthropometry_indices FOR DELETE TO anon USING (true);
  END IF;

END $$;
