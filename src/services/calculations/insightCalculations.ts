import type { Project } from '@/types';

/**
 * Insight Calculations
 * Business intelligence and reporting calculations
 */

export interface WorkSlot {
  duration: number;
  startTime?: string;
  endTime?: string;
}

export interface WeeklyWorkHours {
  [dayName: string]: WorkSlot[] | number;
}

export interface ReportEvent {
  startTime: string | Date;
  endTime: string | Date;
  completed?: boolean;
  type?: string;
  duration?: number;
  projectId?: string;
}

/**
 * Calculate total weekly work capacity from settings
 */
export function calculateWeeklyCapacity(weeklyWorkHours: WeeklyWorkHours): number {
  const values = Object.values(weeklyWorkHours);
  let totalCapacity = 0;
  
  for (const dayData of values) {
    if (Array.isArray(dayData)) {
      const dayTotal = dayData.reduce((daySum: number, slot: WorkSlot) => daySum + (slot.duration || 0), 0);
      totalCapacity += dayTotal;
    } else if (typeof dayData === 'number') {
      totalCapacity += dayData;
    }
  }
  
  return totalCapacity;
}

/**
 * Calculate daily capacity for a specific day
 * Migrated from TimelineBusinessLogicService.WeeklyCapacityCalculationService
 */
export function calculateDailyCapacity(date: Date, weeklyWorkHours: any): number {
  if (!weeklyWorkHours) return 0;

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof weeklyWorkHours;
  const dayData = weeklyWorkHours[dayName];

  if (Array.isArray(dayData)) {
    // Use the same logic as calculateWeeklyCapacity for consistency
    return dayData.reduce((sum: number, slot: any) => sum + (slot.duration || 0), 0);
  }
  return dayData || 0;
}

/**
 * Get projects that are currently active (running today)
 */
export function getCurrentProjects(projects: Project[], referenceDate: Date = new Date()): Project[] {
  return projects.filter(project => {
    const start = new Date(project.startDate);
    const end = new Date(project.endDate);
    return start <= referenceDate && end >= referenceDate;
  });
}

/**
 * Calculate future committed hours from projects starting after today
 */
export function calculateFutureCommitments(projects: Project[], referenceDate: Date = new Date()): number {
  return projects
    .filter(project => new Date(project.startDate) > referenceDate)
    .reduce((sum, project) => sum + project.estimatedHours, 0);
}

/**
 * Filter events within date range that are completed or tracked
 */
export function getRelevantEventsForPeriod(
  events: ReportEvent[],
  startDate: Date,
  endDate: Date
): ReportEvent[] {
  return events.filter(event => {
    try {
      const eventDate = new Date(event.startTime);
      const isInRange = eventDate >= startDate && eventDate <= endDate;
      const isCompleted = event.completed || event.type === 'tracked';
      return isInRange && isCompleted;
    } catch (error) {
      console.warn('Invalid event date:', event.startTime);
      return false;
    }
  });
}

/**
 * Calculate total tracked hours from events
 */
export function calculateTrackedHours(events: ReportEvent[]): number {
  return events.reduce((total, event) => {
    if (event.duration) {
      return total + event.duration;
    }
    
    if (event.startTime && event.endTime) {
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      const durationMs = end.getTime() - start.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      return total + durationHours;
    }
    
    return total;
  }, 0);
}

/**
 * Generate weekly utilization report
 */
export function generateWeeklyUtilizationReport(
  projects: Project[],
  events: ReportEvent[],
  weeklyCapacity: number,
  startDate: Date,
  endDate: Date
) {
  const relevantEvents = getRelevantEventsForPeriod(events, startDate, endDate);
  const trackedHours = calculateTrackedHours(relevantEvents);
  const currentProjects = getCurrentProjects(projects, startDate);
  const futureCommitments = calculateFutureCommitments(projects, endDate);
  
  const utilizationPercentage = weeklyCapacity > 0 ? (trackedHours / weeklyCapacity) * 100 : 0;
  
  return {
    period: {
      start: startDate,
      end: endDate
    },
    capacity: {
      total: weeklyCapacity,
      used: trackedHours,
      available: Math.max(0, weeklyCapacity - trackedHours),
      utilizationPercentage
    },
    projects: {
      active: currentProjects.length,
      futureCommitments
    },
    events: {
      total: relevantEvents.length,
      trackedHours
    }
  };
}
