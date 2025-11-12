-- Additional Cleanup for Legacy Recurring Events
-- The previous migration only deleted events with recurring_group_id
-- But some old recurring instances may not have that field populated
-- This migration handles those cases

-- Strategy: Delete events that are clearly from the old recurring system
-- These are events with recurring_type but NO rrule (not migrated parents)

-- First, let's see what we're dealing with
DO $$
DECLARE
  count_recurring_type INTEGER;
  count_recurring_group INTEGER;
  count_total INTEGER;
BEGIN
  -- Count events with recurring_type but no RRULE (old system events)
  SELECT COUNT(*) INTO count_recurring_type
  FROM public.calendar_events
  WHERE recurring_type IS NOT NULL 
    AND rrule IS NULL;
  
  -- Count events with recurring_group_id but no RRULE (old instances)
  SELECT COUNT(*) INTO count_recurring_group
  FROM public.calendar_events
  WHERE recurring_group_id IS NOT NULL 
    AND rrule IS NULL;
    
  -- Total events
  SELECT COUNT(*) INTO count_total
  FROM public.calendar_events;
  
  RAISE NOTICE '=== Legacy Recurring Events Audit ===';
  RAISE NOTICE 'Total events in database: %', count_total;
  RAISE NOTICE 'Events with recurring_type but no rrule: %', count_recurring_type;
  RAISE NOTICE 'Events with recurring_group_id but no rrule: %', count_recurring_group;
  
  IF count_recurring_type > 0 THEN
    RAISE NOTICE 'Will delete % events with recurring_type but no rrule', count_recurring_type;
  ELSE
    RAISE NOTICE 'No events with recurring_type to clean up';
  END IF;
END $$;

-- Delete events that have recurring_type but NO rrule
-- These are from the old system and should be replaced by RRULE expansion
DELETE FROM public.calendar_events
WHERE recurring_type IS NOT NULL 
  AND rrule IS NULL;

-- Final report
DO $$
DECLARE
  remaining_events INTEGER;
  rrule_events INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_events FROM public.calendar_events;
  SELECT COUNT(*) INTO rrule_events FROM public.calendar_events WHERE rrule IS NOT NULL;
  
  RAISE NOTICE '=== Cleanup Complete ===';
  RAISE NOTICE 'Remaining events: %', remaining_events;
  RAISE NOTICE 'Events with RRULE: %', rrule_events;
  RAISE NOTICE 'These RRULE events will be expanded by FullCalendar';
END $$;