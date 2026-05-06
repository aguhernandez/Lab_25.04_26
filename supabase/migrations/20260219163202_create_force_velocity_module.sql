/*
  # Force-Velocity Module

  ## Summary
  Creates tables to store Force-Velocity (F-V) profile data per athlete and session.

  ## New Tables

  ### fv_sessions
  Represents one F-V profiling session for an athlete.
  - `id` (uuid, primary key)
  - `athlete_id` (uuid, FK to athletes)
  - `session_date` (date)
  - `exercise` (text) — e.g. squat, bench press, deadlift
  - `sport` (text)
  - `notes` (text, optional)
  - Computed profile: `f0`, `v0`, `pmax`, `slope`, `r_squared`
  - `created_at`, `updated_at`

  ### fv_repetitions
  Individual repetition data per session.
  - `id` (uuid, primary key)
  - `session_id` (uuid, FK to fv_sessions)
  - `set_number` (integer)
  - `rep_number` (integer)
  - `load_kg` (numeric) — external load
  - `mean_velocity_ms` (numeric) — mean propulsive velocity
  - `peak_velocity_ms` (numeric)
  - `mean_force_n` (numeric)
  - `peak_force_n` (numeric)
  - `mean_power_w` (numeric)
  - `peak_power_w` (numeric)
  - `displacement_m` (numeric)
  - `duration_s` (numeric)
  - `data_source` (text) — 'encoder', 'video', 'manual'
  - `is_valid` (boolean, default true)
  - `validation_note` (text, optional)
  - `created_at`

  ## Security
  - RLS enabled on both tables
  - Anonymous access allowed for all operations (matching existing app pattern)
*/

CREATE TABLE IF NOT EXISTS fv_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  exercise text NOT NULL DEFAULT 'squat',
  sport text,
  notes text,
  f0 numeric,
  v0 numeric,
  pmax numeric,
  fv_slope numeric,
  r_squared numeric,
  body_mass_kg numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fv_repetitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES fv_sessions(id) ON DELETE CASCADE,
  set_number integer NOT NULL DEFAULT 1,
  rep_number integer NOT NULL DEFAULT 1,
  load_kg numeric NOT NULL DEFAULT 0,
  mean_velocity_ms numeric,
  peak_velocity_ms numeric,
  mean_force_n numeric,
  peak_force_n numeric,
  mean_power_w numeric,
  peak_power_w numeric,
  displacement_m numeric,
  duration_s numeric,
  data_source text NOT NULL DEFAULT 'manual',
  is_valid boolean NOT NULL DEFAULT true,
  validation_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fv_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fv_repetitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select on fv_sessions"
  ON fv_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anonymous insert on fv_sessions"
  ON fv_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on fv_sessions"
  ON fv_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on fv_sessions"
  ON fv_sessions FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anonymous select on fv_repetitions"
  ON fv_repetitions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anonymous insert on fv_repetitions"
  ON fv_repetitions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on fv_repetitions"
  ON fv_repetitions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on fv_repetitions"
  ON fv_repetitions FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_fv_sessions_athlete_id ON fv_sessions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_fv_repetitions_session_id ON fv_repetitions(session_id);
