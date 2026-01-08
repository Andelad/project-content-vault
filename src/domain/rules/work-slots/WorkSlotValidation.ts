/**
 * Work Slot Business Rules
 *
 * Single source of truth for all work slot-related business logic.
 * Defines validation, constraints, and business rules for work slot entities.
 *
 * This is the domain layer - pure business logic with no external dependencies.
 *
 * @see docs/core/App Logic.md#8-work-slot for entity documentation
 * @see docs/core/Business Logic.md for business rules
 */

import type { WorkSlot } from '@/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WorkSlotValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

// ============================================================================
// WORK SLOT BUSINESS RULES
// ============================================================================

/**
 * Work Slot Business Rules
 *
 * Centralized location for all work slot-related business logic.
 */
export class WorkSlotRules {

  // ==========================================================================
  // RULE 1: TIME FORMAT VALIDATION
  // ==========================================================================

  /**
   * RULE 1: Work slot times must be in valid HH:MM format
   *
   * Business Logic: Times must be in 24-hour HH:MM format (00:00 to 23:59)
   *
   * @param time - The time string to validate
   * @returns true if time is valid HH:MM format
   */
  static validateTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  // ==========================================================================
  // RULE 2: MIDNIGHT CROSSING PREVENTION
  // ==========================================================================

