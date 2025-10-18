# Database Migration Request for Lovable AI

## 🎯 Objective

Migrate the `milestones` table schema to properly support the timeline architecture refactor documented in `TIMELINE_ARCHITECTURE_REFACTOR.md`.

---

## ❓ Pre-Migration Questions

**IMPORTANT: Please answer these questions first:**

1. **What is the current value range of the `time_allocation` column?**
   - Is it storing **percentages** (values 0-100)?
   - Or is it storing **actual hours** (values like 8, 16, 40)?
   - Run: `SELECT MIN(time_allocation), MAX(time_allocation), AVG(time_allocation) FROM milestones;`

2. **How many milestone records exist in production?**
   - Run: `SELECT COUNT(*) FROM milestones;`

3. **Can this migration be executed in a transaction for rollback safety?**
   - We want to be able to roll back if anything goes wrong

---

## 📋 Migration Script

### Step 1: Create Backup

```sql
-- Create backup table
CREATE TABLE milestones_backup_20251018 AS 
SELECT * FROM public.milestones;

-- Verify backup
SELECT COUNT(*) FROM milestones_backup_20251018;
```

### Step 2: Add New Columns

```sql
-- Add new columns (nullable initially)
ALTER TABLE public.milestones
  ADD COLUMN time_allocation_hours numeric,
  ADD COLUMN start_date timestamp with time zone,
  ADD COLUMN is_recurring boolean DEFAULT false,
  ADD COLUMN recurring_config jsonb;
```

### Step 3: Migrate Data

**Choose ONE of these based on answer to Question #1:**

#### Option A: If `time_allocation` is HOURS (most likely)

```sql
UPDATE public.milestones
SET 
  time_allocation_hours = time_allocation,
  start_date = due_date - INTERVAL '7 days',  -- Default: 1 week before due date
  is_recurring = false,
  recurring_config = NULL;
```

#### Option B: If `time_allocation` is PERCENTAGE (less likely)

```sql
UPDATE public.milestones m
SET 
  time_allocation_hours = (m.time_allocation / 100.0) * p.estimated_hours,
  start_date = m.due_date - INTERVAL '7 days',
  is_recurring = false,
  recurring_config = NULL
FROM public.projects p
WHERE m.project_id = p.id;
```

### Step 4: Verify Migration

```sql
-- Check that all rows were migrated
SELECT 
  COUNT(*) as total_milestones,
  COUNT(time_allocation_hours) as has_hours,
  COUNT(start_date) as has_start_date,
  COUNT(CASE WHEN is_recurring IS NOT NULL THEN 1 END) as has_is_recurring
FROM public.milestones;

-- Should show: total_milestones = has_hours = has_start_date = has_is_recurring

-- Check for any NULL values that shouldn't be there
SELECT COUNT(*) as null_hours FROM public.milestones WHERE time_allocation_hours IS NULL;
SELECT COUNT(*) as null_start_date FROM public.milestones WHERE start_date IS NULL;
-- Both should return 0

-- Sample the data to verify it looks correct
SELECT 
  name,
  time_allocation as old_value,
  time_allocation_hours as new_value,
  due_date,
  start_date,
  is_recurring
FROM public.milestones
LIMIT 10;
```

### Step 5: Add Constraints

```sql
-- Make time_allocation_hours NOT NULL and add check constraint
ALTER TABLE public.milestones
  ALTER COLUMN time_allocation_hours SET NOT NULL,
  ADD CONSTRAINT milestones_time_allocation_hours_check 
    CHECK (time_allocation_hours >= 0);
```

### Step 6: Create Index

```sql
-- Add index for recurring milestone queries
CREATE INDEX idx_milestones_is_recurring 
  ON public.milestones(is_recurring) 
  WHERE is_recurring = true;
```

### Step 7: Keep Old Column (For Now)

