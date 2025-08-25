-- Add recurring_group_id column to calendar_events table
ALTER TABLE public.calendar_events 
ADD COLUMN recurring_group_id UUID;

-- Add index for performance on recurring_group_id
CREATE INDEX idx_calendar_events_recurring_group ON public.calendar_events(recurring_group_id) 
WHERE recurring_group_id IS NOT NULL;