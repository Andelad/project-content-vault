# Database Schema Alignment with App Logic

**Priority**: High  
**Effort**: Large (4-6 hours - major refactor)  
**Status**: ✅ Database Complete - Code Updates Pending  
**Created**: December 27, 2025  
**Updated**: December 29, 2025

---

## ✅ COMPLETED MIGRATIONS (Done in Lovable)

The following database changes have been executed via Lovable:

| PR | Change | Status | Code Updated |
|----|--------|--------|--------------|
| **PR 1a** | Case-insensitive unique constraints on `clients.name`, `groups.name`, `labels.name` | ✅ Done | ✅ Domain rules updated |
| **PR 1b** | Drop unused `work_hours` table | ✅ Done | N/A (unused) |
| **PR 2** | Rename `work_hour_exceptions` → `work_slot_exceptions` | ✅ Done | ✅ `UnifiedWorkHourRecurrenceService.ts` updated |
| **PR 3** | Rename `auto_estimate_days` → `working_day_overrides` | ✅ Done | ✅ `useProjects.ts` & `ProjectOrchestrator.ts` updated |
| **PR 4** | Rename `milestones` → `phases` (table) | ✅ Done | 🟡 Partial - DB queries updated |

**TypeScript types** (`src/integrations/supabase/types.ts`) have been auto-regenerated.

---

## 🟡 REMAINING: PR 4 Code Refactoring (VS Code)

**Database migration is COMPLETE.** The table is now `phases`.

**Code updates done in Lovable:**
- ✅ All `from('milestones')` → `from('phases')` in Supabase queries
- ✅ Type imports updated to use `Database['public']['Tables']['phases']`

**Remaining for VS Code** (semantic naming throughout codebase):
- 🔴 **~50+ TypeScript files** use `milestone`/`Milestone` variable names
- 🔴 **File renames** (optional but recommended for consistency)
- 🔴 **Domain rules** - Consider merging `MilestoneRules.ts` into `PhaseRules.ts`

---

## 📋 VS Code Instructions for PR4: Code Refactoring

**Ask VS Code/Cursor to do the following:**

### Step 1: Variable/Interface Renames (Find & Replace)

| Find | Replace | Notes |
|------|---------|-------|
| `Milestone` (type/interface) | `Phase` | Check for conflicts with existing Phase type |
| `milestone` (variable) | `phase` | Context-dependent |
| `milestones` (array variable) | `phases` | Context-dependent |
| `useMilestones` | Consider keeping or aliasing | Hook name |

### Step 2: File Renames (Optional)
- `src/hooks/useMilestones.ts` → `usePhases.ts` (or create alias)
- `src/hooks/milestone/` folder → `src/hooks/phase/`
- Components with "Milestone" in name

### Step 3: Update Domain Rules
- Merge `MilestoneRules.ts` logic with `PhaseRules.ts` or rename entirely
- Update all imports throughout codebase

### Step 4: Test
- Verify CRUD operations on phases work
- Verify RLS policies are applied correctly
- Verify no TypeScript compilation errors

## 📋 Original Problem Statement

After updating the App Logic documentation, several misalignments were discovered between the database schema and the documented business entities:

1. ~~**Wrong Table Name**: Database has `milestones` but App Logic calls this entity **"Phase"**~~ → **PR4 pending**
2. ~~**Unused Table**: Database has `work_hours` table that is not used anywhere in the codebase~~ → ✅ **Dropped**
3. ~~**Wrong Column Name**: `projects` table has `auto_estimate_days`~~ → ✅ **Renamed to `working_day_overrides`**
4. ~~**Wrong Table Name**: Database has `work_hour_exceptions`~~ → ✅ **Renamed to `work_slot_exceptions`**

---

## 🎯 Desired Outcome

**After Fix:**
- ✅ Database uses `phases` table (aligned with App Logic entity name)
- ✅ `work_hours` table removed (work slots stored in `settings.weekly_work_hours` JSONB + `work_slot_exceptions` table)
- ✅ `work_hour_exceptions` renamed to `work_slot_exceptions` (aligned with App Logic: Work Slot is entity, Work Hours is derived concept)
- ✅ `projects` table has `working_day_overrides` column for project-specific working day customization
- ✅ All code references updated to use new terminology

