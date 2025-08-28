import { Project, CalendarEvent, Holiday, Settings } from '@/types/core';

export interface ProjectTimeMetrics {
  totalBudgetedTime: number; // hours
  plannedTime: number; // hours from calendar events
  completedTime: number; // hours from completed events
  autoEstimatedTime: number; // remaining hours to be allocated
  autoEstimatedDailyTime: string; // formatted as "3h 30m per day"
  workDaysLeft: number; // working days between now and project end
  totalWorkDays: number; // total working days in project timeframe
  // Add fields to match timeline bar calculations
  originalDailyEstimate: number; // total hours divided by total work days (like timeline)
  originalDailyEstimateFormatted: string; // formatted original daily estimate
}

/**
 * Calculates all project time metrics in one place to ensure consistency
 */
export function calculateProjectTimeMetrics(
  project: Project,
  events: CalendarEvent[],
  holidays: Holiday[],
  settings: Settings
): ProjectTimeMetrics {
  // Defensive defaults for safety during early renders or partial context
  const safeHolidays: Holiday[] = Array.isArray(holidays) ? holidays : [];
  const safeEvents: CalendarEvent[] = Array.isArray(events) ? events : [];
  const safeSettings: Settings = (settings as any) || ({ weeklyWorkHours: {} } as Settings);
  const projectStart = new Date(project.startDate);
  projectStart.setHours(0, 0, 0, 0);
  
  // For continuous projects, use a reasonable calculation end date (1 year from start or today, whichever is later)
  let projectEnd: Date;
  if (project.continuous) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearFromStart = new Date(projectStart);
    oneYearFromStart.setFullYear(oneYearFromStart.getFullYear() + 1);
    const oneYearFromToday = new Date(today);
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);
    
    // Use the later of one year from start or one year from today
    projectEnd = oneYearFromStart > oneYearFromToday ? oneYearFromStart : oneYearFromToday;
  } else {
    projectEnd = new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);
  }
  
  // Calculate total working days in project timeframe
  const allWorkDays = getWorkingDaysInRange(projectStart, projectEnd, safeHolidays, safeSettings);
  
  // Calculate remaining working days (from today to project end, only if project hasn't ended)
  // For continuous projects, this will be the remaining days in the calculation period
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today
  const remainingWorkDays = (project.continuous || projectEnd >= today)
    ? getWorkingDaysInRange(today > projectStart ? today : projectStart, projectEnd, safeHolidays, safeSettings)
    : 0;

  // Calculate planned time from events connected to this project
  const projectEvents = safeEvents.filter(event => event.projectId === project.id);
  const plannedTime = projectEvents.reduce((total, event) => {
    const durationMs = event.endTime.getTime() - event.startTime.getTime();
    return total + (durationMs / (1000 * 60 * 60)); // Convert to hours
  }, 0);

  // Calculate completed time from events marked as completed
  const completedTime = projectEvents
    .filter(event => event.completed)
    .reduce((total, event) => {
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      return total + (durationMs / (1000 * 60 * 60));
    }, 0);

  // Calculate auto-estimated remaining time
  const remainingBudget = Math.max(0, project.estimatedHours - plannedTime - completedTime);
  
  // Calculate daily auto-estimate
  const dailyAutoEstimate = remainingWorkDays > 0 ? remainingBudget / remainingWorkDays : 0;
  const dailyHours = Math.floor(dailyAutoEstimate);
  const dailyMinutes = Math.round((dailyAutoEstimate - dailyHours) * 60);
  const formattedDailyTime = formatDailyTime(dailyHours, dailyMinutes);

  // Calculate original daily estimate for timeline bar
  const originalDailyEstimate = allWorkDays > 0 ? project.estimatedHours / allWorkDays : 0;
  const originalDailyEstimateFormatted = formatDailyTime(
    Math.floor(originalDailyEstimate), 
    Math.round((originalDailyEstimate - Math.floor(originalDailyEstimate)) * 60)
  );

  return {
    totalBudgetedTime: project.estimatedHours,
    plannedTime,
    completedTime,
    autoEstimatedTime: remainingBudget,
    autoEstimatedDailyTime: formattedDailyTime,
    workDaysLeft: remainingWorkDays,
    totalWorkDays: allWorkDays,
    originalDailyEstimate: originalDailyEstimate,
    originalDailyEstimateFormatted: originalDailyEstimateFormatted
  };
}

/**
 * Gets working days in a date range, excluding weekends and holidays
 */
function getWorkingDaysInRange(
  startDate: Date, 
  endDate: Date, 
  holidays: Holiday[], 
  settings: Settings
): number {
  if (!settings || !(settings as any).weeklyWorkHours) return 0;
  const safeHolidays: Holiday[] = Array.isArray(holidays) ? holidays : [];
  let workingDays = 0;
  const current = new Date(startDate);
  
  // Don't adjust for "today" when calculating total work days for the entire project
  // Only adjust when calculating remaining work days
  
  while (current <= endDate) {
  if (isWorkingDay(current, safeHolidays, settings)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Checks if a given date is a working day
 */
function isWorkingDay(date: Date, holidays: Holiday[], settings: Settings): boolean {
  if (!settings || !(settings as any).weeklyWorkHours) return false;
  const weekly = (settings as any).weeklyWorkHours as Record<string, any[]>;
  const safeHolidays: Holiday[] = Array.isArray(holidays) ? holidays : [];
  // Check if it's a holiday
  const isHoliday = safeHolidays.some(holiday => 
    date >= new Date(holiday.startDate) && date <= new Date(holiday.endDate)
  );
  
  if (isHoliday) {
    return false;
  }

  // Check if it's a day with work hours configured
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof weekly;
  const workSlots = weekly?.[dayName] || [];
  
  return Array.isArray(workSlots) && 
    workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;
}

/**
 * Formats daily time allocation as "3h 30m per day" or "0h 0m per day"
 */
function formatDailyTime(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) {
    return '0h 0m per day';
  }
  
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
 * Calculates planned time for a project on a specific date
 */
export function calculatePlannedTimeForDate(
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
      return total + (durationMs / (1000 * 60 * 60)); // Convert to hours
    }, 0);
}

/**
 * Updates project calculations when project properties change
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