-- =====================================================================================
-- MILESTONE TABLE MIGRATION - Option A (time_allocation = hours)
-- Date: 2025-10-18
-- Records: 2,364 milestones
-- =====================================================================================

-- Step 0: Drop conflicting constraint from previous attempt
ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS milestones_time_allocation_hours_check;

-- Step 1: Create backup table
CREATE TABLE milestones_backup_20251018 AS SELECT * FROM public.milestones;

-- Step 2: Add new columns
ALTER TABLE public.milestones
  ADD COLUMN time_allocation_hours NUMERIC,
  ADD COLUMN start_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN recurring_config JSONB;

-- Step 3: Migrate data (Option A - time_allocation represents hours, no conversion needed)
UPDATE public.milestones
SET 
  time_allocation_hours = time_allocation,
  start_date = due_date - INTERVAL '7 days',
  is_recurring = false;

-- Step 4: Add constraints
ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_time_allocation_hours_check CHECK (time_allocation_hours > 0);

-- Step 5: Create index for recurring queries
CREATE INDEX idx_milestones_is_recurring ON public.milestones(is_recurring);

-- Step 6: Document deprecation of old column (DO NOT DROP)
COMMENT ON COLUMN public.milestones.time_allocation IS 'DEPRECATED: Use time_allocation_hours instead. Kept for backward compatibility during migration period.';