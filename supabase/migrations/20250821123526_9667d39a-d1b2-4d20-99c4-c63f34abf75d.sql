-- Add type column to calendar_events table to distinguish between planned, tracked, and completed events
ALTER TABLE calendar_events 
ADD COLUMN event_type VARCHAR(20) DEFAULT 'planned' CHECK (event_type IN ('planned', 'tracked', 'completed'));

-- Update existing events to be marked as planned
UPDATE calendar_events SET event_type = 'planned' WHERE event_type IS NULL;

-- Add index for better query performance
CREATE INDEX idx_calendar_events_type ON calendar_events(event_type);