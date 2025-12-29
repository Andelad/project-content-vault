/**
 * Holiday Business Rules
 *
 * Single source of truth for all holiday-related business logic.
 * Defines validation, constraints, and business rules for holiday entities.
 *
 * This is the domain layer - pure business logic with no external dependencies.
 *
 * @see docs/core/App Logic.md#9-holiday for entity documentation
 * @see docs/core/Business Logic.md for business rules
 */

import type { Holiday } from '@/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface HolidayValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// HOLIDAY BUSINESS RULES
// ============================================================================

/**
 * Holiday Business Rules
 *
 * Centralized location for all holiday-related business logic.
 */
export class HolidayRules {

  // ==========================================================================
  // RULE 1: HOLIDAY TITLE VALIDATION
  // ==========================================================================

  /**
   * RULE 1: Holiday title must be valid
   *
   * Business Logic: Titles must be non-empty and reasonable length
   *
   * @param title - The holiday title to validate
   * @returns true if title is valid, false otherwise
   */
  static validateHolidayTitle(title: string): boolean {
    const trimmed = title.trim();
    return trimmed.length > 0 && trimmed.length <= 200;
  }

  // ==========================================================================
  // RULE 2: DATE RANGE VALIDATION
  // ==========================================================================

  /**
   * RULE 2: Holiday end date must be on or after start date
   *
   * Business Logic: Holidays can be single day or multi-day
   *
   * @param startDate - Holiday start date
   * @param endDate - Holiday end date
   * @returns Validation result
   */
  static validateDateRange(
    startDate: Date,
    endDate: Date
  ): HolidayValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Normalize to midnight for date-only comparison
    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(0, 0, 0, 0);

    if (normalizedEnd < normalizedStart) {
      errors.push('Holiday end date must be on or after start date');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 3: HOLIDAY OVERLAP DETECTION
  // ==========================================================================

  /**
   * RULE 3: Detect if two holidays overlap
   *
   * Business Logic: Holidays can overlap (no constraint), but detection is useful
   *
   * @param holiday1 - First holiday
   * @param holiday2 - Second holiday
   * @returns true if holidays overlap
   */
  static holidaysOverlap(holiday1: Holiday, holiday2: Holiday): boolean {
    const start1 = new Date(holiday1.startDate);
    const end1 = new Date(holiday1.endDate);
    const start2 = new Date(holiday2.startDate);
    const end2 = new Date(holiday2.endDate);

    start1.setHours(0, 0, 0, 0);
    end1.setHours(0, 0, 0, 0);
    start2.setHours(0, 0, 0, 0);
    end2.setHours(0, 0, 0, 0);

    return start1 <= end2 && end1 >= start2;
  }

  // ==========================================================================
  // RULE 4: DATE CONTAINMENT CHECK
  // ==========================================================================

  /**
   * RULE 4: Check if a specific date falls within a holiday
   *
   * Business Logic: Used for capacity calculations and auto-estimate skipping
   *
   * @param date - Date to check
   * @param holiday - Holiday to check against
   * @returns true if date is within holiday period
   */
  static isDateInHoliday(date: Date, holiday: Holiday): boolean {
    const checkDate = new Date(date);
    const startDate = new Date(holiday.startDate);
    const endDate = new Date(holiday.endDate);

    checkDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    return checkDate >= startDate && checkDate <= endDate;
  }

  // ==========================================================================
  // RULE 5: CHECK IF DATE IS A HOLIDAY
  // ==========================================================================

  /**
   * RULE 5: Check if a date is a holiday (any holiday)
   *
   * Business Logic: Used for working day calculations
   * Holidays override work slots (no capacity on holidays)
   *
   * @param date - Date to check
   * @param holidays - All holidays
   * @returns true if date is a holiday
   */
  static isHoliday(date: Date, holidays: Holiday[]): boolean {
    return holidays.some(holiday => this.isDateInHoliday(date, holiday));
  }

  // ==========================================================================
  // RULE 6: HOLIDAY DURATION CALCULATION
  // ==========================================================================

  /**
   * RULE 6: Calculate number of days in holiday
   *
   * Business Logic: Includes both start and end dates
   *
   * @param startDate - Holiday start date
   * @param endDate - Holiday end date
   * @returns Number of days (inclusive)
   */
  static calculateDurationDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
  }

