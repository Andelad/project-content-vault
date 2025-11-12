-- Remove COUNT limits from RRULE strings to make events truly recurring
UPDATE public.calendar_events
SET rrule = REGEXP_REPLACE(rrule, ';COUNT=\d+', '', 'g')
WHERE rrule IS NOT NULL AND rrule LIKE '%COUNT=%';

-- Verify the update
DO $$
DECLARE
  updated_count INTEGER;
  rrule_events_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rrule_events_count 
  FROM public.calendar_events 
  WHERE rrule IS NOT NULL;
  
  SELECT COUNT(*) INTO updated_count
  FROM public.calendar_events
  WHERE rrule IS NOT NULL AND rrule NOT LIKE '%COUNT=%';
  
  RAISE NOTICE '=== RRULE Count Limits Removed ===';
  RAISE NOTICE 'Total RRULE events: %', rrule_events_count;
  RAISE NOTICE 'Events now recurring infinitely: %', updated_count;
  RAISE NOTICE 'These events will now recur indefinitely until UNTIL date or user-specified COUNT';
END $$;