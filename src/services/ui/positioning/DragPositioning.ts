/**
 * Drag Positioning Service
 * 
 * UI positioning and calculation functions for timeline drag interactions.
 * Handles mouse-to-pixel-to-date conversions, drag validation, and visual positioning.
 * 
 * Migrated from: services/legacy/events/dragCalculationService.ts (September 8, 2025)
 * Moved to: services/ui/positioning/DragPositioning.ts (October 20, 2025)
 * Refactored: November 2025 - Extracted date math, performance utils, and animations
 * 
 * Dependencies:
 * - dateCalculations.ts: Pure date math functions
 * - utils/performance.ts: Throttle/debounce utilities
 * - TimelineViewportService: Animation functions
 */

import { calculateDaysDeltaFromPixels, addDaysToDatePure } from '@/services/calculations/general/dateCalculations';
import { debounce, throttle, cleanupPerformanceTimers } from '@/utils/performance';
import { TimelineViewport } from './TimelineViewportService';

/**
 * Drag state interface for timeline interactions
 */
export interface DragState {
  projectId?: string;
  holidayId?: string;
  milestoneId?: string;
  action: string;
  startX: number;
  startY: number;
  originalStartDate: Date;
  originalEndDate: Date;
  lastDaysDelta: number;
  mode?: 'days' | 'weeks';
  isDynamicWidth?: boolean;
}

/**
 * Drag calculation result interface
 */
export interface DragCalculationResult {
  daysDelta: number;
  newStartDate: Date;
  newEndDate: Date;
  isValid: boolean;
  adjustedStartDate?: Date;
  adjustedEndDate?: Date;
}

/**
 * Mouse position calculation interface
 */
export interface MousePositionCalculation {
  deltaX: number;
  deltaY: number;
  daysDelta: number;
  hoursDelta?: number;
}

/**
 * Animation configuration for smooth timeline navigation
 */
export interface SmoothAnimationConfig {
  currentStart: number;
  targetStart: number;
  duration: number;
  easingFunction?: (progress: number) => number;
}

/**
 * Drag bounds validation result interface
 */
export interface DragBoundsValidationResult {
  isValid: boolean;
  reason?: string;
  adjustedStartDate?: Date;
  adjustedEndDate?: Date;
  suggestedDuration?: number;
}

/**
 * Drag validation result interface
 */
export interface DragValidationResult {
  isValid: boolean;
  reason?: string;
  adjustedStartDate?: Date;
  adjustedEndDate?: Date;
  minDuration?: number;
  maxDuration?: number;
}

/**
 * Drag position result interface
 */
export interface DragPositionResult {
  newX: number;
  newY: number;
  daysDelta: number;
  isValid: boolean;
  shouldSnap?: boolean;
  snapTarget?: Date;
  // Legacy support properties
  visualDelta?: number;
  pixelDeltaX?: number;
  shouldUpdate?: boolean;
  snappedDelta?: number;
}

/**
 * Constants for drag calculations
 */
export const DRAG_CONSTANTS = {
  DAYS_MODE_COLUMN_WIDTH: 52,
  WEEKS_MODE_COLUMN_WIDTH: 153,
  WEEKS_MODE_DAY_WIDTH: 22, // 21px day + 1px gap = 22px effective spacing
  HOLIDAY_FIXED_WIDTH: 52,
  MIN_PROJECT_DURATION_DAYS: 1,
  MAX_PROJECT_DURATION_DAYS: 365,
  PIXELS_PER_HOUR: 5, // For vertical time adjustments
  DRAG_THRESHOLD_PX: 3, // Minimum movement to register as drag
  DEBOUNCE_DELAY_MS: 16, // ~60fps for smooth updates
  THROTTLE_DELAY_DAYS_MS: 16,
  THROTTLE_DELAY_WEEKS_MS: 50
} as const;

/**
 * Drag operation types
 */
export type DragOperation = 
  | 'move-project' 
  | 'resize-project-start' 
  | 'resize-project-end'
  | 'move-holiday'
  | 'resize-holiday-start'
  | 'resize-holiday-end'
  | 'move-milestone'
  | 'adjust-time-allocation';

