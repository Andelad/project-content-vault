/**
 * Timeline Business Logic Service
 *
 * Centralizes all timeline-related business calculations that were previously
 * scattered across components. Provides memoized calculations for
 * performance and maintainability.
 */

import * as React from 'react';
import { calculateProjectHeight } from '../../ui/TimelinePositioning';

/**
 * Project Days Calculation
 */
export class ProjectDaysCalculationService {
  /**
   * Calculate the visible project days within viewport bounds
   */
  static calculateProjectDays(
    projectStartDate: Date,
    projectEndDate: Date,
    isContinuous: boolean,
    viewportStart: Date,
    viewportEnd: Date
  ): Date[] {
    // Normalize project dates to remove time components
    const projectStart = new Date(projectStartDate);
    projectStart.setHours(0, 0, 0, 0);

    // For continuous projects, use viewport end as the effective end date
    // This prevents infinite rendering while still showing the project as ongoing
    const projectEnd = isContinuous
      ? new Date(viewportEnd)
      : new Date(projectEndDate);
    projectEnd.setHours(0, 0, 0, 0);

    // Normalize viewport dates
    const normalizedViewportStart = new Date(viewportStart);
    normalizedViewportStart.setHours(0, 0, 0, 0);
    const normalizedViewportEnd = new Date(viewportEnd);
    normalizedViewportEnd.setHours(0, 0, 0, 0);

    if (projectEnd < normalizedViewportStart || projectStart > normalizedViewportEnd) {
      return [];
    }

    const projectDays = [];
    const visibleStart = projectStart < normalizedViewportStart ? normalizedViewportStart : projectStart;
    const visibleEnd = projectEnd > normalizedViewportEnd ? normalizedViewportEnd : projectEnd;

    for (let d = new Date(visibleStart); d <= visibleEnd; d.setDate(d.getDate() + 1)) {
      const dayToAdd = new Date(d);
      dayToAdd.setHours(0, 0, 0, 0); // Normalize time component
      projectDays.push(dayToAdd);
    }

    return projectDays;
  }
}

/**
 * Work Hours Calculation Service
 */
export class WorkHoursCalculationService {
  /**
   * Calculate total work hours from work slots array
   */
  static calculateWorkHoursTotal(workHours: any[]): number {
    return Array.isArray(workHours)
      ? workHours.reduce((sum, wh) => sum + (wh.duration || 0), 0)
      : 0;
  }

  /**
   * Calculate work hours for a specific day from settings
   */
  static calculateDayWorkHours(date: Date, settings: any): any[] {
    if (!settings?.weeklyWorkHours) return [];

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
    return settings.weeklyWorkHours[dayName] || [];
  }

  /**
   * Calculate total work hours for a specific day
   */
  static calculateTotalDayWorkHours(date: Date, settings: any): number {
    const dayWorkHours = this.calculateDayWorkHours(date, settings);
    return this.calculateWorkHoursTotal(dayWorkHours);
  }
}

/**
 * Position Calculation Service
 */
export class PositionCalculationService {
  /**
   * Calculate left position for day width positioning
   */
  static calculateDayWidthPosition(dayWidths: number[], dayOfWeek: number): number {
    return dayWidths.slice(0, dayOfWeek).reduce((sum, w) => sum + w, 0);
  }

  /**
   * Calculate timeline bar position within viewport
   */
  static calculateTimelineBarPosition(
    projectStartDate: Date,
    projectEndDate: Date,
    dates: Date[]
  ): { startIndex: number; width: number } {
    const startIndex = dates.findIndex(date =>
      date.toDateString() === projectStartDate.toDateString()
    );
    const endIndex = dates.findIndex(date =>
      date.toDateString() === projectEndDate.toDateString()
    );

    return {
      startIndex: Math.max(0, startIndex),
      width: endIndex >= 0 ? (endIndex - Math.max(0, startIndex) + 1) * 48 : 0
    };
  }
}

/**
 * Project Metrics Calculation Service
 */
