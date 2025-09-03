/**
 * Milestone Utilities Service
 * 
 * This service handles milestone time distribution calculations and utilities
 * extracted from the milestoneUtils library. It provides milestone-specific
 * calculations for project timeline management and time allocation.
 * 
 * Key Features:
 * - Milestone time distribution across project timeline
 * - Daily time allocation based on milestone scheduling
 * - Milestone date calculations and validation
 * - Timeline integration for milestone-based projects
 * - Backward compatibility with deprecated functions
 * 
 * @module MilestoneUtilitiesService
 */

import type { Milestone } from '@/types/core';
import { MilestoneManagementService } from './milestoneManagementService';
import { cachedMilestoneCalculation } from '@/lib/milestoneCache';
import { calculateAutoEstimateWorkingDays } from '@/services/projects/ProjectCalculations';

/**
 * Interface for milestone time distribution entry
 */
export interface MilestoneTimeDistributionEntry {
  date: Date;
  estimatedHours: number;
  milestone?: Milestone;
  dayIndex: number;
  isDeadlineDay: boolean;
}

/**
 * Interface for milestone distribution analysis
 */
export interface MilestoneDistributionAnalysis {
  totalHours: number;
  averageHoursPerDay: number;
  peakDays: Date[];
  lightDays: Date[];
  milestoneCount: number;
  distributionEfficiency: number;
  recommendations: string[];
}

/**
 * Interface for milestone scheduling result
 */
export interface MilestoneSchedulingResult {
  distribution: MilestoneTimeDistributionEntry[];
  analysis: MilestoneDistributionAnalysis;
  conflicts: Array<{
    date: Date;
    conflictingMilestones: Milestone[];
    totalHours: number;
  }>;
}

/**
 * Configuration constants for milestone calculations
 */
export const MILESTONE_CALCULATION_CONFIG = {
  MAX_DAILY_MILESTONE_HOURS: 12,
  RECOMMENDED_DAILY_MILESTONE_HOURS: 8,
  MIN_DAYS_BETWEEN_MILESTONES: 1,
  DISTRIBUTION_EFFICIENCY_THRESHOLD: 0.8,
  WORKLOAD_WARNING_THRESHOLD: 10 // hours per day
} as const;

/**
 * Calculate daily time allocation for milestones
 * Distributes milestone hours across the days between milestones
 * 
 * ⚠️ MIGRATION: This function now delegates to UnifiedMilestoneService
 * All existing imports continue to work unchanged.
 * 
 * @param milestones - Array of milestones to distribute
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @param autoEstimateDays - Optional auto-estimate days filter
 * @param settings - Optional settings for holiday checking
 * @param holidays - Optional holidays array
 * @returns Array of daily time distribution entries
 */
export function calculateMilestoneTimeDistribution(
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date,
  autoEstimateDays?: any,
  settings?: any,
  holidays?: any[]
): MilestoneTimeDistributionEntry[] {
  // Delegate to unified service for consistent calculation
  const { UnifiedMilestoneService } = require('../core/unified/UnifiedMilestoneService');
  
  return UnifiedMilestoneService.calculateTimeDistribution(
    milestones,
    projectStartDate,
    projectEndDate,
    {
      autoEstimateDays,
      settings,
      holidays
    }
  );
}

/**
 * Calculate enhanced milestone time distribution with workload analysis
 * 
 * @param milestones - Array of milestones
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @returns Comprehensive milestone scheduling result
 */
