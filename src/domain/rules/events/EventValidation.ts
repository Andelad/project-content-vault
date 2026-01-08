/**
 * Calendar Event Business Rules
 *
 * Single source of truth for all calendar event-related business logic.
 * Defines validation, constraints, and business rules for calendar event entities.
 *
 * This is the domain layer - pure business logic with no external dependencies.
 *
 * Note: EventClassificationRules handles event classification (planned vs completed).
 * This file handles event validation and constraints.
 *
 * @see docs/core/App Logic.md#7-calendar-event for entity documentation
 * @see docs/core/Business Logic.md for business rules
 * @see EventClassificationRules for event time classification
 */

import type { CalendarEvent } from '@/types/core';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CalendarEventValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type EventCategory = 'event' | 'habit' | 'task';

// ============================================================================
// CALENDAR EVENT BUSINESS RULES
// ============================================================================

/**
 * Calendar Event Business Rules
 *
 * Centralized location for all calendar event-related business logic.
 */
export class CalendarEventRules {

  // ==========================================================================
  // RULE 1: EVENT TITLE VALIDATION
  // ==========================================================================

  /**
   * RULE 1: Event title must be valid
   *
   * Business Logic: Titles must be non-empty and reasonable length
   *
   * @param title - The event title to validate
   * @returns true if title is valid, false otherwise
   */
  static validateEventTitle(title: string): boolean {
    const trimmed = title.trim();
    return trimmed.length > 0 && trimmed.length <= 200;
  }

  // ==========================================================================
  // RULE 2: EVENT TIME RANGE VALIDATION
  // ==========================================================================

  /**
   * RULE 2: Event end time must be after start time (except tasks)
   *
   * Business Logic: Events must have valid time ranges
   * Exception: Tasks have no duration (startTime === endTime)
   *
   * @param startTime - Event start time
   * @param endTime - Event end time
   * @param category - Event category
   * @returns true if time range is valid
   */
  static validateEventTimeRange(
    startTime: Date,
    endTime: Date,
    category: EventCategory = 'event'
  ): boolean {
    // Tasks must have same start and end time (no duration)
    if (category === 'task') {
      return startTime.getTime() === endTime.getTime();
    }

    // Events and habits must have end after start
    return endTime > startTime;
  }

  // ==========================================================================
  // RULE 3: PROJECT LINKING CONSTRAINTS
  // ==========================================================================

