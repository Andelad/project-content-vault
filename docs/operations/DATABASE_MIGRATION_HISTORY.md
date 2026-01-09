# Database Migration History - Milestones → Phases

**Last Updated:** 2026-01-09  
**Current State:** Database table is `phases` with `start_date` and `end_date` columns  
**Issue:** Codebase still contains 1,104 references to "milestone" terminology

---

## Current Database Schema (as of 2025-12-30)

**Table Name:** `phases` (renamed from `milestones` on 2025-12-29)

**Columns:**
- `id` - UUID primary key
- `name` - Text, not null
- `start_date` - Timestamp with timezone, not null (added 2025-10-18)
- `end_date` - Timestamp with timezone, not null (renamed from `due_date` on 2025-12-30)
- `time_allocation_hours` - Numeric (added 2025-10-18, replaces `time_allocation`)
- `project_id` - UUID foreign key to projects
- `user_id` - UUID foreign key to users
- `is_recurring` - Boolean (added 2025-10-18)
- `recurring_config` - JSONB (added 2025-10-18)
- `order_index` - Integer
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Deprecated Columns (still present for backward compatibility):**
- `due_date` - DEPRECATED, renamed to `end_date` ✅ REMOVED (2025-12-30)
- `time_allocation` - DEPRECATED, use `time_allocation_hours` instead

---

## Migration Timeline

### Phase 1: Original Milestones Table (2025-08-20)

**Files:**
1. `20250820000000_add_milestones_table.sql` - Initial creation
2. `20250820202150_26ca92de-eeb0-4506-acaf-757147e23900.sql` - Duplicate? (NEEDS REVIEW)

**Schema:**
- Table: `milestones`
- Key column: `due_date` (single deadline, no duration)
- Allocation: `time_allocation` (percentage 0-100)

**Concept:** Milestones as deadline points with percentage budget allocation

---

### Phase 2: Convert to Hours (2025-08-20 & 2025-10-18)

**Files:**
1. `20250820211518_353c6479-87ca-45b6-82ac-33a468c04044.sql` - Initial hour conversion
2. `20251018135332_f3716e35-ae6f-4c04-8376-5eb299ee7337.sql` - Major migration with backup

**Changes:**
- Added `time_allocation_hours` column
- Added `start_date` column (set to `due_date - 7 days` for existing records)
- Added `is_recurring` and `recurring_config` for recurring patterns
- Kept `time_allocation` for backward compatibility

**Concept:** Milestones becoming time periods (start → due) with hour budgets

---

### Phase 3: Relax Constraints (2025-12-17)

**File:** `20251217203423_03966cdd-3eef-4f2f-849c-5d75eea94764.sql`

**Changes:**
- Allowed zero hours for phases (removed > 0 constraint)
- Added >= 0 constraint instead

**Reason:** Support placeholder phases or phases with no time allocation

---

### Phase 4: Rename to Phases (2025-12-29) ✅ COMPLETE

**File:** `20251229164244_c6ba79c7-2aba-4fa9-8f27-3e3bb763bfb1.sql`

**Changes:**
- `ALTER TABLE milestones RENAME TO phases`
- Updated all RLS policies (renamed from "milestones" to "phases")
- Renamed primary key index: `milestones_pkey` → `phases_pkey`

**Semantic Shift:** "Milestone" (point in time) → "Phase" (period with duration)

---

### Phase 5: Add Duration Support (2025-12-30) ✅ COMPLETE

**Files:**
1. `20251230072442_cec6e67a-bf74-4e88-a82b-8fc4a5a448d6.sql` - Added `end_date` column
2. `20251230073615_d6db4a82-f957-4ba4-9bdc-dbac6f6c835f.sql` - Fixed by renaming `due_date` → `end_date`

**Changes:**
- Renamed `due_date` to `end_date` (more semantically accurate for duration-based phases)
- Made both `start_date` and `end_date` NOT NULL
- Added indexes: `idx_phases_end_date`, `idx_phases_date_range`

**Final Concept:** Phases have explicit start and end dates defining duration

---

## Redundant/Confusing Migrations

### ⚠️ SIMILAR BUT NOT DUPLICATE: 20250820202150_26ca92de-eeb0-4506-acaf-757147e23900.sql

**Issue:** Very similar to `20250820000000_add_milestones_table.sql` but uses different trigger function

