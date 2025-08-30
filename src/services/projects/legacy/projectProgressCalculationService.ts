/**
 * Project Progress Calculation Service
 * 
 * This service handles complex project progress calculations including milestone-based
 * progress tracking, event analysis, timeline interpolation, and progress graph data
 * generation. It provides comprehensive analytics for project completion status and
 * predicted completion based on different calculation methodologies.
 * 
 * Key Features:
 * - Milestone-based progress calculations with linear interpolation
 * - Event completion tracking and planned time analysis
 * - Linear progression fallback for projects without milestones
 * - Progress graph data point generation with step functions
 * - Comprehensive project analytics and metrics calculation
 * - Timeline completion predictions and variance analysis
 * 
 * @module ProjectProgressCalculationService
 */

import type { Project, CalendarEvent, Milestone } from '@/types';

/**
 * Interface for a single progress data point
 */
export interface ProgressDataPoint {
  date: Date;
  estimatedProgress: number;
  completedTime: number;
  plannedTime: number;
}

/**
 * Interface for progress calculation options
 */
export interface ProgressCalculationOptions {
  project: Project;
  events: CalendarEvent[];
  milestones?: Milestone[];
  includeEventDatePoints?: boolean;
  maxDataPoints?: number;
}

/**
 * Interface for comprehensive progress analysis
 */
export interface ProjectProgressAnalysis {
  progressData: ProgressDataPoint[];
  maxHours: number;
  totalDays: number;
  progressMethod: 'milestone' | 'linear';
  completionRate: number;
  estimatedCompletionDate: Date | null;
  isOnTrack: boolean;
  variance: ProgressVariance;
  trends: ProgressTrends;
}

/**
 * Interface for progress variance analysis
 */
export interface ProgressVariance {
  estimatedVsCompleted: number;
  plannedVsCompleted: number;
  estimatedVsPlanned: number;
  overallVariance: number;
}

/**
 * Interface for progress trend analysis
 */
export interface ProgressTrends {
  completionTrend: 'accelerating' | 'steady' | 'declining';
  milestoneComplianceRate: number;
  averageDailyCompletion: number;
  projectedOverrun: number;
}

/**
 * Calculate completed time up to a specific date
 * 
 * @param events - Array of project events
 * @param targetDate - The date to calculate up to
 * @param projectId - Project ID to filter events
 * @returns Total completed hours up to the target date
 */
export function calculateCompletedTimeUpToDate(
  events: CalendarEvent[],
  targetDate: Date,
  projectId: string
): number {
  return events
    .filter(event => {
      if (event.projectId !== projectId || !event.completed) return false;
      
      const eventDate = new Date(event.startTime);
      eventDate.setHours(0, 0, 0, 0);
      const target = new Date(targetDate);
      target.setHours(0, 0, 0, 0);
      
      return eventDate <= target;
    })
    .reduce((total, event) => {
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      return total + (durationMs / (1000 * 60 * 60));
    }, 0);
}

/**
 * Build a map of planned time by date
 * 
 * @param events - Array of project events
 * @param projectId - Project ID to filter events
 * @returns Map of date strings to planned hours
 */
export function buildPlannedTimeMap(
  events: CalendarEvent[],
  projectId: string
): Map<string, number> {
  const plannedTimeByDate = new Map<string, number>();
  
  events
    .filter(event => event.projectId === projectId)
    .forEach(event => {
      const eventDate = new Date(event.startTime);
      eventDate.setHours(0, 0, 0, 0);
      const dateString = eventDate.toISOString().split('T')[0];
      
      if (!plannedTimeByDate.has(dateString)) {
        plannedTimeByDate.set(dateString, 0);
      }
      
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      plannedTimeByDate.set(dateString, plannedTimeByDate.get(dateString)! + durationHours);
    });
  
  return plannedTimeByDate;
}

/**
 * Calculate cumulative planned time up to a specific date
 * 
 * @param plannedTimeMap - Map of planned time by date
 * @param targetDate - The date to calculate up to
 * @returns Total planned hours up to the target date
 */
