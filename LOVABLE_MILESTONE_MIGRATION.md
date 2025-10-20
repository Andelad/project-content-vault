# Milestone System Migration - Lovable Implementation Guide

## Overview
This document provides step-by-step instructions for Lovable to implement the milestone system migration. The current system has a critical bug where milestones don't respect project date boundaries, and we need to add recurring milestone support while removing the redundant `order_index` field.

## Business Logic: Milestone Types

### Single Milestones
A one-time deadline with time allocation.

**Behavior:**
- Creates **TWO segments** in the project timeline:
  1. **Before milestone**: From project start (or previous milestone) to this milestone
  2. **After milestone**: From this milestone to project end (or next milestone)
- Time allocation distributes across working days in the **before milestone** segment
- Multiple single milestones create multiple segments (chain of segments)

**Example:**
```
Project: Jan 1 - Dec 31 (100h budget)
Milestone 1: "Design Complete" - Mar 31 (30h allocation)
Milestone 2: "Beta Release" - Sep 30 (50h allocation)

Segments created:
1. Jan 1 → Mar 31: 30h spread across working days
2. Mar 31 → Sep 30: 50h spread across working days  
3. Sep 30 → Dec 31: 20h remaining spread across working days (auto-estimate)
```

### Recurring Milestones
Repeating work pattern with time allocation per occurrence.

**Behavior:**
- Each occurrence creates a **work segment** before that occurrence
- Time allocation **per occurrence** distributes across working days in that segment
- Occurrences continue throughout project duration (or indefinitely for continuous projects)
- Work segments can overlap with other milestones

**Example:**
```
Project: Jan 1 - Dec 31 (continuous)
Recurring: "Weekly Review" - Every Wednesday (20h/week)

Segments created:
- Week 1: Work Mon-Wed to prepare for Wed review (20h across 3 working days)
- Week 2: Work Mon-Wed to prepare for Wed review (20h across 3 working days)
- Week 3: Work Mon-Wed to prepare for Wed review (20h across 3 working days)
... continues weekly
```

### Date Boundaries
ALL milestones (single and recurring) must respect project date boundaries:
- `milestone.dueDate >= project.startDate`
- `milestone.dueDate <= project.endDate` (unless project is continuous)
- Recurring occurrences outside boundaries are not generated

## CRITICAL INVARIANTS (Enforced at All Levels)

**These rules MUST be enforced in:**
1. ✅ Database constraints (foreign keys, check constraints)
2. ✅ Domain layer validation (MilestoneRules, RelationshipRules)
3. ✅ Service layer (creation, update operations)
4. ✅ UI layer (form validation, date pickers)

### Invariant 1: Single Project Ownership
```typescript
// A milestone MUST belong to exactly ONE project
milestone.projectId !== null && milestone.projectId !== undefined

// ENFORCED BY:
// - Database: NOT NULL constraint on project_id
// - Database: Foreign key constraint (CASCADE DELETE)
// - Domain: RelationshipRules.validateMilestoneBelongsToProject()
// - Service: useMilestones.addMilestone() requires project_id
// - UI: Milestone creation form requires project selection
```

### Invariant 2: Date Boundary Constraint
```typescript
// A milestone MUST exist within its project's date boundaries
project.startDate <= milestone.dueDate <= project.endDate

// ENFORCED BY:
// - Domain: MilestoneRules.validateMilestoneDateWithinProject()
// - Domain: RelationshipRules.validateMilestoneBelongsToProject()
// - Service: Validation before insert/update
// - UI: Date picker min/max constraints
// - Timeline: Filter milestones by project dates before rendering
```

### Why These Invariants Matter
- **Data Integrity**: Prevents orphaned records and invalid references
- **Business Logic**: Ensures milestones make sense in project context
- **UI Consistency**: Eliminates confusing edge cases in timeline rendering
- **Migration Safety**: Allows us to clean up existing bad data

## Phase 0: Data Cleanup (REQUIRED BEFORE OTHER PHASES)

### Problem: Existing Invalid Data
The current system has milestones that violate our invariants:
- Milestone #1010 with order_index far beyond date sequence
- Milestones outside project date boundaries
- Possibly orphaned milestones (project deleted but milestone remains)

### Solution: Database Cleanup Migration

**File**: `supabase/migrations/YYYYMMDDHHMMSS_cleanup_invalid_milestones.sql`

