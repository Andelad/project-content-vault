/**
 * Project Bar Positioning Service
 * Consolidated service for calculating project bar positions, widths, and visual offsets on the timeline
 * 
 * Responsibilities:
 * - Calculate pixel positions (left/width) for project bars
 * - Calculate visual offsets for drag operations
 * - Calculate project days and working hours
 * - Calculate column marker data for timeline UI
 * 
 * Replaces:
 * - TimelinePositioning.ts (project-specific functions)
 * - TimelineCalculations.ts (deleted - dead code removed)
 */

import { 
  normalizeToMidnight,
  addDaysToDate,
  isToday,
  isTodayInWeek,
  isWeekendDate,
  calculateProjectDaysInViewport,
  convertIndicesToDates,
  calculateOccupiedHolidayIndices
} from '@/presentation/app/utils/dateCalculations';
import {
  calculateWorkHoursTotal,
  calculateDayWorkHours,
  calculateTotalDayWorkHours
} from '@/domain/rules/availability/WorkHourGeneration';
import { formatDateShort, formatWeekdayDate } from '@/presentation/app/utils/dateFormatUtils';
import type { Holiday } from '@/shared/types/core';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import type { DragState } from './DragPositioning';

// Re-export date calculation functions for backwards compatibility
export { 
  convertIndicesToDates, 
  calculateOccupiedHolidayIndices
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type TimelinePositionCalculation = {
  baselineStartPx: number;
  baselineWidthPx: number;
};

export interface TimelineColumnData {
  date: Date;
  index: number;
  columnWidth: number;
  isToday: boolean;
  isNewMonth: boolean;
  isNewWeek: boolean;
  mode: 'days' | 'weeks';
  isWeekend?: boolean;
  weekendDays?: Array<{
    leftPx: number;
    dayWidthPx: number;
    date: Date;
  }>;
  todayPositionPx?: number;
}

// ============================================================================
// CORE PROJECT BAR POSITIONING
// ============================================================================

/**
 * Calculate timeline element positions for projects/milestones
 * Core positioning calculation for project bars on the timeline
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
      const columnWidth = 52; // Standard column width for days mode
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
    ErrorHandlingService.handle(error, { source: 'ProjectBarPositioning', action: 'Error in calculateTimelinePositions:' });
    return { baselineStartPx: 0, baselineWidthPx: 0 };
  }
}

/**
 * Calculate pixel position from day index in weeks mode
 * Accounts for varying day widths: days 0-5 are 22px, day 6 is 21px
 * @param dayIndex - Number of days from the start
 * @returns Pixel position
 */
function calculateWeekModePixelPosition(dayIndex: number): number {
  const completeWeeks = Math.floor(dayIndex / 7);
  const remainingDays = dayIndex % 7;
  
  // Each complete week is 153px (6 days × 22px + 1 day × 21px)
  const completeWeeksPx = completeWeeks * 153;
  
  // Remaining days: first 6 days are 22px each, 7th day is 21px
  const remainingDaysPx = remainingDays * 22;
  
  return completeWeeksPx + remainingDaysPx;
}

/**
 * Calculate width in pixels for a number of days in weeks mode
 * Accounts for varying day widths: days 0-5 are 22px, day 6 is 21px
 * @param startDayIndex - Starting day index
 * @param numDays - Number of days
 * @returns Width in pixels
 */
function calculateWeekModeWidth(startDayIndex: number, numDays: number): number {
  const endDayIndex = startDayIndex + numDays;
  return calculateWeekModePixelPosition(endDayIndex) - calculateWeekModePixelPosition(startDayIndex);
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
    return { baselineStartPx: 0, baselineWidthPx: 0 };
  }

  const msPerDay = 24 * 60 * 60 * 1000;

  // Calculate day offsets from first week start
  const daysFromStartToProjectStart = Math.floor(
    (projectStart.getTime() - firstWeekStart.getTime()) / msPerDay
  );
  const daysFromStartToProjectEnd = Math.floor(
    (projectEnd.getTime() - firstWeekStart.getTime()) / msPerDay
  );

  // Calculate baseline for project intersection with viewport
  const projectIntersectsViewport = !(projectEnd < viewportStart || projectStart > viewportEnd);

  let baselineStartPx: number;
  let baselineWidthPx: number;

  if (projectIntersectsViewport) {
    // Use new calculation that accounts for varying day widths
    baselineStartPx = calculateWeekModePixelPosition(daysFromStartToProjectStart) - 2; // Start 2px before
    const numDays = daysFromStartToProjectEnd + 1 - daysFromStartToProjectStart;
    // Width: use accurate calculation + 4px (2px padding on each side)
    baselineWidthPx = Math.max(
      11, // Minimum half-day width
      calculateWeekModeWidth(daysFromStartToProjectStart, numDays) + 4
    );
  } else {
    baselineStartPx = calculateWeekModePixelPosition(daysFromStartToProjectStart) - 2; // Start 2px before
    const numDays = daysFromStartToProjectEnd + 1 - daysFromStartToProjectStart;
    baselineWidthPx = Math.max(
      11, // Minimum half-day width
      calculateWeekModeWidth(daysFromStartToProjectStart, numDays) + 4
    );
  }

  return { baselineStartPx, baselineWidthPx };
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
    return { baselineStartPx: 0, baselineWidthPx: 0 };
  }

  const msPerDay = 24 * 60 * 60 * 1000;

  // Calculate day offsets from first visible date
  const daysFromStartToProjectStart = Math.floor(
    (projectStart.getTime() - firstDate.getTime()) / msPerDay
  );
  const daysFromStartToProjectEnd = Math.floor(
    (projectEnd.getTime() - firstDate.getTime()) / msPerDay
  );

  // Calculate baseline for project intersection with viewport
  const projectIntersectsViewport = !(projectEnd < viewportStart || projectStart > viewportEnd);

  let baselineStartPx: number;
  let baselineWidthPx: number;

  if (projectIntersectsViewport) {
    baselineStartPx = daysFromStartToProjectStart * columnWidth;
    const numDays = daysFromStartToProjectEnd + 1 - daysFromStartToProjectStart;
    baselineWidthPx = Math.max(columnWidth * 0.8, numDays * columnWidth);
  } else {
    baselineStartPx = daysFromStartToProjectStart * columnWidth;
    const numDays = daysFromStartToProjectEnd + 1 - daysFromStartToProjectStart;
    baselineWidthPx = Math.max(columnWidth * 0.8, numDays * columnWidth);
  }

  return { baselineStartPx, baselineWidthPx };
}