export function calculateAdvancedMilestoneDistribution(
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): MilestoneSchedulingResult {
  const distribution = calculateMilestoneTimeDistribution(milestones, projectStartDate, projectEndDate);
  
  // Analyze distribution
  let totalHours = 0;
  const dailyHours = new Map<string, number>();
  const peakDays: Date[] = [];
  const lightDays: Date[] = [];
  
  distribution.forEach(entry => {
    totalHours += entry.estimatedHours;
    const dateKey = entry.date.toISOString().split('T')[0];
    const currentHours = dailyHours.get(dateKey) || 0;
    dailyHours.set(dateKey, currentHours + entry.estimatedHours);
  });
  
  // Identify peak and light days
  dailyHours.forEach((hours, dateKey) => {
    const date = new Date(dateKey);
    if (hours > MILESTONE_CALCULATION_CONFIG.WORKLOAD_WARNING_THRESHOLD) {
      peakDays.push(date);
    } else if (hours < MILESTONE_CALCULATION_CONFIG.RECOMMENDED_DAILY_MILESTONE_HOURS / 2) {
      lightDays.push(date);
    }
  });
  
  const averageHoursPerDay = distribution.length > 0 ? totalHours / distribution.length : 0;
  const maxDailyHours = Math.max(...Array.from(dailyHours.values()));
  const distributionEfficiency = maxDailyHours > 0 ? 
    (averageHoursPerDay / maxDailyHours) : 1;
  
  // Detect conflicts (multiple milestones on same day)
  const conflicts: MilestoneSchedulingResult['conflicts'] = [];
  const milestonesByDate = new Map<string, Milestone[]>();
  
  distribution.forEach(entry => {
    if (entry.milestone) {
      const dateKey = entry.date.toISOString().split('T')[0];
      const existing = milestonesByDate.get(dateKey) || [];
      existing.push(entry.milestone);
      milestonesByDate.set(dateKey, existing);
    }
  });
  
  milestonesByDate.forEach((milestones, dateKey) => {
    if (milestones.length > 1) {
      const date = new Date(dateKey);
      const totalHours = milestones.reduce((sum, m) => sum + m.timeAllocation, 0);
      conflicts.push({
        date,
        conflictingMilestones: milestones,
        totalHours
      });
    }
  });
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (peakDays.length > 0) {
    recommendations.push(`${peakDays.length} day(s) with high workload (>${MILESTONE_CALCULATION_CONFIG.WORKLOAD_WARNING_THRESHOLD}h). Consider redistributing milestones.`);
  }
  
  if (conflicts.length > 0) {
    recommendations.push(`${conflicts.length} milestone conflict(s) detected. Stagger milestone deadlines for better workload distribution.`);
  }
  
  if (distributionEfficiency < MILESTONE_CALCULATION_CONFIG.DISTRIBUTION_EFFICIENCY_THRESHOLD) {
    recommendations.push('Uneven milestone distribution detected. Consider adjusting milestone timing for smoother workload.');
  }
  
  if (lightDays.length > distribution.length * 0.3) {
    recommendations.push('Many light workload days detected. Consider consolidating milestones or adding buffer time.');
  }
  
  const analysis: MilestoneDistributionAnalysis = {
    totalHours,
    averageHoursPerDay,
    peakDays,
    lightDays,
    milestoneCount: milestones.length,
    distributionEfficiency,
    recommendations
  };
  
  return {
    distribution,
    analysis,
    conflicts
  };
}

/**
 * Get total estimated hours for a specific date based on milestone distribution
 * 
 * @param date - Date to calculate for
 * @param milestones - Array of milestones
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @returns Estimated hours for the date
 */
export function getEstimatedHoursForDate(
  date: Date,
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): number {
  const distribution = calculateMilestoneTimeDistribution(milestones, projectStartDate, projectEndDate);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return distribution
    .filter(entry => entry.date.getTime() === targetDate.getTime())
    .reduce((total, entry) => total + entry.estimatedHours, 0);
}

/**
 * Get milestone that is due on a specific date
 * 
 * @param date - Date to check
 * @param milestones - Array of milestones
 * @returns Milestone due on the date, if any
 */
export function getMilestoneForDate(
  date: Date,
  milestones: Milestone[]
): Milestone | undefined {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return milestones.find(milestone => {
    const milestoneDate = new Date(milestone.dueDate);
    milestoneDate.setHours(0, 0, 0, 0);
    return milestoneDate.getTime() === targetDate.getTime();
  });
}

/**
 * Get all milestones due within a date range
 * 
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @param milestones - Array of milestones
 * @returns Milestones due within the range
 */
export function getMilestonesInDateRange(
  startDate: Date,
  endDate: Date,
  milestones: Milestone[]
): Milestone[] {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return milestones.filter(milestone => {
    const milestoneDate = new Date(milestone.dueDate);
    return milestoneDate >= start && milestoneDate <= end;
  });
}

