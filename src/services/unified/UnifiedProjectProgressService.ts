/**
 * UNIFIED PROJECT PROGRESS SERVICE
 * 
 * RESPONSIBILITY: Project progress tracking and analysis with actual work data
 * 
 * USE WHEN:
 * - Tracking actual work progress vs estimated progress
 * - Analyzing "on track" status with calendar events
 * - Generating progress graphs and data points
 * - Calculating comprehensive time metrics with work hours
 * - Milestone progress analysis with actual completion data
 * 
 * DON'T USE WHEN:
 * - You need simple time-based calculations → Use UnifiedProjectService
 * - You need day-by-day timeline rendering → Use UnifiedDayEstimateService
 * - You need budget analysis without events → Use UnifiedProjectService
 * 
 * KEY DISTINCTION FROM UnifiedProjectService:
 * - This service requires calendar events/work hours for progress tracking
 * - UnifiedProjectService only needs project properties (no event data)
 * 
 * DELEGATES TO:
 * - calculations/projectOperations (progress calculations)
 * - calculations/dateCalculations (date math)
 * 
 * @see UnifiedProjectService for project entity calculations (no events needed)
 * @see UnifiedDayEstimateService for day-by-day timeline calculations
 * @see UnifiedTimelineService for timeline UI coordination
 */

import { Project, CalendarEvent, Holiday, Settings, Phase } from '@/types/core';
import { calculateDurationDays } from '@/services/calculations/general/dateCalculations';
import {
  ProjectEvent,
  MilestoneWithProgress,
  DataPoint,
  ComprehensiveProjectTimeMetrics,
  calculateProjectDuration,
  getProjectEvents,
  buildPlannedTimeMap,
  getPlannedTimeUpToDate,
  getCompletedTimeUpToDate,
  getRelevantMilestones,
  calculateProjectTimeMetrics
} from '../calculations/projects/projectEntityCalculations';

// =====================================================================================
// TYPE DEFINITIONS
// =====================================================================================

export interface ProgressCalculationOptions {
  includeIntermediatePoints?: boolean;
  interpolationSteps?: number;
}

export interface ProjectStatus {
  status: 'not-started' | 'in-progress' | 'completed' | 'overdue';
  health: 'on-track' | 'at-risk' | 'behind';
  progressPercentage: number;
  daysRemaining: number;
  estimatedCompletion: Date;
}

export interface ProjectProgressAnalysis {
  timeMetrics: ComprehensiveProjectTimeMetrics;
  progressData: DataPoint[];
  status: ProjectStatus;
  isOnTrack: boolean;
  milestoneProgress: Array<{
    milestone: MilestoneWithProgress;
    isCompleted: boolean;
    daysUntilDue: number;
    progressToward: number;
  }>;
}

// Legacy interfaces for backward compatibility
export interface ProgressGraphCalculationOptions {
  project: Project;
  events: CalendarEvent[];
  milestones?: Phase[];
  includeEventDatePoints?: boolean;
  maxDataPoints?: number;
}

export interface ProgressDataPoint {
  date: Date;
  estimatedProgress: number;
  completedTime: number;
  plannedTime: number;
}

export interface LegacyProjectProgressAnalysis {
  progressData: ProgressDataPoint[];
  maxHours: number;
  totalDays: number;
  progressMethod: 'milestone' | 'linear';
  completionRate: number;
  estimatedCompletionDate: Date | null;
  isOnTrack: boolean;
  variance: {
    estimatedVsCompleted: number;
    plannedVsCompleted: number;
    estimatedVsPlanned: number;
    overallVariance: number;
  };
  trends: {
    completionTrend: 'accelerating' | 'steady' | 'declining';
    milestoneComplianceRate: number;
    averageDailyCompletion: number;
    projectedOverrun: number;
  };
}

// =====================================================================================
// UNIFIED PROJECT PROGRESS SERVICE - CLASS-BASED PATTERN
// =====================================================================================

/**
 * Unified Project Progress Service
 * 
 * Single source of truth for project progress tracking with actual work data.
 * All methods are static - this is a service class, not an entity.
 */
export class UnifiedProjectProgressService {
  
