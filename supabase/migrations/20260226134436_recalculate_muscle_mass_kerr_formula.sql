
/*
  # Recalculate muscle_mass_kg using correct Kerr Z-score formula

  ## Summary
  The previous calculation used a proportional phantom formula for muscle mass.
  The correct Kerr formula is:
    1. armCorr = arm_relaxed - (triceps_sf * π / 10)
    2. forearmCorr = forearm (no correction)
    3. thighCorr = thigh_max - (front_thigh_sf * π / 10)
    4. calfCorr = calf_max - (medial_calf_sf * π / 10)
    5. chestCorr = chest_girth - (subscapular_sf * π / 10)
    6. sumCorr = armCorr + forearmCorr + thighCorr + calfCorr + chestCorr
    7. scaled = sumCorr * (170.18 / stature)
    8. Z = (scaled - 207.21) / 13.74
    9. muscle_mass_kg = (Z * 5.4 + 24.5) / (170.18 / stature)^3

  ## Changes
  - Updates muscle_mass_kg in anthropometry_kerr_results
  - Updates muscle_mass_pct based on body_mass
*/

UPDATE anthropometry_kerr_results kr
SET
  muscle_mass_kg = (
    WITH m AS (
      SELECT
        meas.body_mass_kg,
        meas.stature_cm,
        COALESCE(meas.arm_relaxed_girth_cm_median, 0) AS arm_relaxed,
        COALESCE(meas.forearm_girth_cm_median, 0) AS forearm,
        COALESCE(meas.thigh_upper_girth_cm_median, 0) AS thigh_max,
        COALESCE(meas.calf_max_girth_cm_median, 0) AS calf_max,
        COALESCE(meas.chest_girth_cm_median, 0) AS chest_girth,
        COALESCE(meas.triceps_sf_mm_median, 0) AS triceps_sf,
        COALESCE(meas.front_thigh_sf_mm_median, 0) AS front_thigh_sf,
        COALESCE(meas.medial_calf_sf_mm_median, 0) AS medial_calf_sf,
        COALESCE(meas.subscapular_sf_mm_median, 0) AS subscapular_sf
      FROM anthropometry_measurements meas
      WHERE meas.id = kr.measurement_id
    )
    SELECT
      (
        (
          (
            (
              (arm_relaxed - (triceps_sf * pi() / 10))
              + forearm
              + (thigh_max - (front_thigh_sf * pi() / 10))
              + (calf_max - (medial_calf_sf * pi() / 10))
              + (chest_girth - (subscapular_sf * pi() / 10))
            ) * (170.18 / stature_cm)
            - 207.21
          ) / 13.74 * 5.4
          + 24.5
        )
        / POWER(170.18 / stature_cm, 3)
      )
    FROM m
  ),
  muscle_mass_pct = (
    WITH m AS (
      SELECT
        meas.body_mass_kg,
        meas.stature_cm,
        COALESCE(meas.arm_relaxed_girth_cm_median, 0) AS arm_relaxed,
        COALESCE(meas.forearm_girth_cm_median, 0) AS forearm,
        COALESCE(meas.thigh_upper_girth_cm_median, 0) AS thigh_max,
        COALESCE(meas.calf_max_girth_cm_median, 0) AS calf_max,
        COALESCE(meas.chest_girth_cm_median, 0) AS chest_girth,
        COALESCE(meas.triceps_sf_mm_median, 0) AS triceps_sf,
        COALESCE(meas.front_thigh_sf_mm_median, 0) AS front_thigh_sf,
        COALESCE(meas.medial_calf_sf_mm_median, 0) AS medial_calf_sf,
        COALESCE(meas.subscapular_sf_mm_median, 0) AS subscapular_sf
      FROM anthropometry_measurements meas
      WHERE meas.id = kr.measurement_id
    )
    SELECT
      CASE WHEN body_mass_kg > 0 THEN
        (
          (
            (
              (
                (arm_relaxed - (triceps_sf * pi() / 10))
                + forearm
                + (thigh_max - (front_thigh_sf * pi() / 10))
                + (calf_max - (medial_calf_sf * pi() / 10))
                + (chest_girth - (subscapular_sf * pi() / 10))
              ) * (170.18 / stature_cm)
              - 207.21
            ) / 13.74 * 5.4
            + 24.5
          )
          / POWER(170.18 / stature_cm, 3)
        ) / body_mass_kg * 100
      ELSE 0 END
    FROM m
  );
