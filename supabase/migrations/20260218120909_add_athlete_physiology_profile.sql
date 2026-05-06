/*
  # Add Athlete Physiology Profile (Dual-Layer Architecture)

  ## Summary
  Creates the dual-layer physiological profile system for athletes, where:
  - LAYER 1: Immutable physiological data from lab tests (never edited)
  - LAYER 2: Editable training zones that coaches can adjust

  ## New Tables

  ### athlete_physiology_profiles
  Stores the current and historical physiological capacity of each athlete,
  automatically updated when a lab test is completed.

  Columns:
  - id: Primary key
  - athlete_id: Reference to athlete
  - source: Where this data came from ('lab', 'manual')
  - last_test_date: Date of the test that generated this profile
  - last_test_id: Reference to the specific test
  - vo2max_absolute_l_min: VO2max in L/min
  - vo2max_relative_ml_kg_min: VO2max in ml/kg/min
  - vo2max_relative_ml_ffm_min: VO2max relative to fat-free mass
  - vo2max_confidence: Measurement confidence level
  - lt1_hr, lt1_power, lt1_pace: Lactate threshold 1 values
  - lt2_hr, lt2_power, lt2_pace: Lactate threshold 2 values
  - fatmax_hr, fatmax_power, fatmax_pace: Fat oxidation max values
  - vam_kmh: Maximum aerobic speed (km/h)
  - pam_watts: Maximum aerobic power (watts)
  - hrmax: Maximum heart rate
  - physiology_zones: Auto-generated zones from pure physiology (JSON)
  - history: Array of past physiology snapshots (JSON)
  - created_at, updated_at

  ### athlete_training_zones
  The editable layer — training zones that coaches can customize
  without touching the physiological data.

  Columns:
  - id: Primary key
  - athlete_id: Reference to athlete
  - mode: 'physiology_based' or 'manual_override'
  - locked_to_lab: If true, zones cannot be edited manually
  - last_modified_by: Who last modified ('lab_auto', 'coach', 'athlete')
  - last_modified_at: When last modified
  - heart_rate_zones: HR-based zones (JSON)
  - power_zones: Power-based zones (JSON)
  - pace_zones: Pace-based zones (JSON)
  - physiology_reference: Snapshot of physiology used to generate (JSON)
  - zone_history: Full audit trail of zone changes (JSON array)
  - created_at, updated_at

  ## Security
  - RLS enabled on both tables
  - Anonymous (anon) role can read/write (matches existing app pattern)
*/

CREATE TABLE IF NOT EXISTS athlete_physiology_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'lab' CHECK (source IN ('lab', 'manual')),
  last_test_date date,
  last_test_id uuid REFERENCES tests(id) ON DELETE SET NULL,
  vo2max_absolute_l_min numeric,
  vo2max_relative_ml_kg_min numeric,
  vo2max_relative_ml_ffm_min numeric,
  vo2max_confidence text,
  lt1_hr integer,
  lt1_power numeric,
  lt1_pace text,
  lt1_percent_vo2max numeric,
  lt1_percent_hrmax numeric,
  lt1_confidence text,
  lt2_hr integer,
  lt2_power numeric,
  lt2_pace text,
  lt2_percent_vo2max numeric,
  lt2_percent_hrmax numeric,
  lt2_confidence text,
  fatmax_hr integer,
  fatmax_power numeric,
  fatmax_pace text,
  fatmax_confidence text,
  vam_kmh numeric,
  pam_watts numeric,
  hrmax integer,
  physiology_zones jsonb DEFAULT '[]'::jsonb,
  history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(athlete_id)
);

ALTER TABLE athlete_physiology_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read athlete physiology profiles"
  ON athlete_physiology_profiles FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert athlete physiology profiles"
  ON athlete_physiology_profiles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update athlete physiology profiles"
  ON athlete_physiology_profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS athlete_training_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'physiology_based' CHECK (mode IN ('physiology_based', 'manual_override')),
  locked_to_lab boolean NOT NULL DEFAULT false,
  last_modified_by text NOT NULL DEFAULT 'lab_auto' CHECK (last_modified_by IN ('lab_auto', 'coach', 'athlete')),
  last_modified_at timestamptz DEFAULT now(),
  heart_rate_zones jsonb DEFAULT '[]'::jsonb,
  power_zones jsonb DEFAULT '[]'::jsonb,
  pace_zones jsonb DEFAULT '[]'::jsonb,
  physiology_reference jsonb DEFAULT '{}'::jsonb,
  zone_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(athlete_id)
);

ALTER TABLE athlete_training_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read athlete training zones"
  ON athlete_training_zones FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon can insert athlete training zones"
  ON athlete_training_zones FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "anon can update athlete training zones"
  ON athlete_training_zones FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_athlete_physiology_profiles_athlete_id ON athlete_physiology_profiles(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_training_zones_athlete_id ON athlete_training_zones(athlete_id);