/**
 * Re-export performance utilities for backwards compatibility
 */
export const debounceDragUpdate = debounce;
export const throttleDragUpdate = throttle;

/**
 * Calculate the number of days delta based on mouse movement and timeline mode
 * Legacy-compatible wrapper that delegates to dateCalculations service
 */
export function calculateDaysDelta(
  currentMouseXOrDelta: number,
  startXOrMode?: number | 'days' | 'weeks',
  dates?: Date[],
  allowFractional?: boolean,
  mode?: 'days' | 'weeks'
): number {
  // Handle legacy signature: calculateDaysDelta(currentMouseX, startX, dates, allowFractional, mode)
  if (typeof startXOrMode === 'number' && dates) {
    const currentMouseX = currentMouseXOrDelta;
    const startX = startXOrMode;
    const deltaX = currentMouseX - startX;
    const timelineMode = mode || 'days';
    
    const result = calculateDaysDeltaFromPixels(
      deltaX,
      timelineMode,
      DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH,
      DRAG_CONSTANTS.WEEKS_MODE_COLUMN_WIDTH
    );
    
    return allowFractional ? result : Math.round(result);
  }
  
  // Handle new signature: calculateDaysDelta(deltaX, mode)
  const deltaX = currentMouseXOrDelta;
  const timelineMode = (startXOrMode as 'days' | 'weeks') || 'days';
  
  return calculateDaysDeltaFromPixels(
    deltaX,
    timelineMode,
    DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH,
    DRAG_CONSTANTS.WEEKS_MODE_COLUMN_WIDTH
  );
}

/**
 * Calculate mouse position changes and convert to timeline deltas
 */
export function calculateMousePositionChange(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  mode: 'days' | 'weeks' = 'days'
): MousePositionCalculation {
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  const daysDelta = calculateDaysDelta(deltaX, mode);
  const hoursDelta = Math.round(deltaY / DRAG_CONSTANTS.PIXELS_PER_HOUR);
  
  return {
    deltaX,
    deltaY,
    daysDelta,
    hoursDelta
  };
}

/**
 * Validate a drag operation's date range and duration
 */
export function validateDragDateRange(
  originalStartDate: Date,
  originalEndDate: Date,
  daysDelta: number,
  operation: DragOperation
): DragValidationResult {
  let newStartDate: Date;
  let newEndDate: Date;
  
  // Calculate new dates based on operation type
  switch (operation) {
    case 'move-project':
    case 'move-holiday':
    case 'move-milestone':
      newStartDate = new Date(originalStartDate);
      newStartDate.setDate(newStartDate.getDate() + daysDelta);
      newEndDate = new Date(originalEndDate);
      newEndDate.setDate(newEndDate.getDate() + daysDelta);
      break;
      
    case 'resize-project-start':
    case 'resize-holiday-start':
      newStartDate = new Date(originalStartDate);
      newStartDate.setDate(newStartDate.getDate() + daysDelta);
      newEndDate = new Date(originalEndDate);
      break;
      
    case 'resize-project-end':
    case 'resize-holiday-end':
      newStartDate = new Date(originalStartDate);
      newEndDate = new Date(originalEndDate);
      newEndDate.setDate(newEndDate.getDate() + daysDelta);
      break;
      
    default:
      newStartDate = new Date(originalStartDate);
      newEndDate = new Date(originalEndDate);
  }
  
  // Validate duration constraints
  const durationDays = Math.ceil((newEndDate.getTime() - newStartDate.getTime()) / (24 * 60 * 60 * 1000));
  
  if (durationDays < DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS) {
    return {
      isValid: false,
      reason: `Duration cannot be less than ${DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS} day(s)`,
      minDuration: DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS
    };
  }
  
  if (durationDays > DRAG_CONSTANTS.MAX_PROJECT_DURATION_DAYS) {
    return {
      isValid: false,
      reason: `Duration cannot exceed ${DRAG_CONSTANTS.MAX_PROJECT_DURATION_DAYS} days`,
      maxDuration: DRAG_CONSTANTS.MAX_PROJECT_DURATION_DAYS
    };
  }
  
  // Check for invalid date order
  if (newStartDate >= newEndDate) {
    return {
      isValid: false,
      reason: 'Start date must be before end date',
      adjustedStartDate: newStartDate,
      adjustedEndDate: newEndDate
    };
  }
  
  return {
    isValid: true,
    adjustedStartDate: newStartDate,
    adjustedEndDate: newEndDate
  };
}

