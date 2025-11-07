/**
 * Event Work Hour Integration Service
 * 
 * This service handles complex calculations between calendar events and work hours,
 * including overlap detection, time allocation, overtime calculation, and project
 * time management extracted from the eventWorkHourUtils library.
 * 
 * Key Features:
 * - Event-work hour overlap calculations
 * - Project time allocation analysis
 * - Overtime and planned time tracking
 * - Work schedule integration
 * - Performance-optimized memoized calculations
 * - Cross-midnight event handling
 * 
 * @module EventWorkHourIntegrationService
 */

import { 
  calculateDateDuration,
  calculateBusinessDaysBetween,
  calculateBusinessDaysInRange,
  isHoliday,
  calculateTimeOverlapMinutes 
} from '../calculations/general/dateCalculations';

import { WorkHour, CalendarEvent } from '@/types';
import { calculateAutoEstimateWorkingDays, calculateEventDurationOnDateLegacy as calculateEventDurationOnDate } from '@/services';
import { memoizeExpensiveCalculation, timelineCalculationCache } from '../performance/cachePerformanceService';
import { getCalendarEventBackgroundColor, getCalendarEventTextColor } from '@/constants/colors';
import { ColorCalculationService } from '../ui/ColorCalculations';

/**
 * Clear the timeline calculation cache - useful when project settings change
 */
export function clearTimelineCache() {
  timelineCalculationCache.clear();
}

/**
 * Interface for project time allocation analysis
 */
export interface ProjectTimeAllocation {
  type: 'planned' | 'auto-estimate' | 'none';
  hours: number;
  isWorkingDay: boolean;
}

/**
 * Interface for daily time breakdown
 */
export interface DailyTimeBreakdown {
  plannedHours: number;
  overtimeHours: number;
  availabilityReduction: number;
  otherTime: number;
  totalWorkTime: number;
}

/**
 * Interface for project working days calculation
 */
export interface ProjectWorkingDaysResult {
  workingDays: Date[];
  totalDays: number;
  workingDayCount: number;
  holidayCount: number;
}

// Debug counters for performance monitoring
let allocationCallCount = 0;

/**
 * Configuration constants for work hour calculations
 */
export const WORK_HOUR_CALCULATION_LIMITS = {
  MAX_CALCULATION_WINDOW_YEARS: 2,
  PERFORMANCE_WARNING_THRESHOLD: 1, // milliseconds
  CACHE_BATCH_SIZE: 100,
  MAX_OVERLAP_PRECISION: 0.01 // 0.6 minutes
} as const;

/**
 * Calculate overlap between an event and work hours in minutes
 * DELEGATES to single source of truth
 * 
 * @param event - Calendar event to check
 * @param workHours - Array of work hours for comparison
 * @returns Total overlap in minutes
 */
export function calculateEventWorkHourOverlap(
  event: CalendarEvent,
  workHours: WorkHour[]
): number {
  let totalOverlapMinutes = 0;

  for (const workHour of workHours) {
    // Check if event and work hour are on the same day
    const eventDate = event.startTime.toDateString();
    const workDate = workHour.startTime.toDateString();
    
    if (eventDate !== workDate) {
      continue;
    }

    // Use single source of truth for overlap calculation
    const overlapMinutes = calculateTimeOverlapMinutes(
      event.startTime,
      event.endTime,
      workHour.startTime,
      workHour.endTime
    );

    totalOverlapMinutes += overlapMinutes;
  }

  return Math.round(totalOverlapMinutes * 100) / 100; // Round to avoid floating point precision issues
}

/**
 * Calculate planned time for a project on a specific date
 * 
 * @param projectId - ID of the project
 * @param date - Date to calculate for
 * @param events - Array of calendar events
 * @returns Total planned hours for the project on this date
 */
export function calculatePlannedTimeForDate(
  projectId: string,
  date: Date,
  events: CalendarEvent[]
): number {
  return events
    .filter(event => event.projectId === projectId)
    .reduce((total, event) => {
      // Use cross-midnight calculation for accurate duration
      const durationOnDate = calculateEventDurationOnDate(event, date);
      return total + durationOnDate;
    }, 0);
}