```sql
-- ============================================================================
-- PHASE 0: CLEAN UP INVALID MILESTONE DATA
-- ============================================================================

-- Step 1: Identify and log invalid milestones for audit trail
CREATE TEMP TABLE invalid_milestones AS
SELECT 
  m.id,
  m.project_id,
  m.name,
  m.due_date,
  m.order_index,
  p.start_date AS project_start,
  p.end_date AS project_end,
  p.name AS project_name,
  CASE
    WHEN p.id IS NULL THEN 'ORPHANED'
    WHEN m.due_date < p.start_date THEN 'BEFORE_PROJECT_START'
    WHEN m.due_date > p.end_date AND p.continuous = false THEN 'AFTER_PROJECT_END'
    ELSE 'UNKNOWN'
  END AS violation_type
FROM milestones m
LEFT JOIN projects p ON m.project_id = p.id
WHERE 
  -- Orphaned (project doesn't exist)
  p.id IS NULL
  -- OR before project start
  OR m.due_date < p.start_date
  -- OR after project end (non-continuous projects only)
  OR (m.due_date > p.end_date AND p.continuous = false);

-- Log count of invalid milestones by type
DO $$
DECLARE
  total_invalid INTEGER;
  orphaned_count INTEGER;
  before_start_count INTEGER;
  after_end_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_invalid FROM invalid_milestones;
  SELECT COUNT(*) INTO orphaned_count FROM invalid_milestones WHERE violation_type = 'ORPHANED';
  SELECT COUNT(*) INTO before_start_count FROM invalid_milestones WHERE violation_type = 'BEFORE_PROJECT_START';
  SELECT COUNT(*) INTO after_end_count FROM invalid_milestones WHERE violation_type = 'AFTER_PROJECT_END';
  
  RAISE NOTICE '=== MILESTONE CLEANUP SUMMARY ===';
  RAISE NOTICE 'Total invalid milestones: %', total_invalid;
  RAISE NOTICE '  - Orphaned (no project): %', orphaned_count;
  RAISE NOTICE '  - Before project start: %', before_start_count;
  RAISE NOTICE '  - After project end: %', after_end_count;
  RAISE NOTICE '';
  RAISE NOTICE 'ACTION: All invalid milestones will be DELETED';
END $$;

-- Step 2: Create audit log table BEFORE deletion (to preserve history)
CREATE TABLE IF NOT EXISTS milestone_cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  milestone_id UUID NOT NULL,
  milestone_name TEXT,
  project_id UUID,
  project_name TEXT,
  violation_type TEXT NOT NULL,
  milestone_due_date DATE NOT NULL,
  project_start_date DATE,
  project_end_date DATE,
  action TEXT NOT NULL -- Always 'DELETED' for this cleanup
);

-- Step 3: Log all milestones that will be deleted
INSERT INTO milestone_cleanup_log (
  milestone_id,
  milestone_name,
  project_id,
  project_name,
  violation_type,
  milestone_due_date,
  project_start_date,
  project_end_date,
  action
)
SELECT 
  i.id,
  i.name,
  i.project_id,
  i.project_name,
  i.violation_type,
  i.due_date,
  i.project_start,
  i.project_end,
  'DELETED'
FROM invalid_milestones i;

-- Step 4: DELETE all invalid milestones
-- This is cleaner than trying to move thousands of corrupt milestones
DELETE FROM milestones
WHERE id IN (SELECT id FROM invalid_milestones);

-- Report how many were deleted
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO deleted_count FROM milestone_cleanup_log;
  RAISE NOTICE '';
  RAISE NOTICE '=== CLEANUP COMPLETE ===';
  RAISE NOTICE 'Deleted % invalid milestone(s)', deleted_count;
  RAISE NOTICE 'Audit trail saved in milestone_cleanup_log table';
END $$;

-- Step 5: Recalculate order_index based on due_date for remaining valid milestones
-- This fixes the "milestone 1010" type issues for milestones that ARE valid
WITH ranked_milestones AS (
  SELECT 
    id,
    project_id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY due_date ASC) - 1 AS new_order_index
  FROM milestones
)
UPDATE milestones m
SET order_index = rm.new_order_index
FROM ranked_milestones rm
WHERE m.id = rm.id;

RAISE NOTICE 'Recalculated order_index for all remaining milestones';

-- Step 6: Add database constraints to prevent future violations
-- Constraint 1: Project ID must exist (foreign key with CASCADE DELETE)
ALTER TABLE milestones
DROP CONSTRAINT IF EXISTS milestones_project_id_fkey;

ALTER TABLE milestones
ADD CONSTRAINT milestones_project_id_fkey
FOREIGN KEY (project_id)
REFERENCES projects(id)
ON DELETE CASCADE;  -- Deleting project deletes all its milestones

RAISE NOTICE 'Added foreign key constraint with CASCADE DELETE';

-- Constraint 2: Milestone due date must not be NULL
ALTER TABLE milestones
ALTER COLUMN due_date SET NOT NULL;

RAISE NOTICE 'Added NOT NULL constraint on due_date';

-- Note: Check constraints with subqueries (like date range validation) 
-- are not supported in PostgreSQL. These will be enforced in application layer.

-- Final verification query
DO $$
DECLARE
  remaining_invalid INTEGER;
  total_valid INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_invalid
  FROM milestones m
  LEFT JOIN projects p ON m.project_id = p.id
  WHERE p.id IS NULL
     OR m.due_date < p.start_date
     OR (m.due_date > p.end_date AND p.continuous = false);
  
  SELECT COUNT(*) INTO total_valid FROM milestones;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Remaining valid milestones: %', total_valid;
  RAISE NOTICE 'Remaining invalid milestones: %', remaining_invalid;
  
  IF remaining_invalid > 0 THEN
    RAISE EXCEPTION 'Cleanup failed: % invalid milestone(s) remain', remaining_invalid;
  ELSE
    RAISE NOTICE '✅ Cleanup successful: All milestones now valid';
  END IF;
END $$;
```

### Post-Cleanup Verification

After running the migration, verify:

```sql
-- Query 1: Confirm no orphaned milestones
SELECT COUNT(*) AS orphaned_count
FROM milestones m
LEFT JOIN projects p ON m.project_id = p.id
WHERE p.id IS NULL;
-- Expected: 0

-- Query 2: Confirm all milestones within project dates
SELECT COUNT(*) AS out_of_bounds_count
FROM milestones m
JOIN projects p ON m.project_id = p.id
WHERE m.due_date < p.start_date
   OR (m.due_date > p.end_date AND p.continuous = false);
-- Expected: 0

-- Query 3: Confirm order_index is sequential per project
SELECT 
  project_id,
  COUNT(*) AS milestone_count,
  MAX(order_index) + 1 AS expected_count,
  CASE 
    WHEN COUNT(*) = MAX(order_index) + 1 THEN 'VALID'
    ELSE 'INVALID'
  END AS status
FROM milestones
GROUP BY project_id;
-- Expected: All rows show 'VALID'
```

## Key Architectural Decision: Date-Driven Milestones

**Core Principle**: Milestones are **date segments** that divide a project timeline. They cannot cross each other, and their order is **implicitly defined by their dates**.

### The New Mental Model
- A milestone represents a **segment** from the previous milestone (or project start) up to its `dueDate`
- Milestones **cannot be moved past each other** - they are constrained by adjacent milestone dates
- Movement is allowed only within the "segment space": between the previous milestone's date and the next milestone's date
- **No explicit ordering field needed** - date IS the order

