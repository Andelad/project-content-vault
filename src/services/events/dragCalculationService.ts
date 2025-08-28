// Drag calculation service - extracted from dragUtils.ts and drag-related components
// Handles all drag interaction calculations, positioning, and state management

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
 * Debounce function with cleanup support for drag operations
 */
export function debounceDragUpdate<T extends (...args: any[]) => void>(
  func: T,
  delay: number = DRAG_CONSTANTS.DEBOUNCE_DELAY_MS,
  key: string = 'default'
): T {
  return ((...args: any[]) => {
    // Clear existing timeout for this key
    if (debouncedUpdateTimeouts.has(key)) {
      clearTimeout(debouncedUpdateTimeouts.get(key)!);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      func(...args);
      debouncedUpdateTimeouts.delete(key);
    }, delay);
    
    debouncedUpdateTimeouts.set(key, timeout);
  }) as T;
}

/**
 * Throttle function for high-frequency drag events with mode-specific delays
 */
export function throttleDragUpdate<T extends (...args: any[]) => void>(
  func: T,
  mode: 'days' | 'weeks' = 'days',
  customDelay?: number
): T {
  let lastCall = 0;
  // Use longer delay for weeks mode due to computational complexity
  const effectiveDelay = customDelay ?? (
    mode === 'weeks' ? DRAG_CONSTANTS.THROTTLE_DELAY_WEEKS_MS : DRAG_CONSTANTS.THROTTLE_DELAY_DAYS_MS
  );
  
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= effectiveDelay) {
      lastCall = now;
      func(...args);
    }
  }) as T;
}

/**
 * Calculate days delta from mouse movement for timeline drag operations
 */
export function calculateDaysDelta(
  currentX: number, 
  startX: number, 
  dates: Date[], 
  isDynamicWidth: boolean = true,
  mode: 'days' | 'weeks' = 'days'
): number {
  const deltaX = currentX - startX;
  
  if (isDynamicWidth) {
    // For projects - use mode-specific column width
    if (mode === 'weeks') {
      // In weeks mode, use exact day width for precision
      // This matches the positioning system exactly (77px ÷ 7 = 11px per day)
      return Math.round(deltaX / DRAG_CONSTANTS.WEEKS_MODE_DAY_WIDTH);
    } else {
      // In days mode, each column is one day at 40px
      return Math.round(deltaX / DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH);
    }
  } else {
    // For holidays - fixed 40px width (holidays are always in days mode)
    return Math.round(deltaX / DRAG_CONSTANTS.HOLIDAY_FIXED_WIDTH);
  }
}

/**
 * Calculate mouse position changes for drag operations
 */
export function calculateMousePositionChange(
  currentX: number,
  currentY: number,
  startX: number,
  startY: number,
  dates: Date[],
  mode: 'days' | 'weeks' = 'days',
  isDynamicWidth: boolean = true
): MousePositionCalculation {
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  const daysDelta = calculateDaysDelta(currentX, startX, dates, isDynamicWidth, mode);
  const hoursDelta = deltaY / DRAG_CONSTANTS.PIXELS_PER_HOUR;
  
  return {
    deltaX,
    deltaY,
    daysDelta,
    hoursDelta
  };
}

/**
 * Validate date range for drag operations
 */
