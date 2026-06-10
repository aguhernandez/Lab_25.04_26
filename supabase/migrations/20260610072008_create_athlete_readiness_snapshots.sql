-- Stores computed readiness snapshots for trend analysis
CREATE TABLE athlete_readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  computed_at timestamptz NOT NULL DEFAULT now(),
  
  aerobic_score numeric,
  neuromuscular_score numeric,
  biological_health_score numeric,
  hydration_stress_score numeric,
  global_readiness numeric,
  
  limiting_factor text,
  health_flags jsonb DEFAULT '[]',
  
  -- Raw input snapshot for auditability
  inputs_snapshot jsonb DEFAULT '{}',
  
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE athlete_readiness_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_readiness_snapshots" ON athlete_readiness_snapshots FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_readiness_snapshots" ON athlete_readiness_snapshots FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_readiness_snapshots" ON athlete_readiness_snapshots FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_readiness_snapshots" ON athlete_readiness_snapshots FOR DELETE
  TO authenticated USING (true);

CREATE INDEX idx_readiness_athlete_date ON athlete_readiness_snapshots(athlete_id, computed_at DESC);