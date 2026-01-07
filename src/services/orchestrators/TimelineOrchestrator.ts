/**
 * Unified Timeline Service
 * 
 * Single source of truth for all timeline-related functionality.
 * Delegates to existing orchestrators, calculations, and UI services.
 * 
 * Following AI Development Rules:
 * - Delegates to domain layers (orchestrators, calculations)
 * - No business logic implementation in this service
 *  static isWorkingDay(date: Date, holidays: any[], settings: any): boolean {
    if (isHolidayDateCapacity(date, holidays)) {
      return false;
    }
    // Delegate to pure calculation function
    const dayOfWeek = getDayOfWeek(date);
    const weeklyWorkHours = settings?.weeklyWorkHours || {};
    const dayHours = weeklyWorkHours[dayOfWeek];
    return dayHours && dayHours.hours > 0;
  }nterface for timeline components
 */
import { PhaseOrchestrator } from '../orchestrators/PhaseOrchestrator';
import { normalizeToMidnight } from '@/utils/dateCalculations';
import { ColorCalculationService } from '@/domain/rules/ui/ColorCalculations';
import { 
  calculateBaselineVisualOffsets,
  calculateVisualProjectDates,
  getTimelinePositions,
  calculateTimelineColumnMarkerData
} from '@/services/ui/ProjectBarPositioning';

import { 
  calculateProjectDuration,
  calculateProjectDays,
  calculateMilestoneSegments,
  generateWorkHoursForDate,
  calculateLegacyProjectMetrics,
  createWorkingDayChecker,
  calculateAvailabilityReduction,
  calculateOvertimePlannedHours,
  calculateTotalPlannedHours,
  calculateOtherTime,
  calculateProjectWorkingDays,
  getProjectTimeAllocation,
  calculateWorkHoursTotal,
  expandHolidayDates,
  calculateHabitTimeWithinWorkSlots,
  calculatePlannedTimeNotOverlappingHabits,
  calculateNetAvailability,
  calculateAutoEstimateHoursPerDay,
  calculateAutoEstimateWorkingDays,
  isHolidayDateCapacity,
  // NEW: Import proper date calculation functions
  isToday,
  isTodayInWeek,
  isWeekendDate,
  formatWeekDateRange,
  groupDatesByMonth,
  getDayOfWeek,
  getDayName,
  generateDateRange,
  isDateInArray,
  // NEW: Import calculateProjectDayEstimates
  calculateProjectDayEstimates,
  // Import isWorkingDay from dateCalculations (authoritative source)
  isWorkingDay as isWorkingDayDateCalc
} from '../index';
import { getDateKey } from '@/utils/dateFormatUtils';
// Import timeline row calculations
import { 
  calculateTimelineRows as calculateTimelineRowsCalc,
  getProjectVisualRow as getProjectVisualRowCalc,
  calculateLayoutMetrics as calculateLayoutMetricsCalc
} from '@/domain/rules/timeline/TimelineRowCalculations';
// Import daily availability calculations
import {
  getWorkHoursForDay as getWorkHoursForDayCalc,
  calculateDailyProjectHours as calculateDailyProjectHoursCalc,
  calculateDailyAvailableHours as calculateDailyAvailableHoursCalc
} from '@/domain/rules/availability/DailyMetrics';
// Import WorkHourLike type
import type { WorkHourLike } from '@/domain/rules/availability/WorkHourGeneration';
import type { Project, PhaseDTO, DayEstimate, Settings, Holiday, CalendarEvent, WorkHour } from '@/types/core';
import type { TimelinePositionCalculation } from '@/services/ui/ProjectBarPositioning';
import type { DragState } from '@/services/ui/DragPositioning';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
export interface TimelineProjectData {
  project: Project;
  duration: number;
  isActiveOnDate: (date: Date) => boolean;
  validation: {
    isValid: boolean;
    errors?: string[];
    warnings?: string[];
  } | null;
}
/**
 * Unified Timeline Service
 * 
 * Consolidates all timeline functionality into a single interface.
 * Components should ONLY use this service for timeline operations.
 */