export function validateDragDateRange(
  newStartDate: Date, 
  newEndDate: Date,
  operation: DragOperation = 'move-project'
): DragValidationResult {
  // Basic validation: start before end
  if (newStartDate > newEndDate) {
    return { 
      isValid: false, 
      reason: 'Start date cannot be after end date' 
    };
  }
  
  // Calculate duration in days
  const timeDiff = newEndDate.getTime() - newStartDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
  
  // Operation-specific validation
  switch (operation) {
    case 'move-project':
    case 'resize-project-start':
    case 'resize-project-end':
      // Projects must have minimum 1 day duration
      if (daysDiff < DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS) {
        const adjustedEndDate = new Date(newStartDate);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS - 1);
        
        return {
          isValid: false,
          reason: `Minimum project duration is ${DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS} day(s)`,
          adjustedStartDate: newStartDate,
          adjustedEndDate: adjustedEndDate,
          minDuration: DRAG_CONSTANTS.MIN_PROJECT_DURATION_DAYS
        };
      }
      
      // Check maximum duration
      if (daysDiff > DRAG_CONSTANTS.MAX_PROJECT_DURATION_DAYS) {
        return {
          isValid: false,
          reason: `Maximum project duration is ${DRAG_CONSTANTS.MAX_PROJECT_DURATION_DAYS} days`,
          maxDuration: DRAG_CONSTANTS.MAX_PROJECT_DURATION_DAYS
        };
      }
      break;
      
    case 'move-holiday':
    case 'resize-holiday-start':
    case 'resize-holiday-end':
      // Holidays can be single day
      if (daysDiff < 0) {
        return { 
          isValid: false, 
          reason: 'Holiday dates cannot be negative duration' 
        };
      }
      break;
      
    case 'move-milestone':
      // Milestones are single points in time
      if (daysDiff !== 0) {
        return {
          isValid: false,
          reason: 'Milestones must be single-day events',
          adjustedStartDate: newStartDate,
          adjustedEndDate: newStartDate
        };
      }
      break;
  }
  
  return { 
    isValid: true, 
    adjustedStartDate: newStartDate, 
    adjustedEndDate: newEndDate 
  };
}

/**
 * Calculate new dates from drag operation
 */
export function calculateDragResult(
  dragState: DragState,
  currentX: number,
  currentY: number,
  dates: Date[],
  operation: DragOperation = 'move-project'
): DragCalculationResult {
  const positionChange = calculateMousePositionChange(
    currentX,
    currentY,
    dragState.startX,
    dragState.startY,
    dates,
    dragState.mode,
    dragState.isDynamicWidth
  );
  
  let newStartDate: Date;
  let newEndDate: Date;
  
  switch (operation) {
    case 'move-project':
    case 'move-holiday':
    case 'move-milestone':
      // Move both dates by the same delta
      newStartDate = new Date(dragState.originalStartDate);
      newStartDate.setDate(newStartDate.getDate() + positionChange.daysDelta);
      
      newEndDate = new Date(dragState.originalEndDate);
      newEndDate.setDate(newEndDate.getDate() + positionChange.daysDelta);
      break;
      
    case 'resize-project-start':
    case 'resize-holiday-start':
      // Only move start date
      newStartDate = new Date(dragState.originalStartDate);
      newStartDate.setDate(newStartDate.getDate() + positionChange.daysDelta);
      newEndDate = dragState.originalEndDate;
      break;
      
    case 'resize-project-end':
    case 'resize-holiday-end':
      // Only move end date
      newStartDate = dragState.originalStartDate;
      newEndDate = new Date(dragState.originalEndDate);
      newEndDate.setDate(newEndDate.getDate() + positionChange.daysDelta);
      break;
      
    case 'adjust-time-allocation':
      // For time allocation adjustments, use original dates
      newStartDate = dragState.originalStartDate;
      newEndDate = dragState.originalEndDate;
      break;
      
    default:
      newStartDate = dragState.originalStartDate;
      newEndDate = dragState.originalEndDate;
  }
  
  // Validate the new date range
  const validation = validateDragDateRange(newStartDate, newEndDate, operation);
  
  return {
    daysDelta: positionChange.daysDelta,
    newStartDate: validation.adjustedStartDate || newStartDate,
    newEndDate: validation.adjustedEndDate || newEndDate,
    isValid: validation.isValid,
    adjustedStartDate: validation.adjustedStartDate,
    adjustedEndDate: validation.adjustedEndDate
  };
}

/**
 * Check if drag movement exceeds minimum threshold
 */
export function isDragThresholdExceeded(
  currentX: number,
  currentY: number,
  startX: number,
  startY: number,
  threshold: number = DRAG_CONSTANTS.DRAG_THRESHOLD_PX
): boolean {
  const deltaX = Math.abs(currentX - startX);
  const deltaY = Math.abs(currentY - startY);
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  return distance > threshold;
}

/**
 * Create smooth animation function for timeline navigation
 */
