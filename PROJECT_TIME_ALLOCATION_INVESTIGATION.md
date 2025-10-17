# Project Time Allocation Investigation

## Issue Summary
The "Website Update" project (client: Garvald) has a time allocation of 6 hours configured in the project modal, showing "45min/day" estimate, but **no auto-estimate rectangles are appearing on the timeline** despite having a completed time event visible.

## Current Data Model

### Database Schema

#### Projects Table
```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL,
  row_id UUID NOT NULL,
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_hours DECIMAL NOT NULL,  -- ✅ This is the time budget field
  color TEXT NOT NULL,
  notes TEXT,
  icon TEXT DEFAULT 'folder',
  continuous BOOLEAN,
  auto_estimate_days JSONB,  -- Days to include in auto-estimation
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

#### Milestones Table
```sql
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  time_allocation NUMERIC NOT NULL CHECK (time_allocation >= 0 AND time_allocation <= 100),  -- ⚠️ PERCENTAGE (0-100) of project budget
  project_id UUID NOT NULL REFERENCES public.projects(id),
  order_index INTEGER DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

### TypeScript Interfaces

#### Project Interface (`src/types/core.ts`)
```typescript
export interface Project {
  id: string;
  name: string;
  client: string;
  startDate: Date;
  endDate: Date;
  estimatedHours: number;  // ✅ Maps from database estimated_hours
  color: string;
  groupId: string;
  rowId: string;
  notes?: string;
  icon?: string;
  milestones?: Milestone[];
  continuous?: boolean;
  status?: ProjectStatus;
  autoEstimateDays?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Milestone Interface (`src/types/core.ts`)
```typescript
export interface Milestone {
  id: string;
  name: string;
  dueDate: Date;
  timeAllocation: number;  // ⚠️ PERCENTAGE (0-100) of parent project's estimatedHours
  projectId: string;
  orderIndex: number;
}
```

## Data Flow Architecture

### 1. Database → Domain Transformation
**File**: `src/services/repositories/ProjectRepository.ts`

```typescript
function transformToDomain(dbProject: ProjectRow): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    client: dbProject.client,
    startDate: new Date(dbProject.start_date),
    endDate: new Date(dbProject.end_date),
    estimatedHours: dbProject.estimated_hours,  // ✅ Correctly mapped
    // ... other fields
  };
}
```

### 2. Timeline Auto-Estimate Calculation
**File**: `src/services/unified/UnifiedEventWorkHourService.ts`

```typescript
export function getProjectTimeAllocation(
  projectId: string,
  date: Date,
  events: CalendarEvent[],
  project: Project,
  settings: Settings,
  holidays: Holiday[]
): TimeAllocation {
  // ... validation logic ...
  
  // Calculate working days using auto-estimate settings
  const projectWorkingDays = calculateAutoEstimateWorkingDays(
    projectStart, 
    effectiveProjectEnd, 
    project.autoEstimateDays,  // ⚠️ Optional, defaults to all days true
    settings, 
    holidays
  );

  // Calculate hours per day
  const autoEstimateHours = project.estimatedHours / projectWorkingDays.length;  // ✅ Uses estimatedHours
  
  return { type: 'auto-estimate', hours: autoEstimateHours, isWorkingDay: true };
}
```

### 3. Timeline Rendering
**File**: `src/components/timeline/TimelineBar.tsx`

The component calls `memoizedGetProjectTimeAllocation()` for each date and renders rectangles based on the returned `type`:
- `'auto-estimate'` → Gray rectangles (project budget distributed)
- `'planned'` → Blue rectangles (calendar events scheduled)
- `'none'` → No rectangle

## Investigation Findings

### Current Debug Output (Oct 13-20, 2025)
```javascript
🔍 DAYS MODE - Website Update 10/13/2025: {
  isProjectDay: true,
  isHoliday: false,
  totalDayWork: 7,  // Hours available to work this day
  isDayEnabled: true,  // Day is enabled in project's auto-estimate settings
  projectName: "Website Update",
  client: "Garvald",
  estimatedHours: 6,  // ✅ Project has budget defined
  autoEstimateDays: { monday: true, tuesday: true, ... },
  startDate: "10/13/2025",
  endDate: "10/20/2025",
  continuous: false,
  projectDaysCount: 8
}

