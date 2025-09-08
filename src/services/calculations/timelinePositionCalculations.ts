/**
 * Timeline Position Calculations
 * 
 * Extracted from timelinePositionService.ts - handles timeline positioning and scrollbar calculations
 * Part of unified calculations layer for consistent timeline positioning
 */

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
 * Holiday position calculation interface
 */
export interface HolidayPositionCalculation {
  left: number;
  width: number;
  isVisible: boolean;
}

/**
 * Mouse to index conversion interface
 */
export interface MouseToIndexConversion {
  dayIndex: number;
  date: Date;
  isValid: boolean;
}

// Timeline constants
export const TIMELINE_CONSTANTS = {
  COLUMN_WIDTH_DAYS: 40,
  COLUMN_WIDTH_WEEKS: 77,
  DAYS_PER_WEEK: 7,
  DAY_WIDTH_IN_WEEK_MODE: 11,
  CIRCLE_SIZE: 8,
  TRIANGLE_SIZE: 6,
  ANIMATION_DURATION: 500,
  EASING_FACTOR: 0.3
} as const;

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
  const columnWidth = mode === 'weeks' ? TIMELINE_CONSTANTS.COLUMN_WIDTH_WEEKS : TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS;
  
  if (mode === 'weeks') {
    return calculateWeeksModePositions(
      projectStart,
      projectEnd,
      viewportStart,
      columnWidth
    );
  }
  
  return calculateDaysModePositions(
    projectStart,
    projectEnd,
    viewportStart,
    columnWidth
  );
}

/**
 * Calculate positions for weeks mode
 */
function calculateWeeksModePositions(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  columnWidth: number
): TimelinePositionCalculation {
  const startOffset = getWeekOffset(viewportStart, projectStart);
  const duration = getWeeksDifference(projectStart, projectEnd);
  
  const baselineStartPx = startOffset * columnWidth;
  const baselineWidthPx = duration * columnWidth;
  
  // Position indicators
  const circleLeftPx = baselineStartPx - TIMELINE_CONSTANTS.CIRCLE_SIZE / 2;
  const triangleLeftPx = baselineStartPx + baselineWidthPx - TIMELINE_CONSTANTS.TRIANGLE_SIZE / 2;
  
  return {
    baselineStartPx,
    baselineWidthPx,
    circleLeftPx,
    triangleLeftPx
  };
}

/**
 * Calculate positions for days mode
 */
function calculateDaysModePositions(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  columnWidth: number
): TimelinePositionCalculation {
  const startOffset = getDaysOffset(viewportStart, projectStart);
  const duration = getDaysDifference(projectStart, projectEnd);
  
  const baselineStartPx = startOffset * columnWidth;
  const baselineWidthPx = duration * columnWidth;
  
  // Position indicators
  const circleLeftPx = baselineStartPx - TIMELINE_CONSTANTS.CIRCLE_SIZE / 2;
  const triangleLeftPx = baselineStartPx + baselineWidthPx - TIMELINE_CONSTANTS.TRIANGLE_SIZE / 2;
  
  return {
    baselineStartPx,
    baselineWidthPx,
    circleLeftPx,
    triangleLeftPx
  };
}

/**
 * Calculate week offset between two dates
 */
function getWeekOffset(fromDate: Date, toDate: Date): number {
  const diffTime = toDate.getTime() - fromDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return Math.floor(diffDays / TIMELINE_CONSTANTS.DAYS_PER_WEEK);
}

/**
 * Calculate weeks difference between two dates
 */
function getWeeksDifference(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return Math.ceil(diffDays / TIMELINE_CONSTANTS.DAYS_PER_WEEK);
}

/**
 * Calculate days offset between two dates
 */
