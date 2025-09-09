/**
 * Calendar Event Validator
 * 
 * Provides comprehensive validation for calendar events following
 * standardized validation patterns. Coordinates domain rules with
 * business logic and external constraints.
 * 
 * @module CalendarEventValidator
 */

import type { 
  CalendarEvent, 
  Project, 
  WorkHour, 
  Settings 
} from '@/types/core';

import { 
  calculateDurationHours 
} from '../calculations/dateCalculations';

// =====================================================================================
// VALIDATION INTERFACES
// =====================================================================================

export interface CalendarEventValidationContext {
  existingEvents: CalendarEvent[];
  workHours: WorkHour[];
  projects: Project[];
  settings: Settings;
  repository?: any; // ICalendarEventRepository when available
}

export interface DetailedCalendarEventValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
  context: {
    durationAnalysis?: {
      plannedDuration: number;
      minimumViableDuration: number;
      isViableDuration: boolean;
    };
    conflictAnalysis?: {
      conflictingEvents: CalendarEvent[];
      conflictingWorkHours: WorkHour[];
      overlapMinutes: number;
    };
    businessRuleAnalysis?: {
      isWithinBusinessHours: boolean;
      exceedsMaxDailyHours: boolean;
      violatesMinimumBreaks: boolean;
    };
    recurringAnalysis?: {
      estimatedOccurrences: number;
      totalRecurringHours: number;
      recurringType: string;
      interval: number;
    };
  };
}

export interface CreateCalendarEventValidationRequest {
  title: string;
  startTime: Date;
  endTime: Date;
  projectId?: string;
  type?: 'planned' | 'tracked' | 'completed';
  description?: string;
  isRecurring?: boolean;
}

export interface UpdateCalendarEventValidationRequest {
  id: string;
  title?: string;
  startTime?: Date;
  endTime?: Date;
  projectId?: string;
  type?: 'planned' | 'tracked' | 'completed';
  description?: string;
}

// =====================================================================================
// CALENDAR EVENT VALIDATOR
// =====================================================================================

/**
 * Calendar Event Validator
 * 
 * Provides comprehensive validation by coordinating domain rules
 * with repository data and complex business scenarios.
 */
export class CalendarEventValidator {

  /**
   * Validate calendar event creation with comprehensive checks
   */
  static async validateCalendarEventCreation(
    request: CreateCalendarEventValidationRequest,
    context: CalendarEventValidationContext
  ): Promise<DetailedCalendarEventValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 1. Domain rule validation
    if (!request.title || request.title.trim().length === 0) {
      errors.push('Event title is required');
    }
    
    if (request.startTime >= request.endTime) {
      errors.push('Event start time must be before end time');
    }
    
    if (request.startTime < new Date()) {
      warnings.push('Event is scheduled in the past');
    }

    // 2. Duration analysis
    const durationHours = calculateDurationHours(request.startTime, request.endTime);
    const minimumViableDuration = 0.25; // 15 minutes
    const isViableDuration = durationHours >= minimumViableDuration;

    if (!isViableDuration) {
      errors.push(`Event duration (${durationHours.toFixed(2)} hours) is below minimum viable duration (${minimumViableDuration} hours)`);
    }

    if (durationHours > 8) {
      warnings.push(`Event duration (${durationHours.toFixed(1)} hours) exceeds typical work day length`);
      suggestions.push('Consider splitting this into multiple shorter events');
    }

    // 3. Business rule validation
    // Simple business hours check (9 AM to 6 PM weekdays)
    const startHour = request.startTime.getHours();
    const startDay = request.startTime.getDay();
    const endHour = request.endTime.getHours();
    const endDay = request.endTime.getDay();
    
    const isWeekend = startDay === 0 || startDay === 6 || endDay === 0 || endDay === 6;
    const isOutsideHours = startHour < 9 || startHour > 18 || endHour < 9 || endHour > 18;
    const isWithinBusiness = !isWeekend && !isOutsideHours;

    if (!isWithinBusiness) {
      warnings.push('Event is scheduled outside business hours');
      suggestions.push('Consider adjusting time to align with work schedule');
    }

