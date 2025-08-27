/**
 * Report calculation service
 * Extracted from ReportsView component for complex data analysis and calculations
 */

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

export interface IncludedDays {
  sunday: boolean;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
}

export interface AverageDayData {
  timeline: any[];
  totalAverageHours: number;
  validDays: number;
}

export type AveragePeriod = 'week' | 'month' | '6months';

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
 * Count valid working days in a period based on included days settings
 */
export function calculateValidDays(
  startDate: Date, 
  endDate: Date, 
  includedDays: IncludedDays
): number {
  let count = 0;
  const current = new Date(startDate);
  const dayNames: (keyof IncludedDays)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  while (current <= endDate) {
    const dayName = dayNames[current.getDay()];
    
    if (includedDays[dayName]) {
      count++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

/**
 * Calculate date range for average period
 */
export function getAveragePeriodDateRange(period: AveragePeriod, referenceDate: Date = new Date()): {
  startDate: Date;
  endDate: Date;
} {
  const endDate = new Date(referenceDate);
  const startDate = new Date(referenceDate);
  
  switch (period) {
    case 'week':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(endDate.getMonth() - 1);
      break;
    case '6months':
      startDate.setMonth(endDate.getMonth() - 6);
      break;
  }
  
  return { startDate, endDate };
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
 */
export function calculateEventDurationHours(event: ReportEvent): number {
  if (event.duration) {
    return event.duration;
  }
  
  try {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
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

/**
 * Calculate average daily hours for a period
 */
export function calculateAverageDailyHours(
  events: ReportEvent[],
  startDate: Date,
  endDate: Date,
  includedDays: IncludedDays
): number {
  const relevantEvents = getRelevantEventsForPeriod(events, startDate, endDate);
  const totalHours = relevantEvents.reduce((sum, event) => sum + calculateEventDurationHours(event), 0);
  const validDays = calculateValidDays(startDate, endDate, includedDays);
  
  return validDays > 0 ? totalHours / validDays : 0;
}

/**
 * Generate comprehensive average day data
 */
export function calculateAverageDayData(
  events: ReportEvent[],
  period: AveragePeriod,
  includedDays: IncludedDays,
  groups?: any[],
  referenceDate: Date = new Date()
): AverageDayData {
  // Early return if groups is not available yet
  if (!groups || !Array.isArray(groups)) {
    return {
      timeline: [],
      totalAverageHours: 0,
      validDays: 0
    };
  }

  const { startDate, endDate } = getAveragePeriodDateRange(period, referenceDate);
  const relevantEvents = getRelevantEventsForPeriod(events, startDate, endDate);
  const validDays = calculateValidDays(startDate, endDate, includedDays);
  const totalAverageHours = calculateAverageDailyHours(events, startDate, endDate, includedDays);
  
  // Group events and calculate daily patterns
  const groupedEvents = groupEventsByDate(relevantEvents);
  const dailyTotals = calculateDailyTotals(groupedEvents);
  
  // Generate timeline data for visualization
  const timeline = Object.entries(dailyTotals).map(([date, hours]) => ({
    date,
    hours,
    events: groupedEvents[date] || []
  })).sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    timeline,
    totalAverageHours,
    validDays
  };
}

/**
 * Calculate project load distribution
 */
export function calculateProjectLoadDistribution(
  projects: Project[],
  events: ReportEvent[]
): { [projectId: string]: { estimatedHours: number; actualHours: number; efficiency: number } } {
  const distribution: { [projectId: string]: { estimatedHours: number; actualHours: number; efficiency: number } } = {};
  
  // Initialize with project estimates
  projects.forEach(project => {
    distribution[project.id] = {
      estimatedHours: project.estimatedHours,
      actualHours: 0,
      efficiency: 0
    };
  });
  
  // Add actual hours from events
  events
    .filter(event => event.projectId && (event.completed || event.type === 'tracked'))
    .forEach(event => {
      if (event.projectId && distribution[event.projectId]) {
        distribution[event.projectId].actualHours += calculateEventDurationHours(event);
      }
    });
  
  // Calculate efficiency ratios
  Object.keys(distribution).forEach(projectId => {
    const { estimatedHours, actualHours } = distribution[projectId];
    distribution[projectId].efficiency = estimatedHours > 0 ? actualHours / estimatedHours : 0;
  });
  
  return distribution;
}

/**
 * Get productivity metrics for reporting
 */
export function getProductivityMetrics(
  events: ReportEvent[],
  weeklyCapacity: number,
  period: AveragePeriod = 'week'
): {
  totalHours: number;
  averageDaily: number;
  utilizationRate: number;
  trendsData: { date: string; hours: number }[];
} {
  const { startDate, endDate } = getAveragePeriodDateRange(period);
  const relevantEvents = getRelevantEventsForPeriod(events, startDate, endDate);
  const totalHours = relevantEvents.reduce((sum, event) => sum + calculateEventDurationHours(event), 0);
  
  // Calculate period capacity based on period length
  const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const periodCapacity = (weeklyCapacity / 7) * periodDays;
  
  const groupedEvents = groupEventsByDate(relevantEvents);
  const trendsData = Object.entries(calculateDailyTotals(groupedEvents))
    .map(([date, hours]) => ({ date, hours }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  return {
    totalHours,
    averageDaily: periodDays > 0 ? totalHours / periodDays : 0,
    utilizationRate: periodCapacity > 0 ? (totalHours / periodCapacity) * 100 : 0,
    trendsData
  };
}
