# RRULE-Based Recurring Events Implementation

## Overview

This document outlines the implementation of RRULE-based recurring events following Google Calendar's approach. Instead of pre-generating event instances, we store recurrence patterns using RFC 5545 RRULE format and let FullCalendar expand them virtually.

## Database Schema Changes

### 1. Add RRULE Column to calendar_events
```sql
-- Add RRULE column to store recurrence patterns (RFC 5545 format)
ALTER TABLE public.calendar_events
ADD COLUMN rrule TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.calendar_events.rrule IS 'RFC 5545 RRULE string for recurring events (e.g., "FREQ=WEEKLY;INTERVAL=1")';

-- Create index for performance
CREATE INDEX idx_calendar_events_rrule ON public.calendar_events(rrule) WHERE rrule IS NOT NULL;
```

### 2. Create Exceptions Table
```sql
-- Table for handling exceptions (edited/deleted instances)
CREATE TABLE public.calendar_event_exceptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  master_event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  exception_type TEXT NOT NULL CHECK (exception_type IN ('deleted', 'modified')),
  modified_data JSONB, -- Store modified event data for edited instances
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Ensure one exception per master event per date
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

-- Triggers
CREATE TRIGGER update_calendar_event_exceptions_updated_at
BEFORE UPDATE ON public.calendar_event_exceptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Migration Strategy

### Convert Existing Recurring Events to RRULE Format:

```sql
-- Migration script to convert existing recurring events
-- Run this AFTER adding the rrule column

-- Step 1: Convert simple recurring patterns to RRULE
UPDATE public.calendar_events
SET rrule = CASE
  WHEN recurring_type = 'daily' THEN 'FREQ=DAILY;INTERVAL=' || recurring_interval
  WHEN recurring_type = 'weekly' THEN 'FREQ=WEEKLY;INTERVAL=' || recurring_interval
  WHEN recurring_type = 'monthly' THEN 'FREQ=MONTHLY;INTERVAL=' || recurring_interval
  WHEN recurring_type = 'yearly' THEN 'FREQ=YEARLY;INTERVAL=' || recurring_interval
  ELSE NULL
END
WHERE recurring_type IS NOT NULL;

-- Step 2: Add UNTIL clause for events with end dates
UPDATE public.calendar_events
SET rrule = rrule || ';UNTIL=' || TO_CHAR(recurring_end_date, 'YYYYMMDD') || 'T235959Z'
WHERE recurring_end_date IS NOT NULL AND rrule IS NOT NULL;

-- Step 3: Add COUNT clause for events with specific counts
UPDATE public.calendar_events
SET rrule = rrule || ';COUNT=' || recurring_count
WHERE recurring_count IS NOT NULL AND rrule IS NOT NULL;

-- Step 4: Mark the first event in each series as the "master"
-- (Keep only one row per series with the RRULE, delete others)
-- This is complex - may need custom logic based on recurring_group_id

-- Step 5: Clean up old columns (after verifying migration)
-- ALTER TABLE public.calendar_events DROP COLUMN recurring_type;
-- ALTER TABLE public.calendar_events DROP COLUMN recurring_interval;
-- ALTER TABLE public.calendar_events DROP COLUMN recurring_end_date;
-- ALTER TABLE public.calendar_events DROP COLUMN recurring_count;
```

## Implementation Notes

### FullCalendar Integration:
- Install `@fullcalendar/rrule` plugin
- Events with `rrule` will automatically expand in calendar view
- No need to pre-generate instances

### Event Creation:
- Store RRULE in the master event (first occurrence)
- Set `recurring_group_id` to link related operations
- For "never ending": omit UNTIL/COUNT from RRULE

### Event Editing:
- "Edit this event": Create exception in `calendar_event_exceptions`
- "Edit all future": Modify RRULE and create new series from that date
- "Delete this": Add "deleted" exception
- "Delete all future": Add UNTIL to RRULE

### Querying:
- Fetch master events + exceptions
- FullCalendar handles expansion automatically
- For custom queries, use RRULE parsing libraries

### Performance:
- Minimal database rows (1 per series + exceptions)
- FullCalendar handles expansion efficiently
- Scales infinitely without storage concerns

## RRULE Examples

### Daily Events
```
FREQ=DAILY;INTERVAL=1
```

### Weekly Events (every 2 weeks)
```
FREQ=WEEKLY;INTERVAL=2
```

### Monthly Events (specific date)
```
FREQ=MONTHLY;INTERVAL=1
```

### Monthly Events (2nd Tuesday)
```
FREQ=MONTHLY;INTERVAL=1;BYDAY=2TU
```

### Events ending on specific date
```
FREQ=WEEKLY;INTERVAL=1;UNTIL=20251231T235959Z
```

### Events with count limit
```
FREQ=WEEKLY;INTERVAL=1;COUNT=52
```

This implementation follows Google Calendar's approach and leverages FullCalendar's native RRULE support for optimal performance.
