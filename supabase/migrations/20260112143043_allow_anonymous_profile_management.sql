/*
  # Allow anonymous profile management for local development

  1. Changes
    - Add policy to allow anonymous users to create profiles
    - Add policy to allow anonymous users to update profiles
    - Add policy to allow anonymous users to delete profiles
  
  2. Security
    - These policies enable local development mode
    - In production, these should be disabled or restricted
    - Profiles table still has RLS enabled
*/

-- Allow anonymous users to insert profiles (for local development)
CREATE POLICY "Anonymous can create profiles"
  ON profiles FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anonymous users to update profiles (for local development)
CREATE POLICY "Anonymous can update profiles"
  ON profiles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous users to delete profiles (for local development)
CREATE POLICY "Anonymous can delete profiles"
  ON profiles FOR DELETE
  TO anon
  USING (true);
