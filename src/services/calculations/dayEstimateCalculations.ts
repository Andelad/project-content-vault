/**
 * Day Estimate Calculations
 * 
 * Pure mathematical functions for calculating day-by-day time allocations.
 * This is the SINGLE SOURCE OF TRUTH for timeline rendering.
 * 
 * ✅ Pure functions only
 * ✅ Deterministic outputs
 * ✅ Mathematical operations only
 */

import { Milestone, Project, DayEstimate, Settings, Holiday } from '@/types';
import * as DateCalculations from './dateCalculations';
import { calculatePlannedTimeForDate } from '@/services/unified/UnifiedEventWorkHourService';

/**
 * Check if a date is a working day based on settings and holidays (for day estimates)
 */
export function isWorkingDayForEstimates(
  date: Date,
  settings: Settings,
  holidays: Holiday[],
  project?: Project
): boolean {
  // Check if it's a holiday
  const isHoliday = holidays.some(h => {
    const holidayStart = new Date(h.startDate);
    const holidayEnd = new Date(h.endDate);
    holidayStart.setHours(0, 0, 0, 0);
    holidayEnd.setHours(23, 59, 59, 999);
    return date >= holidayStart && date <= holidayEnd;
  });

  if (isHoliday) return false;

  // Check against project's autoEstimateDays if available
  if (project?.autoEstimateDays) {
    const dayOfWeek = date.getDay();
    const dayNames: Array<keyof typeof project.autoEstimateDays> = [
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    ];
    const dayName = dayNames[dayOfWeek];
    return project.autoEstimateDays[dayName] === true;
  }

  // Fallback to settings work hours
  const dayOfWeek = date.getDay();
  const dayNames: Array<keyof Settings['weeklyWorkHours']> = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];
  const dayName = dayNames[dayOfWeek];
  return (settings.weeklyWorkHours[dayName]?.length || 0) > 0;
}

/**
 * Get working days between two dates
 */
