/*
  # Add HUB linking to athletes table

  1. Changes
    - Add `external_hub_user_id` column to athletes table (uuid, optional, unique)
    - Add index on external_hub_user_id for faster lookups

  2. Notes
    - This field links a Metabolic Lab athlete to a HUB profile
    - NULL means the athlete was created locally in Metabolic Lab
    - When populated, it references a profile.id from the HUB database
    - Must be unique to prevent duplicate athlete records for same HUB user
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'external_hub_user_id'
  ) THEN
    ALTER TABLE athletes ADD COLUMN external_hub_user_id uuid UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_athletes_external_hub_user_id 
      ON athletes(external_hub_user_id) WHERE external_hub_user_id IS NOT NULL;
  END IF;
END $$;
