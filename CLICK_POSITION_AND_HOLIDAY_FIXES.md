# Timeline Weeks View Click Position & Holiday Alignment Fixes

## Issues Fixed

### 1. Project Selector Jumping in Weeks View
**Problem**: When clicking to add a project in weeks view, the selector would jump multiple days forward from the click position.

**Root Cause**: The `pixelToDate` method in `TimelineCalculationService.ts` was using the full column width (77px) for date calculations, but in weeks view, clicks need to be calculated using individual day width (11px).

**Solution**: Updated `pixelToDate` and `dateToPixel` methods to use 11px day width for weeks mode:

```typescript
// Before
const offset = Math.round(pixelPosition / columnWidth);

// After (weeks mode)
const dayWidth = 11;
const dayOffset = Math.round(pixelPosition / dayWidth);
```

### 2. Holiday Columns Not Aligned to 11px/77px System
**Problem**: Holiday positioning was still using floating-point calculations (`columnWidth / 7 ≈ 10.3px`) instead of the new 11px system.

**Root Cause**: Multiple components were using the old calculation that caused sub-pixel misalignment.

**Solution**: Updated all holiday-related positioning to use exact 11px per day.

### 3. Add Project Selector Using Old Width Calculations
**Problem**: The `TimelineAddProjectRow` component was treating weeks as indivisible 77px columns instead of calculating precise day positions within weeks.

**Root Cause**: Mouse position calculations, hover bar sizing, and date mapping were all using week-level granularity instead of day-level precision.

**Solution**: Updated `TimelineAddProjectRow` to use day-level calculations in weeks mode:

```typescript
// Before (weeks treated as single units)
let dayIndex = Math.floor(clickX / 77); // Week index
const barWidth = weekCount * 77;

// After (day-level precision)
let dayIndex = Math.floor(clickX / 11); // Day index across all weeks
const barWidth = dayCount * 11;
```

#### Files Updated:
- `src/services/TimelineCalculationService.ts`
- `src/components/timeline/AddProjectRow.tsx`
- `src/components/timeline/SmartHoverAddHolidayBar.tsx` 
- `src/components/timeline/TimelineColumnMarkers.tsx`
- `src/hooks/useDynamicViewportDays.ts`

## Impact

### Click Accuracy
- **Before**: Click at 44px → Interpreted as day 1 (jumped backward)
- **After**: Click at 44px → Correctly interpreted as day 4

### Holiday Alignment
- **Before**: Sub-pixel positioning causing visual misalignment
- **After**: Perfect pixel-aligned positioning on 11px grid

### Add Project Selector
- **Before**: Clicking anywhere in a week column selected the whole week
- **After**: Clicking maps to the exact day within the week
- **Before**: Hover bar width calculated incorrectly for day ranges
- **After**: Hover bar shows precise day-by-day selection

### System Consistency
- All week mode calculations now use the unified 11px/77px system
- Eliminates floating-point precision errors
- Consistent behavior between days and weeks view modes

## Technical Details

The fix ensures that:
1. Week columns are exactly 77px wide (7 × 11px)
2. Individual days within weeks are exactly 11px wide
3. All positioning calculations use integer arithmetic
4. Click positions map directly to the correct day indices
5. Date range calculations work with day-level precision in weeks view

This maintains the visual consistency while providing precise user interaction in weeks view.
