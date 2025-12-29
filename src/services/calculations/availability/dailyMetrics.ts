/**
 * Daily Metrics Service
 * 
 * KEYWORDS: daily availability, daily hours, available hours, daily project hours,
 *           work hours for day, daily capacity, day availability, daily metrics,
 *           get daily hours
 * 
 * Calculates work hours and availability metrics for specific days.
 * Following AI Development Rules:
 * - Pure calculations (no side effects, no state, no database access)
 * - No business context - just date and settings math
 * 
 * USE WHEN:
 * - Calculating work hours for a specific day
 * - Getting daily project allocation
 * - Calculating available hours after project allocation
 * 
 * RELATED FILES:
 * - workHourGeneration.ts - For work hour generation and totals
 * - capacityAnalysis.ts - For multi-day capacity analysis
 * 
 * Note: isWorkingDay is already in dateCalculations.ts and is authoritative
 */

import { getDayName, isWorkingDay } from '../general/dateCalculations';
import { 
  isHolidayDateCapacity, 
  calculateAvailabilityReduction,
  generateWorkHoursForDate 
} from './capacityAnalysis';
import { calculateWorkHoursTotal } from './workHourGeneration';
import { calculateProjectDayEstimates } from '../projects/dayEstimateCalculations';
import type { Project, CalendarEvent, Phase, Settings, Holiday } from '@/types/core';

/**
 * Get total work hours for a specific day
 * Returns 0 for holidays or days without configured work hours
 */
export function getWorkHoursForDay(date: Date, holidays: Holiday[], settings: Settings): number {
  if (isHolidayDateCapacity(date, holidays)) {
    return 0;
  }
  
  const dayName = getDayName(date);
  const dayData = settings.weeklyWorkHours[dayName];
  
  if (Array.isArray(dayData)) {
    return calculateWorkHoursTotal(dayData);
  }
  
  return typeof dayData === 'number' ? dayData : 0;
}

/**
 * Calculate total daily project hours for a date
 * Uses same logic as project bars - includes milestone allocations, events, and auto-estimates
 */
export function calculateDailyProjectHours(
  date: Date,
  projects: Project[],
  settings: Settings,
  holidays: Holiday[],
  milestones: Phase[] = [],
  events: CalendarEvent[] = []
): number {
  let totalHours = 0;
  
  // Use isWorkingDay from dateCalculations with holiday dates
  const holidayDates = holidays.map(h => new Date(h.startDate));
  if (!isWorkingDay(date, settings, holidayDates)) {
    return 0;
  }
  
  // Normalize date to midnight for comparison
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const dateKey = targetDate.toDateString();
  
  // Calculate day estimates for each project (same logic as project bars)
  projects.forEach((project) => {
    const projectStart = new Date(project.startDate);
    projectStart.setHours(0, 0, 0, 0);
    const projectEnd = project.continuous ? new Date('2099-12-31') : new Date(project.endDate);
    projectEnd.setHours(23, 59, 59, 999);
    
    // Only process if date is within project range
    if (targetDate >= projectStart && targetDate <= projectEnd) {
      // Get milestones for this project
      const projectMilestones = milestones.filter((m) => m.projectId === project.id);
      // Get events for this project
      const projectEvents = events.filter((e) => e.projectId === project.id);
      
      // Calculate day estimates using the same method as project bars
      const dayEstimates = calculateProjectDayEstimates(
        project,
        projectMilestones,
        settings,
        holidays,
        projectEvents
      );
      
      // Find estimate for this specific date
      const estimateForDate = dayEstimates.find((est) => {
        const estDate = new Date(est.date);
        estDate.setHours(0, 0, 0, 0);
        return estDate.toDateString() === dateKey;
      });
      
      if (estimateForDate) {
        // Count ALL project time: events, milestones, and auto-estimates
        totalHours += estimateForDate.hours;
      }
    }
  });
  
  return totalHours;
}

/**
 * Calculate daily available hours after accounting for events
 * Returns work hours minus event reduction
 */
export function calculateDailyAvailableHours(
  date: Date,
  events: CalendarEvent[],
  settings: Settings,
  holidays: Holiday[]
): number {
  const workHours = getWorkHoursForDay(date, holidays, settings);
  
  if (workHours === 0) {
    return 0;
  }
  
  const workHourObjects = generateWorkHoursForDate(date, settings, holidays);
  
  // Calculate availability reduction from events
  const eventReduction = calculateAvailabilityReduction(date, events, workHourObjects);
  
  return Math.max(0, workHours - eventReduction);
}
