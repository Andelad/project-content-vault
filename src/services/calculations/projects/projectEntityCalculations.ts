/**
 * Project Operations Calculations
 * 
 * Consolidated project operations including progress tracking, status determination, 
 * conflict resolution, and drag operations.
 * 
 * Consolidated from:
 * - projectProgressCalculations.ts
 * - projectStatusCalculations.ts  
 * - projectOverlapCalculations.ts
 * - completionCalculations.ts (if exists)
 * 
 * Date: September 10, 2025
 */

import type { Milestone, Project, CalendarEvent, Holiday } from '@/types/core';
import { getDateKey } from '@/utils/dateFormatUtils';
import { calculateDurationDays, calculateDurationHours, datesOverlap } from '../general/dateCalculations';
import { formatDateShort } from '@/utils/dateFormatUtils';

// Re-export Project type for convenience
export type { Project } from '@/types/core';

// Re-export commonly used date functions for backward compatibility
export { datesOverlap } from '../general/dateCalculations';

// =====================================================================================
// INTERFACES & TYPES
// =====================================================================================

// Project-specific subset of CalendarEvent for progress calculations
export interface ProjectEvent extends Pick<CalendarEvent, 'id' | 'startTime' | 'endTime' | 'completed'> {
  projectId: string; // projectId is optional in CalendarEvent but required for project calculations
}

// Extends core Milestone with progress-specific fields
export interface MilestoneWithProgress extends Milestone {
  completed?: boolean;
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
  totalPlannedHours: number;
  totalCompletedHours: number;
  completionPercentage: number;
  remainingHours: number;
  averageHoursPerDay: number;
  milestoneProgress: {
    completed: number;
    total: number;
    percentage: number;
  };
  isOnTrack: boolean;
  projectedCompletionDate?: Date;
  daysRemaining: number;
  hoursPerDayNeeded: number;
  
  // Legacy compatibility properties
  plannedTime: number;
  completedTime: number;
  totalBudgetedTime: number;
  originalDailyEstimateFormatted: string;
  workDaysLeft: number;
  totalWorkDays: number;
  exactDailyHours: number;
  dailyHours: number;
  dailyMinutes: number;
  heightInPixels: number;
  workingDaysCount: number;
}

// Conflict Detection Interfaces
export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflictingProjects: Project[];
  conflictDetails: Array<{
    projectId: string;
    overlapType: 'partial' | 'complete' | 'adjacent';
    overlapDays: number;
  }>;
}

export interface DateAdjustmentResult {
  originalStartDate: Date;
  originalEndDate: Date;
  adjustedStartDate: Date;
  adjustedEndDate: Date;
  wasAdjusted: boolean;
  adjustmentReason: string;
  daysMoved: number;
}

// =====================================================================================
// PROJECT PROGRESS CALCULATIONS
// =====================================================================================

/**
 * Calculate project duration in days
 * CRITICAL: Continuous projects have no fixed duration
 */
export function calculateProjectDuration(project: Project): number {
  if (project.continuous) return -1; // Infinite duration
  if (!project.startDate || !project.endDate) return 0;
  return calculateDurationDays(new Date(project.startDate), new Date(project.endDate));
}

/**
 * Get events for a specific project
 */
export function getProjectEvents(events: ProjectEvent[], projectId: string): ProjectEvent[] {
  return events.filter(event => event.projectId === projectId);
}

/**
 * Calculate duration of a project event in hours
 */
export function calculateEventDurationHours(event: ProjectEvent): number {
  if (!event.startTime || !event.endTime) return 0;
  return calculateDurationHours(new Date(event.startTime), new Date(event.endTime));
}

/**
 * Get completed time up to a specific date
 */
export function getCompletedTimeUpToDate(
  events: ProjectEvent[],
  projectId: string,
  upToDate: Date,
  includePartialDays: boolean = false
): number {
  const projectEvents = getProjectEvents(events, projectId);
  let totalHours = 0;

  for (const event of projectEvents) {
    if (!event.startTime || !event.endTime || !event.completed) continue;

    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);

    if (includePartialDays) {
      // Include events that start before upToDate
      if (eventStart <= upToDate) {
        const effectiveEnd = eventEnd <= upToDate ? eventEnd : upToDate;
        const hours = calculateDurationHours(eventStart, effectiveEnd);
        totalHours += Math.max(0, hours);
      }
    } else {
      // Only include events that end before upToDate
      if (eventEnd <= upToDate) {
        totalHours += calculateEventDurationHours(event);
      }
    }
  }

  return totalHours;
}

