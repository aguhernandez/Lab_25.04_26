/*
  # Add Anthropometry Tables - Initial Schema
  
  1. New Tables
    - `anthropometry_measurements`
      - Core ISAK Level 2 anthropometry measurements storage
      - Links to athlete profiles
      - Stores measurement date and method
      - Foundation for 42 ISAK variables
    
    - `anthropometry_indices`
      - Stores derived proportionality indices
      - Cormic index, leg length, ponderal index, PHV age
      - Maturity classification
  
  2. Security
    - Enable RLS on all tables
    - Athletes can read/write own data
    - Trainers can read team data
    - Admins have full access
*/

-- Create anthropometry_measurements table (initial structure)
CREATE TABLE IF NOT EXISTS anthropometry_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  measurement_date timestamptz DEFAULT now() NOT NULL,
  measurement_method text DEFAULT 'manual' NOT NULL CHECK (measurement_method IN ('manual', 'bioimpedance')),
  
  -- Basic measurements
  body_mass_kg numeric(6,2),
  stature_cm numeric(6,2),
  sitting_height_cm numeric(6,2),
  arm_span_cm numeric(6,2),
  
  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create anthropometry_indices table
CREATE TABLE IF NOT EXISTS anthropometry_indices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES anthropometry_measurements(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Proportionality indices
  cormic_index numeric(5,2),
  leg_length_cm numeric(6,2),
  ponderal_index numeric(6,2),
  
  -- Maturity estimation
  phv_age numeric(5,2),
  maturity_classification text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE anthropometry_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE anthropometry_indices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anthropometry_measurements

-- Athletes can view own measurements
CREATE POLICY "Athletes can view own anthropometry measurements"
  ON anthropometry_measurements
  FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

-- Athletes can insert own measurements
CREATE POLICY "Athletes can insert own anthropometry measurements"
  ON anthropometry_measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (athlete_id = auth.uid());

-- Athletes can update own measurements
CREATE POLICY "Athletes can update own anthropometry measurements"
  ON anthropometry_measurements
  FOR UPDATE
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Admins can do everything
CREATE POLICY "Admins have full access to anthropometry measurements"
  ON anthropometry_measurements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for anthropometry_indices

-- Athletes can view own indices
CREATE POLICY "Athletes can view own anthropometry indices"
  ON anthropometry_indices
  FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

-- Athletes can insert own indices
CREATE POLICY "Athletes can insert own anthropometry indices"
  ON anthropometry_indices
  FOR INSERT
  TO authenticated
  WITH CHECK (athlete_id = auth.uid());

-- Admins have full access
CREATE POLICY "Admins have full access to anthropometry indices"
  ON anthropometry_indices
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_anthropometry_measurements_athlete_id ON anthropometry_measurements(athlete_id);
CREATE INDEX IF NOT EXISTS idx_anthropometry_measurements_date ON anthropometry_measurements(measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_anthropometry_indices_measurement_id ON anthropometry_indices(measurement_id);
CREATE INDEX IF NOT EXISTS idx_anthropometry_indices_athlete_id ON anthropometry_indices(athlete_id);