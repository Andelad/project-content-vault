// Timeline position calculation service - extracted from TimelineScrollbar and timelinePositioning.ts

/**
 * Timeline position calculation interface
 */
export interface TimelinePositionCalculation {
  baselineStartPx: number;
  baselineWidthPx: number;
  circleLeftPx: number;
  triangleLeftPx: number;
}

/**
 * Scrollbar position calculation interface
 */
export interface ScrollbarCalculation {
  fullTimelineStart: Date;
  currentDayOffset: number;
  thumbPosition: number;
  thumbWidth: number;
  maxOffset: number;
}

/**
 * Easing animation interface for timeline scrolling
 */
export interface ScrollAnimationConfig {
  startTime: number;
  startThumbPosition: number;
  targetThumbPosition: number;
  animationDuration: number;
  startOffset: number;
  targetOffset: number;
}

/**
 * Calculate timeline element positions for projects/milestones
 */
export function calculateTimelinePositions(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): TimelinePositionCalculation {
  const columnWidth = mode === 'weeks' ? 77 : 40; // 77px = 7 days × 11px per day
  
  if (mode === 'weeks') {
    return calculateWeeksModePositions(
      projectStart, 
      projectEnd, 
      viewportStart, 
      viewportEnd, 
      dates
    );
  } else {
    return calculateDaysModePositions(
      projectStart,
      projectEnd,
      viewportStart,
      viewportEnd,
      dates,
      columnWidth
    );
  }
}

/**
 * Calculate positions for weeks mode timeline
 */
function calculateWeeksModePositions(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[]
): TimelinePositionCalculation {
  const firstWeekStart = dates[0];
  if (!firstWeekStart) {
    return { baselineStartPx: 0, baselineWidthPx: 0, circleLeftPx: 0, triangleLeftPx: 0 };
  }
  
  const msPerDay = 24 * 60 * 60 * 1000;
  const dayWidth = 11; // Each day is exactly 11px wide in weeks mode
  
  // Calculate day offsets from first week start
  const daysFromStartToProjectStart = Math.floor(
    (projectStart.getTime() - firstWeekStart.getTime()) / msPerDay
  );
  const daysFromStartToProjectEnd = Math.floor(
    (projectEnd.getTime() - firstWeekStart.getTime()) / msPerDay
  );
  
  // Calculate exact pixel positions
  const circleLeftPx = daysFromStartToProjectStart * dayWidth;
  const triangleLeftPx = (daysFromStartToProjectEnd + 1) * dayWidth;
  
  // Calculate baseline for project intersection with viewport
  const projectIntersectsViewport = !(projectEnd < viewportStart || projectStart > viewportEnd);
  
  let baselineStartPx: number;
  let baselineWidthPx: number;
  
  if (projectIntersectsViewport) {
    baselineStartPx = daysFromStartToProjectStart * dayWidth;
    baselineWidthPx = Math.max(
      dayWidth * 0.5,
      (daysFromStartToProjectEnd + 1 - daysFromStartToProjectStart) * dayWidth
    );
  } else {
    baselineStartPx = daysFromStartToProjectStart * dayWidth;
    baselineWidthPx = Math.max(
      0,
      (daysFromStartToProjectEnd + 1 - daysFromStartToProjectStart) * dayWidth
    );
  }
  
  return {
    baselineStartPx,
    baselineWidthPx,
    circleLeftPx,
    triangleLeftPx
  };
}

/**
 * Calculate positions for days mode timeline
 */
function calculateDaysModePositions(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[],
  columnWidth: number
): TimelinePositionCalculation {
  // Normalize all dates for consistent comparison
  const normalizedProjectStart = normalizeToMidnight(projectStart);
  const normalizedProjectEnd = normalizeToMidnight(projectEnd);
  const normalizedViewportStart = normalizeToMidnight(viewportStart);
  const normalizedViewportEnd = normalizeToMidnight(viewportEnd);
  
  // Find project start/end indices in dates array
  const projectStartIndex = findDateIndex(dates, normalizedProjectStart);
  const projectEndIndex = findDateIndex(dates, normalizedProjectEnd);
  
  // Calculate baseline bounds
  const { baselineStartIndex, baselineEndIndex } = calculateBaselineBounds(
    normalizedProjectStart,
    normalizedProjectEnd,
    normalizedViewportStart,
    normalizedViewportEnd,
    projectStartIndex,
    projectEndIndex,
    dates.length
  );
  
  // Calculate pixel positions
  const baselineStartPx = getColumnLeftPosition(baselineStartIndex, columnWidth);
  const baselineEndPx = getColumnLeftPosition(baselineEndIndex, columnWidth) + columnWidth;
  const baselineWidthPx = baselineEndPx - baselineStartPx;
  
  // Calculate handle positions
  const circleLeftPx = calculateCirclePosition(
    projectStartIndex,
    normalizedProjectStart,
    normalizedViewportStart,
    columnWidth
  );
  
  const triangleLeftPx = calculateTrianglePosition(
    projectEndIndex,
    normalizedProjectEnd,
    normalizedViewportStart,
    columnWidth
  );
  
  return {
    baselineStartPx,
    baselineWidthPx,
    circleLeftPx,
    triangleLeftPx
  };
}

