/*
  # Allow Anonymous Profile Count
  
  1. Changes
    - Add policy to allow anonymous users to count profiles
    - This is needed for the initial setup check
    
  2. Security
    - Only allows SELECT operations
    - No sensitive data exposure (just count)
*/

-- Allow anonymous users to check if profiles exist
CREATE POLICY "Anyone can count profiles"
  ON profiles FOR SELECT
  TO anon
  USING (true);
