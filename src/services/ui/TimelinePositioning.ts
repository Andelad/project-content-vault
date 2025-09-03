/**
 * UI POSITIONING SERVICE
 * Single source of truth for all timeline positioning calculations
 * Solves the project bar calculation inconsistency issue
 */

import { TimelinePositioningService } from '@/services';
import type { TimelinePositionCalculation } from '@/services/legacy/timeline/timelinePositionService';

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
  // Use the existing TimelinePositioningService for core calculations
  const positions = TimelinePositioningService.calculateTimelinePositions(
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

export function calculateMilestonePosition(
  milestoneDate: Date,
  projectStart: Date,
  projectEnd: Date,
  viewportStart: Date,
  viewportEnd: Date,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): MilestonePosition {
  // Use core positioning service
  const positions = TimelinePositioningService.calculateTimelinePositions(
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
  return TimelinePositioningService.calculateTimelinePositions(
    projectStart,
    projectEnd,
    viewportStart,
    viewportEnd,
    dates,
    mode
  );
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