/**
 * Calculate optimal milestone spacing for even workload distribution
 * 
 * @param totalHours - Total project hours
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @param targetMilestones - Number of milestones desired
 * @returns Suggested milestone dates and allocations
 */
export function calculateOptimalMilestoneSpacing(
  totalHours: number,
  projectStartDate: Date,
  projectEndDate: Date,
  targetMilestones: number
): Array<{ suggestedDate: Date; suggestedHours: number; reason: string }> {
  const projectDuration = projectEndDate.getTime() - projectStartDate.getTime();
  const dayDuration = 24 * 60 * 60 * 1000;
  const totalDays = Math.ceil(projectDuration / dayDuration);
  
  const hoursPerMilestone = totalHours / targetMilestones;
  const daysPerMilestone = totalDays / targetMilestones;
  
  const suggestions = [];
  
  for (let i = 1; i <= targetMilestones; i++) {
    const dayOffset = Math.round(daysPerMilestone * i);
    const suggestedDate = new Date(projectStartDate.getTime() + (dayOffset * dayDuration));
    
    suggestions.push({
      suggestedDate,
      suggestedHours: hoursPerMilestone,
      reason: `Milestone ${i} of ${targetMilestones} - even distribution`
    });
  }
  
  return suggestions;
}

/**
 * Validate milestone scheduling for conflicts and feasibility
 * 
 * @param milestones - Array of milestones to validate
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @returns Validation results with issues and recommendations
 */
export function validateMilestoneScheduling(
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Check for milestones outside project timeframe
  milestones.forEach((milestone, index) => {
    const milestoneDate = new Date(milestone.dueDate);
    if (milestoneDate < projectStartDate) {
      issues.push(`Milestone ${index + 1} is scheduled before project start date.`);
    }
    if (milestoneDate > projectEndDate) {
      issues.push(`Milestone ${index + 1} is scheduled after project end date.`);
    }
  });
  
  // Check for chronological order
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  for (let i = 1; i < sortedMilestones.length; i++) {
    const prevDate = new Date(sortedMilestones[i - 1].dueDate);
    const currDate = new Date(sortedMilestones[i].dueDate);
    const daysDiff = (currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000);
    
    if (daysDiff < MILESTONE_CALCULATION_CONFIG.MIN_DAYS_BETWEEN_MILESTONES) {
      warnings.push(`Milestones too close together (${daysDiff.toFixed(1)} days). Consider spacing them out.`);
    }
  }
  
  // Analyze distribution
  const distributionResult = calculateAdvancedMilestoneDistribution(milestones, projectStartDate, projectEndDate);
  
  if (distributionResult.conflicts.length > 0) {
    issues.push(`${distributionResult.conflicts.length} milestone scheduling conflicts detected.`);
  }
  
  recommendations.push(...distributionResult.analysis.recommendations);
  
  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    recommendations
  };
}

// Backward compatibility functions for milestone management
// @deprecated Use MilestoneManagementService instead

/**
 * @deprecated Use MilestoneManagementService.calculateMilestoneDateRange
 */
export function calculateMilestoneDateRange(
  projectStartDate: Date,
  projectEndDate: Date,
  existingMilestones: Milestone[],
  currentMilestone?: Milestone
) {
  console.warn('calculateMilestoneDateRange is deprecated. Use MilestoneManagementService.calculateMilestoneDateRange instead.');
  return MilestoneManagementService.calculateMilestoneDateRange({
    projectStartDate,
    projectEndDate,
    existingMilestones,
    currentMilestone
  });
}

/**
 * @deprecated Use MilestoneManagementService.calculateDefaultMilestoneDate
 */
export function calculateDefaultMilestoneDate(
  projectStartDate: Date,
  projectEndDate: Date,
  existingMilestones: Milestone[]
) {
  console.warn('calculateDefaultMilestoneDate is deprecated. Use MilestoneManagementService.calculateDefaultMilestoneDate instead.');
  return MilestoneManagementService.calculateDefaultMilestoneDate({
    projectStartDate,
    projectEndDate,
    existingMilestones
  });
}

/**
 * @deprecated Use MilestoneManagementService.generateOrdinalNumber
 */
