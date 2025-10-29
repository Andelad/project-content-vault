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
import { ProjectMilestoneOrchestrator } from '../orchestrators/ProjectMilestoneOrchestrator';
import { UnifiedDayEstimateService } from './UnifiedDayEstimateService';
import { 
  calculateProjectDuration,
  calculateProjectDays,
  calculateMilestoneSegments,
  generateWorkHoursForDate,
  calculateLegacyProjectMetrics,
  calculateBaselineVisualOffsets,
  calculateVisualProjectDates,
  ColorCalculationService,
  useCachedWorkingDayChecker,
  getTimelinePositions,
  calculateAvailabilityReduction,
  calculateOvertimePlannedHours,
  calculateTotalPlannedHours,
  calculateOtherTime,
  calculateProjectWorkingDays,
  getProjectTimeAllocation,
  calculateWorkHoursTotal,
  expandHolidayDates,
  calculateAvailabilityCircleSize,
  getMinimumCircleDimensions,
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
  calculateTimelineColumnMarkerData,
  // NEW: Import calculateProjectDayEstimates
  calculateProjectDayEstimates
} from '../index';
import type { Project, Milestone, DayEstimate, Settings, Holiday } from '@/types/core';
export interface TimelineProjectData {
  project: Project;
  duration: number;
  isActiveOnDate: (date: Date) => boolean;
  validation: any;
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
      isActiveOnDate: (date: Date) => ProjectMilestoneOrchestrator.isProjectActiveOnDate(project, date),
      validation: ProjectMilestoneOrchestrator.validateProjectTimeframe(
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
   * Delegates to ProjectMilestoneOrchestrator
   */
  static isProjectActiveOnDate = ProjectMilestoneOrchestrator.isProjectActiveOnDate;
  /**
   * Get project validation data
   * Delegates to ProjectMilestoneOrchestrator
   */
  static validateProject(project: Project, milestones: Milestone[] = []) {
    return ProjectMilestoneOrchestrator.validateProjectTimeframe(
      new Date(project.startDate),
      new Date(project.endDate),
      milestones
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
   * Uses UnifiedDayEstimateService as single source of truth
   */
  static calculateProjectDayEstimates(
    project: Project,
    milestones: Milestone[],
    settings: Settings,
    holidays: Holiday[],
    events: any[] = []
  ): DayEstimate[] {
    return UnifiedDayEstimateService.calculateProjectDayEstimates(
      project,
      milestones,
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
    milestones: Milestone[],
    projectStart: Date,
    projectEnd: Date
  ) {
    return calculateMilestoneSegments(milestones, projectStart, projectEnd);
  }
  /**
   * Generate work hours for date range
   * Delegates to existing calculation service
   */
  static generateProjectWorkHours(
    project: Project,
    settings: any,
    viewportEnd: Date
  ) {
    const workHours = [];
    const projectStart = new Date(project.startDate);
    const projectEnd = project.continuous ? new Date(viewportEnd) : new Date(project.endDate);
    // Delegate to pure calculation function instead of manual date iteration
    const projectDates = generateDateRange(projectStart, projectEnd);
    for (const date of projectDates) {
      const dayWorkHours = generateWorkHoursForDate(date, settings);
      workHours.push(...dayWorkHours);
    }
    return workHours;
  }
  /**
   * Calculate project metrics using legacy service
   * Delegates to existing calculation service
   */
  static calculateProjectMetrics(
    project: any,
    holidays: any[],
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
    positions: any,
    isDragging: boolean,
    dragState: any,
    projectId: string,
    mode: 'days' | 'weeks' = 'days'
  ) {
    try {
      return calculateBaselineVisualOffsets(positions, isDragging, dragState, projectId, mode);
    } catch (error) {
      console.error('Error in calculateBaselineVisualOffsets:', error);
      return positions; // fallback to original positions
    }
  }
  /**
   * Calculate visual project dates
   * Delegates to existing calculation service
   */
  static calculateVisualProjectDates(
    project: any,
    isDragging: boolean,
    dragState: any
  ) {
    try {
      return calculateVisualProjectDates(project, isDragging, dragState);
    } catch (error) {
      console.error('Error in calculateVisualProjectDates:', error);
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
  static getCachedWorkingDayChecker(weeklyWorkHours: any, holidays: any[]) {
    return useCachedWorkingDayChecker(weeklyWorkHours, holidays);
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
    project: any,
    dates: Date[],
    viewportStart: Date,
    viewportEnd: Date,
    milestones: Milestone[],
    holidays: any[],
    settings: any,
    isDragging: boolean = false,
    dragState: any = null,
    isWorkingDayChecker?: (date: Date) => boolean, // Accept the hook result as parameter
    events?: any[] // Add events parameter for planned time calculations
  ) {
    // Calculate day estimates using new service (now includes planned events)
    const dayEstimates = this.calculateProjectDayEstimates(
      project,
      milestones,
      settings,
      holidays,
      events || [] // Pass events to calculation
    );
    
    const projectDays = this.calculateProjectDays(
      project.startDate,
      project.endDate,
      project.continuous,
      viewportStart,
      viewportEnd
    );
    
    return {
      // Project basics
      projectData: this.getProjectTimelineData(project),
      // Timeline calculations
      projectDays,
      // Work hours
      workHoursForPeriod: this.generateProjectWorkHours(project, settings, viewportEnd),
      // Day estimates (NEW - single source of truth)
      dayEstimates,
      // Milestone segments (DEPRECATED - kept for backward compatibility)
      milestoneSegments: this.calculateMilestoneSegments(
        milestones,
        new Date(project.startDate),
        new Date(project.endDate)
      ),
      // Metrics
      projectMetrics: this.calculateProjectMetrics(project, holidays),
      // Colors
      colorScheme: this.getProjectColorScheme(project.color),
      // Visual calculations (if dragging)
      visualDates: isDragging ? this.calculateVisualProjectDates(project, isDragging, dragState) : null,
      // Working day checker - use provided one or fall back to calling the hook (for backwards compatibility)
      isWorkingDay: isWorkingDayChecker || this.getCachedWorkingDayChecker(settings.weeklyWorkHours, holidays)
    };
  }
  // ============================================================================
  // AVAILABILITY CALCULATIONS (Extracted from UnifiedAvailabilityCircles.tsx)
  // ============================================================================
  /**
   * Check if date is working day
   * Delegates to existing holiday service
   */
  static isWorkingDay(date: Date, holidays: any[], settings: any) {
    if (isHolidayDateCapacity(date, holidays)) {
      return false;
    }
    // Delegate to pure calculation function - consistent with getWorkHoursForDay
    const dayName = getDayName(date);
    const dayData = settings.weeklyWorkHours[dayName];
    if (Array.isArray(dayData)) {
      return this.calculateWorkHoursTotal(dayData) > 0;
    }
    return typeof dayData === 'number' ? dayData > 0 : false;
  }
  /**
   * Get expanded holiday dates
   * Delegates to existing service
   */
  static getExpandedHolidayDates(holidays: any[]) {
    return expandHolidayDates(holidays);
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
   * Calculate availability circle size
   * Delegates to existing service
   */
  static calculateAvailabilityCircleSize = calculateAvailabilityCircleSize;
  /**
   * Get minimum circle dimensions
   * Delegates to existing service
   */
  static getMinimumCircleDimensions = getMinimumCircleDimensions;
  /**
   * Check if date is holiday
   * Delegates to existing service
   */
  static isHolidayDateCapacity = isHolidayDateCapacity;
  /**
   * Calculate daily project hours for a date
   * Uses same logic as project bars - includes milestone allocations, events, and auto-estimates
   */
  static calculateDailyProjectHours(date: Date, projects: any[], settings: any, holidays: any[], milestones: any[] = [], events: any[] = []) {
    let totalHours = 0;
    if (!this.isWorkingDay(date, holidays, settings)) {
      return 0;
    }
    // Import dynamically to avoid circular dependencies
    // const { calculateProjectDayEstimates } = require('../calculations/dayEstimateCalculations');
    // Normalize date to midnight for comparison
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const dateKey = targetDate.toDateString();
    
    // Calculate day estimates for each project (same logic as project bars)
    projects.forEach((project: any) => {
      const projectStart = new Date(project.startDate);
      projectStart.setHours(0, 0, 0, 0);
      const projectEnd = project.continuous ? new Date('2099-12-31') : new Date(project.endDate);
      projectEnd.setHours(23, 59, 59, 999);
      
      // Only process if date is within project range
      if (targetDate >= projectStart && targetDate <= projectEnd) {
        // Get milestones for this project
        const projectMilestones = milestones.filter((m: any) => m.projectId === project.id);
        // Get events for this project
        const projectEvents = events.filter((e: any) => e.projectId === project.id);
        
        // Calculate day estimates using the same method as project bars
        const dayEstimates = calculateProjectDayEstimates(
          project,
          projectMilestones,
          settings,
          holidays,
          projectEvents
        );
        
        // Find estimate for this specific date
        const estimateForDate = dayEstimates.find((est: any) => {
          const estDate = new Date(est.date);
          estDate.setHours(0, 0, 0, 0);
          return estDate.toDateString() === dateKey;
        });
        if (estimateForDate) {
          // Count ALL project time: events, milestones, and auto-estimates
          totalHours += estimateForDate.hours;
        } else {
        }
      } else {
      }
    });
    
    return totalHours;
  }
  /**
   * Get work hours for a specific day
   * Delegates to existing calculation services
   */
  static getWorkHoursForDay(date: Date, holidays: any[], settings: any) {
    if (this.isHolidayDateCapacity(date, holidays)) {
      return 0;
    }
    // Delegate to pure calculation function
    const dayName = getDayName(date);
    const dayData = settings.weeklyWorkHours[dayName];
    if (Array.isArray(dayData)) {
      return this.calculateWorkHoursTotal(dayData);
    }
    return typeof dayData === 'number' ? dayData : 0;
  }
  /**
   * Calculate daily available hours after accounting for events
   * Delegates to existing calculation services
   */
  static calculateDailyAvailableHours(date: Date, events: any[], settings: any, holidays: any[]) {
    const workHours = this.getWorkHoursForDay(date, holidays, settings);
    if (workHours === 0) {
      return 0;
    }
    const workHourObjects = this.generateWorkHoursForDate(date, settings);
    const eventReduction = calculateAvailabilityReduction(date, events, workHourObjects);
    return Math.max(0, workHours - eventReduction);
  }
  /**
   * Calculate overtime planned hours
   * Delegates to existing calculation service
   */
  static calculateOvertimePlannedHours(date: Date, events: any[], settings: any) {
    const workHours = this.generateWorkHoursForDate(date, settings);
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
    projects: any[],
    settings: any,
    holidays: any[],
    events: any[],
    type: string,
    mode: string = 'days',
    displayMode: string = 'circles'
  ) {
    return {
      // Basic data
      dates,
      columnWidth: mode === 'weeks' ? 77 : 52,
      expandedHolidays: this.getExpandedHolidayDates(holidays),
      // Helper methods for components
      isWorkingDay: (date: Date) => this.isWorkingDay(date, holidays, settings),
      generateWorkHours: (date: Date) => this.generateWorkHoursForDate(date, settings),
      calculateTotal: (workHours: any[]) => this.calculateWorkHoursTotal(workHours),
      isHoliday: (date: Date) => this.isHolidayDateCapacity(date, holidays),
      // Display settings
      displayMode,
      mode
    };
  }
  // ============================================================================
  // PLACEHOLDER METHODS (To be implemented as we extract from components)
  // ============================================================================
  /**
   * Placeholder for visual calculations - to be implemented
   * as we extract logic from timeline components
   */
  static getVisualData(project: Project, dates: Date[]) {
    // TODO: Extract from TimelineBar component
    return {
      message: 'To be implemented - extract from TimelineBar'
    };
  }
}
// Export singleton instance following the pattern
export const timelineService = UnifiedTimelineService;
