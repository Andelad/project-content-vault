-- Add default_view column to settings table
ALTER TABLE public.settings 
ADD COLUMN default_view text DEFAULT 'timeline' CHECK (default_view IN ('timeline', 'timeline-weeks', 'projects', 'calendar'));

-- Add comment explaining the field
COMMENT ON COLUMN public.settings.default_view IS 'User preferred default view when opening the application. Can be timeline, timeline-weeks, projects, or calendar.';