/**
 * Calculate scrollbar positioning for timeline navigation
 */
export function calculateScrollbarPosition(
  viewportStart: Date,
  viewportDays: number
): ScrollbarCalculation {
  const TOTAL_DAYS = 365; // Full year
  
  // Calculate full timeline start (January 1st of current year)
  const fullTimelineStart = new Date(viewportStart.getFullYear(), 0, 1);
  
  // Calculate current day offset from start of year
  const currentDayOffset = Math.round(
    (viewportStart.getTime() - fullTimelineStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  
  // Calculate thumb position and size as percentages
  const maxOffset = TOTAL_DAYS - viewportDays;
  const thumbPosition = maxOffset > 0 ? (currentDayOffset / maxOffset) * 100 : 0;
  const thumbWidth = (viewportDays / TOTAL_DAYS) * 100;
  
  return {
    fullTimelineStart,
    currentDayOffset,
    thumbPosition,
    thumbWidth,
    maxOffset
  };
}

/**
 * Calculate target viewport position from scrollbar click
 */
export function calculateScrollbarClickTarget(
  clickX: number,
  scrollbarWidth: number,
  fullTimelineStart: Date,
  maxOffset: number
): Date {
  const clickRatio = clickX / scrollbarWidth;
  const targetDayOffset = Math.round(clickRatio * maxOffset);
  
  const targetViewportStart = new Date(fullTimelineStart);
  targetViewportStart.setDate(fullTimelineStart.getDate() + targetDayOffset);
  
  return targetViewportStart;
}

/**
 * Calculate drag-based viewport position for scrollbar thumb
 */
export function calculateScrollbarDragTarget(
  deltaX: number,
  scrollbarWidth: number,
  dragStartOffset: number,
  maxOffset: number,
  fullTimelineStart: Date
): Date {
  const deltaRatio = deltaX / scrollbarWidth;
  const deltaDays = Math.round(deltaRatio * maxOffset);
  const newDayOffset = Math.max(0, Math.min(maxOffset, dragStartOffset + deltaDays));
  
  const newViewportStart = new Date(fullTimelineStart);
  newViewportStart.setDate(fullTimelineStart.getDate() + newDayOffset);
  
  return newViewportStart;
}

/**
 * Calculate smooth animation easing for timeline scrolling
 */
export function calculateScrollEasing(
  progress: number
): number {
  // Three-phase airplane-like easing with extended landing approach
  if (progress < 0.25) {
    // Takeoff phase (0-25%): Gentle acceleration
    const phaseProgress = progress / 0.25;
    return 0.25 * phaseProgress * phaseProgress; // Quadratic ease-in
  } else if (progress < 0.65) {
    // Flight phase (25-65%): Sustained high speed
    const phaseProgress = (progress - 0.25) / 0.4;
    return 0.25 + 0.55 * phaseProgress; // Linear from 25% to 80% distance
  } else {
    // Extended landing phase (65-100%): Long, gentle approach
    const phaseProgress = (progress - 0.65) / 0.35;
    
    // Super gentle quintic ease-out for extended gliding
    const quinticEase = 1 - Math.pow(1 - phaseProgress, 5);
    
    // Additional exponential smoothing for ultra-gentle final approach
    const expSmoothing = 1 - Math.exp(-3 * phaseProgress);
    
    // Combine both for maximum smoothness, weighted toward exponential
    const ultraGentleDecel = (quinticEase * 0.3) + (expSmoothing * 0.7);
    
    return 0.8 + 0.2 * ultraGentleDecel; // From 80% to 100% distance
  }
}

/**
 * Calculate animation duration based on distance for smooth scrolling
 */
export function calculateAnimationDuration(
  currentStart: number,
  targetStart: number
): number {
  const daysDifference = Math.abs((targetStart - currentStart) / (24 * 60 * 60 * 1000));
  
  const baseDuration = 500;
  const distanceMultiplier = Math.min(daysDifference * 40, 1200); // Up to 1200ms extra
  
  return baseDuration + distanceMultiplier;
}

// Helper functions

/**
 * Normalize date to midnight for consistent comparison
 */
function normalizeToMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Find index of date in dates array
 */
function findDateIndex(dates: Date[], targetDate: Date): number {
  return dates.findIndex(date => {
    const normalizedDate = normalizeToMidnight(date);
    return normalizedDate.toDateString() === targetDate.toDateString();
  });
}

/**
 * Calculate baseline start and end bounds for timeline
 */
function calculateBaselineBounds(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  projectStartIndex: number,
  projectEndIndex: number,
  datesLength: number
): { baselineStartIndex: number; baselineEndIndex: number } {
  let baselineStartIndex: number;
  let baselineEndIndex: number;
  
  if (projectStart < viewportStart) {
    baselineStartIndex = 0; // Start baseline at viewport beginning
  } else if (projectStartIndex !== -1) {
    baselineStartIndex = projectStartIndex;
  } else {
    baselineStartIndex = datesLength; // Project starts after viewport
  }
  
  if (projectEnd > viewportEnd) {
    baselineEndIndex = datesLength - 1; // End baseline at viewport end
  } else if (projectEndIndex !== -1) {
    baselineEndIndex = projectEndIndex;
  } else {
    baselineEndIndex = -1; // Project ends before viewport
  }
  
  return { baselineStartIndex, baselineEndIndex };
}

/**
 * Get column left position in pixels
 */
function getColumnLeftPosition(index: number, columnWidth: number): number {
  return index * columnWidth;
}

/**
 * Calculate circle (start handle) position
 */
function calculateCirclePosition(
  projectStartIndex: number,
  projectStart: Date,
  viewportStart: Date,
  columnWidth: number
): number {
  if (projectStartIndex !== -1) {
    // Project start is visible - position at left edge of start column
    return getColumnLeftPosition(projectStartIndex, columnWidth);
  } else {
    // Project start is outside viewport - calculate relative position
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceViewportStart = (projectStart.getTime() - viewportStart.getTime()) / msPerDay;
    return daysSinceViewportStart * columnWidth;
  }
}

/**
 * Calculate triangle (end handle) position
 */
function calculateTrianglePosition(
  projectEndIndex: number,
  projectEnd: Date,
  viewportStart: Date,
  columnWidth: number
): number {
  if (projectEndIndex !== -1) {
    // Project end is visible - position at right edge of end column
    return getColumnLeftPosition(projectEndIndex, columnWidth) + columnWidth;
  } else {
    // Project end is outside viewport - calculate relative position
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceViewportStartEnd = (projectEnd.getTime() - viewportStart.getTime()) / msPerDay;
    return (daysSinceViewportStartEnd + 1) * columnWidth;
  }
}

/**
 * Validation function to ensure positions are consistent
 */
export function validateTimelinePositions(positions: TimelinePositionCalculation): boolean {
  const { baselineStartPx, baselineWidthPx, circleLeftPx, triangleLeftPx } = positions;
  
  // Baseline should have valid dimensions
  const baselineValid = baselineStartPx >= 0 && baselineWidthPx >= 0;
  
  // Circle should be before or at triangle position
  const orderValid = circleLeftPx <= triangleLeftPx;
  
  return baselineValid && orderValid;
}

/**
 * Check if a handle is visible in the viewport
 */
export function isHandleVisible(position: number, handleWidth: number = 11): boolean {
  // Handle is visible if any part of it overlaps with the 0-100% viewport range
  const handleStart = position - (handleWidth / 2) / 100;
  const handleEnd = position + (handleWidth / 2) / 100;
  
  return handleEnd >= 0 && handleStart <= 100;
}

/**
 * Get safe positioning for CSS (clamps extreme values)
 */
export function getSafePosition(position: number): number {
  // Allow some overflow for better UX, but prevent extreme values
  return Math.max(-20, Math.min(120, position));
}
