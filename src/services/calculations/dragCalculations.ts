/**
 * Drag Calculations Service
 * 
 * Pure drag calculation functions for timeline interactions.
 * Handles drag positioning, validation, and state management calculations.
 * 
 * Migrated from: services/legacy/events/dragCalculationService.ts
 * Migration Date: September 8, 2025
 */

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
  DAYS_MODE_COLUMN_WIDTH: 40,
  WEEKS_MODE_COLUMN_WIDTH: 77,
  WEEKS_MODE_DAY_WIDTH: 11, // 77px ÷ 7 days = 11px per day
  HOLIDAY_FIXED_WIDTH: 40,
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
 * Debounced update utilities with cleanup support
 */
const debouncedUpdateTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Throttled update utilities
 */
const throttledCallbacks = new Map<string, NodeJS.Timeout>();

/**
 * Debounce drag updates to prevent excessive API calls
 */
export function debounceDragUpdate<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = DRAG_CONSTANTS.DEBOUNCE_DELAY_MS,
  key: string = 'default'
): (...args: Parameters<T>) => void {
  return (...args: Parameters<T>) => {
    const timeoutId = debouncedUpdateTimeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    const newTimeoutId = setTimeout(() => {
      callback(...args);
      debouncedUpdateTimeouts.delete(key);
    }, delay);
    
    debouncedUpdateTimeouts.set(key, newTimeoutId);
  };
}

/**
 * Throttle drag updates for performance optimization
 */
export function throttleDragUpdate<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = DRAG_CONSTANTS.THROTTLE_DELAY_DAYS_MS,
  key: string = 'default'
): (...args: Parameters<T>) => void {
  let lastCallTime = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    if (timeSinceLastCall >= delay) {
      lastCallTime = now;
      callback(...args);
    } else {
      const timeoutId = throttledCallbacks.get(key);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      const newTimeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        callback(...args);
        throttledCallbacks.delete(key);
      }, delay - timeSinceLastCall);
      
      throttledCallbacks.set(key, newTimeoutId);
    }
  };
}

/**
 * Calculate the number of days delta based on mouse movement and timeline mode
 * Legacy-compatible version with additional parameters
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
    const columnWidth = mode === 'weeks' ? DRAG_CONSTANTS.WEEKS_MODE_COLUMN_WIDTH : DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH;
    const columnsDelta = deltaX / columnWidth;
    
    if (mode === 'weeks') {
      // In weeks mode, each column is 7 days
      return allowFractional ? columnsDelta * 7 : Math.round(columnsDelta * 7);
    } else {
      // In days mode, each column is 1 day
      return allowFractional ? columnsDelta : Math.round(columnsDelta);
    }
  }
  
  // Handle new signature: calculateDaysDelta(deltaX, mode)
  const deltaX = currentMouseXOrDelta;
  const timelineMode = (startXOrMode as 'days' | 'weeks') || 'days';
  
  if (timelineMode === 'weeks') {
    // In weeks mode, each column is 7 days wide
    const columnsDelta = deltaX / DRAG_CONSTANTS.WEEKS_MODE_COLUMN_WIDTH;
    return Math.round(columnsDelta * 7);
  } else {
    // In days mode, each column is 1 day wide
    const columnsDelta = deltaX / DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH;
    return Math.round(columnsDelta);
  }
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
 */
export function createSmoothDragAnimation(
  config: SmoothAnimationConfig,
  onUpdate: (intermediateValue: Date) => void,
  onComplete?: () => void
): void {
  const startTime = performance.now();
  const { currentStart, targetStart, duration } = config;
  const totalChange = targetStart - currentStart;
  
  // Default easing function (ease-out cubic)
  const easing = config.easingFunction || ((t: number) => 1 - Math.pow(1 - t, 3));
  
  function animate(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(progress);
    
    const currentValue = currentStart + (totalChange * easedProgress);
    const intermediateDate = new Date(currentValue);
    
    onUpdate(intermediateDate);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else if (onComplete) {
      onComplete();
    }
  }
  
  requestAnimationFrame(animate);
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
 * Cleanup drag operations and clear timeouts
 */
export function cleanupDragOperations(key?: string): void {
  if (key) {
    // Clear specific operation
    const timeoutId = debouncedUpdateTimeouts.get(key);
    if (timeoutId) {
      clearTimeout(timeoutId);
      debouncedUpdateTimeouts.delete(key);
    }
    
    const throttleTimeoutId = throttledCallbacks.get(key);
    if (throttleTimeoutId) {
      clearTimeout(throttleTimeoutId);
      throttledCallbacks.delete(key);
    }
  } else {
    // Clear all operations
    debouncedUpdateTimeouts.forEach(clearTimeout);
    debouncedUpdateTimeouts.clear();
    
    throttledCallbacks.forEach(clearTimeout);
    throttledCallbacks.clear();
  }
}

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
