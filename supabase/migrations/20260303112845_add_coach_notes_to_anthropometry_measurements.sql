/*
  # Add coach_notes to anthropometry_measurements

  ## Summary
  Adds a dedicated `coach_notes` column to the `anthropometry_measurements` table
  to store professional conclusions written by coaches, physiologists, or nutritionists.
  These notes appear in generated reports.

  ## Changes
  - `anthropometry_measurements`: adds `coach_notes` text column (nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'anthropometry_measurements' AND column_name = 'coach_notes'
  ) THEN
    ALTER TABLE anthropometry_measurements ADD COLUMN coach_notes text;
  END IF;
END $$;