export function createSmoothDragAnimation(
  config: SmoothAnimationConfig,
  onUpdate: (intermediateStart: Date) => void,
  onComplete: (targetStart: Date) => void
): () => void {
  const { currentStart, targetStart, duration, easingFunction } = config;
  const startTime = performance.now();
  
  // Default to sine-based ease-in-out if no easing function provided
  const defaultEasing = (progress: number) => -(Math.cos(Math.PI * progress) - 1) / 2;
  const easing = easingFunction || defaultEasing;
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Apply easing function
    const easedProgress = easing(progress);
    
    // Calculate intermediate value
    const currentOffset = currentStart + (targetStart - currentStart) * easedProgress;
    const intermediateStart = new Date(currentOffset);
    
    onUpdate(intermediateStart);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      onComplete(new Date(targetStart));
    }
  };
  
  requestAnimationFrame(animate);
  
  // Return cleanup function
  return () => {
    // Animation cleanup if needed - could cancel the animation here
  };
}

/**
 * Calculate snap-to-grid positioning for drag operations
 */
export function calculateSnapToGrid(
  position: number,
  gridSize: number,
  mode: 'days' | 'weeks' = 'days'
): number {
  const effectiveGridSize = mode === 'weeks' ? 
    DRAG_CONSTANTS.WEEKS_MODE_DAY_WIDTH : 
    gridSize;
    
  return Math.round(position / effectiveGridSize) * effectiveGridSize;
}

/**
 * Calculate auto-scroll behavior during drag operations
 */
export function calculateAutoScroll(
  mouseX: number,
  containerWidth: number,
  scrollThreshold: number = 50,
  scrollSpeed: number = 10
): { shouldScroll: boolean; direction: 'left' | 'right'; speed: number } {
  const leftThreshold = scrollThreshold;
  const rightThreshold = containerWidth - scrollThreshold;
  
  if (mouseX < leftThreshold) {
    return {
      shouldScroll: true,
      direction: 'left',
      speed: Math.max(1, scrollSpeed * (1 - mouseX / leftThreshold))
    };
  } else if (mouseX > rightThreshold) {
    return {
      shouldScroll: true,
      direction: 'right',
      speed: Math.max(1, scrollSpeed * ((mouseX - rightThreshold) / scrollThreshold))
    };
  }
  
  return { shouldScroll: false, direction: 'left', speed: 0 };
}

/**
 * Calculate drag cursor style based on operation and state
 */
export function getDragCursor(
  operation: DragOperation,
  isDragging: boolean = false
): string {
  if (isDragging) {
    switch (operation) {
      case 'move-project':
      case 'move-holiday':
      case 'move-milestone':
        return 'grabbing';
      case 'resize-project-start':
      case 'resize-project-end':
      case 'resize-holiday-start':
      case 'resize-holiday-end':
        return 'ew-resize';
      case 'adjust-time-allocation':
        return 'ns-resize';
      default:
        return 'grabbing';
    }
  } else {
    switch (operation) {
      case 'move-project':
      case 'move-holiday':
      case 'move-milestone':
        return 'grab';
      case 'resize-project-start':
      case 'resize-project-end':
      case 'resize-holiday-start':
      case 'resize-holiday-end':
        return 'ew-resize';
      case 'adjust-time-allocation':
        return 'ns-resize';
      default:
        return 'grab';
    }
  }
}

/**
 * Initialize drag state for timeline operations
 */
export function initializeDragState(
  operation: DragOperation,
  mouseX: number,
  mouseY: number,
  startDate: Date,
  endDate: Date,
  entityId?: string,
  mode: 'days' | 'weeks' = 'days'
): DragState {
  return {
    projectId: operation.includes('project') ? entityId : undefined,
    holidayId: operation.includes('holiday') ? entityId : undefined,
    milestoneId: operation.includes('milestone') ? entityId : undefined,
    action: operation,
    startX: mouseX,
    startY: mouseY,
    originalStartDate: new Date(startDate),
    originalEndDate: new Date(endDate),
    lastDaysDelta: 0,
    mode,
    isDynamicWidth: !operation.includes('holiday') // Holidays use fixed width
  };
}

/**
 * Clean up drag-related timeouts and event listeners
 */
export function cleanupDragOperations(key?: string): void {
  if (key) {
    if (debouncedUpdateTimeouts.has(key)) {
      clearTimeout(debouncedUpdateTimeouts.get(key)!);
      debouncedUpdateTimeouts.delete(key);
    }
  } else {
    // Clean up all timeouts
    debouncedUpdateTimeouts.forEach((timeout) => clearTimeout(timeout));
    debouncedUpdateTimeouts.clear();
  }
}

/**
 * Calculate performance metrics for drag operations
 */
