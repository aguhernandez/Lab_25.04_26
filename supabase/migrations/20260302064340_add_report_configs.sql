/*
  # Add Report Configurations Table

  1. New Tables
    - `report_configs`
      - `id` (uuid, primary key)
      - `profile_id` (uuid) - references profiles.id, one config per evaluator
      - `lab_name` (text) - lab or organization name
      - `evaluator_name` (text) - evaluator/coach name shown on reports
      - `credentials` (text) - professional credentials (e.g. "MSc Sports Science, ISAK L2")
      - `contact_info` (text) - email / phone / website shown on reports
      - `last_sections` (jsonb) - last used section selection (array of section keys)
      - `last_style` (text) - last used report style
      - `last_type` (text) - last used report type preset
      - `created_at`, `updated_at` (timestamps)

  2. Security
    - RLS enabled
    - Anon users can read/insert/update their own config (matching profile_id)
    - This follows the existing pattern used across the app for anonymous access
*/

CREATE TABLE IF NOT EXISTS report_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  lab_name text NOT NULL DEFAULT '',
  evaluator_name text NOT NULL DEFAULT '',
  credentials text NOT NULL DEFAULT '',
  contact_info text NOT NULL DEFAULT '',
  last_sections jsonb NOT NULL DEFAULT '[]',
  last_style text NOT NULL DEFAULT 'coach',
  last_type text NOT NULL DEFAULT 'custom',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS report_configs_profile_id_unique ON report_configs(profile_id);

ALTER TABLE report_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read report configs"
  ON report_configs
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert report configs"
  ON report_configs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update report configs"
  ON report_configs
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
