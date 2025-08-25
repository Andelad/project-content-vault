# Project Rectangle and Tooltip Calculation Fixes

## Issues Reported by User

1. **"First segment is over 1 day and recommends nothing"**
   - Expected: Should show planned time attributed to the project
   - Issue: Tooltip showing 0 hours instead of planned time

2. **"Second segment is over 3 days and suggests 5 hours for each"**  
   - Expected: Different calculation or distribution
   - Observation: User confused about why 5h/day across "3 days"

3. **"Should only be planned time attributed to that project"**
   - Expected: Planned events should take priority over auto-estimates
   - Issue: Auto-estimate showing when planned time should be displayed

## Root Causes Found & Fixed

### 🔧 **Fix 1: Milestone Segment Date Calculation Bug**

**Location**: `/src/lib/milestoneSegmentUtils.ts` lines 50-98

**Problem**: 
- Segment end date was calculated as `milestoneDate - 1 day`
- Next segment start was set to `milestoneDate`  
- This created impossible date ranges where start > end

**Example of broken logic**:
```
Milestone 1 due Jan 2: Segment Jan 1 to Jan 1 ✓
Next start = Jan 2, Milestone 2 due Jan 3: Segment Jan 2 to Jan 2 ✓
BUT CODE WAS DOING:
Next start = Jan 3, Milestone 2 due Jan 3: Segment Jan 3 to Jan 2 ❌ (impossible!)
```

**Fix Applied**:
```typescript
// OLD (broken):
const segmentEndDate = new Date(milestoneDate);
segmentEndDate.setDate(milestoneDate.getDate() - 1);
// ...
currentStartDate = new Date(milestoneDate);

// NEW (fixed):
const segmentEndDate = new Date(milestoneDate);
// ...  
currentStartDate = new Date(milestoneDate);
currentStartDate.setDate(milestoneDate.getDate() + 1);
```

### 🔧 **Fix 2: Memoization Cache Missing Events**

**Location**: `/src/lib/eventWorkHourUtils.ts` lines 270-285

**Problem**: 
- The memoized `getProjectTimeAllocation` function cached results based on `projectId`, `date`, `project`, `settings`, and `holidays`
- **BUT NOT `events`** - the most critical parameter for planned time detection!
- When events were added/modified, the cache returned stale results showing auto-estimate instead of planned time

**Fix Applied**:
```typescript
// Added events to cache key:
const eventsHash = events
  .filter(e => e.projectId === projectId) // Only consider events for this project
  .map(e => `${e.id}-${e.startTime.getTime()}-${e.endTime.getTime()}`)
  .sort() // Ensure consistent order
  .join(',');

return `alloc-${projectId}-${date.getTime()}-${project.estimatedHours}-${project.startDate.getTime()}-${project.endDate.getTime()}-${settingsHash}-${holidaysHash}-${eventsHash}`;
```

### ✅ **Clarified: "5 hours each" is Actually Correct**

**User's confusion**: "Second segment is over 3 days and suggests 5 hours for each"

**Analysis**: 
- Milestone with 10h allocation
- Segment spans multiple calendar days (including weekends)  
- Only 2 working days in the segment
- 10h ÷ 2 working days = 5h per working day ✓

**This is mathematically correct**. The confusion arises because:
1. Users count calendar days (including weekends) in the UI
2. Tooltip shows "5h/day" without clarifying "per working day"
3. Weekends are visually present but don't contribute to calculations

## Testing Results

### Before Fixes:
```
Segment 2: Period: Fri Jan 03 2025 to Thu Jan 02 2025  ❌ (impossible date range)
Working days: 0
Hours per day: 0.00h
```

### After Fixes:
```
Segment 1: Wed Jan 01 2025 to Thu Jan 02 2025
  - 2 working days, 10h allocation = 5.00h/day ✓
  
Segment 2: Fri Jan 03 2025 to Mon Jan 06 2025  
  - 2 working days, 10h allocation = 5.00h/day ✓
  - Spans 4 calendar days (user sees "over 3 days") ✓
```

## Impact

### Issues Resolved:
1. ✅ Milestone segments now have correct date ranges
2. ✅ Planned time detection now works properly (cache includes events)
3. ✅ Tooltips show accurate hours based on milestone segments
4. ✅ Auto-estimate vs planned time logic is consistent

### User Experience Improvements:
- **First segment**: Will now correctly show planned time when events exist
- **All segments**: Accurate hour calculations based on working days
- **Tooltips**: Consistent with visual rectangle calculations
- **Performance**: Memoization still works but with correct cache invalidation

## Testing Recommendations

To verify the fixes work in production:

1. **Create a project** with milestones spanning weekends
2. **Add planned events** to early days of the project  
3. **Check tooltips** show "Planned time" for days with events
4. **Verify calculations** match expected hours per working day
5. **Test cache invalidation** by adding/removing events and checking tooltips update

## Files Modified

- `/src/lib/milestoneSegmentUtils.ts` - Fixed segment date calculation  
- `/src/lib/eventWorkHourUtils.ts` - Fixed memoization cache key
