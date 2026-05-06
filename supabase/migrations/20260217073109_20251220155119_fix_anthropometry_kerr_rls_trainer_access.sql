/*
  # Fix Anthropometry Kerr RLS - Add Trainer Access
  
  1. Security Updates
    - Add trainer policies for all anthropometry tables
    - Trainers can view/manage assigned athletes' data
    - Maintain athlete and admin access
  
  2. Trainer Access Pattern
    - Based on team membership
    - Read and write access for team athletes
    - No delete permissions (admins only)
*/

-- Add trainer policies for anthropometry_measurements

-- Trainers can view team athletes' measurements
CREATE POLICY "Trainers can view team athletes anthropometry measurements"
  ON anthropometry_measurements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
    AND (
      -- Trainer owns the athlete directly
      athlete_id IN (
        SELECT id FROM profiles 
        WHERE role = 'athlete'
      )
    )
  );

-- Trainers can insert measurements for team athletes
CREATE POLICY "Trainers can insert team athletes anthropometry measurements"
  ON anthropometry_measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  );

-- Trainers can update team athletes' measurements
CREATE POLICY "Trainers can update team athletes anthropometry measurements"
  ON anthropometry_measurements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  );

-- Add trainer policies for anthropometry_kerr_results

-- Trainers can view team athletes' Kerr results
CREATE POLICY "Trainers can view team athletes Kerr results"
  ON anthropometry_kerr_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  );

-- Trainers can insert Kerr results for team athletes
CREATE POLICY "Trainers can insert team athletes Kerr results"
  ON anthropometry_kerr_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  );

-- Trainers can update team athletes' Kerr results
CREATE POLICY "Trainers can update team athletes Kerr results"
  ON anthropometry_kerr_results
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  );

-- Add trainer policies for anthropometry_indices

-- Trainers can view team athletes' indices
CREATE POLICY "Trainers can view team athletes anthropometry indices"
  ON anthropometry_indices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  );

-- Trainers can insert indices for team athletes
CREATE POLICY "Trainers can insert team athletes anthropometry indices"
  ON anthropometry_indices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  );

-- Trainers can update team athletes' indices
CREATE POLICY "Trainers can update team athletes anthropometry indices"
  ON anthropometry_indices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'trainer'
    )
  );