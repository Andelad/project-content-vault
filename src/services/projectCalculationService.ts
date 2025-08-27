/**
 * Project Calculation Service
 * 
 * This service handles comprehensive project time calculations, metrics analysis,
 * and workload management extracted from the projectCalculations library.
 * It provides complete project analytics and time allocation calculations.
 * 
 * Key Features:
 * - Project time metrics calculation (budgeted, planned, completed)
 * - Working day calculations with holiday consideration
 * - Auto-estimation and daily time allocation
 * - Timeline and progress analytics
 * - Continuous project support
 * - Multi-project capacity analysis
 * 
 * @module ProjectCalculationService
 */

import type { Project, CalendarEvent, Holiday, Settings } from '@/types/core';

/**
 * Interface for comprehensive project time metrics
 */
export interface ProjectTimeMetrics {
  totalBudgetedTime: number; // hours
  plannedTime: number; // hours from calendar events
  completedTime: number; // hours from completed events
  autoEstimatedTime: number; // remaining hours to be allocated
  autoEstimatedDailyTime: string; // formatted as "3h 30m per day"
  workDaysLeft: number; // working days between now and project end
  totalWorkDays: number; // total working days in project timeframe
  originalDailyEstimate: number; // total hours divided by total work days
  originalDailyEstimateFormatted: string; // formatted original daily estimate
  utilizationPercentage: number; // percentage of total budget used
  completionPercentage: number; // percentage of work completed
  remainingPercentage: number; // percentage of work remaining
}

/**
 * Interface for project progress analysis
 */
export interface ProjectCalculationProgressAnalysis {
  isOnTrack: boolean;
  daysAhead: number;
  daysBehind: number;
  projectedCompletionDate: Date;
  timeVariance: number; // hours over/under budget
  efficiencyRatio: number; // actual vs estimated productivity
  riskLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
}

/**
 * Interface for multi-project analysis
 */
export interface MultiProjectAnalysis {
  totalProjects: number;
  activeProjects: number;
  totalBudgetedHours: number;
  totalPlannedHours: number;
  totalCompletedHours: number;
  averageCompletion: number;
  overbudgetProjects: string[];
  behindScheduleProjects: string[];
  recommendations: string[];
}

/**
 * Configuration constants for project calculations
 */
export const PROJECT_CALCULATION_CONFIG = {
  CONTINUOUS_PROJECT_WINDOW_YEARS: 1,
  RISK_THRESHOLD_HIGH: 0.8, // 80% over budget/schedule
  RISK_THRESHOLD_MEDIUM: 0.5, // 50% over budget/schedule
  EFFICIENCY_OPTIMAL_MIN: 0.9, // 90% efficiency
  EFFICIENCY_OPTIMAL_MAX: 1.1, // 110% efficiency
  COMPLETION_WARNING_THRESHOLD: 0.9, // 90% completion
  BUFFER_DAYS_RECOMMENDATION: 2
} as const;

/**
 * Calculate comprehensive project time metrics
 * 
 * @param project - Project to analyze
 * @param events - Array of calendar events
 * @param holidays - Array of holiday definitions
 * @param settings - User settings
 * @returns Complete time metrics analysis
 */
