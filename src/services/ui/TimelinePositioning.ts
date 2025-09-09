/**
 * UI POSITIONING SERVICE
 * Single source of truth for all timeline positioning calculations
 * Solves the project bar calculation inconsistency issue
 */

import { normalizeToMidnight } from '../calculations/dateCalculations';

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
  console.log('calculateTimelinePositions called with mode:', mode);
  
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
  if (projectStart < viewportStart) {
    return 0; // Project starts before viewport
  }
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
