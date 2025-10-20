/**
 * UI POSITIONING SERVICE
 * Single source of truth for all timeline positioning calculations
 * Solves the project bar calculation inconsistency issue
 */

import { normalizeToMidnight } from '../../calculations/general/dateCalculations';
import type { Holiday } from '../../../types';

// Timeline position calculation result type
export type TimelinePositionCalculation = {
  baselineStartPx: number;
  baselineWidthPx: number;
  circleLeftPx: number;
  triangleLeftPx: number;
};

// ============================================================================
// CORE TIMELINE POSITIONING (Migrated from TimelinePositioningService)
// ============================================================================

/**
 * Calculate timeline element positions for projects/milestones
 * Implementation moved from legacy TimelinePositioningService to break circular dependency
 */
export function calculateTimelinePositions(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): TimelinePositionCalculation {
  try {
    if (mode === 'weeks') {
      return calculateWeeksModePositions(
        projectStart,
        projectEnd,
        viewportStart,
        viewportEnd,
        dates
      );
    } else {
      const columnWidth = 40; // Standard column width for days mode
      return calculateDaysModePositions(
        projectStart,
        projectEnd,
        viewportStart,
        viewportEnd,
        dates,
        columnWidth
      );
    }
  } catch (error) {
    console.error('Error in calculateTimelinePositions:', error);
    return { baselineStartPx: 0, baselineWidthPx: 0, circleLeftPx: 0, triangleLeftPx: 0 };
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
  const firstDate = dates[0];
  if (!firstDate) {
    return { baselineStartPx: 0, baselineWidthPx: 0, circleLeftPx: 0, triangleLeftPx: 0 };
  }

  // Normalize all dates for consistent comparison
  const normalizedProjectStart = normalizeToMidnight(projectStart);
  const normalizedProjectEnd = normalizeToMidnight(projectEnd);
  const normalizedViewportStart = normalizeToMidnight(viewportStart);
  const normalizedViewportEnd = normalizeToMidnight(viewportEnd);
  const normalizedFirstDate = normalizeToMidnight(firstDate);

  // Calculate positions based on day offsets from first date (like weeks mode)
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysFromStartToProjectStart = Math.floor(
    (normalizedProjectStart.getTime() - normalizedFirstDate.getTime()) / msPerDay
  );
  const daysFromStartToProjectEnd = Math.floor(
    (normalizedProjectEnd.getTime() - normalizedFirstDate.getTime()) / msPerDay
  );

  // Calculate exact pixel positions
  const circleLeftPx = daysFromStartToProjectStart * columnWidth;
  const triangleLeftPx = (daysFromStartToProjectEnd + 1) * columnWidth;

  // Find project start/end indices in dates array for baseline calculation
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

  // Calculate pixel positions for baseline
  const baselineStartPx = getColumnLeftPosition(baselineStartIndex, columnWidth);
  const baselineEndPx = getColumnLeftPosition(baselineEndIndex, columnWidth) + columnWidth;
  const baselineWidthPx = baselineEndPx - baselineStartPx;

  return {
    baselineStartPx,
    baselineWidthPx,
    circleLeftPx,
    triangleLeftPx
  };
}

// Helper functions for days mode calculations
function findDateIndex(dates: Date[], targetDate: Date): number {
  return dates.findIndex(date => {
    const normalized = normalizeToMidnight(date);
    return normalized.getTime() === targetDate.getTime();
  });
}

function calculateBaselineBounds(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  projectStartIndex: number,
  projectEndIndex: number,
  datesLength: number
): { baselineStartIndex: number; baselineEndIndex: number } {
  const actualStart = Math.max(projectStart.getTime(), viewportStart.getTime());
  const actualEnd = Math.min(projectEnd.getTime(), viewportEnd.getTime());

  let baselineStartIndex = projectStartIndex;
  let baselineEndIndex = projectEndIndex;

  if (projectStart < viewportStart) {
    baselineStartIndex = 0;
  }
  if (projectEnd > viewportEnd) {
    baselineEndIndex = datesLength - 1;
  }

  return { baselineStartIndex, baselineEndIndex };
}

function getColumnLeftPosition(index: number, columnWidth: number): number {
  return Math.max(0, index * columnWidth);
}

function calculateCirclePosition(
  projectStartIndex: number,
  projectStart: Date,
  viewportStart: Date,
  columnWidth: number
): number {
  // Always calculate position relative to the dates array, regardless of viewport
  // This ensures the circle stays with its project date, not stuck at viewport edge
  return Math.max(0, projectStartIndex * columnWidth);
}

function calculateTrianglePosition(
  projectEndIndex: number,
  projectEnd: Date,
  viewportStart: Date,
  columnWidth: number
): number {
  return Math.max(0, (projectEndIndex + 1) * columnWidth);
}

// ============================================================================
// UNIFIED PROJECT BAR POSITIONING
// ============================================================================

/**
 * Unified project bar position calculation
 * Replaces duplicate calculateProjectPosition/calculateTimelineBarPosition methods
 */
export interface ProjectBarPosition {
  left: number;
  width: number;
  startIndex: number;
  visible: boolean;
}

/**
 * Calculate project bar position - SINGLE SOURCE OF TRUTH
 * This replaces:
 * - TimelineCalculationService.calculateTimelineBarPosition
 * - TimelineCalculationService.calculateProjectPosition
 * - TimelinePositioningService.calculateProjectPosition
 */
export function calculateProjectBarPosition(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): ProjectBarPosition {
  // Use the migrated calculateTimelinePositions function
  const positions = calculateTimelinePositions(
    projectStart,
    projectEnd,
    viewportStart,
    viewportEnd,
    dates,
    mode
  );

  // Find start index for compatibility with legacy components
  const startIndex = dates.findIndex(date =>
    date.toDateString() === projectStart.toDateString()
  );

  // Calculate visibility
  const visible = !(projectEnd < viewportStart || projectStart > viewportEnd);

  return {
    left: positions.baselineStartPx,
    width: positions.baselineWidthPx,
    startIndex: Math.max(0, startIndex),
    visible
  };
}

/**
 * Calculate milestone position within project bar
 * Single source for all milestone positioning
 */
export interface MilestonePosition {
  left: number;
  visible: boolean;
}

export function calculateMilestoneUIPosition(
  milestoneDate: Date,
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): MilestonePosition {
  // Use local positioning service (no longer delegates to legacy)
  const positions = calculateTimelinePositions(
    milestoneDate,
    milestoneDate,
    viewportStart,
    viewportEnd,
    dates,
    mode
  );

  // Check if milestone is within project timespan and viewport
  const withinProject = milestoneDate >= projectStart && milestoneDate <= projectEnd;
  const withinViewport = milestoneDate >= viewportStart && milestoneDate <= viewportEnd;

  return {
    left: positions.baselineStartPx,
    visible: withinProject && withinViewport
  };
}

// ============================================================================
// TIMELINE HANDLE POSITIONING (unified)
// ============================================================================

/**
 * Get the full timeline position calculation
 * Direct delegation to existing service for now
 */
export function getTimelinePositions(
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): TimelinePositionCalculation {
  return calculateTimelinePositions(
    projectStart,
    projectEnd,
    viewportStart,
    viewportEnd,
    dates,
    mode
  );
}

// ============================================================================
// HEIGHT CALCULATIONS (migrated from HeightCalculationService)
// ============================================================================

/**
 * Calculate rectangle height based on hours per day
 * Uses consistent formula: minimum 3px, scale by hours (4px per hour)
 * Migrated from legacy/HeightCalculationService
 */
export function calculateRectangleHeight(hoursPerDay: number, maxHeight: number = 28): number {
  if (hoursPerDay === 0) return 0;

  // Base formula: minimum 3px, scale by hours (4px per hour)
  const heightInPixels = Math.max(3, Math.round(hoursPerDay * 4));

  // Apply maximum height constraint
  return Math.min(heightInPixels, maxHeight);
}

/**
 * Calculate project-level rectangle height (higher max for overview)
 * Migrated from legacy/HeightCalculationService
 */
export function calculateProjectHeight(hoursPerDay: number): number {
  return calculateRectangleHeight(hoursPerDay, 40);
}

/**
 * Calculate day-level rectangle height (lower max for detailed view)
 * Migrated from legacy/HeightCalculationService
 */
export function calculateDayHeight(hoursPerDay: number): number {
  return calculateRectangleHeight(hoursPerDay, 28);
}

/**
 * Calculate milestone segment height (same as project level)
 * Migrated from legacy/HeightCalculationService
 */
export function calculateSegmentHeight(hoursPerDay: number): number {
  return calculateRectangleHeight(hoursPerDay, 40);
}

// ============================================================================
// MIGRATION COMPATIBILITY
// ============================================================================

/**
 * Legacy compatibility wrapper for TimelineCalculationService.calculateTimelineBarPosition
 * TODO: Remove after migration complete
 */
export function calculateTimelineBarPosition_LEGACY(
  dates: Date[],
  project: { startDate: Date; endDate: Date }
): { startIndex: number; width: number } {
  const projectStart = new Date(project.startDate);
  const projectEnd = new Date(project.endDate);
  
  // Use our unified calculation
  const position = calculateProjectBarPosition(
    projectStart,
    projectEnd,
    dates[0] || projectStart,
    dates[dates.length - 1] || projectEnd,
    dates,
    'days'
  );

  return {
    startIndex: position.startIndex,
    width: position.width
  };
}

// ============================================================================
// SCROLLBAR & INTERACTION UI FUNCTIONS (Moved from calculations/timelinePositioning.ts)
// ============================================================================

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
 * Holiday position calculation result
 */
export interface HolidayPositionCalculation {
  left: number;
  width: number;
  visible: boolean;
}

/**
 * Mouse position to timeline index conversion result
 */
export interface MouseToIndexConversion {
  index: number;
  date: Date;
  isValid: boolean;
}

/**
 * Timeline constants for UI calculations
 */
const TIMELINE_CONSTANTS = {
  COLUMN_WIDTH_DAYS: 40,
  COLUMN_WIDTH_WEEKS: 60,
  CIRCLE_SIZE: 8,
  TRIANGLE_SIZE: 8,
  VIEWPORT_DAYS: 14,
  SCROLLBAR_HEIGHT: 20,
  ANIMATION_DURATION: 300,
  EASING_FACTOR: 0.3
} as const;

/**
 * Calculate scrollbar position and dimensions
 */
export function calculateScrollbarPosition(
  currentOffset: number,
  maxOffset: number,
  containerWidth: number,
  viewportDays: number = TIMELINE_CONSTANTS.VIEWPORT_DAYS
): ScrollbarCalculation {
  // Calculate timeline start (14 days before current)
  const fullTimelineStart = new Date();
  fullTimelineStart.setDate(fullTimelineStart.getDate() - viewportDays);
  
  const currentDayOffset = Math.max(0, Math.min(currentOffset, maxOffset));
  const thumbWidth = Math.max(50, (containerWidth * viewportDays) / (maxOffset + viewportDays));
  const availableSpace = containerWidth - thumbWidth;
  const thumbPosition = maxOffset > 0 ? (currentDayOffset / maxOffset) * availableSpace : 0;
  
  return {
    fullTimelineStart,
    currentDayOffset,
    thumbPosition: Math.max(0, Math.min(thumbPosition, availableSpace)),
    thumbWidth,
    maxOffset
  };
}

/**
 * Calculate target scroll position from scrollbar click
 */
export function calculateScrollbarClickTarget(
  clickX: number,
  containerWidth: number,
  thumbWidth: number,
  maxOffset: number
): number {
  const availableSpace = containerWidth - thumbWidth;
  const targetRatio = Math.max(0, Math.min(1, clickX / availableSpace));
  return Math.round(targetRatio * maxOffset);
}

/**
 * Calculate scroll target during drag operations
 */
export function calculateScrollbarDragTarget(
  dragX: number,
  containerWidth: number,
  thumbWidth: number,
  maxOffset: number
): number {
  const availableSpace = containerWidth - thumbWidth;
  const clampedX = Math.max(0, Math.min(dragX, availableSpace));
  const ratio = availableSpace > 0 ? clampedX / availableSpace : 0;
  return Math.round(ratio * maxOffset);
}

/**
 * Calculate easing animation for smooth scrolling
 */
export function calculateScrollEasing(
  progress: number,
  startValue: number,
  targetValue: number,
  easingFactor: number = TIMELINE_CONSTANTS.EASING_FACTOR
): number {
  // Cubic ease-out function
  const easeProgress = 1 - Math.pow(1 - progress, 3);
  return startValue + (targetValue - startValue) * easeProgress;
}

/**
 * Calculate appropriate animation duration based on scroll distance
 */
export function calculateAnimationDuration(
  distance: number,
  baseDuration: number = TIMELINE_CONSTANTS.ANIMATION_DURATION
): number {
  const factor = Math.min(2, Math.max(0.5, Math.abs(distance) / 50));
  return Math.round(baseDuration * factor);
}

/**
 * Convert mouse position to timeline day index
 */
export function calculateMouseToTimelineIndex(
  mouseX: number,
  containerWidth: number,
  currentOffset: number,
  columnWidth: number = TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS
): MouseToIndexConversion {
  const relativeX = mouseX;
  const dayIndex = Math.floor(relativeX / columnWidth) + currentOffset;
  const date = new Date();
  date.setDate(date.getDate() + dayIndex - 14); // Adjust for viewport offset
  
  const isValid = relativeX >= 0 && relativeX <= containerWidth && dayIndex >= 0;
  
  return {
    index: Math.max(0, dayIndex),
    date,
    isValid
  };
}

/**
 * Calculate holiday/event position in timeline
 */
export function calculateHolidayPosition(
  holidayDate: Date,
  viewportStart: Date,
  viewportEnd: Date,
  columnWidth: number = TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS
): HolidayPositionCalculation {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((holidayDate.getTime() - viewportStart.getTime()) / msPerDay);
  
  const left = daysDiff * columnWidth;
  const visible = holidayDate >= viewportStart && holidayDate <= viewportEnd;
  
  return {
    left,
    width: columnWidth,
    visible
  };
}

/**
 * Calculate centered scroll position for a specific date
 */
export function calculateCenterScrollPosition(
  targetDate: Date,
  viewportStart: Date,
  viewportDays: number = TIMELINE_CONSTANTS.VIEWPORT_DAYS
): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.floor((targetDate.getTime() - viewportStart.getTime()) / msPerDay);
  return Math.max(0, daysDiff - Math.floor(viewportDays / 2));
}

