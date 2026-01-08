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
import { Phase, Project, DayEstimate, Settings, Holiday, CalendarEvent, PhaseDTO } from '@/types';
import * as DateCalculations from '@/utils/dateCalculations';
import { calculatePlannedTimeForDate } from '../availability/EventWorkHourIntegration';
import { TimelineRules } from '@/domain/rules/timeline/TimelineDisplay';
import { getDateKey } from '@/utils/dateFormatUtils';
import { PhaseRecurrenceService } from '@/domain/rules/phases/PhaseRecurrence';

/**
 * Sum planned + completed event hours within an inclusive date range
 * Planned time is a future projection and should reduce remaining auto-estimate.
 */
function sumCompletedEventHoursInRange(
  eventsByDate: Map<string, CalendarEvent[]>,
  startDate: Date,
  endDate: Date
): number {
  if (!eventsByDate || eventsByDate.size === 0) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  let total = 0;

  eventsByDate.forEach((eventsOnDay, dateKey) => {
    const day = new Date(`${dateKey}T00:00:00`);
    if (day < start || day > end) return;

    const breakdown = TimelineRules.calculateDayTimeBreakdown(eventsOnDay);
    total += breakdown.completedEventHours + breakdown.plannedEventHours;
  });

  return total;
}
/**
 * Check if a date is a working day based on settings and holidays (for day estimates)
 * 
 * Project-specific estimation logic that checks:
 * 1. Not a holiday
 * 2. Enabled in project.autoEstimateDays (if project provided)
 * 3. Fallback: has work hours configured in settings
 * 
 * Note: This is estimation-specific logic. For general calendar working day checks,
 * use utils/dateCalculations.isWorkingDay instead.
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
 * 
 * NEW (Nov 2025): Only includes today and future days to comply with
 * Phase Time Domain Rules (no estimated time in the past)
 */
