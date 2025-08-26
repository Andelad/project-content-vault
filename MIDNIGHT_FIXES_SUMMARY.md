# Midnight Time Tracking Fixes

## Issues Resolved

This fix addresses three critical issues that occurred when time tracking crossed midnight:

### 1. Event didn't populate in the planner across midnight
**Problem**: Events spanning across midnight were only displayed on the start date, not continuing into the second day.

**Root Cause**: The calendar display logic only considered events based on their start date, not handling multi-day events.

**Solution**: 
- Created `splitMidnightCrossingEvents()` function that splits single events crossing midnight into separate events for each day
- Updated `PlannerView.tsx` to use split events for proper display
- Events now appear on both days with appropriate duration portions

### 2. Timeline view shows 207 planned hours
**Problem**: The timeline calculations were incorrectly computing massive durations for events crossing midnight.

**Root Cause**: Duration calculations used simple start/end time differences without considering date boundaries, leading to incorrect calculations for events spanning multiple days.

**Solution**:
- Created `calculateEventDurationOnDate()` function that properly calculates the portion of an event occurring on a specific date
- Updated `calculateTotalPlannedHours()`, `calculatePlannedTimeForDate()`, and `calculateOtherTime()` functions to use proper duration calculation
- Timeline now shows accurate planned hours

### 3. Extra time in insight card
**Problem**: The planner insight card showed extra time (e.g., 5hrs 55mins) on the start date with no visible events to account for it.

**Root Cause**: The insight card was incorrectly calculating time for events crossing midnight, likely double-counting or miscalculating portions.

**Solution**:
- Updated `PlannerInsightCard.tsx` to use `calculateEventDurationOnDate()` for proper time calculation
- Fixed tracking event time calculation to only include the portion occurring on each specific date
- Insight card now shows accurate daily totals

## Files Modified

### New Files Created
- `src/lib/midnightEventUtils.ts` - Utilities for handling midnight-crossing events

### Modified Files
- `src/types/core.ts` - Added `originalEventId` and `isSplitEvent` properties to `CalendarEvent`
- `src/lib/eventWorkHourUtils.ts` - Updated duration calculation functions
- `src/components/PlannerInsightCard.tsx` - Fixed time calculation logic
- `src/components/PlannerView.tsx` - Added event splitting for proper display

## Key Functions Added

### `splitMidnightCrossingEvents(events: CalendarEvent[]): CalendarEvent[]`
Splits events that cross midnight into separate events for each day they span.

### `calculateEventDurationOnDate(event: CalendarEvent, targetDate: Date): number`
Calculates the exact portion of an event that occurs on a specific date, properly handling midnight boundaries.

### `eventSpansMidnight(event: CalendarEvent): boolean`
Determines if an event crosses midnight (spans multiple days).

### `getEventDates(event: CalendarEvent): Date[]`
Returns all dates that an event spans across.

## Test Results

The fix has been validated with a test scenario matching the user's issue:
- Event from Aug 26 23:30 to Aug 27 01:15 (1h 45m total)
- Aug 26 portion: 0.5 hours (30 minutes)
- Aug 27 portion: 1.25 hours (75 minutes)
- Total: 1.75 hours (matches original duration)

## Impact

✅ **Events now display correctly across midnight boundaries**
✅ **Timeline shows accurate planned hours (no more 207-hour anomalies)**
✅ **Insight card displays correct daily totals without phantom time**
✅ **Time tracking across midnight works seamlessly**

## Backward Compatibility

All changes are backward compatible:
- Regular events (not crossing midnight) continue to work exactly as before
- No breaking changes to existing APIs
- New properties on `CalendarEvent` are optional
- Event splitting only occurs for events that actually cross midnight

## Testing

Run the test file to verify fixes:
```bash
node test-midnight-fixes-simple.js
```

The test validates:
- Proper midnight detection
- Accurate duration calculations
- Correct time distribution across dates
- No impact on regular single-day events
