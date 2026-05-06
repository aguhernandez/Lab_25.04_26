/*
  # Allow Anonymous Test Operations

  1. Changes
    - Add INSERT policy for anonymous users on tests table
    - Add INSERT policy for anonymous users on test_results table  
    - Add UPDATE policy for anonymous users on tests table
    - Add UPDATE policy for anonymous users on test_results table
    - Add DELETE policy for anonymous users on tests table
    - Add DELETE policy for anonymous users on test_results table

  2. Security
    - Allows development without authentication
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tests' 
    AND policyname = 'Anon can create tests'
  ) THEN
    CREATE POLICY "Anon can create tests"
      ON tests FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tests' 
    AND policyname = 'Anon can update tests'
  ) THEN
    CREATE POLICY "Anon can update tests"
      ON tests FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tests' 
    AND policyname = 'Anon can delete tests'
  ) THEN
    CREATE POLICY "Anon can delete tests"
      ON tests FOR DELETE TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'test_results' 
    AND policyname = 'Anon can create test_results'
  ) THEN
    CREATE POLICY "Anon can create test_results"
      ON test_results FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'test_results' 
    AND policyname = 'Anon can update test_results'
  ) THEN
    CREATE POLICY "Anon can update test_results"
      ON test_results FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'test_results' 
    AND policyname = 'Anon can delete test_results'
  ) THEN
    CREATE POLICY "Anon can delete test_results"
      ON test_results FOR DELETE TO anon USING (true);
  END IF;
END $$;