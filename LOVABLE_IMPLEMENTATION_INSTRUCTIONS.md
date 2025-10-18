# Instructions for Lovable: Timeline Architecture Implementation

## 🎯 Context

The database migration is complete (2,364 milestones migrated successfully). Now we need to implement the code changes to use the new schema and fix the timeline rendering bugs.

## 📚 Required Reading

**Please review these files IN ORDER before starting:**

1. **`TIMELINE_ARCHITECTURE_REFACTOR.md`** - Full architecture plan and rationale
2. **`IMPLEMENTATION_READY.md`** - Phase-by-phase implementation guide
3. **`MIGRATION_EXECUTION_LOG.md`** - Confirmation that database is ready

**Key sections to understand:**
- The 4-layer architecture: Project → Milestones → Day Estimates → Rendering
- Why we need a single source of truth for timeline calculations
- The problems we're solving (weeks view ≠ days view, milestones not appearing)

---

## 🎯 Implementation Request

Please implement **Phases 1-6** as documented in `IMPLEMENTATION_READY.md`.

I'll provide the detailed requirements for each phase below.

---

## Phase 1: Update Type Definitions (30 minutes)

**File to edit:** `src/types/core.ts`

### Changes Required:

#### 1. Update `Milestone` interface

**Current:**
```typescript
export interface Milestone {
  id: string;
  name: string;
  dueDate: Date;
  timeAllocation: number; // ← OLD: This is confusing (percentage? hours?)
  projectId: string;
  order: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Update to:**
```typescript
export interface Milestone {
  id: string;
  name: string;
  projectId: string;
  
  // TIME ALLOCATION (portion of project budget)
  timeAllocationHours: number; // Changed from timeAllocation - now explicitly hours
  
  // DATE BOUNDARIES
  startDate?: Date; // New: auto-calculated or explicit start date
  endDate: Date; // Renamed from dueDate for consistency
  
  // RECURRING PATTERN (if applicable)
  isRecurring: boolean; // New: flag for recurring milestones
  recurringConfig?: RecurringConfig; // New: pattern configuration
  
