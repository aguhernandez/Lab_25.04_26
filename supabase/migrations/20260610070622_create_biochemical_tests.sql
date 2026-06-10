-- Biochemical tests table for blood marker analysis
CREATE TABLE biochemical_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- 8 domain markers stored as JSONB for flexibility
  oxygen_transport jsonb DEFAULT '{}',
  recovery jsonb DEFAULT '{}',
  inflammation jsonb DEFAULT '{}',
  hormonal jsonb DEFAULT '{}',
  energy_availability jsonb DEFAULT '{}',
  nutrition jsonb DEFAULT '{}',
  metabolic_health jsonb DEFAULT '{}',
  hydration_renal jsonb DEFAULT '{}',
  
  -- Computed scores (0-100 per domain)
  oxygen_transport_score numeric,
  recovery_score numeric,
  inflammation_score numeric,
  hormonal_score numeric,
  energy_availability_score numeric,
  nutrition_score numeric,
  metabolic_health_score numeric,
  hydration_renal_score numeric,
  global_score numeric,
  
  -- Auto-generated health flags
  health_flags jsonb DEFAULT '[]',
  
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE biochemical_tests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "select_biochemical_tests" ON biochemical_tests FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "insert_biochemical_tests" ON biochemical_tests FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "update_biochemical_tests" ON biochemical_tests FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_biochemical_tests" ON biochemical_tests FOR DELETE
  TO authenticated USING (true);

-- Index for efficient querying
CREATE INDEX idx_biochemical_tests_athlete_id ON biochemical_tests(athlete_id);
CREATE INDEX idx_biochemical_tests_test_date ON biochemical_tests(athlete_id, test_date DESC);