```sql
-- DO NOT DROP the old time_allocation column yet
-- We'll keep it during the code deployment transition
-- It will be dropped in a follow-up migration after we verify everything works

-- Add a comment to document the transition
COMMENT ON COLUMN public.milestones.time_allocation IS 
  'DEPRECATED: Being replaced by time_allocation_hours. Will be removed after code deployment.';

COMMENT ON COLUMN public.milestones.time_allocation_hours IS 
  'Time allocated to this milestone in hours (portion of project.estimated_hours)';
```

---

## ✅ Post-Migration Verification Checklist

After running the migration, please verify:

- [ ] Backup table `milestones_backup_20251018` exists and has correct row count
- [ ] All milestones have `time_allocation_hours` populated (no NULLs)
- [ ] All milestones have `start_date` populated (no NULLs)
- [ ] All milestones have `is_recurring = false` (default state)
- [ ] Constraint `milestones_time_allocation_hours_check` exists
- [ ] Index `idx_milestones_is_recurring` exists
- [ ] Old `time_allocation` column still exists (for backward compatibility)
- [ ] Sample data looks correct (compare old vs new values)

---

## 🔄 Rollback Plan (If Needed)

If something goes wrong:

```sql
-- Option 1: Drop new columns (if migration failed mid-way)
ALTER TABLE public.milestones
  DROP COLUMN IF EXISTS time_allocation_hours,
  DROP COLUMN IF EXISTS start_date,
  DROP COLUMN IF EXISTS is_recurring,
  DROP COLUMN IF EXISTS recurring_config;

-- Option 2: Restore from backup (if data is corrupted)
DROP TABLE public.milestones;
ALTER TABLE milestones_backup_20251018 RENAME TO milestones;
```

---

## 📊 Expected Results

**Before Migration:**
```
milestones table columns:
- id, name, due_date, time_allocation, project_id, order_index, user_id, created_at, updated_at
```

**After Migration:**
```
milestones table columns:
- id, name, due_date, time_allocation, project_id, order_index, user_id, created_at, updated_at
- time_allocation_hours (NEW)
- start_date (NEW)
- is_recurring (NEW)
- recurring_config (NEW)
```

**Example Data:**

| name | time_allocation (old) | time_allocation_hours (new) | due_date | start_date (new) | is_recurring (new) |
|------|----------------------|----------------------------|----------|-----------------|-------------------|
| Phase 1 | 20 | 20 | 2025-11-01 | 2025-10-25 | false |
| Phase 2 | 30 | 30 | 2025-11-15 | 2025-11-08 | false |

---

## 🚦 Migration Status

**Status:** ⏳ Awaiting execution by Lovable AI

**Next Steps After Migration:**
1. Lovable reports migration results
2. We verify the data looks correct
3. I implement the code changes (Phases 1-6 of refactor plan)
4. We test locally
5. We deploy to production
6. After 48 hours of stable operation, we drop the old `time_allocation` column

---

## 📞 Questions?

If you encounter any issues during migration:
1. **Stop immediately** - don't proceed to next steps
2. **Share the error message** - exact SQL error
3. **Check the backup** - verify it exists and has data
4. **We can roll back** - no permanent damage

---

## 🎯 Summary for Lovable

**Please execute these steps IN ORDER:**

1. Answer the 3 pre-migration questions
2. Create backup table
3. Add new columns
4. Migrate data (choose Option A or B based on Question #1)
5. Run verification queries
6. Add constraints and index
7. Report results

**DO NOT:**
- Drop the old `time_allocation` column (we need it for backward compatibility)
- Skip the backup step
- Proceed if verification fails

**Expected Duration:** 5-10 minutes

**Risk Level:** Low (we have backup and rollback plan)

---

## 📄 Related Documentation

See `TIMELINE_ARCHITECTURE_REFACTOR.md` for:
- Why we're doing this migration
- How the new schema supports the timeline architecture
- Full implementation plan for code changes
- Timeline and testing strategy