### What This Means
1. **Remove `order_index` entirely** - it's redundant with dates
2. **Sort by date** - always: `milestones.sort((a, b) => a.dueDate - b.dueDate)`
3. **Validate movement** - milestone can only move between adjacent milestone dates
4. **Simplify logic** - no normalization needed, dates define everything

### Example
```
Project: Jan 1 - Dec 31

Milestone A: Feb 15  (segment: Jan 1 - Feb 15)
Milestone B: May 20  (segment: Feb 16 - May 20)
Milestone C: Sep 10  (segment: May 21 - Sep 10)

// Milestone B can move between Feb 16 and Sep 9
// But CANNOT move before A or after C
// Date constraints enforce the "no crossing" rule naturally
```

## Phase 1: Fix Critical Bug & Enforce Invariants (IMMEDIATE - Do This Second)

### Problem
Milestones are displayed regardless of project date boundaries, causing confusion.

### Solution
Update `ProjectMilestoneSection.tsx` to filter milestones by date boundaries AND ensure creation/updates enforce invariants.

### Code Changes Required

**File**: `src/components/projects/modal/ProjectMilestoneSection.tsx`

#### Change 1: Filter Displayed Milestones
**Location**: Lines ~498-510 (projectMilestones useMemo)

**Current Code**:
```typescript
const existing = Array.isArray(milestones) ? milestones.filter(m => m.projectId === projectId) : [];
```

**Fixed Code**:
```typescript
// INVARIANT ENFORCEMENT: Only show milestones that:
// 1. Belong to this project (projectId match)
// 2. Fall within project date boundaries
const existing = Array.isArray(milestones) ? milestones.filter(m =>
  m.projectId === projectId &&
  m.dueDate >= projectStartDate &&
  m.dueDate <= projectEndDate
) : [];
```

**Dependency Update**:
```typescript
}, [milestones, projectId, localMilestones, isCreatingProject, localMilestonesState, projectStartDate, projectEndDate]);
```

#### Change 2: Validate Before Creation
**Location**: Add validation to milestone creation function

```typescript
// BEFORE creating a milestone
const handleAddMilestone = async (milestoneData: any) => {
  // INVARIANT 1: Must have project ID
  if (!milestoneData.project_id) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Milestone must belong to a project",
    });
    return;
  }

  // INVARIANT 2: Must be within project dates
  const milestoneDate = new Date(milestoneData.due_date);
  if (milestoneDate < projectStartDate || milestoneDate > projectEndDate) {
    toast({
      variant: "destructive",
      title: "Invalid Date",
      description: `Milestone must be between ${projectStartDate.toLocaleDateString()} and ${projectEndDate.toLocaleDateString()}`,
    });
    return;
  }

  // Validation passed, create milestone
  await addMilestone(milestoneData);
};
```

#### Change 3: Date Picker Constraints
**Location**: Milestone date input component

```typescript
<input
  type="date"
  min={projectStartDate.toISOString().split('T')[0]}
  max={projectEndDate.toISOString().split('T')[0]}
  value={milestoneDate}
  onChange={(e) => {
    const newDate = new Date(e.target.value);
    // Additional runtime validation
    if (newDate >= projectStartDate && newDate <= projectEndDate) {
      setMilestoneDate(e.target.value);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Date",
        description: "Milestone must be within project date range",
      });
    }
  }}
/>
```

**File**: `src/hooks/useMilestones.ts`

#### Change 4: Server-Side Validation
**Location**: Lines ~80-130 (addMilestone function)

```typescript
const addMilestone = async (milestoneData: Omit<MilestoneInsert, 'user_id'>, options: { silent?: boolean } = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // INVARIANT VALIDATION: Fetch project to validate milestone
    const { data: project } = await supabase
      .from('projects')
      .select('id, start_date, end_date, continuous')
      .eq('id', milestoneData.project_id)
      .single();

    if (!project) {
      throw new Error('Project not found - cannot create orphaned milestone');
    }

    // INVARIANT 2: Validate date boundaries
    const milestoneDate = new Date(milestoneData.due_date);
    const projectStart = new Date(project.start_date);
    const projectEnd = new Date(project.end_date);

    if (milestoneDate < projectStart) {
      throw new Error(`Milestone date (${milestoneDate.toLocaleDateString()}) is before project start (${projectStart.toLocaleDateString()})`);
    }

    if (!project.continuous && milestoneDate > projectEnd) {
      throw new Error(`Milestone date (${milestoneDate.toLocaleDateString()}) is after project end (${projectEnd.toLocaleDateString()})`);
    }

    // Calculate the next order index for this project
    const { data: existingMilestones } = await supabase
      .from('milestones')
      .select('due_date, order_index')
      .eq('project_id', milestoneData.project_id)
      .order('due_date', { ascending: true });

    // Use sequential numbering based on date order (0, 1, 2, ...)
    const nextOrderIndex = existingMilestones ? existingMilestones.length : 0;

    // Rest of insertion logic...
  } catch (error) {
    console.error('Milestone creation failed:', error);
    toast({
      variant: "destructive",
      title: "Error",
      description: error instanceof Error ? error.message : "Failed to create milestone",
    });
    throw error;
  }
};
```

### Testing Requirements
- ✅ Cannot create milestone without project ID
- ✅ Cannot create milestone before project start date
- ✅ Cannot create milestone after project end date (non-continuous)
- ✅ Date picker prevents selecting invalid dates
- ✅ Milestones outside project dates are hidden from modal
- ✅ No regression in existing functionality

## Phase 2: Add Recurring Milestone Support

### Business Logic: Recurring Milestones

**Purpose**: Represent repeating work patterns (e.g., weekly reviews, monthly reports).

