# Time Tracker Bug Fix - Flash on New Window

## Issue Description

When opening a new browser window with the app logged in, the time tracker would briefly flash showing an incomplete tracking state (admin project with a live tracker) even when no tracking session was actually active. This would then disappear, leaving the tracker empty as expected.

## Root Cause

The bug was caused by **incomplete time tracking state being saved to the database** when stopping tracking sessions. The code would set `isTracking: false` but fail to clear the UI-related fields (`eventId`, `selectedProject`, `searchQuery`, `affectedEvents`, `currentSeconds`). This left orphaned data in the database.

When a new window opened:
1. It would load state from the database
2. Find `isTracking: false` but with `eventId` and `selectedProject` still present
3. The validation logic would incorrectly interpret this as an active session
4. Show the tracking UI briefly before realizing the state was incomplete
5. Clear the UI, causing the flash

## Changes Made

### 1. SettingsContext.tsx (Validation Fix)
Added validation when loading initial time tracking state from the database. Now only sets `isTracking: true` if **ALL** required fields are present:
- `isTracking: true`
- `eventId` exists
- `startTime` exists  
- `selectedProject` exists

If incomplete tracking state is found (e.g., `isTracking: true` but missing required fields), it automatically cleans it up by calling `stopTracking()` and resetting the UI state.

### 2. TimeTracker.tsx (Component-Level Validation)
Added the same validation check in the component's mount effect to prevent restoring incomplete tracking sessions. This provides a second layer of protection at the component level.

### 3. timeTrackingOrchestrator.ts (Root Cause Fix)
Fixed the root cause in **three locations** where tracking was being stopped:

- **Line ~172**: `stopTracking()` method
- **Line ~470**: `stopTrackingWorkflow()` when no eventId
- **Line ~520**: `stopTrackingWorkflow()` normal stop

All three now explicitly clear **ALL state fields** when stopping tracking:

```typescript
const stoppedState = {
  isTracking: false,
  isPaused: false,
  projectId: null,
  startTime: null,
  pausedAt: null,
  totalPausedDuration: 0,
  lastUpdateTime: new Date(),
  // UI state fields - MUST be explicitly cleared
  eventId: null,
  selectedProject: null,
  searchQuery: '',
  affectedEvents: [],
  currentSeconds: 0
}
```

This ensures no orphaned data is left in the database going forward.

## Database Cleanup Required

The fixes above prevent **future** occurrences, but there may be **existing corrupt records** in the database that need cleanup.

### Please run this SQL query:

```sql
-- Find and clean up records with incomplete state
UPDATE settings 
SET time_tracking_state = jsonb_build_object(
  'isTracking', false,
  'isPaused', false,
  'projectId', null,
  'startTime', null,
  'pausedAt', null,
  'totalPausedDuration', 0,
  'lastUpdateTime', now(),
  'eventId', null,
  'selectedProject', null,
  'searchQuery', '',
  'affectedEvents', '[]'::jsonb,
  'currentSeconds', 0
)
WHERE (time_tracking_state->>'isTracking')::boolean = false
  AND time_tracking_state->>'eventId' IS NOT NULL;
```

This query will:
1. Find all settings records where tracking is stopped (`isTracking: false`) but still has an `eventId`
2. Replace the entire time_tracking_state with a clean, complete stopped state
3. Ensure no orphaned UI fields remain in the database

## Testing

After applying the code changes and running the database cleanup:

1. ✅ Opening a new browser window should NOT show any flash
2. ✅ Active tracking sessions should properly restore across windows
3. ✅ Stopping tracking should completely clear all state fields
4. ✅ No incomplete state should be saved to the database

## Technical Details

**Files Modified:**
- `src/contexts/SettingsContext.tsx`
- `src/components/work-hours/TimeTracker.tsx`
- `src/services/orchestrators/timeTrackingOrchestrator.ts`

**Architecture Pattern:**
- Validation layer: Prevents incomplete state from being used
- Root cause fix: Prevents incomplete state from being created
- Database cleanup: Removes existing incomplete state

This is a **proper fix**, not a band-aid. The validation provides defense-in-depth while the orchestrator fix prevents the issue from occurring in the first place.
