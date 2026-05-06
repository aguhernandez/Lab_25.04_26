/*
  # Fix CHECK constraints for sport and sex columns

  ## Changes
  - athletes.sport: add 'other' to allowed values
  - tests.sport: add 'other' to allowed values
  - athletes.sex: add 'prefer_not_to_say' to allowed values (was missing)

  ## Reason
  Frontend allows selecting 'other' sport and 'prefer_not_to_say' sex,
  but the DB constraints were rejecting these values causing a 400 error.
*/

ALTER TABLE athletes DROP CONSTRAINT IF EXISTS athletes_sport_check;
ALTER TABLE athletes ADD CONSTRAINT athletes_sport_check
  CHECK (sport = ANY (ARRAY['cycling', 'running', 'triathlon', 'swimming', 'other']));

ALTER TABLE tests DROP CONSTRAINT IF EXISTS tests_sport_check;
ALTER TABLE tests ADD CONSTRAINT tests_sport_check
  CHECK (sport = ANY (ARRAY['cycling', 'running', 'triathlon', 'swimming', 'other']));

ALTER TABLE athletes DROP CONSTRAINT IF EXISTS athletes_sex_check;
ALTER TABLE athletes ADD CONSTRAINT athletes_sex_check
  CHECK (sex = ANY (ARRAY['male', 'female', 'other', 'prefer_not_to_say']));