🔍 TIME ALLOCATION - Website Update 10/13/2025: {
  type: "none",  // ❌ PROBLEM: Should be "auto-estimate"
  hours: 0,
  isWorkingDay: true,  // ✅ Day is confirmed as working day
  projectEstimatedHours: 6,  // ✅ Budget is available
  hasEvents: 1,  // One event exists (the completed time)
  projectId: "xyz",
  willRender: false  // ❌ Won't render rectangles
}

❌ SKIPPING RENDER - Website Update 10/13/2025 - type is 'none'
```

### Root Cause Analysis

The `getProjectTimeAllocation()` function is returning `type: 'none'` despite:
1. ✅ Project has `estimatedHours: 6` defined
2. ✅ Date is within project range (Oct 13-20)
3. ✅ Day is a working day (`isWorkingDay: true`)
4. ✅ Day is enabled in `autoEstimateDays` settings
5. ✅ Day is not a holiday

**Possible causes** (in order of likelihood):

#### A. Planned Time Overriding Auto-Estimate
Lines 324-329 in `UnifiedEventWorkHourService.ts`:
```typescript
// Check for planned time (events connected to this project)
const plannedHours = calculatePlannedTimeForDate(projectId, date, events);

if (plannedHours > 0) {
  return { type: 'planned', hours: plannedHours, isWorkingDay: true };  // 🎯 Early return
}
```

**If a completed time event exists** on this date for this project, the function returns `'planned'` type, NOT `'auto-estimate'`. However, the debug output shows `type: 'none'`, so this is not the issue.

#### B. Auto-Estimate Working Days Calculation Issue
Lines 363-382 in `UnifiedEventWorkHourService.ts`:
```typescript
const projectWorkingDays = calculateAutoEstimateWorkingDays(
  projectStart, 
  effectiveProjectEnd, 
  project.autoEstimateDays,  // ⚠️ May be undefined or misconfigured
  settings, 
  holidays
);

if (projectWorkingDays.length === 0) {
  return { type: 'none', hours: 0, isWorkingDay: true };  // 🎯 Possible culprit
}

const isInAutoEstimateDays = projectWorkingDays.some(workDay => 
  workDay.toDateString() === currentDateString
);

if (!isInAutoEstimateDays) {
  return { type: 'none', hours: 0, isWorkingDay: true };  // 🎯 Possible culprit
}
```

**Most likely issue**: The `calculateAutoEstimateWorkingDays()` function is either:
- Returning an empty array (all days excluded)
- Not including Oct 13-20 dates in the result
- Using incorrect date normalization causing comparison failures

#### C. Date Range Check Failure (Less Likely)
Lines 334-349 in `UnifiedEventWorkHourService.ts`:
```typescript
const normalizedDate = new Date(date);
normalizedDate.setHours(0, 0, 0, 0);

const projectStart = new Date(project.startDate);
projectStart.setHours(0, 0, 0, 0);

if (project.continuous) {
  if (normalizedDate < projectStart) {
    return { type: 'none', hours: 0, isWorkingDay: true };
  }
} else {
  const projectEnd = new Date(project.endDate);
  projectEnd.setHours(0, 0, 0, 0);
  
  if (normalizedDate < projectStart || normalizedDate > projectEnd) {
    return { type: 'none', hours: 0, isWorkingDay: true };  // 🎯 Date out of range
  }
}
```

Debug output shows project dates are correct, so this is unlikely.

## Recommended Investigation Steps

### 1. Add Detailed Logging to `calculateAutoEstimateWorkingDays()`
**File**: `src/services/calculations/timelineCalculations.ts`

Add logging to understand:
- How many working days are calculated
- What dates are included/excluded
- Why certain days might be filtered out

```typescript
export function calculateAutoEstimateWorkingDays(
  startDate: Date,
  endDate: Date,
  autoEstimateDays: Project['autoEstimateDays'] = {
    monday: true, tuesday: true, wednesday: true, thursday: true,
    friday: true, saturday: true, sunday: true
  },
  settings: Settings,
  holidays: Holiday[]
): Date[] {
  console.log('🔧 calculateAutoEstimateWorkingDays called:', {
    startDate: startDate.toLocaleDateString(),
    endDate: endDate.toLocaleDateString(),
    autoEstimateDays,
    settingsKeys: Object.keys(settings.weeklyWorkHours || {}),
    holidayCount: holidays.length
  });
  
  // ... existing logic ...
  
  console.log('✅ calculateAutoEstimateWorkingDays result:', {
    totalDays: workingDays.length,
    dates: workingDays.map(d => d.toLocaleDateString())
  });
  
  return workingDays;
}
```

### 2. Check `autoEstimateDays` Field in Database
Run SQL query to verify the actual data:

```sql
SELECT 
  id,
  name,
  client,
  start_date,
  end_date,
  estimated_hours,
  auto_estimate_days,
  continuous