export class ProjectMetricsCalculationService {
  /**
   * Calculate project metrics including working days and height
   */
  static calculateProjectMetrics(
    projectStartDate: Date,
    projectEndDate: Date,
    estimatedHours: number,
    isWorkingDay: (date: Date) => boolean,
    autoEstimateDays?: any,
    settings?: any,
    holidays?: any[]
  ): {
    exactDailyHours: number;
    dailyHours: number;
    dailyMinutes: number;
    heightInPixels: number;
    workingDaysCount: number;
  } {
    const projectStart = new Date(projectStartDate);
    const projectEnd = new Date(projectEndDate);

    let workingDays: Date[];
    
    // Use auto-estimate working days if available, otherwise fall back to basic working day calculation
    if (autoEstimateDays && settings && holidays) {
      // Inline the auto-estimate working days calculation logic (copied from other services)
      workingDays = [];
      
      for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
        const currentDate = new Date(d);
        
        // Check if it's a basic working day first
        if (!isWorkingDay(currentDate)) {
          continue;
        }
        
        // Check if this day type is excluded in autoEstimateDays
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[currentDate.getDay()];
        
        if (autoEstimateDays && autoEstimateDays[dayName] === false) {
          continue; // Skip this day type
        }
        
        workingDays.push(currentDate);
      }
    } else {
      // Fallback to basic working day calculation
      workingDays = [];
      for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
        if (isWorkingDay(new Date(d))) {
          workingDays.push(new Date(d));
        }
      }
    }

    const totalWorkingDays = workingDays.length;

    // Debug log to verify which calculation path is being used

    // If no working days, don't divide by zero
    if (totalWorkingDays === 0) {
      return {
        exactDailyHours: 0,
        dailyHours: 0,
        dailyMinutes: 0,
        heightInPixels: 0,
        workingDaysCount: 0
      };
    }

    const exactHoursPerDay = estimatedHours / totalWorkingDays;
    const dailyHours = Math.floor(exactHoursPerDay);
    const dailyMinutes = Math.round((exactHoursPerDay - dailyHours) * 60);

    // Calculate precise height in pixels (minimum 3px only if estimated hours > 0)
    const heightInPixels = estimatedHours > 0
      ? calculateProjectHeight(exactHoursPerDay)
      : 0;
    // Cap the outer rectangle at 40px to stay within taller row height (52px - 12px padding)
    const cappedHeight = Math.min(heightInPixels, 40);

    return {
      exactDailyHours: exactHoursPerDay,
      dailyHours,
      dailyMinutes,
      heightInPixels: cappedHeight,
      workingDaysCount: totalWorkingDays
    };
  }
}

/**
 * Weekly Capacity Calculation Service
 */
export class WeeklyCapacityCalculationService {
  /**
   * Calculate total weekly work capacity from settings
   */
  static calculateWeeklyCapacity(weeklyWorkHours: Record<string, any>): number {
    if (!weeklyWorkHours) return 0;

    return Object.values(weeklyWorkHours).reduce((sum: number, dayData: any) => {
      // Handle both old (number) and new (WorkSlot[]) formats
      if (Array.isArray(dayData)) {
        return sum + WorkHoursCalculationService.calculateWorkHoursTotal(dayData);
      }
      return sum + (dayData || 0);
    }, 0);
  }

  /**
   * Calculate daily capacity for a specific day
   */
  static calculateDailyCapacity(date: Date, weeklyWorkHours: any): number {
    if (!weeklyWorkHours) return 0;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof typeof weeklyWorkHours;
    const dayData = weeklyWorkHours[dayName];

    if (Array.isArray(dayData)) {
      return WorkHoursCalculationService.calculateWorkHoursTotal(dayData);
    }
    return dayData || 0;
  }
}
export class WorkHoursValidationService {
  /**
   * Check if work slots array has any work hours configured
   */
  static hasWorkHoursConfigured(workSlots: any[]): boolean {
    return Array.isArray(workSlots) &&
      WorkHoursCalculationService.calculateWorkHoursTotal(workSlots) > 0;
  }

  /**
   * Check if a specific day has work hours configured in settings
   */
  static dayHasWorkHoursConfigured(date: Date, settings: any): boolean {
    const dayWorkHours = WorkHoursCalculationService.calculateDayWorkHours(date, settings);
    return this.hasWorkHoursConfigured(dayWorkHours);
  }
}
export class CommittedHoursCalculationService {
  /**
   * Calculate committed hours from calendar events for a specific date and project
   */
  static calculateCommittedHoursForDate(
    date: Date,
    projectId: string,
    events: any[]
  ): number {
    const dateKey = date.toISOString().split('T')[0];
    return events
      .filter(event => {
        const eventDate = event.startTime.toISOString().split('T')[0];
        return eventDate === dateKey && event.projectId === projectId;
      })
      .reduce((total, event) => total + event.duration, 0);
  }