**Key Behaviors:**
1. **One pattern definition** = Many occurrences over time
2. **Each occurrence** has the same time allocation
3. **Work segments** created before each occurrence date
4. **Occurrences** respect project date boundaries
5. **For continuous projects**: Occurrences generated as needed (don't pre-generate years of data)

**Example Use Cases:**
- "Weekly Review" - 20h every Wednesday
- "Monthly Report" - 8h on last Friday of each month
- "Daily Standup" - 0.5h every weekday

### Technical Implementation: Storage Strategy

**Storage Approach**: Template record with on-demand instance generation

**What's stored in database:**
```sql
-- ONE template record per recurring pattern
INSERT INTO milestones (
  name,                    -- "Weekly Review" (NO number suffix)
  is_recurring,            -- TRUE
  recurring_config,        -- { type: 'weekly', interval: 1, weeklyDayOfWeek: 3 }
  time_allocation_hours,   -- 20 (per occurrence)
  project_id,
  due_date                 -- Project start date (not actually used for display)
) VALUES (...);
```

**What's generated in memory:**
```typescript
// Virtual occurrences created on-the-fly when needed
const occurrences = [
  { date: '2025-01-08', hours: 20 },  // First Wednesday
  { date: '2025-01-15', hours: 20 },  // Second Wednesday
  { date: '2025-01-22', hours: 20 },  // Third Wednesday
  // ... generated as needed
];
```

**Benefits:**
- ✅ Minimal database storage (1 record vs hundreds)
- ✅ Fast queries and updates
- ✅ Easy pattern modifications
- ✅ Clean user experience
- ✅ Performance optimized (generate only what's visible/needed)

### Database Schema

**Columns already exist** - no migration needed:
```sql
-- milestones table (EXISTING COLUMNS)
is_recurring BOOLEAN DEFAULT FALSE
recurring_config JSONB

-- Example recurring_config values:
-- Daily: { "type": "daily", "interval": 1 }
-- Weekly: { "type": "weekly", "interval": 1, "weeklyDayOfWeek": 3 }
-- Monthly: { "type": "monthly", "interval": 1, "monthlyPattern": "date", "monthlyDate": 15 }
```

### Recurrence Pattern Structure

```typescript
interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;  // Every N days/weeks/months
  
  // For weekly patterns
  weeklyDayOfWeek?: number;  // 0-6 (Sunday-Saturday)
  
  // For monthly patterns
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;  // 1-31 for specific date
  monthlyWeekOfMonth?: number;  // 1-6 (1st, 2nd, 3rd, 4th, 2nd last, last)
  monthlyDayOfWeek?: number;  // 0-6 for day of week
}
```

### Generation Strategy: On-Demand Virtual Instances

**IMPLEMENTED in these files:**
- `src/components/projects/bar/ProjectMilestones.tsx` (timeline rendering)
- `src/services/calculations/dayEstimateCalculations.ts` (day estimates)
- `src/components/projects/modal/ProjectMilestoneSection.tsx` (modal detection)
- `src/services/orchestrators/ProjectMilestoneOrchestrator.ts` (template creation)
- `src/components/timeline/TimelineBar.tsx` (filtering for calculations)

**For Timeline Rendering** (ProjectMilestones.tsx):
```typescript
// 1. Find template milestone (isRecurring: true)
const templateMilestone = milestones.find(m => m.isRecurring === true);

// 2. Generate virtual occurrences on-the-fly (only in viewport)
if (templateMilestone && templateMilestone.recurringConfig) {
  const occurrences = generateRecurringOccurrences(
    templateMilestone,
    viewportStart,
    viewportEnd
  );
````

### Database Schema Changes

**IMPLEMENTED** (columns already exist):
```sql
-- Recurring milestone fields (ALREADY EXIST in schema)
-- is_recurring BOOLEAN DEFAULT FALSE
-- recurring_config JSONB

-- Example recurring_config structure:
{
  "type": "weekly",
  "interval": 1,
  "weeklyDayOfWeek": 3  -- Wednesday
}
```

**NO instance table needed** - instances are generated on-the-fly in memory.

### Why Template-Based vs. Pre-Generated Instances?

**OLD SYSTEM** (pre-generated instances):
- ❌ Creates numbered records: "Weekly Review 1", "Weekly Review 2", etc.
- ❌ Database bloat (hundreds of records for one pattern)
- ❌ Performance issues (querying/filtering many records)
- ❌ Update complexity (changing pattern requires updating all instances)
- ❌ User confusion (sees many individual milestones)

**NEW SYSTEM** (template-based):
- ✅ One template record per pattern
- ✅ Minimal database footprint
- ✅ Fast queries (one record, not hundreds)
- ✅ Easy updates (change template, regenerate instances)
- ✅ Clean UI (one recurring milestone panel)

### Recurrence Pattern Structure

```typescript
interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;  // Every N days/weeks/months
  
  // For weekly patterns
  weeklyDayOfWeek?: number;  // 0-6 (Sunday-Saturday)
  
  // For monthly patterns
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;  // 1-31 for specific date
  monthlyWeekOfMonth?: number;  // 1-6 (1st, 2nd, 3rd, 4th, 2nd last, last)
  monthlyDayOfWeek?: number;  // 0-6 for day of week
}
```

### Generation Strategy: On-The-Fly Virtual Instances

**IMPLEMENTED in these files:**
- `src/components/projects/bar/ProjectMilestones.tsx` (timeline rendering)
- `src/services/calculations/dayEstimateCalculations.ts` (day estimates)
- `src/components/projects/modal/ProjectMilestoneSection.tsx` (modal detection)
- `src/services/orchestrators/ProjectMilestoneOrchestrator.ts` (template creation)

**For Timeline Rendering** (ProjectMilestones.tsx):
```typescript
// 1. Find template milestone (isRecurring: true)
const templateMilestone = milestones.find(m => m.isRecurring === true);

// 2. Generate virtual occurrences on-the-fly (only in viewport)
if (templateMilestone && templateMilestone.recurringConfig) {
  const occurrences = generateRecurringOccurrences(
    templateMilestone,
    viewportStart,
    viewportEnd
  );
  
  // 3. Create virtual milestone objects for rendering
  occurrences.forEach((date, index) => {
    virtualMilestones.push({
      ...templateMilestone,
      id: `${templateMilestone.id}-occurrence-${index}`,
      dueDate: date,
      endDate: date,
      isRecurring: true
    });
  });
}

// 4. Render markers (virtual milestones look identical to regular ones)
```

**For Day Estimate Calculations** (dayEstimateCalculations.ts):
```typescript
// Generate all occurrences within project date range
function generateRecurringOccurrences(
  milestone: Milestone,
  projectStartDate: Date,
  projectEndDate: Date,
  projectContinuous: boolean
): Date[] {
  const config = milestone.recurringConfig;
  const occurrences: Date[] = [];
  
  // Start from project start date
  let current = new Date(projectStartDate);
  
  // For weekly: Find first occurrence of target day (e.g., first Wednesday)
  if (config.type === 'weekly' && config.weeklyDayOfWeek !== undefined) {
    const targetDay = config.weeklyDayOfWeek;
    const projectStartDay = current.getDay();
    const daysUntilFirst = targetDay >= projectStartDay
      ? targetDay - projectStartDay
      : 7 - projectStartDay + targetDay;
    current.setDate(current.getDate() + daysUntilFirst);
  }
  
  // Generate occurrences by adding interval
  const endLimit = projectContinuous 
    ? addYears(current, 1)  // 1 year for continuous
    : projectEndDate;
  
  while (current <= endLimit && occurrences.length < 100) {
    occurrences.push(new Date(current));
    
    // Add interval
    switch (config.type) {
      case 'daily':
        current.setDate(current.getDate() + config.interval);
        break;
      case 'weekly':
        current.setDate(current.getDate() + (7 * config.interval));
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + config.interval);
        break;
    }
  }
  
  return occurrences;
}
```

### Creating a Recurring Milestone (Template-Based)

**IMPLEMENTED in:** `src/services/orchestrators/ProjectMilestoneOrchestrator.ts`

```typescript
// User configures pattern in modal
const recurringConfig = {
  name: "Weekly Review",
  timeAllocation: 20,  // 20 hours per occurrence
  recurringType: 'weekly',
  recurringInterval: 1,  // Every 1 week
  weeklyDayOfWeek: 3     // Wednesday
};