/**
 * Public API for getting timeline positions
 * Used by components that need project bar positioning
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
// VISUAL DRAG CALCULATIONS
// ============================================================================

/**
 * Calculate baseline visual offsets for drag operations
 * Handles smooth visual feedback during project bar dragging
 */
export function calculateBaselineVisualOffsets(
  positions: TimelinePositionCalculation,
  isDragging: boolean,
  dragState: DragState | null | undefined,
  projectId: string,
  mode: 'days' | 'weeks' = 'days'
): TimelinePositionCalculation {
  let adjustedPositions: TimelinePositionCalculation = { ...positions };

  if (isDragging && dragState?.projectId === projectId) {
    // Use lastDaysDelta for consistent snapping across all modes
    const dayWidth = mode === 'weeks' ? 22 : 52;
    const daysDelta = dragState.lastDaysDelta || 0;
    const dragOffsetPx = daysDelta * dayWidth;

    const action = dragState?.action;

    if (action === 'resize-start-date') {
      // Only start date (and baseline left edge) should move visually
      adjustedPositions = {
        ...positions,
        baselineStartPx: positions.baselineStartPx + dragOffsetPx,
        // Width must shrink/grow opposite to left edge movement to keep right edge fixed
        baselineWidthPx: positions.baselineWidthPx - dragOffsetPx
      };
    } else if (action === 'resize-end-date') {
      // Only end date should move visually; keep baseline start fixed
      adjustedPositions = {
        ...positions,
        baselineStartPx: positions.baselineStartPx,
        // Width grows/shrinks with right edge movement
        baselineWidthPx: positions.baselineWidthPx + dragOffsetPx
      };
    }
  }

  return adjustedPositions;
}

