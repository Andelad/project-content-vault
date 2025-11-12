# Phase Domain Logic

**Created**: November 12, 2025  
**Status**: Active Domain Model

## Core Concept

Every **project** represents time work that needs to be completed. This work is divided into **phases**.

## Phase Definition

A **Phase** is a time period with:
- `startDate` - When the phase begins
- `endDate` - When the phase ends
- `timeAllocationHours` - Budget allocated to this phase (portion of project's total budget)

**Database Note**: Phases are stored in the `milestones` table with both `start_date` and `end_date` populated. This maintains backward compatibility while supporting the new phase model.

## Domain Rules

### Rule 1: Default Phase
**Every project is implicitly ONE phase covering the entire project duration**

- When a project is created, it conceptually has 1 phase: `[project.startDate → project.endDate]`
- Budget: `project.estimatedHours`
- This phase is implicit (not stored in database) until explicitly split

### Rule 2: Split Phases
**Split creates 2+ explicit phases that divide the project timeline**

- Clicking "Create Phases" button splits the project into 2 explicit phases
- Initial split: 50/50 budget allocation, 50/50 time duration
- First phase: `[project.startDate → midpoint]`
- Second phase: `[midpoint → project.endDate]`
- Additional phases can be added with "Add Phase" button
- Each phase gets a portion of the total budget
- Phases must be sequential (ordered by start date)
- Gaps between phases are allowed (representing planned pauses/breaks)

**Constraints**:
- First phase `startDate` = project `startDate` (fixed)
- Last phase `endDate` = project `endDate` (fixed)
- Middle phases can adjust their boundaries
- Phases cannot overlap (one phase's end ≤ next phase's start)
- Gaps between phases = pause time with no estimate allocated
- Sum of phase budgets should ≤ project total budget

### Rule 3: Recurring Template
**Recurring creates a SINGLE template that repeats throughout the project**

- Clicking "Recurring Estimate" button creates 1 template milestone
- Template has: pattern (daily/weekly/monthly), interval, time allocation per occurrence
- Database: Single record with `is_recurring=true` and `recurring_config` JSON
- Template expands dynamically at runtime (not stored as multiple records)
- Pattern repeats for entire project duration (including continuous projects)

**Example**: 
- Template: "Weekly Review", 10 hours, every Monday
- For 1-year project: Repeats ~52 times (calculated dynamically)
- Only 1 database record, not 52 records

### Rule 4: Mutual Exclusivity
**Projects can have split phases OR recurring template, NOT BOTH**

- Split phases = Multiple time periods with explicit start/end dates
- Recurring template = Single repeating pattern
- These are fundamentally different ways to divide project time
- UI shows warning when switching between modes
- Switching from one mode to another deletes existing phases/template

## Type System

```typescript
// Base type (database table: milestones)
interface Milestone {
  id: string;
  name: string;
  projectId: string;
  dueDate: Date;           // Backward compatibility
  endDate?: Date;          // NEW: Phase end date
  startDate?: Date;        // NEW: Phase start date
  timeAllocation: number;  // Backward compatibility  
  timeAllocationHours?: number; // NEW: Preferred field
  is_recurring?: boolean;  // NEW: Marks recurring template
  recurring_config?: {     // NEW: Pattern configuration
    type: 'daily' | 'weekly' | 'monthly';
    interval: number;
    // ... pattern-specific fields
  };
}

// Type guard
function isPhase(milestone: Milestone): milestone is Phase {
  return milestone.startDate !== undefined;
}

// Domain type
type Phase = Milestone & { startDate: Date };
```

## Implementation Files

- **Domain Rules**: `src/domain/rules/PhaseRules.ts`
- **UI Components**: 
  - `src/components/features/phases/PhaseCard.tsx` - Individual phase display
  - `src/components/features/phases/RecurringPhaseCard.tsx` - Recurring template display
  - `src/components/features/phases/PhaseConfigDialog.tsx` - Configuration dialogs
- **Orchestration**: `src/components/features/project/ProjectMilestoneSection.tsx`
- **Database**: `milestones` table (backward compatible)

## Terminology Update (November 2025)

We migrated from "milestone" to "phase" terminology:
- **UI**: Uses "phase" language
- **Code**: Variable names prefer "phase" but maintain "milestone" for database compatibility
- **Database**: Still uses `milestones` table name and some field names for backward compatibility
- **Types**: Use `Milestone` base type with `Phase` as specialized type

## Day Estimate Calculation

Phases are used to calculate daily time estimates:

1. **Split Phases**: Each phase's budget divided by its working days = daily estimate for that period
2. **Recurring Template**: Template's time allocation distributed across pattern occurrences
3. **Default (Implicit Phase)**: Project's total budget divided by total working days

This allows accurate capacity planning and prevents overbooking.

## Examples

### Example 1: Default Project (Implicit Phase)
```
Project: "Website Redesign"
Duration: Jan 1 - Mar 31 (90 days)
Budget: 180 hours

Implicit Phase:
├─ Start: Jan 1
├─ End: Mar 31  
├─ Budget: 180 hours
└─ Daily Estimate: 2 hours/day (180h / 90 days)
```

### Example 2: Split into Explicit Phases
```
Project: "Website Redesign"
Duration: Jan 1 - Mar 31 (90 days)
Budget: 180 hours

Phase 1: "Design"
├─ Start: Jan 1
├─ End: Feb 14 (45 days)
├─ Budget: 90 hours
└─ Daily Estimate: 2 hours/day

Phase 2: "Development"
├─ Start: Feb 15
├─ End: Mar 31 (45 days)
├─ Budget: 90 hours
└─ Daily Estimate: 2 hours/day
```

### Example 3: Recurring Template
```
Project: "Website Maintenance"
Duration: Jan 1 - Dec 31 (365 days)  
Budget: N/A (continuous)

Recurring Template: "Weekly Check-in"
├─ Pattern: Weekly, every Monday
├─ Time per occurrence: 3 hours
├─ Total occurrences: ~52 (calculated dynamically)
└─ Template stored as 1 database record

Runtime expansion for January:
- Mon Jan 6: 3 hours
- Mon Jan 13: 3 hours
- Mon Jan 20: 3 hours
- Mon Jan 27: 3 hours
```

## Migration Notes

This represents a conceptual shift:
- **Before**: Projects could have miscellaneous milestones (deadlines)
- **After**: Projects have phases (time periods) that structure the work

The database table name (`milestones`) remains for backward compatibility, but semantically we now think in terms of phases.
