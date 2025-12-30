-- Phase End Date Migration
-- Adds end_date column to support duration-based phases

-- 1. Add end_date column (nullable initially)
ALTER TABLE phases 
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- 2. Migrate existing data (copy due_date to end_date)
UPDATE phases 
SET end_date = due_date 
WHERE end_date IS NULL;

-- 3. Make end_date NOT NULL
ALTER TABLE phases 
ALTER COLUMN end_date SET NOT NULL;

-- 4. Add indexes
CREATE INDEX IF NOT EXISTS idx_phases_end_date 
ON phases(end_date);

CREATE INDEX IF NOT EXISTS idx_phases_date_range 
ON phases(start_date, end_date);

-- 5. Ensure start_date is also NOT NULL
UPDATE phases 
SET start_date = end_date 
WHERE start_date IS NULL;

ALTER TABLE phases 
ALTER COLUMN start_date SET NOT NULL;