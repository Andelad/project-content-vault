# Database Schema Alignment with App Logic

**Priority**: High  
**Effort**: Medium (1-2 hours)  
**Status**: 🔴 Not Implemented  
**Created**: December 27, 2025

---

## 📋 Problem Statement

After updating the App Logic documentation, several misalignments were discovered between the database schema and the documented business entities:

1. **Wrong Table Name**: Database has `milestones` but App Logic calls this entity **"Phase"**
2. **Unused Table**: Database has `work_hours` table that is not used anywhere in the codebase
3. **Wrong Column Name**: `projects` table has `auto_estimate_days` but should be renamed to `working_day_overrides` per App Logic

**Impact:**
- ❌ Code and documentation use different terminology (confusion for AI and developers)
- ❌ Unused tables create maintenance burden and confusion
- ❌ Misnamed columns don't align with documented business logic terminology

---

## 🎯 Desired Outcome

**After Fix:**
- ✅ Database uses `phases` table (aligned with App Logic entity name)
- ✅ `work_hours` table removed (replaced by `settings.weekly_work_hours` JSONB + `work_hour_exceptions` table)
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
| **Why Delete?** | Conflicts with App Logic: "Work Hours" is a **derived concept** (calculated duration), NOT a stored entity |
| **Actual Storage** | Work slots are stored in `settings.weekly_work_hours` (JSONB) + `work_hour_exceptions` table |

**Search Results:**
- ❌ 0 matches for `from('work_hours')`
- ❌ 0 matches for `.select()`, `.insert()`, `.update()`, `.delete()` on work_hours
- ✅ Only auto-generated TypeScript type definition exists (will disappear when table dropped)

**What Actually Stores Work Slot Data:**
1. `settings.weekly_work_hours` (JSONB) - Recurring weekly patterns (e.g., Mon-Fri 9-5)
2. `work_hour_exceptions` table - Instance overrides for specific dates

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

### Step 1: Create Database Migration

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
--   - settings.weekly_work_hours (JSONB) for recurring patterns
--   - work_hour_exceptions for instance overrides
DROP TABLE IF EXISTS public.work_hours CASCADE;

COMMENT ON TABLE public.settings IS 
    'User settings including weekly_work_hours (recurring work slot patterns) and preferences';

COMMENT ON TABLE public.work_hour_exceptions IS 
    'Instance overrides for work slots on specific dates (deleted or modified times)';

-- ============================================================
-- PART 3: Rename auto_estimate_days to working_day_overrides
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
- ✅ `projects.auto_estimate_days` renamed to `projects.working_day_overrides`

---

### Step 3: Update Code References (milestones → phases)

Use global find-and-replace to update all code references:

#### 3.1 Database Queries

**Find:** `from('milestones')`  
**Replace:** `from('phases')`

**Find:** `'milestones'` (in Supabase query contexts)  
**Replace:** `'phases'`

#### 3.2 TypeScript Interfaces & Types

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
- [ ] `projects.working_day_overrides` column exists (renamed from `auto_estimate_days`)
- [ ] `projects.auto_estimate_days` column no longer exists
- [ ] All RLS policies work correctly on `phases` table
- [ ] Can insert, update, delete phases successfully

### Code Tests

- [ ] TypeScript types regenerated (no compilation errors)
- [ ] All imports updated (`Milestone` → `Phase`)
- [ ] All database queries work (`from('phases')`)
- [ ] No references to `milestones` table remain in code
- [ ] No references to `work_hours` table remain in code
- [ ] Working day override logic works correctly

### Integration Tests

- [ ] Can create a phase for a project
- [ ] Can update phase time allocation
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
| 8. Work Slot | `settings.weekly_work_hours` + `work_hour_exceptions` | ✅ **Fixed** |
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
- **Why delete work_hours table?** It's unused and conflicts with App Logic. "Work Hours" is a derived concept (duration), not a stored entity.
- **Why JSONB for overrides?** Flexible, indexable, and works well for sparse data (most projects won't have overrides).

---

**Ready to execute?** Run the migration in Lovable's Supabase dashboard, then update code references! 🚀
