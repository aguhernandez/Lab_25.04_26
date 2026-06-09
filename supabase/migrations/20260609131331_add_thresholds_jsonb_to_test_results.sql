-- Add unified thresholds JSONB column to test_results
ALTER TABLE test_results ADD COLUMN IF NOT EXISTS thresholds jsonb DEFAULT NULL;