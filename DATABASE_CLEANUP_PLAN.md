# Database Cleanup Plan - Remove Migration Deadwood

## Problem
We've created duplicate migrations that are causing confusion and potential issues:

### Duplicate Migrations to Remove:
1. `20251112120000_cleanup_legacy_recurring_instances.sql` - My duplicate
2. `20251112130000_additional_recurring_cleanup.sql` - My duplicate

### Lovable's Applied Migrations (KEEP):
1. `20251112101354_5137af61-1fdd-4dd1-b986-3826f8506b46.sql` - Initial RRULE migration ✅
2. `20251112111617_71641332-4767-44f3-818a-8f438f66c085.sql` - First cleanup attempt ✅
3. `20251112112019_85b2f5f1-83e7-44b9-af0f-c63cc2f78d0f.sql` - Second cleanup (problematic) ✅
4. `20251112112037_6be21027-5bb6-4c68-92f8-bf73ce35c601.sql` - Third cleanup attempt ✅

## Cleanup Actions

### 1. Remove Duplicate Migration Files
These were never applied to the database, just cluttering the repo:

```bash
git rm supabase/migrations/20251112120000_cleanup_legacy_recurring_instances.sql
git rm supabase/migrations/20251112130000_additional_recurring_cleanup.sql
```

### 2. Verify Database State
Need to check what's actually in the database now:

```sql
-- Check what events remain
SELECT 
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE rrule IS NOT NULL) as rrule_events,
  COUNT(*) FILTER (WHERE recurring_type IS NOT NULL) as has_recurring_type,
  COUNT(*) FILTER (WHERE recurring_group_id IS NOT NULL) as has_recurring_group
FROM public.calendar_events;

-- Check if RRULE events exist
SELECT id, title, start_time, rrule
FROM public.calendar_events
WHERE rrule IS NOT NULL
ORDER BY title
LIMIT 20;
```

### 3. Database Recovery (if needed)
If all recurring events were deleted, use Supabase Point-in-Time Recovery:
- Restore to before 11:17 UTC on 2025-11-12
- This will restore the database to before any cleanup migrations ran

### 4. Correct Approach Going Forward

If we need to clean up after recovery, the SAFE approach is:

```sql
-- SAFE: First ensure parent events are properly migrated
UPDATE public.calendar_events
SET rrule = CASE
  WHEN recurring_type = 'daily' THEN 'FREQ=DAILY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'weekly' THEN 'FREQ=WEEKLY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'monthly' THEN 'FREQ=MONTHLY;INTERVAL=' || COALESCE(recurring_interval, 1)
  WHEN recurring_type = 'yearly' THEN 'FREQ=YEARLY;INTERVAL=' || COALESCE(recurring_interval, 1)
END,
-- Mark that this is the parent event
description = COALESCE(description, '') || ' [PARENT_EVENT]'
WHERE recurring_type IS NOT NULL 
  AND rrule IS NULL
  AND recurring_group_id IS NULL; -- Only update parents, not children

-- SAFE: Then identify and delete ONLY child instances
-- Child instances have recurring_group_id AND different dates from parent
DELETE FROM public.calendar_events e1
WHERE e1.recurring_group_id IS NOT NULL
  AND e1.rrule IS NULL
  AND EXISTS (
    -- Ensure there's a parent with the same recurring_group_id that HAS rrule
    SELECT 1 FROM public.calendar_events e2
    WHERE e2.recurring_group_id = e1.recurring_group_id
      AND e2.rrule IS NOT NULL
  );
```

## Files to Clean Up

### Delete these duplicate migrations:
- `20251112120000_cleanup_legacy_recurring_instances.sql`
- `20251112130000_additional_recurring_cleanup.sql`

### Delete these temporary/failed instruction files:
- `RRULE_DEBUG_INSTRUCTIONS.md` (marked as deprecated)
- `RRULE_FIX_INSTRUCTIONS.md` (outdated, failed approach)
- `URGENT_RECOVERY_PLAN.md` (hopefully not needed after proper recovery)

### Keep these for reference:
- `docs/RRULE_IMPLEMENTATION_STATUS.md`
- `docs/RRULE_Recurring_Events_Implementation.md`

## Summary of Mistakes Made

1. ❌ Created migrations without testing on sample data
2. ❌ Assumed database state without verification
3. ❌ Created duplicate migrations causing confusion
4. ❌ Deleted data without proper backup verification
5. ❌ Didn't use transactions for safety

## Correct Process Should Be

1. ✅ Test migration on copy of production data
2. ✅ Verify assumptions with SELECT before DELETE
3. ✅ Use transactions with explicit COMMIT
4. ✅ Confirm backup exists before destructive operations
5. ✅ Document expected before/after state
6. ✅ Have rollback plan ready
