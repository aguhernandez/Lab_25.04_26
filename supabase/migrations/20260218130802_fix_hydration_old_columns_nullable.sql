/*
  # Make legacy fluid_intake_l and urine_output_l nullable

  The app now uses fluid_intake_ml and urine_output_ml.
  Old columns must accept NULL so inserts that omit them do not fail.
*/

ALTER TABLE athlete_hydration_sessions
  ALTER COLUMN fluid_intake_l DROP NOT NULL,
  ALTER COLUMN urine_output_l DROP NOT NULL;
