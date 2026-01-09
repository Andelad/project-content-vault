/**
 * Work Hour UI Interaction Service
 * 
 * KEYWORDS: work hour creation, work hour UI, mouse handlers, drag to create,
 *           work hour preview, calendar interaction, time slot creation
 * 
 * Handles UI interactions for creating and manipulating work hours in the calendar view.
 * 
 * USE WHEN:
 * - Handling mouse events for work hour creation
 * - Generating preview styles during drag
 * - Calculating time from mouse position
 * - Validating work hour creation
 * 
 * RELATED FILES:
 * - workHourGeneration.ts (calculations/availability) - For work hour data generation
 * - CalendarLayout.ts (ui) - For calendar grid layout
 */

import { 
  calculateDurationHours,
  formatDuration
} from '@/presentation/app/utils/dateCalculations';
import { 
  snapToTimeSlot,
  adjustEndTime,
  formatTime
} from '@/presentation/app/utils/timeCalculations';
import type { WorkHour } from '@/shared/types/core';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export const WORK_HOUR_CONSTANTS = {
  MINUTES_PER_SLOT: 15,
  SLOTS_PER_HOUR: 4,
  SLOT_HEIGHT_PX: 15,
  MIN_HOUR: 6,
  MAX_HOUR: 23,
  MIN_DURATION_MINUTES: 15
} as const;

export interface TimeCalculationParams {
  clientY: number;
  containerElement: HTMLElement;
  date: Date;
}

export interface WorkHourCreateState {
  isCreating: boolean;
  startTime: Date | null;
  endTime: Date | null;
  startPosition: { x: number; y: number } | null;
}

// ============================================================================
// POSITION TO TIME CONVERSION
// ============================================================================

/**
 * Calculates time from mouse position within a calendar grid
 * THE authoritative mouse-to-time conversion for work hour creation
 */
export function calculateTimeFromPosition(params: TimeCalculationParams): Date {
  const { clientY, containerElement, date } = params;
  
  // Get the calendar grid container
  const calendarGrid = containerElement.closest('[data-calendar-grid]');
  if (!calendarGrid) return new Date();
  
  const gridRect = calendarGrid.getBoundingClientRect();
  const relativeY = clientY - gridRect.top;
  
  // Each hour is 60px, each 15-min slot is 15px
  const slotIndex = Math.max(0, Math.floor(relativeY / WORK_HOUR_CONSTANTS.SLOT_HEIGHT_PX));
  const hour = Math.floor(slotIndex / WORK_HOUR_CONSTANTS.SLOTS_PER_HOUR);
  const minute = (slotIndex % WORK_HOUR_CONSTANTS.SLOTS_PER_HOUR) * WORK_HOUR_CONSTANTS.MINUTES_PER_SLOT;
  
  const newTime = new Date(date);
  newTime.setHours(
    Math.min(WORK_HOUR_CONSTANTS.MAX_HOUR, Math.max(WORK_HOUR_CONSTANTS.MIN_HOUR, hour)), 
    minute, 
    0, 
    0
  );
  
  return snapToTimeSlot(newTime);
}

// ============================================================================
// WORK HOUR CREATION HANDLERS
// ============================================================================

/**
 * Handle work hour creation start
 * Initializes work hour creation when user clicks
 */
export function handleWorkHourCreationStart(
  clientY: number,
  containerElement: HTMLElement,
  date: Date
): { startTime: Date; startPosition: { x: number; y: number } } {
  const startTime = calculateTimeFromPosition({ clientY, containerElement, date });
  const rect = containerElement.getBoundingClientRect();
  
  return {
    startTime,
    startPosition: { 
      x: rect.left,
      y: clientY 
    }
  };
}

/**
 * Handle work hour creation move
 * Updates work hour preview as user drags
 */
