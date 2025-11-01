-- Add is_compact_view column to settings table
ALTER TABLE public.settings
ADD COLUMN is_compact_view BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.settings.is_compact_view IS 'User preferred compact view mode for planner (reduces vertical spacing by 50%).';
