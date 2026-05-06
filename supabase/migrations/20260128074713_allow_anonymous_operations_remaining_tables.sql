/*
  # Allow Anonymous Operations on Remaining Tables

  1. Changes
    - Add full CRUD policies for anonymous users on athletes
    - Add full CRUD policies for anonymous users on test_data_points

  2. Security
    - Allows development without authentication
*/

DO $$
BEGIN
  -- Athletes table
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'athletes' AND policyname = 'Anon can create athletes') THEN
    CREATE POLICY "Anon can create athletes" ON athletes FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'athletes' AND policyname = 'Anon can update athletes') THEN
    CREATE POLICY "Anon can update athletes" ON athletes FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'athletes' AND policyname = 'Anon can delete athletes') THEN
    CREATE POLICY "Anon can delete athletes" ON athletes FOR DELETE TO anon USING (true);
  END IF;

  -- Test data points table
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'test_data_points' AND policyname = 'Anon can create test_data_points') THEN
    CREATE POLICY "Anon can create test_data_points" ON test_data_points FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'test_data_points' AND policyname = 'Anon can update test_data_points') THEN
    CREATE POLICY "Anon can update test_data_points" ON test_data_points FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'test_data_points' AND policyname = 'Anon can delete test_data_points') THEN
    CREATE POLICY "Anon can delete test_data_points" ON test_data_points FOR DELETE TO anon USING (true);
  END IF;
END $$;