---

## 🔍 Current vs. Desired State

### Issue 1: Milestones → Phases

| Aspect | Current (Wrong) | Desired (Correct) |
|--------|----------------|-------------------|
| **Table Name** | `milestones` | `phases` |
| **App Logic Says** | Entity #4: "Phase" | Entity #4: "Phase" |
| **Used in Code** | ✅ Yes (needs renaming) | — |
| **Reason for Change** | Original creator says: "I never liked the name milestone, so I thought 'Phase' would work better" | Align with documented business logic |

**Current Schema:**
```sql
CREATE TABLE public.milestones (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    due_date timestamp with time zone NOT NULL,
    time_allocation numeric NOT NULL CHECK (time_allocation >= 0 AND time_allocation <= 100),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    order_index integer NOT NULL DEFAULT 0,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
```

---

### Issue 2: work_hours Table (Delete)

| Aspect | Details |
|--------|---------|
| **Status** | ❌ Unused - 0 code references found |
| **Migration Comment** | "Create work_hours table (optional, as mentioned in requirements)" |
| **Why Delete?** | Conflicts with App Logic: "Work Hours" is a **derived concept** (calculated duration from work slots), NOT a stored entity |
| **App Logic Entity** | Entity #7: "Work Slot" - the actual stored entity |
| **Actual Storage** | Work slots are stored in `settings.weekly_work_hours` (JSONB) + `work_slot_exceptions` table |

**Search Results:**
- ❌ 0 matches for `from('work_hours')`
- ❌ 0 matches for `.select()`, `.insert()`, `.update()`, `.delete()` on work_hours
- ✅ Only auto-generated TypeScript type definition exists (will disappear when table dropped)

**What Actually Stores Work Slot Data:**
1. `settings.weekly_work_hours` (JSONB) - Recurring weekly work slot patterns (e.g., Mon-Fri 9am-5pm)
2. `work_slot_exceptions` table - Instance overrides for specific dates (currently named `work_hour_exceptions`, needs renaming)