    // 4. Conflict detection with existing events
    const conflictingEvents = context.existingEvents.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return (request.startTime < eventEnd && request.endTime > eventStart);
    });

    if (conflictingEvents.length > 0) {
      errors.push(`Event conflicts with ${conflictingEvents.length} existing event(s): ${conflictingEvents.map(e => e.title).join(', ')}`);
      suggestions.push('Adjust event time or consider splitting conflicting events');
    }

    // 5. Work hour consistency check
    const conflictingWorkHours = context.workHours.filter(wh => {
      return request.startTime < wh.endTime && request.endTime > wh.startTime;
    });

    let overlapMinutes = 0;
    if (conflictingWorkHours.length > 0) {
      overlapMinutes = conflictingWorkHours.reduce((total, wh) => {
        const overlapStart = new Date(Math.max(request.startTime.getTime(), wh.startTime.getTime()));
        const overlapEnd = new Date(Math.min(request.endTime.getTime(), wh.endTime.getTime()));
        return total + Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));
      }, 0);

      warnings.push(`Event overlaps with work hours (${overlapMinutes.toFixed(0)} minutes overlap)`);
      suggestions.push('Ensure event aligns with planned work schedule');
    }

    // 6. Project validation
    if (request.projectId) {
      const project = context.projects.find(p => p.id === request.projectId);
      if (!project) {
        errors.push(`Project with ID ${request.projectId} not found`);
      } else {
        // Check if event is within project timeline
        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);
        
        if (request.startTime < projectStart || request.endTime > projectEnd) {
          warnings.push(`Event extends beyond project timeline (${project.name})`);
          suggestions.push('Consider adjusting event time or extending project timeline');
        }
      }
    }

    // 7. Type-specific validation
    if (request.type === 'tracked' && !request.projectId) {
      warnings.push('Tracked events should typically be associated with a project');
      suggestions.push('Consider assigning this event to a project for better tracking');
    }

    // Analysis context
    const durationAnalysis = {
      plannedDuration: durationHours,
      minimumViableDuration,
      isViableDuration
    };

    const conflictAnalysis = {
      conflictingEvents,
      conflictingWorkHours,
      overlapMinutes
    };

    const businessRuleAnalysis = {
      isWithinBusinessHours: isWithinBusiness,
      exceedsMaxDailyHours: durationHours > 8,
      violatesMinimumBreaks: false // TODO: Implement break validation
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        durationAnalysis,
        conflictAnalysis,
        businessRuleAnalysis
      }
    };
  }

  /**
   * Validate calendar event update with impact analysis
   */
  static async validateCalendarEventUpdate(
    request: UpdateCalendarEventValidationRequest,
    context: CalendarEventValidationContext
  ): Promise<DetailedCalendarEventValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Find existing event
    const existingEvent = context.existingEvents.find(e => e.id === request.id);
    if (!existingEvent) {
      errors.push(`Calendar event with ID ${request.id} not found`);
      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        context: {}
      };
    }

    // Create merged update request for validation
    const mergedRequest: CreateCalendarEventValidationRequest = {
      title: request.title ?? existingEvent.title,
      startTime: request.startTime ?? new Date(existingEvent.startTime),
      endTime: request.endTime ?? new Date(existingEvent.endTime),
      projectId: request.projectId ?? existingEvent.projectId,
      type: request.type ?? existingEvent.type,
      description: request.description ?? existingEvent.description
    };

    // Use creation validation logic
    const baseValidation = await this.validateCalendarEventCreation(mergedRequest, context);
    errors.push(...baseValidation.errors);
    warnings.push(...baseValidation.warnings);
    suggestions.push(...baseValidation.suggestions);

    // Additional update-specific validation
    if (request.startTime || request.endTime) {
      const originalDuration = calculateDurationHours(
        new Date(existingEvent.startTime),
        new Date(existingEvent.endTime)
      );
      const newDuration = calculateDurationHours(
        mergedRequest.startTime,
        mergedRequest.endTime
      );

      const durationChange = Math.abs(newDuration - originalDuration);
      if (durationChange > 0.5) { // More than 30 minutes change
        warnings.push(`Significant duration change: ${originalDuration.toFixed(1)}h → ${newDuration.toFixed(1)}h`);
        suggestions.push('Verify that time change aligns with project requirements');
      }
    }

    // Check for cascading effects on tracked time
    if (existingEvent.type === 'tracked' && existingEvent.completed) {
      if (request.startTime || request.endTime) {
        warnings.push('Modifying completed tracked event may affect historical time data');
        suggestions.push('Consider creating a new event instead of modifying historical data');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: baseValidation.context
    };
  }

  /**
   * Validate calendar event deletion with cascade analysis
   */
  static async validateCalendarEventDeletion(
    eventId: string,
    context: CalendarEventValidationContext
  ): Promise<DetailedCalendarEventValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Find event to delete
    const eventToDelete = context.existingEvents.find(e => e.id === eventId);
    if (!eventToDelete) {
      errors.push(`Calendar event with ID ${eventId} not found`);
      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        context: {}
      };
    }

    // Check for deletion implications
    if (eventToDelete.type === 'tracked' && eventToDelete.completed) {
      warnings.push('Deleting completed tracked event will remove historical time data');
      suggestions.push('Consider marking as cancelled instead of deleting');
    }

    if (eventToDelete.projectId) {
      warnings.push('Deleting project-linked event may affect project timeline calculations');
      suggestions.push('Verify project impact before deletion');
    }

    if (eventToDelete.type === 'planned') {
      const now = new Date();
      const eventStart = new Date(eventToDelete.startTime);
      const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursUntilEvent < 2 && hoursUntilEvent > 0) {
        warnings.push('Deleting event scheduled to start within 2 hours');
        suggestions.push('Consider rescheduling instead of deleting');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {}
    };
  }

  /**
   * Validate recurring event creation
   */
  static async validateRecurringEventCreation(
    baseRequest: CreateCalendarEventValidationRequest,
    recurringConfig: {
      type: 'daily' | 'weekly' | 'monthly';
      interval: number;
      endDate?: Date;
      maxOccurrences?: number;
    },
    context: CalendarEventValidationContext
  ): Promise<DetailedCalendarEventValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate base event first
    const baseValidation = await this.validateCalendarEventCreation(baseRequest, context);
    errors.push(...baseValidation.errors);
    warnings.push(...baseValidation.warnings);

    // Recurring-specific validation
    if (recurringConfig.interval < 1) {
      errors.push('Recurring interval must be at least 1');
    }

    if (recurringConfig.type === 'daily' && recurringConfig.interval > 30) {
      warnings.push('Daily recurring events with long intervals may be better as weekly events');
    }

    // Calculate estimated occurrences
    const eventDuration = calculateDurationHours(baseRequest.startTime, baseRequest.endTime);
    let estimatedOccurrences = 0;

    if (recurringConfig.endDate) {
      const totalDays = Math.ceil((recurringConfig.endDate.getTime() - baseRequest.startTime.getTime()) / (1000 * 60 * 60 * 24));
      switch (recurringConfig.type) {
        case 'daily':
          estimatedOccurrences = Math.floor(totalDays / recurringConfig.interval);
          break;
        case 'weekly':
          estimatedOccurrences = Math.floor(totalDays / (7 * recurringConfig.interval));
          break;
        case 'monthly':
          estimatedOccurrences = Math.floor(totalDays / (30 * recurringConfig.interval));
          break;
      }
    } else if (recurringConfig.maxOccurrences) {
      estimatedOccurrences = recurringConfig.maxOccurrences;
    } else {
      warnings.push('No end date or max occurrences specified for recurring event');
      suggestions.push('Consider setting an end date to prevent indefinite recurrence');
    }

    const totalRecurringHours = estimatedOccurrences * eventDuration;
    if (totalRecurringHours > 100) {
      warnings.push(`Recurring event will create approximately ${totalRecurringHours.toFixed(0)} hours of scheduled time`);
      suggestions.push('Verify this amount of recurring time is intended');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        ...baseValidation.context,
        recurringAnalysis: {
          estimatedOccurrences,
          totalRecurringHours,
          recurringType: recurringConfig.type,
          interval: recurringConfig.interval
        }
      }
    };
  }
}
