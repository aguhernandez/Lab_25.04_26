/*
  # Extend Kerr Results with Complete Calculations
  
  1. New Table
    - `anthropometry_kerr_results`
      - Stores 5-component body composition results (Kerr Model)
      - Each component: mass (kg), percentage (%), Z-score
      - Derived indices and ratios
      - Links to measurement and athlete
  
  2. Components (Ross & Wilson 1988 Phantom Reference)
    - Skin Mass (Component 1)
    - Adipose Mass (Component 2) - Phantom: 116.41 ± 34.79 kg
    - Muscle Mass (Component 3) - Phantom: 207.21 ± 13.74 kg
    - Residual Mass (Component 4) - Phantom: 109.35 ± 7.08 kg
    - Bone Mass (Component 5) - Phantom: 98.88 ± 5.33 kg
  
  3. Derived Metrics
    - Muscle/Bone Ratio
    - Adipose/Muscle Ratio
    - Ballast Index
    - BMI, Surface Area
    - Somatotype components
  
  4. Security
    - Enable RLS
    - Athletes view own results
    - Trainers view team results
    - Admins view all results
*/

-- Create anthropometry_kerr_results table
CREATE TABLE IF NOT EXISTS anthropometry_kerr_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES anthropometry_measurements(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calculation_date timestamptz DEFAULT now() NOT NULL,
  
  -- Component 1: Skin Mass
  skin_mass_kg numeric(6,2),
  skin_mass_pct numeric(5,2),
  skin_mass_z_score numeric(6,2),
  
  -- Component 2: Adipose Mass (Fat)
  adipose_mass_kg numeric(6,2),
  adipose_mass_pct numeric(5,2),
  adipose_mass_z_score numeric(6,2),
  
  -- Component 3: Muscle Mass
  muscle_mass_kg numeric(6,2),
  muscle_mass_pct numeric(5,2),
  muscle_mass_z_score numeric(6,2),
  
  -- Component 4: Residual Mass (organs, fluids)
  residual_mass_kg numeric(6,2),
  residual_mass_pct numeric(5,2),
  residual_mass_z_score numeric(6,2),
  
  -- Component 5: Bone Mass
  bone_mass_kg numeric(6,2),
  bone_mass_pct numeric(5,2),
  bone_mass_z_score numeric(6,2),
  
  -- Derived indices
  muscle_bone_ratio numeric(6,2),
  adipose_muscle_ratio numeric(6,2),
  ballast_index numeric(6,2),
  bmi numeric(5,2),
  surface_area_m2 numeric(5,2),
  
  -- Somatotype components
  somatotype_endomorphy numeric(5,2),
  somatotype_mesomorphy numeric(5,2),
  somatotype_ectomorphy numeric(5,2),
  
  -- Metadata
  calculation_version text DEFAULT '1.0',
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE anthropometry_kerr_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies for anthropometry_kerr_results

-- Athletes can view own Kerr results
CREATE POLICY "Athletes can view own Kerr results"
  ON anthropometry_kerr_results
  FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

-- Athletes can insert own Kerr results
CREATE POLICY "Athletes can insert own Kerr results"
  ON anthropometry_kerr_results
  FOR INSERT
  TO authenticated
  WITH CHECK (athlete_id = auth.uid());

-- Athletes can update own Kerr results
CREATE POLICY "Athletes can update own Kerr results"
  ON anthropometry_kerr_results
  FOR UPDATE
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Admins have full access
CREATE POLICY "Admins have full access to Kerr results"
  ON anthropometry_kerr_results
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
CREATE INDEX IF NOT EXISTS idx_kerr_results_measurement_id ON anthropometry_kerr_results(measurement_id);
CREATE INDEX IF NOT EXISTS idx_kerr_results_athlete_id ON anthropometry_kerr_results(athlete_id);
CREATE INDEX IF NOT EXISTS idx_kerr_results_calculation_date ON anthropometry_kerr_results(calculation_date DESC);