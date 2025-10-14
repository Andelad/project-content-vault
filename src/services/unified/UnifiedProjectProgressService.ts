/**
 * Project Progress Service
 * 
 * Handles all project progress calculations, milestone analysis, and timeline progression.
 * Extracted from legacy progress services for better organization.
 * 
 * Architecture: Domain -> Calculations -> Orchestrators -> Validators -> Repository
 */

import { Project, CalendarEvent, Holiday, Settings, Milestone } from '@/types/core';
import { calculateDurationDays } from '@/services/calculations/dateCalculations';
import { APP_LOCALE } from '@/utils/dateFormatUtils';
import {
  ProjectEvent,
  MilestoneWithProgress,
  DataPoint,
  ComprehensiveProjectTimeMetrics,
  calculateProjectDuration,
  getProjectEvents,
  calculateEventDurationHours,
  buildPlannedTimeMap,
  getPlannedTimeUpToDate,
  getCompletedTimeUpToDate,
  getRelevantMilestones,
  calculateProgressPercentage,
  calculateProjectTimeMetrics
} from '../calculations/projectOperations';

// =====================================================================================
// TYPES & INTERFACES
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

// =====================================================================================
// PROJECT PROGRESS ANALYSIS
// =====================================================================================

/**
 * Calculate estimated progress for a specific date using milestone interpolation
 */