**App Logic Clarification:**
- **Work Slot** (Entity #7): Time block definition stored in database (e.g., "Monday 9am-12pm")
- **Work Hours** (Derived Concept): Generated instances for calendar display by expanding work slots with recurrence rules

---

### Issue 3: Wrong Column Name - auto_estimate_days → working_day_overrides

| Aspect | Details |
|--------|---------|
| **Current Name** | `auto_estimate_days` |
| **Correct Name** | `working_day_overrides` (per App Logic) |
| **Current Schema** | ✅ Column exists as `projects.auto_estimate_days` (JSONB) |
| **Data Type** | JSONB (stores object with day-of-week boolean flags) |
| **Purpose** | Allow projects to customize which days of the week are working days for auto-estimation |
| **Current Structure** | `{"monday": true, "tuesday": true, ..., "sunday": false}` |
| **Migration Added** | `20250902000000_add_auto_estimate_days.sql` |

**Example Use Case:**
- User's default working days: Mon-Fri (from settings)
- Project needs custom schedule: Mon-Sat for critical deadline
- Override: Enable Saturday in this project's `working_day_overrides`

**Why Rename:**
- "working_day_overrides" better describes the business concept
- Aligns with App Logic documentation terminology
- More intuitive for developers and AI assistants

---

## 🔧 Implementation Steps

### CRITICAL: Two-Phase Approach Required

**Phase 1: Database Migration (Do This First)**
- Run the SQL migration below
- This will rename tables/columns in the database
- ⚠️ **Code will break temporarily** until Phase 2 is complete

**Phase 2: Code Updates (Do Immediately After)**
- Regenerate TypeScript types from Supabase
- Update all code references using find-and-replace
- Test and verify everything works

---

### Phase 1: Database Migration

Create a new Supabase migration file:

**File:** `supabase/migrations/[timestamp]_align_schema_with_app_logic.sql`

```sql
-- ============================================================
-- Align Database Schema with App Logic Documentation
-- ============================================================
-- Created: December 27, 2025
-- Purpose: Rename milestones→phases, drop unused work_hours, add project overrides
-- ============================================================

-- ============================================================
-- PART 1: Rename milestones → phases
-- ============================================================

-- Step 1.1: Rename the table
ALTER TABLE public.milestones RENAME TO phases;

-- Step 1.2: Rename indexes to match new table name
ALTER INDEX idx_milestones_project_id RENAME TO idx_phases_project_id;
ALTER INDEX idx_milestones_user_id RENAME TO idx_phases_user_id;
ALTER INDEX idx_milestones_due_date RENAME TO idx_phases_due_date;

-- Step 1.3: Rename RLS policies
DROP POLICY IF EXISTS "Users can only see their own milestones" ON public.phases;
DROP POLICY IF EXISTS "Users can only insert their own milestones" ON public.phases;
DROP POLICY IF EXISTS "Users can only update their own milestones" ON public.phases;
DROP POLICY IF EXISTS "Users can only delete their own milestones" ON public.phases;

CREATE POLICY "Users can only see their own phases" ON public.phases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own phases" ON public.phases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own phases" ON public.phases
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own phases" ON public.phases
    FOR DELETE USING (auth.uid() = user_id);

-- Step 1.4: Rename trigger
DROP TRIGGER IF EXISTS handle_milestones_updated_at ON public.phases;
CREATE TRIGGER handle_phases_updated_at
    BEFORE UPDATE ON public.phases
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Step 1.5: Add comment for documentation
COMMENT ON TABLE public.phases IS 
    'Project phases (formerly milestones). Represents a distinct stage or deliverable within a project timeline.';

-- ============================================================
-- PART 2: Drop unused work_hours table
-- ============================================================

-- Step 2.1: Drop the table (CASCADE drops dependent objects like indexes, triggers, RLS policies)
-- NOTE: This table is NOT used in codebase. Work slots are stored in:
--   - settings.weekly_work_hours (JSONB) for recurring work slot patterns
--   - work_slot_exceptions table for instance overrides
DROP TABLE IF EXISTS public.work_hours CASCADE;

COMMENT ON TABLE public.settings IS 
    'User settings including weekly_work_hours (recurring work slot patterns) and preferences';

-- ============================================================
-- PART 3: Rename work_hour_exceptions to work_slot_exceptions
-- ============================================================

-- Rename table to align with App Logic entity naming
-- App Logic: "Work Slot" is the entity, "Work Hours" is the derived concept
ALTER TABLE public.work_hour_exceptions 
RENAME TO work_slot_exceptions;

-- Update table and column comments
COMMENT ON TABLE public.work_slot_exceptions IS 
    'Exceptions to the weekly work slot pattern defined in settings.weekly_work_hours. Allows users to modify or delete work slots on specific dates.';

COMMENT ON COLUMN public.work_slot_exceptions.exception_date IS 
    'The specific date this exception applies to';

COMMENT ON COLUMN public.work_slot_exceptions.slot_id IS 
    'The WorkSlot ID from settings.weekly_work_hours that this exception modifies';

COMMENT ON COLUMN public.work_slot_exceptions.exception_type IS 
    'Type of exception: "deleted" (work slot removed for this date) or "modified" (work slot times changed for this date)';

COMMENT ON COLUMN public.work_slot_exceptions.modified_start_time IS 
    'If exception_type is "modified", the new start time in HH:MM format';

COMMENT ON COLUMN public.work_slot_exceptions.modified_end_time IS 
    'If exception_type is "modified", the new end time in HH:MM format';

-- Rename RLS policies to match new table name
DROP POLICY IF EXISTS "Users can view their own work hour exceptions" ON public.work_slot_exceptions;
DROP POLICY IF EXISTS "Users can create their own work hour exceptions" ON public.work_slot_exceptions;
DROP POLICY IF EXISTS "Users can update their own work hour exceptions" ON public.work_slot_exceptions;
DROP POLICY IF EXISTS "Users can delete their own work hour exceptions" ON public.work_slot_exceptions;

CREATE POLICY "Users can view their own work slot exceptions" 
    ON public.work_slot_exceptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own work slot exceptions" 
    ON public.work_slot_exceptions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own work slot exceptions" 
    ON public.work_slot_exceptions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own work slot exceptions" 
    ON public.work_slot_exceptions FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PART 4: Rename auto_estimate_days to working_day_overrides
-- ============================================================

-- Rename column to align with App Logic terminology
ALTER TABLE public.projects 
RENAME COLUMN auto_estimate_days TO working_day_overrides;

-- Update column comment to reflect new name
COMMENT ON COLUMN public.projects.working_day_overrides IS 
    'Project-specific working day customization. JSONB object defining which days of the week are working days for this project. Each day key (monday-sunday) maps to a boolean value. Overrides user default work schedule for auto-estimation calculations.';

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify phases table exists and has correct structure
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'phases' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'ERROR: phases table does not exist!';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'milestones' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'ERROR: milestones table still exists! Should be renamed to phases.';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_hours' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'ERROR: work_hours table still exists! Should be dropped.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_slot_exceptions' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'ERROR: work_slot_exceptions table does not exist! Should be renamed from work_hour_exceptions.';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_hour_exceptions' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'ERROR: work_hour_exceptions table still exists! Should be renamed to work_slot_exceptions.';
    END IF;
    
    -- Verify working_day_overrides column exists (renamed from auto_estimate_days)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'working_day_overrides' 
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'ERROR: projects.working_day_overrides column does not exist! Migration may have failed.';
    END IF;
    
    -- Verify auto_estimate_days column no longer exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'auto_estimate_days' 
        AND table_schema = 'public'
    ) THEN
        RAISE EXCEPTION 'ERROR: projects.auto_estimate_days column still exists! Should be renamed to working_day_overrides.';
    END IF;
    
    RAISE NOTICE 'SUCCESS: All schema changes verified!';
END $$;
```

---

### Step 2: Update TypeScript Types

After running the migration, regenerate TypeScript types from Supabase.

**Terminal Command:**
```bash
# Regenerate types to reflect new schema
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

**Expected Changes:**
- ❌ `Database['public']['Tables']['milestones']` removed
- ✅ `Database['public']['Tables']['phases']` added
- ❌ `Database['public']['Tables']['work_hours']` removed
- ❌ `Database['public']['Tables']['work_hour_exceptions']` removed
- ✅ `Database['public']['Tables']['work_slot_exceptions']` added
- ✅ `projects.auto_estimate_days` renamed to `projects.working_day_overrides`

---

### Step 3: Update Code References

Use global find-and-replace to update all code references:

#### 3.1 Database Queries - Phases

**Find:** `from('milestones')`  
**Replace:** `from('phases')`

**Find:** `'milestones'` (in Supabase query contexts)  
**Replace:** `'phases'`

#### 3.2 Database Queries - Work Slot Exceptions

**Find:** `from('work_hour_exceptions')`  
**Replace:** `from('work_slot_exceptions')`

**Find:** `'work_hour_exceptions'` (in Supabase query contexts)  
**Replace:** `'work_slot_exceptions'`

**Find:** `work_hour_exceptions` (in imports, types)  
**Replace:** `work_slot_exceptions`

#### 3.3 TypeScript Interfaces & Types - Phases

**Find:** `Milestone` (interface/type name)  
**Replace:** `Phase`

**Find:** `milestone` (variable names)  
**Replace:** `phase`

**Find:** `milestones` (array variable names)  
**Replace:** `phases`

#### 3.3 File Names (if applicable)

Check for files named with "milestone" and rename to "phase":
- `useMilestones.ts` → `usePhases.ts`
- `MilestoneCard.tsx` → `PhaseCard.tsx`
- `milestones/` → `phases/`

#### 3.4 Comments and Documentation

Update inline comments and JSDoc:
```typescript
// Before:
/** Fetch all milestones for a project */

// After:
/** Fetch all phases for a project */
```

---

### Step 4: Update Domain Rules (if applicable)

If you have domain rules for milestones, rename and update:

**File:** `src/domain/rules/PhaseRules.ts` (formerly `MilestoneRules.ts`)

```typescript
/**
 * PHASE BUSINESS RULES
 * 
 * Entity: Phase (formerly Milestone)
 * Purpose: Represents a distinct stage or deliverable within a project timeline
 */
export class PhaseRules {
  /**
   * RULE 1: Phase name validation
   * Business Logic: Phase names must be between 1 and 200 characters
   */
  static validatePhaseName(name: string): boolean {
    return name.trim().length > 0 && name.length <= 200;
  }

  /**
   * RULE 2: Time allocation validation
   * Business Logic: Each phase must allocate 0-100% of project budget
   */
  static validateTimeAllocation(allocation: number): boolean {
    return allocation >= 0 && allocation <= 100;
  }

  /**
   * RULE 3: Total phase allocation
   * Business Logic: All phases together should not exceed 100% of project budget
   */
  static validateTotalAllocation(phases: Phase[]): {
    isValid: boolean;
    total: number;
  } {
    const total = phases.reduce((sum, phase) => sum + phase.timeAllocation, 0);
    return {
      isValid: total <= 100,
      total
    };
  }
}
```

---

### Step 5: Update TypeScript References (auto_estimate_days → working_day_overrides)

Update all TypeScript code to use the new column name:

**File:** `src/types/core.ts`

Find and replace in Project interface:
```typescript
// BEFORE (current):
  autoEstimateDays?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };

