/**
 * Project Progress Calculations
 * 
 * Extracted from projectProgressService.ts - handles project progress calculation logic
 * Part of unified calculations layer for consistent project progress tracking
 */

export interface ProjectEvent {
  id: string;
  projectId: string;
  startTime: Date;
  endTime: Date;
  completed: boolean;
}

export interface Milestone {
  id: string;
  dueDate: string | Date;
  timeAllocation: number;
  completed?: boolean;
}

export interface ProgressProject {
  id: string;
  startDate: string | Date;
  endDate: string | Date;
  estimatedHours: number;
}

export interface DataPoint {
  date: Date;
  estimatedProgress: number;
  completedTime: number;
  plannedTime: number;
}

export interface ProgressCalculationOptions {
  includeIntermediatePoints?: boolean;
  interpolationSteps?: number;
}

export interface ComprehensiveProjectTimeMetrics {
  totalEstimatedHours: number;
  totalCompletedHours: number;
  totalPlannedHours: number;
  progressPercentage: number;
  remainingHours: number;
  daysRemaining: number;
  averageHoursPerDay: number;
  isOnTrack: boolean;
  efficiency: number;
  milestoneProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

/**
 * Calculate total project duration in days
 */
export function calculateProjectDuration(project: ProgressProject): number {
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Filter events for a specific project
 */
export function filterProjectEvents(events: ProjectEvent[], projectId: string): ProjectEvent[] {
  return events.filter(event => event.projectId === projectId);
}

/**
 * Calculate completed time from events up to a specific date
 */
export function calculateCompletedTimeUpToDate(
  events: ProjectEvent[],
  projectId: string,
  upToDate: Date
): number {
  const projectEvents = filterProjectEvents(events, projectId).filter(event => 
    event.completed && new Date(event.endTime) <= upToDate
  );
  
  return projectEvents.reduce((total, event) => {
    const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    return total + duration;
  }, 0);
}

/**
 * Calculate planned time from events up to a specific date
 */
export function getPlannedTimeUpToDate(
  events: ProjectEvent[],
  projectId: string,
  upToDate: Date
): number {
  const projectEvents = filterProjectEvents(events, projectId).filter(event => 
    new Date(event.endTime) <= upToDate
  );
  
  return projectEvents.reduce((total, event) => {
    const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    return total + duration;
  }, 0);
}

/**
 * Build a map of planned time by date
 */
export function buildPlannedTimeMap(
  events: ProjectEvent[],
  projectId: string,
  startDate: Date,
  endDate: Date
): Map<string, number> {
  const plannedTimeMap = new Map<string, number>();
  const projectEvents = filterProjectEvents(events, projectId);
  
  // Initialize all dates with 0
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0];
    plannedTimeMap.set(dateKey, 0);
    current.setDate(current.getDate() + 1);
  }
  
  // Add planned time for each event
  projectEvents.forEach(event => {
    const eventDate = new Date(event.startTime);
    const dateKey = eventDate.toISOString().split('T')[0];
    
    if (plannedTimeMap.has(dateKey)) {
      const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
      const currentTime = plannedTimeMap.get(dateKey) || 0;
      plannedTimeMap.set(dateKey, currentTime + duration);
    }
  });
  
  return plannedTimeMap;
}

/**
 * Calculate comprehensive project time metrics
 */