/**
 * Calculate total availability reduction for a date due to events
 * 
 * @param date - Date to analyze
 * @param events - Array of calendar events
 * @param workHours - Array of work hours
 * @returns Total reduction in available hours
 */
export function calculateAvailabilityReduction(
  date: Date,
  events: CalendarEvent[],
  workHours: WorkHour[]
): number {
  const targetDateString = date.toDateString();
  
  // Get events for this date
  const dayEvents = events.filter(event => 
    event.startTime.toDateString() === targetDateString
  );

  let totalReductionHours = 0;

  for (const event of dayEvents) {
    const overlapMinutes = calculateEventWorkHourOverlap(event, workHours);
    totalReductionHours += overlapMinutes / 60;
  }

  return totalReductionHours;
}

/**
 * Generate work hours for a specific date based on settings
 * 
 * @param date - Date to generate work hours for
 * @param settings - User settings containing weekly work schedule
 * @param holidays - Array of holiday definitions (optional)
 * @returns Array of work hour objects for the date (empty if date is a holiday)
 */
export function generateWorkHoursForDate(
  date: Date,
  settings: any,
  holidays: any[] = []
): WorkHour[] {
  // Check if the date is a holiday - holidays override work hours
  const isHolidayDate = holidays.some(holiday => {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    holidayStart.setHours(0, 0, 0, 0);
    holidayEnd.setHours(23, 59, 59, 999);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate >= holidayStart && checkDate <= holidayEnd;
  });

  // If it's a holiday, return no work hours
  if (isHolidayDate) {
    return [];
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
  const workSlots = settings.weeklyWorkHours[dayName] || [];

  if (!Array.isArray(workSlots)) {
    return [];
  }

  return workSlots.map((slot, index) => {
    const startTime = new Date(date);
    const [startHour, startMin] = slot.startTime.split(':').map(Number);
    startTime.setHours(startHour, startMin, 0, 0);

    const endTime = new Date(date);
    const [endHour, endMin] = slot.endTime.split(':').map(Number);
    endTime.setHours(endHour, endMin, 0, 0);

    return {
      id: `work-${String(dayName)}-${index}`,
      title: 'Work Hours',
      startTime,
      endTime,
      duration: Number(slot.duration),
      type: 'work' as const
    };
  });
}

/**
 * Calculate project working days within a date range
 * 
 * @param projectStart - Project start date
 * @param projectEnd - Project end date
 * @param settings - User settings with work schedule
 * @param holidays - Array of holiday definitions
 * @returns Project working days analysis
 */
export function calculateProjectWorkingDays(
  projectStart: Date,
  projectEnd: Date,
  settings: any,
  holidays: any[]
): ProjectWorkingDaysResult {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const workingDays: Date[] = [];
  let totalDays = 0;
  let holidayCount = 0;
  
  for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
    totalDays++;
    const checkDate = new Date(d);
    const checkDayName = dayNames[checkDate.getDay()] as keyof typeof settings.weeklyWorkHours;
    const checkWorkSlots = settings.weeklyWorkHours[checkDayName] || [];
    
    const checkIsHoliday = holidays.some(holiday => 
      checkDate >= new Date(holiday.startDate) && checkDate <= new Date(holiday.endDate)
    );
    
    if (checkIsHoliday) {
      holidayCount++;
    } else if (Array.isArray(checkWorkSlots) && 
               checkWorkSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0) {
      workingDays.push(new Date(checkDate));
    }
  }
  
  return {
    workingDays,
    totalDays,
    workingDayCount: workingDays.length,
    holidayCount
  };
}

/**
 * Memoized calculation of working days for a project
 * Performance-optimized version with efficient cache key generation
 */
