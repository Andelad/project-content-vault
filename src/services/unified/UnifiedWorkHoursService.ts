/**
 * UnifiedWorkHoursService
 * 
 * Handles work hours configuration updates for calendar interactions.
 * Single source of truth for work slot CRUD operations.
 * 
 * Architecture:
 * - Pure business logic for work hours management
 * - Used by PlannerView for drag/drop and resize operations
 * - Delegates to settings context for persistence
 */

import { formatTimeForValidation } from '../calculations/general/timeCalculations';
import type { Settings, WorkSlot } from '@/types/core';

export interface WorkHourUpdateResult {
  success: boolean;
  updatedSlots?: WorkSlot[];
  error?: string;
}

export class UnifiedWorkHoursService {
  /**
   * Parse work hour event ID to extract day and slot info
   * Format: settings-{dayName}-{slotId}
   */
  static parseWorkHourId(workHourId: string): { dayName: string; slotId: string } | null {
    const match = workHourId.match(/^settings-(\w+)-([^-]+)$/);
    if (!match) return null;
    
    const [, dayName, slotId] = match;
    return { dayName, slotId };
  }

  /**
   * Update a work slot's time range
   * Single source of truth for work slot updates
   */
  static updateWorkSlotTime(
    settings: Settings | null | undefined,
    workHourId: string,
    newStart: Date,
    newEnd: Date
  ): WorkHourUpdateResult {
    if (!settings?.weeklyWorkHours) {
      return {
        success: false,
        error: 'Work hours configuration not found'
      };
    }

    const parsed = this.parseWorkHourId(workHourId);
    if (!parsed) {
      return {
        success: false,
        error: 'Invalid work hour ID format'
      };
    }

    const { dayName, slotId } = parsed;
    const weeklyWorkHours = settings.weeklyWorkHours;
    const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];

    // Update the specific slot with new times
    const updatedSlots = daySlots.map(slot => {
      if (slot.id === slotId) {
        const startTime = formatTimeForValidation(newStart);
        const endTime = formatTimeForValidation(newEnd);
        const duration = (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);

        return {
          ...slot,
          startTime,
          endTime,
          duration
        };
      }
      return slot;
    });

    return {
      success: true,
      updatedSlots
    };
  }

  /**
   * Prepare settings update object for a work slot change
   * Returns the full settings object ready for updateSettings()
   */
  static prepareWorkHoursUpdate(
    settings: Settings | null | undefined,
    workHourId: string,
    newStart: Date,
    newEnd: Date
  ): Partial<Settings> | null {
    const result = this.updateWorkSlotTime(settings, workHourId, newStart, newEnd);
    
    if (!result.success || !result.updatedSlots || !settings?.weeklyWorkHours) {
      return null;
    }

    const parsed = this.parseWorkHourId(workHourId);
    if (!parsed) return null;

    const { dayName } = parsed;

    return {
      weeklyWorkHours: {
        ...settings.weeklyWorkHours,
        [dayName]: result.updatedSlots
      }
    };
  }
}