// Create SINGLE template milestone (not numbered instances)
const templateMilestone = await createRecurringMilestone(projectId, recurringConfig);
// Result in database:
// {
//   id: "uuid-123",
//   name: "Weekly Review",           // No "1" suffix
//   project_id: "project-uuid",
//   is_recurring: true,               // Template flag
//   recurring_config: {               // Pattern definition
//     type: "weekly",
//     interval: 1,
//     weeklyDayOfWeek: 3
//   },
//   time_allocation_hours: 20,
//   due_date: project.startDate       // Not used for rendering
// }
```

### Hybrid System: Old + New Milestones

**Current Reality**: Database may contain BOTH:
- OLD numbered instances: "Weekly Review 1", "Weekly Review 2", etc.
- NEW template milestone: "Weekly Review" (is_recurring: true)

**Filtering Strategy** (prevents double-counting):

**In Timeline Calculations** (TimelineBar.tsx):
```typescript
// Filter milestones before calculating day estimates
let projectMilestones = milestones.filter(m => m.projectId === project.id);

// If template milestone exists, exclude old numbered instances
const hasTemplateMilestone = projectMilestones.some(m => m.isRecurring === true);
if (hasTemplateMilestone) {
  projectMilestones = projectMilestones.filter(m => 
    // Keep template milestones
    m.isRecurring === true ||
    // Keep regular milestones (not numbered)
    (!m.isRecurring && (!m.name || !/\s\d+$/.test(m.name)))
  );
}
```

**In Modal Display** (ProjectMilestoneSection.tsx):
```typescript
// Filter milestone cards
projectMilestones.filter(milestone => {
  // Exclude template milestone (shown in recurring panel)
  if (milestone.isRecurring) return false;
  
  // Exclude old numbered instances
  if (milestone.name && /\s\d+$/.test(milestone.name)) return false;
  
  return true; // Show regular milestones only
});
```

**In Timeline Rendering** (ProjectMilestones.tsx):
```typescript
// Already filters out numbered instances and generates from template
```

**Phase 0 Cleanup** will delete old numbered instances permanently.

## Phase 3: Remove order_index (Future Phase)

### Migration Strategy
**Goal**: Remove the redundant `order_index` field entirely and use pure date-driven ordering.

**Why**: 
- `order_index` duplicates what dates already provide
- Creates maintenance burden (normalization needed)
- User's mental model: milestones are date segments, not numbered items

### The Date-Driven System

**Core Rules**:
1. Milestones are **always sorted by dueDate** ascending
2. No explicit order field exists
3. Movement validation ensures dates stay between adjacent milestones
4. "Order" is implicit - it's just the chronological sequence

### Database Changes

```sql
-- Remove order_index column (after full migration)
ALTER TABLE milestones DROP COLUMN order_index;

-- Ensure date index exists for efficient sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_milestones_project_due_date
ON milestones(project_id, due_date);
```

### Code Changes for Date-Driven Sorting

**File**: `src/hooks/useMilestones.ts`

Remove all order_index references:

```typescript
// BEFORE (Current):
const { data, error } = await supabase
  .from('milestones')
  .select('*')
  .eq('project_id', projectId)
  .order('due_date', { ascending: true })
  .order('order_index', { ascending: true }); // ❌ Remove this

// AFTER (New):
const { data, error } = await supabase
  .from('milestones')
  .select('*')
  .eq('project_id', projectId)
  .order('due_date', { ascending: true }); // ✅ Date is the only order
