# Split Event Deletion Fix

## Issue
After implementing the midnight crossing event fixes, events that spanned across midnight were properly displayed as split segments on each day. However, when users clicked on these split events and tried to delete them, the deletion would fail because the system was trying to delete the split event ID (like `event-123-split-2025-08-26`) which doesn't exist in the database - only the original event ID (`event-123`) exists.

## Root Cause
The `splitMidnightCrossingEvents()` function creates new event objects with modified IDs for display purposes, but these split events are not stored in the database. The original event with the original ID is what needs to be deleted.

## Solution
Updated the event handling logic throughout the application to detect split event IDs and extract the original event ID for database operations.

### Files Modified

#### 1. `/src/components/EventDetailModal.tsx`
- **Event Finding**: Enhanced logic to find original event when given a split event ID
- **Delete Operations**: All delete functions now extract and use the original event ID
- **Form Updates**: Event updates use the original event ID
- **Recurring Status Check**: Uses original event ID for recurring series detection

#### 2. `/src/components/PlannerView.tsx` 
- **Event Selection**: Handles finding original events from split IDs
- **Delete Confirmation**: Uses original event ID for deletion
- **Completion Toggle**: Works with split events by finding original event
- **Undo Operations**: Properly tracks original event for undo functionality

### Key Logic
```typescript
// Extract original event ID from split event ID
const originalEventId = eventId?.includes('-split-') 
  ? eventId.split('-split-')[0] 
  : eventId;

// Find event, handling both regular and split events
let existingEvent = events.find(e => e.id === eventId);
if (!existingEvent && eventId?.includes('-split-')) {
  const originalEventId = eventId.split('-split-')[0];
  existingEvent = events.find(e => e.id === originalEventId);
}
```

## User Experience Impact

### Before Fix
- ❌ Click on split event → Delete button appears but doesn't work
- ❌ No error feedback, button just seems broken
- ❌ User couldn't delete midnight-crossing tracked events

### After Fix  
- ✅ Click on any part of a midnight-crossing event → Delete works correctly
- ✅ Deletes the original event, removing all split segments from display
- ✅ Works for both regular and recurring events
- ✅ Proper error handling and user feedback
- ✅ Event editing also works correctly

## Test Results
All test cases pass:
- ✅ Split event ID parsing extracts correct original IDs
- ✅ Event finding logic handles both regular and split events  
- ✅ Complex UUIDs with multiple hyphens work correctly
- ✅ Regular events (not split) continue to work as before

## Backward Compatibility
- ✅ No breaking changes to existing functionality
- ✅ Regular events continue to work exactly as before
- ✅ Only adds special handling for split event IDs
- ✅ Graceful fallback if split parsing fails

## Related to Previous Fix
This fix complements the midnight crossing event display fix by ensuring that the split events created for display purposes can be properly managed (deleted, edited, etc.) by the user. Together, these fixes provide a complete solution for time tracking across midnight boundaries.
