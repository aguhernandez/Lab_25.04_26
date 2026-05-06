/*
  # Add HUB Authentication Fields to Profiles

  1. Changes
    - Add `email` column (text, not null with default)
    - Add `hub_user_id` column (text, unique)
    - Migrate data from `external_hub_user_id` to `hub_user_id`
    - Drop `external_hub_user_id` column
    - Remove NOT NULL constraint from `user_id` to allow HUB-only profiles
    - Update RLS policies for HUB integration

  2. Security
    - Maintain RLS policies
    - Allow profiles without auth.users (HUB authentication)

  3. Notes
    - This migration prepares profiles table for centralized HUB authentication
    - Profiles can now be created directly from HUB user data
    - The `hub_user_id` field stores the HUB user's UUID as text
*/

-- Add email column with default empty string
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add hub_user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'hub_user_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN hub_user_id text;
  END IF;
END $$;

-- Migrate data from external_hub_user_id to hub_user_id
UPDATE profiles 
SET hub_user_id = external_hub_user_id::text 
WHERE external_hub_user_id IS NOT NULL AND hub_user_id IS NULL;

-- Drop external_hub_user_id column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'external_hub_user_id'
  ) THEN
    ALTER TABLE profiles DROP COLUMN external_hub_user_id;
  END IF;
END $$;

-- Make hub_user_id unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_hub_user_id_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_hub_user_id_key UNIQUE (hub_user_id);
  END IF;
END $$;

-- Allow user_id to be nullable for HUB-only profiles
ALTER TABLE profiles ALTER COLUMN user_id DROP NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_hub_user_id ON profiles(hub_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);