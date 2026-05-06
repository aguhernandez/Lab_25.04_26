/*
  # Allow anonymous users to update tests

  ## Problem
  Anonymous users can insert and read tests, and can update test_data_points,
  but there was no UPDATE policy on the tests table for anon role.
  This caused the anthropometry_snapshot and status fields to silently fail
  to save when clicking "Save & Recalculate" in the Edit Data modal.

  ## Change
  - Add UPDATE policy for anon role on tests table (mirrors existing anon INSERT policy)
*/

CREATE POLICY "Anon can update tests"
  ON tests
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
