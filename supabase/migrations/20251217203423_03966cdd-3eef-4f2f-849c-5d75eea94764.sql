-- Relax constraint to allow zero hours
ALTER TABLE public.milestones
  DROP CONSTRAINT IF EXISTS milestones_time_allocation_hours_check;

ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_time_allocation_hours_check
  CHECK (time_allocation_hours >= 0);