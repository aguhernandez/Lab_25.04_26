/*
  # Add membership fields to profiles table

  ## Changes
  - `profiles` table: add two new columns
    - `membership_slug` (text, default 'inicia') — technical identifier of the membership tier
    - `membership_name` (text, default 'Inicia') — human-readable membership name

  ## Notes
  - Both columns are nullable to stay backward-compatible with existing rows
  - Default values ensure new rows without explicit membership get the free tier
  - These fields are synced from the HUB JWT on every login via auth-me
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'membership_slug'
  ) THEN
    ALTER TABLE profiles ADD COLUMN membership_slug text DEFAULT 'inicia';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'membership_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN membership_name text DEFAULT 'Inicia';
  END IF;
END $$;
