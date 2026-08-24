/*
# Add breath_data JSONB column to test_results

1. Modified Tables
- `test_results`: add `breath_data` jsonb column to store imported breath-by-breath samples (canonical schema).
- `test_results`: add `device_profile_id` uuid column to track which device profile was used for import.
2. Security
- No RLS changes (existing policies cover the new columns).
3. Notes
- `breath_data` stores the array of BreathSample objects after canonical conversion.
- `device_profile_id` references device_profiles(id) but is nullable (manual tests won't have it).
*/

ALTER TABLE test_results ADD COLUMN IF NOT EXISTS breath_data jsonb DEFAULT NULL;
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS device_profile_id uuid DEFAULT NULL REFERENCES device_profiles(id) ON DELETE SET NULL;
