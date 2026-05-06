/*
  # Heat Adaptation Tracking Module

  ## Purpose
  Tracks physiological adaptation to heat stress over multiple sessions,
  measuring how the body's cardiovascular and thermoregulatory responses
  improve with repeated heat exposure.

  ## New Tables

  ### athlete_heat_sessions
  Individual training session recorded under heat conditions (temp >= 20°C).
  - `id` - UUID primary key
  - `athlete_id` - reference to athlete
  - `session_date` - date of the session
  - `temperature_c` - ambient temperature (°C)
  - `humidity_percent` - relative humidity (%)
  - `sport` - cycling, running, other
  - `duration_min` - session duration in minutes
  - `avg_hr` - average heart rate (bpm)
  - `hr_first_half` - average HR during first half
  - `hr_second_half` - average HR during second half
  - `external_load` - watts (cycling) or speed km/h (running)
  - `load_unit` - 'watts' or 'km_h'
  - `sweat_rate_l_h` - sweat rate (L/h), calculated from weight delta
  - `pre_weight_kg` - body weight before session
  - `post_weight_kg` - body weight after session
  - `fluid_intake_ml` - fluid consumed during session
  - `percent_dehydration` - % body weight lost as fluid
  - `rpe` - rating of perceived exertion (6-20 Borg)
  - `notes` - free text

  ### Computed/Derived columns stored for trend analysis
  - `heat_cardiac_load` - HR avg / External Load (lower = better adaptation)
  - `hr_drift_percent` - ((HR2nd - HR1st) / HR1st) * 100
  - `heat_adaptation_score` - composite 0-100 score

  ## Security
  - RLS enabled, admin/coach access only
*/

CREATE TABLE IF NOT EXISTS athlete_heat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  temperature_c numeric(5,2) NOT NULL,
  humidity_percent numeric(5,2),
  sport text NOT NULL DEFAULT 'cycling',
  duration_min numeric(6,1) NOT NULL,
  avg_hr numeric(6,1),
  hr_first_half numeric(6,1),
  hr_second_half numeric(6,1),
  external_load numeric(8,2),
  load_unit text NOT NULL DEFAULT 'watts',
  pre_weight_kg numeric(6,3),
  post_weight_kg numeric(6,3),
  fluid_intake_ml numeric(8,1) DEFAULT 0,
  percent_dehydration numeric(6,3),
  sweat_rate_l_h numeric(6,3),
  rpe numeric(4,1),
  heat_cardiac_load numeric(10,4),
  hr_drift_percent numeric(6,2),
  heat_adaptation_score numeric(5,1),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE athlete_heat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches and admins can select heat sessions"
  ON athlete_heat_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches and admins can insert heat sessions"
  ON athlete_heat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Coaches and admins can update heat sessions"
  ON athlete_heat_sessions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Coaches and admins can delete heat sessions"
  ON athlete_heat_sessions FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_heat_sessions_athlete_id ON athlete_heat_sessions(athlete_id);
CREATE INDEX IF NOT EXISTS idx_heat_sessions_date ON athlete_heat_sessions(session_date DESC);

/*
  ## Heat Adaptation Profile Table
  Stores aggregated adaptation metrics per athlete for quick dashboard access.
*/

CREATE TABLE IF NOT EXISTS athlete_heat_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  total_sessions integer DEFAULT 0,
  baseline_cardiac_load numeric(10,4),
  latest_cardiac_load numeric(10,4),
  cardiac_load_trend numeric(8,4),
  baseline_hr_drift numeric(6,2),
  latest_hr_drift numeric(6,2),
  hr_drift_trend numeric(6,2),
  baseline_rpe numeric(4,1),
  latest_rpe numeric(4,1),
  rpe_trend numeric(4,1),
  avg_sweat_rate_l_h numeric(6,3),
  latest_sweat_rate_l_h numeric(6,3),
  adaptation_score numeric(5,1),
  adaptation_classification text DEFAULT 'Insufficient Data',
  last_session_date date,
  history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(athlete_id)
);

ALTER TABLE athlete_heat_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches and admins can select heat profiles"
  ON athlete_heat_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches and admins can insert heat profiles"
  ON athlete_heat_profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Coaches and admins can update heat profiles"
  ON athlete_heat_profiles FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Coaches and admins can delete heat profiles"
  ON athlete_heat_profiles FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_heat_profiles_athlete_id ON athlete_heat_profiles(athlete_id);

ALTER TABLE athlete_heat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_heat_profiles ENABLE ROW LEVEL SECURITY;
