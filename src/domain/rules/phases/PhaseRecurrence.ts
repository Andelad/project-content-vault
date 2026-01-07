/**
 * PhaseRecurrenceService
 * 
 * Domain Service for Phase Recurrence Logic using RRule (RFC 5545)
 * 
 * Purpose:
 * - Convert UI recurrence config to RFC 5545 RRule format
 * - Generate occurrence dates from RRule strings
 * - Validate RRule configurations
 * - Pure domain logic (no persistence, no UI)
 * 
 * Domain Services vs Application Services:
 * - Domain Services: Pure domain logic that doesn't naturally fit in a single entity
 * - Application Services (Orchestrators): Coordinate entities, persistence, external dependencies
 * 
 * This service contains the "what" (recurring business rules) not the "how" (persistence).
 * 
 * RRule Integration:
 * - Uses rrule.js library for RFC 5545 standard recurrence rules
 * - Supports infinite recurrence (no hardcoded limits for continuous projects)
 * - Same pattern used successfully for events and work hours
 */

import { RRule, Frequency, Weekday, rrulestr } from 'rrule';
import type { RecurringConfig } from '@/types/core';

export interface RecurringPhaseConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weeklyDayOfWeek?: number; // 0-6 (Sunday-Saturday)
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number; // 1-31
  monthlyWeekOfMonth?: number; // 1-4
  monthlyDayOfWeek?: number; // 0-6
  rrule?: string; // RFC 5545 format (preferred)
}

export interface RecurringValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface RecurringOccurrenceParams {
  config: RecurringPhaseConfig;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous?: boolean;
  maxOccurrences?: number; // Safety limit (only for non-continuous)
}

export interface RecurringOccurrence {
  occurrenceNumber: number;
  date: Date;
}


/**
 * PhaseRecurrenceService
 * 
 * Pure domain logic for recurring phase patterns using RRule.js.
 * No dependencies on Supabase, React, or other external systems.
 */
export class PhaseRecurrenceService {
  private static readonly DEFAULT_MAX_OCCURRENCES = 365; // Safety limit for non-continuous projects
  private static readonly VALID_TYPES = ['daily', 'weekly', 'monthly'] as const;

  // ============================================================================
  // RRULE GENERATION
  // ============================================================================

  /**
   * Generate RFC 5545 RRule string from RecurringConfig
   * 
   * Converts UI-friendly config to industry-standard RRule format.
   * 
   * @param config - UI recurrence configuration
   * @param startDate - Start date for recurrence
   * @param endDate - End date for recurrence (optional for continuous)
   * @param isContinuous - Whether project is continuous (infinite recurrence)
   * @returns RFC 5545 RRule string
   */
  static generateRRuleFromConfig(
    config: RecurringConfig,
    startDate: Date,
    endDate?: Date,
    isContinuous: boolean = false
  ): string {
    // If rrule already exists, check if it matches the continuous status
    // If continuous status changed, we need to regenerate (add/remove UNTIL)
    if (config.rrule) {
      const validation = this.validateRRule(config.rrule);
      if (validation.isValid) {
        const hasUntil = config.rrule.includes('UNTIL');
        const shouldHaveUntil = !isContinuous && endDate;
        
        // Only reuse if UNTIL status matches continuous flag
        if ((hasUntil && shouldHaveUntil) || (!hasUntil && !shouldHaveUntil)) {
          return config.rrule;
        }
        // Otherwise fall through to regenerate
      }
    }

    // Convert type to RRule frequency
    const freq = this.getFrequencyFromType(config.type);

    // Build RRule options
    const options: any = {
      freq,
      interval: config.interval || 1,
      dtstart: startDate,
    };

    // Add end date for non-continuous projects
    if (!isContinuous && endDate) {
      options.until = endDate;
    }

    // Add type-specific options
    switch (config.type) {
      case 'weekly':
        if (config.weeklyDayOfWeek !== undefined) {
          options.byweekday = [this.getWeekdayFromNumber(config.weeklyDayOfWeek)];
        }
        break;

      case 'monthly':
        if (config.monthlyPattern === 'date' && config.monthlyDate) {
          options.bymonthday = config.monthlyDate;
        } else if (
          config.monthlyPattern === 'dayOfWeek' &&
          config.monthlyWeekOfMonth !== undefined &&
          config.monthlyDayOfWeek !== undefined
        ) {
          const weekday = this.getWeekdayFromNumber(config.monthlyDayOfWeek);
          options.byweekday = [weekday.nth(config.monthlyWeekOfMonth)];
        }
        break;
    }

    const rrule = new RRule(options);
    return rrule.toString();
  }

