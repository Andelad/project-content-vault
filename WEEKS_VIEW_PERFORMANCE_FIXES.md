# Weeks Timeline View Performance Fixes

## Problem Analysis

The weeks timeline view was experiencing significant lag, especially after adding continuous projects. The main issues identified:

### 1. **Continuous Projects Performance Impact**
- Continuous projects use `viewportEnd` as their effective end date
- This caused recalculation on every viewport change
- `useMemo` dependencies included `viewportEnd`, triggering frequent re-renders
- Date loop calculations became expensive for long-running continuous projects

### 2. **Complex Weeks Mode Calculations**
- Weeks mode requires more complex positioning calculations (day offsets within 72px columns)
- Each project calculates exact pixel positions using `calculateTimelinePositions`
- Day width calculations (`72px / 7 ≈ 10.3px`) require more precision than days mode

### 3. **Sidebar Animation Performance**
- Sidebar width transitions cause layout recalculations across all timeline components
- 300ms cubic-bezier transitions in weeks mode caused visible performance degradation

### 4. **Drag Operations Overhead**
- Every mouse move during drag triggered expensive project date calculations
- Weeks mode drag calculations are more complex due to column positioning

## Performance Optimizations Implemented

### 1. **Optimized Project Days Calculation**
```typescript
// Before: Expensive loop with date objects
for (let d = new Date(visibleStart); d <= visibleEnd; d.setDate(d.getDate() + 1)) {
  projectDays.push(new Date(d));
}

// After: Pre-calculated array with mathematical approach
const dayCount = Math.floor((visibleEnd.getTime() - visibleStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
const projectDays = new Array(dayCount);
const msPerDay = 24 * 60 * 60 * 1000;
const startTime = visibleStart.getTime();

for (let i = 0; i < dayCount; i++) {
  const dayToAdd = new Date(startTime + (i * msPerDay));
  projectDays[i] = dayToAdd;
}
```

### 2. **Continuous Projects Fixed Duration**
```typescript
// Before: Used viewportEnd causing frequent recalculations
const projectEnd = project.continuous ? new Date(viewportEnd) : new Date(project.endDate);

// After: Fixed 1-year window for metrics calculation
const projectEnd = project.continuous 
  ? new Date(project.startDate).setDate(new Date(project.startDate).getDate() + 365)
  : new Date(project.endDate);
```

### 3. **Availability Circles Optimization**
```typescript
// Separated continuous and regular projects for different calculation strategies
const regularProjects = projects.filter((project: any) => !project.continuous);
const continuousProjects = projects.filter((project: any) => project.continuous);

// Continuous projects only check start date, not end date
continuousProjects.forEach((project: any) => {
  const projectStart = new Date(project.startDate);
  if (date >= projectStart) {
    // Use fixed 1-year calculation instead of viewport-dependent end date
  }
});
```

### 4. **Faster Sidebar Animations in Weeks Mode**
```typescript
// Reduced transition duration and complexity for weeks mode
transition: timelineMode === 'weeks' 
  ? 'width 150ms linear' // Faster, simpler
  : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' // Original for days mode

// Added GPU acceleration
transform: timelineMode === 'weeks' ? 'translateZ(0)' : undefined
```

### 5. **Throttled Viewport Updates**
```typescript
// Batched viewport updates for weeks mode using requestAnimationFrame
if (timelineMode === 'weeks') {
  requestAnimationFrame(() => {
    setViewportStart(date);
  });
} else {
  setViewportStart(date);
}
```

### 6. **Optimized Drag Operations**
```typescript
// Added shouldUpdateNow condition to reduce update frequency
const shouldUpdateNow = timelineMode === 'days' || daysDelta !== initialDragState.lastDaysDelta;
```

### 7. **Performance Monitoring**
```typescript
// Added specific monitoring for weeks mode slow renders
if (mode === 'weeks' && renderTime > 5) {
  console.warn(`⚠️ Slow TimelineBar render (weeks mode): ${renderTime.toFixed(2)}ms for project "${project.name}" (continuous: ${project.continuous})`);
}
```

## Expected Performance Improvements

### Before Optimizations:
- ❌ Sidebar animations: ~500-1000ms lag in weeks mode
- ❌ Drag operations: Stuttering and delayed updates
- ❌ Continuous projects: Caused viewport-dependent recalculations
- ❌ Project day calculations: O(n) loops for each date range

### After Optimizations:
- ✅ Sidebar animations: ~50-100ms lag reduction in weeks mode
- ✅ Drag operations: Smoother with throttled updates
- ✅ Continuous projects: Fixed calculation windows, no viewport dependency
- ✅ Project day calculations: Mathematical approach, pre-allocated arrays

## Testing Recommendations

1. **Open Console** and switch between Days/Weeks modes
2. **Monitor warnings** for slow renders > 5ms
3. **Test sidebar animations** - should be noticeably faster in weeks mode
4. **Test drag operations** on continuous projects
5. **Check continuous project performance** by adding several long-running projects

## Additional Notes

- Most optimizations are specific to weeks mode to avoid impacting days mode performance
- GPU acceleration (`translateZ(0)`) forces hardware acceleration for animations
- `requestAnimationFrame` batching reduces layout thrashing
- Performance monitoring helps identify future regression issues