  /**
   * Calculate committed hours from calendar events for a date range and project
   */
  static calculateCommittedHoursForDateRange(
    startDate: Date,
    endDate: Date,
    projectId: string,
    events: any[]
  ): number {
    let totalHours = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      totalHours += this.calculateCommittedHoursForDate(currentDate, projectId, events);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalHours;
  }
}
export class VisualOffsetCalculationService {
  /**
   * Calculate visual offsets for drag operations
   */
  static calculateBaselineVisualOffsets(
    positions: any,
    isDragging: boolean,
    dragState: any,
    projectId: string,
    mode: 'days' | 'weeks' = 'days'
  ): any {
    let adjustedPositions = { ...positions };

    if (isDragging && dragState?.projectId === projectId) {
      // In days view: use snapped daysDelta for day boundary snapping
      // In weeks view: use smooth pixelDeltaX for responsive movement
      const dayWidth = mode === 'weeks' ? 11 : 40;
      const dragOffsetPx = mode === 'days'
        ? (dragState.daysDelta || 0) * dayWidth  // Snapped to day boundaries in days view
        : (typeof dragState.pixelDeltaX === 'number' ? dragState.pixelDeltaX : (dragState.daysDelta || 0) * dayWidth);  // Smooth in weeks view

      const action = dragState?.action;

      if (action === 'move') {
        // Move everything together
        adjustedPositions = {
          ...positions,
          baselineStartPx: positions.baselineStartPx + dragOffsetPx,
          circleLeftPx: positions.circleLeftPx + dragOffsetPx,
          triangleLeftPx: positions.triangleLeftPx + dragOffsetPx,
          baselineWidthPx: positions.baselineWidthPx // width unchanged when moving
        };
      } else if (action === 'resize-start-date') {
        // Only start date (and baseline left edge) should move visually
        adjustedPositions = {
          ...positions,
          baselineStartPx: positions.baselineStartPx + dragOffsetPx,
          circleLeftPx: positions.circleLeftPx + dragOffsetPx,
          triangleLeftPx: positions.triangleLeftPx, // keep end fixed
          // Width must shrink/grow opposite to left edge movement to keep right edge fixed
          baselineWidthPx: positions.baselineWidthPx - dragOffsetPx
        };
      } else if (action === 'resize-end-date') {
        // Only end date should move visually; keep baseline start and start circle fixed
        adjustedPositions = {
          ...positions,
          baselineStartPx: positions.baselineStartPx,
          circleLeftPx: positions.circleLeftPx,
          triangleLeftPx: positions.triangleLeftPx + dragOffsetPx,
          // Width grows/shrinks with right edge movement
          baselineWidthPx: positions.baselineWidthPx + dragOffsetPx
        };
      }
    }

    return adjustedPositions;
  }
}

/**
 * React Hook for Timeline Business Logic Calculations
 */
export function useTimelineBusinessLogicCalculations() {
  return React.useMemo(() => ({
    calculateProjectDays: ProjectDaysCalculationService.calculateProjectDays,
    calculateWorkHoursTotal: WorkHoursCalculationService.calculateWorkHoursTotal,
    calculateDayWorkHours: WorkHoursCalculationService.calculateDayWorkHours,
    calculateTotalDayWorkHours: WorkHoursCalculationService.calculateTotalDayWorkHours,
    calculateDayWidthPosition: PositionCalculationService.calculateDayWidthPosition,
    calculateTimelineBarPosition: PositionCalculationService.calculateTimelineBarPosition,
    calculateProjectMetrics: ProjectMetricsCalculationService.calculateProjectMetrics,
    calculateBaselineVisualOffsets: VisualOffsetCalculationService.calculateBaselineVisualOffsets,
    calculateCommittedHoursForDate: CommittedHoursCalculationService.calculateCommittedHoursForDate,
    calculateCommittedHoursForDateRange: CommittedHoursCalculationService.calculateCommittedHoursForDateRange,
    hasWorkHoursConfigured: WorkHoursValidationService.hasWorkHoursConfigured,
    dayHasWorkHoursConfigured: WorkHoursValidationService.dayHasWorkHoursConfigured,
    calculateWeeklyCapacity: WeeklyCapacityCalculationService.calculateWeeklyCapacity,
    calculateDailyCapacity: WeeklyCapacityCalculationService.calculateDailyCapacity
  }), []);
}
