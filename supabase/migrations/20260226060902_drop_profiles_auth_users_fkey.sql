/*
  # Drop profiles foreign key constraint on auth.users

  ## Problem
  The profiles table had a foreign key linking profiles.id -> auth.users(id).
  Satellite apps authenticate via the HUB JWT and do not create Supabase auth users,
  so INSERT into profiles was failing with a 409 foreign key violation.

  ## Changes
  - Drop the constraint `profiles_id_fkey` if it exists (safe no-op if already removed)
  - Also drop `profiles_user_id_fkey` for the same reason (user_id column may reference auth.users)

  ## Notes
  - Data is not modified, only the constraint is removed
  - Profiles created by satellite auth (hub_user_id based) will now insert correctly
*/

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