  /**
   * RULE 2: Work slots CANNOT cross midnight (must be within a single day)
   *
   * Business Logic: Each work slot represents availability within one calendar day
   * Multi-day work periods should be represented as separate slots per day
   *
   * @param startTime - Start time in HH:MM format
   * @param endTime - End time in HH:MM format
   * @returns Validation result
   */
  static validateNoMidnightCrossing(
    startTime: string,
    endTime: string
  ): WorkSlotValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    // End time wrapping around (like 23:00 to 01:00) indicates midnight crossing
    if (endMinutes < startMinutes) {
      errors.push('Work slots cannot cross midnight (must be within a single day)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 3: TIME RANGE VALIDATION
  // ==========================================================================

  /**
   * RULE 3: End time must be after start time
   *
   * Business Logic: Work slots must have positive duration
   *
   * @param startTime - Start time in HH:MM format
   * @param endTime - End time in HH:MM format
   * @returns Validation result
   */
  static validateTimeRange(
    startTime: string,
    endTime: string
  ): WorkSlotValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      errors.push('End time must be after start time');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 4: DURATION CALCULATION
  // ==========================================================================

  /**
   * RULE 4: Calculate work slot duration
   *
   * Business Logic: Duration supports 15-minute increments
   *
   * @param startTime - Start time in HH:MM format
   * @param endTime - End time in HH:MM format
   * @returns Duration in hours (decimal)
   */
  static calculateDuration(startTime: string, endTime: string): number {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    const durationMinutes = endMinutes - startMinutes;
    return durationMinutes / 60; // Convert to hours
  }

  // ==========================================================================
  // RULE 5: WORK SLOT OVERLAP DETECTION
  // ==========================================================================

  /**
   * RULE 5: Detect if two work slots overlap
   *
   * Business Logic: Multiple slots can exist on same day if they don't overlap
   * (e.g., morning + afternoon with lunch break)
   *
   * @param slot1 - First work slot
   * @param slot2 - Second work slot
   * @returns true if slots overlap
   */
  static workSlotsOverlap(slot1: WorkSlot, slot2: WorkSlot): boolean {
    const start1 = this.timeToMinutes(slot1.startTime);
    const end1 = this.timeToMinutes(slot1.endTime);
    const start2 = this.timeToMinutes(slot2.startTime);
    const end2 = this.timeToMinutes(slot2.endTime);

    return start1 < end2 && end1 > start2;
  }

  // ==========================================================================
  // RULE 6: DAY WORK SLOTS VALIDATION
  // ==========================================================================

  /**
   * RULE 6: Validate all work slots for a specific day
   *
   * Business Logic: Checks for overlaps and validates each slot
   *
   * @param slots - Work slots for a day
   * @returns Validation result
   */
  static validateDayWorkSlots(slots: WorkSlot[]): WorkSlotValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate each slot individually
    for (const slot of slots) {
      const formatValidation = this.validateWorkSlot(slot.startTime, slot.endTime);
      errors.push(...formatValidation.errors);
    }

    // Check for overlaps between slots
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (this.workSlotsOverlap(slots[i], slots[j])) {
          errors.push(
            `Work slots overlap: ${slots[i].startTime}-${slots[i].endTime} and ` +
            `${slots[j].startTime}-${slots[j].endTime}`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 7: COMPREHENSIVE WORK SLOT VALIDATION
  // ==========================================================================

  /**
   * RULE 7: Validate all work slot properties
   *
   * Combines all validation rules for a complete check
   *
   * @param startTime - Start time in HH:MM format
   * @param endTime - End time in HH:MM format
   * @returns Validation result
   */
  static validateWorkSlot(
    startTime: string,
    endTime: string
  ): WorkSlotValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: Times must be valid format
    if (!this.validateTimeFormat(startTime)) {
      errors.push('Start time must be in HH:MM format (e.g., "09:00")');
    }
    if (!this.validateTimeFormat(endTime)) {
      errors.push('End time must be in HH:MM format (e.g., "17:00")');
    }

    // Only proceed if formats are valid
    if (errors.length > 0) {
      return { isValid: false, errors, warnings };
    }

    // Rule 3: End time must be after start time
    const timeRangeValidation = this.validateTimeRange(startTime, endTime);
    errors.push(...timeRangeValidation.errors);

    // Rule 2: No midnight crossing
    const midnightValidation = this.validateNoMidnightCrossing(startTime, endTime);
    errors.push(...midnightValidation.errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 8: TOTAL DAY HOURS CALCULATION
  // ==========================================================================

  /**
   * RULE 8: Calculate total work hours for a day
   *
   * Business Logic: Sum of all slot durations for a specific day
   *
   * @param slots - Work slots for a day
   * @returns Total hours
   */
  static calculateDayTotalHours(slots: WorkSlot[]): number {
    return slots.reduce((total, slot) => total + slot.duration, 0);
  }

  // ==========================================================================
  // RULE 9: WORKING DAY DETERMINATION
  // ==========================================================================

  /**
   * RULE 9: Determine if a day is a working day based on work slots
   *
   * Business Logic: A day with at least one work slot = working day
   * 
   * Note: This is work-slot-specific logic (checks if slots exist).
   * For general calendar working day checks (weekends/holidays), 
   * use utils/dateCalculations.isWorkingDay instead.
   *
   * @param slots - Work slots for a day
   * @returns true if day has work hours
   */
  static isWorkingDay(slots: WorkSlot[]): boolean {
    return Array.isArray(slots) && 
           slots.length > 0 && 
           this.calculateDayTotalHours(slots) > 0;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Convert time string to minutes since midnight
   *
   * @param time - Time in HH:MM format
   * @returns Minutes since midnight
   */
  static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string
   *
   * @param minutes - Minutes since midnight
   * @returns Time in HH:MM format
   */
  static minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Format time range for display
   *
   * @param startTime - Start time in HH:MM format
   * @param endTime - End time in HH:MM format
   * @returns Formatted string (e.g., "09:00 - 17:00")
   */
  static formatTimeRange(startTime: string, endTime: string): string {
    return `${startTime} - ${endTime}`;
  }

  /**
   * Check if work slot is a full day (8+ hours)
   *
   * @param slot - Work slot to check
   * @returns true if slot is 8 or more hours
   */
  static isFullDaySlot(slot: WorkSlot): boolean {
    return slot.duration >= 8;
  }

  /**
   * Check if work slot is a half day (4-7.99 hours)
   *
   * @param slot - Work slot to check
   * @returns true if slot is between 4 and 8 hours
   */
  static isHalfDaySlot(slot: WorkSlot): boolean {
    return slot.duration >= 4 && slot.duration < 8;
  }
}