  // ==========================================================================
  // RULE 7: COMPREHENSIVE HOLIDAY VALIDATION
  // ==========================================================================

  /**
   * RULE 7: Validate all holiday properties
   *
   * Combines all validation rules for a complete check
   *
   * @param params - Holiday parameters to validate
   * @returns Validation result
   */
  static validateHoliday(params: {
    title: string;
    startDate: Date;
    endDate: Date;
  }): HolidayValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Rule 1: Title must be valid
    if (!this.validateHolidayTitle(params.title)) {
      errors.push('Holiday title must be between 1 and 200 characters');
    }

    // Rule 2: Date range must be valid
    const dateRangeValidation = this.validateDateRange(params.startDate, params.endDate);
    errors.push(...dateRangeValidation.errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 8: HOLIDAY OVERLAP WARNING
  // ==========================================================================

  /**
   * RULE 8: Check for overlapping holidays (informational)
   *
   * Business Logic: Overlaps are allowed but may be unintentional
   *
   * @param newHoliday - Holiday being created/updated
   * @param existingHolidays - All existing holidays
   * @param currentHolidayId - ID of holiday being edited (optional)
   * @returns Validation result with warnings
   */
  static checkHolidayOverlaps(
    newHoliday: { startDate: Date; endDate: Date; title: string },
    existingHolidays: Holiday[],
    currentHolidayId?: string
  ): HolidayValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const overlappingHolidays = existingHolidays.filter(existing => {
      // Skip the holiday being edited
      if (existing.id === currentHolidayId) return false;

      return this.holidaysOverlap(
        { ...newHoliday, id: '', notes: '' },
        existing
      );
    });

    if (overlappingHolidays.length > 0) {
      const holidayNames = overlappingHolidays.map(h => `"${h.title}"`).join(', ');
      warnings.push(`This holiday overlaps with: ${holidayNames}`);
    }

    return {
      isValid: true, // Overlaps are warnings, not errors
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 9: DATE RANGE OVERLAP CHECK
  // ==========================================================================

  /**
   * RULE 9: Check if holiday overlaps with a date range
   *
   * Business Logic: Used for auto-estimate calculations
   *
   * @param holiday - Holiday to check
   * @param rangeStart - Range start date
   * @param rangeEnd - Range end date
   * @returns true if holiday overlaps with range
   */
  static overlapsDateRange(
    holiday: Holiday,
    rangeStart: Date,
    rangeEnd: Date
  ): boolean {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);

    holidayStart.setHours(0, 0, 0, 0);
    holidayEnd.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return holidayStart <= end && holidayEnd >= start;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Check if holiday is a single day
   *
   * @param holiday - Holiday to check
   * @returns true if single day holiday
   */
  static isSingleDay(holiday: Holiday): boolean {
    const start = new Date(holiday.startDate);
    const end = new Date(holiday.endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return start.getTime() === end.getTime();
  }

  /**
   * Get all dates in a holiday as an array
   *
   * @param holiday - Holiday to get dates from
   * @returns Array of dates
   */
  static getHolidayDates(holiday: Holiday): Date[] {
    const dates: Date[] = [];
    const current = new Date(holiday.startDate);
    const end = new Date(holiday.endDate);

    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Format date range for display
   *
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Formatted string (e.g., "Dec 25, 2025" or "Dec 25-27, 2025")
   */
  static formatDateRange(startDate: Date, endDate: Date): string {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    };

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start.getTime() === end.getTime()) {
      return start.toLocaleDateString('en-US', options);
    }

    const startStr = start.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
    const endStr = end.toLocaleDateString('en-US', options);

    return `${startStr} - ${endStr}`;
  }
}