  // METADATA
  order: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 2. Add `RecurringConfig` interface

**Add this NEW interface:**
```typescript
export interface RecurringConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number; // Every X days/weeks/months
  
  // Weekly pattern options
  weeklyDayOfWeek?: number; // 0-6 (Sunday-Saturday)
  
  // Monthly pattern options
  monthlyPattern?: 'date' | 'dayOfWeek'; // Pattern type
  monthlyDate?: number; // 1-31 for specific date
  monthlyWeekOfMonth?: number; // 1-4 for which week
  monthlyDayOfWeek?: number; // 0-6 for day of week
}
```

#### 3. Add `DayEstimate` interface

**Add this NEW interface:**
```typescript
export interface DayEstimate {
  date: Date;
  projectId: string;
  hours: number; // How many hours on this specific day
  source: 'planned-event' | 'milestone-allocation' | 'project-auto-estimate';
  milestoneId?: string; // If from a milestone
  isWorkingDay: boolean;
}
```

**Important:** 
- Don't break existing code - add new types alongside old ones
- The `Milestone` interface changes are additive (new fields) except for the rename
- We'll handle the `dueDate` → `endDate` rename carefully in the repository layer

---

## Phase 2: Create Day Estimate Calculations (2 hours)

**New file:** `src/services/calculations/dayEstimateCalculations.ts`

This becomes the **SINGLE SOURCE OF TRUTH** for timeline rectangles.

### Key Functions to Implement:

#### 1. Main calculation function

```typescript
/**
 * Calculate day-level time estimates for a project
 * This is the SINGLE SOURCE OF TRUTH for timeline rectangles
 * 
 * PRIORITY ORDER:
 * 1. Planned events (from calendar) → always show
 * 2. Milestone allocation → if milestone covers this date
 * 3. Project auto-estimate → fallback if no milestone
 */
export function calculateProjectDayEstimates(
  project: Project,
  milestones: Milestone[],
  events: CalendarEvent[],
  settings: Settings,
  holidays: Holiday[]
): DayEstimate[] {
  // Implementation details in IMPLEMENTATION_READY.md
  // See "Phase 2: Day Estimate Calculations" section
}
```

#### 2. Helper functions

```typescript
/**
 * Find which milestone (if any) covers a specific date
 */
function findMilestoneForDate(
  date: Date, 
  milestones: Milestone[],
  projectStartDate: Date
): Milestone | null

/**
 * Calculate hours for a specific day within a milestone
 * Distributes milestone hours across working days in the milestone period
 */
function calculateMilestoneSegmentHours(
  milestone: Milestone,
  date: Date,
  settings: Settings,
  holidays: Holiday[]
): number

/**
 * Calculate project auto-estimate hours for a specific day
 * Distributes project hours across all working days
 */
function calculateProjectAutoEstimateHours(
  project: Project,
  date: Date,
  settings: Settings,
  holidays: Holiday[]
): number
```

**Key Logic:**
- Use existing functions from `milestoneCalculations.ts` and `projectCalculations.ts`
- Respect `project.autoEstimateDays` settings (which days to show rectangles)
- Check holidays and work hours
- Planned events ALWAYS show (override auto-estimate)

---

## Phase 3: Create Unified Day Estimate Service (1 hour)

**New file:** `src/services/unified/UnifiedDayEstimateService.ts`

Wraps the calculations with business logic and validation.

```typescript
/**
 * Unified Day Estimate Service
 * Business logic for day-level time distribution
 */
export class UnifiedDayEstimateService {
  /**
   * Get day estimates for a project (with caching)
   */
  static getDayEstimates(
    project: Project,
    milestones: Milestone[],
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ): DayEstimate[] {
    // Delegates to calculateProjectDayEstimates
    return calculateProjectDayEstimates(
      project, 
      milestones, 
      events, 
      settings, 
      holidays
    );
  }
  
  /**
   * Validate milestone allocations don't exceed project budget
   */
  static validateMilestoneAllocations(
    milestones: Milestone[],
    projectEstimatedHours: number
  ): {
    isValid: boolean;
    totalAllocated: number;
    remaining: number;
    overageHours: number;
  } {
    const totalAllocated = milestones.reduce(
      (sum, m) => sum + m.timeAllocationHours, 
      0
    );
    
    return {
      isValid: totalAllocated <= projectEstimatedHours,
      totalAllocated,
      remaining: projectEstimatedHours - totalAllocated,
      overageHours: Math.max(0, totalAllocated - projectEstimatedHours)
    };
  }
  
  /**
   * Get estimates for a specific date range (optimization)
   */
  static getDayEstimatesForRange(
    project: Project,
    milestones: Milestone[],
    startDate: Date,
    endDate: Date,
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ): DayEstimate[] {
    const allEstimates = this.getDayEstimates(
      project, 
      milestones, 
      events, 
      settings, 
      holidays
    );
    
    return allEstimates.filter(
      est => est.date >= startDate && est.date <= endDate
    );
  }
}
```

---

## Phase 4: Create Timeline Orchestrator (1 hour)

**New file:** `src/services/orchestrators/TimelineOrchestrator.ts`

This is what the timeline components will call - ONE method, ONE source of truth.

```typescript
/**
 * Timeline Orchestrator
 * Prepares all data needed for timeline rendering
 */
export class TimelineOrchestrator {
  /**
   * Get complete timeline data for rendering
   * This is what TimelineBar.tsx and WeeksView.tsx call
   * 
   * SINGLE SOURCE OF TRUTH for timeline display
   */
  static async getTimelineData(
    projects: Project[],
    dateRange: { start: Date; end: Date },
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ): Promise<{
    projectData: Array<{
      project: Project;
      milestones: Milestone[];
      dayEstimates: DayEstimate[];
    }>;
  }> {
    const projectData = await Promise.all(
      projects.map(async (project) => {
        // Get milestones from repository
        const milestones = await MilestoneRepository.getByProjectId(project.id);
        
        // Calculate day estimates (single source of truth)
        const dayEstimates = UnifiedDayEstimateService.getDayEstimatesForRange(
          project,
          milestones,
          dateRange.start,
          dateRange.end,
          events,
          settings,
          holidays
        );
        
        return {
          project,
          milestones,
          dayEstimates
        };
      })
    );
    
    return { projectData };
  }
}
```

---

## Phase 5: Update Milestone Repository (1 hour)

**File to edit:** `src/services/repositories/MilestoneRepository.ts`

### Changes Required:

Update all CRUD operations to map the new database columns:

```typescript
// In toMilestone() method - add mappings:
timeAllocationHours: row.time_allocation_hours ?? row.time_allocation, // NEW: Use new column, fallback to old
startDate: row.start_date ? new Date(row.start_date) : undefined, // NEW
endDate: new Date(row.due_date), // RENAMED from dueDate
isRecurring: row.is_recurring ?? false, // NEW
recurringConfig: row.recurring_config ? JSON.parse(row.recurring_config) : undefined, // NEW

// In toRow() method - add mappings:
time_allocation_hours: milestone.timeAllocationHours, // NEW: Write to new column
time_allocation: milestone.timeAllocationHours, // OLD: Also write to old column for backward compatibility
start_date: milestone.startDate?.toISOString(), // NEW
due_date: milestone.endDate.toISOString(), // Keep for backward compatibility
is_recurring: milestone.isRecurring, // NEW
recurring_config: milestone.recurringConfig ? JSON.stringify(milestone.recurringConfig) : null, // NEW
```

**Important:** Dual-write strategy:
- Write to BOTH `time_allocation` (old) and `time_allocation_hours` (new)
- Read from `time_allocation_hours` first, fallback to `time_allocation`
- This maintains backward compatibility during transition

---

## Phase 6: Update Timeline Components (2 hours)

### File 1: `src/components/timeline/TimelineBar.tsx`

**Current problem:** Multiple sources of truth, inconsistent data

**Current code (WRONG):**
```typescript
// Multiple calls, different results
const timeAllocation = memoizedGetProjectTimeAllocation(...)
const allocation = TimeAllocationService.generateTimeAllocation(...)
// Comment in code: "Don't use TimeAllocationService - returns wrong values!"
```

**New code (CORRECT):**
```typescript
// Single source of truth
const { projectData } = await TimelineOrchestrator.getTimelineData(
  [project],
  { start: dates[0], end: dates[dates.length - 1] },
  events,
  settings,
  holidays
);

const dayEstimates = projectData[0]?.dayEstimates || [];

// For each date in timeline:
dates.map(date => {
  const estimate = dayEstimates.find(est => isSameDate(est.date, date));
  
  if (!estimate || estimate.hours === 0) {
    return <div key={date} />; // No rectangle
  }
  
  const height = estimate.hours * 4; // Height scaling
  const color = estimate.source === 'planned-event' ? 'blue' : 'gray';
  const completed = estimate.source === 'planned-event' && /* check if completed */;
  
  return (
    <Tooltip key={date}>
      <TooltipTrigger>
        <div style={{ height, backgroundColor: color }} />
      </TooltipTrigger>
      <TooltipContent>
        {estimate.hours}h - {estimate.source}
      </TooltipContent>
    </Tooltip>
  );
})
```

### File 2: `src/components/timeline/WeeksView.tsx` (if it exists)

**Apply the same pattern:**
- Replace all local calculations with `TimelineOrchestrator.getTimelineData()`
- Use the same `dayEstimates` data structure
- Result: Weeks view = Days view (same data source)

**Note:** If WeeksView doesn't exist or uses a different approach, let me know and we can adjust.

---

## Phase 7: Cleanup (Optional - can do later)

These can be done after testing:

1. **Delete deprecated services:**
   - `TimeAllocationOrchestrator.ts` (replaced by UnifiedDayEstimateService)
   - Remove `memoizedGetProjectTimeAllocation()` if no longer used

2. **Merge duplicate orchestrators:**
   - Merge `ProjectTimelineOrchestrator` → `ProjectOrchestrator`
   - Rename `ProjectMilestoneOrchestrator` → `MilestoneOrchestrator`

3. **Remove localStorage code:**
   - Delete recurring milestone localStorage reads/writes
   - All data now in database

---

## 🧪 Testing Checklist

After implementation, please verify:

- [ ] Project without milestones → gray auto-estimate rectangles appear
- [ ] Project with milestones → rectangles distributed across milestone periods
- [ ] Planned calendar event → blue rectangle overrides auto-estimate
- [ ] Recurring milestone → (will test after UI for creating them is updated)
- [ ] Weeks view shows SAME data as Days view
- [ ] Budget validation: Can't create milestones exceeding project hours
- [ ] Drag project → rectangles move correctly
- [ ] Tooltip shows correct hours and source

---

## ⚠️ Important Notes

### Backward Compatibility

**DO NOT BREAK:**
- Existing projects must continue working
- Old `timeAllocation` field must be supported during transition
- Write to BOTH old and new columns (dual-write)

**The dual-write strategy ensures:**
- Old code still works (reads `time_allocation`)
- New code works better (reads `time_allocation_hours`)
- No data loss during transition

### Database Schema

The database already has:
- ✅ `time_allocation_hours` column (numeric)
- ✅ `start_date` column (timestamp)
- ✅ `is_recurring` column (boolean)
- ✅ `recurring_config` column (jsonb)
- ✅ Old `time_allocation` column (preserved)

All 2,364 milestones migrated successfully.

### TypeScript Types

Supabase types already updated:
- ✅ `src/integrations/supabase/types.ts` has new columns
- ✅ Can access via `row.time_allocation_hours`, `row.start_date`, etc.

---

## 🎯 Success Criteria

**When implementation is complete:**

1. ✅ Timeline rectangles appear correctly for all projects
2. ✅ Milestones divide time allocation properly
3. ✅ Weeks view = Days view (same calculations)
4. ✅ No console errors about undefined fields
5. ✅ Tooltip shows source: "Planned time" or "Auto-estimate" or "Milestone allocation"
6. ✅ Drag operations still work
7. ✅ All existing tests pass

---

## 📞 Questions?

If you encounter issues:

1. **Type errors about `dueDate`:** 
   - Check MilestoneRepository - should map `due_date` → `endDate`
   - May need to update other files using `milestone.dueDate` → `milestone.endDate`

2. **Calculation not matching expected:**
   - Check that `calculateProjectDayEstimates()` follows priority order
   - Planned events should ALWAYS override auto-estimate

3. **Performance issues:**
   - DayEstimates are calculated on-demand (not stored)
   - Can add memoization/caching if needed

4. **Missing imports:**
   - Make sure to export new functions from barrel files (`index.ts`)

---

## 📚 Reference

All implementation details, code examples, and architecture reasoning are in:
- `TIMELINE_ARCHITECTURE_REFACTOR.md` (WHY)
- `IMPLEMENTATION_READY.md` (WHAT and HOW)
- This file (INSTRUCTIONS)

---

## 🚀 Ready to Start?

Please implement Phases 1-6 in order. Each phase builds on the previous one.

**Estimated time:** 7-8 hours total

**Priority:** High - this fixes critical timeline rendering bugs

Thank you!
