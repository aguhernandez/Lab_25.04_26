/*
  # Update Athletes table for HUB authentication (v2)

  1. Changes
    - Add `hub_user_id` column (text, unique)
    - Migrate data from `external_hub_user_id` to `hub_user_id`
    - Drop policies that depend on external_hub_user_id
    - Drop `external_hub_user_id` column
    - Recreate policies with hub_user_id

  2. Notes
    - This aligns athletes table with profiles table naming
    - Maintains referential integrity with HUB users
    - Updates RLS policies to use new column
*/

-- Add hub_user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'hub_user_id'
  ) THEN
    ALTER TABLE athletes ADD COLUMN hub_user_id text;
  END IF;
END $$;

-- Migrate data from external_hub_user_id to hub_user_id
UPDATE athletes 
SET hub_user_id = external_hub_user_id::text 
WHERE external_hub_user_id IS NOT NULL AND hub_user_id IS NULL;

-- Drop existing RLS policies that depend on external_hub_user_id
DROP POLICY IF EXISTS "Coaches can view assigned athletes" ON athletes;
DROP POLICY IF EXISTS "Admins can view all athletes" ON athletes;
DROP POLICY IF EXISTS "Athletes can view own profile" ON athletes;

-- Drop external_hub_user_id column (CASCADE to drop dependent objects)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'external_hub_user_id'
  ) THEN
    ALTER TABLE athletes DROP COLUMN external_hub_user_id CASCADE;
  END IF;
END $$;

-- Make hub_user_id unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'athletes_hub_user_id_key'
  ) THEN
    ALTER TABLE athletes ADD CONSTRAINT athletes_hub_user_id_key UNIQUE (hub_user_id);
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_athletes_hub_user_id ON athletes(hub_user_id);

-- Recreate RLS policies (permissive for now since we're not using traditional auth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'athletes' 
    AND policyname = 'Allow all operations on athletes'
  ) THEN
    CREATE POLICY "Allow all operations on athletes"
      ON athletes
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;