function getDaysOffset(fromDate: Date, toDate: Date): number {
  const diffTime = toDate.getTime() - fromDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days difference between two dates
 */
function getDaysDifference(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate scrollbar position and dimensions
 */
export function calculateScrollbarPosition(
  viewportStart: Date,
  viewportEnd: Date,
  fullTimelineStart: Date,
  fullTimelineEnd: Date,
  scrollbarWidth: number
): ScrollbarCalculation {
  const totalDays = getDaysDifference(fullTimelineStart, fullTimelineEnd);
  const viewportDays = getDaysDifference(viewportStart, viewportEnd);
  const currentDayOffset = getDaysOffset(fullTimelineStart, viewportStart);
  
  const thumbWidth = Math.max(20, (viewportDays / totalDays) * scrollbarWidth);
  const maxOffset = Math.max(0, totalDays - viewportDays);
  const thumbPosition = maxOffset > 0 ? (currentDayOffset / maxOffset) * (scrollbarWidth - thumbWidth) : 0;
  
  return {
    fullTimelineStart,
    currentDayOffset,
    thumbPosition,
    thumbWidth,
    maxOffset
  };
}

/**
 * Calculate scrollbar click target
 */
export function calculateScrollbarClickTarget(
  clickX: number,
  scrollbarRect: DOMRect,
  scrollbarCalculation: ScrollbarCalculation
): number {
  const relativeX = clickX - scrollbarRect.left;
  const scrollbarWidth = scrollbarRect.width;
  
  // Calculate new offset based on click position
  const targetPosition = Math.max(0, Math.min(scrollbarWidth - scrollbarCalculation.thumbWidth, relativeX - scrollbarCalculation.thumbWidth / 2));
  const newOffset = (targetPosition / (scrollbarWidth - scrollbarCalculation.thumbWidth)) * scrollbarCalculation.maxOffset;
  
  return Math.round(newOffset);
}

/**
 * Calculate scrollbar drag target
 */
export function calculateScrollbarDragTarget(
  dragDeltaX: number,
  currentPosition: number,
  scrollbarWidth: number,
  scrollbarCalculation: ScrollbarCalculation
): number {
  const newPosition = currentPosition + dragDeltaX;
  const clampedPosition = Math.max(0, Math.min(scrollbarWidth - scrollbarCalculation.thumbWidth, newPosition));
  const newOffset = (clampedPosition / (scrollbarWidth - scrollbarCalculation.thumbWidth)) * scrollbarCalculation.maxOffset;
  
  return Math.round(newOffset);
}

/**
 * Calculate easing animation values
 */
export function calculateScrollEasing(
  currentTime: number,
  config: ScrollAnimationConfig
): { thumbPosition: number; offset: number; isComplete: boolean } {
  const elapsed = currentTime - config.startTime;
  const progress = Math.min(elapsed / config.animationDuration, 1);
  
  // Apply easing function (ease-out cubic)
  const easeProgress = 1 - Math.pow(1 - progress, 3);
  
  const thumbPosition = config.startThumbPosition + 
    (config.targetThumbPosition - config.startThumbPosition) * easeProgress;
  
  const offset = config.startOffset + 
    (config.targetOffset - config.startOffset) * easeProgress;
  
  return {
    thumbPosition,
    offset: Math.round(offset),
    isComplete: progress >= 1
  };
}

/**
 * Calculate animation duration based on distance
 */
export function calculateAnimationDuration(
  startOffset: number,
  targetOffset: number,
  baseDuration: number = TIMELINE_CONSTANTS.ANIMATION_DURATION
): number {
  const distance = Math.abs(targetOffset - startOffset);
  const factor = Math.min(2, Math.max(0.5, distance / 30));
  return baseDuration * factor;
}

/**
 * Convert mouse position to timeline index
 */
export function calculateMouseToTimelineIndex(
  mouseX: number,
  containerRect: DOMRect,
  viewportStart: Date,
  mode: 'days' | 'weeks' = 'days'
): MouseToIndexConversion {
  const relativeX = mouseX - containerRect.left;
  const columnWidth = mode === 'weeks' ? TIMELINE_CONSTANTS.COLUMN_WIDTH_WEEKS : TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS;
  
  const dayIndex = Math.floor(relativeX / columnWidth);
  const date = new Date(viewportStart);
  
  if (mode === 'weeks') {
    date.setDate(date.getDate() + (dayIndex * TIMELINE_CONSTANTS.DAYS_PER_WEEK));
  } else {
    date.setDate(date.getDate() + dayIndex);
  }
  
  const isValid = dayIndex >= 0 && relativeX >= 0 && relativeX <= containerRect.width;
  
  return {
    dayIndex,
    date,
    isValid
  };
}

/**
 * Calculate holiday position on timeline
 */
export function calculateHolidayPosition(
  holidayDate: Date,
  viewportStart: Date,
  viewportEnd: Date,
  mode: 'days' | 'weeks' = 'days'
): HolidayPositionCalculation {
  const columnWidth = mode === 'weeks' ? TIMELINE_CONSTANTS.COLUMN_WIDTH_WEEKS : TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS;
  const dayOffset = getDaysOffset(viewportStart, holidayDate);
  
  const isVisible = holidayDate >= viewportStart && holidayDate <= viewportEnd;
  
  let left = 0;
  let width: number = columnWidth;
  
  if (mode === 'weeks') {
    // In weeks mode, position within the week column
    const weekOffset = Math.floor(dayOffset / TIMELINE_CONSTANTS.DAYS_PER_WEEK);
    const dayInWeek = dayOffset % TIMELINE_CONSTANTS.DAYS_PER_WEEK;
    left = weekOffset * columnWidth + (dayInWeek * TIMELINE_CONSTANTS.DAY_WIDTH_IN_WEEK_MODE);
    width = TIMELINE_CONSTANTS.DAY_WIDTH_IN_WEEK_MODE;
  } else {
    left = dayOffset * columnWidth;
  }
  
  return {
    left,
    width,
    isVisible
  };
}

/**
 * Calculate optimal scroll position to center a date
 */
export function calculateCenterScrollPosition(
  targetDate: Date,
  fullTimelineStart: Date,
  fullTimelineEnd: Date,
  viewportDays: number
): number {
  const totalDays = getDaysDifference(fullTimelineStart, fullTimelineEnd);
  const targetDayIndex = getDaysOffset(fullTimelineStart, targetDate);
  
  // Center the target date in the viewport
  const centerOffset = Math.max(0, targetDayIndex - Math.floor(viewportDays / 2));
  const maxOffset = Math.max(0, totalDays - viewportDays);
  
  return Math.min(centerOffset, maxOffset);
}

/**
 * Calculate occupied holiday indices
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
      // Days mode logic
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
  let dayIndex: number;

  if (mode === 'weeks') {
    // In week mode, calculate precise day-level index within week columns
    const dayWidth = TIMELINE_CONSTANTS.DAY_WIDTH_IN_WEEK_MODE;
    const totalDays = dates.length * TIMELINE_CONSTANTS.DAYS_PER_WEEK;
    dayIndex = Math.floor(x / dayWidth);
    dayIndex = Math.max(0, Math.min(totalDays - 1, dayIndex));
  } else {
    // Days mode: use actual column width with no gaps
    const columnWidth = TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS;
    dayIndex = Math.floor(x / columnWidth);
    dayIndex = Math.max(0, Math.min(dates.length - 1, dayIndex));
  }

  const maxIndex = mode === 'weeks' ? dates.length * TIMELINE_CONSTANTS.DAYS_PER_WEEK : dates.length;
  const isValid = dayIndex >= 0 && dayIndex < maxIndex && !occupiedIndices.has(dayIndex);

  // Calculate the corresponding date
  const date = new Date(dates[mode === 'weeks' ? Math.floor(dayIndex / TIMELINE_CONSTANTS.DAYS_PER_WEEK) : dayIndex]);
  if (mode === 'weeks') {
    const dayInWeek = dayIndex % TIMELINE_CONSTANTS.DAYS_PER_WEEK;
    date.setDate(date.getDate() + dayInWeek);
  }

  return { dayIndex, date, isValid };
}

/**
 * Convert indices to dates array
 */
export function convertIndicesToDates(
  indices: number[],
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): Date[] {
  return indices.map(index => {
    if (mode === 'weeks') {
      const weekIndex = Math.floor(index / TIMELINE_CONSTANTS.DAYS_PER_WEEK);
      const dayInWeek = index % TIMELINE_CONSTANTS.DAYS_PER_WEEK;
      const date = new Date(dates[weekIndex]);
      date.setDate(date.getDate() + dayInWeek);
      return date;
    } else {
      return new Date(dates[index]);
    }
  });
}

/**
 * Calculate minimum hover overlay size
 */
export function calculateMinimumHoverOverlaySize(
  mode: 'days' | 'weeks' = 'days'
): { width: number; height: number } {
  const width = mode === 'weeks' ? TIMELINE_CONSTANTS.DAY_WIDTH_IN_WEEK_MODE : TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS;
  const height = 40; // Standard row height
  
  return { width, height };
}
