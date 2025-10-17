# Auto-Estimate Rectangles Disappearing After Refresh

## Symptom
Website Update project briefly shows estimated time rectangles on timeline, then they disappear after 1-2 seconds.

## Hypothesis
This is a **React re-render race condition** caused by events loading asynchronously:

### Scenario A: Events Loading Delay
1. **Initial Render** (events = [])
   - No events loaded yet
   - `calculatePlannedTimeForDate()` returns 0
   - `getProjectTimeAllocation()` returns `type: 'auto-estimate'`
   - ✅ Gray rectangles render

2. **Second Render** (events loaded from database)
   - Events now populated with completed time event
   - `calculatePlannedTimeForDate()` returns > 0 hours
   - `getProjectTimeAllocation()` returns `type: 'planned'`
   - Rectangles change from gray (auto-estimate) to blue (planned)
   - If event is ONLY on one day, other days might show as 'none'

### Scenario B: Event Filtering
1. **Initial Render** - All events included
2. **Second Render** - Events filtered/modified causing recalculation

## Debug Logs Added

### 1. Component Re-render Tracking
**Location**: `TimelineBar.tsx` (after hooks)
```javascript
🔄 TimelineBar RE-RENDER - Website Update: {
  eventsCount: 10,
  projectEventsCount: 1,
  timestamp: "2025-10-17T21:30:00.000Z"
}
```

### 2. Time Allocation Calculation
**Location**: `UnifiedEventWorkHourService.ts` (in getProjectTimeAllocation)
```javascript
🔧 getProjectTimeAllocation - Website Update 10/13/2025: {
  plannedHours: 0,           // If 0: will check auto-estimate
  eventsCount: 10,           // Total events in system
  projectEvents: 1,          // Events for THIS project
  willReturnPlanned: false   // true = returns 'planned', false = continues to auto-estimate
}
```

### 3. Timeline Bar Rendering Decision
**Location**: `TimelineBar.tsx` (days mode rendering)
```javascript
🔍 TIME ALLOCATION - Website Update 10/13/2025: {
  type: "auto-estimate",     // or "planned" or "none"
  hours: 0.75,               // Hours for this day
  isWorkingDay: true,
  projectEstimatedHours: 6,
  hasEvents: 1,
  projectId: "...",
  willRender: true           // If false, no rectangle
}
```

## What to Check in Browser Console

### Step 1: Refresh the page and immediately check console

Look for the sequence:
```javascript
// FIRST RENDER
🔄 TimelineBar RE-RENDER - Website Update: { eventsCount: 0, projectEventsCount: 0 }
🔧 getProjectTimeAllocation - Website Update 10/13/2025: { plannedHours: 0, willReturnPlanned: false }
🔍 TIME ALLOCATION - Website Update 10/13/2025: { type: "auto-estimate", hours: 0.75, willRender: true }

// SECOND RENDER (1-2 seconds later)
🔄 TimelineBar RE-RENDER - Website Update: { eventsCount: 10, projectEventsCount: 1 }
🔧 getProjectTimeAllocation - Website Update 10/13/2025: { plannedHours: 2.5, willReturnPlanned: true }
🔍 TIME ALLOCATION - Website Update 10/13/2025: { type: "planned", hours: 2.5, willRender: true }
```

### Step 2: Check if it's an event filtering issue

If you see multiple re-renders with changing event counts:
```javascript
🔄 TimelineBar RE-RENDER - Website Update: { eventsCount: 10 }
🔄 TimelineBar RE-RENDER - Website Update: { eventsCount: 8 }   // Events removed
🔄 TimelineBar RE-RENDER - Website Update: { eventsCount: 10 }  // Events restored
```

This would indicate an event filtering/state management issue.

### Step 3: Check the type progression

If rectangles appear then disappear completely:
```javascript
// Appears
type: "auto-estimate"  // ✅ Shows gray rectangles

// Then becomes
type: "planned"        // ✅ Shows blue rectangles (should still be visible!)

// Or becomes
type: "none"          // ❌ No rectangles (this is the problem)
```

## Possible Root Causes

### 1. Planned Events Override Auto-Estimate (EXPECTED BEHAVIOR)
- **Lines 322-326** in `UnifiedEventWorkHourService.ts`
- Planned time takes priority over auto-estimate
- **Expected**: Gray rectangles → Blue rectangles
- **Issue**: If completed event is ONLY on one day, other days show auto-estimate
- **Fix**: This is correct behavior, no fix needed

### 2. Events Loading Asynchronously
- Events might be fetched from Supabase after initial render
- **Expected**: No rectangles → Auto-estimate rectangles → Planned rectangles
- **Issue**: If there's an error or the events fail to load correctly
- **Fix**: Ensure PlannerContext loads events before rendering timeline

### 3. useMemo Dependency Array Missing `events`
- **Line 164** in `TimelineBar.tsx`
- `useMemo` doesn't include `events` in dependencies
- **Issue**: Component might not re-render when events change
- **Fix**: Add `events` to dependency array (but this will cause full recalculation on every event change)

### 4. Memoization Cache Stale Data
- `memoizedGetProjectTimeAllocation` uses a cache
- **Issue**: Cache might return stale data from when events were empty
- **Fix**: Cache key should include events hash/count

## Expected Behavior

### What SHOULD happen:
1. Page loads
2. Events load from database
3. For each project day:
   - If day has planned event → Show blue rectangle (`type: 'planned'`)
   - If day has no planned event → Show gray rectangle (`type: 'auto-estimate'`)
   - If day is not working day → Show nothing (`type: 'none'`)

### Website Update Project (Oct 13-20, 2025)
- **6 hours total budget**
- **8 calendar days** (Oct 13-20)
- **Completed event exists** (visible on timeline)

**Expected result**:
- Day with completed event → Blue rectangle (planned)
- Other 7 days → Gray rectangles (auto-estimate, 6hrs / 8 days = 0.75 hrs each)

## Next Steps

### Based on Console Output

#### If you see type changing from "auto-estimate" to "none":
→ Problem is in `calculateAutoEstimateWorkingDays()` or date range checks
→ Enable debug logging in `projectCalculations.ts` line 72

#### If you see type changing from "auto-estimate" to "planned":
→ This is expected behavior
→ Check if blue rectangles appear (they should)
→ If blue rectangles don't appear, the issue is in rendering logic

#### If you see multiple re-renders with changing event counts:
→ Problem is in PlannerContext event loading/filtering
→ Check `src/contexts/PlannerContext.tsx` for event fetching logic

#### If you see eventsCount staying at 0:
→ Events aren't loading at all
→ Check network tab for Supabase queries
→ Check PlannerContext initialization

## Quick Test

Open browser console and run:
```javascript
// Check current events
const events = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.get(1)?.getCurrentFiber?.()?.return?.memoizedState?.events;
console.log('Events:', events);
```

Or just look for the debug logs starting with 🔄, 🔧, and 🔍

---

**Created**: October 17, 2025
**Status**: Debugging in progress
**Action Required**: Check browser console and share the sequence of debug logs
