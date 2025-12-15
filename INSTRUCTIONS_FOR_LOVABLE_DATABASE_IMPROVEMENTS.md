# Instructions for Lovable: Database Improvements

**Date:** December 15, 2025  
**Priority:** High → Medium → Low (implement in order)  
**Status:** ✅ COMPLETED (December 15, 2025)

---

## Implementation Summary

| Issue | Priority | Status | Notes |
|-------|----------|--------|-------|
| 1. work_hours security | HIGH | ✅ Already done | Verified user_id exists + proper RLS policies |
| 2. Remove duplicate files | HIGH | ✅ Implemented | Deleted 2 orphaned migration files |
| 3. Composite indexes | MEDIUM | ✅ Implemented | Added 3 performance indexes |
| 4. Validation constraints | MEDIUM | ✅ Implemented | Used `>=` instead of `>` for flexibility |
| 5. time_entries table | LOW | ⏭️ Deferred | Marked optional/future |
| 6. Legacy recurring fields | LOW | ⏭️ Deferred | Marked "NOT NOW" |

---

## Overview

A comprehensive database review identified several issues that need attention. This document provides the migrations needed to improve database security, performance, and data integrity.

---

## 🔴 HIGH PRIORITY

### Issue 1: `work_hours` Table Missing User Isolation (SECURITY)

**Problem:** The `work_hours` table has RLS enabled but with completely open policies ("Anyone can view/modify work hours"). The table is also missing a `user_id` column, making proper user isolation impossible.

**Impact:** Any authenticated user can see and modify all work hours in the system.

**Migration SQL:**

```sql
-- Step 1: Add user_id column to work_hours table
ALTER TABLE public.work_hours 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: For existing data, we need to assign to a user
-- If you have existing work hours, update them to belong to a specific user first
-- UPDATE public.work_hours SET user_id = 'YOUR_USER_UUID' WHERE user_id IS NULL;

-- Step 3: Make user_id required (only after existing data is updated)
ALTER TABLE public.work_hours 
ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can view work hours" ON public.work_hours;
DROP POLICY IF EXISTS "Anyone can insert work hours" ON public.work_hours;
DROP POLICY IF EXISTS "Anyone can update work hours" ON public.work_hours;
DROP POLICY IF EXISTS "Anyone can delete work hours" ON public.work_hours;

-- Step 5: Create proper user-scoped RLS policies
CREATE POLICY "Users can view their own work hours" 
ON public.work_hours FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own work hours" 
ON public.work_hours FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work hours" 
ON public.work_hours FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own work hours" 
ON public.work_hours FOR DELETE 
USING (auth.uid() = user_id);

-- Step 6: Add index for user_id queries
CREATE INDEX IF NOT EXISTS idx_work_hours_user_id ON public.work_hours(user_id);
```

**Verification:**
```sql
-- Check column exists
SELECT column_name, is_nullable FROM information_schema.columns 
WHERE table_name = 'work_hours' AND column_name = 'user_id';

-- Check policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'work_hours';

-- Test: Should return only current user's work hours
SELECT * FROM public.work_hours;
```

---

### Issue 2: Remove Duplicate Migration Files (CLEANUP)

**Problem:** There are duplicate migration files in the repository that were never applied but cause confusion.

**Files to Remove (via git):**
- `supabase/migrations/20251112120000_cleanup_legacy_recurring_instances.sql`
- `supabase/migrations/20251112130000_additional_recurring_cleanup.sql`

**Action:** These files should be removed from the repository. They are NOT applied to the database, just cluttering the migrations folder.

```bash
# Run this in the repository
git rm supabase/migrations/20251112120000_cleanup_legacy_recurring_instances.sql
git rm supabase/migrations/20251112130000_additional_recurring_cleanup.sql
git commit -m "chore: remove duplicate migration files"
```

**Note:** Do NOT run these as database migrations - they are just file cleanup.

---

## 🟠 MEDIUM PRIORITY

### Issue 3: Add Composite Indexes for Performance

**Problem:** Common query patterns are missing optimized indexes.

**Migration SQL:**

```sql
-- Index for calendar events by user and date range (common calendar query)
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date_range 
ON public.calendar_events(user_id, start_time, end_time);

-- Index for projects by client (common filtering)
CREATE INDEX IF NOT EXISTS idx_projects_user_client 
ON public.projects(user_id, client_id);

-- Index for calendar events by project and date (event lookup)
CREATE INDEX IF NOT EXISTS idx_calendar_events_project_date 
ON public.calendar_events(project_id, start_time) 
WHERE project_id IS NOT NULL;
```

**Verification:**
```sql
-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('calendar_events', 'projects')
AND indexname LIKE 'idx_%';
```

---

### Issue 4: Add Data Validation Constraints

**Problem:** Missing database-level constraints that could prevent invalid data.

**Migration SQL:**