```

**Remove normalization function entirely**:
```typescript
// ❌ DELETE THIS - no longer needed
const normalizeMilestoneOrders = async (projectId?: string) => {
  // ... entire function
};
```

**File**: `src/components/projects/modal/ProjectMilestoneSection.tsx`

Replace order-based logic with date-based logic:

```typescript
// BEFORE: Sort by order
const sortedMilestones = [...projectMilestones].sort((a, b) => a.order - b.order);

// AFTER: Sort by date (which IS the order)
const sortedMilestones = [...projectMilestones].sort((a, b) => 
  new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
);
```

### Milestone Movement Validation

**New validation logic** for date-constrained movement:

```typescript
/**
 * Calculate valid date range for milestone movement
 * Milestones cannot cross each other - they are date segments
 */
function getValidMovementRange(
  milestone: Milestone,
  allMilestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): { minDate: Date; maxDate: Date } {
  // Sort all milestones by date
  const sorted = allMilestones
    .filter(m => m.id !== milestone.id)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  
  // Find adjacent milestones
  const previousMilestone = sorted
    .filter(m => m.dueDate < milestone.dueDate)
    .pop();
  
  const nextMilestone = sorted
    .find(m => m.dueDate > milestone.dueDate);
  
  // Calculate range
  const minDate = previousMilestone 
    ? addDays(previousMilestone.dueDate, 1)  // Day after previous
    : addDays(projectStartDate, 1);           // Day after project start
  
  const maxDate = nextMilestone
    ? addDays(nextMilestone.dueDate, -1)     // Day before next
    : addDays(projectEndDate, -1);           // Day before project end
  
  return { minDate, maxDate };
}

/**
 * Validate milestone date doesn't cross adjacent milestones
 */