export function calculateProjectTimeMetrics(
  project: Project,
  events: CalendarEvent[],
  holidays: Holiday[],
  settings: Settings
): ProjectTimeMetrics {
  const projectStart = new Date(project.startDate);
  projectStart.setHours(0, 0, 0, 0);
  
  // Calculate effective project end date
  let projectEnd: Date;
  if (project.continuous) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearFromStart = new Date(projectStart);
    oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + PROJECT_CALCULATION_CONFIG.CONTINUOUS_PROJECT_WINDOW_YEARS);
    const oneYearFromToday = new Date(today);
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + PROJECT_CALCULATION_CONFIG.CONTINUOUS_PROJECT_WINDOW_YEARS);
    
    projectEnd = oneYearFromStart > oneYearFromToday ? oneYearFromStart : oneYearFromToday;
  } else {
    projectEnd = new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);
  }
  
  // Calculate working days
  const allWorkDays = getWorkingDaysInRange(projectStart, projectEnd, holidays, settings);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remainingWorkDays = (project.continuous || projectEnd >= today)
    ? getWorkingDaysInRange(today > projectStart ? today : projectStart, projectEnd, holidays, settings)
    : 0;

  // Calculate time allocations from events
  const projectEvents = events.filter(event => event.projectId === project.id);
  const plannedTime = projectEvents.reduce((total, event) => {
    const durationMs = event.endTime.getTime() - event.startTime.getTime();
    return total + (durationMs / (1000 * 60 * 60));
  }, 0);

  const completedTime = projectEvents
    .filter(event => event.completed)
    .reduce((total, event) => {
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      return total + (durationMs / (1000 * 60 * 60));
    }, 0);

  // Calculate remaining and utilization metrics
  const remainingBudget = Math.max(0, project.estimatedHours - plannedTime);
  const dailyAutoEstimate = remainingWorkDays > 0 ? remainingBudget / remainingWorkDays : 0;
  const originalDailyEstimate = allWorkDays > 0 ? project.estimatedHours / allWorkDays : 0;
  
  const utilizationPercentage = project.estimatedHours > 0 ? (plannedTime / project.estimatedHours) * 100 : 0;
  const completionPercentage = project.estimatedHours > 0 ? (completedTime / project.estimatedHours) * 100 : 0;
  const remainingPercentage = Math.max(0, 100 - utilizationPercentage);

  return {
    totalBudgetedTime: project.estimatedHours,
    plannedTime,
    completedTime,
    autoEstimatedTime: remainingBudget,
    autoEstimatedDailyTime: formatDailyTime(dailyAutoEstimate),
    workDaysLeft: remainingWorkDays,
    totalWorkDays: allWorkDays,
    originalDailyEstimate,
    originalDailyEstimateFormatted: formatDailyTime(originalDailyEstimate),
    utilizationPercentage,
    completionPercentage,
    remainingPercentage
  };
}

/**
 * Analyze project progress and risk factors
 * 
 * @param project - Project to analyze
 * @param metrics - Project time metrics
 * @param events - Calendar events
 * @returns Comprehensive progress analysis
 */
export function analyzeProjectCalculationProgress(
  project: Project,
  metrics: ProjectTimeMetrics,
  events: CalendarEvent[]
): ProjectCalculationProgressAnalysis {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const projectStart = new Date(project.startDate);
  projectStart.setHours(0, 0, 0, 0);
  
  let projectEnd: Date;
  if (project.continuous) {
    // For continuous projects, use a reasonable analysis window
    projectEnd = new Date(today);
    projectEnd.setFullYear(projectEnd.getFullYear() + 1);
  } else {
    projectEnd = new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);
  }
  
  // Calculate progress ratios
  const totalDuration = projectEnd.getTime() - projectStart.getTime();
  const elapsedDuration = Math.max(0, today.getTime() - projectStart.getTime());
  const timeProgressRatio = totalDuration > 0 ? elapsedDuration / totalDuration : 0;
  
  const workProgressRatio = metrics.totalBudgetedTime > 0 ? metrics.completedTime / metrics.totalBudgetedTime : 0;
  
  // Calculate variance and efficiency
  const timeVariance = metrics.plannedTime - metrics.totalBudgetedTime;
  const efficiencyRatio = metrics.plannedTime > 0 ? metrics.completedTime / metrics.plannedTime : 0;
  
  // Determine if project is on track
  const progressVariance = workProgressRatio - timeProgressRatio;
  const isOnTrack = Math.abs(progressVariance) < PROJECT_CALCULATION_CONFIG.RISK_THRESHOLD_MEDIUM;
  
  // Calculate projected completion
  let projectedCompletionDate = new Date(projectEnd);
  if (efficiencyRatio > 0 && !project.continuous) {
    const remainingWork = metrics.totalBudgetedTime - metrics.completedTime;
    const estimatedDaysToComplete = remainingWork / (efficiencyRatio * (metrics.totalBudgetedTime / metrics.totalWorkDays));
    projectedCompletionDate = new Date(today.getTime() + (estimatedDaysToComplete * 24 * 60 * 60 * 1000));
  }
  
  // Calculate schedule variance
  const scheduleDiff = (projectedCompletionDate.getTime() - projectEnd.getTime()) / (24 * 60 * 60 * 1000);
  const daysAhead = Math.max(0, -scheduleDiff);
  const daysBehind = Math.max(0, scheduleDiff);
  
  // Determine risk level
  let riskLevel: ProjectCalculationProgressAnalysis['riskLevel'] = 'low';
  if (Math.abs(timeVariance) > metrics.totalBudgetedTime * PROJECT_CALCULATION_CONFIG.RISK_THRESHOLD_HIGH ||
      daysBehind > PROJECT_CALCULATION_CONFIG.BUFFER_DAYS_RECOMMENDATION * 2) {
    riskLevel = 'high';
  } else if (Math.abs(timeVariance) > metrics.totalBudgetedTime * PROJECT_CALCULATION_CONFIG.RISK_THRESHOLD_MEDIUM ||
             daysBehind > PROJECT_CALCULATION_CONFIG.BUFFER_DAYS_RECOMMENDATION) {
    riskLevel = 'medium';
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (daysBehind > 0) {
    recommendations.push(`Project is ${Math.round(daysBehind)} day(s) behind schedule. Consider reallocating resources.`);
  } else if (daysAhead > 0) {
    recommendations.push(`Project is ${Math.round(daysAhead)} day(s) ahead of schedule. Good progress!`);
  }
  
  if (timeVariance > 0) {
    recommendations.push(`Project is ${timeVariance.toFixed(1)} hours over budget. Review scope and estimates.`);
  }
  
  if (efficiencyRatio < PROJECT_CALCULATION_CONFIG.EFFICIENCY_OPTIMAL_MIN) {
    recommendations.push('Efficiency below optimal. Consider process improvements or team support.');
  } else if (efficiencyRatio > PROJECT_CALCULATION_CONFIG.EFFICIENCY_OPTIMAL_MAX) {
    recommendations.push('High efficiency detected. Consider increasing scope or adjusting estimates.');
  }
  
  if (metrics.completionPercentage > PROJECT_CALCULATION_CONFIG.COMPLETION_WARNING_THRESHOLD * 100) {
    recommendations.push('Project nearing completion. Plan for wrap-up activities and next phases.');
  }
  
  return {
    isOnTrack,
    daysAhead,
    daysBehind,
    projectedCompletionDate,
    timeVariance,
    efficiencyRatio,
    riskLevel,
    recommendations
  };
}

