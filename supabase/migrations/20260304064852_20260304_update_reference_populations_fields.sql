/*
  # Update Reference Populations Fields

  1. Changes to custom_vo2_references
    - Add lactate_lt1_vo2_percent: Intensity of LT1 as % of VO2max
    - Add lactate_lt2_vo2_percent: Intensity of LT2 as % of VO2max
    - New table to support "Physiology" section including VO2max and lactate data

  2. Changes to custom_anthro_references
    - Add measurement_protocol: ISAK, DEXA, or Bioimpedance
    - Add sum_6_skinfolds_mean: Mean sum of 6 skinfolds
    - Add sum_6_skinfolds_sd: Standard deviation of sum of 6 skinfolds
    - Add z_adipose: Z-score for adipose mass
    - Add z_muscle: Z-score for muscle mass
    - Add z_bone: Z-score for bone mass
    - Add muscle_bone_ratio_mean: Mean muscle/bone ratio
    - Remove bmi_mean and bmi_sd columns

  3. Security
    - RLS already enabled on both tables
    - No RLS policy changes needed
*/

DO $$
BEGIN
  -- Add new columns to custom_vo2_references if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_vo2_references' AND column_name = 'lactate_lt1_vo2_percent'
  ) THEN
    ALTER TABLE custom_vo2_references
    ADD COLUMN lactate_lt1_vo2_percent numeric NULL,
    ADD COLUMN lactate_lt2_vo2_percent numeric NULL;
  END IF;

  -- Add new columns to custom_anthro_references if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_anthro_references' AND column_name = 'measurement_protocol'
  ) THEN
    ALTER TABLE custom_anthro_references
    ADD COLUMN measurement_protocol text DEFAULT 'ISAK',
    ADD COLUMN sum_6_skinfolds_mean numeric NULL,
    ADD COLUMN sum_6_skinfolds_sd numeric NULL,
    ADD COLUMN z_adipose numeric NULL,
    ADD COLUMN z_muscle numeric NULL,
    ADD COLUMN z_bone numeric NULL,
    ADD COLUMN muscle_bone_ratio_mean numeric NULL;
  END IF;

  -- Remove bmi_mean and bmi_sd if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'custom_anthro_references' AND column_name = 'bmi_mean'
  ) THEN
    ALTER TABLE custom_anthro_references
    DROP COLUMN IF EXISTS bmi_mean,
    DROP COLUMN IF EXISTS bmi_sd;
  END IF;
END $$;
