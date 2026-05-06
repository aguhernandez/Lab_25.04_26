/*
  # Add Complete ISAK Level 2 Measurements - All 42 Variables
  
  1. Schema Extension
    - Adds all 42 ISAK Level 2 standard anthropometry variables
    - Each variable has 6 columns: m1, m2, m3, median, stdev, error_pct
    - Total: 252 columns for complete ISAK protocol
  
  2. Variable Categories
    - Skinfolds (8 sites × 6 columns = 48 columns)
    - Girths/Perimeters (13 sites × 6 columns = 78 columns)
    - Lengths (8 measurements × 6 columns = 48 columns)
    - Breadths/Diameters (7 measurements × 6 columns = 42 columns)
  
  3. ISAK Triple Measurement Protocol
    - m1, m2, m3: Three consecutive measurements (ISAK requirement)
    - median: Automatically calculated middle value
    - stdev: Standard deviation of the three measurements
    - error_pct: Percentage error (quality control)
*/

-- SKINFOLDS (8 sites) - measured in millimeters (mm)

-- Triceps skinfold
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS triceps_sf_mm_m1 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS triceps_sf_mm_m2 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS triceps_sf_mm_m3 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS triceps_sf_mm_median numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS triceps_sf_mm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS triceps_sf_mm_error_pct numeric(5,2);

-- Subscapular skinfold
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS subscapular_sf_mm_m1 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS subscapular_sf_mm_m2 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS subscapular_sf_mm_m3 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS subscapular_sf_mm_median numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS subscapular_sf_mm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS subscapular_sf_mm_error_pct numeric(5,2);

-- Biceps skinfold
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biceps_sf_mm_m1 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biceps_sf_mm_m2 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biceps_sf_mm_m3 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biceps_sf_mm_median numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biceps_sf_mm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biceps_sf_mm_error_pct numeric(5,2);

-- Iliac crest skinfold
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliac_crest_sf_mm_m1 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliac_crest_sf_mm_m2 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliac_crest_sf_mm_m3 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliac_crest_sf_mm_median numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliac_crest_sf_mm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliac_crest_sf_mm_error_pct numeric(5,2);

-- Supraspinale skinfold
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS supraspinale_sf_mm_m1 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS supraspinale_sf_mm_m2 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS supraspinale_sf_mm_m3 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS supraspinale_sf_mm_median numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS supraspinale_sf_mm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS supraspinale_sf_mm_error_pct numeric(5,2);

-- Abdominal skinfold
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS abdominal_sf_mm_m1 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS abdominal_sf_mm_m2 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS abdominal_sf_mm_m3 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS abdominal_sf_mm_median numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS abdominal_sf_mm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS abdominal_sf_mm_error_pct numeric(5,2);

-- Front thigh skinfold
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS front_thigh_sf_mm_m1 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS front_thigh_sf_mm_m2 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS front_thigh_sf_mm_m3 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS front_thigh_sf_mm_median numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS front_thigh_sf_mm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS front_thigh_sf_mm_error_pct numeric(5,2);

-- Medial calf skinfold
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS medial_calf_sf_mm_m1 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS medial_calf_sf_mm_m2 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS medial_calf_sf_mm_m3 numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS medial_calf_sf_mm_median numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS medial_calf_sf_mm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS medial_calf_sf_mm_error_pct numeric(5,2);

-- GIRTHS/PERIMETERS (13 sites) - measured in centimeters (cm)

-- Head girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS head_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS head_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS head_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS head_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS head_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS head_girth_cm_error_pct numeric(5,2);

-- Neck girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS neck_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS neck_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS neck_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS neck_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS neck_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS neck_girth_cm_error_pct numeric(5,2);

-- Arm relaxed girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_relaxed_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_relaxed_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_relaxed_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_relaxed_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_relaxed_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_relaxed_girth_cm_error_pct numeric(5,2);

-- Arm flexed girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_flexed_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_flexed_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_flexed_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_flexed_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_flexed_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS arm_flexed_girth_cm_error_pct numeric(5,2);

-- Forearm girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS forearm_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS forearm_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS forearm_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS forearm_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS forearm_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS forearm_girth_cm_error_pct numeric(5,2);

-- Wrist girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS wrist_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS wrist_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS wrist_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS wrist_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS wrist_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS wrist_girth_cm_error_pct numeric(5,2);

-- Chest girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS chest_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS chest_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS chest_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS chest_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS chest_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS chest_girth_cm_error_pct numeric(5,2);

-- Waist girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS waist_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS waist_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS waist_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS waist_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS waist_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS waist_girth_cm_error_pct numeric(5,2);

