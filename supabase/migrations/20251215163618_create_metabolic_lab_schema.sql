/*
  # Asciende Metabolic Lab - Initial Schema

  ## Overview
  This migration creates the database structure for the Metabolic Lab tool, 
  a coach-led physiological testing and modeling system for endurance athletes.

  ## New Tables
  
  ### `athletes`
  Stores basic athlete information and references to anthropometry data
  - `id` (uuid, primary key)
  - `name` (text) - Athlete's full name
  - `sport` (text) - Primary sport (cycling, running, triathlon, swimming)
  - `date_of_birth` (date) - For age calculation
  - `sex` (text) - For physiological calculations
  - `weight_kg` (numeric) - Current weight (from anthropometry)
  - `height_cm` (numeric) - Height (from anthropometry)
  - `body_fat_percent` (numeric) - Body fat percentage (from anthropometry)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `tests`
  Stores test session metadata
  - `id` (uuid, primary key)
  - `athlete_id` (uuid, foreign key to athletes)
  - `test_date` (date)
  - `sport` (text) - Sport for this specific test
  - `test_type` (text) - ramp, step, steady_state, manual
  - `status` (text) - in_progress, completed, archived
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `test_data_points`
  Stores individual data points for each test stage
  - `id` (uuid, primary key)
  - `test_id` (uuid, foreign key to tests)
  - `stage_number` (integer) - Sequential stage number
  - `duration_seconds` (integer) - Stage duration
  - `heart_rate` (integer) - HR in bpm (required)
  - `power_watts` (numeric) - Power output (optional)
  - `speed_pace` (text) - Speed or pace (optional)
  - `vo2` (numeric) - VO2 measurement (optional)
  - `lactate` (numeric) - Lactate in mmol/L (optional)
  - `rer` (numeric) - Respiratory Exchange Ratio (optional)
  - `vt1_marker` (boolean) - Ventilatory Threshold 1 marker
  - `vt2_marker` (boolean) - Ventilatory Threshold 2 marker
  - `created_at` (timestamptz)

  ### `test_results`
  Stores calculated results and coach interpretations
  - `id` (uuid, primary key)
  - `test_id` (uuid, foreign key to tests, unique)
  - `vo2max` (numeric) - Calculated or measured VO2max
  - `vo2max_measured` (boolean) - True if directly measured
  - `lt1_hr` (integer) - Lactate Threshold 1 HR
  - `lt1_power` (numeric) - LT1 power (if available)
  - `lt2_hr` (integer) - Lactate Threshold 2 HR
  - `lt2_power` (numeric) - LT2 power (if available)
  - `fatmax_hr` (integer) - FatMax heart rate
  - `hr_drift_percent` (numeric) - HR drift for steady-state tests
  - `training_zones` (jsonb) - Calculated training zones
  - `coach_notes` (text) - Coach's interpretation and notes
  - `data_quality` (text) - Assessment of data quality
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - For Phase 1 (standalone), allow all operations for authenticated users
  - Future phases will implement role-based access (coach vs athlete)
*/

-- Create athletes table
CREATE TABLE IF NOT EXISTS athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sport text NOT NULL CHECK (sport IN ('cycling', 'running', 'triathlon', 'swimming')),
  date_of_birth date,
  sex text CHECK (sex IN ('male', 'female', 'other')),
  weight_kg numeric,
  height_cm numeric,
  body_fat_percent numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tests table
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  sport text NOT NULL CHECK (sport IN ('cycling', 'running', 'triathlon', 'swimming')),
  test_type text NOT NULL CHECK (test_type IN ('ramp', 'step', 'steady_state', 'manual')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create test_data_points table
CREATE TABLE IF NOT EXISTS test_data_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  stage_number integer NOT NULL,
  duration_seconds integer NOT NULL,
  heart_rate integer NOT NULL CHECK (heart_rate > 0 AND heart_rate < 250),
  power_watts numeric CHECK (power_watts >= 0),
  speed_pace text,
  vo2 numeric CHECK (vo2 >= 0),
  lactate numeric CHECK (lactate >= 0),
  rer numeric CHECK (rer >= 0 AND rer <= 2),
  vt1_marker boolean DEFAULT false,
  vt2_marker boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(test_id, stage_number)
);

-- Create test_results table
CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE UNIQUE,
  vo2max numeric,
  vo2max_measured boolean DEFAULT false,
  lt1_hr integer,
  lt1_power numeric,
  lt2_hr integer,
  lt2_power numeric,
  fatmax_hr integer,
  hr_drift_percent numeric,
  training_zones jsonb,
  coach_notes text,
  data_quality text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Phase 1: Simple authenticated access)
-- Future: Will be refined with coach/athlete role separation

CREATE POLICY "Coaches can view all athletes"
  ON athletes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can create athletes"
  ON athletes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Coaches can update athletes"
  ON athletes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Coaches can delete athletes"
  ON athletes FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can view all tests"
  ON tests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can create tests"
  ON tests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Coaches can update tests"
  ON tests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Coaches can delete tests"
  ON tests FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can view all test data points"
  ON test_data_points FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can create test data points"
  ON test_data_points FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Coaches can update test data points"
  ON test_data_points FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Coaches can delete test data points"
  ON test_data_points FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can view all test results"
  ON test_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can create test results"
  ON test_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Coaches can update test results"
  ON test_results FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Coaches can delete test results"
  ON test_results FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tests_athlete_id ON tests(athlete_id);
CREATE INDEX IF NOT EXISTS idx_test_data_points_test_id ON test_data_points(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_athletes_sport ON athletes(sport);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);