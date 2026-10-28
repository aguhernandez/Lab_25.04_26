ALTER TABLE IF EXISTS public.test_results
  ADD COLUMN IF NOT EXISTS vlamax_assessment jsonb DEFAULT NULL;

COMMENT ON COLUMN public.test_results.vlamax_assessment IS
  'Versioned VLamax sprint protocol input and calculated result. Stores classical blood accumulation rate, assumptions, uncertainty, and quality issues.';
