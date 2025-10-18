/**
 * Day Estimate Calculations - SINGLE SOURCE OF TRUTH
 * 
 * This module calculates day-level time estimates for timeline rendering.
 * ALL timeline views (Days, Weeks) must use these functions.
 * 
 * PRIORITY ORDER:
 * 1. Planned events (calendar) → always show
 * 2. Milestone allocation → if milestone covers this date
 * 3. Project auto-estimate → fallback
 * 
 * @module dayEstimateCalculations
 */

import { Project, Milestone, CalendarEvent, DayEstimate, Settings, Holiday } from '@/types/core';

/**
 * Calculate day-level time estimates for a project
 * SINGLE SOURCE OF TRUTH for timeline rectangles
 */
export function calculateProjectDayEstimates(
  project: Project,
  milestones: Milestone[],
  events: CalendarEvent[],
  settings: Settings,
  holidays: Holiday[]
): DayEstimate[] {
  const estimates: DayEstimate[] = [];
  const projectDates = generateProjectDateRange(project);
  
  for (const date of projectDates) {
    // PRIORITY 1: Planned events
    const plannedHours = calculatePlannedHoursForDate(project.id, date, events);
    if (plannedHours > 0) {
      estimates.push({
        date,
        projectId: project.id,
        hours: plannedHours,
        source: 'planned-event',
        isWorkingDay: true // Planned always shows
      });
      continue;
    }
    
    // Check if working day (for auto-estimates only)
    const isWorkingDay = isDateWorkingDay(date, project.autoEstimateDays, settings, holidays);
    if (!isWorkingDay) {
      continue; // Skip non-working days for auto-estimates
    }
    
    // PRIORITY 2: Milestone allocation
    const milestone = findMilestoneForDate(date, milestones, project.startDate);
    if (milestone) {
      const segmentHours = calculateMilestoneSegmentHours(milestone, date, project, settings, holidays);
      estimates.push({
        date,
        projectId: project.id,
        hours: segmentHours,
        source: 'milestone-allocation',
        milestoneId: milestone.id,
        isWorkingDay: true
      });
      continue;
    }
    
    // PRIORITY 3: Project auto-estimate
    const autoHours = calculateProjectAutoEstimateHours(project, settings, holidays);
    estimates.push({
      date,
      projectId: project.id,
      hours: autoHours,
      source: 'project-auto-estimate',
      isWorkingDay: true
    });
  }
  
  return estimates;
}

/**
 * Generate date range for project
 */
function generateProjectDateRange(project: Project): Date[] {
  const dates: Date[] = [];
  const start = new Date(project.startDate);
  const end = project.continuous 
    ? new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year for continuous
    : new Date(project.endDate);
  
  let current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Find which milestone covers a specific date
 */
function findMilestoneForDate(
  date: Date, 
  milestones: Milestone[],
  projectStartDate: Date
): Milestone | null {
  const sorted = sortMilestonesByDate(milestones);
  
  for (let i = 0; i < sorted.length; i++) {
    const milestone = sorted[i];
    const startDate = milestone.startDate || (i === 0 ? projectStartDate : sorted[i-1].endDate);
    const endDate = milestone.endDate;
    
    if (date >= startDate && date <= endDate) {
      return milestone;
    }
  }
  
  return null;
}

/**
 * Sort milestones by end date (chronological order)
 */
function sortMilestonesByDate(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
}

/**
 * Calculate hours for a specific day within a milestone
 */
function calculateMilestoneSegmentHours(
  milestone: Milestone,
  date: Date,
  project: Project,
  settings: Settings,
  holidays: Holiday[]
): number {
  // Determine milestone start date
  const milestoneStartDate = milestone.startDate || new Date(milestone.endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Get working days within the milestone period
  const workingDays = calculateWorkingDaysInRange(
    milestoneStartDate, 
    milestone.endDate, 
    project.autoEstimateDays,
    settings, 
    holidays
  );
  
  if (workingDays.length === 0) return 0;
  
  return milestone.timeAllocationHours / workingDays.length;
}

/**
 * Calculate project auto-estimate hours for a specific day
 */
function calculateProjectAutoEstimateHours(
  project: Project,
  settings: Settings,
  holidays: Holiday[]
): number {
  const endDate = project.continuous
    ? new Date(project.startDate.getTime() + 365 * 24 * 60 * 60 * 1000)
    : project.endDate;
  
  const workingDays = calculateWorkingDaysInRange(
    project.startDate, 
    endDate,
    project.autoEstimateDays,
    settings, 
    holidays
  );
  
  if (workingDays.length === 0) return 0;
  
  return project.estimatedHours / workingDays.length;
}

/**
 * Calculate working days in a date range
 */
function calculateWorkingDaysInRange(
  startDate: Date,
  endDate: Date,
  autoEstimateDays: Project['autoEstimateDays'],
  settings: Settings,
  holidays: Holiday[]
): Date[] {
  const workingDays: Date[] = [];
  let current = new Date(startDate);
  
  while (current <= endDate) {
    if (isDateWorkingDay(new Date(current), autoEstimateDays, settings, holidays)) {
      workingDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Check if date is a working day for this project
 */
function isDateWorkingDay(
  date: Date,
  autoEstimateDays: Project['autoEstimateDays'],
  settings: Settings,
  holidays: Holiday[]
): boolean {
  // Check holidays
  const isHoliday = holidays.some(holiday =>
    date >= holiday.startDate && date <= holiday.endDate
  );
  if (isHoliday) return false;
  
  // Check project's auto-estimate days
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const dayName = dayNames[date.getDay()];
  
  return autoEstimateDays?.[dayName] ?? true; // Default to true if not set
}

/**
 * Calculate planned hours for a specific date and project
 */
function calculatePlannedHoursForDate(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): number {
  const projectEvents = events.filter(event =>
    event.projectId === projectId &&
    isSameDate(new Date(event.startTime), date)
  );
  
  return projectEvents.reduce((total, event) => {
    const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    return total + duration;
  }, 0);
}

/**
 * Check if two dates are the same day
 */
function isSameDate(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}
