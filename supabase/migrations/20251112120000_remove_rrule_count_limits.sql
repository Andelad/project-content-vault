-- Remove COUNT limits from RRULE strings to make events truly recurring
-- This converts "FREQ=DAILY;INTERVAL=1;COUNT=52" to "FREQ=DAILY;INTERVAL=1"

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