**Difference:**
- First migration: Defines `handle_updated_at()` function inline
- Second migration: Uses existing `update_updated_at_column()` function

**Likely Reason:** First migration may have failed or been rolled back, second migration uses existing database function

**Action Needed:** 
- Verify which migration actually ran in production
- Add comment to second migration explaining relationship to first

---

### ⚠️ CONFUSING: Migration file names still reference "milestones"

**Issue:** 5 migration files have "milestone" in their content but the table is now "phases"

**Files:**
1. ✅ `20250820000000_add_milestones_table.sql` - Historical, OK to keep
2. ❓ `20250820202150_26ca92de-eeb0-4506-acaf-757147e23900.sql` - Duplicate?
3. ✅ `20250820211518_353c6479-87ca-45b6-82ac-33a468c04044.sql` - Historical
4. ✅ `20251018135332_f3716e35-ae6f-4c04-8376-5eb299ee7337.sql` - Historical
5. ✅ `20251217203423_03966cdd-3eef-4f2f-849c-5d75eea94764.sql` - Historical

**Recommendation:** Add header comments to each explaining they're pre-rename migrations

Example:
```sql
-- ============================================================================
-- HISTORICAL NOTE: This migration was created when the table was named "milestones"
-- The table was renamed to "phases" on 2025-12-29 in migration 20251229164244
-- ============================================================================
```

---

## Deprecated Columns Still in Database?

Need to verify if these columns still exist:

1. ❓ `due_date` - Should have been removed/renamed to `end_date`
2. ❓ `time_allocation` - Marked as deprecated, but may still exist for backward compatibility

**Action:** Run this query to check current schema:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'phases' 
ORDER BY ordinal_position;
```

---

## What Needs to Change in Codebase

### ✅ Database Layer - COMPLETE
- Table renamed: `milestones` → `phases` ✅
- Column renamed: `due_date` → `end_date` ✅
- Indexes updated ✅
- RLS policies updated ✅

### ❌ TypeScript/Application Layer - INCOMPLETE (1,104 references remain)

**Still uses "milestone" terminology:**
- 126 mentions in `PhaseCalculations.ts`
- 112 mentions in `PhaseOrchestrator.ts`
- 102 mentions in `PhaseValidation.ts`
- 47 total files affected

**Functions still named with "milestone":**
- `calculateMilestoneSegments()`
- `getMilestoneSegmentForDate()`
- `validateMilestoneScheduling()`
- `analyzeMilestoneOverlap()`
- etc.

**See:** `docs/bugs/2026-01-09-milestone-to-phase-migration.md` for complete migration plan

---

## Summary

### What's Done ✅
1. Database table renamed: `milestones` → `phases`
2. Column added: `start_date` (supports duration-based phases)
3. Column renamed: `due_date` → `end_date` (semantic clarity)
4. RLS policies updated to reference "phases"
5. Indexes updated

### What's Not Done ❌
1. **1,104 code references** still say "milestone"
2. TypeScript types still use `Milestone` in variable names
3. Domain functions still named `calculateMilestoneSegments()` etc.
4. Comments and documentation use old terminology
5. Migration files lack context headers explaining the rename

### Confusion This Creates
- New developers see both "phase" and "milestone" and don't know the difference
- Legacy functions like `calculateMilestoneSegments()` don't match Phase 5 semantics
- **Recently caused bug:** Gap hover tooltip used milestone segments (continuous) instead of checking phase date ranges (has gaps)

---

## Recommended Actions

### Immediate (Documentation)
1. ✅ Add header comments to historical migrations explaining they're pre-rename
2. ✅ Investigate duplicate migration `20250820202150`
3. ✅ Document current schema in this file (DONE)

### Short-term (Code Cleanup)
1. Rename all TypeScript functions/variables from "milestone" → "phase"
2. Start with domain layer (PhaseCalculations.ts, PhaseValidation.ts)
3. Update application layer (orchestrators)
4. Update presentation layer (hooks, components)

### Long-term (Complete Migration)
1. Remove deprecated `time_allocation` column (if it still exists)
2. Verify all deprecated fields are removed
3. Run final grep to confirm zero "milestone" references in active code
4. Update all documentation

**See full plan:** `docs/bugs/2026-01-09-milestone-to-phase-migration.md`
