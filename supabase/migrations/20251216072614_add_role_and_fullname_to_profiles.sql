/*
  # Add role and full_name to profiles table

  ## Changes
  - Add `role` column to profiles table (admin, coach, athlete)
  - Add `full_name` column to profiles table
  - Update existing profiles table to include user metadata

  ## Security
  - Maintains existing RLS policies
  - Role defaults to 'coach' for safety
*/

-- Add role and full_name columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'coach' CHECK (role IN ('admin', 'coach', 'athlete'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