/**
 * Get working days in a date range, excluding weekends and holidays
 * 
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @param holidays - Holiday definitions
 * @param settings - User settings with work schedule
 * @returns Number of working days
 */
export function getWorkingDaysInRange(
  startDate: Date, 
  endDate: Date, 
  holidays: Holiday[], 
  settings: Settings
): number {
  let workingDays = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWorkingDay(current, holidays, settings)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Check if a given date is a working day
 * 
 * @param date - Date to check
 * @param holidays - Holiday definitions
 * @param settings - User settings
 * @returns True if date is a working day
 */
export function isWorkingDay(date: Date, holidays: Holiday[], settings: Settings): boolean {
  // Check if it's a holiday
  const isHoliday = holidays.some(holiday => 
    date >= new Date(holiday.startDate) && date <= new Date(holiday.endDate)
  );
  
  if (isHoliday) {
    return false;
  }

  // Check if it's a day with work hours configured
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
  const workSlots = settings.weeklyWorkHours[dayName] || [];
  
  return Array.isArray(workSlots) && 
    workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;
}

/**
 * Format daily time allocation with proper units
 * 
 * @param totalHours - Hours to format
 * @returns Formatted time string
 */
export function formatDailyTime(totalHours: number): string {
  if (totalHours === 0) {
    return '0h 0m per day';
  }
  
  const hours = Math.floor(totalHours);
  const minutes = Math.round((totalHours - hours) * 60);
  
  const hoursText = hours === 1 ? '1h' : `${hours}h`;
  const minutesText = minutes === 1 ? '1m' : `${minutes}m`;
  
  if (hours === 0) {
    return `${minutesText} per day`;
  }
  
  if (minutes === 0) {
    return `${hoursText} per day`;
  }
  
  return `${hoursText} ${minutesText} per day`;
}

/**
 * Calculate planned time for a project on a specific date
 * 
 * @param projectId - Project identifier
 * @param date - Date to calculate for
 * @param events - Calendar events array
 * @returns Planned hours for the date
 */
export function calculateProjectPlannedTimeForDate(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): number {
  const targetDateString = date.toDateString();
  
  return events
    .filter(event => 
      event.projectId === projectId && 
      event.startTime.toDateString() === targetDateString
    )
    .reduce((total, event) => {
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      return total + (durationMs / (1000 * 60 * 60));
    }, 0);
}

/**
 * Recalculate metrics for multiple projects
 * 
 * @param projects - Array of projects to analyze
 * @param events - Calendar events array
 * @param holidays - Holiday definitions
 * @param settings - User settings
 * @returns Map of project IDs to metrics
 */
export function recalculateProjectMetrics(
  projects: Project[],
  events: CalendarEvent[],
  holidays: Holiday[],
  settings: Settings
): Map<string, ProjectTimeMetrics> {
  const projectMetrics = new Map<string, ProjectTimeMetrics>();
  
  projects.forEach(project => {
    const metrics = calculateProjectTimeMetrics(project, events, holidays, settings);
    projectMetrics.set(project.id, metrics);
  });
  
  return projectMetrics;
}

/**
 * Analyze multiple projects for portfolio insights
 * 
 * @param projects - Array of projects
 * @param events - Calendar events array
 * @param holidays - Holiday definitions
 * @param settings - User settings
 * @returns Multi-project analysis
 */
export function analyzeProjectPortfolio(
  projects: Project[],
  events: CalendarEvent[],
  holidays: Holiday[],
  settings: Settings
): MultiProjectAnalysis {
  const projectMetrics = recalculateProjectMetrics(projects, events, holidays, settings);
  
  let totalBudgetedHours = 0;
  let totalPlannedHours = 0;
  let totalCompletedHours = 0;
  let totalCompletion = 0;
  let activeProjects = 0;
  const overbudgetProjects: string[] = [];
  const behindScheduleProjects: string[] = [];
  
  projects.forEach(project => {
    const metrics = projectMetrics.get(project.id);
    if (!metrics) return;
    
    totalBudgetedHours += metrics.totalBudgetedTime;
    totalPlannedHours += metrics.plannedTime;
    totalCompletedHours += metrics.completedTime;
    totalCompletion += metrics.completionPercentage;
    
    // Check if project is active
    const today = new Date();
    const projectStart = new Date(project.startDate);
    const projectEnd = project.continuous ? 
      new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()) : 
      new Date(project.endDate);
    
    if (today >= projectStart && today <= projectEnd) {
      activeProjects++;
    }
    
    // Check for overbudget
    if (metrics.utilizationPercentage > 100) {
      overbudgetProjects.push(project.name);
    }
    
    // Check for behind schedule
    const progress = analyzeProjectCalculationProgress(project, metrics, events);
    if (progress.daysBehind > 0) {
      behindScheduleProjects.push(project.name);
    }
  });
  
  const averageCompletion = projects.length > 0 ? totalCompletion / projects.length : 0;
  
  // Generate portfolio recommendations
  const recommendations: string[] = [];
  
  if (overbudgetProjects.length > 0) {
    recommendations.push(`${overbudgetProjects.length} project(s) over budget: ${overbudgetProjects.join(', ')}`);
  }
  
  if (behindScheduleProjects.length > 0) {
    recommendations.push(`${behindScheduleProjects.length} project(s) behind schedule: ${behindScheduleProjects.join(', ')}`);
  }
  
  if (averageCompletion > 80) {
    recommendations.push('High portfolio completion rate. Consider planning new projects.');
  } else if (averageCompletion < 30) {
    recommendations.push('Low portfolio completion rate. Focus on completing existing projects.');
  }
  
  const utilizationRatio = totalBudgetedHours > 0 ? totalPlannedHours / totalBudgetedHours : 0;
  if (utilizationRatio > 1.2) {
    recommendations.push('Portfolio significantly overcommitted. Consider reducing scope or extending timelines.');
  } else if (utilizationRatio < 0.7) {
    recommendations.push('Portfolio underutilized. Consider adding more projects or increasing scope.');
  }
  
  return {
    totalProjects: projects.length,
    activeProjects,
    totalBudgetedHours,
    totalPlannedHours,
    totalCompletedHours,
    averageCompletion,
    overbudgetProjects,
    behindScheduleProjects,
    recommendations
  };
}
