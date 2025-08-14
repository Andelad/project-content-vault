// Utility functions for consistent timeline positioning calculations
// This ensures baseline, circle, and triangle positions are always aligned

export interface PositionCalculation {
  baselineStartPx: number;    // Pixel position for left edge of baseline
  baselineWidthPx: number;    // Width of baseline in pixels
  circleLeftPx: number;       // Pixel position for circle center
  triangleLeftPx: number;     // Pixel position for triangle tip
}

export function calculateTimelinePositions(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): PositionCalculation {
  const columnWidth = mode === 'weeks' ? 72 : 40;
  
  if (mode === 'weeks') {
    // In weeks mode, calculate exact day positions within the timeline
    // dates array contains week start dates, so we need to calculate day offsets
    
    const firstWeekStart = dates[0];
    if (!firstWeekStart) {
      return { baselineStartPx: 0, baselineWidthPx: 0, circleLeftPx: 0, triangleLeftPx: 0 };
    }
    
    // Calculate how many days from the first week start to project start/end
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysFromStartToProjectStart = Math.floor((projectStart.getTime() - firstWeekStart.getTime()) / msPerDay);
    const daysFromStartToProjectEnd = Math.floor((projectEnd.getTime() - firstWeekStart.getTime()) / msPerDay);
    
    // Each day is 72px/7 ≈ 10.3px wide in weeks mode
    const dayWidth = columnWidth / 7;
    
    // Calculate exact pixel positions based on day offsets
    // Allow negative positions for handles that extend outside viewport
    const circleLeftPx = daysFromStartToProjectStart * dayWidth;
    const triangleLeftPx = (daysFromStartToProjectEnd + 1) * dayWidth;
    
    // For baseline, ensure it shows properly throughout the entire viewport
    // Don't constrain to viewport bounds - let it extend as needed
    const projectIntersectsViewport = !(projectEnd < viewportStart || projectStart > viewportEnd);
    
    let baselineStartPx, baselineWidthPx;
    
    if (projectIntersectsViewport) {
      // Project intersects viewport - ensure baseline spans the visible portion
      const viewportStartDays = Math.floor((viewportStart.getTime() - firstWeekStart.getTime()) / msPerDay);
      const viewportEndDays = Math.floor((viewportEnd.getTime() - firstWeekStart.getTime()) / msPerDay);
      
      // Use project bounds, not viewport bounds for baseline in weeks mode
      baselineStartPx = daysFromStartToProjectStart * dayWidth;
      baselineWidthPx = Math.max(dayWidth * 0.5, (daysFromStartToProjectEnd + 1 - daysFromStartToProjectStart) * dayWidth); // Full project width
    } else {
      // Project doesn't intersect viewport
      baselineStartPx = daysFromStartToProjectStart * dayWidth;
      baselineWidthPx = Math.max(0, (daysFromStartToProjectEnd + 1 - daysFromStartToProjectStart) * dayWidth);
    }
    
    return {
      baselineStartPx,
      baselineWidthPx,
      circleLeftPx,
      triangleLeftPx
    };
  } else {
    // Original days mode logic
    // Normalize all dates for consistent comparison
    const normalizedProjectStart = new Date(projectStart);
    normalizedProjectStart.setHours(0, 0, 0, 0);
    const normalizedProjectEnd = new Date(projectEnd);
    normalizedProjectEnd.setHours(0, 0, 0, 0);
    
    const projectStartIndex = dates.findIndex(date => {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      return normalizedDate.toDateString() === normalizedProjectStart.toDateString();
    });
    
    const projectEndIndex = dates.findIndex(date => {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      return normalizedDate.toDateString() === normalizedProjectEnd.toDateString();
    });
    
    // Calculate baseline start and end indices
    let baselineStartIndex: number;
    let baselineEndIndex: number;
    
    // Normalize viewport dates for comparison
    const normalizedViewportStart = new Date(viewportStart);
    normalizedViewportStart.setHours(0, 0, 0, 0);
    const normalizedViewportEnd = new Date(viewportEnd);
    normalizedViewportEnd.setHours(0, 0, 0, 0);
    
    if (normalizedProjectStart < normalizedViewportStart) {
      baselineStartIndex = 0; // Start baseline at viewport beginning
    } else if (projectStartIndex !== -1) {
      baselineStartIndex = projectStartIndex;
    } else {
      // Project starts after viewport - shouldn't render
      baselineStartIndex = dates.length;
    }
    
    if (normalizedProjectEnd > normalizedViewportEnd) {
      baselineEndIndex = dates.length - 1; // End baseline at viewport end
    } else if (projectEndIndex !== -1) {
      baselineEndIndex = projectEndIndex;
    } else {
      // Project ends before viewport - shouldn't render
      baselineEndIndex = -1;
    }
    
    // Calculate exact pixel positions using the same logic as HolidayOverlay
    const getColumnLeftPosition = (index: number) => {
      return index * columnWidth; // 40px per column for days, no gaps
    };
    
    // Baseline positioning (left edge of start column to right edge of end column)
    const baselineStartPx = getColumnLeftPosition(baselineStartIndex);
    const baselineEndPx = getColumnLeftPosition(baselineEndIndex) + columnWidth;
    const baselineWidthPx = baselineEndPx - baselineStartPx;
    
    // Circle position (start handle) - at the left edge of the start column
    let circleLeftPx: number;
    if (projectStartIndex !== -1) {
      // Project start is visible - position at left edge of start column
      circleLeftPx = getColumnLeftPosition(projectStartIndex);
    } else {
      // Project start is outside viewport - calculate relative position
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSinceViewportStart = (normalizedProjectStart.getTime() - normalizedViewportStart.getTime()) / msPerDay;
      circleLeftPx = daysSinceViewportStart * columnWidth;
    }
    
    // Triangle position (end handle) - at the right edge of the end column
    let triangleLeftPx: number;
    if (projectEndIndex !== -1) {
      // Project end is visible - position at right edge of end column
      triangleLeftPx = getColumnLeftPosition(projectEndIndex) + columnWidth;
    } else {
      // Project end is outside viewport - calculate relative position
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSinceViewportStartEnd = (normalizedProjectEnd.getTime() - normalizedViewportStart.getTime()) / msPerDay;
      triangleLeftPx = (daysSinceViewportStartEnd + 1) * columnWidth;
    }
    
    return {
      baselineStartPx,
      baselineWidthPx,
      circleLeftPx,
      triangleLeftPx
    };
  }
}

// Validation function to ensure positions are consistent
export function validatePositions(positions: PositionCalculation): boolean {
  const { baselineStartPx, baselineWidthPx, circleLeftPx, triangleLeftPx } = positions;
  
  // Baseline percentages should be between 0 and 100 (they're viewport-constrained)
  const baselineValid = baselineStartPx >= 0 && baselineWidthPx >= 0;
  
  // Circle and triangle can be outside 0-100% range (they follow actual project dates)
  // but circle should be before or at triangle position
  const orderValid = circleLeftPx <= triangleLeftPx;
  
  return baselineValid && orderValid;
}

// Helper function to check if a handle is visible in the viewport
export function isHandleVisible(position: number, handleWidth: number = 11): boolean {
  // Handle is visible if any part of it overlaps with the 0-100% viewport range
  const handleStart = position - (handleWidth / 2) / 100; // Convert pixels to percentage roughly
  const handleEnd = position + (handleWidth / 2) / 100;
  
  return handleEnd >= 0 && handleStart <= 100;
}

// Helper function to get safe positioning for CSS (clamps extreme values)
export function getSafePosition(position: number): number {
  // Allow some overflow for better UX, but prevent extreme values that could break layout
  return Math.max(-20, Math.min(120, position));
}