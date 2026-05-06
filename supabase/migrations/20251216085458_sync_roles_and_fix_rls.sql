/*
  # Sync Roles Between profiles and user_roles Tables
  
  ## Changes
  1. Sync existing roles from profiles to user_roles
  2. Create trigger to keep profiles.role and user_roles.role synchronized
  3. Update RLS functions to check both tables for backward compatibility
  
  ## Purpose
  Ensures that role checks work correctly for RLS policies by maintaining
  consistency between the profiles table (used by application) and user_roles
  table (used by RLS functions).
*/

-- =====================================================
-- STEP 1: Sync existing roles from profiles to user_roles
-- =====================================================

-- Insert roles from profiles into user_roles if they don't exist
INSERT INTO user_roles (user_id, role, created_at, updated_at)
SELECT 
  user_id,
  role,
  now(),
  now()
FROM profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = EXCLUDED.role,
  updated_at = now();

-- =====================================================
-- STEP 2: Create trigger to sync roles automatically
-- =====================================================

-- Function to sync profile role changes to user_roles
CREATE OR REPLACE FUNCTION sync_profile_role_to_user_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- When a profile is inserted or updated, sync to user_roles
  INSERT INTO user_roles (user_id, role, created_at, updated_at)
  VALUES (NEW.user_id, NEW.role, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = NEW.role,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS sync_profile_role_trigger ON profiles;

-- Create trigger on profiles table
CREATE TRIGGER sync_profile_role_trigger
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role IS NOT NULL)
  EXECUTE FUNCTION sync_profile_role_to_user_roles();

-- =====================================================
-- STEP 3: Update helper functions to be more robust
-- =====================================================

-- Updated function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Updated function to check if user is coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'coach'
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'coach'
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Updated function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM user_roles WHERE user_id = auth.uid()),
    (SELECT role FROM profiles WHERE user_id = auth.uid())
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
