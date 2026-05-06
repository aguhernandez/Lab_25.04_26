/*
  # Remove Foreign Key Constraint from profiles.user_id
  
  ## Overview
  Removes the foreign key constraint on profiles.user_id that references auth.users(id).
  This allows local development mode to create profiles with arbitrary UUIDs without
  requiring actual auth.users records.
  
  ## Changes
  - Drop `profiles_user_id_fkey` foreign key constraint
  
  ## Security
  - Maintains all RLS policies
  - Does not affect existing data
  - Only removes the FK constraint to allow local development flexibility
  
  ## Notes
  In production with HUB authentication, the application layer will ensure data integrity.
  For local development, this allows creating test profiles without auth.users records.
*/

-- Drop the foreign key constraint from profiles.user_id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