export function getEstimatedProgressForDate(
  targetDate: Date,
  project: Project,
  milestones: Milestone[]
): number {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const relevantMilestones = getRelevantMilestones(milestones, project.id);
  
  if (relevantMilestones.length === 0) {
    // No milestones, use linear interpolation
    // ✅ DELEGATE to domain layer - no manual date math!
    const totalDays = calculateDurationDays(startDate, endDate);
    const targetDays = calculateDurationDays(startDate, targetDate);
    
    if (totalDays === 0) return 0;
    const progressRatio = Math.min(1, Math.max(0, targetDays / totalDays));
    return project.estimatedHours * progressRatio;
  }
  
  // Find the milestone segment this date falls into
  let prevDate = startDate;
  let prevHours = 0;
  
  for (const milestone of relevantMilestones) {
    const milestoneDate = new Date(milestone.dueDate);
    
    if (targetDate <= milestoneDate) {
      // Target date is within this segment, interpolate
      // ✅ DELEGATE to domain layer - no manual date math!
      const segmentDays = calculateDurationDays(prevDate, milestoneDate);
      const targetDays = calculateDurationDays(prevDate, targetDate);
      
      if (segmentDays === 0) return prevHours + milestone.timeAllocation;
      
      const progressRatio = targetDays / segmentDays;
      return prevHours + (milestone.timeAllocation * progressRatio);
    }
    
    // Move to next segment
    prevDate = milestoneDate;
    prevHours += milestone.timeAllocation;
  }
  
  // Target date is after all milestones, interpolate to end date
  const segmentDays = Math.ceil((endDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
  const targetDays = Math.ceil((targetDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (segmentDays === 0) return project.estimatedHours;
  
  const remainingHours = project.estimatedHours - prevHours;
  const progressRatio = Math.min(1, targetDays / segmentDays);
  return prevHours + (remainingHours * progressRatio);
}

/**
 * Calculate progress data points for the entire project timeline
 */
export function calculateProjectProgressData(
  project: Project,
  events: ProjectEvent[],
  milestones: Milestone[] = [],
  options: ProgressCalculationOptions = {}
): DataPoint[] {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const totalDays = calculateProjectDuration(project);
  
  if (totalDays <= 0) return [];
  
  const projectEvents = getProjectEvents(events, project.id);
  const relevantMilestones = getRelevantMilestones(milestones, project.id);
  const data: DataPoint[] = [];
  
  // Add starting point
  const completedTimeAtStart = getCompletedTimeUpToDate(projectEvents, project.id, startDate);
  
  data.push({
    date: new Date(startDate),
    estimatedProgress: 0,
    completedTime: completedTimeAtStart,
    plannedTime: getPlannedTimeUpToDate(events, project.id, startDate)
  });
  
  if (relevantMilestones.length > 0) {
    // Add milestone points
    let cumulativeEstimatedHours = 0;
    
    relevantMilestones.forEach((milestone) => {
      const milestoneDate = new Date(milestone.dueDate);
      cumulativeEstimatedHours += milestone.timeAllocation;
      
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
 */
export function isProjectOnTrack(
  project: Project,
  events: ProjectEvent[],
  milestones: Milestone[] = [],
  currentDate: Date = new Date()
): boolean {
  const expectedProgress = getEstimatedProgressForDate(currentDate, project, milestones);
  const actualProgress = getCompletedTimeUpToDate(events, project.id, currentDate);
  
  // Consider on track if within 10% of expected progress
  const tolerance = expectedProgress * 0.1;
  return actualProgress >= (expectedProgress - tolerance);
}

/**
 * Calculate comprehensive project status
 */
export function calculateProjectStatus(project: Project): ProjectStatus {
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
    // Check if completed
    // This would need actual completion data - simplified for now
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

// =====================================================================================
// PROGRESS ANALYSIS FUNCTIONS
// =====================================================================================

/**
 * Analyze project progress with detailed metrics
 */
export function analyzeProjectProgress(
  project: Project,
  events: CalendarEvent[],
  milestones: MilestoneWithProgress[],
  holidays: Holiday[],
  settings: Settings
): {
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
} {
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
  const progressData = calculateProjectProgressData(project, projectEvents, milestones);
  const status = calculateProjectStatus(project);
  const isOnTrack = isProjectOnTrack(project, projectEvents, milestones);

  // Analyze milestone progress
  const relevantMilestones = getRelevantMilestones(milestones, project.id);
  const today = new Date();
  
  const milestoneProgress = relevantMilestones.map(milestone => {
    const dueDate = new Date(milestone.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const expectedProgress = getEstimatedProgressForDate(today, project, milestones);
    const actualProgress = getCompletedTimeUpToDate(projectEvents, project.id, today); // Fix function call
    
    return {
      milestone,
      isCompleted: milestone.completed || false,
      daysUntilDue,
      progressToward: milestone.timeAllocation > 0 ? (actualProgress / milestone.timeAllocation) * 100 : 0
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

// =====================================================================================
// LEGACY COMPATIBILITY FUNCTIONS 
// =====================================================================================

// Legacy interfaces for backward compatibility with ProjectProgressGraph component
export interface ProgressGraphCalculationOptions {
  project: Project;
  events: CalendarEvent[];
  milestones?: Milestone[];
  includeEventDatePoints?: boolean;
  maxDataPoints?: number;
}

export interface ProgressDataPoint {
  date: Date;
  estimatedProgress: number;
  completedTime: number;
  plannedTime: number;
}

export interface ProjectProgressAnalysis {
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

/**
 * Legacy compatibility wrapper for analyzeProjectProgress
 * Maintains backward compatibility with existing ProjectProgressGraph component
 * Migrated from legacy projectProgressGraphService
 */
export function analyzeProjectProgressLegacy(options: ProgressGraphCalculationOptions): ProjectProgressAnalysis {
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

  const relevantMilestones = getRelevantMilestones(milestones, project.id);
  const progressMethod = relevantMilestones.length > 0 ? 'milestone' : 'linear';
  
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
    relevantMilestones.forEach(milestone => {
      cumulativeHours += milestone.timeAllocation;
      const milestoneDate = new Date(milestone.dueDate);
      
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

// =====================================================================================
// EXPORTS (for backward compatibility)
// =====================================================================================

// Re-export key calculation functions for convenience
export {
  calculateProjectDuration,
  getProjectEvents,
  calculateEventDurationHours,
  buildPlannedTimeMap,
  getPlannedTimeUpToDate,
  getCompletedTimeUpToDate,
  calculateProgressPercentage,
  getRelevantMilestones,
  calculateProjectTimeMetrics
} from '../calculations/projectOperations';
