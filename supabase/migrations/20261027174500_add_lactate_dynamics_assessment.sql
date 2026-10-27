ALTER TABLE IF EXISTS public.test_results
  ADD COLUMN IF NOT EXISTS lactate_dynamics_assessment jsonb DEFAULT NULL;

COMMENT ON COLUMN public.test_results.lactate_dynamics_assessment IS
  'Constant-load MLSS confirmation trials and saved dynamic lactate model settings.';
