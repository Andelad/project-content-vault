-- Cleanup Legacy Recurring Event Instances
-- This removes old pre-generated instances that are no longer needed
-- Events with recurring_group_id but no RRULE are legacy child instances

DELETE FROM public.calendar_events
WHERE recurring_group_id IS NOT NULL 
  AND rrule IS NULL;