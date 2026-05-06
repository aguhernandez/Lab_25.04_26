/*
  # Add Hydration & Thermoregulation Module

  ## Summary
  Creates the data infrastructure for the Hydration & Thermoregulation Lab module.
  This module records sweat loss, dehydration percentage, sweat rate, and environmental
  stress data per session without modifying any physiological variables (VO2, LT1, LT2).

  ## New Tables

  ### `athlete_hydration_sessions`
  Stores each individual hydration assessment session with:
  - Pre/post body weight measurements
  - Fluid intake and urine output tracking
  - Environmental context (temperature, humidity)
  - Session metadata (duration, HR, RPE, date)
  - Urine specific gravity (USG) baseline measurement

  ### `athlete_hydration_profiles`
  Stores the aggregated hydration profile per athlete with:
  - Latest session summary
  - Historical session array
  - Rolling averages (sweat rate, max dehydration observed)
  - Baseline USG classification

  ## Security
  - RLS enabled on both tables
  - Authenticated users can manage all records (coach workflow)
*/

CREATE TABLE IF NOT EXISTS athlete_hydration_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  pre_weight_kg numeric(5,2) NOT NULL,
  post_weight_kg numeric(5,2) NOT NULL,
  fluid_intake_l numeric(5,3) NOT NULL DEFAULT 0,
  urine_output_l numeric(5,3) NOT NULL DEFAULT 0,
  duration_min integer NOT NULL,
  temperature_c numeric(4,1),
  humidity_percent integer,
  avg_hr integer,
  rpe integer CHECK (rpe >= 1 AND rpe <= 10),
  usg_pre numeric(5,3),
  adjusted_sweat_loss_kg numeric(5,3),
  percent_dehydration numeric(5,2),
  sweat_rate_l_h numeric(5,3),
  heat_stress_factor numeric(4,2),
  hydration_stress_score numeric(5,2),
  stress_classification text,
  usg_classification text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE athlete_hydration_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hydration sessions"
  ON athlete_hydration_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert hydration sessions"
  ON athlete_hydration_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update hydration sessions"
  ON athlete_hydration_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete hydration sessions"
  ON athlete_hydration_sessions FOR DELETE
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS athlete_hydration_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid UNIQUE NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  baseline_usg numeric(5,3),
  classification_pre_session text,
  last_session_date date,
  last_percent_dehydration numeric(5,2),
  last_sweat_rate_l_h numeric(5,3),
  last_hydration_stress_score numeric(5,2),
  last_classification text,
  last_temperature_c numeric(4,1),
  last_humidity_percent integer,
  average_sweat_rate_l_h numeric(5,3),
  max_observed_dehydration_percent numeric(5,2),
  total_sessions integer DEFAULT 0,
  history jsonb DEFAULT '[]'::jsonb,
  hydration_warning text,
  performance_risk text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE athlete_hydration_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view hydration profiles"
  ON athlete_hydration_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert hydration profiles"
  ON athlete_hydration_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update hydration profiles"
  ON athlete_hydration_profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete hydration profiles"
  ON athlete_hydration_profiles FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_hydration_sessions_athlete_id ON athlete_hydration_sessions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_hydration_sessions_date ON athlete_hydration_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_hydration_profiles_athlete_id ON athlete_hydration_profiles(athlete_id);

CREATE POLICY "Anon can view hydration sessions"
  ON athlete_hydration_sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert hydration sessions"
  ON athlete_hydration_sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update hydration sessions"
  ON athlete_hydration_sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon can view hydration profiles"
  ON athlete_hydration_profiles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon can insert hydration profiles"
  ON athlete_hydration_profiles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update hydration profiles"
  ON athlete_hydration_profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
