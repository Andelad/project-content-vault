-- Add work_hour_exceptions table for storing individual day overrides
-- Similar to calendar_event_exceptions but for work hours

-- Create exceptions table for handling individual day work hour modifications
CREATE TABLE IF NOT EXISTS public.work_hour_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  slot_id TEXT NOT NULL, -- References the WorkSlot id from settings
  exception_type TEXT NOT NULL CHECK (exception_type IN ('deleted', 'modified')),
  modified_start_time TEXT, -- HH:MM format if modified
  modified_end_time TEXT,   -- HH:MM format if modified
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Ensure one exception per user per date per slot
  UNIQUE(user_id, exception_date, slot_id)
);

-- Add comment explaining the table
COMMENT ON TABLE public.work_hour_exceptions IS 'Stores exceptions to the weekly work hour pattern defined in settings.weekly_work_hours';
COMMENT ON COLUMN public.work_hour_exceptions.exception_date IS 'The specific date this exception applies to';
COMMENT ON COLUMN public.work_hour_exceptions.slot_id IS 'The WorkSlot ID from settings.weekly_work_hours that this exception relates to';
COMMENT ON COLUMN public.work_hour_exceptions.exception_type IS 'deleted: work hour removed for this day; modified: work hour times changed for this day';
COMMENT ON COLUMN public.work_hour_exceptions.modified_start_time IS 'If modified, the new start time in HH:MM format';
COMMENT ON COLUMN public.work_hour_exceptions.modified_end_time IS 'If modified, the new end time in HH:MM format';

-- Enable RLS
ALTER TABLE public.work_hour_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only see/modify their own exceptions
CREATE POLICY "Users can view their own work hour exceptions" 
  ON public.work_hour_exceptions
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own work hour exceptions" 
  ON public.work_hour_exceptions
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work hour exceptions" 
  ON public.work_hour_exceptions
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own work hour exceptions" 
  ON public.work_hour_exceptions
  FOR DELETE 
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_work_hour_exceptions_user_date ON public.work_hour_exceptions(user_id, exception_date);
CREATE INDEX idx_work_hour_exceptions_date ON public.work_hour_exceptions(exception_date);

-- Add updated_at trigger
CREATE TRIGGER update_work_hour_exceptions_updated_at
BEFORE UPDATE ON public.work_hour_exceptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();