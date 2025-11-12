# URGENT: Recurring Events Deleted - Recovery Plan

## What Happened

The cleanup migration `20251112112019` deleted ALL events with `recurring_type IS NOT NULL AND rrule IS NULL`.

**The problem:** This may have deleted parent recurring events if:
1. The RRULE migration didn't populate all parent events correctly
2. Or there was a timing issue between migrations
3. Or the parent events had `recurring_type` but the `rrule` field was somehow NULL

## Immediate Recovery Steps

### Option 1: Supabase Point-in-Time Recovery (Preferred)

1. Go to Supabase Dashboard → Database → Backups
2. Look for the point-in-time backup from **before** the cleanup migration ran (before 11:20:19 UTC on 2025-11-12)
3. Restore the database to that point
4. This will undo the deletion

### Option 2: Restore from Backup

If you have a database backup from before the migration:
1. Restore from that backup
2. Apply migrations up to but NOT including the cleanup migrations

### Option 3: Recreate Events Manually

If no backup is available, you'll need to recreate the recurring events:
1. List of events that were likely deleted:
   - wake up (FREQ=DAILY;INTERVAL=1;COUNT=52)
   - Breakfast (FREQ=DAILY;INTERVAL=1;COUNT=52)
   - Lunch (FREQ=DAILY;INTERVAL=1;COUNT=52)
   - Dinner (FREQ=DAILY;INTERVAL=1;COUNT=52)
   - Bins (FREQ=WEEKLY;INTERVAL=1;COUNT=52)
   - Pete S (FREQ=WEEKLY;INTERVAL=1;UNTIL=20251231T235959Z)
   - Men's Group (FREQ=MONTHLY;INTERVAL=1;COUNT=52)
   - Church (FREQ=WEEKLY;INTERVAL=1;COUNT=52)

## Root Cause Analysis

The migration logic was flawed:

**Assumption:** Parent events would have `recurring_type` AND `rrule` after migration
**Reality:** Something prevented the parent events from getting `rrule`, OR they were structured differently

**Better approach would have been:**
1. First, verify parent events have rrule
2. Only delete events that are clearly child instances (e.g., have a parent_id or are duplicates)
3. Use a more surgical approach with explicit event IDs

## Corrective Migration (After Recovery)

After restoring the database, we need a SAFER cleanup approach:

```sql
-- SAFE Cleanup: Only delete obvious duplicates
-- DO NOT run this until after recovery!

-- Step 1: Ensure all parent events have RRULE
-- (This should already be done, but let's verify)
UPDATE public.calendar_events
SET rrule = CASE
  WHEN recurring_type = 'daily' THEN 'FREQ=DAILY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'weekly' THEN 'FREQ=WEEKLY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'monthly' THEN 'FREQ=MONTHLY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'yearly' THEN 'FREQ=YEARLY;INTERVAL=' || COALESCE(recurring_interval, 1)
END
WHERE recurring_type IS NOT NULL 
  AND rrule IS NULL;

-- Step 2: Add COUNT to parent events if they have recurring_count
UPDATE public.calendar_events
SET rrule = rrule || ';COUNT=' || recurring_count
WHERE recurring_count IS NOT NULL 
  AND rrule IS NOT NULL 
  AND rrule NOT LIKE '%COUNT=%'
  AND rrule NOT LIKE '%UNTIL=%';

-- Step 3: VERIFY before deletion
-- Check how many events would be deleted
SELECT COUNT(*) as will_be_deleted,
       COUNT(DISTINCT title) as unique_titles
FROM public.calendar_events
WHERE recurring_type IS NOT NULL 
  AND rrule IS NULL;

-- Step 4: Show sample of what would be deleted
SELECT id, title, start_time, recurring_type, rrule
FROM public.calendar_events
WHERE recurring_type IS NOT NULL 
  AND rrule IS NULL
ORDER BY title, start_time
LIMIT 50;

-- Step 5: ONLY delete if verified as child instances
-- DO NOT RUN THIS WITHOUT VERIFICATION
-- DELETE FROM public.calendar_events
-- WHERE recurring_type IS NOT NULL 
--   AND rrule IS NULL;
```

## Prevention for Future

1. **Always verify before deletion**
2. **Use transactions with rollback capability**
3. **Test migrations on a copy of production data first**
4. **Keep manual backups before risky migrations**
5. **Use soft deletes (archive) instead of hard deletes for initial cleanup**

## Lessons Learned

1. ❌ Don't assume data state - verify it
2. ❌ Don't delete based on absence of a field without verification
3. ✅ Always show what will be deleted before deleting
4. ✅ Use point-in-time backups
5. ✅ Test destructive migrations on staging data first
