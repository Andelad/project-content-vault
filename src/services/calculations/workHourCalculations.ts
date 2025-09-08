/**
 * Work Hour Calculation Service
 * 
 * Pure calculation functions for work hours, duration calculations, and work schedule logic.
 * Extracted from legacy WorkHourCalculationService to follow architectural pattern of keeping
 * calculations in dedicated services.
 * Uses single source of truth for all basic calculations.
 */

import { 
  calculateDurationHours 
} from './dateCalculations';
import { 
  getWeekStart as coreGetWeekStart,
  getCurrentWeekStart as coreGetCurrentWeekStart
} from './timeCalculations';

import { WorkHour, WorkSlot } from '@/types/core';

export interface WeekOverrideManager {
  getWeekOverrides: (weekStart: Date) => WorkHour[];
  setWeekOverrides: (weekStart: Date, overrides: WorkHour[]) => void;
  addWeekOverride: (weekStart: Date, override: WorkHour) => void;
  updateWeekOverride: (weekStart: Date, overrideId: string, updatedOverride: WorkHour) => void;
  removeWeekOverride: (weekStart: Date, overrideId: string) => void;
  clearWeekOverrides: (weekStart: Date) => void;
}

export interface WorkHourGenerationParams {
  weekStartDate: Date;
  weeklyWorkHours: any;
}

export interface WorkHourMergeParams {
  settingsWorkHours: WorkHour[];
  weekOverrides: WorkHour[];
  currentWeekStart: Date;
  viewWeekStart: Date;
}

// Week-specific storage for calendar overrides
let weeklyOverridesMap: Map<number, WorkHour[]> = new Map();
let nextId = 1;

// ===== CORE CALCULATION FUNCTIONS =====

/**
 * Calculate the start date for any given week (Monday)
 * DELEGATES to single source of truth
 */
export function getWeekStart(date: Date): Date {
  return coreGetWeekStart(date);
}

/**
 * Get the current week's start date (Monday)
 * DELEGATES to single source of truth
 */
export function getCurrentWeekStart(): Date {
  return coreGetCurrentWeekStart();
}

/**
 * Generate unique week key for storage
 */
export function getWeekKey(weekStart: Date): number {
  return weekStart.getTime();
}

/**
 * Calculate duration in hours between two times
 * DELEGATES to single source of truth
 */
export function calculateWorkHourDuration(startTime: Date, endTime: Date): number {
  return calculateDurationHours(startTime, endTime);
}

// ===== WORK HOUR GENERATION & MANAGEMENT =====

/**
 * Generate work hours from settings for a specific week
 */
export function generateWorkHoursFromSettings(params: WorkHourGenerationParams): WorkHour[] {
  const { weekStartDate, weeklyWorkHours } = params;
  
  if (!weeklyWorkHours) return [];
  
  const workHours: WorkHour[] = [];
  
  // Correct day mapping: Monday = 0, Tuesday = 1, etc.
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  dayNames.forEach((dayName, dayIndex) => {
    const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];
    
    daySlots.forEach((slot: WorkSlot) => {
      const workHourDate = new Date(weekStartDate);
      workHourDate.setDate(weekStartDate.getDate() + dayIndex); // Monday + 0 = Monday, etc.
      
      // Parse time strings
      const [startHour, startMin] = slot.startTime.split(':').map(Number);
      const [endHour, endMin] = slot.endTime.split(':').map(Number);
      
      const startDateTime = new Date(workHourDate);
      startDateTime.setHours(startHour, startMin, 0, 0);
      
      const endDateTime = new Date(workHourDate);
      endDateTime.setHours(endHour, endMin, 0, 0);
      
      workHours.push({
        id: `settings-${dayName}-${slot.id}-${weekStartDate.getTime()}`, // Include week to make unique
        title: `Work Hours`,
        description: `Default ${dayName} work hours`,
        startTime: startDateTime,
        endTime: endDateTime,
        duration: slot.duration,
        type: 'work'
      });
    });
  });
  
  return workHours;
}

/**
 * Create a new work hour with calculated duration
 */
export function createWorkHour(workHourData: Omit<WorkHour, 'id' | 'duration'>, idPrefix: string = 'custom'): WorkHour {
  const duration = calculateWorkHourDuration(
    new Date(workHourData.startTime),
    new Date(workHourData.endTime)
  );

  return {
    id: `${idPrefix}-${nextId++}`,
    title: workHourData.title,
    description: workHourData.description || '',
    startTime: new Date(workHourData.startTime),
    endTime: new Date(workHourData.endTime),
    duration,
    type: workHourData.type || 'work'
  };
}

/**
 * Update work hour with recalculated duration if times changed
 */
