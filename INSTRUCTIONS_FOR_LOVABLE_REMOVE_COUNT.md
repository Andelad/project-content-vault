# Instructions for Lovable: Remove RRULE COUNT Limits

## Problem
Currently, all recurring events have `COUNT=52` in their RRULE strings, which limits them to only 52 occurrences. This defeats the purpose of the RRULE system - events should recur **infinitely** by default, with the option to add limits through the UI.

## Current State
Events like "wake up", "Breakfast", "Lunch", etc. have RRULE strings like:
```
FREQ=DAILY;INTERVAL=1;COUNT=52
```

## Desired State
Remove the COUNT parameter so they become:
```
FREQ=DAILY;INTERVAL=1
```

This makes them recur infinitely (like Google Calendar), and users can add UNTIL dates or COUNT limits through the UI when needed.

## SQL to Execute in Supabase

Run this SQL query in the Supabase SQL Editor:

```sql
-- Remove COUNT limits from RRULE strings to make events truly recurring
UPDATE public.calendar_events
SET rrule = REGEXP_REPLACE(rrule, ';COUNT=\d+', '', 'g')
WHERE rrule IS NOT NULL AND rrule LIKE '%COUNT=%';

-- Report
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM public.calendar_events 
  WHERE rrule IS NOT NULL;
  
  RAISE NOTICE '=== RRULE Count Limits Removed ===';
  RAISE NOTICE 'Total RRULE events: %', updated_count;
  RAISE NOTICE 'These events will now recur indefinitely';
  RAISE NOTICE 'Use the exceptions table to handle edited/deleted instances';
END $$;
```

## Expected Result
- All 7 recurring events will now recur indefinitely
- FullCalendar will expand them as needed when viewing different date ranges
- No performance issues - FullCalendar only renders instances for the visible date range

## Migration File
A migration file has already been created at:
```
/Users/andrewjohnston/project-content-vault/supabase/migrations/20251112120000_remove_rrule_count_limits.sql
```

Please apply this migration to the Supabase database.

## Context
This is part of the RRULE implementation following Google Calendar's approach:
- Master event in database with RRULE string
- Virtual expansion by FullCalendar when rendering
- Exceptions table for edited/deleted instances
- UI controls for adding UNTIL/COUNT limits when needed