export const memoizedProjectWorkingDays = memoizeExpensiveCalculation(
  (projectStart: Date, projectEnd: Date, settings: any, holidays: any[]) => {
    const result = calculateProjectWorkingDays(projectStart, projectEnd, settings, holidays);
    return result.workingDays;
  },
  timelineCalculationCache,
  (projectStart, projectEnd, settings, holidays) => {
    // Efficient cache key generation
    const settingsHash = Object.keys(settings.weeklyWorkHours || {}).map(day => {
      const slots = settings.weeklyWorkHours[day];
      return Array.isArray(slots) ? slots.reduce((sum, slot) => sum + slot.duration, 0) : (slots || 0);
    }).join('-');
    
    const holidaysHash = holidays.map(h => `${h.id}`).join(',');
    
    return `days-${projectStart.getTime()}-${projectEnd.getTime()}-${settingsHash}-${holidaysHash}`;
  }
);

/**
 * Calculate project time allocation type for a specific date
 * 
 * @param projectId - Project identifier
 * @param date - Date to analyze
 * @param events - Calendar events array
 * @param project - Project object
 * @param settings - User settings
 * @param holidays - Holiday definitions
 * @returns Time allocation analysis
 */
export function getProjectTimeAllocation(
  projectId: string,
  date: Date,
  events: CalendarEvent[],
  project: any,
  settings: any,
  holidays: any[]
): ProjectTimeAllocation {
  allocationCallCount++;
  const startTime = performance.now();
  
  if (allocationCallCount % WORK_HOUR_CALCULATION_LIMITS.CACHE_BATCH_SIZE === 0) {
    // Performance tracking - call count reached batch size
  }
  
  // IMPORTANT: Check for planned time FIRST, before checking work day status
  // Planned/completed time should always show regardless of work day settings
  const plannedHours = calculatePlannedTimeForDate(projectId, date, events);
  
  if (plannedHours > 0) {
    // Return planned time even on non-work days
    return { type: 'planned', hours: plannedHours, isWorkingDay: true };
  }
  
  // Now check if it's a working day (only affects auto-estimate)
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
  const workSlots = settings.weeklyWorkHours[dayName] || [];
  
  // Check if it's a holiday
  const isHoliday = holidays.some(holiday => 
    date >= new Date(holiday.startDate) && date <= new Date(holiday.endDate)
  );
  
  const isWorkingDay = !isHoliday && Array.isArray(workSlots) && 
    workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;

  // For auto-estimate, respect work day restrictions
  if (!isWorkingDay) {
    return { type: 'none', hours: 0, isWorkingDay: false };
  }

  // Check if this date is within the project timeframe
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  const projectStart = new Date(project.startDate);
  projectStart.setHours(0, 0, 0, 0);
  
  // For continuous projects, only check start date
  if (project.continuous) {
    if (normalizedDate < projectStart) {
      return { type: 'none', hours: 0, isWorkingDay: true };
    }
  } else {
    const projectEnd = new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);
    
    if (normalizedDate < projectStart || normalizedDate > projectEnd) {
      return { type: 'none', hours: 0, isWorkingDay: true };
    }
  }

  // Calculate effective project end for working days calculation
  let effectiveProjectEnd: Date;
  if (project.continuous) {
    // Use reasonable calculation window for continuous projects
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxWindow = new Date(projectStart);
    maxWindow.setFullYear(maxWindow.getFullYear() + WORK_HOUR_CALCULATION_LIMITS.MAX_CALCULATION_WINDOW_YEARS);
    const oneYearFromToday = new Date(today);
    oneYearFromToday.setFullYear(oneYearFromToday.getFullYear() + 1);
    
    effectiveProjectEnd = maxWindow > oneYearFromToday ? maxWindow : oneYearFromToday;
  } else {
    effectiveProjectEnd = new Date(project.endDate);
    effectiveProjectEnd.setHours(0, 0, 0, 0);
  }

  // Use the new auto-estimate working days calculation that respects excluded days
  const projectWorkingDays = calculateAutoEstimateWorkingDays(
    projectStart, 
    effectiveProjectEnd, 
    project.autoEstimateDays, 
    settings, 
    holidays
  );

  if (projectWorkingDays.length === 0) {
    return { type: 'none', hours: 0, isWorkingDay: true };
  }

  // Check if the current date is in the list of auto-estimate working days
  const currentDateString = normalizedDate.toDateString();
  const isInAutoEstimateDays = projectWorkingDays.some(workDay => 
    workDay.toDateString() === currentDateString
  );

  if (!isInAutoEstimateDays) {
    return { type: 'none', hours: 0, isWorkingDay: true };
  }

  const autoEstimateHours = project.estimatedHours / projectWorkingDays.length;
  
  const endTime = performance.now();
  if (endTime - startTime > WORK_HOUR_CALCULATION_LIMITS.PERFORMANCE_WARNING_THRESHOLD) {
    // Performance warning - slow calculation detected
  }
  
  return { type: 'auto-estimate', hours: autoEstimateHours, isWorkingDay: true };
}

