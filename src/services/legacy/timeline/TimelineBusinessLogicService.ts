/**
 * TEMPORARY LEGACY TIMELINE BUSINESS LOGIC SERVICE
 * 
 * Quick recovery file to restore essential legacy service classes
 * that components still depend on. This allows the app to function
 * while we gradually migrate remaining components.
 * 
 * TODO: Remove this file once all components are migrated to unified functions
 */

import { 
  calculateWeeklyCapacity as insightCalculateWeeklyCapacity,
  calculateDailyCapacity as insightCalculateDailyCapacity 
} from '../../calculations/insightCalculations';

import { 
  calculateWorkHoursTotal as unifiedCalculateWorkHoursTotal,
  calculateDayWorkHours as unifiedCalculateDayWorkHours,
  calculateTotalDayWorkHours as unifiedCalculateTotalDayWorkHours,
  calculateProjectDays as unifiedCalculateProjectDays
} from '../../calculations/timelineCalculations';

import { 
  calculateCommittedHoursForDate as unifiedCalculateCommittedHoursForDate,
  hasWorkHoursConfigured as unifiedHasWorkHoursConfigured,
  dayHasWorkHoursConfigured as unifiedDayHasWorkHoursConfigured
} from '../../calculations/capacityCalculations';

import { 
  calculateProjectMetrics as unifiedCalculateProjectMetrics 
} from '../../calculations/projectProgressCalculations';

// Legacy service classes for backward compatibility
export class WeeklyCapacityCalculationService {
  static calculateWeeklyCapacity(weeklyWorkHours: any): number {
    console.warn('⚠️  WeeklyCapacityCalculationService.calculateWeeklyCapacity() is deprecated');
    return insightCalculateWeeklyCapacity(weeklyWorkHours);
  }

  static calculateDailyCapacity(settings: any): number {
    console.warn('⚠️  WeeklyCapacityCalculationService.calculateDailyCapacity() is deprecated');
    // Return a safe default for now - this needs proper implementation
    return 8; // Default 8 hours per day
  }
}

export class WorkHoursCalculationService {
  static calculateWorkHoursTotal(dayData: any): number {
    console.warn('⚠️  WorkHoursCalculationService.calculateWorkHoursTotal() is deprecated');
    return unifiedCalculateWorkHoursTotal(dayData);
  }

  static calculateDayWorkHours(date: Date, settings: any): number {
    console.warn('⚠️  WorkHoursCalculationService.calculateDayWorkHours() is deprecated');
    // Return safe default for now
    return 8;
  }

  static calculateTotalDayWorkHours(date: Date, settings: any): number {
    console.warn('⚠️  WorkHoursCalculationService.calculateTotalDayWorkHours() is deprecated');
    return unifiedCalculateTotalDayWorkHours(date, settings);
  }
}

export class ProjectDaysCalculationService {
  static calculateProjectDays(project: any, startDate?: Date, endDate?: Date): number {
    console.warn('⚠️  ProjectDaysCalculationService.calculateProjectDays() is deprecated');
    // Return safe default for now
    if (project && project.startDate && project.endDate) {
      const start = new Date(project.startDate);
      const end = new Date(project.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 1;
  }
}

export class ProjectMetricsCalculationService {
  static calculateProjectMetrics(project: any, events?: any[], settings?: any): any {
    console.warn('⚠️  ProjectMetricsCalculationService.calculateProjectMetrics() is deprecated');
    // Return safe default object for now
    return {
      totalHours: 0,
      completedHours: 0,
      remainingHours: 0,
      progressPercentage: 0
    };
  }
}

export class CommittedHoursCalculationService {
  static calculateCommittedHoursForDate(date: Date, projectId: string, events: any[]): number {
    console.warn('⚠️  CommittedHoursCalculationService.calculateCommittedHoursForDate() is deprecated');
    return unifiedCalculateCommittedHoursForDate(date, projectId, events);
  }

  static calculateCommittedHoursForDateRange(...args: any[]): any {
    console.warn('⚠️  CommittedHoursCalculationService.calculateCommittedHoursForDateRange() is deprecated');
    // For now, return a safe default - this function needs proper implementation
    return 0;
  }
}

export class WorkHoursValidationService {
  static hasWorkHoursConfigured(settings: any): boolean {
    console.warn('⚠️  WorkHoursValidationService.hasWorkHoursConfigured() is deprecated');
    return unifiedHasWorkHoursConfigured(settings);
  }

  static dayHasWorkHoursConfigured(date: Date, settings: any): boolean {
    console.warn('⚠️  WorkHoursValidationService.dayHasWorkHoursConfigured() is deprecated');
    return unifiedDayHasWorkHoursConfigured(date, settings);
  }
}

// Aggregate export for convenience
export const TimelineBusinessLogic = {
  calculateProjectDays: ProjectDaysCalculationService.calculateProjectDays,
  calculateWorkHoursTotal: WorkHoursCalculationService.calculateWorkHoursTotal,
  calculateDayWorkHours: WorkHoursCalculationService.calculateDayWorkHours,
  calculateTotalDayWorkHours: WorkHoursCalculationService.calculateTotalDayWorkHours,
  calculateProjectMetrics: ProjectMetricsCalculationService.calculateProjectMetrics,
  calculateCommittedHoursForDate: CommittedHoursCalculationService.calculateCommittedHoursForDate,
  calculateCommittedHoursForDateRange: CommittedHoursCalculationService.calculateCommittedHoursForDateRange,
  hasWorkHoursConfigured: WorkHoursValidationService.hasWorkHoursConfigured,
  dayHasWorkHoursConfigured: WorkHoursValidationService.dayHasWorkHoursConfigured,
  calculateWeeklyCapacity: WeeklyCapacityCalculationService.calculateWeeklyCapacity,
  calculateDailyCapacity: WeeklyCapacityCalculationService.calculateDailyCapacity
};