export function calculateProjectTimeMetrics(
  project: ProgressProject,
  events: ProjectEvent[],
  milestones: Milestone[] = []
): ComprehensiveProjectTimeMetrics {
  const projectEvents = filterProjectEvents(events, project.id);
  const currentDate = new Date();
  
  // Calculate totals
  const totalEstimatedHours = project.estimatedHours;
  const totalCompletedHours = calculateCompletedTimeUpToDate(events, project.id, currentDate);
  const totalPlannedHours = getPlannedTimeUpToDate(events, project.id, new Date(project.endDate));
  
  // Calculate progress metrics
  const progressPercentage = totalEstimatedHours > 0 ? (totalCompletedHours / totalEstimatedHours) * 100 : 0;
  const remainingHours = Math.max(0, totalEstimatedHours - totalCompletedHours);
  
  // Calculate time remaining
  const endDate = new Date(project.endDate);
  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
  const averageHoursPerDay = daysRemaining > 0 ? remainingHours / daysRemaining : 0;
  
  // Determine if project is on track (simplified calculation)
  const expectedProgressAtCurrentDate = totalEstimatedHours * 
    (1 - (endDate.getTime() - currentDate.getTime()) / (endDate.getTime() - new Date(project.startDate).getTime()));
  const isOnTrack = totalCompletedHours >= expectedProgressAtCurrentDate * 0.9; // 90% tolerance
  
  // Calculate efficiency
  const efficiency = totalPlannedHours > 0 ? (totalCompletedHours / totalPlannedHours) * 100 : 0;
  
  // Calculate milestone progress
  const completedMilestones = milestones.filter(m => m.completed).length;
  const milestoneProgress = {
    completed: completedMilestones,
    total: milestones.length,
    percentage: milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 0
  };
  
  return {
    totalEstimatedHours,
    totalCompletedHours,
    totalPlannedHours,
    progressPercentage,
    remainingHours,
    daysRemaining,
    averageHoursPerDay,
    isOnTrack,
    efficiency,
    milestoneProgress
  };
}

/**
 * Generate progress data points for visualization
 */
export function generateProgressDataPoints(
  project: ProgressProject,
  events: ProjectEvent[],
  options: ProgressCalculationOptions = {}
): DataPoint[] {
  const { includeIntermediatePoints = true, interpolationSteps = 5 } = options;
  const dataPoints: DataPoint[] = [];
  
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.endDate);
  const totalDays = calculateProjectDuration(project);
  
  // Create data points
  const stepSize = includeIntermediatePoints ? Math.ceil(totalDays / interpolationSteps) : totalDays;
  
  for (let day = 0; day <= totalDays; day += stepSize) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + day);
    
    // Ensure we don't go beyond end date
    if (currentDate > endDate) {
      currentDate.setTime(endDate.getTime());
    }
    
    const estimatedProgress = (day / totalDays) * project.estimatedHours;
    const completedTime = calculateCompletedTimeUpToDate(events, project.id, currentDate);
    const plannedTime = getPlannedTimeUpToDate(events, project.id, currentDate);
    
    dataPoints.push({
      date: new Date(currentDate),
      estimatedProgress,
      completedTime,
      plannedTime
    });
    
    // Break if we've reached the end date
    if (currentDate.getTime() === endDate.getTime()) {
      break;
    }
  }
  
  return dataPoints;
}

/**
 * Calculate project velocity (hours completed per day)
 */
export function calculateProjectVelocity(
  project: ProgressProject,
  events: ProjectEvent[],
  periodDays: number = 7
): number {
  const currentDate = new Date();
  const periodStart = new Date(currentDate);
  periodStart.setDate(periodStart.getDate() - periodDays);
  
  const projectEvents = filterProjectEvents(events, project.id).filter(event => 
    event.completed && 
    new Date(event.endTime) >= periodStart && 
    new Date(event.endTime) <= currentDate
  );
  
  const totalHoursCompleted = projectEvents.reduce((total, event) => {
    const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    return total + duration;
  }, 0);
  
  return totalHoursCompleted / periodDays;
}

/**
 * Estimate project completion date based on current velocity
 */
export function estimateProjectCompletionDate(
  project: ProgressProject,
  events: ProjectEvent[]
): Date {
  const velocity = calculateProjectVelocity(project, events, 14); // Use 14-day velocity
  const metrics = calculateProjectTimeMetrics(project, events);
  
  if (velocity <= 0) {
    return new Date(project.endDate); // Return original end date if no velocity
  }
  
  const daysToCompletion = metrics.remainingHours / velocity;
  const estimatedCompletionDate = new Date();
  estimatedCompletionDate.setDate(estimatedCompletionDate.getDate() + Math.ceil(daysToCompletion));
  
  return estimatedCompletionDate;
}