/**
 * Memoized version of getProjectTimeAllocation for performance optimization
 */
export const memoizedGetProjectTimeAllocation = memoizeExpensiveCalculation(
  getProjectTimeAllocation,
  timelineCalculationCache,
  (projectId, date, events, project, settings, holidays) => {
    // Efficient cache key with reduced granularity
    const settingsHash = Object.keys(settings.weeklyWorkHours || {}).map(day => {
      const slots = settings.weeklyWorkHours[day];
      return Array.isArray(slots) ? slots.reduce((sum, slot) => sum + slot.duration, 0) : (slots || 0);
    }).join('-');
    
    const holidaysHash = holidays.map(h => `${h.id}`).join(',');
    
    // Include events in cache key for planned time detection
    const eventsHash = events
      .filter(e => e.projectId === projectId)
      .map(e => `${e.id}-${e.startTime.getTime()}-${e.endTime.getTime()}`)
      .sort()
      .join(',');
    
    // Include autoEstimateDays in cache key to invalidate cache when days change
    const autoEstimateDaysHash = project.autoEstimateDays ? 
      Object.entries(project.autoEstimateDays)
        .sort()
        .map(([day, enabled]) => `${day}:${enabled}`)
        .join(',') : 
      'default';
    
    return `alloc-${projectId}-${date.getTime()}-${project.estimatedHours}-${project.startDate.getTime()}-${project.endDate.getTime()}-${settingsHash}-${holidaysHash}-${eventsHash}-${autoEstimateDaysHash}`;
  }
);

/**
 * Calculate overtime planned hours for a specific date
 * Shows time planned and attributed to projects outside of work hours
 * 
 * @param date - Date to analyze
 * @param events - Calendar events array
 * @param workHours - Work hours for the date
 * @returns Overtime hours
 */
export function calculateOvertimePlannedHours(
  date: Date,
  events: CalendarEvent[],
  workHours: WorkHour[]
): number {
  // Get events that occur on this date and have a projectId
  const dayProjectEvents = events.filter(event => 
    event.projectId && calculateEventDurationOnDate(event, date) > 0
  );

  let overtimeHours = 0;

  for (const event of dayProjectEvents) {
    // Calculate total event duration for this specific date
    const eventDurationHours = calculateEventDurationOnDate(event, date);
    
    if (eventDurationHours === 0) continue;
    
    // Calculate overlap with work hours
    const overlapMinutes = calculateEventWorkHourOverlap(event, workHours);
    const overlapHours = overlapMinutes / 60;
    
    // For cross-midnight events, limit overlap to this date's portion
    const dailyOverlapHours = Math.min(overlapHours, eventDurationHours);
    
    // Overtime is the portion that doesn't overlap with work hours
    const eventOvertimeHours = Math.max(0, eventDurationHours - dailyOverlapHours);
    overtimeHours += eventOvertimeHours;
  }

  return overtimeHours;
}

/**
 * Calculate total planned hours for a specific date
 * Shows completed and currently tracking project work only
 * Excludes habits, tasks, and future planned events
 * 
 * @param date - Date to analyze
 * @param events - Calendar events array
 * @returns Total completed/tracking hours
 */
export function calculateTotalPlannedHours(
  date: Date,
  events: CalendarEvent[]
): number {
  return events
    .filter(event => 
      event.projectId && // Only project-attributed events
      event.category !== 'habit' && // Habits never count toward project time
      event.category !== 'task' && // Tasks never count toward project time
      (event.completed || event.type === 'completed' || event.type === 'tracked') // Only completed or tracking
    )
    .reduce((total, event) => {
      const durationOnDate = calculateEventDurationOnDate(event, date);
      return total + durationOnDate;
    }, 0);
}

