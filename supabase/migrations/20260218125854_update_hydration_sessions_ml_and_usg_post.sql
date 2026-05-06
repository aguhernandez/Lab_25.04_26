/*
  # Update Hydration Sessions: mL units and USG Post-session

  ## Changes
  - Rename fluid_intake_l -> fluid_intake_ml (milliliters)
  - Rename urine_output_l -> urine_output_ml (milliliters)
  - Add usg_post column for post-session urine specific gravity
  - Add usg_post_classification column

  ## Notes
  Existing data in fluid_intake_l and urine_output_l is preserved by
  converting values (multiplying by 1000) before dropping old columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_hydration_sessions' AND column_name = 'fluid_intake_ml'
  ) THEN
    ALTER TABLE athlete_hydration_sessions ADD COLUMN fluid_intake_ml numeric(8,1) NOT NULL DEFAULT 0;
    UPDATE athlete_hydration_sessions SET fluid_intake_ml = fluid_intake_l * 1000;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_hydration_sessions' AND column_name = 'urine_output_ml'
  ) THEN
    ALTER TABLE athlete_hydration_sessions ADD COLUMN urine_output_ml numeric(8,1) NOT NULL DEFAULT 0;
    UPDATE athlete_hydration_sessions SET urine_output_ml = urine_output_l * 1000;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_hydration_sessions' AND column_name = 'usg_post'
  ) THEN
    ALTER TABLE athlete_hydration_sessions ADD COLUMN usg_post numeric(5,3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_hydration_sessions' AND column_name = 'usg_post_classification'
  ) THEN
    ALTER TABLE athlete_hydration_sessions ADD COLUMN usg_post_classification text;
  END IF;
END $$;