FROM public.projects
WHERE name ILIKE '%website%'
  AND client ILIKE '%garvald%';
```

Expected result:
```json
{
  "id": "...",
  "name": "Website Update",
  "client": "Garvald",
  "start_date": "2025-10-13",
  "end_date": "2025-10-20",
  "estimated_hours": 6,
  "auto_estimate_days": null or {"monday": true, "tuesday": true, ...},
  "continuous": false
}
```

### 3. Verify Settings Working Hours Configuration
Check if user's `weeklyWorkHours` settings are properly configured:

```sql
SELECT 
  weekly_work_hours
FROM public.settings
WHERE user_id = '<current_user_id>';
```

Expected format:
```json
{
  "monday": [{"startTime": "09:00", "endTime": "17:00", "duration": 7}],
  "tuesday": [{"startTime": "09:00", "endTime": "17:00", "duration": 7}],
  ...
}
```

## User Requirements Clarification

### Current Understanding
1. **Projects** have `estimatedHours` field - total time budget (e.g., 6 hours)
2. **Milestones** have `timeAllocation` field - percentage of project budget (0-100)
3. **Auto-estimate rectangles** should distribute `estimatedHours` across working days
4. **Milestone progress** displays "2 of 6 hrs" format using project's `estimatedHours` as denominator

### User Statement
> "The overall allocation of time should be this project allocation, with milestones a secondary breakdown of that overall figure."

This is CORRECTLY implemented in the current schema:
- ✅ Project has single `estimated_hours` budget
- ✅ Milestones have `time_allocation` as percentage of that budget
- ✅ Timeline uses `project.estimatedHours` for auto-estimate calculations

### Potential Schema Issue?
If milestones need to show actual hour allocations (e.g., "2 hrs" not "33%"), the current `time_allocation` field (percentage) would need conversion:

```typescript
const milestoneHours = (milestone.timeAllocation / 100) * project.estimatedHours;
// Example: (33 / 100) * 6 = 1.98 hours
```

**Question for Lovable**: Is the milestone `time_allocation` field ALWAYS stored as percentage (0-100), or are there cases where it might be stored as absolute hours?

## Next Steps

1. **Add logging to `calculateAutoEstimateWorkingDays()`** to identify why dates are being excluded
2. **Run database query** to verify `auto_estimate_days` field for Website Update project
3. **Check browser console** with new debug output after refreshing timeline
4. **Verify** if completed time events are causing `'planned'` type instead of `'auto-estimate'` (though debug shows `'none'`)

## Test Case
**Project**: Website Update (Garvald client)
- **Date Range**: Oct 13-20, 2025 (8 calendar days)
- **Estimated Hours**: 6 hours
- **Expected**: 6 hrs / 8 days = 0.75 hrs/day (45 min/day) ✅ Calculation shown in modal
- **Actual**: No auto-estimate rectangles appearing on timeline ❌
- **Completed Event**: One time tracking event exists (visible on timeline)

## Files Modified for Debugging
- `/src/components/timeline/TimelineBar.tsx` - Added comprehensive debug logging
  - Lines 435-453: Project day validation logging
  - Lines 468-483: Time allocation result logging with render decision

## Questions for Lovable

1. Should `auto_estimate_days` field be required in database? Currently it's nullable and defaults to "all days true" in code.
2. Is there any data migration needed to ensure existing projects have `auto_estimate_days` properly set?
3. Should completed time events show as `'planned'` type or `'auto-estimate'` type? Currently they're treated as planned.
4. Are milestone time allocations ALWAYS percentages (0-100), or can they be absolute hours?

---

**Created**: [Current Date]
**Status**: Investigation in progress
**Priority**: High - Core timeline functionality affected
