/**
 * Time calculation utilities for work hour creation
 * Extracted from WorkHourCreator component for reusability and testing
 */

export interface TimeCalculationParams {
  clientY: number;
  containerElement: HTMLElement;
  date: Date;
}

/**
 * Snaps a time to the nearest 15-minute slot
 */
export function snapToTimeSlot(date: Date): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const roundedMinutes = Math.round(minutes / 15) * 15;
  snapped.setMinutes(roundedMinutes, 0, 0);
  return snapped;
}

/**
 * Calculates time from mouse position within a calendar grid
 */
export function calculateTimeFromPosition(params: TimeCalculationParams): Date {
  const { clientY, containerElement, date } = params;
  
  // Get the calendar grid container
  const calendarGrid = containerElement.closest('[data-calendar-grid]');
  if (!calendarGrid) return new Date();
  
  const gridRect = calendarGrid.getBoundingClientRect();
  const relativeY = clientY - gridRect.top; // Removed the -48 offset that was causing the 1-hour shift
  
  // Each hour is 60px, each 15-min slot is 15px
  const slotHeight = 15;
  const slotIndex = Math.max(0, Math.floor(relativeY / slotHeight));
  const hour = Math.floor(slotIndex / 4); // 4 slots per hour
  const minute = (slotIndex % 4) * 15; // 15min increments
  
  const newTime = new Date(date);
  newTime.setHours(Math.min(23, Math.max(0, hour)), minute, 0, 0);
  
  return snapToTimeSlot(newTime);
}

/**
 * Ensures end time is after start time with minimum duration
 */
export function adjustEndTime(startTime: Date, endTime: Date, minimumMinutes: number = 15): Date {
  const minEndTime = new Date(startTime.getTime() + minimumMinutes * 60 * 1000);
  return endTime > startTime ? endTime : minEndTime;
}

/**
 * Constants for time calculations
 */
export const TIME_CALCULATION_CONSTANTS = {
  SLOT_HEIGHT_PX: 15,
  SLOTS_PER_HOUR: 4,
  MINUTES_PER_SLOT: 15,
  MIN_DURATION_MINUTES: 15,
  MAX_HOUR: 23,
  MIN_HOUR: 0
} as const;