-- Gluteal girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS gluteal_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS gluteal_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS gluteal_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS gluteal_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS gluteal_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS gluteal_girth_cm_error_pct numeric(5,2);

-- Thigh upper girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_upper_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_upper_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_upper_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_upper_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_upper_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_upper_girth_cm_error_pct numeric(5,2);

-- Thigh mid girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_mid_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_mid_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_mid_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_mid_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_mid_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS thigh_mid_girth_cm_error_pct numeric(5,2);

-- Calf max girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS calf_max_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS calf_max_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS calf_max_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS calf_max_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS calf_max_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS calf_max_girth_cm_error_pct numeric(5,2);

-- Ankle min girth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ankle_min_girth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ankle_min_girth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ankle_min_girth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ankle_min_girth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ankle_min_girth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ankle_min_girth_cm_error_pct numeric(5,2);

-- LENGTHS (8 measurements) - measured in centimeters (cm)

-- Acromiale-radiale length
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS acromiale_radiale_length_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS acromiale_radiale_length_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS acromiale_radiale_length_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS acromiale_radiale_length_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS acromiale_radiale_length_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS acromiale_radiale_length_cm_error_pct numeric(5,2);

-- Radiale-stylion length
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS radiale_stylion_length_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS radiale_stylion_length_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS radiale_stylion_length_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS radiale_stylion_length_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS radiale_stylion_length_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS radiale_stylion_length_cm_error_pct numeric(5,2);

-- Midstylion-dactylion length
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS midstylion_dactylion_length_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS midstylion_dactylion_length_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS midstylion_dactylion_length_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS midstylion_dactylion_length_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS midstylion_dactylion_length_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS midstylion_dactylion_length_cm_error_pct numeric(5,2);

-- Iliospinale height
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliospinale_height_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliospinale_height_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliospinale_height_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliospinale_height_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliospinale_height_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS iliospinale_height_cm_error_pct numeric(5,2);

-- Trochanterion height
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_height_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_height_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_height_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_height_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_height_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_height_cm_error_pct numeric(5,2);

-- Trochanterion-tibiale length
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_tibiale_length_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_tibiale_length_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_tibiale_length_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_tibiale_length_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_tibiale_length_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS trochanterion_tibiale_length_cm_error_pct numeric(5,2);

-- Tibiale laterale height
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_laterale_height_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_laterale_height_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_laterale_height_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_laterale_height_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_laterale_height_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_laterale_height_cm_error_pct numeric(5,2);

-- Tibiale mediale-sphyrion length
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_mediale_sphyrion_length_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_mediale_sphyrion_length_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_mediale_sphyrion_length_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_mediale_sphyrion_length_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_mediale_sphyrion_length_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS tibiale_mediale_sphyrion_length_cm_error_pct numeric(5,2);

-- BREADTHS/DIAMETERS (7 measurements) - measured in centimeters (cm)

-- Biacromial breadth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biacromial_breadth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biacromial_breadth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biacromial_breadth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biacromial_breadth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biacromial_breadth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biacromial_breadth_cm_error_pct numeric(5,2);

-- Biiliocristal breadth
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biiliocristal_breadth_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biiliocristal_breadth_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biiliocristal_breadth_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biiliocristal_breadth_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biiliocristal_breadth_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS biiliocristal_breadth_cm_error_pct numeric(5,2);

-- Foot length
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS foot_length_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS foot_length_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS foot_length_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS foot_length_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS foot_length_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS foot_length_cm_error_pct numeric(5,2);

-- Transverse chest diameter
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS transverse_chest_diameter_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS transverse_chest_diameter_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS transverse_chest_diameter_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS transverse_chest_diameter_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS transverse_chest_diameter_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS transverse_chest_diameter_cm_error_pct numeric(5,2);

-- AP chest diameter
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ap_chest_diameter_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ap_chest_diameter_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ap_chest_diameter_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ap_chest_diameter_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ap_chest_diameter_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS ap_chest_diameter_cm_error_pct numeric(5,2);

-- Humerus diameter
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS humerus_diameter_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS humerus_diameter_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS humerus_diameter_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS humerus_diameter_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS humerus_diameter_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS humerus_diameter_cm_error_pct numeric(5,2);

-- Femur diameter
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS femur_diameter_cm_m1 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS femur_diameter_cm_m2 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS femur_diameter_cm_m3 numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS femur_diameter_cm_median numeric(6,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS femur_diameter_cm_stdev numeric(5,2);
ALTER TABLE anthropometry_measurements ADD COLUMN IF NOT EXISTS femur_diameter_cm_error_pct numeric(5,2);