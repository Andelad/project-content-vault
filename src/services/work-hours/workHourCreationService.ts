// Work hour creation service - extracted from WorkHourCreator component
// Handles all work hour calculation, validation, and creation logic

/**
 * Time calculation parameters for work hour creation
 */
export interface TimeCalculationParams {
  clientY: number;
  containerElement: HTMLElement;
  date: Date;
}

/**
 * Work hour creation state interface
 */
export interface WorkHourCreateState {
  isCreating: boolean;
  startTime: Date | null;
  endTime: Date | null;
  startPosition: { x: number; y: number } | null;
}

/**
 * Work hour validation result
 */
export interface WorkHourValidationResult {
  isValid: boolean;
  hasOverlaps: boolean;
  overlaps: any[];
  duration: number;
  formattedDuration: string;
}

/**
 * Work hour creation result
 */
export interface WorkHourCreationResult {
  startTime: Date;
  endTime: Date;
  duration: number;
  day: string;
  isValid: boolean;
  validationResult: WorkHourValidationResult;
}

/**
 * Work hour preview styling configuration
 */
export interface WorkHourPreviewStyle {
  position: 'absolute';
  top: string;
  height: string;
  left: string;
  right: string;
  backgroundColor: string;
  border: string;
  borderRadius: string;
  pointerEvents: 'none';
  zIndex: number;
  display: string;
  alignItems: string;
  justifyContent: string;
}

/**
 * Constants for work hour calculations
 */
export const WORK_HOUR_CONSTANTS = {
  SLOT_HEIGHT_PX: 15,
  SLOTS_PER_HOUR: 4,
  MINUTES_PER_SLOT: 15,
  MIN_DURATION_MINUTES: 15,
  MAX_HOUR: 23,
  MIN_HOUR: 0,
  HOUR_HEIGHT_PX: 60,
  MIN_PREVIEW_HEIGHT: 24,
  SNAP_THRESHOLD_MINUTES: 15
} as const;

/**
 * Day name mapping for work hour calculations
 */
export const DAY_NAMES = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
] as const;

/**
 * Snaps a time to the nearest 15-minute slot
 */
export function snapToTimeSlot(date: Date): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const roundedMinutes = Math.round(minutes / WORK_HOUR_CONSTANTS.MINUTES_PER_SLOT) * WORK_HOUR_CONSTANTS.MINUTES_PER_SLOT;
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

/**
 * Ensures end time is after start time with minimum duration
 */
export function adjustEndTime(
  startTime: Date, 
  endTime: Date, 
  minimumMinutes: number = WORK_HOUR_CONSTANTS.MIN_DURATION_MINUTES
): Date {
  const minEndTime = new Date(startTime.getTime() + minimumMinutes * 60 * 1000);
  return endTime > startTime ? endTime : minEndTime;
}

/**
 * Calculates duration between two times in hours
 */
export function calculateDurationHours(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
}

/**
 * Calculates duration between two times in minutes
 */
export function calculateDurationMinutes(startTime: Date, endTime: Date): number {
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60);
}

/**
 * Formats duration for display
 */