/**
 * Calculate which day indices are occupied by holidays
 */
export function calculateOccupiedHolidayIndices(
  holidays: Holiday[],
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): number[] {
  const occupied: number[] = [];
  
  if (!holidays || holidays.length === 0 || !dates || dates.length === 0) {
    return occupied;
  }
  
  holidays.forEach(holiday => {
    // Ensure we have valid dates
    if (!holiday.startDate || typeof holiday.startDate.getTime !== 'function') {
      console.warn('Invalid holiday startDate:', holiday);
      return;
    }
    
    const holidayEnd = holiday.endDate || holiday.startDate;
    
    // Calculate day indices for the holiday period
    for (let d = new Date(holiday.startDate); d <= holidayEnd; d.setDate(d.getDate() + 1)) {
      dates.forEach((date, index) => {
        if (date.toDateString() === d.toDateString()) {
          occupied.push(index);
        }
      });
    }
  });
  
  return [...new Set(occupied)].sort((a, b) => a - b);
}

/**
 * Convert mouse position to day index with boundary checking
 */
export function convertMousePositionToIndex(
  mouseX: number,
  containerWidth: number,
  scrollOffset: number,
  columnWidth: number = TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS
): number {
  const relativeIndex = Math.floor(mouseX / columnWidth);
  const absoluteIndex = relativeIndex + scrollOffset;
  return Math.max(0, absoluteIndex);
}

