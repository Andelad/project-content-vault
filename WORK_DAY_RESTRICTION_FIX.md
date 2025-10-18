# Work Day Restriction Fix - October 18, 2025

## Issue
Timeline project bars were not showing planned time and completed/tracked time rectangles on non-work days (weekends, holidays, etc.), even though work day restrictions should only apply to auto-estimates, not manual overrides.

## Root Cause
The core issue was in `UnifiedEventWorkHourService.ts` in the `getProjectTimeAllocation()` function. It was checking if a day was a working day **before** checking for planned time, causing it to return `{ type: 'none' }` for non-work days even when there were calendar events (planned/tracked time) scheduled.

## Solution
Reordered the logic in `getProjectTimeAllocation()` to:
1. **First** check for planned time (calendar events) - return immediately if found
2. **Then** check work day restrictions (only for auto-estimate)
3. Apply work day restrictions only to auto-estimate calculations

## Changes Made

### File: `src/services/unified/UnifiedEventWorkHourService.ts` (PRIMARY FIX)

**Before:**
```typescript
// Check if it's a working day
const isWorkingDay = !isHoliday && Array.isArray(workSlots) && 
  workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;

if (!isWorkingDay) {
  return { type: 'none', hours: 0, isWorkingDay: false };
}

// Check for planned time (events connected to this project)
const plannedHours = calculatePlannedTimeForDate(projectId, date, events);

if (plannedHours > 0) {
  return { type: 'planned', hours: plannedHours, isWorkingDay: true };
}
```

**After:**
```typescript
// IMPORTANT: Check for planned time FIRST, before checking work day status
// Planned/completed time should always show regardless of work day settings
const plannedHours = calculatePlannedTimeForDate(projectId, date, events);

if (plannedHours > 0) {
  // Return planned time even on non-work days
  return { type: 'planned', hours: plannedHours, isWorkingDay: true };
}

// Now check if it's a working day (only affects auto-estimate)
const isWorkingDay = !isHoliday && Array.isArray(workSlots) && 
  workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;

// For auto-estimate, respect work day restrictions
if (!isWorkingDay) {
  return { type: 'none', hours: 0, isWorkingDay: false };
}
```

### File: `src/components/timeline/TimelineBar.tsx` (SECONDARY FIX)

Added defensive checks to ensure work day restrictions are only applied to auto-estimate type in the rendering logic.

#### Weeks Mode (lines ~240-295)
**Before:**
```typescript
if (!isDayInProject || !isDayWorking || !isDayEnabled) {
  return <div key={dayOfWeek} style={{ width: `${dayWidth}px` }}></div>;
}
// Then get allocation...
```

**After:**
```typescript
// First check if day is in project range
if (!isDayInProject) {
  return <div key={dayOfWeek} style={{ width: `${dayWidth}px` }}></div>;
}

// Get time allocation first to determine if it's planned/completed or auto-estimate
const allocation = TimeAllocationService.generateTimeAllocation(...);

// If no allocation at all, skip
if (allocation.type === 'none') {
  return <div key={dayOfWeek} style={{ width: `${dayWidth}px` }}></div>;
}

// For auto-estimate only, check work day restrictions
if (allocation.type === 'auto-estimate') {
  // Check work hours, holidays, and autoEstimateDays
  if (!isDayWorking || !isDayEnabled) {
    return <div key={dayOfWeek} style={{ width: `${dayWidth}px` }}></div>;
  }
}
// For planned/completed time, always show regardless of work day settings
```

#### Days Mode (lines ~400-465)
Applied the same logic restructuring:
1. Check project day range first
2. Get time allocation
3. Apply work day restrictions only for auto-estimate type
4. Always render planned/completed time

## Expected Behavior

### Auto-Estimate Time (Gray Rectangles)
- **Respects** work day settings at both app and project level
- **Hidden** on holidays
- **Hidden** on days with zero work hours
- **Hidden** on days disabled in project's `autoEstimateDays` settings

### Planned Time (Blue/Dashed Border Rectangles)
- **Always shown** regardless of work day settings
- **Always shown** on holidays
- **Always shown** on weekends or non-work days
- Represents manual calendar events scheduled for the project

### Completed/Tracked Time (Light Green Rectangles)
- **Always shown** regardless of work day settings
- **Always shown** on holidays
- **Always shown** on weekends or non-work days
- Represents time that was actually worked/tracked

## Testing Recommendations

1. **Test auto-estimate on non-work days**: Verify gray rectangles don't appear on weekends when weekends are disabled
2. **Test planned time on non-work days**: Create a calendar event on a weekend - should show blue rectangle
3. **Test completed time on non-work days**: Mark an event as completed on a weekend - should show light green rectangle
4. **Test holidays**: Verify planned/completed still shows on holidays but auto-estimate doesn't
5. **Test project-level autoEstimateDays**: Disable specific days at project level - verify only auto-estimate is affected

## Technical Notes

- Work day restrictions are determined by three factors:
  1. **Holidays**: Defined in the holidays configuration
  2. **Work hours**: Set in app-level weekly work hours (zero hours = non-work day)
  3. **Project autoEstimateDays**: Project-specific day toggles for auto-estimation

- The fix maintains backward compatibility with all existing time allocation logic
- No changes were needed to the underlying `getProjectTimeAllocation()` function in `UnifiedEventWorkHourService.ts`