export function formatDurationPreview(startTime: Date, endTime: Date): string {
  const duration = calculateDurationMinutes(startTime, endTime);
  const hours = Math.floor(duration / 60);
  const minutes = Math.round(duration % 60);
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Gets day name from date
 */
export function getDayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

/**
 * Formats time for validation (HH:mm format)
 */
export function formatTimeForValidation(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/**
 * Formats work slot duration for display
 */
export function formatWorkSlotDurationDisplay(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  } else if (hours === 1) {
    return '1 hour';
  } else {
    return `${hours.toFixed(2)} hours`;
  }
}

/**
 * Formats duration from decimal hours to human-readable string
 */
export function formatDurationFromHours(duration: number): string {
  const hours = Math.floor(duration);
  const minutes = Math.round((duration - hours) * 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Formats time for display (12-hour format)
 */
export function formatTimeForDisplay(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Validates work hour creation against existing slots
 */
export function validateWorkHourCreation(
  startTime: Date,
  endTime: Date,
  date: Date,
  existingSlots: any[]
): WorkHourValidationResult {
  const startTimeStr = formatTimeForValidation(startTime);
  const endTimeStr = formatTimeForValidation(endTime);
  
  const validation = validateWorkSlotTimes(startTimeStr, endTimeStr, existingSlots);
  const duration = calculateDurationHours(startTime, endTime);
  const formattedDuration = formatDurationPreview(startTime, endTime);
  
  return {
    isValid: validation.isValid,
    hasOverlaps: !validation.isValid,
    overlaps: validation.overlaps || [],
    duration,
    formattedDuration
  };
}

/**
 * Checks if work hour creation should proceed based on validation and duration
 */
export function shouldCreateWorkHour(
  validationResult: WorkHourValidationResult,
  hasDragged: boolean,
  minimumDurationHours: number = 0.25
): boolean {
  return (
    hasDragged &&
    validationResult.isValid &&
    validationResult.duration >= minimumDurationHours
  );
}

/**
 * Creates work hour data structure for persistence
 */
export function createWorkHourData(
  startTime: Date,
  endTime: Date,
  date: Date,
  validationResult: WorkHourValidationResult
): WorkHourCreationResult {
  const dayName = getDayName(date);
  
  return {
    startTime,
    endTime,
    duration: validationResult.duration,
    day: dayName,
    isValid: validationResult.isValid,
    validationResult
  };
}

/**
 * Calculates preview positioning for work hour creation
 */
export function calculateWorkHourPreviewPosition(
  startTime: Date,
  endTime: Date
): { top: number; height: number } {
  const startHour = startTime.getHours();
  const startMin = startTime.getMinutes();
  const duration = calculateDurationHours(startTime, endTime);
  
  const topOffset = (startHour * WORK_HOUR_CONSTANTS.HOUR_HEIGHT_PX) + 
                   (startMin * WORK_HOUR_CONSTANTS.HOUR_HEIGHT_PX / 60);
  const height = duration * WORK_HOUR_CONSTANTS.HOUR_HEIGHT_PX;
  
  return {
    top: Math.max(0, topOffset),
    height: Math.max(height, WORK_HOUR_CONSTANTS.MIN_PREVIEW_HEIGHT)
  };
}

/**
 * Generates preview style for work hour creation
 */
export function generateWorkHourPreviewStyle(
  startTime: Date,
  endTime: Date,
  hasOverlap: boolean
): WorkHourPreviewStyle {
  const { top, height } = calculateWorkHourPreviewPosition(startTime, endTime);
  
  return {
    position: 'absolute',
    top: `${top}px`,
    height: `${height}px`,
    left: '0px',
    right: '0px',
    backgroundColor: hasOverlap ? 'rgba(239, 68, 68, 0.2)' : 'rgba(139, 195, 74, 0.2)',
    border: hasOverlap ? '2px dashed rgb(239, 68, 68)' : '2px dashed rgb(139, 195, 74)',
    borderRadius: '0.375rem',
    pointerEvents: 'none',
    zIndex: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
}

/**
 * Handles mouse down event for work hour creation start
 */
export function handleWorkHourCreationStart(
  event: React.MouseEvent,
  containerRef: React.RefObject<HTMLDivElement>,
  date: Date,
  calendarMode?: string
): WorkHourCreateState | null {
  if (calendarMode !== 'work-hours') return null;
  if (event.button !== 0) return null; // Only left click
  
  // Check if clicking on an existing work hour
  const target = event.target as HTMLElement;
  const workHourElement = target.closest('[data-work-hour-id]');
  if (workHourElement) return null;
  
  if (!containerRef.current) return null;
  
  const startTime = calculateTimeFromPosition({
    clientY: event.clientY,
    containerElement: containerRef.current,
    date
  });
  
  return {
    isCreating: true,
    startTime,
    endTime: startTime,
    startPosition: { x: event.clientX, y: event.clientY }
  };
}

/**
 * Handles mouse move event during work hour creation
 */
export function handleWorkHourCreationMove(
  event: MouseEvent,
  createState: WorkHourCreateState,
  containerRef: React.RefObject<HTMLDivElement>,
  date: Date,
  existingSlots: any[]
): {
  updatedState: WorkHourCreateState;
  validationResult: WorkHourValidationResult;
  hasDragged: boolean;
} | null {
  if (!createState.isCreating || !createState.startTime || !containerRef.current) {
    return null;
  }
  
  const endTime = calculateTimeFromPosition({
    clientY: event.clientY,
    containerElement: containerRef.current,
    date
  });
  
  const adjustedEndTime = adjustEndTime(createState.startTime, endTime);
  
  const updatedState: WorkHourCreateState = {
    ...createState,
    endTime: adjustedEndTime
  };
  
  const validationResult = validateWorkHourCreation(
    createState.startTime,
    adjustedEndTime,
    date,
    existingSlots
  );
  
  return {
    updatedState,
    validationResult,
    hasDragged: true
  };
}

/**
 * Handles mouse up event to complete work hour creation
 */
export function handleWorkHourCreationComplete(
  createState: WorkHourCreateState,
  date: Date,
  existingSlots: any[],
  hasDragged: boolean
): WorkHourCreationResult | null {
  if (!createState.isCreating || !createState.startTime || !createState.endTime) {
    return null;
  }
  
  const validationResult = validateWorkHourCreation(
    createState.startTime,
    createState.endTime,
    date,
    existingSlots
  );
  
  if (!shouldCreateWorkHour(validationResult, hasDragged)) {
    return null;
  }
  
  return createWorkHourData(
    createState.startTime,
    createState.endTime,
    date,
    validationResult
  );
}

/**
 * Gets overlap information for real-time feedback
 */
export function getWorkHourOverlapInfo(
  createState: WorkHourCreateState,
  date: Date,
  existingSlots: any[]
): { hasOverlaps: boolean; overlaps: any[] } {
  if (!createState.isCreating || !createState.startTime || !createState.endTime) {
    return { hasOverlaps: false, overlaps: [] };
  }
  
  const validationResult = validateWorkHourCreation(
    createState.startTime,
    createState.endTime,
    date,
    existingSlots
  );
  
  return {
    hasOverlaps: validationResult.hasOverlaps,
    overlaps: validationResult.overlaps
  };
}

/**
 * Validates work hour time ranges
 */
export function validateWorkHourTimeRange(
  startTime: Date,
  endTime: Date
): { isValid: boolean; reason?: string } {
  // Check if end time is after start time
  if (endTime <= startTime) {
    return { isValid: false, reason: 'End time must be after start time' };
  }
  
  // Check minimum duration
  const durationMinutes = calculateDurationMinutes(startTime, endTime);
  if (durationMinutes < WORK_HOUR_CONSTANTS.MIN_DURATION_MINUTES) {
    return { 
      isValid: false, 
      reason: `Minimum duration is ${WORK_HOUR_CONSTANTS.MIN_DURATION_MINUTES} minutes` 
    };
  }
  
  // Check reasonable hours (not spanning multiple days)
  const hoursDifference = calculateDurationHours(startTime, endTime);
  if (hoursDifference > 18) {
    return { isValid: false, reason: 'Work hours cannot exceed 18 hours' };
  }
  
  return { isValid: true };
}

/**
 * Calculates work hour creation cursor style
 */
export function getWorkHourCreationCursor(
  calendarMode?: string,
  isCreating?: boolean
): string {
  if (calendarMode !== 'work-hours') return 'default';
  return isCreating ? 'ns-resize' : 'crosshair';
}

/**
 * Checks if an element should allow work hour creation
 */
export function shouldAllowWorkHourCreation(target: HTMLElement): boolean {
  // Don't allow creation if clicking on existing work hour
  const workHourElement = target.closest('[data-work-hour-id]');
  if (workHourElement) return false;
  
  // Don't allow creation on interactive elements
  const interactiveElements = ['button', 'input', 'select', 'textarea', 'a'];
  if (interactiveElements.includes(target.tagName.toLowerCase())) return false;
  
  return true;
}

// =====================================================================================
// WORK SLOT VALIDATION UTILITIES
// =====================================================================================

import type { WorkSlot } from '@/types/core';

export interface TimeRange {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  duration: number;
}

/**
 * Parse time string to hours and minutes
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Convert time string to total minutes
 */
function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

/**
 * Check if two time ranges overlap
 */
function checkTimeRangeOverlap(range1: TimeRange, range2: TimeRange): boolean {
  const start1 = timeToMinutes(range1.startTime);
  const end1 = timeToMinutes(range1.endTime);
  const start2 = timeToMinutes(range2.startTime);
  const end2 = timeToMinutes(range2.endTime);
  
  // Two ranges overlap if one starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Find overlapping work slots
 */
function findOverlappingSlots(
  newSlot: TimeRange, 
  existingSlots: WorkSlot[], 
  excludeSlotId?: string
): WorkSlot[] {
  return existingSlots.filter(slot => {
    // Don't check against the slot being modified
    if (excludeSlotId && (slot.id === excludeSlotId || 
        // Also handle numeric string IDs for compatibility
        slot.id === excludeSlotId.toString() ||
        // Handle array index matching for generated work hour IDs
        existingSlots.findIndex(s => s.id === slot.id).toString() === excludeSlotId)) {
      return false;
    }
    
    return checkTimeRangeOverlap(newSlot, {
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: slot.duration
    });
  });
}

/**
 * Validate work slot times for overlaps and constraints
 */
export function validateWorkSlotTimes(
  startTime: string,
  endTime: string,
  existingSlots: WorkSlot[],
  excludeSlotId?: string
): {
  isValid: boolean;
  overlaps: WorkSlot[];
  duration: number;
} {
  // Calculate duration
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const duration = (endMinutes - startMinutes) / 60;
  
  // Check for minimum duration (15 minutes)
  if (duration < 0.25) {
    return {
      isValid: false,
      overlaps: [],
      duration
    };
  }
  
  const newSlot: TimeRange = {
    startTime,
    endTime,
    duration
  };
  
  const overlaps = findOverlappingSlots(newSlot, existingSlots, excludeSlotId);
  
  return {
    isValid: overlaps.length === 0 && duration >= 0.25,
    overlaps,
    duration
  };
}