// AFTER (rename to):
  workingDayOverrides?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };

**File:** `src/hooks/useProjects.ts`

Update database field mapping:
```typescript
// BEFORE:
  autoEstimateDays:
    dbProject.auto_estimate_days !== null
      ? (dbProject.auto_estimate_days as Project['autoEstimateDays'])
      : undefined,

// AFTER:
  workingDayOverrides:
    dbProject.working_day_overrides !== null
      ? (dbProject.working_day_overrides as Project['workingDayOverrides'])
      : undefined,
```

And when saving:
```typescript
// BEFORE:
  auto_estimate_days: projectData.autoEstimateDays ?? null,

// AFTER:
  working_day_overrides: projectData.workingDayOverrides ?? null,
```

**File:** `src/components/features/project/ProjectMilestoneSection.tsx`

Update UI component:
```typescript
// BEFORE:
  autoEstimateDays?: AutoEstimateDays;
  onAutoEstimateDaysChange?: (newAutoEstimateDays: AutoEstimateDays | undefined) => void;

// AFTER:
  workingDayOverrides?: WorkingDayOverrides;
  onWorkingDayOverridesChange?: (newWorkingDayOverrides: WorkingDayOverrides | undefined) => void;
```

Update all references in the component (lines 755-850):
- Rename `autoEstimateDays` → `workingDayOverrides`
- Update UI labels: "Auto-Estimate Days" → "Working Day Overrides"
- Update descriptions to match new terminology

