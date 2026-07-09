-- Ensure anon has explicit table-level grants on profiles
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

-- Ensure anon can access athletes
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.athletes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.athletes TO authenticated;

-- RPC: get all athletes for a coach identified by their Hub user id
-- SECURITY DEFINER bypasses RLS so it works even with the anon key
CREATE OR REPLACE FUNCTION public.get_athletes_by_coach_hub_id(coach_hub_id TEXT)
RETURNS SETOF public.athletes
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT a.* FROM public.athletes a
  JOIN public.profiles p ON p.id = a.coach_id
  WHERE p.hub_user_id = coach_hub_id
  ORDER BY a.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_athletes_by_coach_hub_id TO anon, authenticated;

-- RPC: get athlete IDs for a coach (for evaluations query)
CREATE OR REPLACE FUNCTION public.get_athlete_ids_by_coach_hub_id(coach_hub_id TEXT)
RETURNS TABLE(id UUID)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT a.id FROM public.athletes a
  JOIN public.profiles p ON p.id = a.coach_id
  WHERE p.hub_user_id = coach_hub_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_athlete_ids_by_coach_hub_id TO anon, authenticated;

-- RPC: get profile by hub_user_id (bypass anon restriction on profiles)
CREATE OR REPLACE FUNCTION public.get_profile_by_hub_id(hub_id TEXT)
RETURNS SETOF public.profiles
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM public.profiles WHERE hub_user_id = hub_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_by_hub_id TO anon, authenticated;