export function updateWorkHourWithDuration(
  existingWorkHour: WorkHour, 
  updates: Partial<Omit<WorkHour, 'id'>>
): WorkHour {
  const updatedWorkHour = { ...existingWorkHour, ...updates };
  
  // Recalculate duration if start or end time changed
  if (updates.startTime || updates.endTime) {
    updatedWorkHour.duration = calculateWorkHourDuration(
      new Date(updatedWorkHour.startTime),
      new Date(updatedWorkHour.endTime)
    );
  }
  
  return updatedWorkHour;
}

// ===== WORK HOUR MERGING & OVERRIDES =====

/**
 * Merge settings work hours with week-specific overrides
 */
export function mergeWorkHoursWithOverrides(params: WorkHourMergeParams): WorkHour[] {
  const { settingsWorkHours, weekOverrides, currentWeekStart, viewWeekStart } = params;
  
  // Only apply overrides for the current week (overrides are week-specific)
  const isCurrentWeek = viewWeekStart.getTime() === currentWeekStart.getTime();
  
  if (!isCurrentWeek) {
    // For non-current weeks, just return settings work hours
    return settingsWorkHours;
  }
  
  const finalWorkHours: WorkHour[] = [];
  
  // First, add all settings work hours with overrides applied
  settingsWorkHours.forEach(settingsWH => {
    // Check if there's an override for this work hour
    const overrideId = `override-${settingsWH.id}`;
    const override = weekOverrides.find(override => override.id === overrideId);
    
    if (override) {
      // Use the override instead of the settings work hour
      if (override.description !== 'DELETED_OVERRIDE') {
        finalWorkHours.push(override);
      }
      // If it's a deleted override, skip adding this work hour
    } else {
      // No override, use the settings work hour
      finalWorkHours.push(settingsWH);
    }
  });
  
  // Then, add any custom work hours (not overrides of settings)
  weekOverrides.forEach(override => {
    if (!override.id.startsWith('override-')) {
      finalWorkHours.push(override);
    }
  });
  
  return finalWorkHours;
}

// ===== VALIDATION & UTILITY FUNCTIONS =====

/**
 * Check if a work hour can be modified (not in the past)
 */
export function canModifyWorkHour(workHour: WorkHour): boolean {
  const now = new Date();
  const eventEnd = new Date(workHour.endTime);
  return eventEnd >= now;
}

/**
 * Validate work hour times
 */