  /**
   * RULE 3: Habits and tasks cannot be linked to projects
   *
   * Business Logic: Only 'event' category can count toward project time
   * Habits and tasks are separate from project work
   *
   * @param projectId - The project ID (if any)
   * @param category - Event category
   * @returns Validation result
   */
  static validateProjectLinking(
    projectId: string | undefined,
    category: EventCategory
  ): CalendarEventValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if ((category === 'habit' || category === 'task') && projectId) {
      errors.push(
        `${category === 'habit' ? 'Habits' : 'Tasks'} cannot be linked to projects`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 4: TASK-SPECIFIC VALIDATION
  // ==========================================================================

  /**
   * RULE 4: Tasks must have no duration
   *
   * Business Logic: Tasks are displayed as checkboxes, not time blocks
   *
   * @param startTime - Task start time
   * @param endTime - Task end time
   * @returns Validation result
   */
  static validateTaskDuration(
    startTime: Date,
    endTime: Date
  ): CalendarEventValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (startTime.getTime() !== endTime.getTime()) {
      errors.push('Tasks cannot have duration - start and end time must be the same');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 5: COLOR VALIDATION
  // ==========================================================================

  /**
   * RULE 5: Event color must be valid hex format
   *
   * Business Logic: Colors must be valid hex codes for consistent display
   *
   * @param color - The color to validate
   * @returns true if color is valid hex format
   */
  static validateEventColor(color: string): boolean {
    // Accepts #RGB or #RRGGBB format
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color.trim());
  }

  // ==========================================================================
  // RULE 6: COMPREHENSIVE EVENT VALIDATION
  // ==========================================================================

  /**
   * RULE 6: Validate all calendar event properties
   *
   * Combines all validation rules for a complete check
   *
   * @param params - Event parameters to validate
   * @returns Validation result
   */
  static validateCalendarEvent(params: {
    title: string;
    startTime: Date;
    endTime: Date;
    projectId?: string;
    color: string;
    category?: EventCategory;
  }): CalendarEventValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const category = params.category ?? 'event';

    // Rule 1: Title must be valid
    if (!this.validateEventTitle(params.title)) {
      errors.push('Event title must be between 1 and 200 characters');
    }

    // Rule 2: Time range must be valid
    if (!this.validateEventTimeRange(params.startTime, params.endTime, category)) {
      if (category === 'task') {
        errors.push('Tasks cannot have duration - start and end time must be the same');
      } else {
        errors.push('Event end time must be after start time');
      }
    }

    // Rule 3: Project linking constraints
    const projectLinkingValidation = this.validateProjectLinking(params.projectId, category);
    errors.push(...projectLinkingValidation.errors);

    // Rule 5: Color must be valid
    if (!this.validateEventColor(params.color)) {
      errors.push('Event color must be a valid hex color (e.g., #FF5733)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // ==========================================================================
  // RULE 7: EVENT COUNTS TOWARD PROJECT TIME
  // ==========================================================================

  /**
   * RULE 7: Determine if event counts toward project time
   *
   * Business Logic: 
   * - Events linked to projects count toward that project's time
   * - Habits NEVER count toward project time (even if legacy data has projectId)
   * - Tasks NEVER count toward project time
   *
   * @param event - The calendar event
   * @returns true if event counts toward project time
   */
  static countsTowardProjectTime(event: CalendarEvent): boolean {
    // Habits and tasks never count toward project time
    if (event.category === 'habit' || event.category === 'task') {
      return false;
    }

    // Events must be linked to a project
    return !!event.projectId;
  }

  // ==========================================================================
  // RULE 8: EVENT DURATION CALCULATION
  // ==========================================================================

  /**
   * RULE 8: Calculate event duration in hours
   *
   * Business Logic: Tasks have zero duration, events calculated from time range
   *
   * @param startTime - Event start time
   * @param endTime - Event end time
   * @param category - Event category
   * @returns Duration in hours
   */
  static calculateEventDuration(
    startTime: Date,
    endTime: Date,
    category: EventCategory = 'event'
  ): number {
    if (category === 'task') {
      return 0;
    }

    const milliseconds = endTime.getTime() - startTime.getTime();
    return milliseconds / (1000 * 60 * 60); // Convert to hours
  }

  // ==========================================================================
  // RULE 9: MIDNIGHT CROSSING DETECTION
  // ==========================================================================

  /**
   * RULE 9: Detect if event crosses midnight
   *
   * Business Logic: Events spanning multiple days may need special handling
   *
   * @param startTime - Event start time
   * @param endTime - Event end time
   * @returns true if event crosses midnight
   */
  static crossesMidnight(startTime: Date, endTime: Date): boolean {
    const startDate = startTime.toDateString();
    const endDate = endTime.toDateString();
    return startDate !== endDate;
  }

  // ==========================================================================
  // RULE 10: EVENT OVERLAP DETECTION
  // ==========================================================================

  /**
   * RULE 10: Check if two events overlap in time
   *
   * Business Logic: Detect scheduling conflicts
   *
   * @param event1Start - First event start time
   * @param event1End - First event end time
   * @param event2Start - Second event start time
   * @param event2End - Second event end time
   * @returns true if events overlap
   */
  static eventsOverlap(
    event1Start: Date,
    event1End: Date,
    event2Start: Date,
    event2End: Date
  ): boolean {
    return event1Start < event2End && event1End > event2Start;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get event category display name
   *
   * @param category - Event category
   * @returns Display name
   */
  static getCategoryDisplayName(category: EventCategory): string {
    const names: Record<EventCategory, string> = {
      event: 'Event',
      habit: 'Habit',
      task: 'Task'
    };
    return names[category];
  }

  /**
   * Check if category allows project linking
   *
   * @param category - Event category
   * @returns true if category can be linked to projects
   */
  static canLinkToProject(category: EventCategory): boolean {
    return category === 'event';
  }

  // ==========================================================================
  // RULE 11: RECURRING EVENT VALIDATION
  // ==========================================================================

  /**
   * RULE 11: Recurring event configuration must be valid
   *
   * Business Logic:
   * - Interval must be >= 1
   * - If endType is 'date', endDate must be provided and after start
   * - If endType is 'count', count must be >= 1
   * - Monthly recurring needs proper pattern configuration
   *
   * @param recurringConfig - Recurring event configuration
   * @param startDate - Event start date
   * @returns Validation result with specific errors
   */
  static validateRecurringEvent(
    recurringConfig: {
      type: 'daily' | 'weekly' | 'monthly' | 'yearly';
      interval: number;
      endType: 'never' | 'date' | 'count';
      endDate?: string;
      count?: number;
      monthlyPattern?: 'date' | 'dayOfWeek';
      monthlyDate?: number;
      monthlyWeekOfMonth?: number;
      monthlyDayOfWeek?: number;
    },
    startDate: Date
  ): {
    isValid: boolean;
    errors: Record<string, string>;
  } {
    const errors: Record<string, string> = {};

    // Validate interval
    if (recurringConfig.interval < 1) {
      errors.recurringInterval = 'Interval must be at least 1';
    }

    // Validate endType: 'date'
    if (recurringConfig.endType === 'date') {
      if (!recurringConfig.endDate) {
        errors.recurringEndDate = 'End date is required for recurring events';
      } else {
        const endDate = new Date(recurringConfig.endDate);
        if (endDate <= startDate) {
          errors.recurringEndDate = 'End date must be after start date';
        }
      }
    }

    // Validate endType: 'count'
    if (recurringConfig.endType === 'count') {
      if (!recurringConfig.count || recurringConfig.count < 1) {
        errors.recurringCount = 'Count must be at least 1';
      }
    }

    // Validate monthly pattern
    if (recurringConfig.type === 'monthly') {
      if (recurringConfig.monthlyPattern === 'date') {
        if (!recurringConfig.monthlyDate || recurringConfig.monthlyDate < 1 || recurringConfig.monthlyDate > 31) {
          errors.monthlyDate = 'Monthly date must be between 1 and 31';
        }
      } else if (recurringConfig.monthlyPattern === 'dayOfWeek') {
        if (recurringConfig.monthlyWeekOfMonth === undefined || 
            recurringConfig.monthlyWeekOfMonth < 1 || 
            recurringConfig.monthlyWeekOfMonth > 5) {
          errors.monthlyWeekOfMonth = 'Week of month must be between 1 and 5';
        }
        if (recurringConfig.monthlyDayOfWeek === undefined || 
            recurringConfig.monthlyDayOfWeek < 0 || 
            recurringConfig.monthlyDayOfWeek > 6) {
          errors.monthlyDayOfWeek = 'Day of week must be between 0 (Sunday) and 6 (Saturday)';
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * RULE 12: Validate recurring event series modification
   *
   * Business Logic:
   * - Modifying a single instance should not break the series
   * - Series-wide changes require series ID
   * - Cannot change recurring to non-recurring mid-series
   *
   * @param isSeriesModification - Whether modifying entire series
   * @param seriesId - Recurring series ID
   * @param currentRecurring - Current recurring status
   * @param newRecurring - New recurring status
   * @returns Validation result
   */
  static validateRecurringSeriesModification(
    isSeriesModification: boolean,
    seriesId: string | null | undefined,
    currentRecurring: boolean,
    newRecurring: boolean
  ): {
    isValid: boolean;
    error?: string;
  } {
    // Changing recurring status requires series modification
    if (currentRecurring !== newRecurring && !isSeriesModification) {
      return {
        isValid: false,
        error: 'Cannot change recurring status for a single instance. Modify the entire series instead.'
      };
    }

    // Series modifications require a valid series ID
    if (isSeriesModification && currentRecurring && !seriesId) {
      return {
        isValid: false,
        error: 'Cannot modify series: missing series ID'
      };
    }

    return { isValid: true };
  }
}
