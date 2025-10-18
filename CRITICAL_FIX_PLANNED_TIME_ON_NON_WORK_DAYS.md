# CRITICAL FIX: Planned Time on Non-Work Days - October 18, 2025

## Problem Statement
When tracking time or scheduling events on weekends/holidays (non-work days), the timeline rectangles were not appearing on the project bars, even though these should always be visible regardless of work day settings.

**Example scenario:**
- User is tracking time on Saturday for "Budgi" project
- Saturday has 0 work hours configured (non-work day)
- Expected: Light green "completed" rectangle should appear
- Actual: No rectangle shown

## Root Cause Analysis

The bug was in the **order of checks** in `getProjectTimeAllocation()` function:

```typescript
// ❌ OLD LOGIC (BROKEN)
1. Check if day is a working day
2. If NOT working day → return { type: 'none' }
3. Check for planned time (never reached on non-work days!)
```

This meant planned/tracked time was never detected on non-work days because the function returned early.

## The Fix

### Primary Fix: `src/services/unified/UnifiedEventWorkHourService.ts`

Reordered the logic to check planned time FIRST:

```typescript
// ✅ NEW LOGIC (CORRECT)
1. Check for planned time (calendar events)
2. If planned time exists → return { type: 'planned' }
3. Check if day is a working day
4. If NOT working day → return { type: 'none' }
5. Calculate auto-estimate
```

**Code change:**
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

### Secondary Fix: `src/components/timeline/TimelineBar.tsx`

Added defensive checks in the rendering logic (both weeks and days mode) to ensure work day restrictions only apply to auto-estimate:

```typescript
// Get time allocation first
const allocation = TimeAllocationService.generateTimeAllocation(...);

// If no allocation at all, skip
if (allocation.type === 'none') {
  return <div ...></div>;
}

// For auto-estimate only, check work day restrictions
if (allocation.type === 'auto-estimate') {
  // Check work hours, holidays, autoEstimateDays
  if (!isDayWorking || !isDayEnabled) {
    return <div ...></div>;
  }
}
// For planned/completed time, always show regardless of work day settings
```

## Expected Behavior After Fix

### ✅ Planned Time (Blue Rectangles with Dashed Border)
- **ALWAYS visible** on all days (weekdays, weekends, holidays)
- Represents calendar events scheduled for the project
- Example: Calendar event on Sunday → shows blue rectangle

### ✅ Completed/Tracked Time (Light Green Rectangles)
- **ALWAYS visible** on all days (weekdays, weekends, holidays)
- Represents actual time worked/tracked
- Example: Tracking time on Saturday → shows light green rectangle

### ✅ Auto-Estimate Time (Gray Rectangles)
- **Respects work day settings** (only shows on work days)
- Hidden on weekends if weekends are disabled
- Hidden on holidays
- Hidden on days with zero work hours
- Controlled by project's `autoEstimateDays` settings

## Testing Scenarios

1. ✅ **Track time on Saturday**: Should show light green rectangle even if Saturday is disabled
2. ✅ **Schedule event on Sunday**: Should show blue rectangle even if Sunday is disabled
3. ✅ **Complete event on holiday**: Should show light green rectangle on holiday
4. ✅ **Auto-estimate on weekend**: Should NOT show gray rectangle if weekend disabled
5. ✅ **Auto-estimate on holiday**: Should NOT show gray rectangle on holiday

## Technical Notes

### Cache Invalidation
The memoized cache key already includes events:
```typescript
const eventsHash = events
  .filter(e => e.projectId === projectId)
  .map(e => `${e.id}-${e.startTime.getTime()}-${e.endTime.getTime()}`)
  .sort()
  .join(',');
```

So the cache automatically invalidates when:
- New events are added
- Events are completed/tracked
- Event times are changed

### Work Day Determination
Three factors determine if a day is a "work day":
1. **Not a holiday**: Defined in holidays configuration
2. **Has work hours**: Settings → Weekly Work Hours > 0
3. **Project-enabled**: Project's `autoEstimateDays` setting (only affects auto-estimate)

### Why This Matters
This fix ensures that **manual time management** (planning and tracking) is completely independent from **automatic estimation**. Users should be able to plan work and track time on ANY day, while auto-estimates respect their configured work schedule.

## Files Changed
1. `/src/services/unified/UnifiedEventWorkHourService.ts` - Primary fix (reordered logic)
2. `/src/components/timeline/TimelineBar.tsx` - Secondary fix (defensive checks)
3. `/WORK_DAY_RESTRICTION_FIX.md` - Updated documentation
4. `/CRITICAL_FIX_PLANNED_TIME_ON_NON_WORK_DAYS.md` - This file

## Impact
- **High Priority**: This was blocking users from seeing their tracked time on weekends
- **No Breaking Changes**: Only fixes incorrect behavior
- **Improved UX**: Users can now reliably track/plan time on any day