/**
 * Calculate complete drag result with validation
 */
export function calculateDragResult(
  dragState: DragState,
  currentX: number,
  currentY: number
): DragCalculationResult {
  // Calculate mouse position changes
  const positionChange = calculateMousePositionChange(
    dragState.startX,
    dragState.startY,
    currentX,
    currentY,
    dragState.mode
  );
  
  const daysDelta = positionChange.daysDelta;
  
  // Validate the drag operation
  const validation = validateDragDateRange(
    dragState.originalStartDate,
    dragState.originalEndDate,
    daysDelta,
    dragState.action as DragOperation
  );
  
  if (!validation.isValid) {
    return {
      daysDelta,
      newStartDate: dragState.originalStartDate,
      newEndDate: dragState.originalEndDate,
      isValid: false
    };
  }
  
  return {
    daysDelta,
    newStartDate: validation.adjustedStartDate!,
    newEndDate: validation.adjustedEndDate!,
    isValid: true,
    adjustedStartDate: validation.adjustedStartDate,
    adjustedEndDate: validation.adjustedEndDate
  };
}

/**
 * Check if drag threshold has been exceeded
 */
export function isDragThresholdExceeded(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number
): boolean {
  const deltaX = Math.abs(currentX - startX);
  const deltaY = Math.abs(currentY - startY);
  const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  return totalDelta >= DRAG_CONSTANTS.DRAG_THRESHOLD_PX;
}

/**
 * Create smooth animation for drag operations
 * Delegates to TimelineViewportService for consistency
 */
export function createSmoothDragAnimation(
  config: SmoothAnimationConfig,
  onUpdate: (intermediateValue: Date) => void,
  onComplete?: () => void
): void {
  TimelineViewport.createSmoothAnimation(config, onUpdate, onComplete);
}

/**
 * Calculate snap-to-grid positioning
 */
export function calculateSnapToGrid(
  position: number,
  gridSize: number,
  mode: 'days' | 'weeks' = 'days'
): number {
  const effectiveGridSize = mode === 'weeks' ? 
    DRAG_CONSTANTS.WEEKS_MODE_COLUMN_WIDTH : 
    DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH;
  
  return Math.round(position / effectiveGridSize) * effectiveGridSize;
}

/**
 * Calculate auto-scroll behavior during drag near viewport edges
 */
export function calculateAutoScroll(
  mouseX: number,
  viewportLeft: number,
  viewportRight: number,
  scrollThreshold: number = 50
): { shouldScroll: boolean; direction: 'left' | 'right' | null; speed: number } {
  const leftEdgeDistance = mouseX - viewportLeft;
  const rightEdgeDistance = viewportRight - mouseX;
  
  if (leftEdgeDistance < scrollThreshold && leftEdgeDistance > 0) {
    const speed = Math.max(0.1, (scrollThreshold - leftEdgeDistance) / scrollThreshold);
    return { shouldScroll: true, direction: 'left', speed };
  }
  
  if (rightEdgeDistance < scrollThreshold && rightEdgeDistance > 0) {
    const speed = Math.max(0.1, (scrollThreshold - rightEdgeDistance) / scrollThreshold);
    return { shouldScroll: true, direction: 'right', speed };
  }
  
  return { shouldScroll: false, direction: null, speed: 0 };
}

/**
 * Get appropriate cursor style for drag operation
 */