/**
 * Convert mouse position to timeline index for holiday bar interactions
 * This version handles the specific needs of the SmartHoverAddHolidayBar component
 */
export function convertMousePositionToTimelineIndex(
  clientX: number,
  containerRect: DOMRect,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days',
  occupiedIndices: number[] = []
): { dayIndex: number; isValid: boolean } {
  const columnWidth = mode === 'weeks' ? TIMELINE_CONSTANTS.COLUMN_WIDTH_WEEKS : TIMELINE_CONSTANTS.COLUMN_WIDTH_DAYS;
  const relativeX = clientX - containerRect.left;
  const dayIndex = Math.floor(relativeX / columnWidth);
  
  const isValid = dayIndex >= 0 && 
                  dayIndex < dates.length && 
                  relativeX >= 0 && 
                  relativeX <= containerRect.width &&
                  !occupiedIndices.includes(dayIndex);
  
  return { dayIndex: Math.max(0, dayIndex), isValid };
}

/**
 * Convert day indices to actual dates
 */
export function convertIndicesToDates(
  indices: number[],
  datesArray?: Date[] | Date,
  mode: 'days' | 'weeks' = 'days'
): Date[] {
  // Handle different parameter patterns for backwards compatibility
  if (Array.isArray(datesArray)) {
    // New pattern: convertIndicesToDates([startIndex, endIndex], dates, mode)
    return indices.map(index => {
      if (index >= 0 && index < datesArray.length) {
        return datesArray[index];
      }
      // Fallback if index is out of bounds
      const firstDate = datesArray[0] || new Date();
      const date = new Date(firstDate);
      date.setDate(date.getDate() + index);
      return date;
    });
  } else {
    // Original pattern: convertIndicesToDates(indices, baseDate)
    const baseDate = datesArray instanceof Date ? datesArray : new Date();
    return indices.map(index => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + index);
      return date;
    });
  }
}

/**
 * Calculate minimum size for hover overlay elements
 */
export function calculateMinimumHoverOverlaySize(
  elementWidth: number,
  minSize: number = 40
): number {
  return Math.max(minSize, elementWidth);
}
