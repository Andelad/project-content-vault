/**
 * Work Hour Calculation Service
 * 
 * Centralizes all work hour business logic, calculations, and transformations.
 * Extracted from useWorkHours hook to follow architectural pattern of keeping
 * calculations in services rather than hooks.
 * Uses single source of truth for all basic calculations.
 */

import { 
  calculateDurationHours 
} from '@/services/core/calculations/dateCalculations';
import { 
  getWeekStart as coreGetWeekStart,
  getCurrentWeekStart as coreGetCurrentWeekStart
} from '@/services/core/calculations/timeCalculations';

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

export class WorkHourCalculationService {
  
  // Week-specific storage for calendar overrides
  private static weeklyOverridesMap: Map<number, WorkHour[]> = new Map();
  private static nextId = 1;
  
  /**
   * Calculate the start date for any given week (Monday)
   * DELEGATES to single source of truth
   */
  static getWeekStart(date: Date): Date {
    return coreGetWeekStart(date);
  }  /**
   * Get the current week's start date (Monday)
   * DELEGATES to single source of truth
   */
  static getCurrentWeekStart(): Date {
    return coreGetCurrentWeekStart();
  }

  /**
   * Generate unique week key for storage
   */
  static getWeekKey(weekStart: Date): number {
    return weekStart.getTime();
  }

  /**
   * Generate work hours from settings for a specific week
   */
  static generateWorkHoursFromSettings(params: WorkHourGenerationParams): WorkHour[] {
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
   * Calculate duration in hours between two times
   * DELEGATES to single source of truth
   */
  static calculateDuration(startTime: Date, endTime: Date): number {
    return calculateDurationHours(startTime, endTime);
  }

  /**
   * Create a new work hour with calculated duration
   */
  static createWorkHour(workHourData: Omit<WorkHour, 'id' | 'duration'>, idPrefix: string = 'custom'): WorkHour {
    const duration = this.calculateDuration(
      new Date(workHourData.startTime),
      new Date(workHourData.endTime)
    );

    return {
      id: `${idPrefix}-${this.nextId++}`,
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
  static updateWorkHourWithDuration(
    existingWorkHour: WorkHour, 
    updates: Partial<Omit<WorkHour, 'id'>>
  ): WorkHour {
    const updatedWorkHour = { ...existingWorkHour, ...updates };
    
    // Recalculate duration if start or end time changed
    if (updates.startTime || updates.endTime) {
      updatedWorkHour.duration = this.calculateDuration(
        new Date(updatedWorkHour.startTime),
        new Date(updatedWorkHour.endTime)
      );
    }
    
    return updatedWorkHour;
  }

  /**
   * Merge settings work hours with week-specific overrides
   */
  static mergeWorkHoursWithOverrides(params: WorkHourMergeParams): WorkHour[] {
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

  /**
   * Check if a work hour can be modified (not in the past)
   */
  static canModifyWorkHour(workHour: WorkHour): boolean {
    const now = new Date();
    const eventEnd = new Date(workHour.endTime);
    return eventEnd >= now;
  }

  /**
   * Validate work hour times
   */
  static validateWorkHour(workHour: Partial<WorkHour>): { isValid: boolean; errors: string[] } {
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

  /**
   * Create week override manager for a specific storage map
   */
  static createWeekOverrideManager(): WeekOverrideManager {
    return {
      getWeekOverrides: (weekStart: Date): WorkHour[] => {
        const weekKey = this.getWeekKey(weekStart);
        return this.weeklyOverridesMap.get(weekKey) || [];
      },

      setWeekOverrides: (weekStart: Date, overrides: WorkHour[]): void => {
        const weekKey = this.getWeekKey(weekStart);
        this.weeklyOverridesMap.set(weekKey, overrides);
      },

      addWeekOverride: (weekStart: Date, override: WorkHour): void => {
        const weekKey = this.getWeekKey(weekStart);
        const currentOverrides = this.weeklyOverridesMap.get(weekKey) || [];
        this.weeklyOverridesMap.set(weekKey, [...currentOverrides, override]);
      },

      updateWeekOverride: (weekStart: Date, overrideId: string, updatedOverride: WorkHour): void => {
        const weekKey = this.getWeekKey(weekStart);
        const currentOverrides = this.weeklyOverridesMap.get(weekKey) || [];
        const existingIndex = currentOverrides.findIndex(wh => wh.id === overrideId);
        
        if (existingIndex !== -1) {
          const newOverrides = [...currentOverrides];
          newOverrides[existingIndex] = updatedOverride;
          this.weeklyOverridesMap.set(weekKey, newOverrides);
        } else {
          // If not found, add it
          this.weeklyOverridesMap.set(weekKey, [...currentOverrides, updatedOverride]);
        }
      },

      removeWeekOverride: (weekStart: Date, overrideId: string): void => {
        const weekKey = this.getWeekKey(weekStart);
        const currentOverrides = this.weeklyOverridesMap.get(weekKey) || [];
        const newOverrides = currentOverrides.filter(wh => wh.id !== overrideId);
        this.weeklyOverridesMap.set(weekKey, newOverrides);
      },

      clearWeekOverrides: (weekStart: Date): void => {
        const weekKey = this.getWeekKey(weekStart);
        this.weeklyOverridesMap.set(weekKey, []);
      }
    };
  }

  /**
   * Create deletion override for settings work hour
   */
  static createDeletionOverride(settingsWorkHourId: string): WorkHour {
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
  static createUpdateOverride(
    settingsWorkHourId: string, 
    originalWorkHour: WorkHour, 
    updates: Partial<Omit<WorkHour, 'id'>>
  ): WorkHour {
    const overrideWorkHour = this.updateWorkHourWithDuration(originalWorkHour, updates);
    overrideWorkHour.id = `override-${settingsWorkHourId}`;
    return overrideWorkHour;
  }

  /**
   * Reset the static state (useful for testing)
   */
  static resetState(): void {
    this.weeklyOverridesMap.clear();
    this.nextId = 1;
  }
}
