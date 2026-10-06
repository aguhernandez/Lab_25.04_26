-- Store the full calculated PhysiologyResults + AdvancedMetrics as a snapshot
-- so saved test evaluations are never automatically recalculated on reload.
ALTER TABLE public.test_results
  ADD COLUMN IF NOT EXISTS results_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS saved_at timestamptz;