/**
 * Calculate other time for a specific date
 * Shows any event not attributed to a project
 * 
 * @param date - Date to analyze
 * @param events - Calendar events array
 * @returns Other time hours
 */
export function calculateOtherTime(
  date: Date,
  events: CalendarEvent[]
): number {
  return events
    .filter(event => !event.projectId) // Only non-project events
    .reduce((total, event) => {
      const durationOnDate = calculateEventDurationOnDate(event, date);
      return total + durationOnDate;
    }, 0);
}

/**
 * Calculate comprehensive daily time breakdown
 * 
 * @param date - Date to analyze
 * @param events - Calendar events array
 * @param workHours - Work hours for the date
 * @returns Complete time breakdown analysis
 */
export function calculateDailyTimeBreakdown(
  date: Date,
  events: CalendarEvent[],
  workHours: WorkHour[]
): DailyTimeBreakdown {
  const plannedHours = calculateTotalPlannedHours(date, events);
  const overtimeHours = calculateOvertimePlannedHours(date, events, workHours);
  const availabilityReduction = calculateAvailabilityReduction(date, events, workHours);
  const otherTime = calculateOtherTime(date, events);
  const totalWorkTime = plannedHours + otherTime;

  return {
    plannedHours,
    overtimeHours,
    availabilityReduction,
    otherTime,
    totalWorkTime
  };
}

/**
 * Reset allocation call counter for performance monitoring
 */
export function resetAllocationCallCounter(): void {
  allocationCallCount = 0;
}

/**
 * Get current allocation call count for debugging
 */
export function getAllocationCallCount(): number {
  return allocationCallCount;
}

// =====================================================================================
// EVENT STYLING SERVICE FUNCTIONS
// =====================================================================================

/**
 * Configuration for event styling
 */
export interface EventStyleConfig {
  isSelected?: boolean;
  isFutureEvent?: boolean;
  isActiveLayer?: boolean;
  isCompleted?: boolean;
}

/**
 * Result of event style calculation
 */
export interface EventStyleResult {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  opacity: number;
}

/**
 * Calculate event styling colors and opacity based on state
 * Now uses centralized style constants from constants/styles.ts
 */
export function calculateEventStyle(
  baseColor: string,
  config: EventStyleConfig = {}
): EventStyleResult {
  const { isSelected = false, isFutureEvent = false, isActiveLayer = true, isCompleted = false } = config;
  
  // Determine background color based on state using centralized styles
  let backgroundColor: string;
  if (isFutureEvent) {
    backgroundColor = ColorCalculationService.getEventBackgroundColor(baseColor, 'future');
  } else if (isSelected) {
    backgroundColor = ColorCalculationService.getEventBackgroundColor(baseColor, 'selected');
  } else {
    backgroundColor = ColorCalculationService.getEventBackgroundColor(baseColor, 'default');
  }
  
  // Calculate text color using centralized styles
  const textColor = ColorCalculationService.getEventTextColor(baseColor);
  
  // Calculate border color for selected events using centralized styles
  const borderColor = isSelected 
    ? ColorCalculationService.getEventBorderColor(baseColor)
    : 'transparent';
  
  // Calculate opacity using centralized styles
  const opacity = ColorCalculationService.getEventOpacity(isCompleted, isActiveLayer);
  
  return {
    backgroundColor,
    textColor,
    borderColor,
    opacity
  };
}

/**
 * Extract OKLCH color components for manipulation
 */
export function parseOklchColor(color: string): { lightness: number; chroma: number; hue: number } | null {
  const match = color.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
  if (match) {
    const [, lightness, chroma, hue] = match;
    return {
      lightness: parseFloat(lightness),
      chroma: parseFloat(chroma),
      hue: parseFloat(hue)
    };
  }
  return null;
}

/**
 * Create OKLCH color string from components
 */
export function createOklchColor(lightness: number, chroma: number, hue: number): string {
  return `oklch(${lightness} ${chroma} ${hue})`;
}
