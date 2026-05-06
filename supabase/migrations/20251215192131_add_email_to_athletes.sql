/*
  # Add email field to athletes table

  1. Changes
    - Add `email` column to athletes table (text, optional, unique)
    - Add index on email for faster searches

  2. Notes
    - Email is optional to support athletes without email
    - Email must be unique when provided
    - Existing athletes will have NULL email
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'email'
  ) THEN
    ALTER TABLE athletes ADD COLUMN email text UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_athletes_email ON athletes(email) WHERE email IS NOT NULL;
  END IF;
END $$;