export function getOrdinalNumber(num: number): string {
  console.warn('getOrdinalNumber is deprecated. Use MilestoneManagementService.generateOrdinalNumber instead.');
  return MilestoneManagementService.generateOrdinalNumber(num);
}

// Re-export the service for convenience
export { MilestoneManagementService };

// =====================================================================================
// MILESTONE SEGMENT CALCULATIONS
// =====================================================================================

import type { Holiday, WorkHour } from '@/types/core';
import { calculateWorkHourCapacity } from '@/services/work-hours/legacy/workHourCapacityService';
import { HeightCalculationService } from '@/services/timeline/legacy/HeightCalculationService';

export interface MilestoneSegment {
  id: string;
  startDate: Date;
  endDate: Date;
  milestone?: Milestone;
  allocatedHours: number;
  workingDays: number;
  hoursPerDay: number;
  heightInPixels: number;
}

/**
 * Calculate milestone segments with auto-estimate data
 * Divides project timeline into segments between milestones
 */
export function calculateMilestoneSegments(
  projectId: string,
  projectStartDate: Date,
  projectEndDate: Date,
  milestones: Milestone[],
  settings: any,
  holidays: Holiday[],
  isWorkingDay: (date: Date) => boolean,
  events: any[] = [],
  projectTotalBudget?: number,
  workHours?: WorkHour[],
  autoEstimateDays?: any
): MilestoneSegment[] {
  // Create a unique identifier for this calculation
  const milestoneIds = milestones.map(m => m.id).sort().join(',');
  const calculationId = `segments-${projectId}-${milestoneIds}`;

  return cachedMilestoneCalculation(
    calculationId,
    projectId,
    null, // No single milestone for segment calculations
    { id: projectId, startDate: projectStartDate, endDate: projectEndDate, estimatedHours: projectTotalBudget },
    settings,
    holidays,
    workHours || [],
    events,
    () => {
      // Original calculation logic moved inside the cache wrapper
      // Filter and sort milestones for this project
      const projectMilestones = milestones
        .filter(m => m.projectId === projectId)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      if (projectMilestones.length === 0) {
        return [];
      }

      const segments: MilestoneSegment[] = [];
      let currentStartDate = new Date(projectStartDate);
      currentStartDate.setHours(0, 0, 0, 0);

      // Create segments between milestones
      for (let i = 0; i < projectMilestones.length; i++) {
        const milestone = projectMilestones[i];
        const milestoneDate = new Date(milestone.dueDate);
        milestoneDate.setHours(0, 0, 0, 0);

        // Segment end date is the milestone date itself (work happens up TO and INCLUDING the milestone)
        const segmentEndDate = new Date(milestoneDate);

        // Calculate working days in this segment (including milestone day)
        const workingDays = autoEstimateDays 
          ? calculateAutoEstimateWorkingDays(
              currentStartDate,
              segmentEndDate, 
              autoEstimateDays,
              settings,
              holidays.map(h => new Date(h.startDate))
            ).length
          : calculateWorkingDaysInRange(
              currentStartDate,
              segmentEndDate,
              isWorkingDay,
              holidays,
              workHours
            );

        // Calculate total planned time in this segment
        const plannedTimeInSegment = calculatePlannedTimeInSegment(
          projectId,
          currentStartDate,
          segmentEndDate,
          events
        );

        // Subtract planned time from milestone budget for auto-estimate
        const remainingBudget = Math.max(0, milestone.timeAllocation - plannedTimeInSegment);

        // Calculate hours per day and visual height
        const hoursPerDay = workingDays > 0 ? remainingBudget / workingDays : 0;
        
        // Debug log to verify milestone segment calculation
        console.log(`[DEBUG] Milestone ${milestone.name}: ${remainingBudget}h ÷ ${workingDays} days = ${hoursPerDay}h per day (${(hoursPerDay * 60).toFixed(1)} min/day) from ${currentStartDate.toDateString()} to ${segmentEndDate.toDateString()}`);
        
        const heightInPixels = HeightCalculationService.calculateSegmentHeight(hoursPerDay);

        segments.push({
          id: `segment-${milestone.id}`,
          startDate: new Date(currentStartDate),
          endDate: new Date(segmentEndDate),
          milestone,
          allocatedHours: milestone.timeAllocation,
          workingDays,
          hoursPerDay,
          heightInPixels
        });

        // Move to next segment start (day after current milestone)
        currentStartDate = new Date(milestoneDate);
        currentStartDate.setDate(currentStartDate.getDate() + 1);
        currentStartDate.setHours(0, 0, 0, 0);
      }

      return segments;
    }
  );
}