```sql
-- Ensure calendar events have valid time range
ALTER TABLE public.calendar_events 
ADD CONSTRAINT check_event_time_range 
CHECK (end_time > start_time);

-- Ensure projects have valid date range (when not continuous)
-- Note: We can't add a simple constraint because continuous projects ignore end_date
-- This is enforced at the application level via domain rules

-- Ensure positive estimated hours on projects
ALTER TABLE public.projects 
ADD CONSTRAINT check_positive_estimated_hours 
CHECK (estimated_hours >= 0);

-- Ensure valid milestone time allocation
ALTER TABLE public.milestones 
ADD CONSTRAINT check_valid_time_allocation 
CHECK (time_allocation >= 0 AND time_allocation <= 100);
```

**Verification:**
```sql
-- Check constraints exist
SELECT conname, contype FROM pg_constraint 
WHERE conrelid IN ('calendar_events'::regclass, 'projects'::regclass, 'milestones'::regclass)
AND conname LIKE 'check_%';
```

---

## 🟡 LOW PRIORITY (Future Consideration)

### Issue 5: Create `time_entries` Table (Optional)

**Problem:** The TypeScript codebase has a `TimeEntry` interface, but time tracking is currently stored as JSONB in `settings.time_tracking_state`. A dedicated table would improve:
- Historical time tracking queries
- Reporting capabilities
- Query performance

**Migration SQL (implement only if time tracking reporting is needed):**

```sql
-- Create dedicated time entries table
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL, -- Denormalized for reporting efficiency
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration DECIMAL, -- Duration in hours (calculated on end)
  description TEXT,
  is_paused BOOLEAN DEFAULT false,
  total_paused_duration INTEGER DEFAULT 0, -- Paused time in milliseconds
  event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own time entries" 
ON public.time_entries FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time entries" 
ON public.time_entries FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries" 
ON public.time_entries FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time entries" 
ON public.time_entries FOR DELETE 
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_time_entries_user_id ON public.time_entries(user_id);
CREATE INDEX idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX idx_time_entries_date_range ON public.time_entries(user_id, start_time, end_time);

-- Trigger for updated_at
CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

### Issue 6: Legacy Recurring Fields (Future Deprecation)

**Problem:** The `calendar_events` table has both:
- New system: `rrule` column (RFC 5545 compliant)
- Legacy system: `recurring_type`, `recurring_interval`, `recurring_end_date`, `recurring_count`, `recurring_group_id`

**Action:** Do NOT remove these yet. They are kept for backward compatibility. When the RRULE implementation is complete and tested:

1. Verify no events use legacy fields
2. Create migration to remove legacy columns
3. Update TypeScript types

**Future Migration (NOT NOW):**
```sql
-- Only run when RRULE migration is complete
ALTER TABLE public.calendar_events DROP COLUMN IF EXISTS recurring_type;
ALTER TABLE public.calendar_events DROP COLUMN IF EXISTS recurring_interval;
ALTER TABLE public.calendar_events DROP COLUMN IF EXISTS recurring_end_date;
ALTER TABLE public.calendar_events DROP COLUMN IF EXISTS recurring_count;
ALTER TABLE public.calendar_events DROP COLUMN IF EXISTS recurring_group_id;
```

---

## Implementation Order

1. **Issue 1** - Fix `work_hours` security (CRITICAL)
2. **Issue 2** - Remove duplicate migration files (cleanup)
3. **Issue 3** - Add composite indexes (performance)
4. **Issue 4** - Add validation constraints (data integrity)
5. **Issue 5** - Optional: Create `time_entries` table (only if needed)
6. **Issue 6** - Future: Deprecate legacy recurring fields (not now)

---

## Rollback Instructions

### Issue 1 Rollback:
```sql
-- Drop new policies
DROP POLICY IF EXISTS "Users can view their own work hours" ON public.work_hours;
DROP POLICY IF EXISTS "Users can create their own work hours" ON public.work_hours;
DROP POLICY IF EXISTS "Users can update their own work hours" ON public.work_hours;
DROP POLICY IF EXISTS "Users can delete their own work hours" ON public.work_hours;

-- Recreate old policies (not recommended - leaves security hole)
CREATE POLICY "Anyone can view work hours" ON work_hours FOR SELECT USING (true);
CREATE POLICY "Anyone can insert work hours" ON work_hours FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update work hours" ON work_hours FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete work hours" ON work_hours FOR DELETE USING (true);

-- Remove user_id column
ALTER TABLE public.work_hours DROP COLUMN IF EXISTS user_id;
```

### Issue 3 Rollback:
```sql
DROP INDEX IF EXISTS idx_calendar_events_user_date_range;
DROP INDEX IF EXISTS idx_projects_user_client;
DROP INDEX IF EXISTS idx_calendar_events_project_date;
```

### Issue 4 Rollback:
```sql
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS check_event_time_range;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS check_positive_estimated_hours;
ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS check_valid_time_allocation;
```

---

## Notes for Lovable

- All migrations use `IF NOT EXISTS` / `IF EXISTS` clauses for safety
- Run migrations in order (Issue 1 first)
- Verify each migration before proceeding to the next
- Report any errors encountered
- This file can be archived after all migrations are complete

**Questions?** Check `docs/architecture/SUPABASE_REQUIREMENTS.md` for existing schema documentation.
