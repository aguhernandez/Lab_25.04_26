/*
  # Add lab_settings table for Hub integration

  1. New Table
    - `lab_settings`
      - `id` (int, primary key, single-row pattern)
      - `planner_token` (text, nullable) — X-Planner-Token issued by Hub admin
      - `planner_name` (text, nullable) — display name of this lab as configured in Hub
      - `last_push_at` (timestamptz, nullable) — timestamp of last successful push to Hub
      - `last_push_athlete_id` (uuid, nullable) — athlete pushed last
      - `created_at`, `updated_at`

  2. Security
    - Enable RLS
    - Only authenticated users can read/write (lab staff only)

  3. Notes
    - Single-row table: always upsert on id = 1
    - Token is stored server-side only, never exposed to frontend directly
*/

CREATE TABLE IF NOT EXISTS lab_settings (
  id integer PRIMARY KEY DEFAULT 1,
  planner_token text,
  planner_name text DEFAULT 'Lab Asciende',
  last_push_at timestamptz,
  last_push_athlete_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO lab_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE lab_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read lab settings"
  ON lab_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update lab settings"
  ON lab_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
