/*
# Create device_profiles table for breath-by-breath import

1. New Tables
- `device_profiles`: stores device-specific column mappings for importing raw breath data files (e.g., VO2 Master DataAverage.xlsx).
  - `id` (uuid, primary key)
  - `name` (text, device name, e.g. "VO2 Master")
  - `column_mapping` (jsonb, maps file column names to canonical schema field names)
  - `created_at` (timestamptz)
2. Security
- Enable RLS on `device_profiles`.
- Allow anon + authenticated CRUD because the app uses anon-key access (no sign-in required for lab operations).
3. Notes
- The canonical schema fields are defined in the frontend types (BreathSample interface).
- The VO2 Master default profile is seeded as the first row.
*/

CREATE TABLE IF NOT EXISTS device_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  column_mapping jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE device_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_device_profiles" ON device_profiles;
CREATE POLICY "anon_select_device_profiles" ON device_profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_device_profiles" ON device_profiles;
CREATE POLICY "anon_insert_device_profiles" ON device_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_device_profiles" ON device_profiles;
CREATE POLICY "anon_update_device_profiles" ON device_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_device_profiles" ON device_profiles;
CREATE POLICY "anon_delete_device_profiles" ON device_profiles FOR DELETE
  TO anon, authenticated USING (true);

INSERT INTO device_profiles (name, column_mapping)
SELECT 'VO2 Master', '{
  "Time[s]": "time_s",
  "HR[bpm]": "hr_bpm",
  "Rf[bpm]": "rf_bpm",
  "Tv[L]": "tv_l",
  "Ve[L/min]": "ve_lmin",
  "EqO2": "eqo2",
  "FeO2[%]": "feo2_pct",
  "VO2[mL/kg/min]": "vo2_rel_mlkgmin",
  "VO2[mL/min]": "vo2_abs_mlmin",
  "HRV": "hrv_ms",
  "RR[ms]": "rr_ms",
  "Target Sp": "speed_kmh"
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM device_profiles WHERE name = 'VO2 Master');
