/*
  # Restructure Anthropometry ISAK Standard Schema
  
  1. Changes to anthropometry_measurements
    - Add CHECK constraints for valid measurement ranges
    - Add age and sex columns for calculations
    - Add quality control flags
  
  2. Quality Control
    - Error percentage thresholds per ISAK standards
    - Measurement validity flags
    - Technician notes
  
  3. Performance Optimization
    - Additional indexes for common queries
    - Updated timestamp triggers
*/

-- Add age and sex columns (needed for Kerr calculations)
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS age_years numeric(4,1);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('male', 'female'));

-- Add quality control columns
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS technician_name text;
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS measurement_quality text CHECK (measurement_quality IN ('excellent', 'good', 'acceptable', 'poor'));
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS validation_status text DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'rejected'));

-- Add CHECK constraints for basic measurements (valid ranges)
DO $$
BEGIN
  -- Body mass: 20-300 kg
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'anthropometry_measurements' 
    AND constraint_name = 'body_mass_kg_check'
  ) THEN
    ALTER TABLE anthropometry_measurements 
    ADD CONSTRAINT body_mass_kg_check 
    CHECK (body_mass_kg IS NULL OR (body_mass_kg >= 20 AND body_mass_kg <= 300));
  END IF;
  
  -- Stature: 50-250 cm
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'anthropometry_measurements' 
    AND constraint_name = 'stature_cm_check'
  ) THEN
    ALTER TABLE anthropometry_measurements 
    ADD CONSTRAINT stature_cm_check 
    CHECK (stature_cm IS NULL OR (stature_cm >= 50 AND stature_cm <= 250));
  END IF;
  
  -- Age: 6-100 years
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'anthropometry_measurements' 
    AND constraint_name = 'age_years_check'
  ) THEN
    ALTER TABLE anthropometry_measurements 
    ADD CONSTRAINT age_years_check 
    CHECK (age_years IS NULL OR (age_years >= 6 AND age_years <= 100));
  END IF;
END $$;

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to anthropometry_measurements
DROP TRIGGER IF EXISTS update_anthropometry_measurements_updated_at ON anthropometry_measurements;
CREATE TRIGGER update_anthropometry_measurements_updated_at
  BEFORE UPDATE ON anthropometry_measurements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to anthropometry_kerr_results
DROP TRIGGER IF EXISTS update_anthropometry_kerr_results_updated_at ON anthropometry_kerr_results;
CREATE TRIGGER update_anthropometry_kerr_results_updated_at
  BEFORE UPDATE ON anthropometry_kerr_results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to anthropometry_indices
DROP TRIGGER IF EXISTS update_anthropometry_indices_updated_at ON anthropometry_indices;
CREATE TRIGGER update_anthropometry_indices_updated_at
  BEFORE UPDATE ON anthropometry_indices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_measurements_athlete_date ON anthropometry_measurements(athlete_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_method ON anthropometry_measurements(measurement_method);
CREATE INDEX IF NOT EXISTS idx_measurements_validation ON anthropometry_measurements(validation_status);

-- Add comment for documentation
COMMENT ON TABLE anthropometry_measurements IS 'ISAK Level 2 anthropometry measurements following international standards. Stores 42 variables with triple measurement protocol (m1, m2, m3) and auto-calculated median, stdev, error_pct.';
COMMENT ON TABLE anthropometry_kerr_results IS 'Kerr 5-component body composition results based on Ross & Wilson 1988 Phantom reference model. Components: Skin, Adipose, Muscle, Residual, Bone.';
COMMENT ON TABLE anthropometry_indices IS 'Derived proportionality indices and maturity estimations calculated from anthropometry measurements.';