export function getDragCursor(operation: DragOperation): string {
  switch (operation) {
    case 'move-project':
    case 'move-holiday':
    case 'move-milestone':
      return 'grabbing';
      
    case 'resize-project-start':
    case 'resize-holiday-start':
      return 'w-resize';
      
    case 'resize-project-end':
    case 'resize-holiday-end':
      return 'e-resize';
      
    case 'adjust-time-allocation':
      return 'ns-resize';
      
    default:
      return 'default';
  }
}

/**
 * Initialize drag state for a drag operation
 */
export function initializeDragState(
  element: { id: string; startDate: Date; endDate: Date },
  action: string,
  startX: number,
  startY: number,
  mode: 'days' | 'weeks' = 'days'
): DragState {
  return {
    projectId: element.id,
    action,
    startX,
    startY,
    originalStartDate: new Date(element.startDate),
    originalEndDate: new Date(element.endDate),
    lastDaysDelta: 0,
    mode,
    isDynamicWidth: false
  };
}

/**
 * Initialize drag state for a milestone drag operation
 */
export function initializeMilestoneDragState(
  milestoneId: string,
  milestoneDate: Date,
  startX: number,
  startY: number,
  mode: 'days' | 'weeks' = 'days'
): DragState {
  return {
    milestoneId,
    action: 'move-milestone',
    startX,
    startY,
    originalStartDate: new Date(milestoneDate),
    originalEndDate: new Date(milestoneDate), // Milestones have same start/end
    lastDaysDelta: 0,
    mode,
    isDynamicWidth: false
  };
}

/**
 * Calculate milestone drag update with snap behavior
 * Milestones snap to day boundaries in days mode, smooth in weeks mode
 */
export function calculateMilestoneDragUpdate(
  currentMouseX: number,
  dragState: DragState,
  mode: 'days' | 'weeks'
): DragPositionResult {
  const deltaX = currentMouseX - dragState.startX;
  const dayWidth = mode === 'weeks' ? DRAG_CONSTANTS.WEEKS_MODE_DAY_WIDTH : DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH;
  
  // Calculate smooth movement
  const smoothDaysDelta = deltaX / dayWidth;
  
  // Apply snap behavior based on mode
  let visualDelta: number;
  let daysDelta: number;
  
  if (mode === 'weeks') {
    // Smooth movement in weeks view
    visualDelta = smoothDaysDelta;
    daysDelta = Math.round(smoothDaysDelta); // Round for final date calculation
  } else {
    // Snap to day boundaries in days view
    daysDelta = Math.round(smoothDaysDelta);
    visualDelta = daysDelta;
  }
  
  // Determine if we should update (changed by at least half a day in weeks, or any in days)
  const minMovement = mode === 'weeks' ? 0.5 : 1;
  const shouldUpdate = Math.abs(daysDelta - dragState.lastDaysDelta) >= minMovement;
  
  return {
    newX: currentMouseX,
    newY: dragState.startY,
    daysDelta,
    isValid: true,
    visualDelta,
    pixelDeltaX: deltaX,
    shouldUpdate,
    shouldSnap: mode === 'days'
  };
}

/**
 * Milestone bounds validation result interface
 */
export interface MilestoneBoundsValidation {
  isValid: boolean;
  constrainedDate: Date;
  reason?: string;
  minAllowedDate?: Date;
  maxAllowedDate?: Date;
}

/**
 * Validate milestone position within project boundaries
 * Business rule: Milestones must be at least 1 day after project start and 1 day before project end
 * Business rule: Milestones cannot overlap with each other
 */
