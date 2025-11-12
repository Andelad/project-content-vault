# RRULE Fix Instructions for Lovable

## THE PROBLEM (Root Cause Analysis)

The recurring events are showing "infinitely" because:

1. ✅ The initial migration added `rrule` column and populated it for parent events
2. ✅ FullCalendar is correctly expanding RRULE events into instances
3. ❌ **BUT** the old pre-generated child instances from the legacy system are STILL in the database
4. ❌ Result: You see BOTH the RRULE-expanded instances AND the old pre-generated instances

**Example from logs:**
- Parent event: `103d4ecc-0fba-4157-bda7-79eb53fdbd8b` "wake up" with `RRULE=FREQ=DAILY;INTERVAL=1;COUNT=52`
- Old instance 1: `98f98acd-6fc3-403e-baa2-5776cf283fe4` "wake up" Nov 10 (no RRULE)
- Old instance 2: `39767fe9-8941-4da0-8bec-31f52bdcf5da` "wake up" Nov 11 (no RRULE)
- Old instance 3: `ef1291fa-e7c0-48c4-92f7-cb4c62f172a7` "wake up" Nov 12 (no RRULE)

These duplicate instances create the appearance of infinite events.

## THE SOLUTION

**Step 1: Pull the latest changes**
```bash
git pull
```

This includes migration `20251112120000_cleanup_legacy_recurring_instances.sql` which will:
- Delete all events with `recurring_group_id` but NO `rrule` (old child instances)
- Keep only parent events with `rrule` and non-recurring events

**Step 2: Apply the migration to Supabase**

The first cleanup migration (`20251112111617`) may not have caught all legacy instances.
Apply the additional cleanup in Lovable's Supabase SQL Editor:

```sql
-- Additional Cleanup for Legacy Recurring Events
-- Delete events that have recurring_type but NO rrule
-- These are from the old system and should be replaced by RRULE expansion

-- First, audit what we have
SELECT 
  COUNT(*) FILTER (WHERE recurring_type IS NOT NULL AND rrule IS NULL) as old_recurring,
  COUNT(*) FILTER (WHERE rrule IS NOT NULL) as rrule_events,
  COUNT(*) as total_events
FROM public.calendar_events;

-- Check a sample of what will be deleted
SELECT id, title, start_time, recurring_type, recurring_group_id, rrule
FROM public.calendar_events
WHERE recurring_type IS NOT NULL 
  AND rrule IS NULL
ORDER BY title, start_time
LIMIT 20;

-- Delete old recurring instances (events with recurring_type but no rrule)
DELETE FROM public.calendar_events
WHERE recurring_type IS NOT NULL 
  AND rrule IS NULL;

-- Verify the cleanup
SELECT 
  COUNT(*) FILTER (WHERE rrule IS NOT NULL) as rrule_events,
  COUNT(*) as total_events
FROM public.calendar_events;
```

**Step 3: Verify the fix**

After running the migration, check:
```sql
-- Should show only parent events with RRULE
SELECT id, title, start_time, rrule
FROM public.calendar_events
WHERE rrule IS NOT NULL
ORDER BY title;

-- Should show no events with recurring_group_id but no RRULE
SELECT COUNT(*) as orphaned_instances
FROM public.calendar_events
WHERE recurring_group_id IS NOT NULL 
  AND rrule IS NULL;
-- Should return: 0
```

**Step 4: Refresh the app**

Hard refresh the browser (Cmd+Shift+R on Mac) to see the fix take effect.

## EXPECTED RESULT

After applying this fix:
- Each recurring event should appear ONCE as an RRULE parent
- FullCalendar will expand them into visible instances
- No duplicate "infinite" instances
- The 8 RRULE events logged should be the ONLY recurring event entries in the database

## WHY THIS HAPPENED

The original migration plan didn't include a step to clean up pre-generated instances because:
1. The focus was on adding RRULE capability
2. It wasn't explicitly mentioned that the old system pre-generated child instances
3. The migration assumed a "clean slate" or that old instances would be ignored

This is a common migration issue - we added the new system but didn't remove the old data.

## TECHNICAL DETAILS

**Old System:**
- Parent event with `recurring_type='daily'`, `recurring_interval=1`
- System pre-generated child instances: one row per occurrence
- Each child has same `recurring_group_id` linking them to parent

**New System:**
- Parent event with `rrule='FREQ=DAILY;INTERVAL=1;COUNT=52'`
- NO child instances in database
- FullCalendar expands RRULE on-the-fly in the UI

**Migration Gap:**
- Added `rrule` to parent events ✅
- Did NOT delete old child instances ❌
- Result: Database has BOTH systems' data simultaneously

## PREVENTION

The migration file now includes explicit cleanup logic. Future similar migrations should:
1. Add new column/system
2. Migrate data to new format
3. **Explicitly delete/archive old format data**
4. Document the cleanup step clearly
