# Habits Feature - Database Migration Instructions

**Date:** November 1, 2025  
**Status:** Code Complete - Database Migration Required  
**Priority:** Ready to Deploy

---

## Overview

The habits feature has been fully implemented in the codebase. All TypeScript types, hooks, components, and UI elements are complete and working. The only remaining step is to apply the database migration.

---

## What This Migration Does

Adds a `category` column to the `calendar_events` table to distinguish between regular events and habits (and potential future event types).

### Benefits
- **Backward compatible**: Existing events default to `category = 'event'`
- **Future-proof**: Easy to add new categories later (reminders, goals, etc.)
- **Efficient**: Partial index only indexes non-default categories
- **Type-safe**: CHECK constraint validates only allowed values

---

## Migration Instructions

### Step 1: Ensure Docker Desktop is Running

The Supabase local development environment requires Docker Desktop to be running.

**Check if Docker is running:**
```bash
docker ps
```

If you see an error, start Docker Desktop and wait for it to fully initialize.

---

### Step 2: Apply the Migration

Run this command from the project root:

```bash
npx supabase db reset
```

**What this does:**
- Resets your local development database
- Applies ALL migrations in order, including the new habits migration
- Creates the `category` column with proper constraints
- Creates the index for efficient queries

**Alternative (if you don't want a full reset):**
```bash
npx supabase db push
```
This only applies new migrations without resetting existing data.

---

### Step 3: Verify Migration Success

After running the migration, verify it worked:

```bash
npx supabase db diff
```

You should see no pending changes if the migration applied successfully.

**Or check directly in the database:**
```sql
-- Check if column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'calendar_events' 
AND column_name = 'category';

-- Check if index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'calendar_events' 
AND indexname = 'idx_calendar_events_category';
```

---

## Migration File Details

**Location:** `supabase/migrations/20251031000000_add_habits_support.sql`

**Contents:**
```sql
-- Add support for event categories in calendar_events table
-- Categories allow different types of events: 'event' (default), 'habit', and potential future types

ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'event' CHECK (category IN ('event', 'habit'));

-- Create index for efficient category queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON public.calendar_events(category) WHERE category != 'event';

COMMENT ON COLUMN public.calendar_events.category IS 'Event category: event (default), habit (separate layer, no project assignment), or future types';
```

**Key Points:**
- `VARCHAR(50)`: Allows room for future category names
- `DEFAULT 'event'`: All existing events automatically become category 'event'
- `CHECK (category IN ('event', 'habit'))`: Database-level validation
- Partial index: Only indexes non-default categories for efficiency

---

## Testing After Migration

### 1. Start Development Server
```bash
npm run dev
```

### 2. Navigate to Planner View
Click on the "Planner" tab in the main navigation.

### 3. Create a Test Habit
Look for the **brown croissant + button** in the toolbar and click it.

**Create a habit with these details:**
- Title: "Morning meditation"
- Start time: Tomorrow at 7:00 AM
- End time: Tomorrow at 7:30 AM
- Description: "Daily mindfulness practice"

Click "Create Habit"

### 4. Test Functionality

**Drag & Drop:**
- Click and drag the habit to a different time slot
- Should move smoothly and update the time

**Resize:**
- Hover over top or bottom edge of habit
- Drag to resize duration

**Recurring Pattern:**
- Click the habit to edit it
- Enable "Recurring"
- Set to "Daily" with interval 1
- Save
- Navigate to next day - should see another instance

**Completion Toggle:**
- Click the circle icon on the habit
- Should toggle between empty and checked
- Completed habits appear slightly faded

**Visual Verification:**
- Habits should be **brown color** (#8B4513)
- Show **croissant icon** 🥐
- Render on separate layer (habits appear "behind" regular events visually)
- No project assignment option in habit modal

---

## Troubleshooting

### Migration Fails with "relation already exists"
The migration file uses `IF NOT EXISTS` clauses, so it's safe to run multiple times. If you see this error, the column may already exist from a previous attempt.

**Solution:**
```sql
-- Check current state
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'calendar_events' AND column_name = 'category';

-- If column exists but migration failed, manually verify it matches:
-- Type: VARCHAR(50)
-- Default: 'event'
-- Constraint: CHECK (category IN ('event', 'habit'))
```

### Docker Not Running
**Error:** "Error: connect ECONNREFUSED"

**Solution:**
1. Open Docker Desktop
2. Wait for it to show "Running"
3. Verify with: `docker ps`
4. Retry migration

### Type Errors After Migration
The TypeScript types should already be correct, but if you see errors:

**Solution:**
```bash
# Regenerate Supabase types
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

---

## Rollback (If Needed)

If you need to remove the habits feature:

**Rollback SQL:**
```sql
-- Remove the column
ALTER TABLE public.calendar_events DROP COLUMN IF EXISTS category;

-- Remove the index
DROP INDEX IF EXISTS idx_calendar_events_category;
```

**Then delete these files:**
- `src/hooks/useHabits.ts`
- `src/components/modals/HabitModal.tsx`
- `supabase/migrations/20251031000000_add_habits_support.sql`

See `docs/HABITS_FEATURE_IMPLEMENTATION.md` for full rollback instructions.

---

## Expected Behavior After Migration

### In Planner View:
- ✅ New "Add Habit" button (brown with croissant icon)
- ✅ Habits render in brown with croissant icon
- ✅ Habits appear on separate visual layer
- ✅ All event features work (drag, resize, recurring, completion)
- ✅ Habit modal opens when clicking habits (no project selector)

### In Database:
- ✅ `calendar_events.category` column exists
- ✅ All existing events have `category = 'event'`
- ✅ New habits have `category = 'habit'`
- ✅ Index exists for efficient queries

---

## Technical Notes

### Why Category Instead of Boolean?
We use a `category` field instead of an `isHabit` boolean because:
1. **Extensible**: Easy to add new categories without schema changes
2. **Single discriminator**: Cleaner than multiple boolean flags
3. **Better queries**: `WHERE category = 'habit'` vs `WHERE is_habit = true`
4. **Type-safe**: TypeScript union types work better

### Performance
- **Index**: Partial index means only non-default categories are indexed
- **Queries**: All habit queries use the indexed column
- **Cost**: Minimal overhead - existing events default to 'event' automatically

### Security
Row Level Security (RLS) policies automatically apply to the category field. Habits respect existing user-level access controls.

---

## Success Criteria

After completing this migration, verify:

- [ ] Migration runs without errors
- [ ] `category` column exists in `calendar_events` table
- [ ] Index `idx_calendar_events_category` exists
- [ ] Dev server starts without TypeScript errors
- [ ] Planner view loads successfully
- [ ] "Add Habit" button visible (brown with croissant)
- [ ] Can create a new habit
- [ ] Habit appears in brown with croissant icon
- [ ] Can drag and resize habit
- [ ] Can make habit recurring
- [ ] Completion toggle works
- [ ] Regular events still work normally

---

## Support

If you encounter any issues during migration:

1. Check Docker Desktop is running
2. Verify no TypeScript compilation errors: `npm run build`
3. Check browser console for errors
4. Review `docs/HABITS_FEATURE_IMPLEMENTATION.md` for detailed implementation info

All code is already implemented - this migration just adds the database column!