export function validateWorkHour(workHour: Partial<WorkHour>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (workHour.startTime && workHour.endTime) {
    const start = new Date(workHour.startTime);
    const end = new Date(workHour.endTime);
    
    if (start >= end) {
      errors.push('End time must be after start time');
    }
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      errors.push('Invalid date/time values');
    }
  }
  
  if (!workHour.title?.trim()) {
    errors.push('Title is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// ===== WEEK OVERRIDE MANAGEMENT =====

/**
 * Create week override manager for a specific storage map
 */
export function createWeekOverrideManager(): WeekOverrideManager {
  return {
    getWeekOverrides: (weekStart: Date): WorkHour[] => {
      const weekKey = getWeekKey(weekStart);
      return weeklyOverridesMap.get(weekKey) || [];
    },

    setWeekOverrides: (weekStart: Date, overrides: WorkHour[]): void => {
      const weekKey = getWeekKey(weekStart);
      weeklyOverridesMap.set(weekKey, overrides);
    },

    addWeekOverride: (weekStart: Date, override: WorkHour): void => {
      const weekKey = getWeekKey(weekStart);
      const currentOverrides = weeklyOverridesMap.get(weekKey) || [];
      weeklyOverridesMap.set(weekKey, [...currentOverrides, override]);
    },

    updateWeekOverride: (weekStart: Date, overrideId: string, updatedOverride: WorkHour): void => {
      const weekKey = getWeekKey(weekStart);
      const currentOverrides = weeklyOverridesMap.get(weekKey) || [];
      const existingIndex = currentOverrides.findIndex(wh => wh.id === overrideId);
      
      if (existingIndex !== -1) {
        const newOverrides = [...currentOverrides];
        newOverrides[existingIndex] = updatedOverride;
        weeklyOverridesMap.set(weekKey, newOverrides);
      } else {
        // If not found, add it
        weeklyOverridesMap.set(weekKey, [...currentOverrides, updatedOverride]);
      }
    },

    removeWeekOverride: (weekStart: Date, overrideId: string): void => {
      const weekKey = getWeekKey(weekStart);
      const currentOverrides = weeklyOverridesMap.get(weekKey) || [];
      const newOverrides = currentOverrides.filter(wh => wh.id !== overrideId);
      weeklyOverridesMap.set(weekKey, newOverrides);
    },

    clearWeekOverrides: (weekStart: Date): void => {
      const weekKey = getWeekKey(weekStart);
      weeklyOverridesMap.set(weekKey, []);
    }
  };
}

// ===== OVERRIDE CREATION HELPERS =====

/**
 * Create deletion override for settings work hour
 */
export function createDeletionOverride(settingsWorkHourId: string): WorkHour {
  return {
    id: `override-${settingsWorkHourId}`,
    title: 'Deleted Work Hour',
    description: 'DELETED_OVERRIDE',
    startTime: new Date(),
    endTime: new Date(),
    duration: 0,
    type: 'work'
  };
}

/**
 * Create update override for settings work hour
 */
export function createUpdateOverride(
  settingsWorkHourId: string, 
  originalWorkHour: WorkHour, 
  updates: Partial<Omit<WorkHour, 'id'>>
): WorkHour {
  const overrideWorkHour = updateWorkHourWithDuration(originalWorkHour, updates);
  overrideWorkHour.id = `override-${settingsWorkHourId}`;
  return overrideWorkHour;
}

/**
 * Reset the static state (useful for testing)
 */
export function resetWorkHourState(): void {
  weeklyOverridesMap.clear();
  nextId = 1;
}

// ===== BACKWARDS COMPATIBILITY CLASS (DEPRECATED) =====

/**
 * @deprecated This class-based interface is deprecated. Use individual functions instead.
 * This wrapper is provided for backwards compatibility during migration.
 */
export class WorkHourCalculationService {
  static getWeekStart = getWeekStart;
  static getCurrentWeekStart = getCurrentWeekStart;
  static getWeekKey = getWeekKey;
  static generateWorkHoursFromSettings = generateWorkHoursFromSettings;
  static calculateDuration = calculateWorkHourDuration;
  static createWorkHour = createWorkHour;
  static updateWorkHourWithDuration = updateWorkHourWithDuration;
  static mergeWorkHoursWithOverrides = mergeWorkHoursWithOverrides;
  static canModifyWorkHour = canModifyWorkHour;
  static validateWorkHour = validateWorkHour;
  static createWeekOverrideManager = createWeekOverrideManager;
  static createDeletionOverride = createDeletionOverride;
  static createUpdateOverride = createUpdateOverride;
  static resetState = resetWorkHourState;

  private static weeklyOverridesMap = weeklyOverridesMap;
  private static nextId = nextId;
}

// ===== WORK HOUR CREATION FUNCTIONS =====

import { 
  snapToTimeSlot,
  adjustEndTime,
  formatTime
} from '@/services/calculations/timeCalculations';
import { 
  formatDuration,
  formatDurationFromMinutes 
} from '@/services/calculations/dateCalculations';

// Work hour constants
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
 * Calculate duration in minutes - delegates to core function
 */
export function calculateDurationMinutes(startTime: Date, endTime: Date): number {
  return Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
}

/**
 * Format time for display in work hour components
 */
export function formatTimeForDisplay(date: Date): string {
  return formatTime(date);
}

/**
 * Format duration from hours for display
 */
export function formatDurationFromHours(hours: number): string {
  const minutes = hours * 60;
  return formatDurationFromMinutes(minutes);
}

/**
 * Handle work hour creation start
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
 */
export function handleWorkHourCreationComplete(
  startTime: Date,
  endTime: Date,
  existingWorkHours: any[] = []
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

/**
 * Get work hour overlap information
 */
export function getWorkHourOverlapInfo(
  startTime: Date,
  endTime: Date,
  existingWorkHours: any[]
): { hasOverlaps: boolean; overlaps: any[]; overlapDuration: number } {
  const overlaps = existingWorkHours.filter(workHour => {
    const workHourStart = new Date(workHour.startTime);
    const workHourEnd = new Date(workHour.endTime);
    return (startTime < workHourEnd && endTime > workHourStart);
  });
  
  let overlapDuration = 0;
  overlaps.forEach(overlap => {
    const overlapStart = Math.max(startTime.getTime(), new Date(overlap.startTime).getTime());
    const overlapEnd = Math.min(endTime.getTime(), new Date(overlap.endTime).getTime());
    overlapDuration += (overlapEnd - overlapStart) / (1000 * 60 * 60); // Convert to hours
  });
  
  return {
    hasOverlaps: overlaps.length > 0,
    overlaps,
    overlapDuration
  };
}

/**
 * Generate work hour preview style
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
 * Format duration preview text
 */
export function formatDurationPreview(duration: number): string {
  return formatDuration(duration);
}

/**
 * Get work hour creation cursor style
 */
export function getWorkHourCreationCursor(isCreating: boolean): string {
  return isCreating ? 'ns-resize' : 'crosshair';
}

/**
 * Check if work hour creation should be allowed
 */
export function shouldAllowWorkHourCreation(
  date: Date,
  containerElement: HTMLElement
): boolean {
  return true; // Allow creation on all days for now
}

/**
 * Format work slot duration for display
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
