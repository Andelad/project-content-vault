/**
 * Shared drag utilities for timeline interactions
 * @deprecated - Use @/services/dragCalculationService instead
 * This file is kept for backward compatibility
 */

import {
  calculateDaysDelta as serviceCalculateDaysDelta,
  createSmoothDragAnimation,
  debounceDragUpdate,
  throttleDragUpdate,
  validateDragDateRange,
  type DragState as ServiceDragState,
  type SmoothAnimationConfig
} from '@/services';

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

/**
 * @deprecated Use debounceDragUpdate from dragCalculationService
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  key: string = 'default'
): T {
  return debounceDragUpdate(func, delay, key);
}

/**
 * @deprecated Use throttleDragUpdate from dragCalculationService
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  mode: 'days' | 'weeks' = 'days'
): T {
  return throttleDragUpdate(func, mode, delay);
}

/**
 * @deprecated Use calculateDaysDelta from dragCalculationService
 */
export function calculateDaysDelta(
  currentX: number, 
  startX: number, 
  dates: Date[], 
  isDynamicWidth: boolean = true,
  mode: 'days' | 'weeks' = 'days'
): number {
  return serviceCalculateDaysDelta(currentX, startX, dates, isDynamicWidth, mode);
}

/**
 * @deprecated Use validateDragDateRange from dragCalculationService
 */
export function validateDateRange(
  newStartDate: Date, 
  newEndDate: Date
): { isValid: boolean; adjustedStartDate?: Date; adjustedEndDate?: Date } {
  const result = validateDragDateRange(newStartDate, newEndDate);
  return {
    isValid: result.isValid,
    adjustedStartDate: result.adjustedStartDate,
    adjustedEndDate: result.adjustedEndDate
  };
}

/**
 * @deprecated Use createSmoothDragAnimation from dragCalculationService
 */
export function createSmoothAnimation(
  currentStart: number,
  targetStart: number,
  duration: number,
  onUpdate: (intermediateStart: Date) => void,
  onComplete: (targetStart: Date) => void
): () => void {
  const config: SmoothAnimationConfig = {
    currentStart,
    targetStart,
    duration
  };
  
  return createSmoothDragAnimation(config, onUpdate, onComplete);
}