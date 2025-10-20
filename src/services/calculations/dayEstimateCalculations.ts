/**
 * Day Estimate Calculations
 * 
 * Pure mathematical functions for calculating day-by-day time allocations.
 * This is the SINGLE SOURCE OF TRUTH for timeline rendering.
 * 
 * ✅ Pure functions only
 * ✅ Deterministic outputs
 * ✅ Mathematical operations only
 * ✅ Delegates to domain rules for business logic
 */

import { Milestone, Project, DayEstimate, Settings, Holiday } from '@/types';
import * as DateCalculations from './dateCalculations';
import { calculatePlannedTimeForDate } from '@/services/unified/UnifiedEventWorkHourService';
import { TimelineRules } from '@/domain/rules';

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
 * NOTE: This function should receive milestone.startDate correctly calculated by the caller
 * to represent the segment start (previous milestone's dueDate or project start)
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
  
  // Use milestone.startDate if provided (correctly calculated segment start)
  // Otherwise fall back to project.startDate (for backward compatibility)
  const startDate = milestone.startDate || project.startDate;

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
  
  // Start from project start date (not milestone due date)
  let current = new Date(projectStartDate);
  current.setHours(0, 0, 0, 0);
  
  // End date for generation
  const endLimit = projectContinuous 
    ? new Date(current.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year for continuous
    : new Date(projectEndDate);
  endLimit.setHours(23, 59, 59, 999);

  let safetyCounter = 0;
  const MAX_OCCURRENCES = 100;

  // Initialize first occurrence based on pattern
  switch (config.type) {
    case 'daily':
      // First occurrence is project start + interval
      current.setDate(current.getDate() + config.interval);
      break;
    case 'weekly':
      if (config.weeklyDayOfWeek !== undefined) {
        // Find the first occurrence of the target day on or after project start
        const targetDayOfWeek = config.weeklyDayOfWeek;
        const projectStartDay = current.getDay();
        const daysUntilFirstOccurrence = targetDayOfWeek >= projectStartDay
          ? targetDayOfWeek - projectStartDay
          : 7 - projectStartDay + targetDayOfWeek;
        current.setDate(current.getDate() + daysUntilFirstOccurrence);
      } else {
        current.setDate(current.getDate() + (7 * config.interval));
      }
      break;
    case 'monthly':
      if (config.monthlyPattern === 'date' && config.monthlyDate) {
        // Find first occurrence of specific date on or after project start
        current.setDate(config.monthlyDate);
        // If we've passed this date in the current month, move to next month
        if (current < projectStartDate) {
          current.setMonth(current.getMonth() + 1);
          current.setDate(Math.min(config.monthlyDate, new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()));
        }
      } else if (config.monthlyPattern === 'dayOfWeek' && config.monthlyWeekOfMonth && config.monthlyDayOfWeek !== undefined) {
        // Find first occurrence of day of week pattern
        const firstDayOfMonth = new Date(current.getFullYear(), current.getMonth(), 1);
        const firstTargetDay = (config.monthlyDayOfWeek - firstDayOfMonth.getDay() + 7) % 7;
        const targetDateInMonth = 1 + firstTargetDay + (config.monthlyWeekOfMonth - 1) * 7;
        current.setDate(targetDateInMonth);
        
        // If we've passed this date, move to next month
        if (current < projectStartDate) {
          current.setMonth(current.getMonth() + 1);
          const nextFirstDay = new Date(current.getFullYear(), current.getMonth(), 1);
          const nextFirstTarget = (config.monthlyDayOfWeek - nextFirstDay.getDay() + 7) % 7;
          current.setDate(1 + nextFirstTarget + (config.monthlyWeekOfMonth - 1) * 7);
        }
      } else {
        current.setMonth(current.getMonth() + config.interval);
      }
      break;
  }

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
        // Simply add the interval weeks
        current.setDate(current.getDate() + (7 * config.interval));
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

  // PRIORITY 1 - Handle calendar events FIRST (they take precedence over milestones/auto-estimate)
  // Use domain rules to classify events correctly
  
  // Filter to only events for this project (CRITICAL: Domain Rule 1)
  const projectEvents = TimelineRules.filterEventsForProject(events, project);
  
  // DEBUG: Log events for Budgi project
  if (project.name === 'Budgi') {
    console.log(`[DayEstimates] Budgi project events:`, projectEvents.map(e => ({
      id: e.id,
      startTime: e.startTime,
      endTime: e.endTime,
      completed: e.completed,
      type: e.type,
      duration: e.duration
    })));
  }
  
  // Group events by date using domain rules
  const eventsByDate = TimelineRules.groupEventsByDate(projectEvents);
  const allEventDates = new Set<string>(); // All dates with ANY events (blocks estimates)
  
  // Create ONE estimate per day with events
  // The estimate contains the event time (could be planned, completed, or both)
  eventsByDate.forEach((eventsOnDay, dateKey) => {
    allEventDates.add(dateKey);
    
    // Calculate breakdown for this day
    const breakdown = TimelineRules.calculateDayTimeBreakdown(eventsOnDay);
    
    // DEBUG: Log breakdown for Budgi on Aug 13
    if (project.name === 'Budgi' && dateKey === '2024-08-13') {
      console.log(`[DayEstimates] Budgi Aug 13 breakdown:`, {
        dateKey,
        eventsOnDay: eventsOnDay.map(e => ({
          id: e.id,
          startTime: e.startTime,
          endTime: e.endTime,
          completed: e.completed,
          type: e.type,
          duration: e.duration
        })),
        breakdown
      });
    }
    
    // Create a single estimate for this day
    // Total hours = planned + completed event hours
    const totalEventHours = breakdown.plannedEventHours + breakdown.completedEventHours;
    
    if (totalEventHours > 0) {
      allEstimates.push({
        date: new Date(dateKey + 'T00:00:00'),
        projectId: project.id,
        hours: totalEventHours,
        source: 'event' as const,
        isWorkingDay: true,
        isPlannedEvent: breakdown.plannedEventHours > 0,
        isCompletedEvent: breakdown.completedEventHours > 0
      });
    }
  });

  // PRIORITY 2 - Process milestones (only for dates without planned events)
  // Sort milestones by due date to calculate segments correctly
  const sortedMilestones = [...milestones].sort((a, b) => {
    const dateA = new Date(a.endDate || a.dueDate);
    const dateB = new Date(b.endDate || b.dueDate);
    return dateA.getTime() - dateB.getTime();
  });

  let totalMilestoneEstimates = 0;
  let previousMilestoneEnd: Date | null = null;

  sortedMilestones.forEach(milestone => {
    // Calculate the correct segment start for this milestone
    // Segment = from (previous milestone end) or (project start) to (this milestone end)
    const segmentStart = previousMilestoneEnd 
      ? new Date(previousMilestoneEnd.getTime() + 24 * 60 * 60 * 1000) // Day after previous
      : new Date(project.startDate);
    
    // Create a milestone with the correct segment startDate
    const milestoneWithSegment = {
      ...milestone,
      startDate: segmentStart
    };

    const milestoneEstimates = milestone.isRecurring
      ? calculateRecurringMilestoneDayEstimates(milestoneWithSegment, project, settings, holidays)
      : calculateMilestoneDayEstimates(milestoneWithSegment, project, settings, holidays);
    
    // Update the previous milestone end for next iteration
    previousMilestoneEnd = new Date(milestone.endDate || milestone.dueDate);

    // Filter out milestone estimates that conflict with ANY events (planned OR completed)
    // Use domain rule: Auto-estimates only on days WITHOUT events
    // AND ensure they don't extend beyond project end date
    const projectEndDate = new Date(project.endDate);
    projectEndDate.setHours(23, 59, 59, 999);
    
    const filteredEstimates = milestoneEstimates.filter(est => {
      const dateKey = est.date.toISOString().split('T')[0];
      const estDate = new Date(est.date);
      estDate.setHours(0, 0, 0, 0);
      
      // Domain Rule: Auto-estimates blocked by ANY events (planned or completed)
      const hasEventsOnDay = allEventDates.has(dateKey);
      const shouldInclude = !hasEventsOnDay && estDate <= projectEndDate;
      
      return shouldInclude;
    });
    
    totalMilestoneEstimates += filteredEstimates.length;
    allEstimates.push(...filteredEstimates);
  });

  // PRIORITY 3 - If no milestones, use project's auto-estimate logic
  // Domain Rule: Auto-estimates only on days WITHOUT events
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
      
      // Filter out working days that have ANY events (planned or completed)
      // Domain Rule: Auto-estimates only on days WITHOUT events
      const filteredWorkingDays = workingDays.filter(date => {
        const dateKey = date.toISOString().split('T')[0];
        return !allEventDates.has(dateKey);
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
