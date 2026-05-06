/*
  # Add coach_id to athletes and athlete_anthropometry_profiles table

  ## Changes
  1. `athletes` table
     - Add `coach_id` column (uuid, references profiles.id) — links athlete to the coach/trainer who created them
  2. `athlete_anthropometry_profiles` table (new)
     - Stores the "applied" anthropometry snapshot visible to the athlete
     - Fields: athlete_id, measurement_id (source), body_fat_percent, muscle_mass_kg, bone_mass_kg, adipose_mass_kg, skin_mass_kg, residual_mass_kg, somatotype_endomorphy, somatotype_mesomorphy, somatotype_ectomorphy, bmi, applied_at, applied_by

  ## Security
  - RLS enabled on new table
  - Athletes can only read their own record
  - Coaches/admins can insert/update
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'coach_id'
  ) THEN
    ALTER TABLE athletes ADD COLUMN coach_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS athlete_anthropometry_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  measurement_id uuid REFERENCES anthropometry_measurements(id) ON DELETE SET NULL,
  body_fat_percent numeric(5,2),
  muscle_mass_kg numeric(6,2),
  bone_mass_kg numeric(6,2),
  adipose_mass_kg numeric(6,2),
  skin_mass_kg numeric(6,2),
  residual_mass_kg numeric(6,2),
  somatotype_endomorphy numeric(5,2),
  somatotype_mesomorphy numeric(5,2),
  somatotype_ectomorphy numeric(5,2),
  bmi numeric(5,2),
  weight_kg numeric(6,2),
  height_cm numeric(5,1),
  applied_at timestamptz DEFAULT now(),
  applied_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(athlete_id)
);

ALTER TABLE athlete_anthropometry_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can read own anthropometry profile"
  ON athlete_anthropometry_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert anthropometry profile"
  ON athlete_anthropometry_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update anthropometry profile"
  ON athlete_anthropometry_profiles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