/**
 * Calculate visual project dates with consolidated offset logic
 * Applies drag state to project dates for immediate visual feedback
 */
export function calculateVisualProjectDates(
  project: { id: string; startDate: Date; endDate?: Date; continuous?: boolean },
  isDragging: boolean,
  dragState: DragState | null | undefined
): { visualProjectStart: Date; visualProjectEnd: Date } {
  let visualProjectStart = new Date(project.startDate);
  // CRITICAL: For continuous projects, endDate should not be used for visuals
  // The calling code should use viewport end instead
  let visualProjectEnd = project.continuous 
    ? new Date(project.startDate) // Placeholder - caller should override with viewport end
    : new Date(project.endDate);

  // Apply drag offset based on action type for immediate visual feedback
  if (isDragging && dragState?.projectId === project.id) {
    // Use lastDaysDelta for consistent snapping to whole days
    const daysOffset = dragState.lastDaysDelta || 0;
    const action = dragState.action;

    if (action === 'resize-start-date') {
      // Only move start date
      visualProjectStart = new Date(project.startDate);
      visualProjectStart = addDaysToDate(visualProjectStart, daysOffset);
      // End date stays the same
    } else if (action === 'resize-end-date') {
      // Only move end date (not applicable for continuous projects)
      if (!project.continuous) {
        visualProjectEnd = new Date(project.endDate);
        visualProjectEnd = addDaysToDate(visualProjectEnd, daysOffset);
      }
      // Start date stays the same
    }
  }

  return { visualProjectStart, visualProjectEnd };
}

// ============================================================================
// HEIGHT CALCULATIONS
// ============================================================================

/**
 * Calculate rectangle height based on hours per day
 * Used for project bar rectangles representing time allocation
 */
export function calculateRectangleHeight(hoursPerDay: number, maxHeight: number = 40): number {
  // Scale height proportionally to hours
  const heightScale = hoursPerDay / 8; // 8 hours = full height
  const height = Math.min(heightScale * maxHeight, maxHeight);
  
  // Minimum 4px height for visibility
  return Math.max(4, height);
}

// ============================================================================
// PROJECT DAYS CALCULATION
// ============================================================================

/**
 * Calculate the visible project days within viewport bounds
 * Delegates to dateCalculations service
 */
export function calculateProjectDays(
  projectStartDate: Date,
  projectEndDate: Date,
  isContinuous: boolean,
  viewportStart: Date,
  viewportEnd: Date
): Date[] {
  return calculateProjectDaysInViewport(
    projectStartDate,
    projectEndDate,
    isContinuous,
    viewportStart,
    viewportEnd
  );
}

// ============================================================================
// TIMELINE COLUMN MARKERS
// ============================================================================

/**
 * Calculate column marker data for timeline columns
 * THE authoritative column marker calculation used everywhere
 */
