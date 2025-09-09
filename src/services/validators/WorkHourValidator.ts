/**
 * Work Hour Validator
 * 
 * Provides comprehensive validation for work hours following
 * standardized validation patterns. Coordinates domain rules with
 * business logic and external constraints.
 * 
 * @module WorkHourValidator
 */

import type { 
  WorkHour, 
  CalendarEvent, 
  Project, 
  Settings 
} from '@/types/core';

import { 
  calculateDurationHours 
} from '../calculations/dateCalculations';

// =====================================================================================
// VALIDATION INTERFACES
// =====================================================================================

export interface WorkHourValidationContext {
  existingWorkHours: WorkHour[];
  existingEvents: CalendarEvent[];
  projects: Project[];
  settings: Settings;
  repository?: any; // IWorkHourRepository when available
}

export interface DetailedWorkHourValidationResult {
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
      conflictingWorkHours: WorkHour[];
      conflictingEvents: CalendarEvent[];
      overlapMinutes: number;
    };
    capacityAnalysis?: {
      dailyHours: number;
      weeklyHours: number;
      exceedsRecommendedDaily: boolean;
      exceedsRecommendedWeekly: boolean;
      totalHours?: number;
      periodDays?: number;
      avgHoursPerDay?: number;
    };
    bulkAnalysis?: {
      totalWeeklyHours: number;
      dailyDistribution: { [key: string]: number };
      daysWithWork: number;
      avgHoursPerDay: number;
    };
  };
}

export interface CreateWorkHourValidationRequest {
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  type?: 'work' | 'meeting' | 'break';
}

export interface UpdateWorkHourValidationRequest {
  id: string;
  title?: string;
  startTime?: Date;
  endTime?: Date;
  description?: string;
  type?: 'work' | 'meeting' | 'break';
}

export interface BulkWorkHourValidationRequest {
  workHours: CreateWorkHourValidationRequest[];
  weekStart: Date;
  overrideExisting?: boolean;
}

// =====================================================================================
// WORK HOUR VALIDATOR
// =====================================================================================

/**
 * Work Hour Validator
 * 
 * Provides comprehensive validation by coordinating domain rules
 * with repository data and complex business scenarios.
 */
export class WorkHourValidator {

  /**
   * Validate work hour creation with comprehensive checks
   */
  static async validateWorkHourCreation(
    request: CreateWorkHourValidationRequest,
    context: WorkHourValidationContext
  ): Promise<DetailedWorkHourValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 1. Domain rule validation
    if (!request.title || request.title.trim().length === 0) {
      errors.push('Work hour title is required');
    }
    
    if (request.startTime >= request.endTime) {
      errors.push('Work hour start time must be before end time');
    }

    // 2. Duration analysis
    const durationHours = calculateDurationHours(request.startTime, request.endTime);
    const minimumViableDuration = 0.25; // 15 minutes minimum
    const isViableDuration = durationHours >= minimumViableDuration;

    if (!isViableDuration) {
      errors.push(`Work hour duration (${durationHours.toFixed(2)} hours) is below minimum viable duration (${minimumViableDuration} hours)`);
    }

    if (durationHours > 12) {
      errors.push(`Work hour duration (${durationHours.toFixed(1)} hours) exceeds maximum allowed duration (12 hours)`);
    }

    if (durationHours > 8 && request.type !== 'break') {
      warnings.push(`Work hour duration (${durationHours.toFixed(1)} hours) exceeds typical work day length`);
      suggestions.push('Consider splitting this into multiple shorter work periods with breaks');
    }

    // 3. Business rule validation - work hours during reasonable hours
    const startHour = request.startTime.getHours();
    const endHour = request.endTime.getHours();
    
    if (startHour < 5 || startHour > 22) {
      warnings.push('Work hour starts outside typical working hours (5 AM - 10 PM)');
      suggestions.push('Consider adjusting work hour timing for better work-life balance');
    }

    if (endHour < 5 || endHour > 24) {
      warnings.push('Work hour ends outside typical working hours (5 AM - midnight)');
      suggestions.push('Consider adjusting work hour timing for better work-life balance');
    }

    // 4. Conflict detection with existing work hours
    const conflictingWorkHours = context.existingWorkHours.filter(wh => {
      return request.startTime < wh.endTime && request.endTime > wh.startTime;
    });

    if (conflictingWorkHours.length > 0) {
      errors.push(`Work hour conflicts with ${conflictingWorkHours.length} existing work hour(s)`);
      suggestions.push('Adjust work hour time or modify conflicting work hours');
    }

    // 5. Calendar event consistency check
    const conflictingEvents = context.existingEvents.filter(event => {
      return request.startTime < event.endTime && request.endTime > event.startTime;
    });

