/*
  # Add extended Kerr calculation columns

  ## Summary
  Adds all new columns to anthropometry_kerr_results to support the complete
  Excel-equivalent Kerr 5-component body composition calculations.

  ## New Columns

  ### Adjustment columns (per-component technician error correction)
  - `skin_mass_adjustment`, `skin_mass_adjusted_kg`
  - `adipose_mass_adjustment`, `adipose_mass_adjusted_kg`
  - `muscle_mass_adjustment`, `muscle_mass_adjusted_kg`
  - `residual_mass_adjustment`, `residual_mass_adjusted_kg`
  - `bone_mass_adjustment`, `bone_mass_adjusted_kg`

  ### Muscle mass without chest girth
  - `muscle_mass_no_chest_kg`, `muscle_mass_no_chest_pct`
  - `muscle_mass_no_chest_adjustment`, `muscle_mass_no_chest_adjusted_kg`

  ### Bone mass split into head and body
  - `bone_mass_head_kg`, `bone_mass_head_pct`, `bone_mass_head_z_score`
  - `bone_mass_head_adjustment`, `bone_mass_head_adjusted_kg`
  - `bone_mass_body_kg`, `bone_mass_body_pct`, `bone_mass_body_z_score`
  - `bone_mass_body_adjustment`, `bone_mass_body_adjusted_kg`
  - `bone_mass_adjustment`, `bone_mass_adjusted_kg`

  ### Structured weight and error
  - `structured_weight_kg`: sum of 5 raw masses
  - `structured_weight_diff_kg`: difference vs actual body mass
  - `structured_weight_diff_pct`: percentage difference
  - `technician_error_pct`: error % used for adjustments

  ### Re-adjusted masses (scale 4 masses so all 5 sum exactly to body mass)
  - `skin_mass_readjusted_kg`, `skin_mass_readjusted_pct`
  - `adipose_mass_readjusted_kg`, `adipose_mass_readjusted_pct`
  - `muscle_mass_readjusted_kg`, `muscle_mass_readjusted_pct`
  - `residual_mass_readjusted_kg`, `residual_mass_readjusted_pct`
  - `bone_mass_readjusted_kg`, `bone_mass_readjusted_pct`

  ### Indices (mass / stature²)
  - `index_adipose`, `index_muscle`, `index_residual`, `index_bone`, `index_skin`
  - `index_muscle_bone`: muscle/bone ratio from readjusted masses
  - `index_muscle_ballast`: muscle / (adipose + residual + skin)
  - `index_ballast`: (adipose + residual + skin) / muscle

  ### Cross-sectional areas (cm²)
  - `cross_section_arm_muscle`, `cross_section_arm_adipose`
  - `cross_section_thigh_muscle`, `cross_section_thigh_adipose`
  - `cross_section_calf_muscle`, `cross_section_calf_adipose`

  ### Intermediate sums
  - `sum_corrected_girths`: sum of corrected girths (with chest)
  - `sum_corrected_girths_no_chest`: sum without chest
  - `sum_6_skinfolds`: sum of 6 skinfold measurements
  - `sum_diameters`: sum of bone diameters
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'anthropometry_kerr_results' AND column_name = 'skin_mass_adjustment') THEN
    ALTER TABLE anthropometry_kerr_results
      ADD COLUMN skin_mass_adjustment numeric DEFAULT 0,
      ADD COLUMN skin_mass_adjusted_kg numeric DEFAULT 0,
      ADD COLUMN adipose_mass_adjustment numeric DEFAULT 0,
      ADD COLUMN adipose_mass_adjusted_kg numeric DEFAULT 0,
      ADD COLUMN muscle_mass_adjustment numeric DEFAULT 0,
      ADD COLUMN muscle_mass_adjusted_kg numeric DEFAULT 0,
      ADD COLUMN muscle_mass_no_chest_kg numeric DEFAULT 0,
      ADD COLUMN muscle_mass_no_chest_pct numeric DEFAULT 0,
      ADD COLUMN muscle_mass_no_chest_adjustment numeric DEFAULT 0,
      ADD COLUMN muscle_mass_no_chest_adjusted_kg numeric DEFAULT 0,
      ADD COLUMN residual_mass_adjustment numeric DEFAULT 0,
      ADD COLUMN residual_mass_adjusted_kg numeric DEFAULT 0,
      ADD COLUMN bone_mass_head_kg numeric DEFAULT 0,
      ADD COLUMN bone_mass_head_pct numeric DEFAULT 0,
      ADD COLUMN bone_mass_head_z_score numeric DEFAULT 0,
      ADD COLUMN bone_mass_head_adjustment numeric DEFAULT 0,
      ADD COLUMN bone_mass_head_adjusted_kg numeric DEFAULT 0,
      ADD COLUMN bone_mass_body_kg numeric DEFAULT 0,
      ADD COLUMN bone_mass_body_pct numeric DEFAULT 0,
      ADD COLUMN bone_mass_body_z_score numeric DEFAULT 0,
      ADD COLUMN bone_mass_body_adjustment numeric DEFAULT 0,
      ADD COLUMN bone_mass_body_adjusted_kg numeric DEFAULT 0,
      ADD COLUMN bone_mass_adjustment numeric DEFAULT 0,
      ADD COLUMN bone_mass_adjusted_kg numeric DEFAULT 0,
      ADD COLUMN structured_weight_kg numeric DEFAULT 0,
      ADD COLUMN structured_weight_diff_kg numeric DEFAULT 0,
      ADD COLUMN structured_weight_diff_pct numeric DEFAULT 0,
      ADD COLUMN technician_error_pct numeric DEFAULT 2,
      ADD COLUMN skin_mass_readjusted_kg numeric DEFAULT 0,
      ADD COLUMN skin_mass_readjusted_pct numeric DEFAULT 0,
      ADD COLUMN adipose_mass_readjusted_kg numeric DEFAULT 0,
      ADD COLUMN adipose_mass_readjusted_pct numeric DEFAULT 0,
      ADD COLUMN muscle_mass_readjusted_kg numeric DEFAULT 0,
      ADD COLUMN muscle_mass_readjusted_pct numeric DEFAULT 0,
      ADD COLUMN residual_mass_readjusted_kg numeric DEFAULT 0,
      ADD COLUMN residual_mass_readjusted_pct numeric DEFAULT 0,
      ADD COLUMN bone_mass_readjusted_kg numeric DEFAULT 0,
      ADD COLUMN bone_mass_readjusted_pct numeric DEFAULT 0,
      ADD COLUMN index_adipose numeric DEFAULT 0,
      ADD COLUMN index_muscle numeric DEFAULT 0,
      ADD COLUMN index_residual numeric DEFAULT 0,
      ADD COLUMN index_bone numeric DEFAULT 0,
      ADD COLUMN index_skin numeric DEFAULT 0,
      ADD COLUMN index_muscle_bone numeric DEFAULT 0,
      ADD COLUMN index_muscle_ballast numeric DEFAULT 0,
      ADD COLUMN index_ballast numeric DEFAULT 0,
      ADD COLUMN cross_section_arm_muscle numeric DEFAULT 0,
      ADD COLUMN cross_section_arm_adipose numeric DEFAULT 0,
      ADD COLUMN cross_section_thigh_muscle numeric DEFAULT 0,
      ADD COLUMN cross_section_thigh_adipose numeric DEFAULT 0,
      ADD COLUMN cross_section_calf_muscle numeric DEFAULT 0,
      ADD COLUMN cross_section_calf_adipose numeric DEFAULT 0,
      ADD COLUMN sum_corrected_girths numeric DEFAULT 0,
      ADD COLUMN sum_corrected_girths_no_chest numeric DEFAULT 0,
      ADD COLUMN sum_6_skinfolds numeric DEFAULT 0,
      ADD COLUMN sum_diameters numeric DEFAULT 0;
  END IF;
END $$;