function validateMilestoneDate(
  newDate: Date,
  milestone: Milestone,
  allMilestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): { isValid: boolean; error?: string } {
  const { minDate, maxDate } = getValidMovementRange(
    milestone, 
    allMilestones, 
    projectStartDate, 
    projectEndDate
  );
  
  if (newDate < minDate) {
    return { 
      isValid: false, 
      error: `Milestone cannot be before ${formatDate(minDate)}` 
    };
  }
  
  if (newDate > maxDate) {
    return { 
      isValid: false, 
      error: `Milestone cannot be after ${formatDate(maxDate)}` 
    };
  }
  
  return { isValid: true };
}
```

### TypeScript Interface Updates

**File**: `src/types/core.ts`

Remove order field:

```typescript
// BEFORE:
interface Milestone {
  id: string;
  name: string;
  projectId: string;
  dueDate: Date;
  timeAllocation?: number;
  order: number; // ❌ Remove this entirely
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

// AFTER:
interface Milestone {
  id: string;
  name: string;
  projectId: string;
  dueDate: Date;  // ✅ This IS the order
  timeAllocation?: number;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}
```

### Milestone Creation Logic

**Simplified default date assignment**:

```typescript
/**
 * Calculate default date for new milestone
 * Place it after the last existing milestone
 */
function getDefaultMilestoneDate(
  existingMilestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): Date {
  if (existingMilestones.length === 0) {
    // First milestone: day after project start
    return addDays(projectStartDate, 1);
  }
  
  // Find last milestone by date
  const sorted = [...existingMilestones]
    .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  
  const lastMilestone = sorted[0];
  const dayAfterLast = addDays(lastMilestone.dueDate, 1);
  
  // Ensure it's before project end
  const dayBeforeEnd = addDays(projectEndDate, -1);
  
  return dayAfterLast <= dayBeforeEnd ? dayAfterLast : dayBeforeEnd;
}

// Usage:
const newMilestone = {
  name: 'New Milestone',
  dueDate: getDefaultMilestoneDate(milestones, projectStartDate, projectEndDate),
  // No order field needed!
};
```

### Benefits of Date-Driven System

1. **Simpler**: No normalization logic needed
2. **More Reliable**: Single source of truth (dates)
3. **User-Friendly**: Matches mental model (date segments)
4. **Less Code**: Remove ~200 lines of order management
5. **Fewer Bugs**: No synchronization issues between order and date

## Phase 4: UI Updates for Recurring Milestones

### New Components Needed

1. **RecurringMilestoneConfig**: Modal for setting up recurrence patterns
2. **RecurringMilestoneCard**: Special display for recurring milestone templates
3. **MilestoneInstanceList**: Show generated instances for recurring milestones

### Updated Components

**File**: `src/components/projects/modal/ProjectMilestoneSection.tsx`

Add recurring milestone creation UI:

```typescript
// Add button for recurring milestones
<Button variant="outline" onClick={handleCreateRecurringMilestone}>
  <RotateCcw className="w-4 h-4 mr-2" />
  Add Recurring Milestone
</Button>
```

## Testing Requirements

### Phase 1 Testing
- ✅ Milestones outside project dates are hidden
- ✅ Milestones within project dates are shown
- ✅ No regression in existing functionality

### Phase 2 Testing
- ✅ Recurring milestones generate correct instances
- ✅ Performance doesn't degrade with many instances
- ✅ Continuous projects handle lazy loading correctly

### Phase 3 Testing
- ✅ Date-based sorting works correctly
- ✅ Migration preserves existing milestone order
- ✅ No data loss during order_index removal

## Backward Compatibility

### Phase 0: Data Cleanup
**Breaking Change**: Invalid milestones will be DELETED
- **Impact**: Milestones outside project boundaries removed from database
- **Mitigation**: These were already invisible to users (filtered in UI)
- **Safety**: Full audit log maintained in `milestone_cleanup_log` table
- **Rollback**: Can query audit log to see what was deleted

### Phase 1: Invariant Enforcement
**Breaking Change**: Can no longer create invalid milestones
- **Impact**: Forms will reject milestones outside project dates
- **Mitigation**: Clear error messages guide users
- **Safety**: Only prevents NEW invalid data, doesn't affect existing

### Phase 2 & 3: Recurring & Order Removal
- Keep `order_index` during transition
- Support both ordering systems simultaneously
- Migrate users gradually

### Recovery from Phase 0 Cleanup

If you need to verify what was deleted:

```sql
-- View all deleted milestones with full context
SELECT 
  mcl.cleanup_date,
  mcl.milestone_name,
  mcl.project_name,
  mcl.milestone_due_date,
  mcl.project_start_date,
  mcl.project_end_date,
  mcl.violation_type,
  CASE mcl.violation_type
    WHEN 'ORPHANED' THEN 'Project was deleted'
    WHEN 'BEFORE_PROJECT_START' THEN 
      'Milestone ' || mcl.milestone_due_date || ' was before project start ' || mcl.project_start_date
    WHEN 'AFTER_PROJECT_END' THEN 
      'Milestone ' || mcl.milestone_due_date || ' was after project end ' || mcl.project_end_date
  END AS reason
FROM milestone_cleanup_log mcl
ORDER BY mcl.cleanup_date DESC;

-- Count deletions by violation type
SELECT 
  violation_type,
  COUNT(*) as count
FROM milestone_cleanup_log
GROUP BY violation_type;
```

## Performance Considerations

### Recurring Milestones
- **Finite Projects**: Pre-generate all instances
- **Continuous Projects**: Generate next 30 days, lazy load more
- **Limit**: Maximum 1000 instances per recurring milestone

### Database Indexes
```sql
-- Ensure these indexes exist
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_milestones_project_due_date
ON milestones(project_id, due_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_milestone_instances_milestone_date
ON milestone_instances(milestone_id, instance_date);
```

## Rollback Plan

### Phase 1 Rollback
- Revert the date filtering change
- Milestones will show outside project boundaries again

### Phase 2 Rollback
- Remove recurring fields from database
- Delete milestone_instances table
- Remove recurring UI components

### Phase 3 Rollback
- Restore order_index usage
- Keep date-based sorting as fallback

## Implementation Order

1. **Phase 0** (FIRST): Run database cleanup migration to fix existing bad data
2. **Phase 1** (Today): Enforce invariants in UI and service layer
3. **Phase 2** (This Week): Add recurring milestone support
4. **Phase 3** (Next Sprint): Remove order_index, implement date-driven system
5. **Phase 4** (Following Sprint): UI enhancements for recurring milestones

## Success Criteria

- ✅ **Phase 0**: All milestones have valid project_id and dates within project boundaries
- ✅ **Phase 1**: Impossible to create invalid milestones through UI or API
- ✅ **Phase 2**: Recurring milestones work without performance issues
- ✅ **Phase 3**: Date-driven ordering is simpler and more reliable
- ✅ **Phase 4**: Full recurring milestone UI with pattern configuration
- ✅ **System**: No orphaned milestones exist
- ✅ **System**: All milestones respect project date boundaries
- ✅ **System**: No data loss during migration

## FAQ: Handling Invalid Milestone Data

### Q: What happens to milestone #1010 and other milestones outside project boundaries?
**A**: They will be **DELETED**. Here's why:
- If there are 1000+ milestones outside a project's date range, they're data corruption, not valid user data
- Milestone #1010 with an absurd order_index is a symptom of the old bug creating invalid records
- The Phase 0 cleanup will:
  1. Identify all milestones outside their project's boundaries
  2. Log them to `milestone_cleanup_log` table for audit trail
  3. **DELETE them** (cleaner than trying to move thousands of corrupt records)
  4. Recalculate order_index for remaining VALID milestones

### Q: Won't deleting milestones lose user data?
**A**: No, because:
- Milestones outside project boundaries are **already invisible** to users (after our TimelineBar fix)
- They were created by a bug, not by user intention
- We maintain a full audit log in `milestone_cleanup_log` for recovery if needed
- Valid milestones (within project dates) are preserved

### Q: What if we need to recover a deleted milestone?
**A**: The cleanup creates an audit log:
```sql
-- View all deleted milestones
SELECT * FROM milestone_cleanup_log WHERE action = 'DELETED';

-- Recover a specific milestone (if needed)
-- You'd need to manually verify it should exist and adjust its date
```

### Q: How do we prevent this from happening again?
**A**: Multi-layer enforcement:
1. **Database**: Foreign key constraints (CASCADE DELETE)
2. **Database**: NOT NULL constraint on due_date
3. **Domain Layer**: MilestoneRules validation
4. **Service Layer**: Validation before insert/update (Phase 1)
5. **UI Layer**: Date picker constraints, form validation (Phase 1)
6. **Timeline**: Filter milestones before rendering (already done)

### Q: What if a project's dates change after milestones exist?
**A**: We need to handle this in Phase 1:

```typescript
// When updating project dates
const handleProjectDateUpdate = async (
  projectId: string, 
  newStartDate: Date, 
  newEndDate: Date
) => {
  // Get all project milestones
  const milestones = await fetchMilestones(projectId);
  
  // Check which milestones would fall outside new range
  const affectedMilestones = milestones.filter(m => 
    m.dueDate < newStartDate || m.dueDate > newEndDate
  );
  
  if (affectedMilestones.length > 0) {
    // PREVENT the change and warn user
    showWarning(
      `Cannot change project dates: ${affectedMilestones.length} milestone(s) ` +
      `would fall outside the new date range. Please adjust or delete these ` +
      `milestones first:\n` +
      affectedMilestones.map(m => `- ${m.name} (${m.dueDate.toLocaleDateString()})`).join('\n')
    );
    return false;
  }
  
  // Safe to update
  await updateProject(projectId, { 
    startDate: newStartDate, 
    endDate: newEndDate 
  });
  return true;
};
```

**Decision**: Prevent project date changes that would invalidate existing milestones. This respects the user's milestone dates and prevents data corruption.

### Q: What's the execution plan for cleanup?

**Phase 0 Cleanup Steps**:
1. ✅ Identify invalid milestones (orphaned, out-of-bounds)
2. ✅ Create audit log table
3. ✅ Log all milestones that will be deleted
4. ✅ **DELETE all invalid milestones**
5. ✅ Recalculate order_index for remaining valid milestones
6. ✅ Add database constraints (foreign keys, NOT NULL)
7. ✅ Verify no invalid milestones remain

**Expected Results**:
- "Old Project" milestone 1010: DELETED (outside project dates)
- Valid milestones: Renumbered with correct order_index (0, 1, 2...)
- Future corruption: IMPOSSIBLE (constraints prevent it)

### Q: Where is this enforced in the code right now?
**Current Status** (After our fixes today):

**✅ FULLY IMPLEMENTED:**
- `RelationshipRules.validateMilestoneBelongsToProject()` - Domain layer validation
- `MilestoneRules.validateMilestoneDateWithinProject()` - Date validation
- `MilestoneRules.calculateTotalAllocation()` - Budget calculations (uses timeAllocationHours)
- `TimelineBar.tsx` (Lines 127-150, 207-227) - Filters milestones by project, dates, AND templates
- `dayEstimateCalculations.ts` (Lines 218-295) - Generates recurring occurrences from template
- `ProjectMilestones.tsx` (Lines 48-162) - Renders virtual milestones from template
- `ProjectMilestoneSection.tsx` (Lines 514-577) - Detects template milestone, filters display
- `ProjectMilestoneOrchestrator.ts` (Lines 193-308) - Creates ONE template (not numbered instances)

**❌ NEEDS IMPLEMENTATION:**
- Database constraints - Missing (NEEDS Phase 0 migration)
- `useMilestones.addMilestone()` - Missing validation (NEEDS Phase 1 fix)
- `ProjectMilestoneSection.tsx` - Missing date picker constraints (NEEDS Phase 1 fix)
- Project date update validation - Missing (NEEDS Phase 1 fix)

**After Full Migration**:
- ✅ All layers will enforce invariants
- ✅ Invalid data cleaned up (DELETED, not moved)
- ✅ Impossible to create invalid milestones
- ✅ Impossible to change project dates that would invalidate milestones
- ✅ Audit trail of all cleanup actions

### Q: How does the template-based system handle day estimates?

**A**: Day estimates work exactly like regular milestones, but with generated occurrences:

**Regular Milestone:**
```typescript
// One milestone creates ONE segment of work
Milestone: "Launch Feature" @ May 20, 20 hours
→ Segment: previous milestone (or project start) → May 20
→ Distribute 20h across working days in segment
```

**Recurring Template Milestone:**
```typescript
// One template creates MULTIPLE segments of work
Template: "Weekly Review" @ every Wednesday, 20 hours
→ Generate occurrences: Aug 7, Aug 14, Aug 21, Aug 28...
→ For EACH occurrence:
   - Create segment: previous week → this Wednesday
   - Distribute 20h across working days in that week's segment
```

**Implementation:**
```typescript
// In dayEstimateCalculations.ts
if (milestone.isRecurring && milestone.recurringConfig) {
  // Generate all occurrence dates
  const occurrences = generateRecurringOccurrences(milestone, projectStart, projectEnd);
  
  // For EACH occurrence, create day estimates
  occurrences.forEach(occurrenceDate => {
    // Calculate work period for this occurrence
    const occurrenceEndDate = occurrenceDate;
    const occurrenceStartDate = subtractDays(occurrenceDate, intervalDays);
    
    // Get working days in this occurrence's segment
    const workingDays = getWorkingDaysBetween(
      occurrenceStartDate,
      occurrenceEndDate,
      settings,
      holidays,
      project
    );
    
    // Distribute hours across working days
    const hoursPerDay = milestone.timeAllocationHours / workingDays.length;
    workingDays.forEach(date => {
      estimates.push({
        date,
        projectId: project.id,
        hours: hoursPerDay,
        source: 'milestone-allocation',
        milestoneId: milestone.id
      });
    });
  });
}
```

**Result**: Timeline bars show correct heights for recurring work, distributed across working days just like regular milestones.

### Q: What's the difference between regular and recurring milestones for budget?

**A**: Both count toward project budget, calculated the same way:

**Regular Milestones:**
```typescript
// Total = sum of all milestone allocations
Milestone 1: 40h
Milestone 2: 30h
Total: 70h
```

**Recurring Template:**
```typescript
// Total = allocation × number of occurrences
Template: 20h per week, 10 weeks
Total: 200h (20h × 10)
```

**Combined:**
```typescript
// Budget check includes BOTH
Regular Milestones: 70h
Recurring Total: 200h
Total Allocated: 270h

// Compare to project budget
Project Budget: 300h
Remaining: 30h
```

**Implementation** (ProjectMilestoneSection.tsx):
```typescript
// Calculate budget analysis
const budgetAnalysis = useMemo(() => {
  // Regular milestones (exclude template and numbered instances)
  const nonRecurringMilestones = projectMilestones.filter(m => {
    if (m.isRecurring) return false;           // Exclude template
    if (m.name && /\s\d+$/.test(m.name)) return false;  // Exclude old numbered
    return true;
  });
  
  const regularTotal = nonRecurringMilestones.reduce(
    (sum, m) => sum + m.timeAllocation, 
    0
  );
  
  // Recurring total (calculated from pattern)
  const recurringTotal = recurringMilestone 
    ? calculateRecurringTotalAllocation(recurringMilestone)
    : 0;
  
  // Combined total
  const totalAllocated = regularTotal + recurringTotal;
  const remainingBudget = projectEstimatedHours - totalAllocated;
  
  return {
    totalAllocated,
    remainingBudget,
    isOverBudget: totalAllocated > projectEstimatedHours
  };
}, [projectMilestones, recurringMilestone, projectEstimatedHours]);
```

## Success Criteria