export function calculateTimelineColumnMarkerData(
  dates: Date[], 
  mode: 'days' | 'weeks' = 'days'
): TimelineColumnData[] {
  const columnWidth = mode === 'weeks' ? 153 : 52;
  const WEEK_DAY_WIDTH_PX = 22; // 21px day + 1px gap
  const today = new Date();
  
  return dates.map((date, index) => {
    // Check if this column represents today
    let isCurrentDay = false;
    if (mode === 'days') {
      isCurrentDay = isToday(date);
    } else {
      isCurrentDay = isTodayInWeek(date);
    }
    
    if (mode === 'weeks') {
      // Week mode: calculate month and week separators
      const prevDate = index > 0 ? dates[index - 1] : null;
      const isNewMonth = index > 0 && prevDate && date.getMonth() !== prevDate.getMonth();
      const isNewWeek = index > 0; // Every column is a new week in weeks mode
      
      // Calculate weekend day positions within week
      const weekendDays = Array.from({ length: 7 }).map((_, dayOffset) => {
        let dayDate = new Date(date);
        dayDate = addDaysToDate(date, dayOffset);
        const isWeekendDay = isWeekendDate(dayDate);
        
        if (!isWeekendDay) return null;
        
  const leftPx = dayOffset * WEEK_DAY_WIDTH_PX;
  const dayWidthPx = WEEK_DAY_WIDTH_PX;
        
        return {
          leftPx,
          dayWidthPx,
          date: dayDate
        };
      }).filter(Boolean) as Array<{
        leftPx: number;
        dayWidthPx: number;
        date: Date;
      }>;
      
      // Calculate today position within week
      let todayPositionPx = 0;
      if (isCurrentDay) {
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysFromWeekStart = (dayOfWeek + 6) % 7; // Convert to Monday = 0 system
        todayPositionPx = daysFromWeekStart * WEEK_DAY_WIDTH_PX;
      }
      
      return {
        date,
        index,
        columnWidth,
        isToday: isCurrentDay,
        isNewMonth,
        isNewWeek,
        weekendDays,
        todayPositionPx,
        mode: 'weeks' as const
      };
    } else {
      // Days mode: calculate weekend and month separators
      const isWeekend = isWeekendDate(date);
      const prevDate = index > 0 ? dates[index - 1] : null;
      const isNewMonth = index > 0 && prevDate && date.getMonth() !== prevDate.getMonth();
      const isNewWeek = index > 0 && prevDate && date.getDay() === 1; // Monday starts new week
      
      return {
        date,
        index,
        columnWidth,
        isToday: isCurrentDay,
        isWeekend,
        isNewMonth,
        isNewWeek,
        mode: 'days' as const
      };
    }
  });
}

// ============================================================================
// LEGACY COMPATIBILITY (DEPRECATED - USE NEW FUNCTIONS ABOVE)
// ============================================================================

/**
 * @deprecated Use getTimelinePositions instead
 * Calculate timeline bar position for a project
 */
export function calculateTimelineBarPosition(
  dates: Date[],
  project: { startDate: Date; endDate: Date }
): { startIndex: number; width: number } {
  const startIndex = dates.findIndex(date =>
    date.toDateString() === project.startDate.toDateString()
  );
  const endIndex = dates.findIndex(date =>
    date.toDateString() === project.endDate.toDateString()
  );

  return {
    startIndex: Math.max(0, startIndex),
    width: endIndex >= 0 ? (endIndex - Math.max(0, startIndex) + 1) * 48 : 0
  };
}

// ============================================================================
// HOLIDAY BAR CALCULATIONS
// ============================================================================
// Note: calculateOccupiedHolidayIndices is imported from dateCalculations
// Re-exported here for backwards compatibility

/**
 * Convert mouse position to timeline index for holiday bar interactions
 */
export function convertMousePositionToTimelineIndex(
  clientX: number,
  containerRect: DOMRect,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days',
  occupiedIndices: number[] = []
): { dayIndex: number; isValid: boolean } {
  const relativeX = clientX - containerRect.left;
  let dayIndex: number;
  let maxIndex: number;
  
  if (mode === 'weeks') {
    // In weeks mode, calculate day-level index (21px per day + 1px gap)
    const dayWidth = 22; // 21px day + 1px gap = 22px effective spacing
    dayIndex = Math.floor(relativeX / dayWidth);
    maxIndex = dates.length * 7; // Total days across all weeks
  } else {
    // In days mode, use column width
    const columnWidth = 52;
    dayIndex = Math.floor(relativeX / columnWidth);
    maxIndex = dates.length;
  }
  
  const isValid = dayIndex >= 0 && 
                  dayIndex < maxIndex && 
                  relativeX >= 0 && 
                  relativeX <= containerRect.width &&
                  !occupiedIndices.includes(dayIndex);
  
  return { dayIndex: Math.max(0, dayIndex), isValid };
}

// Note: convertIndicesToDates is imported from dateCalculations
// Re-exported here for backwards compatibility

/**
 * Calculate minimum size for hover overlay elements
 */
export function calculateMinimumHoverOverlaySize(
  elementWidth: number,
  minSize: number = 40
): number {
  return Math.max(minSize, elementWidth);
}
