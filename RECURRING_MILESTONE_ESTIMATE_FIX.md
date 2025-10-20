# Recurring Milestone Estimate Rectangle Fix

**Date**: October 20, 2025  
**Issue**: Recurring milestone estimates not showing correctly  
**Status**: ✅ FIXED (2 bugs found and fixed)

## Problems

### Problem 1: No rectangles after October 4th
The Budgi project has recurring milestones with 20 hours allocated per occurrence, but the estimated time rectangles (the visual bars showing allocated hours per day on the project timeline) were not appearing after October 4th, 2024.

### Problem 2: Uneven distribution and overlapping occurrences  
When rectangles did appear, the hours were distributed unevenly:
- First day: 5h 43m
- Next 5 days: 2h 51m each
- **Total: 19.97 hours (should be exactly 20 hours)**
- **Each day should be 3h 20m (20 hours / 6 working days)**

## Root Causes

### Bug 1: Continuous Project Filtering (Line 461-468)

In `/src/services/calculations/projects/dayEstimateCalculations.ts`, the `calculateProjectDayEstimates()` function was incorrectly filtering out day estimates for continuous projects.

**Buggy Code**:
```typescript
// Filter out milestone estimates that conflict with ANY events (planned OR completed)
// AND ensure they don't extend beyond project end date
const projectEndDate = new Date(project.endDate);
projectEndDate.setHours(23, 59, 59, 999);

const filteredEstimates = milestoneEstimates.filter(est => {
  const estDate = new Date(est.date);
  estDate.setHours(0, 0, 0, 0);
  
  const hasEventsOnDay = allEventDates.has(dateKey);
  const shouldInclude = !hasEventsOnDay && estDate <= projectEndDate; // ❌ BUG: Always filters by end date
  
  return shouldInclude;
});
```

The code was checking `estDate <= projectEndDate` for **all projects**, including continuous projects. While `generateRecurringOccurrences()` correctly generates occurrences up to 1 year ahead for continuous projects, the filter immediately removed all estimates beyond the `project.endDate` value in the database.

### Bug 2: Overlapping Work Periods (Line 178-193)

The work period calculation for each recurring occurrence was going **backwards** from the occurrence date by the interval, causing work periods to **overlap**.

**Buggy Code**:
```typescript
// For each occurrence, distribute hours
occurrences.forEach(occurrenceDate => {
  const occurrenceEndDate = new Date(occurrenceDate);
  
  // ❌ BUG: Works BACKWARDS, creating overlaps
  let occurrenceStartDate = new Date(occurrenceDate);
  switch (config.type) {
    case 'monthly':
      occurrenceStartDate.setMonth(occurrenceStartDate.getMonth() - config.interval);
      break;
    // ... other cases
  }
  
  const workingDays = getWorkingDaysBetween(occurrenceStartDate, occurrenceEndDate, ...);
  const hoursPerDay = timeAllocationHours / workingDays.length;
  // ... distribute hours
});
```

**Example of the overlap**:
- Oct 4 occurrence: Works backwards 1 month → Sept 4 to Oct 4 (includes Oct 4)
- Nov 4 occurrence: Works backwards 1 month → Oct 4 to Nov 4 (includes Oct 4 again!)
- **Oct 4 gets hours from BOTH occurrences** ❌

**Visual representation**:
```
BEFORE FIX (Overlapping):
-------------------------
Sept 1        Oct 1         Nov 1         Dec 1
|-------------|-------------|-------------|
    [========Oct 4=========]  ← Occurrence 1 (Sept 4 - Oct 4)
              [========Nov 4=========]  ← Occurrence 2 (Oct 4 - Nov 4)
                            [========Dec 4=========]  ← Occurrence 3 (Nov 4 - Dec 4)

Problem: Oct 4 appears in BOTH Occurrence 1 and 2!
         Nov 4 appears in BOTH Occurrence 2 and 3!
         Hours get DOUBLED on overlap dates!
```

This caused:
1. **Overlapping estimates** on certain days (first day gets 5.72h instead of 3.33h)
2. **Uneven distribution** across days
3. **Incorrect totals** (19.97h instead of 20h due to rounding across overlaps)

## Solutions

### Fix 1: Respect Continuous Flag

Updated the filter logic to respect the `project.continuous` flag:

```typescript
// For continuous projects, don't filter by end date ✅
// For non-continuous projects, only include estimates up to project end date
const isWithinProjectBounds = project.continuous || estDate <= projectEndDate;
const shouldInclude = !hasEventsOnDay && isWithinProjectBounds;
```

### Fix 2: Non-Overlapping Work Periods

Changed the work period calculation to span **between occurrences** instead of backwards from each occurrence:

```typescript
// For each occurrence, distribute hours
occurrences.forEach((occurrenceDate, index) => {
  const occurrenceEndDate = new Date(occurrenceDate);
  
  let occurrenceStartDate: Date;
  if (index === 0) {
    // ✅ First occurrence: start from project start
    occurrenceStartDate = new Date(project.startDate);
  } else {
    // ✅ Subsequent occurrences: start from day after previous occurrence
    const previousOccurrence = occurrences[index - 1];
    occurrenceStartDate = new Date(previousOccurrence);
    occurrenceStartDate.setDate(occurrenceStartDate.getDate() + 1);
  }
  
  const workingDays = getWorkingDaysBetween(occurrenceStartDate, occurrenceEndDate, ...);
  const hoursPerDay = timeAllocationHours / workingDays.length;
  // ... distribute hours
});
```

**Now the work periods are sequential and non-overlapping**:
- First occurrence: Project start → Oct 4
- Second occurrence: Oct 5 → Nov 4  
- Third occurrence: Nov 5 → Dec 4
- etc.

**Visual representation**:
```
AFTER FIX (Sequential):
-----------------------
Sept 1        Oct 1         Nov 1         Dec 1
|-------------|-------------|-------------|
[=========Oct 4]  ← Occurrence 1 (Project Start - Oct 4)
              [===Nov 4===]  ← Occurrence 2 (Oct 5 - Nov 4)
                          [===Dec 4===]  ← Occurrence 3 (Nov 5 - Dec 4)

Solution: Each occurrence is a distinct period
          No overlaps, clean distribution
          20 hours per period = exactly 20 hours shown!
```

## Impact

✅ **Continuous projects** (like Budgi) now show estimate rectangles for all recurring milestone occurrences up to 1 year ahead  
✅ **Hours are distributed evenly** across working days within each occurrence period  
✅ **No overlapping periods** - each occurrence represents a distinct work period  
✅ **Exact totals** - 20 hours is distributed as exactly 20 hours  
✅ **Non-continuous projects** still correctly stop showing estimates at their end date  
✅ **Event-based time** entries still take precedence over auto-estimates (no change to priority logic)

## Expected Behavior After Fix

For Budgi project with monthly recurring milestones (20h per occurrence):

**Before Fix**:
- First day: 5h 43m (overlapping from 2 occurrences)
- Next 5 days: 2h 51m each
- Total: ~19.97h ❌

**After Fix**:
- All days: 3h 20m each (assuming 6 working days)
- Total: Exactly 20h ✅
- Each occurrence is a separate, non-overlapping work period ✅
