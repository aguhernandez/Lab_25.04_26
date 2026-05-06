/*
  # Add anon SELECT policies for tests, test_results, and test_data_points

  ## Summary
  The app uses anonymous Supabase access (no Supabase Auth JWT). The existing
  anon policies only cover INSERT operations, so coaches and athletes using
  anonymous access cannot read test data, test results, or test data points.
  This migration adds SELECT policies for the anon role on these three tables.

  ## Changes
  - tests: add "Anon can read tests" SELECT policy
  - test_results: add "Anon can read test_results" SELECT policy  
  - test_data_points: add "Anon can read test_data_points" SELECT policy

  ## Security Note
  Row-level filtering is done client-side by the application (filtering by
  coach_id and athlete_id). The anon SELECT policies mirror the existing
  "Anon can read athletes" pattern already in place.
*/

CREATE POLICY "Anon can read tests"
  ON tests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read test_results"
  ON test_results FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can read test_data_points"
  ON test_data_points FOR SELECT
  TO anon
  USING (true);
