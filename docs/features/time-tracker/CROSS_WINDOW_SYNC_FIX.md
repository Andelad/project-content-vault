# Time Tracker Cross-Window Sync Fix

## Issue Discovered

**Symptom**: Cross-window sync stopped working - when starting time tracking in one tab, other tabs didn't update.

**Console Output**:
```
💾 DB sync - Tracking stopped or different event, clearing interval 
{
  isTimeTracking: true, 
  currentEventId: null,  ← LOCAL STATE (wrong!)
  eventId: '29b79389-...'  ← ACTUAL EVENT (correct)
}
```

## Root Cause

The `TimeTracker` component had **two separate event ID states**:

1. **`currentTrackingEventId`** - Global context (SettingsContext)
   - Synced across windows via BroadcastChannel ✓
   - Updated immediately on cross-window events ✓

2. **`currentEventId`** - Local component state
   - NOT synced across windows ✗
   - Could be null while global state shows tracking ✗

### The Bug

In `startOptimizedIntervals` callback (line 271):

```typescript
// BEFORE (broken):
if (!isTimeTracking || currentEventId !== eventId) {
  //                    ^^^^^^^^^^^^^^ local state - could be null!
  clearInterval(dbSyncIntervalRef.current);
  return;
}
```

**What happened**:
1. Tab A starts tracking → `currentTrackingEventId` = 'abc123'
2. BroadcastChannel syncs to Tab B
3. Tab B receives: `isTimeTracking = true`, `currentTrackingEventId = 'abc123'`
4. Tab B's `currentEventId` state is still `null` (not updated yet)
5. Interval check fails: `null !== 'abc123'` → intervals cleared immediately
6. Cross-window sync appears broken

## The Fix

**Changed**: Use global context instead of local state for interval validation

```typescript
// AFTER (fixed):
if (!isTimeTracking || currentTrackingEventId !== eventId) {
  //                    ^^^^^^^^^^^^^^^^^^^^^ global context - synced!
  clearInterval(dbSyncIntervalRef.current);
  return;
}
```

**Also updated dependency array** (line 327):
```typescript
// BEFORE:
}, [currentEventId, ...other deps]);

// AFTER:
}, [currentTrackingEventId, ...other deps]);
```

## Why This Works

1. `currentTrackingEventId` is managed by `SettingsContext`
2. SettingsContext listens to `timeTrackingOrchestrator` callbacks
3. BroadcastChannel updates trigger the callback immediately
4. All tabs see the same `currentTrackingEventId` value
5. Interval validation now uses the synced value → no false negatives

## Files Changed

- **`src/components/features/tracker/TimeTracker.tsx`**
  - Line 271: Changed condition from `currentEventId` to `currentTrackingEventId`
  - Line 272: Updated console.log to show correct variable
  - Line 327: Updated useCallback dependency array

## Testing

### Before Fix
```
Tab A: Start tracking
Tab B: isTimeTracking=true, currentEventId=null → intervals cleared
Tab B: No updates, appears frozen
```

### After Fix
```
Tab A: Start tracking
Tab B: isTimeTracking=true, currentTrackingEventId='abc123' → intervals running
Tab B: Updates every second, UI stays in sync ✓
```

### Verification Steps

1. Open app in 2 browser tabs
2. Start time tracking in Tab A
3. Switch to Tab B
4. **Expected**: Timer counting, project name shown, UI updating
5. Stop tracking in Tab B
6. Switch to Tab A
7. **Expected**: Tracking stopped, UI cleared

## Related Components

This fix ensures proper interaction between:
- `TimeTracker.tsx` (UI component)
- `SettingsContext.tsx` (global state)
- `timeTrackingOrchestrator.ts` (cross-window sync)
- BroadcastChannel API (browser-level sync)

## Why We Had Two States

Historical reasons:
- `currentEventId` was added for local UI state management
- `currentTrackingEventId` was added later for cross-window sync
- They weren't properly unified
- The bug only appeared during cross-window operations

## Prevention

**Lesson**: When dealing with state that needs cross-window sync:
- ✓ Use global context as single source of truth
- ✓ Keep local state minimal (derived values only)
- ✗ Don't duplicate tracking state in multiple places
- ✗ Don't check local state for global operations

## Impact

- ✅ Cross-window sync now works reliably
- ✅ Multi-tab time tracking is synchronized
- ✅ No more phantom "stopped tracking" messages
- ✅ DB sync intervals run correctly in all tabs

## Date

Fixed: January 8, 2026
