# Time Tracking Cross-Window Sync Investigation

## Test Results

### ✅ All Tests Passing (22/22)

Created comprehensive test suite: `src/services/orchestrators/__tests__/timeTrackingOrchestrator.test.ts`

**Test Coverage:**
- ✓ BroadcastChannel initialization
- ✓ State serialization/deserialization (Date ↔ ISO string)
- ✓ Cross-window message broadcasting
- ✓ Window ID filtering (prevents feedback loops)
- ✓ State callback management
- ✓ skipLocalCallback parameter behavior
- ✓ State validation and normalization
- ✓ Edge cases (null values, rapid changes, cleanup)

## Architecture Verified

### Cross-Window Sync Flow

```
Window A                          BroadcastChannel                    Window B
────────                          ────────────────                    ────────
1. User starts tracking
2. syncState(state, false)
3. → Save to Supabase DB
4. → broadcastStateChange()     ─────────────────────────────────>  5. Receive message
                                                                     6. Check windowId
                                                                     7. Call callback
                                                                     8. Update UI
```

### Key Components

1. **Window ID**: `window_${timestamp}_${random}`
   - Prevents processing own broadcasts
   - Unique per tab/window

2. **BroadcastChannel**: `'timeTracker_crossWindowSync'`
   - Standard browser API
   - Works across tabs (same origin)
   - **NOT supported in**: Safari < 15.4, older browsers

3. **State Serialization**:
   - Dates → ISO strings for transmission
   - ISO strings → Dates on reception
   - Handles null/undefined gracefully

4. **Callback Management**:
   - `skipLocalCallback=true`: No local callback (prevents loops)
   - `skipLocalCallback=false`: Triggers callback + broadcast

## Potential Issues Found

### 1. BroadcastChannel Browser Support ⚠️

**Problem**: BroadcastChannel not supported in older browsers
- Safari < 15.4 (Sep 2021)
- IE 11 (never)
- Some mobile browsers

**Check**:
```javascript
if (typeof BroadcastChannel !== 'undefined') {
  // Cross-window sync available
} else {
  // Fallback needed
}
```

**Current Implementation**: Gracefully degrades (no error)
**Impact**: Cross-window sync silently fails in unsupported browsers

### 2. Dual Sync Mechanisms

The app uses TWO sync mechanisms:
1. **BroadcastChannel** (instant, same-browser)
2. **Supabase Realtime** (slower, works across devices)

**Potential Race Condition**:
```typescript
// In timeTrackingOrchestrator.ts
async syncState(state, skipLocal) {
  await saveState(state);        // Supabase write
  broadcastStateChange(state);   // BroadcastChannel send
  if (!skipLocal) callback(state); // Local update
}

// Meanwhile, Supabase realtime might also trigger:
setupRealtimeSubscription((state) => {
  callback(state);  // Could fire at same time!
  broadcastStateChange(state); // Could create loop!
})
```

### 3. Callback Registration Timing

**Issue**: If callback is registered AFTER state is loaded:
```typescript
// Problem sequence:
1. Component mounts
2. loadState() called → returns tracking state
3. UI shows "not tracking" (callback not set yet)
4. setOnStateChangeCallback() called
5. User sees wrong state until next sync
```

**Solution**: Ensure callback is set BEFORE loading state

## Debugging Tools Created

### 1. Test Suite
**File**: `src/services/orchestrators/__tests__/timeTrackingOrchestrator.test.ts`
**Run**: `npm test -- timeTrackingOrchestrator.test.ts`

### 2. Browser Console Debugger
**File**: `scripts/debug-time-tracker-sync.js`
**Usage**:
1. Open app in 2 browser tabs
2. Open DevTools console in BOTH
3. Paste script contents into console
4. Start tracking in one tab
5. Watch console output in both tabs

**What it shows**:
- BroadcastChannel support check
- Current localStorage state
- Real-time message monitoring
- Window ID tracking
- Test message sending

## Recommended Next Steps

### 1. Browser Compatibility Check
Run debugger in:
- Chrome (latest)
- Safari (latest)
- Firefox (latest)
- Mobile browsers

### 2. Timing Analysis
Add timestamps to track:
```typescript
console.time('syncState');
await saveState(state);
console.timeLog('syncState', 'DB saved');
broadcastStateChange(state);
console.timeLog('syncState', 'Broadcast sent');
console.timeEnd('syncState');
```

### 3. Check Callback Registration
In `TimeTracker.tsx`, verify:
```typescript
useEffect(() => {
  // Set callback FIRST
  timeTrackingOrchestrator.setOnStateChangeCallback(callback);
  
  // Load state SECOND
  const state = await timeTrackingOrchestrator.loadState();
  
  // Now state changes will be caught
}, []);
```

### 4. Monitor for Race Conditions
Check if both mechanisms fire:
```typescript
let broadcastReceived = false;
let realtimeReceived = false;

// BroadcastChannel handler
channel.addEventListener('message', () => {
  broadcastReceived = true;
  if (realtimeReceived) {
    console.warn('⚠️ RACE CONDITION: Both sync methods fired!');
  }
});

// Realtime handler
subscription.on('UPDATE', () => {
  realtimeReceived = true;
  if (broadcastReceived) {
    console.warn('⚠️ RACE CONDITION: Both sync methods fired!');
  }
});
```

## Files Changed

### Created
- `src/services/orchestrators/__tests__/timeTrackingOrchestrator.test.ts` (650 lines, 22 tests)
- `scripts/debug-time-tracker-sync.js` (140 lines, browser console debugger)
- `docs/features/time-tracker/CROSS_WINDOW_SYNC_INVESTIGATION.md` (this file)

### Tests Status
```
✓ PhaseCalculations.test.ts        36/36 passing
✓ timeTrackingOrchestrator.test.ts 22/22 passing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total:                           58/58 passing ✓
```

## Common Issues & Solutions

### Issue: "Sync works in one direction only"
**Cause**: skipLocalCallback not used correctly
**Fix**: Use `skipLocalCallback=true` when receiving external updates

### Issue: "UI shows wrong state on page load"
**Cause**: Callback registered after state loaded
**Fix**: Set callback before calling loadState()

### Issue: "Sync works in Chrome but not Safari"
**Cause**: BroadcastChannel unsupported in older Safari
**Fix**: Check browser version, consider localStorage fallback

### Issue: "State updates twice (flickers)"
**Cause**: Both BroadcastChannel AND Supabase realtime firing
**Fix**: Debounce callbacks or disable one mechanism

## Testing Checklist

- [ ] Test in Chrome (latest)
- [ ] Test in Firefox (latest)
- [ ] Test in Safari (latest)
- [ ] Test in Safari < 15.4 (if applicable)
- [ ] Test on mobile devices
- [ ] Test with DevTools Network throttling
- [ ] Test with 3+ tabs open
- [ ] Test start/stop in different tabs
- [ ] Monitor console for errors
- [ ] Check localStorage for state persistence
- [ ] Verify no duplicate API calls
- [ ] Check Supabase realtime connection status

## Contact

If sync issues persist after running debugger:
1. Share browser version
2. Share console output from debugger
3. Share Network tab (Supabase calls)
4. Note specific reproduction steps
