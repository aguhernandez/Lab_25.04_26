
/*
  # Recalculate residual_mass_kg using correct Kerr Z-score formula

  ## Summary
  The previous calculation used a proportional phantom formula for residual mass.
  The correct Kerr formula is:
    1. waist_corrected = waist_girth - (abdominal_sf_mm * π / 10)
    2. residual_scaled = (chest_transverse + chest_ap + waist_corrected) * (89.92 / sitting_height)
    3. residual_z = (residual_scaled - 109.35) / 7.08
    4. residual_mass_kg = ((residual_z * 1.24) + 6.1) / (89.92 / sitting_height)^3

  ## Changes
  - Updates residual_mass_kg in anthropometry_kerr_results using correct formula
  - Also updates residual_mass_pct based on body_mass
  - Uses abdominal skinfold to correct the waist girth before calculation
*/

UPDATE anthropometry_kerr_results kr
SET
  residual_mass_kg = (
    WITH measurements AS (
      SELECT
        m.body_mass_kg,
        m.stature_cm,
        COALESCE(m.sitting_height_cm, m.stature_cm * 0.52) AS sitting_height,
        COALESCE(m.transverse_chest_diameter_cm_median, m.stature_cm * 0.17) AS chest_transverse,
        COALESCE(m.ap_chest_diameter_cm_median, m.stature_cm * 0.11) AS chest_ap,
        COALESCE(m.waist_girth_cm_median, m.stature_cm * 0.45) AS waist_girth_raw,
        COALESCE(m.abdominal_sf_mm_median, 0) AS abdominal_sf
      FROM anthropometry_measurements m
      WHERE m.id = kr.measurement_id
    )
    SELECT
      ((((
        (chest_transverse + chest_ap + (waist_girth_raw - (abdominal_sf * pi() / 10)))
        * (89.92 / sitting_height)
        - 109.35
      ) / 7.08) * 1.24) + 6.1)
      / POWER(89.92 / sitting_height, 3)
    FROM measurements
  ),
  residual_mass_pct = (
    WITH measurements AS (
      SELECT
        m.body_mass_kg,
        m.stature_cm,
        COALESCE(m.sitting_height_cm, m.stature_cm * 0.52) AS sitting_height,
        COALESCE(m.transverse_chest_diameter_cm_median, m.stature_cm * 0.17) AS chest_transverse,
        COALESCE(m.ap_chest_diameter_cm_median, m.stature_cm * 0.11) AS chest_ap,
        COALESCE(m.waist_girth_cm_median, m.stature_cm * 0.45) AS waist_girth_raw,
        COALESCE(m.abdominal_sf_mm_median, 0) AS abdominal_sf
      FROM anthropometry_measurements m
      WHERE m.id = kr.measurement_id
    )
    SELECT
      CASE WHEN body_mass_kg > 0 THEN
        (
          ((((
            (chest_transverse + chest_ap + (waist_girth_raw - (abdominal_sf * pi() / 10)))
            * (89.92 / sitting_height)
            - 109.35
          ) / 7.08) * 1.24) + 6.1)
          / POWER(89.92 / sitting_height, 3)
        ) / body_mass_kg * 100
      ELSE 0 END
    FROM measurements
  );
