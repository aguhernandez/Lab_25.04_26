ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS protocol_id text,
  ADD COLUMN IF NOT EXISTS protocol_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS protocol_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tests.protocol_id IS
  'Stable identifier for the protocol used (e.g. incremental_lactate, mlss_constant, critical_power).';
COMMENT ON COLUMN public.tests.protocol_version IS
  'Version of the protocol rules used when this test was recorded.';
COMMENT ON COLUMN public.tests.protocol_metadata IS
  'Protocol settings, environmental context, validation findings, and timeline import provenance for this test.';

ALTER TABLE public.test_results
  ADD COLUMN IF NOT EXISTS import_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.test_results.import_metadata IS
  'Source, device, sample frequency, units, calibration, column mapping, and transformations for imported metabolic data.';