export function validateMilestoneBounds(
  newDate: Date,
  projectStartDate: Date,
  projectEndDate: Date,
  otherMilestoneDates: Date[],
  originalMilestoneDate?: Date
): MilestoneBoundsValidation {
  // Normalize all dates to midnight
  const candidate = new Date(newDate);
  candidate.setHours(0, 0, 0, 0);
  
  const projectStart = new Date(projectStartDate);
  projectStart.setHours(0, 0, 0, 0);
  
  const projectEnd = new Date(projectEndDate);
  projectEnd.setHours(0, 0, 0, 0);
  
  const original = originalMilestoneDate ? new Date(originalMilestoneDate) : null;
  if (original) {
    original.setHours(0, 0, 0, 0);
  }
  
  // Calculate min/max allowed dates
  let minAllowedDate = new Date(projectStart);
  minAllowedDate.setDate(projectStart.getDate() + 1); // 1 day after start
  
  let maxAllowedDate = new Date(projectEnd);
  maxAllowedDate.setDate(projectEnd.getDate() - 1); // 1 day before end
  
  // Narrow down based on other milestones (prevent overlaps)
  const blockingDates = otherMilestoneDates.map(d => {
    const normalized = new Date(d);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  });
  
  // For each blocking date, adjust the allowed range
  blockingDates.forEach(blockingDate => {
    if (original && blockingDate.getTime() === original.getTime()) {
      // Skip the original position of this milestone
      return;
    }
    
    if (original && blockingDate < original && blockingDate >= minAllowedDate) {
      // Blocking date is before our original position, update minimum
      const dayAfter = new Date(blockingDate);
      dayAfter.setDate(blockingDate.getDate() + 1);
      if (dayAfter > minAllowedDate) {
        minAllowedDate = dayAfter;
      }
    } else if (original && blockingDate > original && blockingDate <= maxAllowedDate) {
      // Blocking date is after our original position, update maximum
      const dayBefore = new Date(blockingDate);
      dayBefore.setDate(blockingDate.getDate() - 1);
      if (dayBefore < maxAllowedDate) {
        maxAllowedDate = dayBefore;
      }
    }
  });
  
  // Constrain the candidate date to the allowed range
  let constrainedDate = new Date(candidate);
  let reason: string | undefined;
  
  if (candidate < minAllowedDate) {
    constrainedDate = new Date(minAllowedDate);
    reason = 'Milestone must be at least 1 day after project start and other milestones';
  } else if (candidate > maxAllowedDate) {
    constrainedDate = new Date(maxAllowedDate);
    reason = 'Milestone must be at least 1 day before project end and other milestones';
  }
  
  const isValid = candidate.getTime() === constrainedDate.getTime();
  
  return {
    isValid,
    constrainedDate,
    reason,
    minAllowedDate,
    maxAllowedDate
  };
}

// ============================================================================
// HOLIDAY DRAG FUNCTIONS
// ============================================================================

/**
 * Initialize drag state for holiday drag operations
 */
export function initializeHolidayDragState(
  holidayId: string,
  startDate: Date,
  endDate: Date,
  startX: number,
  startY: number,
  action: 'move' | 'resize-start-date' | 'resize-end-date',
  mode: 'days' | 'weeks' = 'days'
): DragState {
  return {
    holidayId,
    action,
    startX,
    startY,
    originalStartDate: new Date(startDate),
    originalEndDate: new Date(endDate),
    lastDaysDelta: 0,
    mode,
    isDynamicWidth: false
  };
}

/**
 * Calculate holiday drag update with snap behavior
 * Holidays snap to day boundaries in days mode, smooth in weeks mode
 */
export function calculateHolidayDragUpdate(
  currentMouseX: number,
  dragState: DragState,
  mode: 'days' | 'weeks'
): DragPositionResult {
  const deltaX = currentMouseX - dragState.startX;
  const dayWidth = mode === 'weeks' ? DRAG_CONSTANTS.WEEKS_MODE_DAY_WIDTH : DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH;
  
  // Calculate smooth movement
  const smoothDaysDelta = deltaX / dayWidth;
  
  // Apply snap behavior based on mode
  let visualDelta: number;
  let daysDelta: number;
  
  if (mode === 'weeks') {
    // Smooth movement in weeks view
    visualDelta = smoothDaysDelta;
    daysDelta = Math.round(smoothDaysDelta); // Round for final date calculation
  } else {
    // Snap to day boundaries in days view
    daysDelta = Math.round(smoothDaysDelta);
    visualDelta = daysDelta;
  }
  
  // Determine if we should update
  const shouldUpdate = Math.abs(daysDelta - dragState.lastDaysDelta) >= 1;
  
  return {
    newX: currentMouseX,
    newY: dragState.startY,
    daysDelta,
    isValid: true,
    visualDelta,
    pixelDeltaX: deltaX,
    shouldUpdate,
    shouldSnap: mode === 'days'
  };
}