/**
 * Get milestone segment for a specific date
 */
export function getMilestoneSegmentForDate(
  date: Date,
  segments: MilestoneSegment[]
): MilestoneSegment | null {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  for (const segment of segments) {
    const segmentStart = new Date(segment.startDate);
    segmentStart.setHours(0, 0, 0, 0);
    
    const segmentEnd = new Date(segment.endDate);
    segmentEnd.setHours(0, 0, 0, 0);

    if (targetDate >= segmentStart && targetDate <= segmentEnd) {
      return segment;
    }
  }

  return null;
}

/**
 * Calculate working days in a date range
 */
function calculateWorkingDaysInRange(
  startDate: Date,
  endDate: Date,
  isWorkingDay: (date: Date) => boolean,
  holidays: Holiday[],
  workHours?: WorkHour[]
): number {
  let workingDays = 0;
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const isWorking = isWorkingDay(currentDate);
    const isHoliday = holidays.some(holiday => {
      const holidayDate = new Date(holiday.startDate);
      return holidayDate.toDateString() === currentDate.toDateString();
    });

    if (isWorking && !isHoliday) {
      // Check if there are work hours for this day
      const hasWorkHours = workHours ? workHours.some(wh => {
        const whDate = new Date(wh.startTime);
        return whDate.toDateString() === currentDate.toDateString();
      }) : true;

      if (hasWorkHours) {
        workingDays++;
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}

/**
 * Calculate planned time in a segment from events
 */
function calculatePlannedTimeInSegment(
  projectId: string,
  startDate: Date,
  endDate: Date,
  events: any[]
): number {
  const segmentEvents = events.filter(event => {
    if (event.projectId !== projectId) return false;
    
    const eventDate = new Date(event.startTime);
    return eventDate >= startDate && eventDate <= endDate;
  });

  return segmentEvents.reduce((total, event) => {
    if (event.endTime) {
      const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
      return total + duration;
    }
    return total;
  }, 0);
}

/**
 * Calculate the interval type and value between two milestone dates
 * Extracted from ProjectMilestoneSection component logic
 * 
 * @param firstDate - First milestone date
 * @param secondDate - Second milestone date  
 * @returns Object with interval type and value
 */
export function calculateMilestoneInterval(
  firstDate: Date, 
  secondDate: Date
): { type: 'daily' | 'weekly' | 'monthly' | 'custom'; interval: number } {
  const daysDifference = Math.round((secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDifference === 1) {
    return { type: 'daily', interval: 1 };
  } else if (daysDifference === 7) {
    return { type: 'weekly', interval: 1 };
  } else if (daysDifference >= 28 && daysDifference <= 31) {
    return { type: 'monthly', interval: 1 };
  } else if (daysDifference % 7 === 0) {
    return { type: 'weekly', interval: daysDifference / 7 };
  } else {
    return { type: 'custom', interval: daysDifference };
  }
}

/**
 * Validate milestone budget and return formatted results
 * Extracted from ProjectMilestoneSection budget validation logic
 * 
 * @param currentTotal - Current total allocation
 * @param additionalHours - Additional hours to add
 * @param projectBudget - Total project budget
 * @returns Validation result with formatted total
 */
export function validateMilestoneBudget(
  currentTotal: number,
  additionalHours: number, 
  projectBudget: number
): { isValid: boolean; newTotal: number; formattedTotal: string } {
  const newTotal = currentTotal + additionalHours;
  return {
    isValid: newTotal <= projectBudget,
    newTotal,
    formattedTotal: `${Math.ceil(newTotal)}h`
  };
}

/**
 * Format milestone budget value for display
 * Extracted from ProjectMilestoneSection formatting logic
 * 
 * @param hours - Hours value to format
 * @returns Formatted hours string with 'h' suffix
 */
export function formatMilestoneBudget(hours: number): string {
  return `${Math.ceil(hours)}h`;
}
