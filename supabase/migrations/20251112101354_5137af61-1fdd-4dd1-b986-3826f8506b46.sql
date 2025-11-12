-- Add RRULE column to calendar_events table
ALTER TABLE public.calendar_events
ADD COLUMN rrule TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.calendar_events.rrule IS 'RFC 5545 RRULE string for recurring events (e.g., "FREQ=WEEKLY;INTERVAL=1")';

-- Create index for performance
CREATE INDEX idx_calendar_events_rrule ON public.calendar_events(rrule) WHERE rrule IS NOT NULL;

-- Create exceptions table for handling edited/deleted instances
CREATE TABLE public.calendar_event_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('deleted', 'modified')),
  modified_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(master_event_id, exception_date)
);

-- Enable RLS
ALTER TABLE public.calendar_event_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own exceptions" ON public.calendar_event_exceptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exceptions" ON public.calendar_event_exceptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exceptions" ON public.calendar_event_exceptions
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exceptions" ON public.calendar_event_exceptions
FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_exceptions_master_date ON public.calendar_event_exceptions(master_event_id, exception_date);
CREATE INDEX idx_exceptions_user ON public.calendar_event_exceptions(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_calendar_event_exceptions_updated_at
BEFORE UPDATE ON public.calendar_event_exceptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing recurring events to RRULE format
-- Convert simple recurring patterns to RRULE
UPDATE public.calendar_events
SET rrule = CASE
  WHEN recurring_type = 'daily' THEN 'FREQ=DAILY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'weekly' THEN 'FREQ=WEEKLY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'monthly' THEN 'FREQ=MONTHLY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'yearly' THEN 'FREQ=YEARLY;INTERVAL=' || COALESCE(recurring_interval, 1)
  ELSE NULL
END
WHERE recurring_type IS NOT NULL AND rrule IS NULL;

-- Add UNTIL clause for events with end dates
UPDATE public.calendar_events
SET rrule = rrule || ';UNTIL=' || TO_CHAR(recurring_end_date, 'YYYYMMDD') || 'T235959Z'
WHERE recurring_end_date IS NOT NULL AND rrule IS NOT NULL AND rrule NOT LIKE '%UNTIL=%';

-- Add COUNT clause for events with specific counts
UPDATE public.calendar_events
SET rrule = rrule || ';COUNT=' || recurring_count
WHERE recurring_count IS NOT NULL AND rrule IS NOT NULL AND rrule NOT LIKE '%COUNT=%';