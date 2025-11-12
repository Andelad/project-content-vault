# How to Diagnose and Fix Phase State Issues

## When you see the error:
> "Cannot create phases - recurring template already exists"  
> OR "Cannot create recurring - split phases already exist"

But you don't see any phases or recurring templates in the UI.

## Steps to Fix:

### 1. Look for the Red Warning Banner
When the system detects inconsistency, you'll see a red warning banner at the top of the phase section.

### 2. Click "Show Debug Info"
This will log complete diagnostic information to your browser console:
- All milestones in the database
- Which ones have `isRecurring: true`
- Which ones have `startDate` (phases)
- Current React state

**Open your browser console** (F12 or Cmd+Option+I) to see the output.

### 3. Interpret the Debug Info

Look for milestones with:
- `isRecurring: true` but no visible recurring card → Orphaned recurring template
- `hasStartDate: true` but not in phases array → Orphaned split phases

### 4. Choose Recovery Option

#### Option A: "Delete All & Reset" (Recommended)
- Click the "Delete All & Reset" button
- Confirms deletion of ALL phases/recurring for this project
- Clears all state
- You can now start fresh

#### Option B: Manual Database Cleanup
If you want to investigate further:
1. Note the milestone IDs from the console
2. Check the Supabase database directly
3. Manually delete the problematic milestones

## Why This Happens

State inconsistency can occur when:
1. **Rapid button clicks** - Creating/deleting phases too quickly
2. **Failed deletions** - Network error during delete operation
3. **React state not syncing** - State updates don't complete before next action
4. **Database transactions partially completing** - Some milestones delete, others don't

## Prevention

The fixes applied include:
- ✅ Parallel creation/deletion (faster, less chance of interruption)
- ✅ Force refetch after operations (ensures sync)
- ✅ Stronger validation before operations (prevents invalid states)
- ✅ Better error handling (recovers from failures)

But if you still encounter issues, the debug tools will help identify exactly what's wrong.

## Example Debug Output

```javascript
=== PHASE DIAGNOSTIC ===
All projectMilestones: [
  {
    id: "abc-123",
    name: "Recurring Template", 
    isRecurring: true,        // ← This is the problem!
    hasStartDate: false,
    startDate: null,
    endDate: "2025-12-31"
  }
]
Validation result: {
  hasSplitPhases: false,
  hasRecurringTemplate: true,  // ← Detected in validation
  isValid: true
}
recurringMilestone state: null  // ← But React state is null!
phases array: []
========================
```

In this example, there's a milestone with `isRecurring: true` in the database, but the React state variable `recurringMilestone` is null, so nothing displays. The "Delete All & Reset" button would fix this.
