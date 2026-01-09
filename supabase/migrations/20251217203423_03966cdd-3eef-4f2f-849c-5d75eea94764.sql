-- ============================================================================
-- HISTORICAL NOTE: This migration modified the "milestones" table
-- The table was later renamed to "phases" on 2025-12-29 (migration 20251229164244)
-- ============================================================================

-- Relax constraint to allow zero hours
ALTER TABLE public.milestones
  DROP CONSTRAINT IF EXISTS milestones_time_allocation_hours_check;

ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_time_allocation_hours_check
  CHECK (time_allocation_hours >= 0);