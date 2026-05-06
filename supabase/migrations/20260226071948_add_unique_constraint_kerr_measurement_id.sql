/*
  # Add unique constraint on anthropometry_kerr_results.measurement_id

  ## Changes
  - Removes duplicate rows per measurement_id (keeping the most recently created)
  - Adds a UNIQUE constraint on `measurement_id` so upsert with on_conflict works correctly
*/

DELETE FROM anthropometry_kerr_results a
WHERE a.ctid NOT IN (
  SELECT DISTINCT ON (measurement_id) ctid
  FROM anthropometry_kerr_results
  ORDER BY measurement_id, created_at DESC NULLS LAST
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'anthropometry_kerr_results_measurement_id_key'
  ) THEN
    ALTER TABLE anthropometry_kerr_results
      ADD CONSTRAINT anthropometry_kerr_results_measurement_id_key UNIQUE (measurement_id);
  END IF;
END $$;