---

## ✅ Testing Checklist

After implementing all changes:

### Database Tests

- [ ] `phases` table exists with correct schema
- [ ] `milestones` table no longer exists
- [ ] `work_hours` table no longer exists
- [ ] `work_slot_exceptions` table exists (renamed from `work_hour_exceptions`)
- [ ] `work_hour_exceptions` table no longer exists
- [ ] `projects.working_day_overrides` column exists (renamed from `auto_estimate_days`)
- [ ] `projects.auto_estimate_days` column no longer exists
- [ ] All RLS policies work correctly on `phases` table
- [ ] All RLS policies work correctly on `work_slot_exceptions` table
- [ ] Can insert, update, delete phases successfully
- [ ] Can insert, update, delete work slot exceptions successfully

### Code Tests

- [ ] TypeScript types regenerated (no compilation errors)
- [ ] All imports updated (`Milestone` → `Phase`)
- [ ] All database queries work (`from('phases')`, `from('work_slot_exceptions')`)
- [ ] No references to `milestones` table remain in code
- [ ] No references to `work_hours` table remain in code
- [ ] No references to `work_hour_exceptions` table remain in code
- [ ] Working day override logic works correctly
- [ ] Work slot exception logic works correctly

### Integration Tests

- [ ] Can create a phase for a project
- [ ] Can update phase time allocation
- [ ] Can create work slot exceptions for specific dates
- [ ] Can modify work slot times for a specific date
- [ ] Can delete work slots for a specific date
- [ ] Can delete a phase
- [ ] Can add working day override to project
- [ ] Can remove working day override from project
- [ ] Project working days calculation respects overrides

