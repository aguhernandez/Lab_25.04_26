-- RPC: get all tests for athletes belonging to a coach (by coach hub_user_id)
CREATE OR REPLACE FUNCTION public.get_tests_by_coach_hub_id(coach_hub_id TEXT)
RETURNS TABLE(
  id UUID,
  athlete_id UUID,
  test_date DATE,
  test_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  athlete_name TEXT,
  athlete_sport TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    t.id,
    t.athlete_id,
    t.test_date,
    t.test_type,
    t.status,
    t.created_at,
    a.name AS athlete_name,
    a.sport AS athlete_sport
  FROM public.tests t
  JOIN public.athletes a ON a.id = t.athlete_id
  JOIN public.profiles p ON p.id = a.coach_id
  WHERE p.hub_user_id = coach_hub_id
  ORDER BY t.test_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_tests_by_coach_hub_id TO anon, authenticated;