/*
  # Add anonymous access policies for athletes table

  ## Context
  This app uses HUB JWT tokens (not Supabase Auth), so all Supabase queries
  run as the anonymous role. The existing policies only cover authenticated
  users, meaning coaches and athletes cannot read or manage athletes at all.

  Access control is enforced at the application layer via coach_id filtering.

  ## Changes
  - Add anon SELECT policy on athletes (allows reading, app filters by coach_id)
  - Add anon UPDATE policy on athletes (allows updating athlete records)
  - Add anon DELETE policy on athletes (allows deleting athlete records)
*/

CREATE POLICY "Anon can read athletes"
  ON athletes
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can update athletes"
  ON athletes
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can delete athletes"
  ON athletes
  FOR DELETE
  TO anon
  USING (true);
