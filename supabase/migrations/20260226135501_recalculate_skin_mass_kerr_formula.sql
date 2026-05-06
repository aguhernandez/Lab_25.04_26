
/*
  # Recalculate skin_mass_kg using correct Kerr surface area formula

  ## Summary
  The previous surface area used DuBois formula (0.007184 × stature^0.725 × mass^0.425).
  The correct Kerr formula uses sex/age-specific constants:
    - Male ≥ 12 years: constant = 68.308
    - Female ≥ 12 years: constant = 73.074
    - Any sex < 12 years: constant = 70.691
  Surface area = (constant × mass^0.425 × stature^0.725) / 10000
  Skin mass = surface_area × skin_thickness × 1.05
    where skin_thickness = 2.07 (male) or 1.96 (female)

  ## Changes
  - Updates surface_area_m2, skin_mass_kg, skin_mass_pct in anthropometry_kerr_results
*/

UPDATE anthropometry_kerr_results kr
SET
  surface_area_m2 = (
    SELECT
      CASE
        WHEN meas.age_years < 12 THEN (70.691 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
        WHEN meas.sex = 'female'  THEN (73.074 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
        ELSE                           (68.308 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
      END
    FROM anthropometry_measurements meas
    WHERE meas.id = kr.measurement_id
  ),
  skin_mass_kg = (
    SELECT
      CASE
        WHEN meas.age_years < 12 THEN (70.691 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
        WHEN meas.sex = 'female'  THEN (73.074 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
        ELSE                           (68.308 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
      END
      * CASE WHEN meas.sex = 'male' THEN 2.07 ELSE 1.96 END
      * 1.05
    FROM anthropometry_measurements meas
    WHERE meas.id = kr.measurement_id
  ),
  skin_mass_pct = (
    SELECT
      CASE WHEN meas.body_mass_kg > 0 THEN
        (
          CASE
            WHEN meas.age_years < 12 THEN (70.691 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
            WHEN meas.sex = 'female'  THEN (73.074 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
            ELSE                           (68.308 * POWER(meas.body_mass_kg, 0.425) * POWER(meas.stature_cm, 0.725)) / 10000
          END
          * CASE WHEN meas.sex = 'male' THEN 2.07 ELSE 1.96 END
          * 1.05
        ) / meas.body_mass_kg * 100
      ELSE 0 END
    FROM anthropometry_measurements meas
    WHERE meas.id = kr.measurement_id
  );
