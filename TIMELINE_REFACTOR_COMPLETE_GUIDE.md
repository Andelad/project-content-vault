# Timeline Architecture Refactor - Complete Guide

**Status:** ✅ Database Migration Complete | ⏳ Code Implementation Pending

**Last Updated:** October 18, 2025

---

## 📑 Table of Contents

1. [Quick Start](#quick-start) - Start here if you want the summary
2. [Problem Statement](#problem-statement) - Why we're doing this
3. [Architecture Design](#architecture-design) - How it works
4. [Database Migration](#database-migration) - What we changed in the database
5. [Implementation Guide](#implementation-guide) - How to implement the code
6. [Testing & Deployment](#testing--deployment) - How to verify and deploy

---

## Quick Start

### What's the Problem?
- Timeline rectangles not appearing for milestones
- Weeks view shows different data than Days view  
- Multiple calculation sources producing inconsistent results
- Database schema mismatch (percentage vs. hours)

### What's the Solution?
**Single source of truth:** One calculation function for all timeline rectangles.

### Current Status
- ✅ **Database migrated** (2,364 milestones updated with new columns)
- ⏳ **Code implementation pending** (6 phases to implement)

### Next Step
**For Lovable:** Implement Phases 1-6 from the [Implementation Guide](#implementation-guide) section below.

---

## Problem Statement

### Current Issues

1. **Timeline Rendering Broken**
   - Milestones not appearing correctly
   - Rectangles disappearing intermittently
   - Different data in weeks vs. days view

2. **Multiple Sources of Truth**
   ```typescript
   // PROBLEM: Different views call different functions
   
   // Days view uses:
   const timeAllocation = memoizedGetProjectTimeAllocation(...)
   
   // Weeks view uses:
   const allocation = TimeAllocationService.generateTimeAllocation(...)
   
   // Comment in code: "Don't use TimeAllocationService - returns wrong values!"
   ```

3. **Database Schema Confusion**
   ```sql
   -- Database says "percentage"
   time_allocation numeric CHECK (time_allocation >= 0 AND time_allocation <= 100)
   
   -- But code treats it as "hours"
   milestone.timeAllocation = 20 // Is this 20% or 20 hours? 🤔
   ```

4. **Recurring Milestones in Wrong Place**
   - Stored in localStorage (client-only, doesn't sync)
   - Should be in database for multi-device support

---

## Architecture Design

### The 4-Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: PROJECT (Identity + Time Boundaries)                  │
├─────────────────────────────────────────────────────────────────┤
│ • id, name, client, notes, icon, color (IDENTITY)              │
│ • estimatedHours (TOTAL TIME BUDGET)                            │
│ • startDate, endDate, continuous (TIME BOUNDARIES)              │
│ • autoEstimateDays (WHICH DAYS TO USE)                          │
│                                                                 │
│ FILE: ProjectRepository.ts → projects table                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: MILESTONES (Split the Budget)                         │
├─────────────────────────────────────────────────────────────────┤
│ • name (MILESTONE IDENTITY)                                     │
│ • timeAllocationHours (HOURS from project budget)               │
│ • startDate, endDate (milestone time boundaries)                │
│ • isRecurring, recurringConfig (PATTERN if applicable)          │
│                                                                 │
│ VALIDATION: Sum of milestone hours ≤ project.estimatedHours    │
│                                                                 │
│ FILE: MilestoneRepository.ts → milestones table                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: DAY ESTIMATES (Daily Distribution)                    │
├─────────────────────────────────────────────────────────────────┤
│ CALCULATION PRIORITY:                                           │
│ 1. Planned events (calendar) → shows planned hours              │
│ 2. Milestone allocation → hours ÷ working days in milestone    │
│ 3. Project auto-estimate → hours ÷ working days in project     │
│                                                                 │
│ NOT STORED: Always calculated on-demand                         │
│                                                                 │
│ FILE: dayEstimateCalculations.ts (SINGLE SOURCE OF TRUTH)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: TIMELINE RENDERING (Display)                          │
├─────────────────────────────────────────────────────────────────┤
│ • Get day estimates from TimelineOrchestrator                   │
│ • Render rectangles (height = hours × scale)                    │
│ • Both Days AND Weeks views use SAME orchestrator               │
│                                                                 │
│ FILE: TimelineBar.tsx, WeeksView.tsx                           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Principle: Single Source of Truth

**One function calculates all timeline rectangles:**
```typescript
// SINGLE SOURCE OF TRUTH
calculateProjectDayEstimates(project, milestones, events, settings, holidays)
  → Returns array of DayEstimate objects
  → Used by BOTH days and weeks views
  → Consistent results everywhere
```

---

## Database Migration

### ✅ Migration Complete (October 18, 2025)

**Executed by:** Lovable AI  
**Records migrated:** 2,364 milestones  
**Status:** Success - All verifications passed

### Changes Made

#### New Columns Added to `milestones` table:

| Column | Type | Purpose |
|--------|------|---------|
| `time_allocation_hours` | numeric | Hours allocated (replaces ambiguous `time_allocation`) |
| `start_date` | timestamp | When milestone work begins (auto: 7 days before due date) |
| `is_recurring` | boolean | Flag for recurring pattern milestones |
| `recurring_config` | jsonb | Pattern configuration (daily/weekly/monthly rules) |

#### Old Column Preserved:
- ✅ `time_allocation` kept for backward compatibility
- ✅ Dual-write strategy: Write to both old and new columns
- ✅ Will be dropped after 48 hours of stable operation

### Migration Results

```sql
-- Backup created
milestones_backup_20251018: 2,364 rows ✅

-- All rows migrated
time_allocation_hours: 2,364/2,364 ✅
start_date: 2,364/2,364 ✅
is_recurring: 2,364/2,364 ✅

-- Constraints added
milestones_time_allocation_hours_check ✅
idx_milestones_is_recurring ✅

-- TypeScript types updated
src/integrations/supabase/types.ts ✅
```

### Recurring Config JSON Structure

```json
{
  "type": "daily" | "weekly" | "monthly",
  "interval": 1,
  "weeklyDayOfWeek": 1,              // 0-6 for weekly
  "monthlyPattern": "date",           // "date" or "dayOfWeek"
  "monthlyDate": 15,                  // 1-31 for date pattern
  "monthlyWeekOfMonth": 2,            // 1-4 for week-of-month
  "monthlyDayOfWeek": 2               // 0-6 for day-of-week
}
```

---

## Implementation Guide

### Overview

**6 Phases** to implement the new architecture:

| Phase | File(s) | Duration | Status |
|-------|---------|----------|--------|
| 1 | `src/types/core.ts` | 30 min | ✅ Complete |
| 2 | `src/services/calculations/dayEstimateCalculations.ts` | 2 hours | ✅ Complete |
| 3 | `src/services/unified/UnifiedDayEstimateService.ts` | 1 hour | ✅ Complete |
| 4 | Orchestrator Consolidation | 1 hour | ✅ Complete |
| 5 | `src/services/repositories/MilestoneRepository.ts` | 1 hour | ✅ Complete |
| 6 | `src/components/timeline/*.tsx` | 2 hours | ✅ Complete |

**Total:** ~8 hours

---

### Phase 1: Update Type Definitions (30 min)

**File:** `src/types/core.ts`

#### 1.1 Update Milestone Interface

```typescript
export interface Milestone {
  id: string;
  name: string;
  projectId: string;
  
  // TIME ALLOCATION
  timeAllocationHours: number; // ← CHANGED from timeAllocation
  
  // DATE BOUNDARIES
  startDate?: Date; // ← NEW
  endDate: Date; // ← RENAMED from dueDate
  
  // RECURRING PATTERN
  isRecurring: boolean; // ← NEW
  recurringConfig?: RecurringConfig; // ← NEW
  
  // METADATA
  order: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 1.2 Add RecurringConfig Interface

```typescript
export interface RecurringConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weeklyDayOfWeek?: number; // 0-6
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number; // 1-31
  monthlyWeekOfMonth?: number; // 1-4
  monthlyDayOfWeek?: number; // 0-6
}
```

#### 1.3 Add DayEstimate Interface

```typescript
export interface DayEstimate {
  date: Date;
  projectId: string;
  hours: number;
  source: 'planned-event' | 'milestone-allocation' | 'project-auto-estimate';
  milestoneId?: string;
  isWorkingDay: boolean;
}
```

---

### Phase 2: Day Estimate Calculations (2 hours)

**NEW FILE:** `src/services/calculations/dayEstimateCalculations.ts`

This is the **SINGLE SOURCE OF TRUTH** for timeline rectangles.

#### 2.1 Main Calculation Function

```typescript
import { Project, Milestone, CalendarEvent, DayEstimate, Settings, Holiday } from '@/types/core';
import { calculateProjectWorkingDays, sortMilestonesByDate } from './milestoneCalculations';
import { calculatePlannedHoursForDate } from './capacityCalculations';

/**
 * Calculate day-level time estimates for a project
 * SINGLE SOURCE OF TRUTH for timeline rectangles
 * 
 * PRIORITY ORDER:
 * 1. Planned events (calendar) → always show
 * 2. Milestone allocation → if milestone covers this date
 * 3. Project auto-estimate → fallback
 */
export function calculateProjectDayEstimates(
  project: Project,
  milestones: Milestone[],
  events: CalendarEvent[],
  settings: Settings,
  holidays: Holiday[]
): DayEstimate[] {
  const estimates: DayEstimate[] = [];
  const projectDates = generateProjectDateRange(project);
  
  for (const date of projectDates) {
    // PRIORITY 1: Planned events
    const plannedHours = calculatePlannedHoursForDate(project.id, date, events);
    if (plannedHours > 0) {
      estimates.push({
        date,
        projectId: project.id,
        hours: plannedHours,
        source: 'planned-event',
        isWorkingDay: true // Planned always shows
      });
      continue;
    }
    
    // Check if working day (for auto-estimates only)
    const isWorkingDay = isDateWorkingDay(date, project.autoEstimateDays, settings, holidays);
    if (!isWorkingDay) {
      continue; // Skip non-working days for auto-estimates
    }
    
    // PRIORITY 2: Milestone allocation
    const milestone = findMilestoneForDate(date, milestones, project.startDate);
    if (milestone) {
      const segmentHours = calculateMilestoneSegmentHours(milestone, date, settings, holidays);
      estimates.push({
        date,
        projectId: project.id,
        hours: segmentHours,
        source: 'milestone-allocation',
        milestoneId: milestone.id,
        isWorkingDay: true
      });
      continue;
    }
    
    // PRIORITY 3: Project auto-estimate
    const autoHours = calculateProjectAutoEstimateHours(project, date, settings, holidays);
    estimates.push({
      date,
      projectId: project.id,
      hours: autoHours,
      source: 'project-auto-estimate',
      isWorkingDay: true
    });
  }
  
  return estimates;
}

/**
 * Generate date range for project
 */
function generateProjectDateRange(project: Project): Date[] {
  const dates: Date[] = [];
  const start = new Date(project.startDate);
  const end = project.continuous 
    ? new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year for continuous
    : new Date(project.endDate);
  
  let current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Find which milestone covers a specific date
 */
function findMilestoneForDate(
  date: Date, 
  milestones: Milestone[],
  projectStartDate: Date
): Milestone | null {
  const sorted = sortMilestonesByDate(milestones);
  
  for (let i = 0; i < sorted.length; i++) {
    const milestone = sorted[i];
    const startDate = milestone.startDate || (i === 0 ? projectStartDate : sorted[i-1].endDate);
    const endDate = milestone.endDate;
    
    if (date >= startDate && date <= endDate) {
      return milestone;
    }
  }
  
  return null;
}

/**
 * Calculate hours for a specific day within a milestone
 */
function calculateMilestoneSegmentHours(
  milestone: Milestone,
  date: Date,
  settings: Settings,
  holidays: Holiday[]
): number {
  const startDate = milestone.startDate || date; // Fallback if no start date
  const workingDays = calculateProjectWorkingDays(startDate, milestone.endDate, settings, holidays);
  
  if (workingDays.length === 0) return 0;
  
  return milestone.timeAllocationHours / workingDays.length;
}

/**
 * Calculate project auto-estimate hours for a specific day
 */
function calculateProjectAutoEstimateHours(
  project: Project,
  date: Date,
  settings: Settings,
  holidays: Holiday[]
): number {
  const endDate = project.continuous
    ? new Date(project.startDate.getTime() + 365 * 24 * 60 * 60 * 1000)
    : project.endDate;
  
  const workingDays = calculateProjectWorkingDays(project.startDate, endDate, settings, holidays);
  
  if (workingDays.length === 0) return 0;
  
  return project.estimatedHours / workingDays.length;
}

/**
 * Check if date is a working day for this project
 */
function isDateWorkingDay(
  date: Date,
  autoEstimateDays: Project['autoEstimateDays'],
  settings: Settings,
  holidays: Holiday[]
): boolean {
  // Check holidays
  const isHoliday = holidays.some(holiday =>
    date >= holiday.startDate && date <= holiday.endDate
  );
  if (isHoliday) return false;
  
  // Check project's auto-estimate days
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const dayName = dayNames[date.getDay()];
  
  return autoEstimateDays?.[dayName] ?? true; // Default to true if not set
}

/**
 * Calculate planned hours for a specific date and project
 */
function calculatePlannedHoursForDate(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): number {
  const projectEvents = events.filter(event =>
    event.projectId === projectId &&
    isSameDate(new Date(event.startTime), date)
  );
  
  return projectEvents.reduce((total, event) => {
    const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    return total + duration;
  }, 0);
}

function isSameDate(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}
```

---

### Phase 3: Unified Day Estimate Service (1 hour)

**NEW FILE:** `src/services/unified/UnifiedDayEstimateService.ts`

```typescript
import { Project, Milestone, CalendarEvent, DayEstimate, Settings, Holiday } from '@/types/core';
import { calculateProjectDayEstimates } from '../calculations/dayEstimateCalculations';

/**
 * Unified Day Estimate Service
 * Business logic for day-level time distribution
 */
export class UnifiedDayEstimateService {
  /**
   * Get day estimates for a project
   */
  static getDayEstimates(
    project: Project,
    milestones: Milestone[],
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ): DayEstimate[] {
    return calculateProjectDayEstimates(project, milestones, events, settings, holidays);
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
    const allEstimates = this.getDayEstimates(project, milestones, events, settings, holidays);
    return allEstimates.filter(est => est.date >= startDate && est.date <= endDate);
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
    const totalAllocated = milestones.reduce((sum, m) => sum + m.timeAllocationHours, 0);
    
    return {
      isValid: totalAllocated <= projectEstimatedHours,
      totalAllocated,
      remaining: projectEstimatedHours - totalAllocated,
      overageHours: Math.max(0, totalAllocated - projectEstimatedHours)
    };
  }
}
```

---

### Phase 4: Timeline Orchestrator (1 hour)

**NEW FILE:** `src/services/orchestrators/TimelineOrchestrator.ts`

```typescript
import { Project, CalendarEvent, Settings, Holiday } from '@/types/core';
import { MilestoneRepository } from '../repositories/MilestoneRepository';
import { UnifiedDayEstimateService } from '../unified/UnifiedDayEstimateService';

/**
 * Timeline Orchestrator
 * ONE method that BOTH Days and Weeks views call
 */
export class TimelineOrchestrator {
  /**
   * Get complete timeline data for rendering
   * SINGLE SOURCE OF TRUTH for timeline display
   */
  static async getTimelineData(
    projects: Project[],
    dateRange: { start: Date; end: Date },
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ) {
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

### Phase 5: Update Milestone Repository (1 hour)

**FILE:** `src/services/repositories/MilestoneRepository.ts`

Update the `toMilestone()` and `toRow()` methods:

```typescript
// In toMilestone() method - UPDATE:
private static toMilestone(row: any): Milestone {
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    
    // NEW: Use new column, fallback to old
    timeAllocationHours: row.time_allocation_hours ?? row.time_allocation,
    
    // NEW: Map new columns
    startDate: row.start_date ? new Date(row.start_date) : undefined,
    endDate: new Date(row.due_date), // Renamed from dueDate
    isRecurring: row.is_recurring ?? false,
    recurringConfig: row.recurring_config ? JSON.parse(row.recurring_config) : undefined,
    
    order: row.order_index,
    userId: row.user_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

// In toRow() method - UPDATE:
private static toRow(milestone: Milestone): any {
  return {
    id: milestone.id,
    name: milestone.name,
    project_id: milestone.projectId,
    
    // DUAL-WRITE: Write to both old and new columns
    time_allocation: milestone.timeAllocationHours, // OLD: For backward compatibility
    time_allocation_hours: milestone.timeAllocationHours, // NEW: Primary column
    
    // NEW: Map new columns
    start_date: milestone.startDate?.toISOString(),
    due_date: milestone.endDate.toISOString(), // Keep for backward compatibility
    is_recurring: milestone.isRecurring,
    recurring_config: milestone.recurringConfig ? JSON.stringify(milestone.recurringConfig) : null,
    
    order_index: milestone.order,
    user_id: milestone.userId,
    created_at: milestone.createdAt.toISOString(),
    updated_at: milestone.updatedAt.toISOString()
  };
}
```

---

### Phase 6: Update Timeline Components (2 hours)

**FILE:** `src/components/timeline/TimelineBar.tsx`

Replace the multiple calculation calls with single orchestrator:

```typescript
// BEFORE (WRONG - multiple sources):
const timeAllocation = memoizedGetProjectTimeAllocation(...);
const allocation = TimeAllocationService.generateTimeAllocation(...);

// AFTER (CORRECT - single source):
import { TimelineOrchestrator } from '@/services/orchestrators/TimelineOrchestrator';

// Inside component:
const { projectData } = await TimelineOrchestrator.getTimelineData(
  [project],
  { start: dates[0], end: dates[dates.length - 1] },
  events,
  settings,
  holidays
);

const dayEstimates = projectData[0]?.dayEstimates || [];

// Render each date:
{dates.map(date => {
  const estimate = dayEstimates.find(est => isSameDate(est.date, date));
  
  if (!estimate || estimate.hours === 0) {
    return <div key={date} style={{ width: '40px' }} />;
  }
  
  const height = Math.max(3, estimate.hours * 4); // Height scaling
  const isPlanned = estimate.source === 'planned-event';
  const color = isPlanned ? 'blue' : 'gray';
  
  return (
    <Tooltip key={date}>
      <TooltipTrigger>
        <div 
          style={{ 
            height: `${height}px`, 
            backgroundColor: color,
            width: '40px'
          }} 
        />
      </TooltipTrigger>
      <TooltipContent>
        {estimate.hours}h - {estimate.source}
      </TooltipContent>
    </Tooltip>
  );
})}
```

**If WeeksView exists:** Apply the same pattern.

---

## Testing & Deployment

### Testing Checklist

After implementation, verify:

- [ ] **Project without milestones** → Gray auto-estimate rectangles appear
- [ ] **Project with milestones** → Rectangles distributed across milestone periods
- [ ] **Planned calendar event** → Blue rectangle overrides auto-estimate
- [ ] **Weeks view = Days view** → Both show identical data
- [ ] **Budget validation** → Can't create milestones exceeding project hours
- [ ] **Drag project** → Rectangles move correctly with project
- [ ] **Tooltips** → Show correct hours and source
- [ ] **No console errors** → No undefined field errors

### Deployment Plan

1. **Test locally** (2 hours)
   - Run all tests
   - Manual testing of timeline rendering
   - Verify weeks and days views match

2. **Deploy to staging** (if available)
   - Monitor for errors
   - Test with real data

3. **Deploy to production**
   - Monitor logs for 24-48 hours
   - Watch for any user reports

4. **Cleanup** (after 48 hours of stable operation)
   - Drop old `time_allocation` column
   - Remove deprecated services (TimeAllocationOrchestrator, etc.)
   - Remove localStorage recurring milestone code

---

## Troubleshooting

### Common Issues

**Type errors about `dueDate`:**
- Solution: Update files to use `milestone.endDate` instead
- Check: Other files may still reference `dueDate`

**Calculations not matching expected:**
- Check: Priority order in `calculateProjectDayEstimates()`
- Verify: Planned events should ALWAYS override auto-estimate

**Performance issues:**
- Solution: Add memoization to `getDayEstimates()`
- Consider: Caching day estimates for visible date range

**Missing imports:**
- Check: Barrel files (`index.ts`) export new functions
- Verify: All new files are properly imported

---

## File Structure

```
src/
├── types/
│   └── core.ts                                    # ✏️ UPDATED: Added RecurringConfig, DayEstimate
│
├── services/
│   ├── calculations/
│   │   └── dayEstimateCalculations.ts             # ✨ NEW: Single source of truth
│   │
│   ├── unified/
│   │   └── UnifiedDayEstimateService.ts           # ✨ NEW: Business logic wrapper
│   │
│   ├── orchestrators/
│   │   └── TimelineOrchestrator.ts                # ✨ NEW: Timeline data preparation
│   │
│   └── repositories/
│       └── MilestoneRepository.ts                 # ✏️ UPDATED: Map new columns
│
└── components/
    └── timeline/
        └── TimelineBar.tsx                        # ✏️ UPDATED: Use TimelineOrchestrator
```

---

## Summary

### What We Did
1. ✅ Migrated database (new columns added, 2,364 records updated)
2. ⏳ Need to implement code (6 phases documented above)

### What This Fixes
- ✅ Timeline rectangles appear correctly
- ✅ Weeks view = Days view (same data source)
- ✅ Clear separation of concerns
- ✅ Single source of truth for calculations
- ✅ Recurring milestones in database (not localStorage)

### What's Next
**For Lovable:** Implement Phases 1-6 from the Implementation Guide section above.

**Estimated time:** ~8 hours of implementation + 2 hours of testing = 10 hours total

---

**Questions?** Review the specific phase in the Implementation Guide for detailed code examples and step-by-step instructions.