---

## 🎯 App Logic Alignment Summary

After this migration:

| App Logic Entity | Database Table | Status |
|-----------------|----------------|---------|
| 1. User | `auth.users` | ✅ Aligned |
| 2. Client | `clients` | ✅ Aligned |
| 3. Project | `projects` (`auto_estimate_days` → `working_day_overrides`) | ✅ Aligned |
| 4. Phase | `phases` (formerly `milestones`) | ✅ **Fixed** |
| 5. Group | `groups` | ✅ Aligned |
| 6. Label | `labels` + `project_labels` | ✅ Aligned |
| 7. Calendar Event | `calendar_events` | ✅ Aligned |
| 8. Work Slot | `settings.weekly_work_hours` + `work_slot_exceptions` | ✅ **Fixed** |
| 9. Holiday | `holidays` | ✅ Aligned |

**Derived Concepts (Not Stored):**
- Working Days (calculated from user settings + project overrides) ✅
- Work Hours (calculated duration from work slots) ✅
- Capacity (calculated from work hours) ✅
- Availability (calculated: capacity - planned - auto-estimated) ✅
- Overcommitted (calculated: committed > capacity) ✅

---

## 📚 Related Documentation

- **App Logic**: `/docs/core/App Logic.md` - Source of truth for entity definitions
- **Case-Insensitive Clients**: `/docs/lovable/CASE_INSENSITIVE_CLIENT_NAMES.md` - Separate client name fix
- **Business Logic**: `/docs/core/Business Logic.md` - Detailed calculation rules

---

## 🚨 Rollback Plan

If issues occur after migration:

```sql
-- Rollback: Rename phases back to milestones
ALTER TABLE public.phases RENAME TO milestones;
ALTER INDEX idx_phases_project_id RENAME TO idx_milestones_project_id;
ALTER INDEX idx_phases_user_id RENAME TO idx_milestones_user_id;
ALTER INDEX idx_phases_due_date RENAME TO idx_milestones_due_date;

-- Rollback: Recreate work_hours table (from backup if data existed)
-- Only if needed - table was unused

-- Rollback: Rename work_slot_exceptions back to work_hour_exceptions
ALTER TABLE public.work_slot_exceptions RENAME TO work_hour_exceptions;

-- Rollback: Rename working_day_overrides back to auto_estimate_days
ALTER TABLE public.projects 
RENAME COLUMN working_day_overrides TO auto_estimate_days;

-- Restore original comment
COMMENT ON COLUMN public.projects.auto_estimate_days IS 
    'JSONB object defining which days of the week are included in auto-estimation calculations. Each day key maps to a boolean value.';
```

**Note:** Keep a database backup before running the migration!

---

## 💡 Notes

- **Why "Phase" instead of "Milestone"?** Original creator preference: "I never liked the name milestone, so I thought 'Phase' would work better." Aligns better with project management terminology (phases are ongoing, milestones are single points).
- **Why delete work_hours table?** It's unused and conflicts with App Logic. "Work Hours" is a derived concept (calculated duration from work slots), not a stored entity.
- **Why rename to work_slot_exceptions?** Aligns with App Logic entity naming. "Work Slot" (Entity #7) is the stored entity; "Work Hours" is the derived concept generated for display.
- **Why JSONB for overrides?** Flexible, indexable, and works well for sparse data (most projects won't have overrides).
- **App Logic terminology is intentional**: Work Slots = what you define/store, Work Hours = what you see/use in calculations.

---

**Ready to execute?** Run the migration in Lovable's Supabase dashboard, then update code references! 🚀
