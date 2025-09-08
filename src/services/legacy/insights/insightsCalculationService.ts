/**
 * Insights calculation service for generating reports and analytics
 * Uses single source of truth for all calculations
 */

import { 
  calculateDurationHours 
} from '@/services/core/calculations/dateCalculations';

export interface WorkSlot {
  duration: number;
  startTime?: string;
  endTime?: string;
}

export interface Project {
  id: string;
  startDate: string | Date;
  endDate: string | Date;
  estimatedHours: number;
  name: string;
}

export interface ReportEvent {
  startTime: string | Date;
  endTime: string | Date;
  completed?: boolean;
  type?: string;
  duration?: number;
  projectId?: string;
}

export interface WeeklyWorkHours {
  [dayName: string]: WorkSlot[] | number;
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
 * Calculate event duration in hours
 * DELEGATES to single source of truth
 */
export function calculateEventDurationHours(event: ReportEvent): number {
  if (event.duration) {
    return event.duration;
  }
  
  try {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    return calculateDurationHours(start, end);
  } catch (error) {
    console.warn('Could not calculate duration for event:', event);
    return 0;
  }
}

/**
 * Group events by date for timeline analysis
 */
export function groupEventsByDate(events: ReportEvent[]): { [dateKey: string]: ReportEvent[] } {
  const grouped: { [dateKey: string]: ReportEvent[] } = {};
  
  events.forEach(event => {
    try {
      const eventDate = new Date(event.startTime);
      const dateKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(event);
    } catch (error) {
      console.warn('Could not group event by date:', event);
    }
  });
  
  return grouped;
}

/**
 * Calculate daily totals from grouped events
 */
export function calculateDailyTotals(groupedEvents: { [dateKey: string]: ReportEvent[] }): { [dateKey: string]: number } {
  const dailyTotals: { [dateKey: string]: number } = {};
  
  Object.entries(groupedEvents).forEach(([dateKey, dayEvents]) => {
    dailyTotals[dateKey] = dayEvents.reduce((sum, event) => {
      return sum + calculateEventDurationHours(event);
    }, 0);
  });
  
  return dailyTotals;
}


