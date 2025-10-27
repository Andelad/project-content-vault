# Calculation Reference
## Complete List of All Calculations with Formulas and Implementations

**Document Version**: 1.0.0  
**Last Updated**: October 27, 2025  
**Purpose**: Single source of truth for all calculations in the application

---

## Table of Contents

1. [Overview](#overview)
2. [Project Calculations](#project-calculations)
3. [Milestone Calculations](#milestone-calculations)
4. [Day Estimate Calculations](#day-estimate-calculations)
5. [Working Days Calculations](#working-days-calculations)
6. [Availability & Capacity Calculations](#availability--capacity-calculations)
7. [Event Calculations](#event-calculations)
8. [Date & Time Calculations](#date--time-calculations)
9. [Budget & Utilization Calculations](#budget--utilization-calculations)
10. [Analytics & Insights Calculations](#analytics--insights-calculations)
11. [Calculation Dependencies](#calculation-dependencies)

---

## Overview

### Calculation Organization

Calculations are organized into domain-specific modules:

```
src/services/calculations/
├── projects/           # Project, milestone, day estimate calculations
├── availability/       # Work hours, capacity, availability
├── events/            # Calendar events, holidays, overlaps
├── general/           # Date, time, settings
├── insights/          # Analytics, planner insights
├── groups/            # Group statistics
└── tracking/          # Time tracking
```

### Calculation Principles

1. **Pure Functions**: All calculations are deterministic (same input → same output)
2. **No Side Effects**: Calculations don't modify state or call external services
3. **Domain Rule Integration**: Calculations delegate to domain rules for business logic
4. **Single Responsibility**: Each function calculates one thing

---

## Project Calculations

### 1. Project Duration

**Purpose**: Calculate total duration of a project in calendar days

**Formula**:
```
duration = (endDate - startDate) in days
```

**Implementation**: `ProjectRules.calculateProjectDuration()`

**Location**: `src/domain/rules/ProjectRules.ts`

**Parameters**:
- `project: Project` - The project to calculate duration for

**Returns**: `number | null`
- Number of days for time-limited projects
- `null` for continuous projects (no end date)

**Example**:
```typescript
const project = {
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-03-31'),
  continuous: false
};
// Result: 90 days
```

**Related Calculations**:
- `calculateAutoEstimateWorkingDays()` - Filters to working days only
- `calculateTotalWorkingDays()` - Excludes weekends and holidays

---

### 2. Project Budget Analysis

**Purpose**: Comprehensive analysis of project budget vs milestone allocations

**Formula**:
```
totalAllocation = SUM(milestone.timeAllocationHours)
utilizationPercentage = (totalAllocation / project.estimatedHours) * 100
remainingHours = project.estimatedHours - totalAllocation
isOverBudget = totalAllocation > project.estimatedHours
overageHours = MAX(0, totalAllocation - project.estimatedHours)
```

**Implementation**: `ProjectRules.analyzeBudget()`

**Location**: `src/domain/rules/ProjectRules.ts`

**Parameters**:
- `project: Project` - The project to analyze
- `milestones: Milestone[]` - Project's milestones

**Returns**: `ProjectBudgetAnalysis`
```typescript
{
  totalAllocation: number;        // Total milestone hours
  suggestedBudget: number;        // Recommended budget if over
  isOverBudget: boolean;          // true if exceeded
  overageHours: number;           // Amount over budget
  utilizationPercentage: number;  // 0-100+ percentage
}
```

**Business Rule**: Rule 1 - Milestone Budget Constraint
- `SUM(milestone hours) ≤ project.estimatedHours`

**Example**:
```typescript
const project = { estimatedHours: 120 };
const milestones = [
  { timeAllocationHours: 40 },
  { timeAllocationHours: 50 },
  { timeAllocationHours: 30 }
];
// Result: {
//   totalAllocation: 120,
//   isOverBudget: false,
//   utilizationPercentage: 100,
//   remainingHours: 0
// }
```

---

### 3. Working Days for Auto-Estimation

**Purpose**: Calculate which days count as working days for a project

**Formula**:
```
FOR each day between startDate and endDate:
  IF project.autoEstimateDays[dayOfWeek] === true
  AND day is not a holiday
  THEN include in working days
```

**Implementation**: `calculateAutoEstimateWorkingDays()`

**Location**: `src/services/calculations/projects/projectCalculations.ts`

**Parameters**:
- `startDate: Date` - Start of range
- `endDate: Date` - End of range
- `autoEstimateDays: Project['autoEstimateDays']` - Which days are enabled
- `settings?: Settings` - Fallback if autoEstimateDays not specified
- `holidays?: Holiday[]` - Days to exclude

**Returns**: `Date[]` - Array of working dates

**Default Behavior**: If `autoEstimateDays` not specified, defaults to all days enabled

**Example**:
```typescript
const result = calculateAutoEstimateWorkingDays(
  new Date('2025-01-01'),  // Wednesday
  new Date('2025-01-07'),  // Tuesday
  { monday: true, tuesday: true, wednesday: true,
    thursday: true, friday: true, saturday: false, sunday: false },
  settings,
  []
);
// Result: [Wed 1, Thu 2, Fri 3, Mon 6, Tue 7] - 5 working days
```

---

### 4. Auto-Estimate Hours Per Day

**Purpose**: Calculate daily hours needed to complete project on time

**Formula**:
```
workingDays = calculateAutoEstimateWorkingDays(...)
hoursPerDay = project.estimatedHours / workingDays.length
```

**Implementation**: `calculateAutoEstimateHoursPerDay()`

**Location**: `src/services/calculations/projects/projectCalculations.ts`

**Parameters**:
- `project: Project` - Project to calculate for
- `settings?: Settings` - Work schedule settings
- `holidays?: Holiday[]` - Days to exclude

**Returns**: `number` - Hours needed per working day

**Example**:
```typescript
const project = {
  estimatedHours: 120,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-03-31'),
  autoEstimateDays: { /* Mon-Fri only */ }
};
// Assume 60 working days (Mon-Fri, 3 months)
// Result: 120 hours / 60 days = 2 hours/day
```

---

### 5. Project Status Determination

**Purpose**: Calculate effective project status based on dates

**Formula**:
```
IF project.status is explicitly set THEN
  return project.status
ELSE
  IF today < project.startDate THEN
    return 'future'
  ELSE IF project.continuous OR today <= project.endDate THEN
    return 'current'
  ELSE
    return 'archived'
```

**Implementation**: `determineProjectStatus()`

**Location**: `src/services/calculations/projects/projectEntityCalculations.ts`

**Parameters**:
- `project: Project` - Project to determine status for

**Returns**: `'future' | 'current' | 'archived'`

---

## Milestone Calculations

### 6. Total Milestone Allocation

**Purpose**: Sum all milestone time allocations for a project

**Formula**:
```
totalAllocation = SUM(milestone.timeAllocationHours for all milestones)
```

**Implementation**: `calculateTotalAllocation()` or `MilestoneRules.calculateTotalAllocation()`

**Locations**:
- `src/services/calculations/projects/milestoneCalculations.ts`
- `src/domain/rules/MilestoneRules.ts`

**Parameters**:
- `milestones: Milestone[]` - Array of milestones

**Returns**: `number` - Total hours allocated

**Handles Legacy Fields**: Uses `timeAllocationHours` if available, fallback to `timeAllocation`

**Example**:
```typescript
const milestones = [
  { timeAllocationHours: 40 },
  { timeAllocationHours: 60 },
  { timeAllocationHours: 20 }
];
// Result: 120 hours
```

---

### 7. Budget Utilization Percentage

**Purpose**: Calculate what percentage of project budget is allocated

**Formula**:
```
IF projectBudget > 0 THEN
  utilization = (totalAllocated / projectBudget) * 100
ELSE
  utilization = 0
```

**Implementation**: `calculateBudgetUtilization()` or `MilestoneRules.calculateBudgetUtilization()`

**Locations**:
- `src/services/calculations/projects/milestoneCalculations.ts`
- `src/domain/rules/MilestoneRules.ts`

**Parameters**:
- `totalAllocated: number` - Total milestone hours (or use milestones array)
- `projectBudget: number` - Project estimated hours

**Returns**: `number` - Percentage (can be > 100 if over budget)

**Example**:
```typescript
// 90 hours allocated out of 120 hour budget
const utilization = calculateBudgetUtilization(90, 120);
// Result: 75%
```

---

### 8. Remaining Budget

**Purpose**: Calculate how many hours remain unallocated

**Formula**:
```
remaining = MAX(0, project.estimatedHours - SUM(milestone hours))
```

**Implementation**: `calculateRemainingBudget()` or `MilestoneRules.calculateRemainingBudget()`

**Locations**:
- `src/services/calculations/projects/milestoneCalculations.ts`
- `src/domain/rules/MilestoneRules.ts`

**Parameters**:
- `totalAllocated: number` - Total milestone hours (or milestones array)
- `projectBudget: number` - Project estimated hours

**Returns**: `number` - Remaining hours (0 if over budget)

**Example**:
```typescript
const remaining = calculateRemainingBudget(90, 120);
// Result: 30 hours remaining
```

---

### 9. Budget Overage

**Purpose**: Calculate how many hours exceed project budget

**Formula**:
```
overage = MAX(0, SUM(milestone hours) - project.estimatedHours)
```

**Implementation**: `calculateOverageAmount()` or `MilestoneRules.calculateBudgetOverage()`

**Locations**:
- `src/services/calculations/projects/milestoneCalculations.ts`
- `src/domain/rules/MilestoneRules.ts`

**Parameters**:
- `totalAllocated: number` - Total milestone hours
- `projectBudget: number` - Project estimated hours

**Returns**: `number` - Overage hours (0 if within budget)

**Example**:
```typescript
const overage = calculateOverageAmount(150, 120);
// Result: 30 hours over budget
```

---

### 10. Milestone Density

**Purpose**: Calculate milestones per day for a date range (timeline pressure indicator)

**Formula**:
```
milestonesInRange = COUNT(milestones with endDate in [startDate, endDate])
totalDays = (endDate - startDate) in days
density = milestonesInRange / totalDays
```

**Implementation**: `calculateMilestoneDensity()`

**Location**: `src/services/calculations/projects/milestoneCalculations.ts`

**Parameters**:
- `milestones: Milestone[]` - All milestones
- `startDate: Date` - Range start
- `endDate: Date` - Range end

**Returns**: `number` - Milestones per day

**Example**:
```typescript
// 5 milestones across 30 days
const density = calculateMilestoneDensity(milestones, start, end);
// Result: 0.167 milestones/day (~1 milestone every 6 days)
```

---

### 11. Milestone Segments

**Purpose**: Calculate time segments between milestones for day estimate distribution

**Formula**:
```
FOR each milestone:
  segmentStart = previous milestone endDate OR project startDate
  segmentEnd = milestone endDate
  workingDays = COUNT(working days in [segmentStart, segmentEnd])
  
  segment = {
    milestone,
    startDate: segmentStart,
    endDate: segmentEnd,
    workingDays
  }
```

**Implementation**: `calculateMilestoneSegments()`

**Location**: `src/services/calculations/projects/milestoneCalculations.ts`

**Parameters**:
- `milestones: Milestone[]` - Project milestones (sorted by date)
- `projectStartDate: Date` - Project start
- `projectEndDate: Date` - Project end
- `autoEstimateDays: object` - Which days count as working days
- `settings: Settings` - Work schedule
- `holidays: Holiday[]` - Days to exclude

**Returns**: `MilestoneSegment[]`
```typescript
{
  milestone: Milestone;
  startDate: Date;
  endDate: Date;
  workingDays: number;
}
```

**Use**: Critical for day estimate calculations

---

### 12. Recurring Milestone Count

**Purpose**: Calculate how many instances a recurring milestone generates

**Formula**:
```
GIVEN recurring pattern (type, interval) and date range:
  IF type === 'daily':
    count = FLOOR((endDate - startDate) / interval) + 1
  ELSE IF type === 'weekly':
    count = COUNT(weeklyDayOfWeek occurrences in range)
  ELSE IF type === 'monthly':
    count = COUNT(month boundaries in range matching pattern)
```

**Implementation**: `calculateRecurringMilestoneCount()`

**Location**: `src/services/calculations/projects/milestoneCalculations.ts`

**Parameters**:
```typescript
{
  recurringConfig: RecurringConfig;
  projectStartDate: Date;
  projectEndDate: Date;
}
```

**Returns**: `number` - Count of instances

---

### 13. Suggested Milestone Budget

**Purpose**: Recommend budget allocation for new milestone

**Formula**:
```
IF milestoneCount <= 0 THEN return 0

suggestedBudget = ROUND(project.estimatedHours / milestoneCount)
```

**Implementation**: `calculateSuggestedMilestoneBudget()` or `ProjectRules.suggestMilestoneBudget()`

**Locations**:
- `src/services/calculations/projects/milestoneCalculations.ts`
- `src/domain/rules/ProjectRules.ts`

**Parameters**:
- `projectBudget: number` - Project estimated hours
- `existingMilestones: Milestone[]` - Current milestones
- `plannedMilestoneCount: number` - How many more milestones planned

**Returns**: `number` - Suggested hours for new milestone

**Example**:
```typescript
// 120 hour project, plan for 4 milestones total
const suggested = calculateSuggestedMilestoneBudget(120, [], 4);
// Result: 30 hours per milestone
```

---

## Day Estimate Calculations

### 14. Milestone Day Estimates

**Purpose**: Distribute milestone hours across working days until deadline

**Formula**:
```
workingDays = getWorkingDaysBetween(milestone.startDate, milestone.endDate, ...)
dailyHours = milestone.timeAllocationHours / workingDays.length

FOR each working day:
  estimate = {
    date,
    hours: dailyHours,
    milestoneId,
    projectId
  }
```

**Implementation**: `calculateMilestoneDayEstimates()`

**Location**: `src/services/calculations/projects/dayEstimateCalculations.ts`

**Parameters**:
- `milestone: Milestone` - Milestone to calculate for
- `project: Project` - Parent project
- `settings: Settings` - Work schedule
- `holidays: Holiday[]` - Days to exclude

**Returns**: `DayEstimate[]` - Array of daily estimates

**Critical**: Only shows on days WITHOUT calendar events for that project

**Example**:
```typescript
const milestone = {
  timeAllocationHours: 40,
  startDate: new Date('2025-01-01'),  // 30 working days
  endDate: new Date('2025-02-15')
};
// Result: 40 hours / 30 days = 1.33 hours per working day
```

---

### 15. Recurring Milestone Day Estimates

**Purpose**: Generate virtual milestone instances and calculate estimates for each

**Formula**:
```
virtualDates = generateRecurringMilestoneDates(recurringConfig, projectDates)

FOR each virtualDate:
  FOR each working day in occurrence window:
    estimate = {
      date,
      hours: milestone.timeAllocationHours / working days in window,
      milestoneId,
      isRecurring: true
    }
```

**Implementation**: `calculateRecurringMilestoneDayEstimates()`

**Location**: `src/services/calculations/projects/dayEstimateCalculations.ts`

**Parameters**:
- `milestone: Milestone` - Recurring milestone
- `project: Project` - Parent project
- `settings: Settings` - Work schedule
- `holidays: Holiday[]` - Days to exclude

**Returns**: `DayEstimate[]` - Estimates for all occurrences

---

### 16. Project Day Estimates (Auto-Estimate)

**Purpose**: Distribute entire project budget across working days (when no milestones)

**Formula**:
```
workingDays = calculateAutoEstimateWorkingDays(
  project.startDate,
  project.endDate,
  project.autoEstimateDays,
  settings,
  holidays
)

dailyHours = project.estimatedHours / workingDays.length

FOR each working day:
  estimate = { date, hours: dailyHours, projectId, source: 'auto-estimate' }
```

**Implementation**: `calculateProjectDayEstimates()`

**Location**: `src/services/calculations/projects/dayEstimateCalculations.ts`

**Parameters**:
- `project: Project` - Project to calculate for
- `settings: Settings` - Work schedule
- `holidays: Holiday[]` - Days to exclude

**Returns**: `DayEstimate[]`

**Use Case**: When project has no milestones, distribute budget evenly

---

### 17. Working Day Check for Estimates

**Purpose**: Determine if a specific date should show day estimates

**Formula**:
```
isWorkingDay =
  project.autoEstimateDays[dayOfWeek] === true
  AND date is not a holiday
```

**Implementation**: `isWorkingDayForEstimates()`

**Location**: `src/services/calculations/projects/dayEstimateCalculations.ts`

**Parameters**:
- `date: Date` - Date to check
- `settings: Settings` - Work schedule
- `holidays: Holiday[]` - Holiday list
- `project?: Project` - Project context

**Returns**: `boolean`

**Fallback**: If project.autoEstimateDays not specified, uses settings.weeklyWorkHours

---

## Working Days Calculations

### 18. Total Working Days

**Purpose**: Count working days between two dates

**Formula**:
```
workingDaysCount = 0

FOR each day from startDate to endDate:
  IF isWorkingDay(day, settings, holidays) THEN
    workingDaysCount++
```

**Implementation**: `calculateTotalWorkingDays()`

**Location**: `src/services/calculations/projects/projectCalculations.ts`

**Parameters**:
- `startDate: Date`
- `endDate: Date`
- `settings: ProjectWorkingDaysSettings` - Must have weeklyWorkHours
- `holidays: Holiday[]`

**Returns**: `number` - Count of working days

**Working Day Definition**: Day has work hour slots configured AND not a holiday

---

### 19. Working Days Remaining

**Purpose**: Calculate working days from tomorrow until end date

**Formula**:
```
tomorrow = today + 1 day
workingDaysCount = 0

FOR each day from tomorrow to endDate:
  IF isWorkingDay(day, settings, holidays) THEN
    workingDaysCount++
```

**Implementation**: `calculateWorkingDaysRemaining()`

**Location**: `src/services/calculations/projects/projectCalculations.ts`

**Parameters**:
- `endDate: Date` - Target date
- `settings: ProjectWorkingDaysSettings`
- `holidays: Holiday[]`

**Returns**: `number` - Working days from tomorrow

---

### 20. Get Working Days Between (Array)

**Purpose**: Get actual array of working date objects

**Formula**: Same as Total Working Days, but returns Date[]

**Implementation**: `getWorkingDaysBetween()`

**Locations** (⚠️ DUPLICATE):
- `src/services/calculations/projects/projectCalculations.ts`
- `src/services/calculations/projects/dayEstimateCalculations.ts`

**Parameters**:
- `startDate: Date`
- `endDate: Date`
- `settings: Settings` OR parameters for filtering
- `holidays: Holiday[]`
- `project?: Project` (dayEstimate version)

**Returns**: `Date[]` - Array of working dates

---

### 21. Project Working Days

**Purpose**: Calculate working days for a project considering autoEstimateDays

**Formula**:
```
FOR each day from project.startDate to project.endDate:
  dayOfWeek = day.getDay()
  dayName = ['sunday', 'monday', ...][dayOfWeek]
  
  IF project.autoEstimateDays[dayName] === true
  AND day is not holiday THEN
    include day
```

**Implementation**: `calculateProjectWorkingDays()`

**Locations** (⚠️ DUPLICATE):
- `src/services/calculations/projects/milestoneCalculations.ts`
- `src/services/calculations/availability/capacityCalculations.ts`

**Parameters**:
- `project: Project` - Must have autoEstimateDays
- `holidays: Date[]` OR `Holiday[]`

**Returns**: `Date[]`

---

### 22. Business Days Between

**Purpose**: Calculate business days (Mon-Fri) excluding holidays

**Formula**:
```
businessDays = 0

FOR each day from startDate to endDate:
  dayOfWeek = day.getDay()
  IF dayOfWeek !== 0 AND dayOfWeek !== 6  // Not weekend
  AND day not in holidays THEN
    businessDays++
```

**Implementation**: `calculateBusinessDaysBetween()`

**Location**: `src/services/calculations/general/dateCalculations.ts`

**Parameters**:
- `startDate: Date`
- `endDate: Date`
- `holidays: Date[]`

**Returns**: `number`

**Note**: Hardcoded Mon-Fri, doesn't use settings

---

## Availability & Capacity Calculations

### 23. Work Hour Capacity

**Purpose**: Calculate total capacity and allocated hours for a day

**Formula**:
```
totalHours = SUM(workHour.duration for all work hours on date)

allocatedHours = 0
FOR each event on date:
  FOR each workHour on date:
    overlap = calculateTimeOverlap(event, workHour)
    allocatedHours += overlap

availableHours = MAX(totalHours - allocatedHours, 0)
```

**Implementation**: `calculateWorkHourCapacity()`

**Location**: `src/services/calculations/availability/capacityCalculations.ts`

**Parameters**:
- `workHours: WorkHour[]` - Work hour blocks
- `events: CalendarEvent[]` - Scheduled events
- `date: Date` - Date to analyze

**Returns**: `WorkHourCapacity`
```typescript
{
  totalHours: number;      // Total work capacity
  allocatedHours: number;  // Hours with events
  availableHours: number;  // Remaining capacity
  events: CalendarEvent[]; // Overlapping events
}
```

---

### 24. Work Hour Utilization

**Purpose**: Calculate percentage of work hours utilized

**Formula**:
```
IF capacity.totalHours === 0 THEN
  utilization = 0
ELSE
  utilization = (capacity.allocatedHours / capacity.totalHours) * 100
```

**Implementation**: `calculateWorkHourUtilization()`

**Location**: `src/services/calculations/availability/capacityCalculations.ts`

**Parameters**:
- `capacity: WorkHourCapacity`

**Returns**: `number` - Percentage (0-100+)

---

### 25. Is Day Overbooked

**Purpose**: Check if scheduled work exceeds capacity

**Formula**:
```
isOverbooked = capacity.allocatedHours > capacity.totalHours
```

**Implementation**: `isDayOverbooked()`

**Location**: `src/services/calculations/availability/capacityCalculations.ts`

**Parameters**:
- `capacity: WorkHourCapacity`

**Returns**: `boolean`

---

### 26. Utilization Efficiency Analysis

**Purpose**: Classify utilization and provide recommendations

**Formula**:
```
percentage = (allocatedHours / totalHours) * 100

IF percentage > 100 THEN
  efficiency = 'overbooked'
  recommendation = "Reduce commitments or extend hours"
ELSE IF percentage >= 90 THEN
  efficiency = 'high'
  recommendation = "Nearly at capacity"
ELSE IF percentage >= 70 THEN
  efficiency = 'optimal'
  recommendation = "Good balance"
ELSE
  efficiency = 'low'
  recommendation = "Capacity available"
```

**Implementation**: `analyzeUtilizationEfficiency()`

**Location**: `src/services/calculations/availability/capacityCalculations.ts`

**Parameters**:
- `capacity: WorkHourCapacity`

**Returns**: `UtilizationMetrics`

---

### 27. Availability Circle Sizing

**Purpose**: Calculate visual circle size for availability indicators

**Formula**:
```
IF mode === 'weeks' THEN
  scaledHours = targetHours / 5  // Week view requires 5x more hours
ELSE
  scaledHours = targetHours  // Day view

mainHours = MIN(scaledHours, 8)  // First 8 hours
extraHours = MIN(MAX(scaledHours - 8, 0), 7)  // Next 7 hours

pixelsPerHour = 3
outerDiameter = mainHours * pixelsPerHour
innerDiameter = extraHours * pixelsPerHour
```

**Implementation**: `calculateAvailabilityCircleSize()`

**Location**: `src/services/calculations/availability/availabilityCalculations.ts`

**Parameters**:
- `targetHours: number` - Hours to visualize
- `mode: 'days' | 'weeks'` - Timeline view mode

**Returns**: `AvailabilityCircleSizing`
```typescript
{
  outerDiameter: number;   // Main circle size (0-24px)
  innerDiameter: number;   // Inner circle size (0-21px)
  pixelsPerHour: number;   // Always 3
}
```

**Business Logic**:
- Day view: 8 hours = full circle (24px)
- Week view: 40 hours (5×8) = same full circle
- Consistent visual scale across views

---

### 28. Committed Hours for Date

**Purpose**: Calculate total hours committed (events + auto-estimates) for a specific date

**Formula**:
```
eventHours = SUM(event.duration for events on date)

IF eventHours > 0 THEN
  // Events block estimates
  committedHours = eventHours
ELSE
  // Show auto-estimate
  autoEstimate = calculateDayEstimate(date, project, milestones)
  committedHours = autoEstimate
```

**Implementation**: `calculateCommittedHoursForDate()`

**Location**: `src/services/calculations/availability/capacityCalculations.ts`

**Parameters**:
- `date: Date`
- `events: CalendarEvent[]`
- `projects: Project[]`
- `milestones: Milestone[]`

**Returns**: `number` - Total committed hours

---

## Event Calculations

### 29. Event Duration on Date

**Purpose**: Calculate how many hours of an event fall on a specific date

**Formula**:
```
dayStart = date at 00:00:00
dayEnd = date at 23:59:59

eventStart = MAX(event.startTime, dayStart)
eventEnd = MIN(event.endTime, dayEnd)

IF eventEnd <= eventStart THEN
  duration = 0
ELSE
  duration = (eventEnd - eventStart) in hours
```

**Implementation**: `calculateEventDurationOnDate()`

**Location**: `src/services/calculations/events/eventCalculations.ts`

**Parameters**:
```typescript
{
  event: CalendarEvent;
  date: Date;
}
```

**Returns**: `number` - Hours on that specific date

**Use**: Multi-day events spanning multiple dates

---

### 30. Event Total Duration

**Purpose**: Calculate total duration of an event across all dates

**Formula**:
```
totalDuration = (event.endTime - event.startTime) in hours
```

**Implementation**: `calculateEventTotalDuration()`

**Location**: `src/services/calculations/events/eventCalculations.ts`

**Parameters**:
- `event: CalendarEvent`
- `dates?: Date[]` - Optional specific dates to sum

**Returns**: `number` - Total hours

---

### 31. Live Tracking Duration

**Purpose**: Calculate duration from start time to now (for active tracking)

**Formula**:
```
now = new Date()
duration = (now - event.startTime) in hours
```

**Implementation**: `calculateLiveTrackingDuration()`

**Location**: `src/services/calculations/events/eventCalculations.ts`

**Parameters**:
```typescript
{
  startTime: Date;
  endTime?: Date;  // If provided, use instead of now
}
```

**Returns**: `number` - Current elapsed hours

---

### 32. Aggregate Event Durations by Date

**Purpose**: Sum all event hours per date

**Formula**:
```
durationMap = {}

FOR each event:
  FOR each date the event spans:
    duration = calculateEventDurationOnDate(event, date)
    dateKey = formatDate(date)
    durationMap[dateKey] += duration
```

**Implementation**: `aggregateEventDurationsByDate()`

**Location**: `src/services/calculations/events/eventCalculations.ts`

**Parameters**:
- `events: CalendarEvent[]`
- `startDate: Date`
- `endDate: Date`

**Returns**: `Map<string, number>` - dateKey → total hours

---

### 33. Find Overlapping Events

**Purpose**: Find events that overlap with a given time range

**Formula**:
```
FOR each event:
  IF event.startTime < target.endTime
  AND event.endTime > target.startTime THEN
    event overlaps
```

**Implementation**: `findOverlappingEvents()`

**Location**: `src/services/calculations/events/eventCalculations.ts`

**Parameters**:
```typescript
{
  events: CalendarEvent[];
  startTime: Date;
  endTime: Date;
  excludeEventId?: string;
}
```

**Returns**: `CalendarEvent[]` - Overlapping events

---

### 34. Generate Recurring Events

**Purpose**: Create virtual instances of a recurring event

**Formula**: Varies by pattern type

**Daily Pattern**:
```
FOR day = startDate; day <= endDate; day += interval days:
  IF day matches pattern THEN
    create instance
```

**Weekly Pattern**:
```
FOR day in dateRange:
  IF day.dayOfWeek === pattern.weeklyDayOfWeek
  AND (day - startDate) % (interval * 7 days) === 0 THEN
    create instance
```

**Monthly Pattern**:
```
FOR month in dateRange:
  targetDate = calculateMonthlyDate(pattern)
  IF targetDate exists and in range THEN
    create instance
```

**Implementation**: `generateRecurringEvents()`

**Location**: `src/services/calculations/events/eventCalculations.ts`

**Parameters**:
```typescript
{
  baseEvent: CalendarEvent;
  startDate: Date;
  endDate: Date;
}
```

**Returns**: `CalendarEvent[]` - Virtual instances

---

## Date & Time Calculations

### 35. Duration in Hours

**Purpose**: Calculate time difference in hours

**Formula**:
```
milliseconds = endTime - startTime
hours = milliseconds / (1000 * 60 * 60)
```

**Implementation**: `calculateDurationHours()`

**Location**: `src/services/calculations/general/dateCalculations.ts`

**Parameters**:
- `startTime: Date`
- `endTime: Date`

**Returns**: `number` - Hours (can be fractional)

---

### 36. Duration in Minutes

**Purpose**: Calculate time difference in minutes

**Formula**:
```
milliseconds = endTime - startTime
minutes = milliseconds / (1000 * 60)
```

**Implementation**: `calculateDurationMinutes()`

**Location**: `src/services/calculations/general/dateCalculations.ts`

**Parameters**:
- `startTime: Date`
- `endTime: Date`

**Returns**: `number` - Minutes

---

### 37. Duration in Days

**Purpose**: Calculate date difference in calendar days

**Formula**:
```
start = startDate at 00:00:00
end = endDate at 00:00:00
days = (end - start) / (1000 * 60 * 60 * 24)
days = CEILING(days)  // Round up partial days
```

**Implementation**: `calculateDurationDays()`

**Location**: `src/services/calculations/general/dateCalculations.ts`

**Parameters**:
- `startDate: Date`
- `endDate: Date`

**Returns**: `number` - Calendar days

---

### 38. Time Overlap Hours

**Purpose**: Calculate overlapping time between two periods in hours

**Formula**:
```
overlapStart = MAX(start1, start2)
overlapEnd = MIN(end1, end2)

IF overlapEnd <= overlapStart THEN
  overlap = 0
ELSE
  overlap = (overlapEnd - overlapStart) in hours
```

**Implementation**: `calculateTimeOverlapHours()` or `calculateTimeOverlap()`

**Locations**:
- `src/services/calculations/general/dateCalculations.ts`
- `src/services/calculations/availability/capacityCalculations.ts`

**Parameters**:
- `start1: Date`, `end1: Date` - First period
- `start2: Date`, `end2: Date` - Second period

**Returns**: `number` - Overlapping hours

---

### 39. Date Range Overlap

**Purpose**: Check if two date ranges overlap

**Formula**:
```
overlap = (start1 < end2) AND (end1 > start2)
```

**Implementation**: `datesOverlap()`

**Location**: `src/services/calculations/general/dateCalculations.ts`

**Parameters**:
- `start1: Date`, `end1: Date`
- `start2: Date`, `end2: Date`

**Returns**: `boolean`

---

### 40. Add Business Days

**Purpose**: Add N business days to a date

**Formula**:
```
currentDate = startDate
daysAdded = 0

WHILE daysAdded < businessDays:
  currentDate += 1 day
  IF isBusinessDay(currentDate, holidays) THEN
    daysAdded++

RETURN currentDate
```

**Implementation**: `addBusinessDays()`

**Location**: `src/services/calculations/general/dateCalculations.ts`

**Parameters**:
- `startDate: Date`
- `businessDays: number`
- `holidays: Date[]`

**Returns**: `Date`

---

### 41. Is Same Day

**Purpose**: Check if two dates are the same calendar day

**Formula**:
```
sameDay = date1.year === date2.year
  AND date1.month === date2.month
  AND date1.day === date2.day
```

**Implementation**: `isSameDay()`

**Location**: `src/services/calculations/general/dateCalculations.ts`

**Parameters**:
- `date1: Date`
- `date2: Date`

**Returns**: `boolean`

---

### 42. Week Start

**Purpose**: Get the start of the week (Sunday) for a given date

**Formula**:
```
dayOfWeek = date.getDay()  // 0=Sunday, 6=Saturday
daysToSubtract = dayOfWeek
weekStart = date - daysToSubtract days
weekStart at 00:00:00
```

**Implementation**: `getWeekStart()`

**Location**: `src/services/calculations/general/timeCalculations.ts`

**Parameters**:
- `date: Date`

**Returns**: `Date` - Sunday at midnight

---

### 43. Format Duration

**Purpose**: Format hours into human-readable string

**Formula**:
```
IF hours < 1 THEN
  minutes = hours * 60
  RETURN "{minutes}m"
ELSE
  wholeHours = FLOOR(hours)
  minutes = (hours - wholeHours) * 60
  IF minutes > 0 THEN
    RETURN "{wholeHours}h {minutes}m"
  ELSE
    RETURN "{wholeHours}h"
```

**Implementation**: `formatDuration()`

**Location**: `src/services/calculations/general/dateCalculations.ts`

**Parameters**:
- `hours: number`

**Returns**: `string` - Formatted (e.g., "2h 30m", "45m", "8h")

---

## Budget & Utilization Calculations

*See sections above for:*
- Budget Utilization (#7)
- Remaining Budget (#8)
- Budget Overage (#9)
- Work Hour Utilization (#24)
- Utilization Efficiency (#26)

---

## Analytics & Insights Calculations

### 44. Weekly Capacity

**Purpose**: Calculate total work capacity for a week

**Formula**:
```
totalCapacity = 0

FOR each day of week:
  FOR each work slot on that day:
    totalCapacity += slot.duration
```

**Implementation**: `calculateWeeklyCapacity()`

**Location**: `src/services/calculations/insights/analyticsCalculations.ts`

**Parameters**:
- `weeklyWorkHours: WeeklyWorkHours`

**Returns**: `number` - Total hours per week

---

### 45. Daily Capacity

**Purpose**: Calculate work capacity for a specific day

**Formula**:
```
dayOfWeek = date.getDay()
dayName = ['sunday', 'monday', ...][dayOfWeek]
workSlots = weeklyWorkHours[dayName]

capacity = SUM(slot.duration for all slots)
```

**Implementation**: `calculateDailyCapacity()`

**Location**: `src/services/calculations/insights/analyticsCalculations.ts`

**Parameters**:
- `date: Date`
- `weeklyWorkHours: WeeklyWorkHours`

**Returns**: `number` - Hours available that day

---

### 46. Work Utilization

**Purpose**: Calculate what percentage of capacity is being used

**Formula**:
```
totalCapacity = calculateWeeklyCapacity(weeklyWorkHours)
totalPlanned = SUM(event.duration for all events)

IF totalCapacity === 0 THEN
  utilization = 0
ELSE
  utilization = (totalPlanned / totalCapacity) * 100
```

**Implementation**: `calculateWorkUtilization()`

**Location**: `src/services/calculations/insights/analyticsCalculations.ts`

**Parameters**:
- `events: CalendarEvent[]`
- `weeklyWorkHours: WeeklyWorkHours`
- `startDate: Date`
- `endDate: Date`

**Returns**: `number` - Percentage

---

### 47. Daily Totals (Planner Insights)

**Purpose**: Sum event hours per day

**Formula**:
```
dailyTotals = {}

FOR each event:
  dateKey = formatDate(event.date)
  dailyTotals[dateKey] += event.duration * 60  // Convert to minutes
```

**Implementation**: `calculateDailyTotals()`

**Location**: `src/services/calculations/insights/plannerInsightCalculations.ts`

**Parameters**:
- `events: CalendarEvent[]`
- `startDate: Date`
- `endDate: Date`

**Returns**: `{ [dateKey: string]: number }` - Minutes per day

---

### 48. Group Statistics

**Purpose**: Calculate project counts and totals for a group

**Formula**:
```
FOR each project in group:
  totalProjects++
  totalBudget += project.estimatedHours
  totalAllocated += SUM(milestone.timeAllocationHours for project)
  
  IF project.status === 'current' THEN
    activeProjects++
```

**Implementation**: `calculateGroupStatistics()`

**Location**: `src/services/calculations/groups/groupCalculations.ts`

**Parameters**:
- `projects: Project[]` - Projects in group
- `milestones: Milestone[]` - All milestones

**Returns**:
```typescript
{
  totalProjects: number;
  activeProjects: number;
  totalBudget: number;
  totalAllocated: number;
  averageUtilization: number;
}
```

---

## Calculation Dependencies

### Core Dependencies

```
Date & Time Calculations (base layer)
  ├─ calculateDurationHours()
  ├─ calculateDurationMinutes()
  ├─ calculateDurationDays()
  ├─ calculateTimeOverlapHours()
  └─ datesOverlap()

Working Days Calculations (depends on Date & Time)
  ├─ isWorkingDay()
  ├─ calculateBusinessDaysBetween()
  ├─ getWorkingDaysBetween()
  └─ calculateProjectWorkingDays()

Project Calculations (depends on Working Days)
  ├─ calculateAutoEstimateWorkingDays()
  ├─ calculateAutoEstimateHoursPerDay()
  └─ calculateProjectDuration()

Milestone Calculations (depends on Project)
  ├─ calculateTotalAllocation()
  ├─ calculateBudgetUtilization()
  ├─ calculateMilestoneSegments()
  └─ calculateRecurringMilestoneCount()

Day Estimate Calculations (depends on Milestone + Working Days)
  ├─ calculateMilestoneDayEstimates()
  ├─ calculateRecurringMilestoneDayEstimates()
  └─ calculateProjectDayEstimates()

Event Calculations (depends on Date & Time)
  ├─ calculateEventDurationOnDate()
  ├─ findOverlappingEvents()
  └─ generateRecurringEvents()

Availability Calculations (depends on Event + Working Days)
  ├─ calculateWorkHourCapacity()
  ├─ calculateWorkHourUtilization()
  └─ calculateAvailabilityCircleSize()

Analytics Calculations (depends on all above)
  ├─ calculateWeeklyCapacity()
  ├─ calculateWorkUtilization()
  └─ calculateGroupStatistics()
```

---

## Calculation Duplication Audit

### ⚠️ DUPLICATE: Working Days Calculations

**Function**: `getWorkingDaysBetween()`

**Locations**:
1. `src/services/calculations/projects/projectCalculations.ts` - Lines 243-264
2. `src/services/calculations/projects/dayEstimateCalculations.ts` - Lines 61-82

**Differences**:
- `projectCalculations.ts` version: Uses `settings.weeklyWorkHours` to check work slots
- `dayEstimateCalculations.ts` version: Uses `project.autoEstimateDays` to check enabled days

**Status**: Different purposes, but confusing naming

**Recommendation**: Rename to clarify:
- `getWorkingDaysByWorkHours()` - Uses work hour slots
- `getWorkingDaysByAutoEstimate()` - Uses autoEstimateDays

---

### ⚠️ DUPLICATE: Project Working Days

**Function**: `calculateProjectWorkingDays()`

**Locations**:
1. `src/services/calculations/projects/milestoneCalculations.ts` - Lines 567-598
2. `src/services/calculations/availability/capacityCalculations.ts` - Lines 568-579

**Differences**:
- Both use `project.autoEstimateDays`
- `milestoneCalculations.ts`: More detailed, handles holidays as objects
- `capacityCalculations.ts`: Delegates to UnifiedEventWorkHourService (noted in comments)

**Status**: `capacityCalculations.ts` is re-exporting from unified service

**Recommendation**: Remove from milestoneCalculations, use unified service everywhere

---

### ⚠️ DUPLICATE: Calculate Daily Totals

**Function**: `calculateDailyTotals()`

**Locations**:
1. `src/services/calculations/insights/plannerInsightCalculations.ts` - Lines 24-64
2. `src/services/calculations/insights/plannerInsights.ts` - Lines 179-215

**Differences**:
- Both calculate same thing
- Different implementations (minor variations)

**Status**: Older service and newer service both exist

**Recommendation**: Consolidate to `plannerInsightCalculations.ts`, deprecate old service

---

### ⚠️ DUPLICATE: Time Overlap

**Function**: `calculateTimeOverlap()`

**Locations**:
1. `src/services/calculations/general/dateCalculations.ts` - `calculateTimeOverlapHours()` and `calculateTimeOverlapMinutes()`
2. `src/services/calculations/availability/capacityCalculations.ts` - `calculateTimeOverlap()` (delegates to dateCalculations)

**Status**: capacityCalculations correctly delegates to single source

**Recommendation**: None - this is correct pattern

---

### ⚠️ SHADOW: Domain Rules vs Calculations

**Functions**: Budget and milestone calculations exist in TWO places:

**Domain Rules** (`src/domain/rules/`):
- `ProjectRules.analyzeBudget()`
- `ProjectRules.calculateTotalMilestoneAllocation()`
- `MilestoneRules.calculateTotalAllocation()`
- `MilestoneRules.calculateBudgetUtilization()`
- `MilestoneRules.calculateRemainingBudget()`

**Calculations** (`src/services/calculations/`):
- `milestoneCalculations.calculateTotalAllocation()`
- `milestoneCalculations.calculateBudgetUtilization()`
- `milestoneCalculations.calculateRemainingBudget()`

**Status**: Intentional duplication - domain rules are business logic, calculations are implementation

**Recommendation**: 
- Calculations should CALL domain rules, not duplicate them
- Domain rules = "what the rules are"
- Calculations = "how to compute them efficiently"

---

## Quick Reference Table

| Calculation | Primary Location | Returns | Key Parameters |
|-------------|-----------------|---------|----------------|
| Project Duration | `ProjectRules` | `number` | project |
| Project Budget Analysis | `ProjectRules` | `ProjectBudgetAnalysis` | project, milestones |
| Auto-Estimate Working Days | `projectCalculations` | `Date[]` | dates, autoEstimateDays, holidays |
| Auto-Estimate Hours/Day | `projectCalculations` | `number` | project, settings, holidays |
| Total Milestone Allocation | `MilestoneRules` | `number` | milestones |
| Budget Utilization % | `MilestoneRules` | `number` | total, budget |
| Remaining Budget | `MilestoneRules` | `number` | total, budget |
| Milestone Segments | `milestoneCalculations` | `MilestoneSegment[]` | milestones, project, settings |
| Milestone Day Estimates | `dayEstimateCalculations` | `DayEstimate[]` | milestone, project, settings |
| Project Day Estimates | `dayEstimateCalculations` | `DayEstimate[]` | project, settings, holidays |
| Work Hour Capacity | `capacityCalculations` | `WorkHourCapacity` | workHours, events, date |
| Utilization % | `capacityCalculations` | `number` | capacity |
| Is Overbooked | `capacityCalculations` | `boolean` | capacity |
| Availability Circle Size | `availabilityCalculations` | `AvailabilityCircleSizing` | hours, mode |
| Event Duration on Date | `eventCalculations` | `number` | event, date |
| Overlapping Events | `eventCalculations` | `CalendarEvent[]` | events, timeRange |
| Duration Hours | `dateCalculations` | `number` | start, end |
| Time Overlap | `dateCalculations` | `number` | two time ranges |
| Business Days Between | `dateCalculations` | `number` | start, end, holidays |
| Is Same Day | `dateCalculations` | `boolean` | date1, date2 |
| Week Start | `timeCalculations` | `Date` | date |

---

## Usage Guidelines

### When to Use Domain Rules vs Calculations

**Use Domain Rules** (`src/domain/rules/`) when:
- Validating business constraints
- Checking if something is allowed
- Enforcing invariants
- Making business decisions

**Use Calculations** (`src/services/calculations/`) when:
- Computing mathematical results
- Transforming data
- Aggregating values
- Preparing data for display

**Example**:
```typescript
// ❌ DON'T: Duplicate logic
const total = milestones.reduce((sum, m) => sum + m.hours, 0);

// ✅ DO: Use existing calculation
const total = MilestoneRules.calculateTotalAllocation(milestones);

// ✅ DO: Calculations can use domain rules
export function analyzeMilestones(milestones, projectBudget) {
  const total = MilestoneRules.calculateTotalAllocation(milestones);
  const utilization = MilestoneRules.calculateBudgetUtilization(milestones, projectBudget);
  
  return { total, utilization };
}
```

---

## Next Steps for Consolidation

1. **Audit Complete**: See duplication section above
2. **Resolve Duplicates**: 
   - Rename confusing functions
   - Remove true duplicates
   - Ensure calculations delegate to domain rules
3. **Update Documentation**: Keep this reference current
4. **Create Tests**: Validate all calculations with unit tests
5. **Migration Guide**: Help developers find the right calculation

---

**End of Calculation Reference v1.0.0**