export function getPlannedTimeUpToDate(
  plannedTimeMap: Map<string, number>,
  targetDate: Date
): number {
  let plannedTime = 0;
  const targetDateString = targetDate.toISOString().split('T')[0];
  
  for (const [dateString, hours] of plannedTimeMap.entries()) {
    if (dateString <= targetDateString) {
      plannedTime += hours;
    }
  }
  
  return plannedTime;
}

/**
 * Calculate milestone-based estimated progress for any date using linear interpolation
 * 
 * @param targetDate - The date to calculate progress for
 * @param project - Project details
 * @param milestones - Array of relevant milestones
 * @param startDate - Project start date
 * @param endDate - Project end date
 * @returns Interpolated estimated progress in hours
 */
export function calculateMilestoneBasedProgress(
  targetDate: Date,
  project: Project,
  milestones: Milestone[],
  startDate: Date,
  endDate: Date
): number {
  const relevantMilestones = milestones
    .filter(m => {
      const milestoneDate = new Date(m.dueDate);
      return milestoneDate >= startDate && milestoneDate <= endDate;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  let prevDate = startDate;
  let prevHours = 0;
  
  for (const milestone of relevantMilestones) {
    const milestoneDate = new Date(milestone.dueDate);
    
    if (targetDate <= milestoneDate) {
      // Target date is within this segment, interpolate
      const segmentDays = Math.ceil((milestoneDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      const targetDays = Math.ceil((targetDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
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
 * Generate milestone-based progress data points
 * 
 * @param options - Progress calculation options
 * @returns Array of progress data points
 */
export function generateMilestoneBasedProgressData(
  options: ProgressCalculationOptions
): ProgressDataPoint[] {
  const { project, events, milestones = [] } = options;
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const data: ProgressDataPoint[] = [];
  
  const relevantMilestones = milestones
    .filter(m => {
      const milestoneDate = new Date(m.dueDate);
      return milestoneDate >= startDate && milestoneDate <= endDate;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  
  const plannedTimeMap = buildPlannedTimeMap(events, project.id);
  let cumulativeEstimatedHours = 0;
  
  // Add starting point
  const completedTimeAtStart = calculateCompletedTimeUpToDate(events, startDate, project.id);
  data.push({
    date: new Date(startDate),
    estimatedProgress: 0,
    completedTime: completedTimeAtStart,
    plannedTime: getPlannedTimeUpToDate(plannedTimeMap, startDate)
  });
  
  // Add milestone points
  relevantMilestones.forEach((milestone) => {
    const milestoneDate = new Date(milestone.dueDate);
    cumulativeEstimatedHours += milestone.timeAllocation;
    
    const completedTimeAtMilestone = calculateCompletedTimeUpToDate(events, milestoneDate, project.id);
    
    data.push({
      date: new Date(milestoneDate),
      estimatedProgress: cumulativeEstimatedHours,
      completedTime: completedTimeAtMilestone,
      plannedTime: getPlannedTimeUpToDate(plannedTimeMap, milestoneDate)
    });
  });
  
  // Add end point if needed
  const lastMilestone = relevantMilestones[relevantMilestones.length - 1];
  if (!lastMilestone || new Date(lastMilestone.dueDate) < endDate) {
    const completedTimeAtEnd = calculateCompletedTimeUpToDate(events, endDate, project.id);
    
    data.push({
      date: new Date(endDate),
      estimatedProgress: project.estimatedHours,
      completedTime: completedTimeAtEnd,
      plannedTime: getPlannedTimeUpToDate(plannedTimeMap, endDate)
    });
  }
  
  // Add event date points if requested
  if (options.includeEventDatePoints !== false) {
    const existingDates = new Set(data.map(d => d.date.toISOString().split('T')[0]));
    const eventDates = Array.from(plannedTimeMap.keys())
      .map(dateString => new Date(dateString + 'T00:00:00.000Z'))
      .filter(date => 
        date >= startDate && 
        date <= endDate && 
        !existingDates.has(date.toISOString().split('T')[0])
      )
      .sort((a, b) => a.getTime() - b.getTime());
    
    eventDates.forEach(eventDate => {
      const estimatedProgress = calculateMilestoneBasedProgress(
        eventDate, 
        project, 
        relevantMilestones, 
        startDate, 
        endDate
      );
      
      const completedTime = calculateCompletedTimeUpToDate(events, eventDate, project.id);
      
      data.push({
        date: new Date(eventDate),
        estimatedProgress,
        completedTime,
        plannedTime: getPlannedTimeUpToDate(plannedTimeMap, eventDate)
      });
    });
  }
  
  // Sort by date
  data.sort((a, b) => a.date.getTime() - b.date.getTime());
  return data;
}

/**
 * Generate linear progression progress data points
 * 
 * @param options - Progress calculation options
 * @returns Array of progress data points
 */
export function generateLinearProgressData(
  options: ProgressCalculationOptions
): ProgressDataPoint[] {
  const { project, events } = options;
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const data: ProgressDataPoint[] = [];
  
  if (totalDays <= 0) return data;
  
  const dailyEstimatedRate = project.estimatedHours / Math.max(1, totalDays);
  const plannedTimeMap = buildPlannedTimeMap(events, project.id);
  
  // Generate sample points
  const maxPoints = options.maxDataPoints || 20;
  const samplePoints = Math.min(maxPoints, totalDays);
  
  for (let i = 0; i <= samplePoints; i++) {
    const dayIndex = Math.floor((i / samplePoints) * totalDays);
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + dayIndex);
    
    const estimatedProgress = Math.min(project.estimatedHours, dailyEstimatedRate * dayIndex);
    const completedTime = calculateCompletedTimeUpToDate(events, currentDate, project.id);
    
    data.push({
      date: currentDate,
      estimatedProgress,
      completedTime,
      plannedTime: getPlannedTimeUpToDate(plannedTimeMap, currentDate)
    });
  }
  
  // Add event date points if requested
  if (options.includeEventDatePoints !== false) {
    const existingDates = new Set(data.map(d => d.date.toISOString().split('T')[0]));
    const eventDates = Array.from(plannedTimeMap.keys())
      .map(dateString => new Date(dateString + 'T00:00:00.000Z'))
      .filter(date => 
        date >= startDate && 
        date <= endDate && 
        !existingDates.has(date.toISOString().split('T')[0])
      )
      .sort((a, b) => a.getTime() - b.getTime());
    
    eventDates.forEach(eventDate => {
      const dayIndex = Math.ceil((eventDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const estimatedProgress = Math.min(project.estimatedHours, dailyEstimatedRate * dayIndex);
      const completedTime = calculateCompletedTimeUpToDate(events, eventDate, project.id);
      
      data.push({
        date: new Date(eventDate),
        estimatedProgress,
        completedTime,
        plannedTime: getPlannedTimeUpToDate(plannedTimeMap, eventDate)
      });
    });
  }
  
  // Sort by date
  data.sort((a, b) => a.date.getTime() - b.date.getTime());
  return data;
}

/**
 * Calculate progress variance analysis
 * 
 * @param progressData - Array of progress data points
 * @returns Progress variance metrics
 */
export function calculateProgressVariance(progressData: ProgressDataPoint[]): ProgressVariance {
  if (progressData.length === 0) {
    return {
      estimatedVsCompleted: 0,
      plannedVsCompleted: 0,
      estimatedVsPlanned: 0,
      overallVariance: 0
    };
  }
  
  const latestPoint = progressData[progressData.length - 1];
  
  const estimatedVsCompleted = latestPoint.estimatedProgress > 0 
    ? ((latestPoint.completedTime - latestPoint.estimatedProgress) / latestPoint.estimatedProgress) * 100
    : 0;
  
  const plannedVsCompleted = latestPoint.plannedTime > 0
    ? ((latestPoint.completedTime - latestPoint.plannedTime) / latestPoint.plannedTime) * 100
    : 0;
  
  const estimatedVsPlanned = latestPoint.estimatedProgress > 0
    ? ((latestPoint.plannedTime - latestPoint.estimatedProgress) / latestPoint.estimatedProgress) * 100
    : 0;
  
  const overallVariance = Math.abs(estimatedVsCompleted) + Math.abs(plannedVsCompleted);
  
  return {
    estimatedVsCompleted,
    plannedVsCompleted,
    estimatedVsPlanned,
    overallVariance
  };
}

/**
 * Calculate progress trends
 * 
 * @param progressData - Array of progress data points
 * @param project - Project details
 * @returns Progress trend analysis
 */
export function calculateProgressTrends(
  progressData: ProgressDataPoint[],
  project: Project
): ProgressTrends {
  if (progressData.length < 2) {
    return {
      completionTrend: 'steady',
      milestoneComplianceRate: 100,
      averageDailyCompletion: 0,
      projectedOverrun: 0
    };
  }
  
  // Calculate completion trend based on recent data points
  const recentPoints = progressData.slice(-Math.min(5, progressData.length));
  const completionRates = recentPoints.slice(1).map((point, index) => {
    const prevPoint = recentPoints[index];
    const timeDiff = (point.date.getTime() - prevPoint.date.getTime()) / (1000 * 60 * 60 * 24);
    return timeDiff > 0 ? (point.completedTime - prevPoint.completedTime) / timeDiff : 0;
  });
  
  const avgRate = completionRates.length > 0 
    ? completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length
    : 0;
  
  const trendSlope = completionRates.length > 1
    ? (completionRates[completionRates.length - 1] - completionRates[0]) / completionRates.length
    : 0;
  
  const completionTrend = trendSlope > 0.1 ? 'accelerating' : 
                         trendSlope < -0.1 ? 'declining' : 'steady';
  
  // Calculate milestone compliance
  const milestonePoints = progressData.filter(point => 
    progressData.some(p => p.date.getTime() === point.date.getTime() && p.estimatedProgress > 0)
  );
  
  const complianceRate = milestonePoints.length > 0
    ? milestonePoints.filter(point => point.completedTime >= point.estimatedProgress * 0.9).length / milestonePoints.length * 100
    : 100;
  
  // Project completion
  const latestPoint = progressData[progressData.length - 1];
  const currentProgress = latestPoint.completedTime;
  const remainingWork = Math.max(0, project.estimatedHours - currentProgress);
  const projectedOverrun = avgRate > 0 ? Math.max(0, (remainingWork / avgRate) - 
    ((new Date(project.endDate).getTime() - latestPoint.date.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  
  return {
    completionTrend,
    milestoneComplianceRate: complianceRate,
    averageDailyCompletion: avgRate,
    projectedOverrun
  };
}

/**
 * Generate comprehensive project progress analysis
 * 
 * @param options - Progress calculation options
 * @returns Complete progress analysis with data and insights
 */
export function analyzeProjectProgress(options: ProgressCalculationOptions): ProjectProgressAnalysis {
  const { project, events, milestones = [] } = options;
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Determine calculation method
  const progressMethod = milestones.length > 0 ? 'milestone' : 'linear';
  
  // Generate progress data
  const progressData = progressMethod === 'milestone' 
    ? generateMilestoneBasedProgressData(options)
    : generateLinearProgressData(options);
  
  // Calculate metrics
  const maxHours = Math.max(
    project.estimatedHours,
    Math.max(...progressData.map(d => d.completedTime), 0),
    Math.max(...progressData.map(d => d.plannedTime), 0),
    1
  );
  
  const latestPoint = progressData[progressData.length - 1];
  const completionRate = latestPoint ? (latestPoint.completedTime / project.estimatedHours) * 100 : 0;
  
  // Estimate completion date
  const trends = calculateProgressTrends(progressData, project);
  const estimatedCompletionDate = trends.averageDailyCompletion > 0 && latestPoint
    ? new Date(latestPoint.date.getTime() + 
        ((project.estimatedHours - latestPoint.completedTime) / trends.averageDailyCompletion) * 24 * 60 * 60 * 1000)
    : null;
  
  const isOnTrack = estimatedCompletionDate ? estimatedCompletionDate <= endDate : completionRate >= 90;
  
  return {
    progressData,
    maxHours,
    totalDays,
    progressMethod,
    completionRate,
    estimatedCompletionDate,
    isOnTrack,
    variance: calculateProgressVariance(progressData),
    trends
  };
}