export function calculateDragPerformanceMetrics(
  startTime: number,
  updateCount: number,
  mode: 'days' | 'weeks'
): {
  totalDuration: number;
  averageUpdateTime: number;
  updatesPerSecond: number;
  efficiency: 'good' | 'moderate' | 'poor';
} {
  const totalDuration = performance.now() - startTime;
  const averageUpdateTime = totalDuration / updateCount;
  const updatesPerSecond = (updateCount / totalDuration) * 1000;
  
  // Performance efficiency based on mode and update frequency
  const targetUPS = mode === 'weeks' ? 30 : 60; // Updates per second
  let efficiency: 'good' | 'moderate' | 'poor';
  
  if (updatesPerSecond >= targetUPS * 0.8) {
    efficiency = 'good';
  } else if (updatesPerSecond >= targetUPS * 0.5) {
    efficiency = 'moderate';
  } else {
    efficiency = 'poor';
  }
  
  return {
    totalDuration,
    averageUpdateTime,
    updatesPerSecond,
    efficiency
  };
}

/**
 * Drag position update result interface
 */
export interface DragPositionResult {
  daysDelta: number;
  visualDelta: number;
  pixelDeltaX: number;
  shouldUpdate: boolean;
  snappedDelta?: number;
}

/**
 * Drag bounds validation result interface
 */
export interface DragBoundsValidationResult {
  isValid: boolean;
  reason?: string;
  adjustedStartDate?: Date;
  adjustedEndDate?: Date;
}

/**
 * Throttled update function type
 */
export type ThrottledFunction = (callback: () => void | Promise<void>) => void;

/**
 * Calculate drag position update from mouse movement
 * Extracts mouse position → timeline position conversion logic
 */
export function calculateDragPositionUpdate(
  currentMouseX: number,
  currentMouseY: number,
  dragState: DragState,
  dates: Date[],
  mode: 'days' | 'weeks'
): DragPositionResult {
  // Calculate incremental delta from last mouse position
  const incrementalDeltaX = currentMouseX - dragState.startX;
  const totalDeltaX = currentMouseX - dragState.startX;
  const dayWidth = mode === 'weeks' ? DRAG_CONSTANTS.WEEKS_MODE_DAY_WIDTH : DRAG_CONSTANTS.DAYS_MODE_COLUMN_WIDTH;

  // Always accumulate smooth movement for responsive pen/mouse following
  const currentPixelDeltaX = (dragState as any).pixelDeltaX || 0 + incrementalDeltaX;
  const smoothVisualDelta = currentPixelDeltaX / dayWidth;

  // For visual display: snap to day boundaries in days view, smooth in weeks view
  let visualDelta: number;
  let snappedDelta: number | undefined;

  if (mode === 'weeks') {
    visualDelta = smoothVisualDelta;  // Smooth movement in weeks
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

  // Calculate rounded delta for database updates
  const daysDelta = calculateDaysDelta(currentMouseX, dragState.startX, dates, true, mode);

  // Determine if update is needed
  const shouldUpdate = daysDelta !== dragState.lastDaysDelta;

  return {
    daysDelta,
    visualDelta,
    pixelDeltaX: currentPixelDeltaX,
    shouldUpdate,
    snappedDelta
  };
}

/**
 * Validate drag bounds against viewport constraints
 * Extracts date range validation during drag operations
 */
export function validateDragBounds(
  newStartDate: Date,
  newEndDate: Date,
  viewportStart: Date,
  viewportEnd: Date
): DragBoundsValidationResult {
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
      adjustedEndDate: adjustedEndDate
    };
  }

  return {
    isValid: true,
    adjustedStartDate: newStartDate,
    adjustedEndDate: newEndDate
  };
}

/**
 * Create throttled update function for drag operations
 * Extracts performance optimization logic for drag updates
 */
export function createDragThrottledUpdate(
  updateFunction: (callback: () => void | Promise<void>) => void,
  mode: 'days' | 'weeks'
): ThrottledFunction {
  const throttleDelay = mode === 'weeks'
    ? DRAG_CONSTANTS.THROTTLE_DELAY_WEEKS_MS
    : DRAG_CONSTANTS.THROTTLE_DELAY_DAYS_MS;

  return throttleDragUpdate(updateFunction, mode, throttleDelay);
}