export class UnifiedTimelineService {
  // ============================================================================
  // PROJECT TIMELINE DATA (Delegates to existing services)
  // ============================================================================
  /**
   * Get comprehensive project timeline data
   * Consolidates multiple service calls into single method
   */
  static getProjectTimelineData(project: Project): TimelineProjectData {
    return {
      project,
      duration: calculateProjectDuration(project),
      isActiveOnDate: (date: Date) => PhaseOrchestrator.isProjectActiveOnDate(project, date),
      validation: PhaseOrchestrator.validateProjectTimeframe(
        new Date(project.startDate),
        new Date(project.endDate)
      )
    };
  }
  /**
   * Calculate project duration
   * Delegates to existing calculation service
   */
  static calculateProjectDuration = calculateProjectDuration;
  /**
   * Check if project is active on date
   * Delegates to PhaseOrchestrator
   */
  static isProjectActiveOnDate = PhaseOrchestrator.isProjectActiveOnDate;
  /**
   * Get project validation data
   * Delegates to PhaseOrchestrator
   */
  static validateProject(project: Project, phases: PhaseDTO[] = []) {
    return PhaseOrchestrator.validateProjectTimeframe(
      new Date(project.startDate),
      new Date(project.endDate),
      phases
    );
  }
  // ============================================================================
  // TIMELINE VISUAL CALCULATIONS (Extracted from TimelineBar.tsx)
  // ============================================================================
  /**
   * Calculate project days for timeline display
   * Delegates to existing calculation service
   */
  static calculateProjectDays(
    startDate: Date,
    endDate: Date,
    continuous: boolean,
    viewportStart: Date,
    viewportEnd: Date
  ) {
    return calculateProjectDays(startDate, endDate, continuous, viewportStart, viewportEnd);
  }
  /**
   * Calculate day estimates for project (NEW - Phase 4)
   * Delegates to dayEstimateCalculations
   */
  static calculateProjectDayEstimates(
    project: Project,
    phases: PhaseDTO[],
    settings: Settings,
    holidays: Holiday[],
    events: CalendarEvent[] = []
  ): DayEstimate[] {
    return calculateProjectDayEstimates(
      project,
      phases,
      settings,
      holidays,
      events
    );
  }
  /**
   * Calculate milestone segments for project (DEPRECATED - use calculateProjectDayEstimates)
   * Delegates to existing calculation service
   */
  static calculateMilestoneSegments(
    phases: PhaseDTO[],
    projectStart: Date,
    projectEnd: Date
  ) {
    return calculateMilestoneSegments(phases, projectStart, projectEnd);
  }
  /**
   * Generate work hours for date range
   * Delegates to existing calculation service
   */
  static generateProjectWorkHours(
    project: Project,
    settings: Settings,
    viewportEnd: Date,
    holidays: Holiday[] = []
  ) {
    const workHours: WorkHour[] = [];
    const projectStart = new Date(project.startDate);
    const projectEnd = project.continuous ? new Date(viewportEnd) : new Date(project.endDate);
    // Delegate to pure calculation function instead of manual date iteration
    const projectDates = generateDateRange(projectStart, projectEnd);
    for (const date of projectDates) {
      const dayWorkHours = generateWorkHoursForDate(date, settings, holidays);
      workHours.push(...dayWorkHours);
    }
    return workHours;
  }
  /**
   * Calculate project metrics using legacy service
   * Delegates to existing calculation service
   */
  static calculateProjectMetrics(
    project: Project,
    holidays: Holiday[],
    currentDate: Date = new Date()
  ) {
    // Create a proper Project type for the legacy function
    const normalizedProject: Project = {
      id: project.id || 'timeline-project',
      name: project.name || 'Timeline Project',
      color: project.color || '#3b82f6',
      client: '', // Deprecated field (Phase 5B)
      clientId: '', // Phase 5B: placeholder
      groupId: project.groupId || 'default-group',
      rowId: project.rowId || 'default-row',
      startDate: project.startDate,
      endDate: project.endDate,
      estimatedHours: project.estimatedHours,
      notes: '',
      continuous: false,
      userId: 'timeline-user',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return calculateLegacyProjectMetrics(
      normalizedProject,
      [], // empty events array
      holidays,
      currentDate
    );
  }
  /**
   * Get color scheme for project
   * Delegates to ColorCalculationService
   */
  static getProjectColorScheme(projectColor: string) {
    return {
      baseline: ColorCalculationService.getBaselineColor(projectColor),
      completedPlanned: ColorCalculationService.getCompletedPlannedColor(projectColor),
      main: projectColor,
      midTone: ColorCalculationService.getMidToneColor(projectColor),
      hover: ColorCalculationService.getHoverColor(projectColor),
      autoEstimate: ColorCalculationService.getAutoEstimateColor(projectColor)
    };
  }
  /**
   * Calculate baseline visual offsets
   * Delegates to existing calculation service
   */
  static calculateBaselineVisualOffsets(
    positions: TimelinePositionCalculation,
    isDragging: boolean,
    dragState: DragState | null,
    projectId: string,
    mode: 'days' | 'weeks' = 'days'
  ) {
    try {
      return calculateBaselineVisualOffsets(positions, isDragging, dragState, projectId, mode);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'UnifiedTimelineService', action: 'Error in calculateBaselineVisualOffsets:' });
      return positions; // fallback to original positions
    }
  }
  /**
   * Calculate visual project dates
   * Delegates to existing calculation service
   */
  static calculateVisualProjectDates(
    project: Project,
    isDragging: boolean,
    dragState: DragState | null
  ) {
    try {
      return calculateVisualProjectDates(project, isDragging, dragState);
    } catch (error) {
      ErrorHandlingService.handle(error, { source: 'UnifiedTimelineService', action: 'Error in calculateVisualProjectDates:' });
      return { 
        visualProjectStart: new Date(project.startDate), 
        visualProjectEnd: new Date(project.endDate) 
      };
    }
  }
  /**
   * Get cached working day checker
   * Delegates to existing service
   */
  static getCachedWorkingDayChecker(weeklyWorkHours: Settings['weeklyWorkHours'] | undefined, holidays: Holiday[]) {
    return createWorkingDayChecker(weeklyWorkHours, holidays);
  }
  /**
   * Get timeline positions
   * Delegates to existing service
   */
  static getTimelinePositions = getTimelinePositions;
  // ============================================================================
  // COMPREHENSIVE TIMELINE BAR DATA (Single method for components)
  // ============================================================================
  /**
   * Get all data needed for timeline bar rendering
   * Consolidates multiple calculations into single method call
   */
  static getTimelineBarData(
    project: Project,
    dates: Date[],
    viewportStart: Date,
    viewportEnd: Date,
    phases: PhaseDTO[],
    holidays: Holiday[],
    settings: Settings,
    isDragging: boolean = false,
    dragState: DragState | null = null,
    isWorkingDayChecker?: (date: Date) => boolean, // Accept the hook result as parameter
    events?: unknown[], // Add events parameter for planned time calculations
    options?: {
      visualProjectDates?: {
        startDate: Date;
        endDate: Date;
      };
    }
  ) {
    const effectiveProject = options?.visualProjectDates
      ? {
          ...project,
          startDate: options.visualProjectDates.startDate,
          endDate: options.visualProjectDates.endDate
        }
      : project;

    // Calculate day estimates using new service (now includes planned events)
    const dayEstimates = this.calculateProjectDayEstimates(
      effectiveProject,
      phases,
      settings,
      holidays,
      (events as CalendarEvent[]) || [] // Pass events to calculation
    );
    
    // Pre-aggregate per-date summaries to avoid per-render filtering in components
    // Key: date key 'YYYY-MM-DD' (timezone-safe)
    const summariesByDate = new Map<string, {
      dailyHours: number;
      allocationType: 'planned' | 'completed' | 'auto-estimate' | 'none';
      isPlannedTime: boolean;
      isCompletedTime: boolean;
    }>();
    try {
      // Group estimates by date key
      const grouped = new Map<string, Array<DayEstimate>>();
      for (const est of dayEstimates) {
        const key = getDateKey(new Date(est.date));
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(est);
      }
      // Build summaries per date
      for (const [key, estimates] of grouped.entries()) {
        const totalHours = estimates.reduce((sum, e) => sum + (e?.hours || 0), 0);
        // Events and estimates are mutually exclusive at the day level by rule;
        // but if present, event wins the classification
        const eventEstimate = estimates.find(e => e?.source === 'event');
        let allocationType: 'planned' | 'completed' | 'auto-estimate' | 'none' = 'none';
        let isPlannedTime = false;
        let isCompletedTime = false;
        if (eventEstimate) {
          if (eventEstimate.isPlannedEvent && eventEstimate.isCompletedEvent) {
            allocationType = 'planned';
            isPlannedTime = true;
            isCompletedTime = true;
          } else if (eventEstimate.isPlannedEvent) {
            allocationType = 'planned';
            isPlannedTime = true;
          } else if (eventEstimate.isCompletedEvent) {
            allocationType = 'completed';
            isCompletedTime = true;
          } else {
            allocationType = 'none';
          }
        } else if (totalHours > 0) {
          allocationType = 'auto-estimate';
        }
        summariesByDate.set(key, {
          dailyHours: totalHours,
          allocationType,
          isPlannedTime,
          isCompletedTime
        });
      }
    } catch (e) {
      // Fail-safe: if aggregation fails, leave summaries empty; component should handle gracefully
      ErrorHandlingService.handle(e, { source: 'UnifiedTimelineService', action: '[UnifiedTimelineService] Failed to aggregate per-date summaries:' });
    }
    
    // Helper accessor for components: get summary for a date without re-filtering arrays
    const getPerDateSummary = (date: Date) => {
      const key = getDateKey(normalizeToMidnight(new Date(date)));
      return (
        summariesByDate.get(key) || {
          dailyHours: 0,
          allocationType: 'none' as const,
          isPlannedTime: false,
          isCompletedTime: false
        }
      );
    };
    
    const projectDays = this.calculateProjectDays(
      effectiveProject.startDate,
      effectiveProject.endDate,
      effectiveProject.continuous,
      viewportStart,
      viewportEnd
    );
    
    return {
      // Project basics
      projectData: this.getProjectTimelineData(project),
      // Timeline calculations
      projectDays,
      // Work hours
      workHoursForPeriod: this.generateProjectWorkHours(effectiveProject, settings, viewportEnd, holidays),
      // Day estimates (NEW - single source of truth)
      dayEstimates,
      // Fast per-date accessor to avoid filter/reduce in components
      getPerDateSummary,
      // Milestone segments (DEPRECATED - kept for backward compatibility)
      milestoneSegments: this.calculateMilestoneSegments(
        phases,
        new Date(effectiveProject.startDate),
        new Date(effectiveProject.endDate)
      ),
      // Metrics
      projectMetrics: this.calculateProjectMetrics(effectiveProject, holidays),
      // Colors
      colorScheme: this.getProjectColorScheme(project.color),
      // Visual calculations (if dragging)
      visualDates: options?.visualProjectDates
        ? {
            visualProjectStart: options.visualProjectDates.startDate,
            visualProjectEnd: options.visualProjectDates.endDate
          }
        : isDragging
          ? this.calculateVisualProjectDates(project, isDragging, dragState)
          : null,
      // Working day checker - use provided one or fall back to calling the hook (for backwards compatibility)
      isWorkingDay: isWorkingDayChecker || this.getCachedWorkingDayChecker(settings.weeklyWorkHours, holidays)
    };
  }
  // ============================================================================
  // AVAILABILITY CALCULATIONS (Delegates to calculations layer)
  // ============================================================================
  
  /**
   * Check if date is working day
   * Delegates to dateCalculations (authoritative implementation)
   */
  static isWorkingDay(date: Date, holidays: Holiday[], settings: Settings) {
    // Convert Holiday[] to Date[] for dateCalculations signature
    const holidayDates: Date[] = Array.isArray(holidays)
      ? holidays.map((h) => new Date(h.startDate))
      : [];
    return isWorkingDayDateCalc(date, settings, holidayDates);
  }
  
  /**
   * Get expanded holiday dates
   * Delegates to existing service
   */
  static getExpandedHolidayDates(holidays: Holiday[]) {
    const holidayInput = holidays.map((h) => ({
      startDate: new Date(h.startDate),
      endDate: new Date(h.endDate ?? h.startDate),
      name: h.title ?? 'Holiday',
      id: h.id
    }));
    return expandHolidayDates(holidayInput);
  }
  
  /**
   * Generate work hours for date
   * Delegates to existing service
   */
  static generateWorkHoursForDate = generateWorkHoursForDate;
  
  /**
   * Calculate work hours total
   * Delegates to existing service
   */
  static calculateWorkHoursTotal = calculateWorkHoursTotal;
  
  /**
   * Check if date is holiday
   * Delegates to existing service
   */
  static isHolidayDateCapacity = isHolidayDateCapacity;
  
  /**
   * Calculate daily project hours for a date
   * Delegates to dailyAvailabilityCalculations
   */
  static calculateDailyProjectHours = calculateDailyProjectHoursCalc;
  
  /**
   * Get work hours for a specific day
   * Delegates to dailyAvailabilityCalculations
   */
  static getWorkHoursForDay = getWorkHoursForDayCalc;
  
  /**
   * Calculate daily available hours after accounting for events
   * Delegates to dailyAvailabilityCalculations
   */
  static calculateDailyAvailableHours = calculateDailyAvailableHoursCalc;
  /**
   * Calculate overtime planned hours
   * Delegates to existing calculation service
   */
  static calculateOvertimePlannedHours(date: Date, events: CalendarEvent[], settings: Settings, holidays: Holiday[] = []) {
    const workHours = this.generateWorkHoursForDate(date, settings, holidays);
    return calculateOvertimePlannedHours(date, events, workHours);
  }
  /**
   * Calculate total planned hours
   * Delegates to existing calculation service
   */
  static calculateTotalPlannedHours = calculateTotalPlannedHours;
  /**
   * Calculate other time
   * Delegates to existing calculation service
   */
  static calculateOtherTime = calculateOtherTime;
  
  /**
   * Calculate habit time within work slots
   * Delegates to existing calculation service
   */
  static calculateHabitTimeWithinWorkSlots = calculateHabitTimeWithinWorkSlots;
  
  /**
   * Calculate planned time not overlapping habits
   * Delegates to existing calculation service
   */
  static calculatePlannedTimeNotOverlappingHabits = calculatePlannedTimeNotOverlappingHabits;
  
  /**
   * Calculate net availability
   * Delegates to existing calculation service
   */
  static calculateNetAvailability = calculateNetAvailability;
  
  /**
   * Group dates by month for timeline headers
   * Delegates to dateCalculations
   */
  static groupDatesByMonth = groupDatesByMonth;
  /**
   * Check if today falls within a week range
   * Delegates to dateCalculations
   */
  static isTodayInWeek = isTodayInWeek;
  /**
   * Check if today matches a specific date
   * Delegates to dateCalculations
   */
  static isTodayDate = isToday;
  /**
   * Check if date is weekend
   * Delegates to dateCalculations
   */
  static isWeekendDate = isWeekendDate;
  /**
   * Format week date range (e.g., "4 - 11")
   * Delegates to dateCalculations
   */
  static formatWeekDateRange = formatWeekDateRange;
  /**
   * Calculate column marker data for timeline columns
   * Delegates to timelineCalculations
   */
  static calculateColumnMarkerData = calculateTimelineColumnMarkerData;
  // ============================================================================
  // COMPREHENSIVE AVAILABILITY BAR DATA (Single method for components)
  // ============================================================================
  /**
   * Get basic availability data for timeline dates
   * Simplified version - components can call individual methods for specific calculations
   */
  static getAvailabilityBarData(
    dates: Date[],
    projects: Project[],
    settings: Settings,
    holidays: Holiday[],
    events: unknown[],
    type: string,
    mode: string = 'days',
    displayMode: string = 'circles'
  ) {
    return {
      // Basic data
      dates,
      columnWidth: mode === 'weeks' ? 153 : 52,
      expandedHolidays: this.getExpandedHolidayDates(holidays),
      // Helper methods for components
      isWorkingDay: (date: Date) => this.isWorkingDay(date, holidays, settings),
      generateWorkHours: (date: Date) => this.generateWorkHoursForDate(date, settings, holidays),
  calculateTotal: (workHours: WorkHourLike[]) => this.calculateWorkHoursTotal(workHours),
      isHoliday: (date: Date) => this.isHolidayDateCapacity(date, holidays),
      // Display settings
      displayMode,
      mode
    };
  }
  // ============================================================================
  // AUTO-ROW ARRANGEMENT (Delegates to calculations layer)
  // ============================================================================
  
  /**
   * Calculate timeline row arrangement for projects
   * Delegates to pure calculation function in calculations/general/timelineRowCalculations.ts
   */
  static calculateTimelineRows = calculateTimelineRowsCalc;
  
  /**
   * Get project's assigned visual row number within a group layout
   * Delegates to pure calculation function
   */
  static getProjectVisualRow = getProjectVisualRowCalc;
  
  /**
   * Calculate layout metrics for debugging/monitoring
   * Delegates to pure calculation function
   */
  static calculateLayoutMetrics = calculateLayoutMetricsCalc;
}

// Re-export types from calculation layer for convenience
export type { 
  VisualRow, 
  GroupLayout, 
  TimelineLayout, 
  TimelineAutoRowInput 
} from '@/domain/rules/timeline/TimelineRowCalculations';

// Export singleton instance following the pattern
export const timelineService = UnifiedTimelineService;

// Export getTimelineBarData as named function for easy import
export const getTimelineBarData = UnifiedTimelineService.getTimelineBarData.bind(UnifiedTimelineService);

// ============================================================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================================================

/**
 * Standalone function exports for backward compatibility
 * Components can import these directly or use UnifiedTimelineService static methods
 */
export { 
  calculateTimelineRows,
  getProjectVisualRow,
  calculateLayoutMetrics
} from '@/domain/rules/timeline/TimelineRowCalculations';
