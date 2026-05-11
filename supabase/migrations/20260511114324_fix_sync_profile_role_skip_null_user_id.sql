/*
  # Fix sync_profile_role_to_user_roles trigger for hub-auth profiles

  Hub-authenticated profiles have user_id = NULL (they use hub_user_id instead).
  The trigger was unconditionally inserting into user_roles with a null user_id,
  violating the NOT NULL constraint and blocking new hub-user profile creation.

  Fix: skip the user_roles sync when user_id is NULL.
*/

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip sync for hub-auth profiles that have no local user_id
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO user_roles (user_id, role, created_at, updated_at)
  VALUES (NEW.user_id, NEW.role, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = NEW.role,
    updated_at = now();

  RETURN NEW;
END;
$$;