/**
 * Get planned time up to a specific date
 */
export function getPlannedTimeUpToDate(
  events: ProjectEvent[],
  projectId: string,
  upToDate: Date,
  includePartialDays: boolean = false
): number {
  const projectEvents = getProjectEvents(events, projectId);
  let totalHours = 0;

  for (const event of projectEvents) {
    if (!event.startTime || !event.endTime) continue;

    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);

    if (includePartialDays) {
      if (eventStart <= upToDate) {
        const effectiveEnd = eventEnd <= upToDate ? eventEnd : upToDate;
        const hours = calculateDurationHours(eventStart, effectiveEnd);
        totalHours += Math.max(0, hours);
      }
    } else {
      if (eventEnd <= upToDate) {
        totalHours += calculateEventDurationHours(event);
      }
    }
  }

  return totalHours;
}

/**
 * Get relevant milestones for a project
 */
export function getRelevantMilestones(
  milestones: MilestoneWithProgress[], 
  projectId: string,
  startDate?: Date,
  endDate?: Date
): MilestoneWithProgress[] {
  let filtered = milestones.filter(m => m.projectId === projectId);
  
  if (startDate && endDate) {
    filtered = filtered.filter(m => {
      const dueDate = new Date(m.dueDate);
      return dueDate >= startDate && dueDate <= endDate;
    });
  }
  
  return filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

/**
 * Calculate progress percentage based on completed vs total hours
 */
export function calculateProgressPercentage(completedHours: number, totalPlannedHours: number): number {
  if (totalPlannedHours <= 0) return 0;
  return Math.min(100, Math.max(0, (completedHours / totalPlannedHours) * 100));
}

/**
 * Filter project events by project ID
 */
export function filterProjectEvents(events: ProjectEvent[], projectId: string): ProjectEvent[] {
  return events.filter(event => event.projectId === projectId);
}

/**
 * Build a map of planned time by date
 */
export function buildPlannedTimeMap(
  events: ProjectEvent[],
  projectId: string,
  projectStart: Date,
  projectEnd: Date
): Map<string, number> {
  const projectEvents = filterProjectEvents(events, projectId);
  const plannedTimeMap = new Map<string, number>();
  
  // Initialize map with all dates in project range
  const currentDate = new Date(projectStart);
  while (currentDate <= projectEnd) {
    const dateKey = getDateKey(currentDate);
    plannedTimeMap.set(dateKey, 0);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Add planned hours from events
  for (const event of projectEvents) {
    if (!event.startTime || !event.endTime) continue;
    
    const eventDate = getDateKey(new Date(event.startTime));
    const existingHours = plannedTimeMap.get(eventDate) || 0;
    plannedTimeMap.set(eventDate, existingHours + calculateEventDurationHours(event));
  }
  
  return plannedTimeMap;
}

/**
 * Calculate comprehensive project time metrics
 * CRITICAL: Continuous projects have no fixed end date or duration
 */
export function calculateProjectTimeMetrics(
  project: Project,
  events: ProjectEvent[],
  milestonesOrHolidays?: MilestoneWithProgress[] | Holiday[],
  currentDate: Date = new Date()
): ComprehensiveProjectTimeMetrics {
  const milestones = Array.isArray(milestonesOrHolidays)
    ? milestonesOrHolidays.filter((item): item is MilestoneWithProgress =>
        typeof item === 'object' && item !== null && 'projectId' in item)
    : [];
  
  const projectEvents = filterProjectEvents(events, project.id);
  const projectStart = new Date(project.startDate);
  
  // Calculate total planned and completed hours
  let totalPlannedHours = 0;
  let totalCompletedHours = 0;
  
  for (const event of projectEvents) {
    const duration = calculateEventDurationHours(event);
    totalPlannedHours += duration;
    if (event.completed) {
      totalCompletedHours += duration;
    }
  }
  
  // Calculate completion percentage
  const completionPercentage = calculateProgressPercentage(totalCompletedHours, totalPlannedHours);
  const remainingHours = Math.max(0, totalPlannedHours - totalCompletedHours);
  
  // Calculate project duration and average hours per day
  const durationDays = calculateProjectDuration(project);
  const averageHoursPerDay = (durationDays > 0 && durationDays !== -1) ? totalPlannedHours / durationDays : 0;
  
  // Calculate milestone progress
  const relevantMilestones = milestones.filter(m => m.projectId === project.id);
  const completedMilestones = relevantMilestones.filter(m => m.completed === true);
  const milestoneProgress = {
    completed: completedMilestones.length,
    total: relevantMilestones.length,
    percentage: relevantMilestones.length > 0 ? (completedMilestones.length / relevantMilestones.length) * 100 : 0
  };
  
  // Calculate remaining days and required hours per day
  // For continuous projects, these values are undefined/infinite
  const today = new Date();
  let daysRemaining = 0;
  let hoursPerDayNeeded = 0;
  let expectedProgress = 0;
  
  if (!project.continuous && project.endDate) {
    const projectEnd = new Date(project.endDate);
    daysRemaining = projectEnd > today ? calculateDurationDays(today, projectEnd) : 0;
    hoursPerDayNeeded = daysRemaining > 0 ? remainingHours / daysRemaining : 0;
    expectedProgress = durationDays > 0 ? (calculateDurationDays(projectStart, currentDate) / durationDays) * 100 : 0;
  }
  
  // Simple on-track calculation (more sophisticated logic could be added)
  // Continuous projects are always on track (no deadline to miss)
  const isOnTrack = project.continuous || completionPercentage >= (expectedProgress * 0.8);
  
  return {
    totalPlannedHours,
    totalCompletedHours,
    completionPercentage,
    remainingHours,
    averageHoursPerDay,
    milestoneProgress,
    isOnTrack,
    daysRemaining,
    hoursPerDayNeeded,
    
    // Legacy compatibility properties
    plannedTime: totalPlannedHours,
    completedTime: totalCompletedHours,
    totalBudgetedTime: totalPlannedHours,
    originalDailyEstimateFormatted: `${averageHoursPerDay.toFixed(1)}h/day`,
    workDaysLeft: daysRemaining,
    totalWorkDays: durationDays === -1 ? 0 : durationDays, // 0 for continuous projects
    exactDailyHours: averageHoursPerDay,
    dailyHours: Math.floor(averageHoursPerDay),
    dailyMinutes: Math.round((averageHoursPerDay % 1) * 60),
    heightInPixels: averageHoursPerDay * 20, // Rough pixel height calculation
    workingDaysCount: durationDays === -1 ? 0 : durationDays
  };
}

// =====================================================================================
// PROJECT STATUS CALCULATIONS
// =====================================================================================

/**
 * Calculate project status based on dates and continuous flag
 * CRITICAL: Continuous projects are never overdue or completed
 */
export function calculateProjectStatus(project: Project): {
  isOverdue: boolean;
  isActive: boolean;
  status: 'upcoming' | 'active' | 'completed' | 'overdue';
  daysUntilDue?: number;
} {
  if (!project.startDate) {
    return {
      isOverdue: false,
      isActive: false,
      status: 'upcoming'
    };
  }

  const start = new Date(project.startDate);
  const now = new Date();

  // Continuous projects are active once started, never overdue
  if (project.continuous) {
    const isActive = start <= now;
    return {
      isOverdue: false,
      isActive,
      status: isActive ? 'active' : 'upcoming',
      daysUntilDue: undefined // No due date for continuous projects
    };
  }

  // Non-continuous projects need an end date
  if (!project.endDate) {
    return {
      isOverdue: false,
      isActive: false,
      status: 'upcoming'
    };
  }

  const end = new Date(project.endDate);
  const isOverdue = end < now;
  const isActive = start <= now && end >= now;

  let status: 'upcoming' | 'active' | 'completed' | 'overdue';
  if (isOverdue) {
    status = 'overdue';
  } else if (isActive) {
    status = 'active';
  } else if (start > now) {
    status = 'upcoming';
  } else {
    status = 'completed';
  }

  let daysUntilDue: number | undefined;
  if (end > now) {
    daysUntilDue = calculateDurationDays(now, end);
  }

  return {
    isOverdue,
    isActive,
    status,
    daysUntilDue
  };
}

/**
 * Determine project status for organization
 * CRITICAL: Continuous projects are never archived
 */
export function determineProjectStatus(project: Project): 'future' | 'current' | 'archived' {
  if (!project.startDate) {
    return 'future';
  }

  const now = new Date();
  const start = new Date(project.startDate);

  if (start > now) {
    return 'future';
  }
  
  // Continuous projects are always current once started
  if (project.continuous) {
    return 'current';
  }
  
  // Non-continuous projects need an end date
  if (!project.endDate) {
    return 'future';
  }

  const end = new Date(project.endDate);
  return end >= now ? 'current' : 'archived';
}

/**
 * Get effective project status with continuous project handling
 */
export function getEffectiveProjectStatus(project: Project): 'future' | 'current' | 'archived' {
  return determineProjectStatus(project);
}

/**
 * Organize projects by their status
 */
export function organizeProjectsByStatus(projects: Project[]) {
  const future: Project[] = [];
  const current: Project[] = [];
  const archived: Project[] = [];

  projects.forEach(project => {
    const status = determineProjectStatus(project);
    switch (status) {
      case 'future':
        future.push(project);
        break;
      case 'current':
        current.push(project);
        break;
      case 'archived':
        archived.push(project);
        break;
    }
  });

  return { future, current, archived };
}

// =====================================================================================
// PROJECT CONFLICT & OVERLAP CALCULATIONS
// =====================================================================================

/**
 * Check if two projects overlap in their date ranges
 * CRITICAL: Continuous projects are treated as having no end date
 */
export function checkProjectOverlap(
  startDate: Date,
  endDate: Date,
  projects: Project[],
  excludeProjectId?: string,
  sameRowOnly: boolean = false,
  targetRowId?: string
): ConflictDetectionResult {
  const conflictingProjects: Project[] = [];
  const conflictDetails: Array<{ projectId: string; overlapType: 'partial' | 'complete' | 'adjacent'; overlapDays: number }> = [];

  for (const project of projects) {
    if (excludeProjectId && project.id === excludeProjectId) continue;
    if (sameRowOnly && targetRowId !== undefined && project.rowId !== targetRowId) continue;
    if (!project.startDate) continue;

    const projectStart = new Date(project.startDate);
    
    // For continuous projects, check if the new project's date range intersects with the continuous project's start
    if (project.continuous) {
      // Continuous project conflicts with anything that starts after or overlaps with its start date
      if (endDate >= projectStart) {
        conflictingProjects.push(project);
        conflictDetails.push({
          projectId: project.id,
          overlapType: 'complete', // Continuous projects always have complete overlap
          overlapDays: -1 // Infinite overlap
        });
      }
      continue;
    }
    
    // For non-continuous projects, use standard overlap detection
    if (!project.endDate) continue;
    
    if (datesOverlap(startDate, endDate, projectStart, new Date(project.endDate))) {
      conflictingProjects.push(project);
      
      const overlapDays = calculateOverlapDays(
        startDate, endDate,
        projectStart, new Date(project.endDate)
      );
      
      const overlapType = determineOverlapType(
        startDate, endDate,
        projectStart, new Date(project.endDate)
      );
      
      conflictDetails.push({
        projectId: project.id,
        overlapType,
        overlapDays
      });
    }
  }

  return {
    hasConflicts: conflictingProjects.length > 0,
    conflictingProjects,
    conflictDetails
  };
}

/**
 * Detect conflicts during live drag operations
 */
export function detectLiveDragConflicts(
  draggedProjectId: string,
  newDates: { startDate: Date; endDate: Date },
  targetRowId: string,
  projects: Project[]
): ConflictDetectionResult {
  return checkProjectOverlap(
    newDates.startDate,
    newDates.endDate,
    projects,
    draggedProjectId,
    true, // same row only
    targetRowId
  );
}

/**
 * Resolve drag conflicts by adjusting dates
 */
export function resolveDragConflicts(
  requestedDates: { startDate: Date; endDate: Date },
  conflictingProjects: Project[],
  strategy: 'adjust' | 'reject' | 'force' = 'adjust'
): DateAdjustmentResult {
  const { startDate: originalStartDate, endDate: originalEndDate } = requestedDates;

  if (strategy === 'reject') {
    return {
      originalStartDate,
      originalEndDate,
      adjustedStartDate: originalStartDate,
      adjustedEndDate: originalEndDate,
      wasAdjusted: false,
      adjustmentReason: 'Conflicts detected - operation rejected',
      daysMoved: 0
    };
  }

  if (strategy === 'force') {
    return {
      originalStartDate,
      originalEndDate,
      adjustedStartDate: originalStartDate,
      adjustedEndDate: originalEndDate,
      wasAdjusted: false,
      adjustmentReason: 'Forced placement - conflicts ignored',
      daysMoved: 0
    };
  }

  // Strategy: 'adjust'
  const nearestSlot = findNearestAvailableSlot(
    originalStartDate,
    originalEndDate,
    conflictingProjects
  );

  if (nearestSlot) {
    const daysMoved = calculateDurationDays(originalStartDate, nearestSlot.startDate);
    
    return {
      originalStartDate,
      originalEndDate,
      adjustedStartDate: nearestSlot.startDate,
      adjustedEndDate: nearestSlot.endDate,
      wasAdjusted: true,
      adjustmentReason: `Moved to avoid conflicts`,
      daysMoved
    };
  }

  return {
    originalStartDate,
    originalEndDate,
    adjustedStartDate: originalStartDate,
    adjustedEndDate: originalEndDate,
    wasAdjusted: false,
    adjustmentReason: 'No suitable slot found',
    daysMoved: 0
  };
}

/**
 * Find the nearest available time slot for a project
 * CRITICAL: Continuous projects block all slots after their start date
 */
export function findNearestAvailableSlot(
  requestedStartDate: Date,
  requestedEndDate: Date,
  existingProjects: Project[]
): { startDate: Date; endDate: Date } | null {
  const duration = calculateDurationDays(requestedStartDate, requestedEndDate);
  
  // Try slots after the requested end date
  let testStart = new Date(requestedEndDate);
  testStart.setDate(testStart.getDate() + 1);
  
  for (let attempt = 0; attempt < 365; attempt++) { // Try for up to a year
    const testEnd = new Date(testStart);
    testEnd.setDate(testEnd.getDate() + duration);
    
    let hasConflict = false;
    for (const project of existingProjects) {
      if (!project.startDate) continue;
      
      const projectStart = new Date(project.startDate);
      
      // Continuous projects block everything after their start
      if (project.continuous) {
        if (testEnd >= projectStart) {
          hasConflict = true;
          break;
        }
        continue;
      }
      
      // Non-continuous projects need an end date
      if (!project.endDate) continue;
      
      if (datesOverlap(testStart, testEnd, projectStart, new Date(project.endDate))) {
        hasConflict = true;
        break;
      }
    }
    
    if (!hasConflict) {
      return { startDate: testStart, endDate: testEnd };
    }
    
    testStart.setDate(testStart.getDate() + 1);
  }
  
  // Try slots before the requested start date
  testStart = new Date(requestedStartDate);
  testStart.setDate(testStart.getDate() - duration - 1);
  
  for (let attempt = 0; attempt < 365; attempt++) {
    const testEnd = new Date(testStart);
    testEnd.setDate(testEnd.getDate() + duration);
    
    let hasConflict = false;
    for (const project of existingProjects) {
      if (!project.startDate) continue;
      
      const projectStart = new Date(project.startDate);
      
      // Continuous projects block everything after their start
      if (project.continuous) {
        if (testEnd >= projectStart) {
          hasConflict = true;
          break;
        }
        continue;
      }
      
      // Non-continuous projects need an end date
      if (!project.endDate) continue;
      
      if (datesOverlap(testStart, testEnd, projectStart, new Date(project.endDate))) {
        hasConflict = true;
        break;
      }
    }
    
    if (!hasConflict) {
      return { startDate: testStart, endDate: testEnd };
    }
    
    testStart.setDate(testStart.getDate() - 1);
  }
  
  return null;
}

/**
 * Adjust project dates for drag operations
 */
export function adjustProjectDatesForDrag(
  currentProject: Project,
  newStartDate: Date,
  newEndDate: Date,
  allProjects: Project[]
): DateAdjustmentResult {
  const requestedDates = { startDate: newStartDate, endDate: newEndDate };
  
  // Check for conflicts
  const conflictResult = checkProjectOverlap(
    newStartDate,
    newEndDate,
    allProjects,
    currentProject.id,
    true, // same row only
    currentProject.rowId
  );
  
  if (!conflictResult.hasConflicts) {
    return {
      originalStartDate: new Date(currentProject.startDate),
      originalEndDate: new Date(currentProject.endDate),
      adjustedStartDate: newStartDate,
      adjustedEndDate: newEndDate,
      wasAdjusted: false,
      adjustmentReason: 'No conflicts detected',
      daysMoved: 0
    };
  }
  
  return resolveDragConflicts(requestedDates, conflictResult.conflictingProjects, 'adjust');
}

/**
 * Calculate the overlap percentage between two date ranges
 */
export function calculateOverlapPercentage(
  startA: Date, endA: Date,
  startB: Date, endB: Date
): number {
  if (!datesOverlap(startA, endA, startB, endB)) {
    return 0;
  }

  const overlapStart = new Date(Math.max(startA.getTime(), startB.getTime()));
  const overlapEnd = new Date(Math.min(endA.getTime(), endB.getTime()));
  const overlapDays = calculateDurationDays(overlapStart, overlapEnd);
  
  const totalDaysA = calculateDurationDays(startA, endA);
  return totalDaysA > 0 ? (overlapDays / totalDaysA) * 100 : 0;
}

// =====================================================================================
// HELPER FUNCTIONS
// =====================================================================================

/**
 * Calculate overlap duration in days
 */
function calculateOverlapDays(
  startA: Date, endA: Date,
  startB: Date, endB: Date
): number {
  if (!datesOverlap(startA, endA, startB, endB)) return 0;
  
  const overlapStart = new Date(Math.max(startA.getTime(), startB.getTime()));
  const overlapEnd = new Date(Math.min(endA.getTime(), endB.getTime()));
  return calculateDurationDays(overlapStart, overlapEnd);
}

/**
 * Determine the type of overlap between two date ranges
 */
function determineOverlapType(
  startA: Date, endA: Date,
  startB: Date, endB: Date
): 'partial' | 'complete' | 'adjacent' {
  // Check for adjacency first (touching but not overlapping)
  const isAdjacent = (endA.getTime() === startB.getTime()) || (endB.getTime() === startA.getTime());
  if (isAdjacent) return 'adjacent';
  
  // Check for actual overlap
  if (!datesOverlap(startA, endA, startB, endB)) return 'adjacent';
  
  const aContainsB = startA <= startB && endA >= endB;
  const bContainsA = startB <= startA && endB >= endA;
  
  if (aContainsB || bContainsA) return 'complete';
  return 'partial';
}

// =====================================================================================
// LEGACY COMPATIBILITY EXPORTS
// =====================================================================================

// Placeholder functions for missing exports that might be referenced
export function generateProgressDataPoints(
  project: Project,
  events: ProjectEvent[],
  options: ProgressCalculationOptions = {}
): DataPoint[] {
  // Implementation would go here - placeholder for now
  return [];
}

export function calculateProjectVelocity(
  project: Project,
  events: ProjectEvent[]
): number {
  // Implementation would go here - placeholder for now
  return 0;
}

export function estimateProjectCompletionDate(
  project: Project,
  events: ProjectEvent[]
): Date | null {
  // Implementation would go here - placeholder for now
  return null;
}
