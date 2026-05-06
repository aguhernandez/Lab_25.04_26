/*
  # Add RPE (Rate of Perceived Exertion) to Test Data Points

  1. Changes
    - Add `rpe` column to `test_data_points` table
      - Integer type (1-10 Borg scale)
      - Optional field (nullable)
      - No constraints as it's subjective measurement

  2. Notes
    - RPE (Rate of Perceived Exertion) uses Borg scale 1-10
    - This is a subjective measure reported by the athlete
    - Used for analysis of coherence with objective measures (HR, VO2, lactate)
    - No calculations performed on RPE, only stored and reported
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'test_data_points' AND column_name = 'rpe'
  ) THEN
    ALTER TABLE test_data_points ADD COLUMN rpe INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN test_data_points.rpe IS 'Rate of Perceived Exertion (Borg scale 1-10), subjective measure reported by athlete';