export function getWorkingDaysBetween(
  startDate: Date,
  endDate: Date,
  settings: Settings,
  holidays: Holiday[],
  project?: Project
): Date[] {
  const workingDays: Date[] = [];
  // Normalize today to midnight for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Start from the later of startDate or today
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  // If start date is in the past, begin from today instead
  if (current < today) {
    current.setTime(today.getTime());
  }
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
 * Calculate day estimates from a single phase
 * NOTE: This function should receive phase.startDate correctly calculated by the caller
 * to represent the segment start (previous phase's endDate or project start)
 */
export function calculatePhaseDayEstimates(
  phase: PhaseDTO,
  project: Project,
  settings: Settings,
  holidays: Holiday[]
): DayEstimate[] {
  const estimates: DayEstimate[] = [];
  // Use new fields if available, fallback to old fields
  const endDate = phase.endDate || phase.dueDate;
  const timeAllocationHours = phase.timeAllocationHours ?? phase.timeAllocation;
  // Use phase.startDate if provided (correctly calculated segment start)
  // Otherwise fall back to project.startDate (for backward compatibility)
  const startDate = phase.startDate || project.startDate;
  // Get working days between start and end
  const workingDays = getWorkingDaysBetween(startDate, endDate, settings, holidays, project);
  if (workingDays.length === 0 || !Number.isFinite(timeAllocationHours) || timeAllocationHours <= 0) {
    return estimates;
  }
  // Distribute hours evenly across working days
  const hoursPerDay = timeAllocationHours / workingDays.length;
  workingDays.forEach(date => {
    estimates.push({
      date: new Date(date),
      projectId: project.id,
      hours: hoursPerDay,
      source: 'milestone-allocation', // Legacy field name; represents phase allocation
      milestoneId: phase.id, // Legacy field name; represents phaseId
      isWorkingDay: true
    });
  });
  return estimates;
}

/**
 * @deprecated Use calculatePhaseDayEstimates instead. Kept for backward compatibility.
 */
export function calculateMilestoneDayEstimates(
  phase: PhaseDTO,
  project: Project,
  settings: Settings,
  holidays: Holiday[]
): DayEstimate[] {
  return calculatePhaseDayEstimates(phase, project, settings, holidays);
}

/**
 * Calculate day estimates from recurring phase configuration
 */
export function calculateRecurringPhaseDayEstimates(
  phase: PhaseDTO,
  project: Project,
  settings: Settings,
  holidays: Holiday[],
  eventsByDate: Map<string, CalendarEvent[]> = new Map()
): DayEstimate[] {
  if (!phase.isRecurring || !phase.recurringConfig) {
    return calculatePhaseDayEstimates(phase, project, settings, holidays);
  }
  
  const estimates: DayEstimate[] = [];
  const config = phase.recurringConfig;
  const timeAllocationHours = phase.timeAllocationHours ?? phase.timeAllocation;
  
  
  // Generate occurrence dates
  const occurrences = generateRecurringOccurrences(
    phase,
    project.startDate,
    project.endDate,
    project.continuous || false
  );
  
  // Distribute hours across intervals between consecutive anchors, clamped to project window
  for (let i = 1; i < occurrences.length; i++) {
    const anchorBefore = new Date(occurrences[i - 1]);
    const anchorEnd = new Date(occurrences[i]);

    // Work period: FROM anchor (inclusive) TO day before next anchor (inclusive)
    // This gives exactly 7 days for weekly patterns
    const rawStart = anchorBefore; // Start ON the anchor, not day after
    const rawEnd = new Date(anchorEnd);
    rawEnd.setDate(rawEnd.getDate() - 1); // Day BEFORE next anchor

    // Clamp to project window
    const periodStart = rawStart < project.startDate ? new Date(project.startDate) : rawStart;
    const periodEnd = project.continuous ? rawEnd : (rawEnd > project.endDate ? new Date(project.endDate) : rawEnd);

    if (periodStart > periodEnd || !Number.isFinite(timeAllocationHours) || timeAllocationHours <= 0) {
      continue;
    }

    const workingDays = getWorkingDaysBetween(
      periodStart,
      periodEnd,
      settings,
      holidays,
      project
    );
    
    if (workingDays.length === 0) {
      continue;
    }

    const completedInOccurrence = sumCompletedEventHoursInRange(
      eventsByDate,
      periodStart,
      periodEnd
    );
    const remainingAllocation = Math.max(0, timeAllocationHours - completedInOccurrence);
    if (remainingAllocation <= 0) {
      continue;
    }

    const hoursPerDay = remainingAllocation / workingDays.length;
    
    
    workingDays.forEach(date => {
      estimates.push({
        date: new Date(date),
        projectId: project.id,
        hours: hoursPerDay,
        source: 'milestone-allocation', // Legacy field name; represents phase allocation
        milestoneId: phase.id, // Legacy field name; represents phaseId
        isWorkingDay: true
      });
    });
  }
  
  return estimates;
}
/**
 * Generate recurring phase occurrence dates
 */
/**
 * Generate recurring occurrence dates for a phase
 * 
 * Delegates to PhaseRecurrenceService for RRule-based recurrence logic.
 * Includes previous anchor to form the first interval.
 */
export function generateRecurringOccurrences(
  phase: PhaseDTO,
  projectStartDate: Date,
  projectEndDate: Date,
  projectContinuous: boolean
): Date[] {
  if (!phase.isRecurring || !phase.recurringConfig) {
    return [phase.endDate || phase.dueDate];
  }

  // Use PhaseRecurrenceService for RRule-based occurrence generation
  const occurrences = PhaseRecurrenceService.generateOccurrences({
    config: phase.recurringConfig,
    projectStartDate,
    projectEndDate,
    projectContinuous
  });

  // Extract dates from occurrence objects
  const dates = occurrences.map(occ => occ.date);

  // ALWAYS include previous anchor to form the first interval
  // The work period is "day after anchor0 to anchor1", so anchor0 should be the project start
  // when the first RRule occurrence falls on project start.
  if (dates.length > 0) {
    const firstOccurrence = dates[0];
    
    // Check if first occurrence is ON the project start date
    const firstOccurrenceOnStart = 
      firstOccurrence.toISOString().split('T')[0] === projectStartDate.toISOString().split('T')[0];
    
    if (firstOccurrenceOnStart) {
      // First occurrence IS project start - use it as the anchor
      // This creates: anchor0=projectStart, anchor1=nextOccurrence
      // Work period: day after projectStart → nextOccurrence (7 days for weekly)
      // No need to add previous anchor - first occurrence IS the starting anchor
    } else {
      // First occurrence is AFTER project start - calculate previous anchor
      const previousOccurrence = new Date(firstOccurrence);
      
      // Calculate previous occurrence based on pattern
      const config = phase.recurringConfig;
      switch (config.type) {
        case 'daily':
          previousOccurrence.setDate(previousOccurrence.getDate() - config.interval);
          break;
        case 'weekly':
          previousOccurrence.setDate(previousOccurrence.getDate() - (7 * config.interval));
          break;
        case 'monthly':
          previousOccurrence.setMonth(previousOccurrence.getMonth() - config.interval);
          break;
      }
      
      // Prepend previous anchor
      dates.unshift(previousOccurrence);
    }
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}
/**
 * Calculate all day estimates for a project
 */
export function calculateProjectDayEstimates(
  project: Project,
  phases: PhaseDTO[],
  settings: Settings,
  holidays: Holiday[],
  events: CalendarEvent[] = []
): DayEstimate[] {
  const allEstimates: DayEstimate[] = [];
  // PRIORITY 1 - Handle calendar events FIRST (they take precedence over phases/auto-estimate)
  // Use domain rules to classify events correctly
  // Filter to only events for this project (CRITICAL: Domain Rule 1)
  const projectEvents = TimelineRules.filterEventsForProject(events, project);
  // Group events by date using domain rules
  const eventsByDate = TimelineRules.groupEventsByDate(projectEvents);
  const allEventDates = new Set<string>(); // All dates with ANY events (blocks estimates)
  // Create ONE estimate per day with events
  // The estimate contains the event time (could be planned, completed, or both)
  eventsByDate.forEach((eventsOnDay, dateKey) => {
    allEventDates.add(dateKey);
    // Calculate breakdown for this day
    const breakdown = TimelineRules.calculateDayTimeBreakdown(eventsOnDay);
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
  // PRIORITY 2 - Process phases (only for dates without planned events)
  // Sort phases by due date to calculate segments correctly
  const sortedPhases = [...phases].sort((a, b) => {
    const dateA = new Date(a.endDate || a.dueDate);
    const dateB = new Date(b.endDate || b.dueDate);
    return dateA.getTime() - dateB.getTime();
  });
  let totalPhaseEstimates = 0;
  let previousPhaseEnd: Date | null = null;
  sortedPhases.forEach(phase => {
    // CRITICAL: If phase already has startDate, use it!
    // Only calculate segment start for deadline-only phases (no startDate)
    const segmentStart = phase.startDate
      ? new Date(phase.startDate) // Phase: Use actual phase start date
      : previousPhaseEnd 
        ? new Date(previousPhaseEnd.getTime() + 24 * 60 * 60 * 1000) // Day after previous
        : new Date(project.startDate);
    // Normalize end for comparisons
    const phaseEnd = new Date(phase.endDate || phase.dueDate);

    // Determine remaining allocation after subtracting completed hours in this phase range
    const originalAllocation = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
    const completedInPhase = sumCompletedEventHoursInRange(eventsByDate, segmentStart, phaseEnd);
    const remainingAllocation = Math.max(0, originalAllocation - completedInPhase);

    // If nothing remains, skip auto-estimate generation for this phase
    if (remainingAllocation <= 0) {
      previousPhaseEnd = phaseEnd;
      return;
    }

    // Create phase object with adjusted allocation (no rollover to other phases)
    const phaseWithAdjustedAllocation: Phase = {
      ...phase,
      startDate: segmentStart,
      timeAllocationHours: remainingAllocation,
      timeAllocation: remainingAllocation
    };
    const phaseEstimates = phase.isRecurring
      ? calculateRecurringPhaseDayEstimates(
          phaseWithAdjustedAllocation,
          project,
          settings,
          holidays,
          eventsByDate
        )
      : calculatePhaseDayEstimates(phaseWithAdjustedAllocation, project, settings, holidays);
    // Update the previous phase end for next iteration
    previousPhaseEnd = phaseEnd;
    // Filter out phase estimates that conflict with ANY events (planned OR completed)
    // Use domain rule: Auto-estimates only on days WITHOUT events
    // AND ensure they don't extend beyond project end date (only for non-continuous projects)
    const projectEndDate = new Date(project.endDate);
    projectEndDate.setHours(23, 59, 59, 999);
    const filteredEstimates = phaseEstimates.filter(est => {
      const dateKey = getDateKey(est.date);
      const estDate = new Date(est.date);
      estDate.setHours(0, 0, 0, 0);
      // Domain Rule: Auto-estimates blocked by ANY events (planned or completed)
      const hasEventsOnDay = allEventDates.has(dateKey);
      // For continuous projects, don't filter by end date
      // For non-continuous projects, only include estimates up to project end date
      const isWithinProjectBounds = project.continuous || estDate <= projectEndDate;
      const shouldInclude = !hasEventsOnDay && isWithinProjectBounds;
      return shouldInclude;
    });

    // REDISTRIBUTE: Only apply to non-recurring phases. For recurring phases, each occurrence
    // already allocates per-period hours; re-spreading across all occurrences collapses hours.
    let redistributedEstimates = filteredEstimates;
    if (!phase.isRecurring && filteredEstimates.length > 0) {
      const redistributedHoursPerDay = remainingAllocation / filteredEstimates.length;
      redistributedEstimates = filteredEstimates.map(est => ({
        ...est,
        hours: redistributedHoursPerDay
      }));
    }

    totalPhaseEstimates += redistributedEstimates.length;
    allEstimates.push(...redistributedEstimates);
  });
  // PRIORITY 3 - If no phases, use project's auto-estimate logic
  // Domain Rule: Auto-estimates only on days WITHOUT events
  // Note: Skip auto-estimates for continuous projects or when no budget is defined
  if (phases.length === 0 && Number.isFinite(project.estimatedHours) && project.estimatedHours > 0 && !project.continuous) {
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);

    // Subtract completed hours within the project range (planned time does not subtract)
    const completedInProject = sumCompletedEventHoursInRange(
      eventsByDate,
      projectStart,
      projectEnd
    );
    const remainingBudget = Math.max(0, project.estimatedHours - completedInProject);
    if (remainingBudget <= 0) {
      return allEstimates; // Fully completed; no auto-estimates remain
    }

    const workingDays = getWorkingDaysBetween(
      project.startDate,
      project.endDate,
      settings,
      holidays,
      project
    );
    if (workingDays.length === 0) {
      return allEstimates;
    }

    // Filter out working days that have ANY events (planned or completed)
    // Domain Rule: Auto-estimates only on days WITHOUT events
    const filteredWorkingDays = workingDays.filter(date => {
      const dateKey = getDateKey(date);
      return !allEventDates.has(dateKey);
    });
    if (filteredWorkingDays.length === 0) {
      return allEstimates;
    }

    const hoursPerDay = remainingBudget / filteredWorkingDays.length;
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
  return allEstimates;
}
/**
 * Aggregate day estimates by date (for multiple projects or milestones on same day)
 */
export function aggregateDayEstimatesByDate(estimates: DayEstimate[]): Map<string, DayEstimate[]> {
  const byDate = new Map<string, DayEstimate[]>();
  estimates.forEach(estimate => {
    const dateKey = getDateKey(estimate.date);
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
