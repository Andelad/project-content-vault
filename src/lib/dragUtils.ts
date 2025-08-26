/**
 * Shared drag utilities for timeline interactions
 */

export interface DragState {
  projectId?: string;
  holidayId?: string;
  action: string;
  startX: number;
  startY: number;
  originalStartDate: Date;
  originalEndDate: Date;
  lastDaysDelta: number;
}

// Debounced update utilities
let debouncedUpdateTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Debounce function with cleanup support
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
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
 * Throttle function for high-frequency events with mode-specific delays
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  mode: 'days' | 'weeks' = 'days'
): T {
  let lastCall = 0;
  // Use longer delay for weeks mode due to computational complexity
  const effectiveDelay = mode === 'weeks' ? Math.max(delay, 50) : delay;
  
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
    const columnWidth = mode === 'weeks' ? 77 : 40;
    
    if (mode === 'weeks') {
      // In weeks mode, use the simplified 11px per day for consistency
      // This matches the positioning system exactly (77px ÷ 7 = 11px per day)
      const dayWidth = 11; // Consistent with timelinePositioning.ts
      return Math.round(deltaX / dayWidth);
    } else {
      // In days mode, each column is one day at 40px
      return Math.round(deltaX / columnWidth);
    }
  } else {
    // For holidays - fixed 40px width (holidays are always in days mode)
    return Math.round(deltaX / 40);
  }
}

/**
 * Ensure minimum duration for date range operations
 */
export function validateDateRange(
  newStartDate: Date, 
  newEndDate: Date
): { isValid: boolean; adjustedStartDate?: Date; adjustedEndDate?: Date } {
  if (newStartDate > newEndDate) {
    return { isValid: false };
  }
  
  // Ensure at least 1 day duration
  const timeDiff = newEndDate.getTime() - newStartDate.getTime();
  const daysDiff = timeDiff / (24 * 60 * 60 * 1000);
  
  if (daysDiff < 0) {
    return { isValid: false };
  }
  
  return { 
    isValid: true, 
    adjustedStartDate: newStartDate, 
    adjustedEndDate: newEndDate 
  };
}

/**
 * Create smooth animation function for timeline navigation
 */
export function createSmoothAnimation(
  currentStart: number,
  targetStart: number,
  duration: number,
  onUpdate: (intermediateStart: Date) => void,
  onComplete: (targetStart: Date) => void
): () => void {
  const startTime = performance.now();
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Sine-based ease-in-out function
    const easedProgress = -(Math.cos(Math.PI * progress) - 1) / 2;
    
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
    // Animation cleanup if needed
  };
}

/**
 * Constants for timeline layout
 */
export const TIMELINE_CONSTANTS = {
  DAY_WIDTH: 40,
  DAY_GAP: 1,
  ROW_HEIGHT: 52,
  GROUP_HEADER_HEIGHT: 32,
  SCROLL_ANIMATION_DURATION: 500,
  SCROLL_ANIMATION_MAX_DURATION: 600,
  SCROLL_ANIMATION_MS_PER_DAY: 25
} as const;