  /**
   * Generate occurrence dates from RRule string
   * 
   * @param rruleString - RFC 5545 RRule string
   * @param startDate - Start date for range
   * @param endDate - End date for range (optional for continuous)
   * @param maxOccurrences - Maximum number of occurrences to return
   * @returns Array of occurrence objects
   */
  static generateOccurrencesFromRRule(
    rruleString: string,
    startDate: Date,
    endDate?: Date,
    maxOccurrences?: number
  ): RecurringOccurrence[] {
    try {
      const rrule = rrulestr(rruleString);
      
      // Generate dates within range
      let dates: Date[];
      if (endDate) {
        dates = rrule.between(startDate, endDate, true);
      } else {
        // Continuous projects: generate a rolling window around "now" so long-running
        // projects that started years ago still produce upcoming occurrences.
        // We fetch occurrences from (now - 1 year) through (now + 2 years) and
        // then cap to a sane limit for UI performance.
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const now = new Date();
        const windowStart = new Date(Math.max(startDate.getTime(), now.getTime() - 365 * MS_PER_DAY));
        const windowEnd = new Date(now.getTime() + 730 * MS_PER_DAY);

        dates = rrule.between(windowStart, windowEnd, true);

        // Fallback: if nothing falls in the window (e.g., very infrequent rules),
        // fall back to the first N occurrences from the start date.
        const fallbackLimit = maxOccurrences || 200;
        if (dates.length === 0) {
          dates = rrule.all((_, len) => len < fallbackLimit);
        } else {
          dates = dates.slice(0, fallbackLimit);
        }
      }

      // Apply max occurrences limit if specified (non-continuous already capped above)
      const limitedDates = maxOccurrences ? dates.slice(0, maxOccurrences) : dates;

      // Convert to RecurringOccurrence format
      return limitedDates.map((date, index) => ({
        occurrenceNumber: index + 1,
        date: new Date(date)
      }));
    } catch (error) {
      console.error('Error generating occurrences from RRule:', error);
      return [];
    }
  }

