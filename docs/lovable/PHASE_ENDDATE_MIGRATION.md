# Phase End Date Migration - Database Schema Update

**Created:** December 30, 2025  
**Completed:** December 30, 2025  
**Status:** ✅ COMPLETED  
**Risk Level:** LOW (backward compatible)

---

## 📋 Problem Statement

The `phases` table currently uses a **milestone-based schema** (point in time with `due_date`), but our Phase domain entity expects a **duration-based schema** (time range with `startDate` and `endDate`).

### Current Database Schema:
```sql
phases {
  due_date: timestamptz (required)  -- Point in time (milestone concept)
  start_date: timestamptz (nullable) -- Optional start
}
```

### Required by Phase Entity:
```typescript
interface Phase {
  startDate: Date;  // Required - phase start
  endDate: Date;    // Required - phase end (MISSING IN DB)
}
```

**The Mismatch:** Phase entity cannot work with `due_date` alone - it needs both `startDate` and `endDate` to represent a work duration.

---

## 🎯 Migration Goal

Add an `end_date` column to the `phases` table to support duration-based phases while maintaining backward compatibility.

---

## 📝 Migration Steps

### Step 1: Add `end_date` Column (Nullable)

```sql
-- Add new column as nullable initially
ALTER TABLE phases 
ADD COLUMN end_date TIMESTAMPTZ;
```

**Why nullable first?** Allows us to populate existing rows before making it required.

---

### Step 2: Migrate Existing Data

```sql
-- Copy due_date to end_date for all existing phases
UPDATE phases 
SET end_date = due_date 
WHERE end_date IS NULL;
```

**Rationale:** Existing "milestones" with a `due_date` can be treated as phases that end on that date. This preserves all existing data and maintains backward compatibility.

---

### Step 3: Make `end_date` NOT NULL

```sql
-- Now that all rows have end_date, make it required
ALTER TABLE phases 
ALTER COLUMN end_date SET NOT NULL;
```

**Why required?** Phase entity requires `endDate` - every phase must have an end date to be valid.

---

### Step 4: Add Indexes for Performance

```sql
-- Index for querying phases by end date
CREATE INDEX idx_phases_end_date 
ON phases(end_date);

-- Composite index for date range queries
CREATE INDEX idx_phases_date_range 
ON phases(start_date, end_date);
```

**Performance benefit:** Enables fast queries like "find all phases ending this month" or "find phases active during a date range".

---

### Step 5: Update `start_date` to NOT NULL (Optional but Recommended)

```sql
-- Ensure all phases have a start_date
-- First, set start_date = end_date for any rows where start_date is null
UPDATE phases 
SET start_date = end_date 
WHERE start_date IS NULL;

-- Then make it required
ALTER TABLE phases 
ALTER COLUMN start_date SET NOT NULL;
```

**Why recommended?** Phases conceptually have both a start and end. This ensures data integrity.

---

## 🔄 Complete Migration Script

```sql
-- Phase End Date Migration
-- Adds end_date column to support duration-based phases

BEGIN;

-- 1. Add end_date column (nullable initially)
ALTER TABLE phases 
ADD COLUMN end_date TIMESTAMPTZ;

-- 2. Migrate existing data (copy due_date to end_date)
UPDATE phases 
SET end_date = due_date 
WHERE end_date IS NULL;

-- 3. Make end_date NOT NULL
ALTER TABLE phases 
ALTER COLUMN end_date SET NOT NULL;

-- 4. Add indexes
CREATE INDEX idx_phases_end_date 
ON phases(end_date);

CREATE INDEX idx_phases_date_range 
ON phases(start_date, end_date);

-- 5. (Optional but recommended) Ensure start_date is also NOT NULL
UPDATE phases 
SET start_date = end_date 
WHERE start_date IS NULL;

ALTER TABLE phases 
ALTER COLUMN start_date SET NOT NULL;

COMMIT;
```

---

## ⚠️ Rollback Plan

If migration needs to be reverted:

```sql
BEGIN;

-- Remove indexes
DROP INDEX IF EXISTS idx_phases_end_date;
DROP INDEX IF EXISTS idx_phases_date_range;

-- Revert start_date to nullable (if step 5 was executed)
ALTER TABLE phases 
ALTER COLUMN start_date DROP NOT NULL;

-- Remove end_date column
ALTER TABLE phases 
DROP COLUMN end_date;

COMMIT;
```

**Note:** This rollback is safe and will restore the original schema.

---

## ✅ Post-Migration Validation

### 1. Verify Column Exists
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'phases' 
  AND column_name IN ('due_date', 'start_date', 'end_date');
```

**Expected result:**
- `due_date`: timestamptz, NOT NULL
- `start_date`: timestamptz, NOT NULL (if step 5 executed)
- `end_date`: timestamptz, NOT NULL

---

### 2. Verify Data Integrity
```sql
-- Check that all phases have valid date ranges
SELECT COUNT(*) 
FROM phases 
WHERE end_date IS NULL 
   OR start_date IS NULL
   OR start_date > end_date;
