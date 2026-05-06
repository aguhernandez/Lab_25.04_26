/*
  # Add Simulation History Table

  1. New Tables
    - `simulation_history`
      - `id` (uuid, primary key)
      - `athlete_id` (uuid, nullable FK to athletes)
      - `simulation_type` (text: 'race' | 'altitude')
      - `label` (text - user-defined or auto-generated name)
      - `input_params` (jsonb - scenario/profile inputs)
      - `result_summary` (jsonb - key result metrics for quick display)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Allow anonymous read/insert/delete (consistent with rest of app)
*/

CREATE TABLE IF NOT EXISTS simulation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid REFERENCES athletes(id) ON DELETE SET NULL,
  simulation_type text NOT NULL CHECK (simulation_type IN ('race', 'altitude')),
  label text NOT NULL DEFAULT '',
  input_params jsonb NOT NULL DEFAULT '{}',
  result_summary jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE simulation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select on simulation_history"
  ON simulation_history FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anonymous insert on simulation_history"
  ON simulation_history FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on simulation_history"
  ON simulation_history FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS simulation_history_athlete_id_idx ON simulation_history(athlete_id);
CREATE INDEX IF NOT EXISTS simulation_history_created_at_idx ON simulation_history(created_at DESC);
