-- Phase End Date Column Fix
-- Corrects the previous migration by renaming due_date to end_date
-- instead of adding a new column

-- 1. Drop the incorrectly added end_date column
ALTER TABLE phases 
DROP COLUMN IF EXISTS end_date;

-- 2. Rename due_date to end_date
ALTER TABLE phases 
RENAME COLUMN due_date TO end_date;

-- 3. Update any indexes that referenced due_date
DROP INDEX IF EXISTS idx_phases_end_date;

-- Create index on the renamed column
CREATE INDEX idx_phases_end_date 
ON phases(end_date);

-- 4. Ensure the date range index is correct
DROP INDEX IF EXISTS idx_phases_date_range;

CREATE INDEX idx_phases_date_range 
ON phases(start_date, end_date);