/*
# Create unified test timeline samples

1. New Table
- `test_timeline_samples`: stores every manual or imported observation on one timestamp axis.
- `test_id`: test that owns the observation.
- `timestamp_s`: seconds from the test start, including manual lactate timing offsets.
- `speed_pace`, `heart_rate`, `lactate`, `rpe`, `vo2_ml_kg_min`: primary analysis fields.
- `raw_data`: device-independent raw columns retained from imported files.
- `source`: manual or imported.
- `edited_fields`: fields manually changed after import for traceability.
2. Security
- Enable RLS and allow anon + authenticated CRUD for this single-tenant application.
3. Compatibility
- Existing `test_data_points` remains available for legacy calculations while the timeline becomes the source of capture.
*/

CREATE TABLE IF NOT EXISTS test_timeline_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  timestamp_s numeric NOT NULL,
  speed_pace text,
  heart_rate numeric,
  lactate numeric,
  rpe numeric,
  vo2_ml_kg_min numeric,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'imported')),
  edited_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS test_timeline_samples_test_time_idx
  ON test_timeline_samples (test_id, timestamp_s);

ALTER TABLE test_timeline_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_test_timeline_samples" ON test_timeline_samples;
CREATE POLICY "anon_select_test_timeline_samples" ON test_timeline_samples FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_test_timeline_samples" ON test_timeline_samples;
CREATE POLICY "anon_insert_test_timeline_samples" ON test_timeline_samples FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_test_timeline_samples" ON test_timeline_samples;
CREATE POLICY "anon_update_test_timeline_samples" ON test_timeline_samples FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_test_timeline_samples" ON test_timeline_samples;
CREATE POLICY "anon_delete_test_timeline_samples" ON test_timeline_samples FOR DELETE
  TO anon, authenticated USING (true);