/**
 * Holiday bounds validation result interface
 */
export interface HolidayBoundsValidation {
  isValid: boolean;
  constrainedStartDate: Date;
  constrainedEndDate: Date;
  reason?: string;
}

/**
 * Validate holiday date bounds
 * Business rule: Start date must be <= end date (single-day holidays allowed)
 */
export function validateHolidayBounds(
  newStartDate: Date,
  newEndDate: Date,
  action: 'move' | 'resize-start-date' | 'resize-end-date'
): HolidayBoundsValidation {
  // Normalize dates to midnight
  const start = new Date(newStartDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(newEndDate);
  end.setHours(0, 0, 0, 0);
  
  let constrainedStartDate = new Date(start);
  let constrainedEndDate = new Date(end);
  let isValid = true;
  let reason: string | undefined;
  
  // Business rule: Start date must be <= end date
  if (start > end) {
    isValid = false;
    reason = 'Holiday start date cannot be after end date';
    
    // Constrain based on action
    if (action === 'resize-start-date') {
      constrainedStartDate = new Date(end); // Move start to match end
    } else if (action === 'resize-end-date') {
      constrainedEndDate = new Date(start); // Move end to match start
    }
  }
  
  return {
    isValid,
    constrainedStartDate,
    constrainedEndDate,
    reason
  };
}

/**
 * Cleanup drag operations and clear timeouts
 * Re-exported from utils/performance for backwards compatibility
 */
export const cleanupDragOperations = cleanupPerformanceTimers;

/**
 * Calculate drag performance metrics
 */
export function calculateDragPerformanceMetrics(
  dragStartTime: number,
  dragEndTime: number,
  updateCount: number
): {
  duration: number;
  updatesPerSecond: number;
  averageUpdateInterval: number;
  efficiency: 'high' | 'medium' | 'low';
} {
  const duration = dragEndTime - dragStartTime;
  const updatesPerSecond = (updateCount / duration) * 1000;
  const averageUpdateInterval = duration / updateCount;
  
  let efficiency: 'high' | 'medium' | 'low' = 'high';
  
  if (updatesPerSecond > 60) {
    efficiency = 'low'; // Too many updates
  } else if (updatesPerSecond < 15) {
    efficiency = 'low'; // Too few updates
  } else if (updatesPerSecond < 30) {
    efficiency = 'medium';
  }
  
  return {
    duration,
    updatesPerSecond,
    averageUpdateInterval,
    efficiency
  };
}

/**
 * Throttled function type
 */
export type ThrottledFunction = (callback: () => void | Promise<void>) => void;

/**
 * Create throttled update function for drag operations
 */
export function createDragThrottledUpdate(
  updateFunction: (state: DragState) => void | Promise<void>,
  throttleMs: number = DRAG_CONSTANTS.THROTTLE_DELAY_DAYS_MS
): (state: DragState) => void {
  return throttleDragUpdate(updateFunction, throttleMs, 'drag-update');
}

/**
 * Calculate drag position update with legacy signature compatibility
 * Extended version that matches the original service signature
 */
export function calculateDragPositionUpdate(
  currentMouseX: number,
  currentMouseY: number,
  dragState: DragState,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days'
): DragPositionResult {
  // Calculate incremental delta from start position
  const incrementalDeltaX = currentMouseX - dragState.startX;
  const dayWidth = mode === 'weeks' ? DRAG_CONSTANTS.WEEKS_MODE_DAY_WIDTH : DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH;

  // Always accumulate smooth movement for responsive pen/mouse following
  const currentPixelDeltaX = ((dragState as any).pixelDeltaX || 0) + incrementalDeltaX;
  const smoothVisualDelta = currentPixelDeltaX / dayWidth;

  // For visual display: snap to day boundaries in days view, smooth in weeks view
  let visualDelta: number;
  let snappedDelta: number | undefined;

  if (mode === 'weeks') {
    visualDelta = smoothVisualDelta; // Smooth movement in weeks
  } else {
    // In days view: snap to nearest day boundary but prevent jumping
    snappedDelta = Math.round(smoothVisualDelta);
    const currentSnapped = (dragState as any).lastSnappedDelta || 0;
    const minMovement = 0.3; // Require 30% of day width movement to snap

    if (Math.abs(snappedDelta - currentSnapped) >= 1 && Math.abs(smoothVisualDelta - currentSnapped) > minMovement) {
      visualDelta = snappedDelta;
      (dragState as any).lastSnappedDelta = snappedDelta;
    } else {
      visualDelta = currentSnapped; // Stay at current snapped position until boundary crossed
    }
  }

  // Calculate rounded delta for database updates - use legacy signature
  const daysDelta = calculateDaysDelta(currentMouseX, dragState.startX, dates, true, mode);

  // Determine if update is needed
  const shouldUpdate = daysDelta !== dragState.lastDaysDelta;

  return {
    newX: currentMouseX,
    newY: currentMouseY,
    daysDelta,
    isValid: true,
    visualDelta,
    pixelDeltaX: currentPixelDeltaX,
    shouldUpdate,
    snappedDelta
  };
}

/**
 * Validate drag bounds against viewport constraints (legacy compatibility)
 */
export function validateDragBounds(
  newStartDateOrElement: Date | { startDate: Date; endDate: Date },
  newEndDateOrDaysDelta?: Date | number,
  viewportStartOrOperation?: Date | DragOperation,
  viewportEndOrConstraints?: Date | { minDate?: Date; maxDate?: Date; minDuration?: number; maxDuration?: number }
): DragBoundsValidationResult | DragValidationResult {
  
  // Handle legacy signature: validateDragBounds(newStartDate, newEndDate, viewportStart, viewportEnd)
  if (newStartDateOrElement instanceof Date && newEndDateOrDaysDelta instanceof Date && viewportStartOrOperation instanceof Date && viewportEndOrConstraints instanceof Date) {
    const newStartDate = newStartDateOrElement;
    const newEndDate = newEndDateOrDaysDelta;
    const viewportStart = viewportStartOrOperation;
    const viewportEnd = viewportEndOrConstraints;
    
    // Check if dates are within viewport bounds
    if (newStartDate < viewportStart || newEndDate > viewportEnd) {
      return {
        isValid: false,
        reason: 'Drag operation would move project outside viewport bounds'
      };
    }

    // Basic date validation
    if (newStartDate > newEndDate) {
      return {
        isValid: false,
        reason: 'Start date cannot be after end date',
        adjustedStartDate: newStartDate,
        adjustedEndDate: new Date(newStartDate.getTime() + 24 * 60 * 60 * 1000) // Add one day
      };
    }

    // Minimum duration check
    const duration = Math.ceil((newEndDate.getTime() - newStartDate.getTime()) / (24 * 60 * 60 * 1000));
    if (duration < DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS) {
      const adjustedEndDate = new Date(newStartDate);
      adjustedEndDate.setDate(adjustedEndDate.getDate() + DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS - 1);

      return {
        isValid: false,
        reason: `Minimum project duration is ${DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS} day(s)`,
        adjustedStartDate: newStartDate,
        adjustedEndDate
      };
    }

    return {
      isValid: true
    };
  }
  
  // Handle new signature: validateDragBounds(element, daysDelta, operation, constraints)
  if (typeof newStartDateOrElement === 'object' && 'startDate' in newStartDateOrElement) {
    return validateDragBounds(
      newStartDateOrElement,
      newEndDateOrDaysDelta as number,
      viewportStartOrOperation as DragOperation,
      viewportEndOrConstraints as { minDate?: Date; maxDate?: Date; minDuration?: number; maxDuration?: number }
    );
  }
  
  return { isValid: false, reason: 'Invalid parameters' };
}