  /**
   * Validate RRule string format
   * 
   * @param rruleString - RFC 5545 RRule string to validate
   * @returns Validation result
   */
  static validateRRule(rruleString: string): RecurringValidationResult {
    const errors: string[] = [];

    try {
      rrulestr(rruleString);
      return { isValid: true, errors: [] };
    } catch (error) {
      errors.push(`Invalid RRule format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors };
    }
  }

  // ============================================================================
  // VALIDATION (Legacy - for backward compatibility)
  // ============================================================================

  /**
   * Validate recurring phase configuration
   * 
   * Business Rules:
   * - Pattern type must be daily, weekly, or monthly
   * - Interval must be positive integer
   * - Type-specific fields must be present and valid
   * - Time allocation must be positive
   * 
   * @param isRecurring - Whether phase is recurring
   * @param config - Recurrence pattern configuration
   * @param timeAllocationHours - Hours per occurrence
   * @returns Validation result with errors
   */
  static validateRecurringConfig(
    isRecurring: boolean,
    config: RecurringPhaseConfig | undefined,
    timeAllocationHours: number
  ): RecurringValidationResult {
    const errors: string[] = [];

    // Non-recurring phases don't need validation
    if (!isRecurring) {
      return { isValid: true, errors: [] };
    }

    // Recurring phases must have configuration
    if (!config) {
      errors.push('Recurring phase must have recurrence configuration');
      return { isValid: false, errors };
    }

    // If RRule is present, validate it
    if (config.rrule) {
      return this.validateRRule(config.rrule);
    }

    // Validate pattern type
    if (!this.VALID_TYPES.includes(config.type)) {
      errors.push(`Invalid recurrence type: ${config.type}. Must be daily, weekly, or monthly`);
    }

    // Validate interval
    if (!config.interval || config.interval < 1) {
      errors.push('Recurrence interval must be at least 1');
    }

    // Validate weekly-specific fields
    if (config.type === 'weekly') {
      if (config.weeklyDayOfWeek === undefined) {
        errors.push('Weekly recurrence must specify day of week (0-6)');
      } else if (config.weeklyDayOfWeek < 0 || config.weeklyDayOfWeek > 6) {
        errors.push('Weekly day of week must be between 0 (Sunday) and 6 (Saturday)');
      }
    }

    // Validate monthly-specific fields
    if (config.type === 'monthly') {
      if (!config.monthlyPattern) {
        errors.push('Monthly recurrence must specify pattern (date or dayOfWeek)');
      } else if (config.monthlyPattern === 'date') {
        if (!config.monthlyDate) {
          errors.push('Monthly date pattern must specify date (1-31)');
        } else if (config.monthlyDate < 1 || config.monthlyDate > 31) {
          errors.push('Monthly date must be between 1 and 31');
        }
      } else if (config.monthlyPattern === 'dayOfWeek') {
        if (config.monthlyWeekOfMonth === undefined || config.monthlyDayOfWeek === undefined) {
          errors.push('Monthly dayOfWeek pattern must specify week of month and day of week');
        } else {
          if (config.monthlyWeekOfMonth < 1 || config.monthlyWeekOfMonth > 4) {
            errors.push('Monthly week of month must be between 1 and 4');
          }
          if (config.monthlyDayOfWeek < 0 || config.monthlyDayOfWeek > 6) {
            errors.push('Monthly day of week must be between 0 (Sunday) and 6 (Saturday)');
          }
        }
      }
    }

    // Validate time allocation
    if (timeAllocationHours <= 0) {
      errors.push('Recurring phase must have positive time allocation per occurrence');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ============================================================================
  // OCCURRENCE CALCULATION (Updated to use RRule)
  // ============================================================================

  /**
   * Calculate number of occurrences for a recurring phase
   * 
   * Business Rules:
   * - First occurrence is day after project start
   * - Last occurrence is day before project end (or unlimited for continuous)
   * - Respects interval between occurrences
   * 
   * @param params - Occurrence calculation parameters
   * @returns Number of occurrences
   */
  static calculateOccurrenceCount(params: RecurringOccurrenceParams): number {
    const occurrences = this.generateOccurrences(params);
    return occurrences.length;
  }

  /**
   * Calculate total time allocation for all occurrences
   * 
   * @param params - Occurrence calculation parameters
   * @param timePerOccurrence - Hours allocated per occurrence
   * @returns Total hours across all occurrences
   */
  static calculateTotalAllocation(params: RecurringOccurrenceParams, timePerOccurrence: number): number {
    const count = this.calculateOccurrenceCount(params);
    return count * timePerOccurrence;
  }

  /**
   * Generate all occurrence dates for a recurring phase using RRule
   * 
   * Business Rules:
   * - Start from day after project start
   * - End day before project end (or unlimited for continuous)
   * - Use RRule for accurate recurrence calculation
   * - Respect max occurrences safety limit for non-continuous
   * 
   * @param params - Occurrence generation parameters
   * @returns Array of occurrence dates
   */
  static generateOccurrences(params: RecurringOccurrenceParams): RecurringOccurrence[] {
    const { config, projectStartDate, projectEndDate, projectContinuous = false, maxOccurrences } = params;

    // Start from project start date (not day after)
    // The RRule will find the first matching occurrence on or after this date
    const startDate = new Date(projectStartDate);

    // Calculate end date (day before project end, or undefined for continuous)
    let endDate: Date | undefined;
    if (!projectContinuous) {
      endDate = new Date(projectEndDate);
      endDate.setDate(endDate.getDate() - 1);
    }

    // Always regenerate RRule to ensure it matches current project continuous status
    // This handles cases where project was toggled between continuous/non-continuous
    const rruleString = this.generateRRuleFromConfig(config, startDate, endDate, projectContinuous);
    return this.generateOccurrencesFromRRule(
      rruleString,
      startDate,
      endDate,
      maxOccurrences || (projectContinuous ? undefined : this.DEFAULT_MAX_OCCURRENCES)
    );
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Convert recurrence type to RRule frequency
   */
  private static getFrequencyFromType(type: string): Frequency {
    switch (type) {
      case 'daily':
        return RRule.DAILY;
      case 'weekly':
        return RRule.WEEKLY;
      case 'monthly':
        return RRule.MONTHLY;
      default:
        return RRule.DAILY;
    }
  }

  /**
   * Convert day number to RRule Weekday
   * 
   * @param dayNum - Day of week (0-6, Sunday-Saturday)
   * @returns RRule Weekday object
   */
  private static getWeekdayFromNumber(dayNum: number): Weekday {
    const weekdays = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
    return weekdays[dayNum] || RRule.MO;
  }

  /**
   * Check if a recurring configuration would generate too many occurrences
   * 
   * @param params - Occurrence calculation parameters
   * @param warningThreshold - Threshold to trigger warning (default 50)
   * @returns True if occurrence count exceeds threshold
   */
  static hasExcessiveOccurrences(params: RecurringOccurrenceParams, warningThreshold: number = 50): boolean {
    const count = this.calculateOccurrenceCount(params);
    return count >= warningThreshold;
  }

  /**
   * Get human-readable description of recurrence pattern
   * 
   * @param config - Recurrence configuration
   * @returns Description string (e.g., "Every 2 weeks on Monday")
   */
  static getRecurrenceDescription(config: RecurringPhaseConfig): string {
    const { type, interval } = config;
    const intervalText = interval === 1 ? '' : `${interval} `;

    switch (type) {
      case 'daily':
        return `Every ${intervalText}day${interval > 1 ? 's' : ''}`;

      case 'weekly': {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = config.weeklyDayOfWeek !== undefined ? dayNames[config.weeklyDayOfWeek] : 'week';
        return `Every ${intervalText}week${interval > 1 ? 's' : ''} on ${dayName}`;
      }

      case 'monthly': {
        if (config.monthlyPattern === 'date' && config.monthlyDate) {
          const suffix = this.getOrdinalSuffix(config.monthlyDate);
          return `Every ${intervalText}month${interval > 1 ? 's' : ''} on the ${config.monthlyDate}${suffix}`;
        } else if (config.monthlyPattern === 'dayOfWeek' && 
                   config.monthlyWeekOfMonth !== undefined && 
                   config.monthlyDayOfWeek !== undefined) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const weekNames = ['1st', '2nd', '3rd', '4th'];
          const dayName = dayNames[config.monthlyDayOfWeek];
          const weekName = weekNames[config.monthlyWeekOfMonth - 1];
          return `Every ${intervalText}month${interval > 1 ? 's' : ''} on the ${weekName} ${dayName}`;
        }
        return `Every ${intervalText}month${interval > 1 ? 's' : ''}`;
      }

      default:
        return 'Unknown recurrence pattern';
    }
  }

  /**
   * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
   */
  private static getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }
}