export function handleWorkHourCreationMove(
  clientY: number,
  containerElement: HTMLElement,
  date: Date,
  startTime: Date
): { endTime: Date; duration: number; formattedDuration: string } {
  const currentTime = calculateTimeFromPosition({ clientY, containerElement, date });
  const endTime = adjustEndTime(startTime, currentTime);
  const duration = calculateDurationHours(startTime, endTime);
  
  return {
    endTime,
    duration,
    formattedDuration: formatDuration(duration)
  };
}

/**
 * Handle work hour creation complete
 * Validates and finalizes work hour creation
 */
export function handleWorkHourCreationComplete(
  startTime: Date,
  endTime: Date,
  existingWorkHours: WorkHour[] = []
): { startTime: Date; endTime: Date; duration: number; formattedDuration: string; isValid: boolean; validationErrors: string[] } {
  const adjustedEndTime = adjustEndTime(startTime, endTime);
  const duration = calculateDurationHours(startTime, adjustedEndTime);
  const validationErrors: string[] = [];

  // Basic validation
  if (duration < WORK_HOUR_CONSTANTS.MIN_DURATION_MINUTES / 60) {
    validationErrors.push('Duration must be at least 15 minutes');
  }

  return {
    startTime,
    endTime: adjustedEndTime,
    duration,
    formattedDuration: formatDuration(duration),
    isValid: validationErrors.length === 0,
    validationErrors
  };
}

// ============================================================================
// OVERLAP DETECTION
// ============================================================================

/**
 * Get work hour overlap information
 * Checks if new work hour overlaps with existing ones
 */
export function getWorkHourOverlapInfo(
  startTime: Date,
  endTime: Date,
  existingWorkHours: WorkHour[]
): { hasOverlaps: boolean; overlaps: WorkHour[]; overlapDuration: number } {
  const overlaps = existingWorkHours.filter(workHour => {
    const workHourStart = new Date(workHour.startTime);
    const workHourEnd = new Date(workHour.endTime);
    return startTime < workHourEnd && endTime > workHourStart;
  });

  const overlapDuration = overlaps.reduce((total, overlap) => {
    const overlapStart = Math.max(startTime.getTime(), new Date(overlap.startTime).getTime());
    const overlapEnd = Math.min(endTime.getTime(), new Date(overlap.endTime).getTime());
    return total + (overlapEnd - overlapStart) / (1000 * 60 * 60);
  }, 0);

  return {
    hasOverlaps: overlaps.length > 0,
    overlaps,
    overlapDuration
  };
}

// ============================================================================
// UI STYLING & DISPLAY
// ============================================================================

/**
 * Generate work hour preview style
 * Calculates CSS positioning for preview element during drag
 */
export function generateWorkHourPreviewStyle(
  startTime: Date,
  endTime: Date
): { top: string; height: string; opacity: string } {
  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;

  const topOffset = (startHour - WORK_HOUR_CONSTANTS.MIN_HOUR) * 60; // 60px per hour
  const height = (endHour - startHour) * 60;

  return {
    top: `${topOffset}px`,
    height: `${height}px`,
    opacity: '0.6'
  };
}

/**
 * Get work hour creation cursor style
 * Returns appropriate cursor for creation state
 */
export function getWorkHourCreationCursor(isCreating: boolean): string {
  return isCreating ? 'ns-resize' : 'crosshair';
}

/**
 * Check if work hour creation should be allowed
 * Validates if creation is allowed for given date/container
 */
export function shouldAllowWorkHourCreation(
  date: Date,
  containerElement: HTMLElement
): boolean {
  return true; // Allow creation on all days for now
}

/**
 * Format work slot duration for display
 * Creates human-readable display of work slot time range
 */
export function formatWorkSlotDurationDisplay(
  startTime: Date,
  endTime: Date
): string {
  const duration = calculateDurationHours(startTime, endTime);
  const formattedTime = `${formatTime(startTime)} - ${formatTime(endTime)}`;
  const formattedDuration = formatDuration(duration);

  return `${formattedTime} (${formattedDuration})`;
}

/**
 * Format time for display in work hour components
 * Simple wrapper for time formatting
 */
export function formatWorkHourTimeDisplay(time: Date): string {
  return formatTime(time);
}