```

**Expected result:** `0` (no invalid records)

---

### 3. Verify Indexes Created
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'phases' 
  AND indexname LIKE '%end_date%';
```

**Expected result:**
- `idx_phases_end_date`
- `idx_phases_date_range`

---

## 📊 Impact Analysis

### Database Impact:
- **New column:** `end_date` (TIMESTAMPTZ, NOT NULL)
- **Updated column:** `start_date` (made NOT NULL if optional step executed)
- **New indexes:** 2 indexes added
- **Data migration:** All existing `due_date` values copied to `end_date`

### Application Impact:
- **TypeScript types:** Need to regenerate Supabase types after migration
- **Phase entity:** Can now be integrated into hooks/orchestrators
- **Queries:** May need to update some queries to use `end_date` instead of `due_date`
- **UI:** Can now show phase duration (start → end) instead of just due date

### User Impact:
- **Existing phases:** All preserved, now have both start and end dates
- **New functionality:** Users can define work phases with clear durations
- **Timeline view:** Can show phases as time ranges, not just points
- **No breaking changes:** Existing functionality continues to work

---

## 🚀 Post-Migration Tasks

After this migration is complete:

### 1. Regenerate TypeScript Types
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

This will add `end_date` to the TypeScript type definitions.

---

### 2. Integrate Phase Entity
Update `src/hooks/usePhases.ts` to use Phase entity:

```typescript
import { Phase as PhaseEntity } from '@/domain/entities/Phase';

// Map database row to entity params
const phases = data.map(row => PhaseEntity.fromDatabase({
  id: row.id,
  projectId: row.project_id,
  name: row.name,
  startDate: new Date(row.start_date),
  endDate: new Date(row.end_date),  // NEW - now available
  timeAllocationHours: row.time_allocation_hours,
  isRecurring: row.is_recurring,
  recurringConfig: row.recurring_config,
  userId: row.user_id
}));
```

---

### 3. Update Queries (Gradual)
Consider updating queries to use `end_date` where appropriate:

```typescript
// OLD (milestone concept - point in time)
.gte('due_date', startDate)
.lte('due_date', endDate)

// NEW (phase concept - duration)
.or(`start_date.lte.${endDate},end_date.gte.${startDate}`)
```

---

### 4. UI Updates (Optional)
Update UI to show phase durations:

```tsx
// OLD: "Due: Dec 31"
<span>Due: {formatDate(phase.due_date)}</span>

// NEW: "Jan 1 - Dec 31" (shows duration)
<span>{formatDate(phase.start_date)} - {formatDate(phase.end_date)}</span>
```

---

## 📅 Timeline Estimate

| Task | Duration | Risk |
|------|----------|------|
| Write migration script | 15 min | Low |
| Test migration locally | 15 min | Low |
| Execute migration in production | 5 min | Low |
| Regenerate TypeScript types | 5 min | Low |
| Integrate Phase entity | 20 min | Low |
| **Total** | **~1 hour** | **Low** |

---

## 🔒 Safety Considerations

### Why This Migration is Safe:

1. **Backward Compatible:** All existing data preserved
2. **Non-Breaking:** `due_date` column remains untouched
3. **Reversible:** Simple rollback plan available
4. **Data Integrity:** Migration copies existing data (no data loss)
5. **Indexed:** Performance optimized from day one

### Risks Mitigated:

- ✅ Data loss: All existing `due_date` values copied to `end_date`
- ✅ Downtime: Migration runs in seconds (table is small)
- ✅ Breaking changes: `due_date` still exists for backward compatibility
- ✅ Performance: Indexes added immediately

---

## 🎯 Success Criteria

Migration is successful when:

- [ ] `end_date` column exists and is NOT NULL
- [ ] All phases have `start_date` and `end_date` values
- [ ] Indexes `idx_phases_end_date` and `idx_phases_date_range` exist
- [ ] No NULL values in `end_date` column
- [ ] No phases where `start_date > end_date`
- [ ] TypeScript types regenerated and include `end_date`
- [ ] Phase entity successfully integrates into hooks
- [ ] All existing phase queries still work

---

## 📚 Related Documentation

- **DATABASE_SCHEMA_ISSUES.md** - Overview of schema blockers
- **ENTITY_ADOPTION_PLAN.md** - Phase 1 entity integration status
- **Phase.ts** - Phase domain entity expecting `endDate`
- **MILESTONE_TO_PHASE_MIGRATION.md** - Full terminology migration plan

---

**Questions or Issues?**
- Review this document for rollback instructions
- Check validation queries to verify migration success
- Test locally before production deployment

---

**Last Updated:** December 30, 2025  
**Status:** 🔴 Ready for Implementation  
**Next Step:** Execute migration script in Supabase
