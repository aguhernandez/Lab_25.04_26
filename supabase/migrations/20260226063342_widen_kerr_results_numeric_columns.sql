/*
  # Widen numeric columns in anthropometry_kerr_results

  ## Problem
  Several columns were defined as numeric(6,2) or numeric(5,2), which can only hold
  values up to 9999.99 and 999.99 respectively. The Kerr body composition formulas
  can produce values (especially adipose_mass_kg and muscle_mass_kg) that exceed these
  limits, causing a "numeric field overflow" error on insert.

  ## Changes
  - Widen all _kg mass columns to numeric(10,4) to safely hold large values
  - Widen all _pct percentage columns to numeric(8,4)
  - Widen all _z_score columns to numeric(8,4) (z-scores can be large/negative)
  - Widen ratio and index columns to numeric(10,4)
  - Widen bmi and surface_area_m2 to numeric(8,4)
  - Widen somatotype component columns to numeric(8,4)

  ## Notes
  - No data is deleted; ALTER COLUMN TYPE only widens the precision
  - Safe to run multiple times (widening is always safe)
*/

ALTER TABLE anthropometry_kerr_results
  ALTER COLUMN skin_mass_kg TYPE numeric(10,4),
  ALTER COLUMN skin_mass_pct TYPE numeric(8,4),
  ALTER COLUMN skin_mass_z_score TYPE numeric(8,4),

  ALTER COLUMN adipose_mass_kg TYPE numeric(10,4),
  ALTER COLUMN adipose_mass_pct TYPE numeric(8,4),
  ALTER COLUMN adipose_mass_z_score TYPE numeric(8,4),

  ALTER COLUMN muscle_mass_kg TYPE numeric(10,4),
  ALTER COLUMN muscle_mass_pct TYPE numeric(8,4),
  ALTER COLUMN muscle_mass_z_score TYPE numeric(8,4),

  ALTER COLUMN residual_mass_kg TYPE numeric(10,4),
  ALTER COLUMN residual_mass_pct TYPE numeric(8,4),
  ALTER COLUMN residual_mass_z_score TYPE numeric(8,4),

  ALTER COLUMN bone_mass_kg TYPE numeric(10,4),
  ALTER COLUMN bone_mass_pct TYPE numeric(8,4),
  ALTER COLUMN bone_mass_z_score TYPE numeric(8,4),

  ALTER COLUMN muscle_bone_ratio TYPE numeric(10,4),
  ALTER COLUMN adipose_muscle_ratio TYPE numeric(10,4),
  ALTER COLUMN ballast_index TYPE numeric(10,4),
  ALTER COLUMN bmi TYPE numeric(8,4),
  ALTER COLUMN surface_area_m2 TYPE numeric(8,4),

  ALTER COLUMN somatotype_endomorphy TYPE numeric(8,4),
  ALTER COLUMN somatotype_mesomorphy TYPE numeric(8,4),
  ALTER COLUMN somatotype_ectomorphy TYPE numeric(8,4);