export function getWorkingDaysBetween(
  startDate: Date,
  endDate: Date,
  settings: Settings,
  holidays: Holiday[],
  project?: Project
): Date[] {
  const workingDays: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (isWorkingDayForEstimates(current, settings, holidays, project)) {
      workingDays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

/**
 * Calculate day estimates from a single milestone
 */
export function calculateMilestoneDayEstimates(
  milestone: Milestone,
  project: Project,
  settings: Settings,
  holidays: Holiday[]
): DayEstimate[] {
  const estimates: DayEstimate[] = [];

  // Use new fields if available, fallback to old fields
  const endDate = milestone.endDate || milestone.dueDate;
  const timeAllocationHours = milestone.timeAllocationHours ?? milestone.timeAllocation;
  
  // IMPORTANT: Don't use milestone.startDate from database - it was set incorrectly by migration
  // Instead, use project start date to distribute work from project start to milestone due date
  const startDate = project.startDate;

  // Get working days between start and end
  const workingDays = getWorkingDaysBetween(startDate, endDate, settings, holidays, project);

  if (workingDays.length === 0) {
    // If no working days, allocate everything to the end date
    estimates.push({
      date: new Date(endDate),
      projectId: project.id,
      hours: timeAllocationHours,
      source: 'milestone-allocation',
      milestoneId: milestone.id,
      isWorkingDay: false
    });
    return estimates;
  }

  // Distribute hours evenly across working days
  const hoursPerDay = timeAllocationHours / workingDays.length;

  workingDays.forEach(date => {
    estimates.push({
      date: new Date(date),
      projectId: project.id,
      hours: hoursPerDay,
      source: 'milestone-allocation',
      milestoneId: milestone.id,
      isWorkingDay: true
    });
  });

  return estimates;
}

/**
 * Calculate day estimates from recurring milestone configuration
 */
export function calculateRecurringMilestoneDayEstimates(
  milestone: Milestone,
  project: Project,
  settings: Settings,
  holidays: Holiday[]
): DayEstimate[] {
  if (!milestone.isRecurring || !milestone.recurringConfig) {
    return calculateMilestoneDayEstimates(milestone, project, settings, holidays);
  }

  const estimates: DayEstimate[] = [];
  const config = milestone.recurringConfig;
  const timeAllocationHours = milestone.timeAllocationHours ?? milestone.timeAllocation;

  // Generate occurrence dates
  const occurrences = generateRecurringOccurrences(
    milestone,
    project.startDate,
    project.endDate,
    project.continuous || false
  );

  // For each occurrence, distribute hours
  occurrences.forEach(occurrenceDate => {
    // Calculate the work period for this occurrence
    const occurrenceEndDate = new Date(occurrenceDate);
    
    // IMPORTANT: Don't use milestone.startDate - it's incorrect from migration
    // Default: work backwards by interval for the work period
    let occurrenceStartDate: Date;
    occurrenceStartDate = new Date(occurrenceDate);
    switch (config.type) {
      case 'daily':
        occurrenceStartDate.setDate(occurrenceStartDate.getDate() - config.interval);
        break;
      case 'weekly':
        occurrenceStartDate.setDate(occurrenceStartDate.getDate() - (7 * config.interval));
        break;
      case 'monthly':
        occurrenceStartDate.setMonth(occurrenceStartDate.getMonth() - config.interval);
        break;
    }

    // Get working days for this occurrence
    const workingDays = getWorkingDaysBetween(
      occurrenceStartDate,
      occurrenceEndDate,
      settings,
      holidays,
      project
    );

    if (workingDays.length === 0) {
      estimates.push({
        date: new Date(occurrenceEndDate),
        projectId: project.id,
        hours: timeAllocationHours,
        source: 'milestone-allocation',
        milestoneId: milestone.id,
        isWorkingDay: false
      });
    } else {
      const hoursPerDay = timeAllocationHours / workingDays.length;
      workingDays.forEach(date => {
        estimates.push({
          date: new Date(date),
          projectId: project.id,
          hours: hoursPerDay,
          source: 'milestone-allocation',
          milestoneId: milestone.id,
          isWorkingDay: true
        });
      });
    }
  });

  return estimates;
}

/**
 * Generate recurring milestone occurrence dates
 */
function generateRecurringOccurrences(
  milestone: Milestone,
  projectStartDate: Date,
  projectEndDate: Date,
  projectContinuous: boolean
): Date[] {
  if (!milestone.isRecurring || !milestone.recurringConfig) {
    return [milestone.endDate || milestone.dueDate];
  }

  const config = milestone.recurringConfig;
  const occurrences: Date[] = [];
  
  // Start from the first due date
  const current = new Date(milestone.endDate || milestone.dueDate);
  
  // End date for generation
  const endLimit = projectContinuous 
    ? new Date(current.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year for continuous
    : new Date(projectEndDate);

  let safetyCounter = 0;
  const MAX_OCCURRENCES = 100;

  while (current <= endLimit && safetyCounter < MAX_OCCURRENCES) {
    if (current >= projectStartDate) {
      occurrences.push(new Date(current));
    }

    // Move to next occurrence
    switch (config.type) {
      case 'daily':
        current.setDate(current.getDate() + config.interval);
        break;
      case 'weekly':
        if (config.weeklyDayOfWeek !== undefined) {
          // Move to specific day of week
          current.setDate(current.getDate() + (7 * config.interval));
          const targetDay = config.weeklyDayOfWeek;
          const currentDay = current.getDay();
          const daysToAdd = (targetDay - currentDay + 7) % 7;
          current.setDate(current.getDate() + daysToAdd);
        } else {
          current.setDate(current.getDate() + (7 * config.interval));
        }
        break;
      case 'monthly':
        if (config.monthlyPattern === 'date' && config.monthlyDate) {
          // Specific date of month
          current.setMonth(current.getMonth() + config.interval);
          current.setDate(Math.min(config.monthlyDate, new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()));
        } else if (config.monthlyPattern === 'dayOfWeek' && config.monthlyWeekOfMonth && config.monthlyDayOfWeek !== undefined) {
          // Specific week and day of month (e.g., 2nd Tuesday)
          current.setMonth(current.getMonth() + config.interval);
          const firstDayOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
          const firstTargetDay = (config.monthlyDayOfWeek - firstDayOfMonth.getDay() + 7) % 7;
          const targetDate = 1 + firstTargetDay + (config.monthlyWeekOfMonth - 1) * 7;
          current.setDate(targetDate);
        } else {
          current.setMonth(current.getMonth() + config.interval);
        }
        break;
    }

    safetyCounter++;
  }

  return occurrences;
}

/**
 * Calculate all day estimates for a project
 */
export function calculateProjectDayEstimates(
  project: Project,
  milestones: Milestone[],
  settings: Settings,
  holidays: Holiday[],
  events: any[] = []
): DayEstimate[] {
  const allEstimates: DayEstimate[] = [];

  // PRIORITY 1 - Handle planned events FIRST (they take precedence over milestones/auto-estimate)
  
  // PERFORMANCE OPTIMIZATION: Pre-index events by date instead of checking every date
  // This changes complexity from O(dates × events) to O(events)
  const eventsByDate = new Map<string, number>(); // dateKey -> total hours
  
  events.forEach(event => {
    if (event.projectId !== project.id) return; // Only events for this project
    
    // Calculate event duration in hours
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    // Get the date this event occurs on (normalized)
    const eventDate = new Date(startTime);
    eventDate.setHours(0, 0, 0, 0);
    const dateKey = eventDate.toISOString().split('T')[0];
    
    // Add to the total for this date
    eventsByDate.set(dateKey, (eventsByDate.get(dateKey) || 0) + durationHours);
  });
  
  // Now create estimates only for dates that have events
  const plannedEventDates = new Set<string>();
  eventsByDate.forEach((hours, dateKey) => {
    plannedEventDates.add(dateKey);
    allEstimates.push({
      date: new Date(dateKey + 'T00:00:00'),
      projectId: project.id,
      hours,
      source: 'planned-event',
      isWorkingDay: true
    });
  });

  // PRIORITY 2 - Process milestones (only for dates without planned events)
  let totalMilestoneEstimates = 0;
  milestones.forEach(milestone => {
    const milestoneEstimates = milestone.isRecurring
      ? calculateRecurringMilestoneDayEstimates(milestone, project, settings, holidays)
      : calculateMilestoneDayEstimates(milestone, project, settings, holidays);
    
    // Filter out milestone estimates that conflict with planned events
    const filteredEstimates = milestoneEstimates.filter(est => {
      const dateKey = est.date.toISOString().split('T')[0];
      return !plannedEventDates.has(dateKey);
    });
    
    totalMilestoneEstimates += filteredEstimates.length;
    allEstimates.push(...filteredEstimates);
  });

  // PRIORITY 3 - If no milestones, use project's auto-estimate logic (only for dates without planned events)
  if (milestones.length === 0 && project.estimatedHours > 0) {
    const workingDays = getWorkingDaysBetween(
      project.startDate,
      project.endDate,
      settings,
      holidays,
      project
    );

    if (workingDays.length > 0) {
      const hoursPerDay = project.estimatedHours / workingDays.length;
      
      // Filter out working days that have planned events
      const filteredWorkingDays = workingDays.filter(date => {
        const dateKey = date.toISOString().split('T')[0];
        return !plannedEventDates.has(dateKey);
      });
      
      filteredWorkingDays.forEach(date => {
        allEstimates.push({
          date: new Date(date),
          projectId: project.id,
          hours: hoursPerDay,
          source: 'project-auto-estimate',
          isWorkingDay: true
        });
      });
    }
  }

  return allEstimates;
}

/**
 * Aggregate day estimates by date (for multiple projects or milestones on same day)
 */
export function aggregateDayEstimatesByDate(estimates: DayEstimate[]): Map<string, DayEstimate[]> {
  const byDate = new Map<string, DayEstimate[]>();

  estimates.forEach(estimate => {
    const dateKey = estimate.date.toISOString().split('T')[0];
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }
    byDate.get(dateKey)!.push(estimate);
  });

  return byDate;
}

/**
 * Calculate total hours for a specific date from estimates
 */
export function calculateEstimatesTotalHours(estimates: DayEstimate[]): number {
  return estimates.reduce((sum, est) => sum + est.hours, 0);
}
