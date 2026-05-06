/*
  # Add Test Context Data Fields

  ## Summary
  Adds contextual information fields to the `tests` table to capture environmental
  and logistical data at the time of each test.

  ## New Columns on `tests` table:
  - `test_time` (time): Hour/minute when the test was performed
  - `city` (text): City where the test was conducted
  - `elevation_m` (integer): Meters above sea level (auto-fetched from city/location)
  - `outdoor_weather` (jsonb): JSON blob with outdoor meteorological data (temp, humidity, wind, pressure, conditions)
  - `indoor_temp_c` (numeric): Indoor lab temperature in Celsius
  - `indoor_humidity_percent` (numeric): Indoor lab humidity percentage
  - `indoor_conditions_notes` (text): Free-text notes about indoor lab conditions

  ## Notes
  - All new columns are nullable to maintain backwards compatibility with existing records
  - `outdoor_weather` stored as JSONB for flexibility (different weather APIs return different fields)
  - No RLS changes needed — inherits existing `tests` table policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'test_time'
  ) THEN
    ALTER TABLE tests ADD COLUMN test_time time;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'city'
  ) THEN
    ALTER TABLE tests ADD COLUMN city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'elevation_m'
  ) THEN
    ALTER TABLE tests ADD COLUMN elevation_m integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'outdoor_weather'
  ) THEN
    ALTER TABLE tests ADD COLUMN outdoor_weather jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'indoor_temp_c'
  ) THEN
    ALTER TABLE tests ADD COLUMN indoor_temp_c numeric(5,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'indoor_humidity_percent'
  ) THEN
    ALTER TABLE tests ADD COLUMN indoor_humidity_percent numeric(5,1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tests' AND column_name = 'indoor_conditions_notes'
  ) THEN
    ALTER TABLE tests ADD COLUMN indoor_conditions_notes text;
  END IF;
END $$;
