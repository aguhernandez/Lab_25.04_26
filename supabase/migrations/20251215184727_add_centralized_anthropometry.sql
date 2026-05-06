/*
  # Centralized Anthropometry System

  ## Overview
  This migration enhances the athletes table to serve as the central HUB for anthropometry data
  and adds tracking to identify when tests use HUB data vs manual entry.

  ## Changes to `athletes` table
  1. Add `lean_body_mass_kg` (numeric) - Calculated lean body mass
     - Can be directly entered or auto-calculated from weight and body fat %
  
  ## Changes to `tests` table
  1. Add `anthropometry_source` (text) - Tracks data source
     - 'hub' = Data loaded from athlete's HUB profile
     - 'manual' = Data manually entered for this specific test
     - 'mixed' = Partial HUB data, supplemented with manual entry
  2. Add `anthropometry_snapshot` (jsonb) - Snapshot of anthropometry used for this test
     - Preserves exact values used even if athlete's HUB profile is updated later
     - Schema: {weight_kg, height_cm, age, sex, bodyFatPercent, leanBodyMassKg, source}

  ## Benefits
  - Single source of truth for athlete anthropometry
  - Historical tracking (snapshot preserves test-time values)
  - Clear indication of data provenance
  - Enables automatic updates when HUB is updated
  - Prevents duplicate data entry

  ## Security
  - No RLS changes needed (existing policies cover new columns)
*/

-- Add lean_body_mass_kg to athletes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'lean_body_mass_kg'
  ) THEN
    ALTER TABLE athletes ADD COLUMN lean_body_mass_kg numeric;
    COMMENT ON COLUMN athletes.lean_body_mass_kg IS 'Lean body mass in kg, calculated as weight_kg * (1 - body_fat_percent/100) or directly measured';
  END IF;
END $$;

-- Add anthropometry tracking to tests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'anthropometry_source'
  ) THEN
    ALTER TABLE tests ADD COLUMN anthropometry_source text CHECK (anthropometry_source IN ('hub', 'manual', 'mixed'));
    COMMENT ON COLUMN tests.anthropometry_source IS 'Source of anthropometry data: hub (from athlete profile), manual (entered for this test), or mixed (combination)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'anthropometry_snapshot'
  ) THEN
    ALTER TABLE tests ADD COLUMN anthropometry_snapshot jsonb;
    COMMENT ON COLUMN tests.anthropometry_snapshot IS 'Snapshot of anthropometry data used for this test to preserve historical accuracy';
  END IF;
END $$;

-- Create function to auto-calculate lean body mass when weight or body fat changes
CREATE OR REPLACE FUNCTION calculate_lean_body_mass()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-calculate if we have both weight and body fat, but lean_body_mass_kg is null
  IF NEW.weight_kg IS NOT NULL 
     AND NEW.body_fat_percent IS NOT NULL 
     AND NEW.lean_body_mass_kg IS NULL THEN
    NEW.lean_body_mass_kg := NEW.weight_kg * (1 - NEW.body_fat_percent / 100);
  END IF;
  
  -- Update timestamp
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic LBM calculation
DROP TRIGGER IF EXISTS trigger_calculate_lean_body_mass ON athletes;
CREATE TRIGGER trigger_calculate_lean_body_mass
  BEFORE INSERT OR UPDATE OF weight_kg, body_fat_percent
  ON athletes
  FOR EACH ROW
  EXECUTE FUNCTION calculate_lean_body_mass();

-- Create index for faster anthropometry queries
CREATE INDEX IF NOT EXISTS idx_tests_anthropometry_source ON tests(anthropometry_source);
