-- Add recurring_group_id to calendar_events table to link related recurring events
ALTER TABLE public.calendar_events 
ADD COLUMN recurring_group_id UUID;

-- Create index for better query performance on recurring groups
CREATE INDEX idx_calendar_events_recurring_group ON public.calendar_events(recurring_group_id) WHERE recurring_group_id IS NOT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.calendar_events.recurring_group_id IS 'Links related recurring events together for batch operations';
