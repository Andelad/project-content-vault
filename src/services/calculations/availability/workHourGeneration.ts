/**
 * Work Hour Generation Service
 * 
 * KEYWORDS: work hours, working hours, work hour totals, work schedule, weekly work hours,
 *           work hour generation, work hour overrides, work duration, work slots, time slots,
 *           generate work hours, create work hours
 * 
 * Generates work hours from settings and manages work hour overrides.
 * Extracted from legacy WorkHourCalculationService to follow architectural pattern of keeping
 * calculations in dedicated services.
 * Uses single source of truth for all basic calculations.
 * 
 * USE WHEN:
 * - Generating work hours from settings
 * - Calculating work hour totals and durations
 * - Managing work hour overrides for specific weeks
 * - Analyzing work schedules
 * 
 * RELATED FILES:
 * - capacityAnalysis.ts - For capacity analysis, utilization, overbooking
 * - dailyMetrics.ts - For daily availability metrics
 */

import { 
  calculateDurationHours,
  calculateDurationMinutes
} from '../general/dateCalculations';
import { 
  getWeekStart as coreGetWeekStart,
  getCurrentWeekStart as coreGetCurrentWeekStart
} from '../general/timeCalculations';

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

/**
 * Calculate total work hours from an array of work hour objects
 * THE authoritative work hours total calculation used everywhere
 */
export function calculateWorkHoursTotal(workHours: any[]): number {
  if (!Array.isArray(workHours)) {
    return 0;
  }
  return workHours.reduce((sum, workHour) => sum + (workHour.duration || 0), 0);
}

/**
 * Calculate work hours for a specific day from settings
 * Extracts the work hours array for the given day of week
 */
export function calculateDayWorkHours(date: Date, settings: any): any[] {
  if (!settings?.weeklyWorkHours) return [];

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
  return settings.weeklyWorkHours[dayName] || [];
}

/**
 * Calculate total work hours for a specific day
 * Combines calculateDayWorkHours + calculateWorkHoursTotal
 */
export function calculateTotalDayWorkHours(date: Date, settings: any): number {
  const dayWorkHours = calculateDayWorkHours(date, settings);
  return calculateWorkHoursTotal(dayWorkHours);
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
        id: `settings-${dayName}-${slot.id}`, // Stable ID not based on timestamp
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