    let overlapMinutes = 0;
    if (conflictingEvents.length > 0) {
      overlapMinutes = conflictingEvents.reduce((total, event) => {
        const overlapStart = new Date(Math.max(request.startTime.getTime(), event.startTime.getTime()));
        const overlapEnd = new Date(Math.min(request.endTime.getTime(), event.endTime.getTime()));
        return total + Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));
      }, 0);

      warnings.push(`Work hour overlaps with calendar events (${overlapMinutes.toFixed(0)} minutes overlap)`);
      suggestions.push('Ensure work hour aligns with scheduled events or update event times');
    }

    // 6. Work hour type validation
    if (request.type && !['work', 'meeting', 'break'].includes(request.type)) {
      errors.push(`Invalid work hour type: ${request.type}. Must be 'work', 'meeting', or 'break'`);
    }

    // 7. Daily and weekly capacity analysis
    const workHourDate = new Date(request.startTime);
    workHourDate.setHours(0, 0, 0, 0);
    
    // Calculate total daily hours including this new work hour
    const dailyWorkHours = context.existingWorkHours
      .filter(wh => {
        const whDate = new Date(wh.startTime);
        whDate.setHours(0, 0, 0, 0);
        return whDate.getTime() === workHourDate.getTime();
      })
      .reduce((total, wh) => total + calculateDurationHours(wh.startTime, wh.endTime), 0);
    
    const totalDailyHours = dailyWorkHours + durationHours;
    const exceedsRecommendedDaily = totalDailyHours > 8;

    if (exceedsRecommendedDaily) {
      warnings.push(`Total daily work hours (${totalDailyHours.toFixed(1)}) exceeds recommended 8 hours`);
      suggestions.push('Consider reducing work hours or scheduling break time');
    }

    // Calculate weekly hours (simple approximation)
    const weekStart = new Date(workHourDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weeklyWorkHours = context.existingWorkHours
      .filter(wh => wh.startTime >= weekStart && wh.startTime <= weekEnd)
      .reduce((total, wh) => total + calculateDurationHours(wh.startTime, wh.endTime), 0);
    
    const totalWeeklyHours = weeklyWorkHours + durationHours;
    const exceedsRecommendedWeekly = totalWeeklyHours > 40;

    if (exceedsRecommendedWeekly) {
      warnings.push(`Total weekly work hours (${totalWeeklyHours.toFixed(1)}) exceeds recommended 40 hours`);
      suggestions.push('Consider redistributing work hours across the week');
    }

    // Analysis context
    const durationAnalysis = {
      plannedDuration: durationHours,
      minimumViableDuration,
      isViableDuration
    };

    const conflictAnalysis = {
      conflictingWorkHours,
      conflictingEvents,
      overlapMinutes
    };

    const capacityAnalysis = {
      dailyHours: totalDailyHours,
      weeklyHours: totalWeeklyHours,
      exceedsRecommendedDaily,
      exceedsRecommendedWeekly
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        durationAnalysis,
        conflictAnalysis,
        capacityAnalysis
      }
    };
  }

  /**
   * Validate work hour update with impact analysis
   */
  static async validateWorkHourUpdate(
    request: UpdateWorkHourValidationRequest,
    context: WorkHourValidationContext
  ): Promise<DetailedWorkHourValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Find existing work hour
    const existingWorkHour = context.existingWorkHours.find(wh => wh.id === request.id);
    if (!existingWorkHour) {
      errors.push(`Work hour with ID ${request.id} not found`);
      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        context: {}
      };
    }

    // Create merged update request for validation
    const mergedRequest: CreateWorkHourValidationRequest = {
      title: request.title ?? existingWorkHour.title,
      startTime: request.startTime ?? existingWorkHour.startTime,
      endTime: request.endTime ?? existingWorkHour.endTime,
      description: request.description ?? existingWorkHour.description,
      type: request.type ?? existingWorkHour.type
    };

    // Filter out the existing work hour from context for validation
    const contextForValidation = {
      ...context,
      existingWorkHours: context.existingWorkHours.filter(wh => wh.id !== request.id)
    };

    // Use creation validation logic
    const baseValidation = await this.validateWorkHourCreation(mergedRequest, contextForValidation);
    errors.push(...baseValidation.errors);
    warnings.push(...baseValidation.warnings);
    suggestions.push(...baseValidation.suggestions);

    // Additional update-specific validation
    if (request.startTime || request.endTime) {
      const originalDuration = calculateDurationHours(existingWorkHour.startTime, existingWorkHour.endTime);
      const newDuration = calculateDurationHours(mergedRequest.startTime, mergedRequest.endTime);

      const durationChange = Math.abs(newDuration - originalDuration);
      if (durationChange > 1) { // More than 1 hour change
        warnings.push(`Significant duration change: ${originalDuration.toFixed(1)}h → ${newDuration.toFixed(1)}h`);
        suggestions.push('Verify that time change is accurate for work performed');
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
   * Validate work hour deletion with cascade analysis
   */
  static async validateWorkHourDeletion(
    workHourId: string,
    context: WorkHourValidationContext
  ): Promise<DetailedWorkHourValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Find work hour to delete
    const workHourToDelete = context.existingWorkHours.find(wh => wh.id === workHourId);
    if (!workHourToDelete) {
      errors.push(`Work hour with ID ${workHourId} not found`);
      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        context: {}
      };
    }

    // Check for deletion implications
    const workHourDuration = calculateDurationHours(workHourToDelete.startTime, workHourToDelete.endTime);
    if (workHourDuration > 4) {
      warnings.push(`Deleting significant work hour (${workHourDuration.toFixed(1)} hours)`);
      suggestions.push('Consider if this work time should be reassigned rather than deleted');
    }

    const now = new Date();
    const workHourStart = workHourToDelete.startTime;
    const hoursAgo = (now.getTime() - workHourStart.getTime()) / (1000 * 60 * 60);
    
    if (hoursAgo < 24) {
      warnings.push('Deleting recent work hour (within last 24 hours)');
      suggestions.push('Ensure deletion is intentional for recently tracked work');
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
   * Validate bulk work hour creation (e.g., weekly schedule)
   */
  static async validateBulkWorkHourCreation(
    request: BulkWorkHourValidationRequest,
    context: WorkHourValidationContext
  ): Promise<DetailedWorkHourValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate each work hour individually
    const individualValidations: DetailedWorkHourValidationResult[] = [];
    for (const workHour of request.workHours) {
      const validation = await this.validateWorkHourCreation(workHour, context);
      individualValidations.push(validation);
      
      if (!validation.isValid) {
        errors.push(`Work hour ${request.workHours.indexOf(workHour) + 1}: ${validation.errors.join(', ')}`);
      }
    }

    // Cross-validation between work hours in the batch
    for (let i = 0; i < request.workHours.length; i++) {
      for (let j = i + 1; j < request.workHours.length; j++) {
        const wh1 = request.workHours[i];
        const wh2 = request.workHours[j];

        // Check for overlaps within the batch
        if (wh1.startTime < wh2.endTime && wh1.endTime > wh2.startTime) {
          errors.push(`Work hours ${i + 1} and ${j + 1} overlap within the batch`);
        }
      }
    }

    // Weekly capacity analysis
    const totalWeeklyHours = request.workHours.reduce((total, wh) => {
      return total + calculateDurationHours(wh.startTime, wh.endTime);
    }, 0);

    if (totalWeeklyHours > 50) {
      warnings.push(`Total weekly work hours (${totalWeeklyHours.toFixed(1)}) is very high`);
      suggestions.push('Consider reducing weekly work load for better work-life balance');
    }

    if (totalWeeklyHours < 10) {
      warnings.push(`Total weekly work hours (${totalWeeklyHours.toFixed(1)}) is quite low`);
      suggestions.push('Consider if additional work hours are needed');
    }

    // Distribution analysis
    const dailyHours: { [key: string]: number } = {};
    request.workHours.forEach(wh => {
      const dateKey = wh.startTime.toISOString().split('T')[0];
      if (!dailyHours[dateKey]) dailyHours[dateKey] = 0;
      dailyHours[dateKey] += calculateDurationHours(wh.startTime, wh.endTime);
    });

    const daysWithWork = Object.keys(dailyHours).length;
    const avgHoursPerDay = totalWeeklyHours / daysWithWork;
    
    if (avgHoursPerDay > 10) {
      warnings.push(`Average daily work hours (${avgHoursPerDay.toFixed(1)}) is very high`);
      suggestions.push('Consider distributing work hours more evenly across the week');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        bulkAnalysis: {
          totalWeeklyHours,
          dailyDistribution: dailyHours,
          daysWithWork,
          avgHoursPerDay
        }
      }
    };
  }

  /**
   * Validate work hour capacity for a specific time period
   */
  static validateWorkHourCapacity(
    startDate: Date,
    endDate: Date,
    context: WorkHourValidationContext
  ): DetailedWorkHourValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Get all work hours in the specified period
    const workHoursInPeriod = context.existingWorkHours.filter(wh => 
      wh.startTime >= startDate && wh.endTime <= endDate
    );

    const totalHours = workHoursInPeriod.reduce((total, wh) => 
      total + calculateDurationHours(wh.startTime, wh.endTime), 0
    );

    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgHoursPerDay = totalHours / periodDays;

    if (avgHoursPerDay > 10) {
      warnings.push(`High work capacity: ${avgHoursPerDay.toFixed(1)} hours/day average`);
      suggestions.push('Monitor for potential burnout and ensure adequate rest periods');
    }

    if (avgHoursPerDay < 2) {
      warnings.push(`Low work capacity: ${avgHoursPerDay.toFixed(1)} hours/day average`);
      suggestions.push('Consider if additional work hours are needed to meet objectives');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      context: {
        capacityAnalysis: {
          totalHours,
          periodDays,
          avgHoursPerDay,
          dailyHours: avgHoursPerDay,
          weeklyHours: avgHoursPerDay * 7,
          exceedsRecommendedDaily: avgHoursPerDay > 8,
          exceedsRecommendedWeekly: (avgHoursPerDay * 7) > 40
        }
      }
    };
  }
}
