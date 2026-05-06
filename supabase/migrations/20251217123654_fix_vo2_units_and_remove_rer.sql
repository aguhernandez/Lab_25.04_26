/*
  # Fix VO2 Units and Remove RER from Schema
  
  ## Overview
  This migration fixes a critical bug where VO2 values were being misinterpreted.
  Users input VO2 in ml/kg/min (relative) but the system was treating them as L/min (absolute).
  
  ## Changes Made
  
  1. **Rename vo2 column to vo2_ml_kg_min**
     - Makes it explicit that values are in ml/kg/min (relative VO2)
     - Prevents unit confusion in calculations
  
  2. **Remove rer column**
     - RER (Respiratory Exchange Ratio) column removed from test_data_points
     - Not used in current metabolic calculations
  
  3. **Update constraints**
     - vo2_ml_kg_min must be >= 0 and <= 100 (physiological maximum)
  
  ## Important Notes
  - All VO2 values in the database are already in ml/kg/min
  - This is a renaming operation to clarify units, no data conversion needed
  - Frontend will calculate VO2 absolute (L/min) when needed: vo2_l_min = vo2_ml_kg_min * weight_kg / 1000
  - Validation added: if calculated vo2_l_min > 8 L/min, data is flagged as invalid
*/

-- Rename vo2 column to vo2_ml_kg_min to make units explicit
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_data_points' AND column_name = 'vo2'
  ) THEN
    ALTER TABLE test_data_points 
    RENAME COLUMN vo2 TO vo2_ml_kg_min;
  END IF;
END $$;

-- Update constraint to reflect correct units and add physiological maximum
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_data_points' AND column_name = 'vo2_ml_kg_min'
  ) THEN
    ALTER TABLE test_data_points 
    DROP CONSTRAINT IF EXISTS test_data_points_vo2_check;
    
    ALTER TABLE test_data_points 
    ADD CONSTRAINT test_data_points_vo2_ml_kg_min_check 
    CHECK (vo2_ml_kg_min >= 0 AND vo2_ml_kg_min <= 100);
  END IF;
END $$;

-- Remove rer column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'test_data_points' AND column_name = 'rer'
  ) THEN
    ALTER TABLE test_data_points DROP COLUMN rer;
  END IF;
END $$;