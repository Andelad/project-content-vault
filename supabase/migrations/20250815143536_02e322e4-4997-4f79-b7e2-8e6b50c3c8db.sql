-- Add calendar integration fields to calendar_events table
ALTER TABLE public.calendar_events 
ADD COLUMN external_calendar_id TEXT,
ADD COLUMN external_source TEXT CHECK (external_source IN ('ical', 'google', 'outlook')),
ADD COLUMN external_last_modified TIMESTAMP WITH TIME ZONE,
ADD COLUMN external_url TEXT,
ADD COLUMN is_external_event BOOLEAN DEFAULT FALSE;

-- Create calendar_connections table for storing user's calendar integration settings
CREATE TABLE public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('google', 'outlook')),
  connection_name TEXT NOT NULL,
  external_calendar_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_frequency INTEGER DEFAULT 60, -- minutes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on calendar_connections
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for calendar_connections
CREATE POLICY "Users can view their own calendar connections" 
ON public.calendar_connections 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar connections" 
ON public.calendar_connections 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar connections" 
ON public.calendar_connections 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar connections" 
ON public.calendar_connections 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create calendar_import_history table for tracking imports
CREATE TABLE public.calendar_import_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  import_source TEXT NOT NULL CHECK (import_source IN ('ical_file', 'google', 'outlook')),
  import_type TEXT NOT NULL CHECK (import_type IN ('manual', 'scheduled')),
  file_name TEXT, -- for ical file imports
  connection_id UUID REFERENCES public.calendar_connections(id),
  events_imported INTEGER DEFAULT 0,
  events_updated INTEGER DEFAULT 0,
  events_failed INTEGER DEFAULT 0,
  import_status TEXT DEFAULT 'completed' CHECK (import_status IN ('in_progress', 'completed', 'failed')),
  error_message TEXT,
  import_date_range_start DATE,
  import_date_range_end DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on calendar_import_history
ALTER TABLE public.calendar_import_history ENABLE ROW LEVEL SECURITY;

-- Create policies for calendar_import_history
CREATE POLICY "Users can view their own import history" 
ON public.calendar_import_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own import history" 
ON public.calendar_import_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at on calendar_connections
CREATE TRIGGER update_calendar_connections_updated_at
BEFORE UPDATE ON public.calendar_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better performance
CREATE INDEX idx_calendar_events_external_id ON public.calendar_events(external_calendar_id, external_source);
CREATE INDEX idx_calendar_connections_user_id ON public.calendar_connections(user_id);
CREATE INDEX idx_calendar_import_history_user_id ON public.calendar_import_history(user_id);