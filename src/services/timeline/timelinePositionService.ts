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

// ============================================================================
// HOLIDAY POSITIONING CALCULATIONS
// ============================================================================

/**
 * Holiday position calculation interface
 */
export interface HolidayPositionCalculation {
  leftPx: number;
  widthPx: number;
  startDayIndex: number;
  endDayIndex: number;
}

/**
 * Mouse position to timeline index conversion interface
 */
export interface MouseToIndexConversion {
  index: number;
  isValid: boolean;
}

/**
 * Calculate which date indices are occupied by existing holidays
 */
export function calculateOccupiedHolidayIndices(
  holidays: Array<{ startDate: Date; endDate: Date }>,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): Set<number> {
  const occupied = new Set<number>();

  holidays.forEach(holiday => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);

    if (mode === 'weeks') {
      // For weeks mode with day-level precision, calculate which day indices are occupied
      dates.forEach((weekStartDate, weekIndex) => {
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
          const dayDate = new Date(weekStartDate);
          dayDate.setDate(weekStartDate.getDate() + dayOfWeek);
          dayDate.setHours(0, 0, 0, 0);

          const dayEnd = new Date(dayDate);
          dayEnd.setHours(23, 59, 59, 999);

          // Check if this day falls within holiday range
          if (!(holidayEnd < dayDate || holidayStart > dayEnd)) {
            const dayIndex = weekIndex * 7 + dayOfWeek;
            occupied.add(dayIndex);
          }
        }
      });
    } else {
      // Original days mode logic
      dates.forEach((date, index) => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        if (!(holidayEnd < dayStart || holidayStart > dayEnd)) {
          occupied.add(index);
        }
      });
    }
  });

  return occupied;
}

/**
 * Convert mouse position to timeline index
 */
export function convertMousePositionToIndex(
  clientX: number,
  containerRect: DOMRect,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days',
  occupiedIndices: Set<number>
): MouseToIndexConversion {
  const x = clientX - containerRect.left;
  let index: number;

  if (mode === 'weeks') {
    // In week mode, calculate precise day-level index within week columns
    const dayWidth = 11; // Exact 11px per day (77px ÷ 7 days)
    const totalDays = dates.length * 7; // Total number of days across all weeks
    const dayIndex = Math.floor(x / dayWidth);
    index = Math.max(0, Math.min(totalDays - 1, dayIndex));
  } else {
    // Days mode: use actual column width (40px) with no gaps
    const columnWidth = 40;
    index = Math.floor(x / columnWidth);
    index = Math.max(0, Math.min(dates.length - 1, index));
  }

  const maxIndex = mode === 'weeks' ? dates.length * 7 : dates.length;
  const isValid = index >= 0 && index < maxIndex && !occupiedIndices.has(index);

  return { index, isValid };
}

/**
 * Calculate holiday overlay position
 */
export function calculateHolidayOverlayPosition(
  holiday: { startDate: Date; endDate: Date },
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): HolidayPositionCalculation | null {
  const expandedDates = expandHolidayDates([holiday]);
  const columnWidth = mode === 'weeks' ? 77 : 40;
  const dayWidth = mode === 'weeks' ? 11 : columnWidth; // 11px per day in weeks mode
  const totalDays = mode === 'weeks' ? dates.length * 7 : dates.length;

  // Calculate day positions for the holiday
  const timelineStart = new Date(dates[0]);
  timelineStart.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;

  const startDay = Math.floor((expandedDates[0].getTime() - timelineStart.getTime()) / msPerDay);
  const holidayDays = expandedDates.length;

  const startDayIndex = Math.max(0, startDay);
  const endDayIndex = Math.min(totalDays - 1, startDay + holidayDays - 1);

  if (endDayIndex < 0 || startDayIndex > totalDays - 1) {
    return null;
  }

  const leftPx = startDayIndex * dayWidth;
  const widthPx = (endDayIndex - startDayIndex + 1) * dayWidth;

  return {
    leftPx,
    widthPx,
    startDayIndex,
    endDayIndex
  };
}

/**
 * Convert timeline indices back to actual dates
 */
export function convertIndicesToDates(
  startIndex: number,
  endIndex: number,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): { startDate: Date; endDate: Date } {
  if (mode === 'weeks') {
    // Convert day-level indices back to actual dates
    const startWeekIndex = Math.floor(startIndex / 7);
    const startDayOfWeek = startIndex % 7;
    const endWeekIndex = Math.floor(endIndex / 7);
    const endDayOfWeek = endIndex % 7;

    // Calculate start date
    const startDate = new Date(dates[startWeekIndex]);
    startDate.setDate(startDate.getDate() + startDayOfWeek);
    startDate.setHours(0, 0, 0, 0);

    // Calculate end date
    const endDate = new Date(dates[endWeekIndex]);
    endDate.setDate(endDate.getDate() + endDayOfWeek);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  } else {
    // Days mode: use existing logic
    const startDate = new Date(dates[startIndex]);
    const endDate = new Date(dates[endIndex]);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
  }
}

/**
 * Expand holiday dates to include all days in the range
 */
function expandHolidayDates(holidays: Array<{ startDate: Date; endDate: Date }>): Date[] {
  const expandedDates: Date[] = [];

  holidays.forEach(holiday => {
    const start = new Date(holiday.startDate);
    const end = new Date(holiday.endDate);

    // Normalize to start of day
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const current = new Date(start);
    while (current <= end) {
      expandedDates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  });

  return expandedDates;
}
