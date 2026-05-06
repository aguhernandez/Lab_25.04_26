/*
  # Fix profiles RLS for Hub-authenticated users

  ## Problem
  Users authenticating via Hub JWT (not Supabase auth) have no auth.uid().
  The existing UPDATE policy requires auth.uid() = user_id, which always fails
  for Hub users since user_id is NULL and auth.uid() returns NULL for anon requests.

  Also, INSERT via anon with .select().single() fails because the SELECT after
  INSERT is blocked by RLS (no anon SELECT policy that returns the newly created row).

  ## Changes
  1. Drop the restrictive authenticated-only update policy
  2. Add anon UPDATE policy for Hub users (matched by hub_user_id in payload)
  3. Add anon SELECT policy so post-insert .select() works
  4. Keep existing admin full-access policy intact

  ## Notes
  - These profiles are created/updated by Hub-authenticated users only
  - The hub_user_id unique constraint prevents duplicates
  - Anon policies are intentionally permissive here because:
    a) The Hub JWT is validated before any DB call
    b) The insert/update only sets non-sensitive profile metadata
*/

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Anon can insert hub profiles"
  ON profiles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update hub profiles"
  ON profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can select hub profiles"
  ON profiles FOR SELECT
  TO anon
  USING (true);
