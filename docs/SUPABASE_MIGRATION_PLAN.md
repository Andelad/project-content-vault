# Supabase Migration Plan - Event Categories

**Date:** November 1, 2025  
**Status:** Ready for Execution  
**Priority:** High - Required for Event Categories Feature

---

## Overview

This migration adds support for event categories (event, habit, task) by adding a `category` column to the `calendar_events` table in Supabase.

**Current State:**
- ✅ All TypeScript types updated
- ✅ All React components updated  
- ✅ EventModal unified with tab selector
- ✅ Migration file created locally
- ❌ Database migration not yet applied to Supabase

---

## Migration File Location

**File:** `supabase/migrations/20251031000000_add_habits_support.sql`

This file already exists in the repository and is ready to be applied.

---

## Migration SQL

```sql
-- Add category column to calendar_events table
-- This allows categorizing events as 'event', 'habit', or 'task'

ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'event' 
CHECK (category IN ('event', 'habit', 'task'));

-- Create partial index for non-default categories
-- This index only includes rows where category is not 'event' for efficiency
CREATE INDEX IF NOT EXISTS idx_calendar_events_category 
ON public.calendar_events(category) 
WHERE category != 'event';

-- Add comment to document the column purpose
COMMENT ON COLUMN public.calendar_events.category IS 
'Event category: event (default), habit (separate layer, no project assignment), task (checkbox only), or future types';
```

---

## What This Migration Does

1. **Adds `category` column** with default value `'event'`
   - Existing events automatically become `category = 'event'`
   - No data loss or breaking changes
   - Fully backward compatible

2. **Adds CHECK constraint** to validate allowed values
   - Only allows: `'event'`, `'habit'`, `'task'`
   - Database-level validation ensures data integrity
   - Future categories can be added by modifying CHECK constraint

3. **Creates partial index** for performance
   - Only indexes rows where `category != 'event'`
   - Most events will be default category, so no need to index them
   - Speeds up queries for habits and tasks

4. **Adds documentation** via SQL comment
   - Explains purpose of each category
   - Documents intended usage pattern

---

## Execution Instructions for Lovable

### Option 1: Using Supabase Dashboard (Recommended)

1. **Navigate to SQL Editor:**
   - Open your Supabase project dashboard
   - Go to the SQL Editor tab
   - Create a new query

2. **Paste the Migration SQL:**
   - Copy the SQL from `supabase/migrations/20251031000000_add_habits_support.sql`
   - Paste into the SQL Editor

3. **Execute the Migration:**
   - Click "Run" to execute
   - Verify success message appears

4. **Verify the Changes:**
   ```sql
   -- Check the column exists
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'calendar_events' 
   AND column_name = 'category';
   
   -- Check the constraint exists
   SELECT constraint_name, check_clause 
   FROM information_schema.check_constraints 
   WHERE constraint_name LIKE '%category%';
   
   -- Check the index exists
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'calendar_events' 
   AND indexname = 'idx_calendar_events_category';
   ```

### Option 2: Using Supabase CLI

If you have the Supabase CLI configured:

```bash
# Ensure you're logged in
npx supabase login

# Link to your remote project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
npx supabase db push
```

---

## Verification Steps

After applying the migration, verify everything works:

### 1. Check Database Schema

```sql
-- View the category column
SELECT * FROM calendar_events LIMIT 1;

-- Should show category column with default value 'event'
```

### 2. Test Category Values

```sql
-- Test valid categories (should succeed)
INSERT INTO calendar_events (title, start_time, end_time, category, user_id)
VALUES ('Test Event', NOW(), NOW() + INTERVAL '1 hour', 'event', 'test-user-id');

INSERT INTO calendar_events (title, start_time, end_time, category, user_id)
VALUES ('Test Habit', NOW(), NOW() + INTERVAL '1 hour', 'habit', 'test-user-id');

INSERT INTO calendar_events (title, start_time, end_time, category, user_id)
VALUES ('Test Task', NOW(), NOW() + INTERVAL '1 hour', 'task', 'test-user-id');

-- Test invalid category (should fail with CHECK constraint error)
INSERT INTO calendar_events (title, start_time, end_time, category, user_id)
VALUES ('Invalid', NOW(), NOW() + INTERVAL '1 hour', 'invalid', 'test-user-id');
-- Expected error: new row for relation "calendar_events" violates check constraint
```

### 3. Test Application

After migration:
1. Open the application
2. Click "Add Event" in the planner view
3. Verify tab selector shows three icons: Calendar, Croissant, Checkbox
4. Create an event of each type
5. Verify they save and display correctly

---

## Rollback Plan

If anything goes wrong, you can rollback:

```sql
-- Remove the index
DROP INDEX IF EXISTS idx_calendar_events_category;

-- Remove the column (WARNING: This will delete category data)
ALTER TABLE public.calendar_events 
DROP COLUMN IF EXISTS category;
```

**Note:** Only rollback if absolutely necessary. The migration is designed to be safe and non-destructive.

---

## Impact Assessment

### Data Impact
- ✅ **No data loss** - existing events keep all data
- ✅ **Backward compatible** - defaults to 'event' category
- ✅ **Non-breaking** - application works with or without migration

### Performance Impact
- ✅ **Minimal overhead** - VARCHAR(50) is small
- ✅ **Indexed efficiently** - partial index only for habits/tasks
- ✅ **Fast queries** - CHECK constraint validates at database level

### User Impact
- ✅ **No downtime required** - can be applied live
- ✅ **Immediate availability** - habits and tasks work after migration
- ✅ **Graceful degradation** - old code continues to work

---

## Post-Migration Tasks

After successful migration:

1. ✅ Test creating events, habits, and tasks
2. ✅ Verify filtering and display in planner view
3. ✅ Test editing existing events (should default to 'event' category)
4. ✅ Verify recurring events work with all categories
5. ✅ Update this document's status to "Complete"

---

## Support Contact

If you encounter any issues:
- Migration file: `supabase/migrations/20251031000000_add_habits_support.sql`
- Implementation docs: `docs/HABITS_FEATURE_IMPLEMENTATION.md`
- Database docs: `docs/HABITS_DATABASE_MIGRATION.md`

---

## Summary

**What to do:**
1. Open Supabase dashboard SQL Editor
2. Run the migration SQL from `supabase/migrations/20251031000000_add_habits_support.sql`
3. Verify using the verification queries above
4. Test the application

**Expected time:** 2-5 minutes  
**Risk level:** Low (backward compatible, safe migration)  
**Rollback available:** Yes (but should not be needed)
