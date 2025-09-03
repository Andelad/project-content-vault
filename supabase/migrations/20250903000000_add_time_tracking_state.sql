-- Add time tracking state to settings table for cross-window synchronization
-- This allows tracking state to persist across browser windows and login sessions

ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS time_tracking_state JSONB DEFAULT NULL;

-- Add a comment explaining the structure
COMMENT ON COLUMN public.settings.time_tracking_state IS 
'Time tracking state for cross-window sync. Structure: {
  "isTracking": boolean,
  "startTime": ISO timestamp,
  "eventId": string,
  "selectedProject": object,
  "searchQuery": string,
  "affectedEvents": string[]
}';

-- Create an index for faster queries on time tracking state
CREATE INDEX IF NOT EXISTS idx_settings_time_tracking 
ON public.settings USING GIN (time_tracking_state);
