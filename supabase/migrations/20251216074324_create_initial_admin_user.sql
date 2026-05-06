/*
  # Create Initial Admin User Setup Function

  1. New Function
    - `create_initial_admin_if_none_exists` - Creates first admin user if no users exist
  
  2. Purpose
    - Allows system initialization with first admin user
    - Only works if system is empty (no users exist)
    
  3. Security
    - Can only be called if profiles table is empty
    - Creates user with admin role
*/

-- Function to create initial admin user
CREATE OR REPLACE FUNCTION create_initial_admin_if_none_exists(
  p_email text,
  p_password text,
  p_full_name text DEFAULT 'Admin User'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_count integer;
  v_user_id uuid;
  v_result json;
BEGIN
  -- Check if any users exist
  SELECT COUNT(*) INTO v_user_count FROM auth.users;
  
  IF v_user_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Users already exist in the system'
    );
  END IF;
  
  -- Create the user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_sent_at
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    now(),
    now(),
    '{}',
    json_build_object('full_name', p_full_name),
    false,
    now()
  )
  RETURNING id INTO v_user_id;
  
  -- Create profile with admin role
  INSERT INTO profiles (user_id, role, full_name)
  VALUES (v_user_id, 'admin', p_full_name);
  
  RETURN json_build_object(
    'success', true,
    'message', 'Initial admin user created successfully',
    'user_id', v_user_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error creating user: ' || SQLERRM
    );
END;
$$;
