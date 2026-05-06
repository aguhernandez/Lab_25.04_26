/*
  # Allow anonymous access to lab_settings

  The lab uses anonymous Supabase sessions, so the existing policies
  for "authenticated" users only did not apply. This migration adds
  equivalent SELECT and UPDATE policies for the anon role so the
  planner token can actually be saved and read.
*/

CREATE POLICY "Anon users can read lab settings"
  ON lab_settings
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can update lab settings"
  ON lab_settings
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
