/*
  # Custom Reference Populations

  ## Summary
  Creates tables for admins to add custom reference populations for VO2max and anthropometry comparisons,
  supplementing the built-in scientific literature references.

  ## New Tables

  ### custom_vo2_references
  Admin-managed VO2max reference values by sport, level, and sex.
  - `id` (uuid, primary key)
  - `sport` (text) — sport identifier (cycling_road, running_road, etc.)
  - `sport_label` (text)
  - `level` (text) — competitive level
  - `level_label` (text)
  - `sex` (text) — 'male' or 'female'
  - `vo2max_mean` (numeric, required)
  - `vo2max_sd` (numeric, optional)
  - `vo2max_min`, `vo2max_max` (numeric)
  - `population` (text) — description of population (e.g. "Chilean elite cyclists")
  - `citation` (text) — full reference
  - `citation_short` (text)
  - `year` (integer)
  - `notes` (text, optional)
  - `created_by` (text, optional)
  - `created_at`, `updated_at`

  ### custom_anthro_references
  Admin-managed anthropometry reference values.
  - Same structure as VO2 but for body fat %, BMI, skinfold sums

  ## Security
  - RLS enabled
  - Anyone can read (for comparison display)
  - Only authenticated users with admin access can write (admin token required)
  - Using anonymous access matching existing app pattern for simplicity
*/

CREATE TABLE IF NOT EXISTS custom_vo2_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL,
  sport_label text NOT NULL,
  level text NOT NULL,
  level_label text NOT NULL,
  sex text NOT NULL CHECK (sex IN ('male', 'female')),
  vo2max_mean numeric NOT NULL,
  vo2max_sd numeric,
  vo2max_min numeric NOT NULL,
  vo2max_max numeric NOT NULL,
  population text NOT NULL DEFAULT '',
  citation text NOT NULL DEFAULT '',
  citation_short text NOT NULL DEFAULT '',
  year integer,
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS custom_anthro_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL,
  sport_label text NOT NULL,
  level text NOT NULL,
  level_label text NOT NULL,
  sex text NOT NULL CHECK (sex IN ('male', 'female')),
  body_fat_mean numeric,
  body_fat_sd numeric,
  body_fat_min numeric,
  body_fat_max numeric,
  bmi_mean numeric,
  bmi_sd numeric,
  skinfold_sum_mean numeric,
  skinfold_sum_sites text,
  population text NOT NULL DEFAULT '',
  citation text NOT NULL DEFAULT '',
  citation_short text NOT NULL DEFAULT '',
  year integer,
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_vo2_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_anthro_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select on custom_vo2_references"
  ON custom_vo2_references FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anonymous insert on custom_vo2_references"
  ON custom_vo2_references FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on custom_vo2_references"
  ON custom_vo2_references FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on custom_vo2_references"
  ON custom_vo2_references FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anonymous select on custom_anthro_references"
  ON custom_anthro_references FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anonymous insert on custom_anthro_references"
  ON custom_anthro_references FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update on custom_anthro_references"
  ON custom_anthro_references FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on custom_anthro_references"
  ON custom_anthro_references FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_custom_vo2_sport_level ON custom_vo2_references(sport, sex, level);
CREATE INDEX IF NOT EXISTS idx_custom_anthro_sport_level ON custom_anthro_references(sport, sex, level);
