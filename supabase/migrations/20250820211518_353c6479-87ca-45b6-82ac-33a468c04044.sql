-- Update the milestones table to use hours instead of percentages
ALTER TABLE public.milestones 
DROP CONSTRAINT IF EXISTS milestones_time_allocation_check;

-- Update the column comment and remove percentage constraint
COMMENT ON COLUMN public.milestones.time_allocation IS 'Allocated hours for this milestone (not percentage)';

-- Optional: Add a reasonable upper limit for hours (e.g., 10,000 hours)
ALTER TABLE public.milestones 
ADD CONSTRAINT milestones_time_allocation_hours_check 
CHECK (time_allocation >= 0 AND time_allocation <= 10000);