  // ===================================================================================
  // ESTIMATED PROGRESS CALCULATIONS (Milestone-based interpolation)
  // ===================================================================================
  
  /**
   * Calculate estimated progress for a specific date using milestone interpolation
   * Returns expected hours that should be completed by target date
   */
  static getEstimatedProgress(
    targetDate: Date,
    project: Project,
    phases: Phase[]
  ): number {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    const relevantPhases = getRelevantMilestones(phases, project.id);
    
    if (relevantPhases.length === 0) {
      // No phases, use linear interpolation
      const totalDays = calculateDurationDays(startDate, endDate);
      const targetDays = calculateDurationDays(startDate, targetDate);
      
      if (totalDays === 0) return 0;
      const progressRatio = Math.min(1, Math.max(0, targetDays / totalDays));
      return project.estimatedHours * progressRatio;
    }
    
    // Find the milestone segment this date falls into
    let prevDate = startDate;
    let prevHours = 0;
    
    for (const phase of relevantPhases) {
      const milestoneDate = milestone.endDate || milestone.dueDate;
      const timeAllocation = milestone.timeAllocationHours ?? milestone.timeAllocation;
      
      if (targetDate <= milestoneDate) {
        // Target date is within this segment, interpolate
        const segmentDays = calculateDurationDays(prevDate, milestoneDate);
        const targetDays = calculateDurationDays(prevDate, targetDate);
        
        if (segmentDays === 0) return prevHours + timeAllocation;
        
        const progressRatio = targetDays / segmentDays;
        return prevHours + (timeAllocation * progressRatio);
      }
      
      // Move to next segment
      prevDate = milestoneDate;
      prevHours += timeAllocation;
    }
    
    // Target date is after all phases, interpolate to end date
    const segmentDays = Math.ceil((endDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    const targetDays = Math.ceil((targetDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (segmentDays === 0) return project.estimatedHours;
    
    const remainingHours = project.estimatedHours - prevHours;
    const progressRatio = Math.min(1, targetDays / segmentDays);
    return prevHours + (remainingHours * progressRatio);
  }
  
  // ===================================================================================
  // PROGRESS DATA & ANALYSIS
  // ===================================================================================
  
  /**
   * Calculate progress data points for the entire project timeline
   * Used for rendering progress charts/graphs
   */
  static calculateProgressData(
    project: Project,
    events: ProjectEvent[],
    phases: Phase[] = [],
    options: ProgressCalculationOptions = {}
  ): DataPoint[] {
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    const totalDays = calculateProjectDuration(project);
    
    if (totalDays <= 0) return [];
    
    const projectEvents = getProjectEvents(events, project.id);
    const relevantPhases = getRelevantMilestones(phases, project.id);
    const data: DataPoint[] = [];
    
    // Add starting point
    const completedTimeAtStart = getCompletedTimeUpToDate(projectEvents, project.id, startDate);
    
    data.push({
      date: new Date(startDate),
      estimatedProgress: 0,
      completedTime: completedTimeAtStart,
      plannedTime: getPlannedTimeUpToDate(events, project.id, startDate)
    });
    
    if (relevantPhases.length > 0) {
      // Add milestone points
      let cumulativeEstimatedHours = 0;
      
      relevantPhases.forEach((milestone) => {
        const milestoneDate = milestone.endDate || milestone.dueDate;
        const timeAllocation = milestone.timeAllocationHours ?? milestone.timeAllocation;
        cumulativeEstimatedHours += timeAllocation;
        
        const completedTimeAtMilestone = getCompletedTimeUpToDate(projectEvents, project.id, milestoneDate);
        
        data.push({
          date: new Date(milestoneDate),
          estimatedProgress: cumulativeEstimatedHours,
          completedTime: completedTimeAtMilestone,
          plannedTime: getPlannedTimeUpToDate(events, project.id, milestoneDate)
        });
      });
    }
    
    // Add end point
    const completedTimeAtEnd = getCompletedTimeUpToDate(projectEvents, project.id, endDate);
    
    data.push({
      date: new Date(endDate),
      estimatedProgress: project.estimatedHours,
      completedTime: completedTimeAtEnd,
      plannedTime: getPlannedTimeUpToDate(events, project.id, endDate)
    });
    
    return data;
  }
  
  /**
   * Check if project is on track based on current date and progress
   * Compares actual completed hours vs expected hours at current date
   */
  static isOnTrack(
    project: Project,
    events: ProjectEvent[],
    phases: Phase[] = [],
    currentDate: Date = new Date()
  ): boolean {
    const expectedProgress = this.getEstimatedProgress(currentDate, project, milestones);
    const actualProgress = getCompletedTimeUpToDate(events, project.id, currentDate);
    
    // Consider on track if within 10% of expected progress
    const tolerance = expectedProgress * 0.1;
    return actualProgress >= (expectedProgress - tolerance);
  }
  
  /**
   * Calculate comprehensive project status
   */
  static calculateStatus(project: Project): ProjectStatus {
    const now = new Date();
    const startDate = new Date(project.startDate);
    const endDate = new Date(project.endDate);
    
    // Determine project status
    let status: ProjectStatus['status'];
    if (now < startDate) {
      status = 'not-started';
    } else if (now > endDate) {
      status = 'overdue';
    } else {
      status = 'in-progress';
    }
    
    // Calculate days remaining
    const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate progress percentage (simplified - would need actual events)
    const totalDays = calculateProjectDuration(project);
    const elapsedDays = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const progressPercentage = totalDays > 0 ? Math.min(100, (elapsedDays / totalDays) * 100) : 0;
    
    // Determine health based on progress vs time elapsed
    let health: ProjectStatus['health'];
    if (progressPercentage >= 90) {
      health = 'on-track';
    } else if (progressPercentage >= 70) {
      health = 'at-risk';
    } else {
      health = 'behind';
    }
    
    return {
      status,
      health,
      progressPercentage,
      daysRemaining,
      estimatedCompletion: endDate
    };
  }
  
  // ===================================================================================
  // COMPREHENSIVE PROGRESS ANALYSIS
  // ===================================================================================
  
  /**
   * Analyze project progress with detailed metrics
   * Combines time metrics, progress data, status, and milestone progress
   */
  static analyzeProgress(
    project: Project,
    events: CalendarEvent[],
    phases: MilestoneWithProgress[],
    holidays: Holiday[],
    settings: Settings
  ): ProjectProgressAnalysis {
    // Convert CalendarEvent[] to ProjectEvent[] for progress calculations
    const projectEvents: ProjectEvent[] = events
      .filter(event => event.projectId === project.id)
      .map(event => ({
        id: event.id,
        projectId: event.projectId,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime || event.startTime),
        completed: event.completed || false
      }));

    const timeMetrics = calculateProjectTimeMetrics(project, projectEvents, holidays, new Date());
    const progressData = this.calculateProgressData(project, projectEvents, milestones);
    const status = this.calculateStatus(project);
    const isOnTrack = this.isOnTrack(project, projectEvents, milestones);

    // Analyze milestone progress
    const relevantPhases = getRelevantMilestones(phases, project.id);
    const today = new Date();
    
    const milestoneProgress = relevantPhases.map(phase => {
      const dueDate = milestone.endDate || milestone.dueDate;
      const timeAllocation = milestone.timeAllocationHours ?? milestone.timeAllocation;
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const actualProgress = getCompletedTimeUpToDate(projectEvents, project.id, today);
      
      return {
        milestone,
        isCompleted: milestone.completed || false,
        daysUntilDue,
        progressToward: timeAllocation > 0 ? (actualProgress / timeAllocation) * 100 : 0
      };
    });

    return {
      timeMetrics,
      progressData,
      status,
      isOnTrack,
      milestoneProgress
    };
  }
  
  // ===================================================================================
  // LEGACY COMPATIBILITY (for ProjectProgressGraph component)
  // ===================================================================================
  
  /**
   * Legacy compatibility wrapper for existing ProjectProgressGraph component
   * @deprecated Use analyzeProgress() for new implementations
   */
  static analyzeProgressLegacy(options: ProgressGraphCalculationOptions): LegacyProjectProgressAnalysis {
  const { project, events, milestones = [] } = options;
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Convert events to internal format
  const projectEvents: ProjectEvent[] = events
    .filter(event => event.projectId === project.id)
    .map(event => ({
      id: event.id,
      projectId: event.projectId,
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime || event.startTime),
      completed: event.completed || false
    }));

  const relevantPhases = getRelevantMilestones(phases, project.id);
  const progressMethod = relevantPhases.length > 0 ? 'milestone' : 'linear';
  
  // Generate progress data points
  const progressData: ProgressDataPoint[] = [];
  const plannedTimeMap = buildPlannedTimeMap(projectEvents, project.id, startDate, endDate);
  
  if (progressMethod === 'milestone') {
    // Add data points for each milestone
    let cumulativeHours = 0;
    
    // Add starting point
    progressData.push({
      date: new Date(startDate),
      estimatedProgress: 0,
      completedTime: getCompletedTimeUpToDate(projectEvents, project.id, startDate),
      plannedTime: getPlannedTimeUpToDate(projectEvents, project.id, startDate)
    });
    
    // Add milestone points
    relevantPhases.forEach(milestone => {
      const timeAllocation = milestone.timeAllocationHours ?? milestone.timeAllocation;
      const milestoneDate = milestone.endDate || milestone.dueDate;
      cumulativeHours += timeAllocation;
      
      progressData.push({
        date: new Date(milestoneDate),
        estimatedProgress: cumulativeHours,
        completedTime: getCompletedTimeUpToDate(projectEvents, project.id, milestoneDate),
        plannedTime: getPlannedTimeUpToDate(projectEvents, project.id, milestoneDate)
      });
    });
    
    // Add end point
    progressData.push({
      date: new Date(endDate),
      estimatedProgress: project.estimatedHours,
      completedTime: getCompletedTimeUpToDate(projectEvents, project.id, endDate),
      plannedTime: getPlannedTimeUpToDate(projectEvents, project.id, endDate)
    });
  } else {
    // Linear progression
    const maxPoints = options.maxDataPoints || 20;
    const samplePoints = Math.min(maxPoints, totalDays);
    const dailyRate = project.estimatedHours / Math.max(1, totalDays);
    
    for (let i = 0; i <= samplePoints; i++) {
      const dayIndex = Math.floor((i / samplePoints) * totalDays);
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + dayIndex);
      
      const estimatedProgress = Math.min(project.estimatedHours, dailyRate * dayIndex);
      
      progressData.push({
        date: new Date(currentDate),
        estimatedProgress,
        completedTime: getCompletedTimeUpToDate(projectEvents, project.id, currentDate),
        plannedTime: getPlannedTimeUpToDate(projectEvents, project.id, currentDate)
      });
    }
  }
  
  // Calculate metrics
  const maxHours = Math.max(
    project.estimatedHours,
    Math.max(...progressData.map(d => d.completedTime), 0),
    Math.max(...progressData.map(d => d.plannedTime), 0),
    1
  );
  
  const latestPoint = progressData[progressData.length - 1];
  const completionRate = latestPoint ? (latestPoint.completedTime / project.estimatedHours) * 100 : 0;
  
  // Calculate trends
  const trends = {
    completionTrend: 'steady' as const,
    milestoneComplianceRate: 0,
    averageDailyCompletion: 0,
    projectedOverrun: 0
  };
  
  if (progressData.length > 1) {
    const recentPoints = progressData.slice(-5);
    const completedDiff = recentPoints[recentPoints.length - 1].completedTime - recentPoints[0].completedTime;
    const daysDiff = Math.max(1, Math.ceil((recentPoints[recentPoints.length - 1].date.getTime() - recentPoints[0].date.getTime()) / (1000 * 60 * 60 * 24)));
    trends.averageDailyCompletion = completedDiff / daysDiff;
    
    if (trends.averageDailyCompletion > 0 && latestPoint) {
      const remainingHours = project.estimatedHours - latestPoint.completedTime;
      const projectedDays = remainingHours / trends.averageDailyCompletion;
      const remainingDays = Math.ceil((endDate.getTime() - latestPoint.date.getTime()) / (1000 * 60 * 60 * 24));
      trends.projectedOverrun = Math.max(0, projectedDays - remainingDays);
    }
  }
  
  // Estimate completion date
  const estimatedCompletionDate = trends.averageDailyCompletion > 0 && latestPoint
    ? new Date(latestPoint.date.getTime() + 
        ((project.estimatedHours - latestPoint.completedTime) / trends.averageDailyCompletion) * 24 * 60 * 60 * 1000)
    : null;
  
  const isOnTrack = estimatedCompletionDate ? estimatedCompletionDate <= endDate : completionRate >= 90;
  
  // Calculate variance
  const variance = {
    estimatedVsCompleted: 0,
    plannedVsCompleted: 0,
    estimatedVsPlanned: 0,
    overallVariance: 0
  };
  
  if (latestPoint) {
    variance.estimatedVsCompleted = latestPoint.estimatedProgress - latestPoint.completedTime;
    variance.plannedVsCompleted = latestPoint.plannedTime - latestPoint.completedTime;
    variance.estimatedVsPlanned = latestPoint.estimatedProgress - latestPoint.plannedTime;
    variance.overallVariance = Math.abs(variance.estimatedVsCompleted) + 
                              Math.abs(variance.plannedVsCompleted) + 
                              Math.abs(variance.estimatedVsPlanned);
  }
  
    return {
      progressData,
      maxHours,
      totalDays,
      progressMethod,
      completionRate,
      estimatedCompletionDate,
      isOnTrack,
      variance,
      trends
    };
  }
}

// =====================================================================================
// BACKWARD COMPATIBILITY - Legacy Function Exports
// =====================================================================================

/**
 * @deprecated Use UnifiedProjectProgressService.getEstimatedProgress() instead
 */
export function getEstimatedProgressForDate(
  targetDate: Date,
  project: Project,
  phases: Phase[]
): number {
  return UnifiedProjectProgressService.getEstimatedProgress(targetDate, project, milestones);
}

/**
 * @deprecated Use UnifiedProjectProgressService.calculateProgressData() instead
 */
export function calculateProjectProgressData(
  project: Project,
  events: ProjectEvent[],
  phases: Phase[] = [],
  options: ProgressCalculationOptions = {}
): DataPoint[] {
  return UnifiedProjectProgressService.calculateProgressData(project, events, phases, options);
}

/**
 * @deprecated Use UnifiedProjectProgressService.isOnTrack() instead
 */
export function isProjectOnTrack(
  project: Project,
  events: ProjectEvent[],
  phases: Phase[] = [],
  currentDate: Date = new Date()
): boolean {
  return UnifiedProjectProgressService.isOnTrack(project, events, phases, currentDate);
}

/**
 * @deprecated Use UnifiedProjectProgressService.calculateStatus() instead
 */
export function calculateProjectStatus(project: Project): ProjectStatus {
  return UnifiedProjectProgressService.calculateStatus(project);
}

/**
 * @deprecated Use UnifiedProjectProgressService.analyzeProgress() instead
 */
export function analyzeProjectProgress(
  project: Project,
  events: CalendarEvent[],
  phases: MilestoneWithProgress[],
  holidays: Holiday[],
  settings: Settings
): ProjectProgressAnalysis {
  return UnifiedProjectProgressService.analyzeProgress(project, events, phases, holidays, settings);
}

/**
 * @deprecated Use UnifiedProjectProgressService.analyzeProgressLegacy() instead
 */
export function analyzeProjectProgressLegacy(options: ProgressGraphCalculationOptions): LegacyProjectProgressAnalysis {
  return UnifiedProjectProgressService.analyzeProgressLegacy(options);
}

// =====================================================================================
// RE-EXPORTS (for convenience)
// =====================================================================================

// Re-export key calculation functions for convenience
export {
  calculateProjectDuration,
  getProjectEvents,
  buildPlannedTimeMap,
  getPlannedTimeUpToDate,
  getCompletedTimeUpToDate,
  getRelevantMilestones,
  calculateProjectTimeMetrics,
  type ProjectEvent,
  type MilestoneWithProgress,
  type DataPoint,
  type ComprehensiveProjectTimeMetrics
} from '../calculations/projects/projectEntityCalculations';