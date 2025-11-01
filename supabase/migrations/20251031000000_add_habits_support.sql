-- Add support for event categories in calendar_events table
-- Categories allow different types of events: 'event' (default), 'habit', 'task', and potential future types

ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'event' CHECK (category IN ('event', 'habit', 'task'));

-- Create index for efficient category queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON public.calendar_events(category) WHERE category != 'event';

COMMENT ON COLUMN public.calendar_events.category IS 'Event category: event (default), habit (separate layer, no project), task (no duration, checkbox display), or future types';
