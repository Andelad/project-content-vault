/**
 * Milestone Calculations
 * 
 * Pure mathematical functions for milestone-related calculations.
 * No side effects, no external dependencies, fully testable.
 * 
 * ✅ Pure functions only
 * ✅ Deterministic outputs
 * ✅ Mathematical operations only
 */

import { Milestone } from '@/types/core';
import * as DateCalculations from './dateCalculations';

/**
 * Calculate total time allocation across milestones
 */
export function calculateTotalAllocation(milestones: Milestone[]): number {
  return milestones.reduce((sum, milestone) => sum + (milestone.timeAllocationHours || 0), 0);
}

/**
 * Calculate budget utilization percentage
 */
export function calculateBudgetUtilization(totalAllocated: number, projectBudget: number): number {
  return projectBudget > 0 ? (totalAllocated / projectBudget) * 100 : 0;
}

/**
 * Calculate remaining budget
 */
export function calculateRemainingBudget(totalAllocated: number, projectBudget: number): number {
  return Math.max(0, projectBudget - totalAllocated);
}

/**
 * Calculate overage amount
 */
export function calculateOverageAmount(totalAllocated: number, projectBudget: number): number {
  return Math.max(0, totalAllocated - projectBudget);
}

/**
 * Calculate milestone density (milestones per day) for a date range
 */
export function calculateMilestoneDensity(
  milestones: Milestone[],
  startDate: Date,
  endDate: Date
): number {
  const milestonesInRange = milestones.filter(m => 
    DateCalculations.isDateInRange(m.endDate, startDate, endDate)
  );
  
  const totalDays = DateCalculations.calculateDayDifference(startDate, endDate);
  return totalDays > 0 ? milestonesInRange.length / totalDays : 0;
}

/**
 * Calculate average milestone allocation
 */
export function calculateAverageMilestoneAllocation(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  return calculateTotalAllocation(milestones) / milestones.length;
}

/**
 * Calculate milestone allocation distribution (min, max, avg)
 */
export function calculateAllocationDistribution(milestones: Milestone[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
} {
  if (milestones.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0 };
  }

  const allocations = milestones.map(m => m.timeAllocationHours || 0).sort((a, b) => a - b);
  const min = allocations[0];
  const max = allocations[allocations.length - 1];
  const avg = calculateAverageMilestoneAllocation(milestones);
  
  const medianIndex = Math.floor(allocations.length / 2);
  const median = allocations.length % 2 === 0
    ? (allocations[medianIndex - 1] + allocations[medianIndex]) / 2
    : allocations[medianIndex];

  return { min, max, avg, median };
}

/**
 * Calculate optimal milestone spacing based on project duration
 */
export function calculateOptimalMilestoneSpacing(
  projectStartDate: Date,
  projectEndDate: Date,
  targetMilestoneCount: number
): Date[] {
  if (targetMilestoneCount <= 0) return [];

  const totalDays = DateCalculations.calculateDayDifference(projectStartDate, projectEndDate);
  const interval = Math.floor(totalDays / (targetMilestoneCount + 1));
  
  const milestones: Date[] = [];
  for (let i = 1; i <= targetMilestoneCount; i++) {
    const milestoneDate = new Date(projectStartDate);
    milestoneDate.setDate(milestoneDate.getDate() + (interval * i));
    milestones.push(milestoneDate);
  }

  return milestones;
}

/**
 * Calculate business day spacing for milestones
 */
export function calculateBusinessDaySpacing(
  projectStartDate: Date,
  projectEndDate: Date,
  targetMilestoneCount: number,
  holidays: Date[] = []
): Date[] {
  if (targetMilestoneCount <= 0) return [];

  const businessDays = DateCalculations.calculateBusinessDaysBetween(
    projectStartDate, 
    projectEndDate, 
    holidays
  );
  
  const interval = Math.floor(businessDays / (targetMilestoneCount + 1));
  
  const milestones: Date[] = [];
  let currentDate = new Date(projectStartDate);
  
  for (let i = 1; i <= targetMilestoneCount; i++) {
    currentDate = DateCalculations.addBusinessDays(currentDate, interval, holidays);
    milestones.push(new Date(currentDate));
  }

  return milestones;
}

/**
 * Calculate milestone timeline pressure (how tightly packed milestones are)
 */
export function calculateTimelinePressure(
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): {
  pressure: number; // 0-1 scale, 1 = very tight
  averageDaysBetween: number;
  minDaysBetween: number;
  maxDaysBetween: number;
} {
  if (milestones.length <= 1) {
    return { pressure: 0, averageDaysBetween: 0, minDaysBetween: 0, maxDaysBetween: 0 };
  }

  // Sort milestones by date
  const sortedMilestones = [...milestones].sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
  
  // Calculate gaps between consecutive milestones
  const gaps: number[] = [];
  
  // Gap from project start to first milestone
  gaps.push(DateCalculations.calculateDayDifference(projectStartDate, sortedMilestones[0].endDate));
  
  // Gaps between consecutive milestones
  for (let i = 1; i < sortedMilestones.length; i++) {
    gaps.push(DateCalculations.calculateDayDifference(
      sortedMilestones[i - 1].endDate,
      sortedMilestones[i].endDate
    ));
  }
  
  // Gap from last milestone to project end
  gaps.push(DateCalculations.calculateDayDifference(
    sortedMilestones[sortedMilestones.length - 1].endDate,
    projectEndDate
  ));

  const averageDaysBetween = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const minDaysBetween = Math.min(...gaps);
  const maxDaysBetween = Math.max(...gaps);
  
  // Calculate pressure (inverse of average gap, normalized)
  const totalProjectDays = DateCalculations.calculateDayDifference(projectStartDate, projectEndDate);
  const idealGap = totalProjectDays / (milestones.length + 1);
  const pressure = Math.min(1, idealGap / Math.max(1, averageDaysBetween));

  return {
    pressure,
    averageDaysBetween,
    minDaysBetween,
    maxDaysBetween
  };
}

/**
 * Calculate milestone completion velocity (for tracking progress)
 */
export function calculateMilestoneVelocity(
  completedMilestones: Milestone[],
  totalMilestones: Milestone[],
  projectStartDate: Date,
  currentDate: Date = new Date()
): {
  completionRate: number; // milestones per day
  projectedCompletionDate: Date | null;
  onTrackPercentage: number; // 0-100, how on track the project is
} {
  const daysSinceStart = DateCalculations.calculateDayDifference(projectStartDate, currentDate);
  const completionRate = daysSinceStart > 0 ? completedMilestones.length / daysSinceStart : 0;
  
  const remainingMilestones = totalMilestones.length - completedMilestones.length;
  const projectedCompletionDate = completionRate > 0 
    ? DateCalculations.addBusinessDays(currentDate, Math.ceil(remainingMilestones / completionRate))
    : null;

  // Calculate if on track (comparing actual vs expected progress)
  const expectedCompletedByNow = totalMilestones.filter(m => m.endDate <= currentDate).length;
  const onTrackPercentage = expectedCompletedByNow > 0 
    ? Math.min(100, (completedMilestones.length / expectedCompletedByNow) * 100)
    : 100;

  return {
    completionRate,
    projectedCompletionDate,
    onTrackPercentage
  };
}

/**
 * Calculate suggested milestone budget based on remaining project budget
 */
export function calculateSuggestedMilestoneBudget(
  remainingBudget: number,
  remainingMilestones: number,
  existingMilestoneVariance: number = 0.2 // 20% variance allowance
): {
  suggested: number;
  min: number;
  max: number;
} {
  if (remainingMilestones <= 0) {
    return { suggested: 0, min: 0, max: 0 };
  }

  const baseBudget = remainingBudget / remainingMilestones;
  const variance = baseBudget * existingMilestoneVariance;

  return {
    suggested: Math.round(baseBudget),
    min: Math.max(0, Math.round(baseBudget - variance)),
    max: Math.round(baseBudget + variance)
  };
}

/**
 * Sort milestones by due date (endDate)
 */
export function sortMilestonesByDate(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
}

/**
 * Find appropriate gap between milestones for positioning
 */
export function findMilestoneGap(
  sortedMilestones: Milestone[], 
  targetDate: Date
): { startDate: Date; endDate: Date } | null {
  if (sortedMilestones.length === 0) {
    return null;
  }

  // Find the gap where the target date should be placed
  for (let i = 0; i < sortedMilestones.length - 1; i++) {
    const current = sortedMilestones[i];
    const next = sortedMilestones[i + 1];
    
    if (targetDate > current.endDate && targetDate < next.endDate) {
      const startDate = new Date(current.endDate);
      startDate.setDate(startDate.getDate() + 1);
      
      const endDate = new Date(next.endDate);
      endDate.setDate(endDate.getDate() - 1);
      
      return { startDate, endDate };
    }
  }
  
  return null;
}

// ============================================================================
// RECURRING MILESTONE CALCULATIONS
// ============================================================================

export interface RecurringMilestoneConfig {
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  timeAllocation: number;
  weeklyDayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly recurrence
  monthlyPattern?: 'date' | 'dayOfWeek'; // Pattern type for monthly recurrence
  monthlyDate?: number; // 1-31 for specific date of month
  monthlyWeekOfMonth?: number; // 1-4 for which week of the month
  monthlyDayOfWeek?: number; // 0-6 for day of week in monthly pattern
}

export interface RecurringMilestoneCalculationParams {
  config: RecurringMilestoneConfig;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous?: boolean;
}

/**
 * Calculate how many milestones a recurring configuration would generate
 */
export function calculateRecurringMilestoneCount(params: RecurringMilestoneCalculationParams): number {
  const { config, projectStartDate, projectEndDate, projectContinuous = false } = params;
  
  let count = 0;
  const currentDate = new Date(projectStartDate);
  currentDate.setDate(currentDate.getDate() + 1); // Start day after project start
  
  const endDate = projectContinuous ? 
    new Date(currentDate.getTime() + 365 * 24 * 60 * 60 * 1000) : // 1 year for continuous
    new Date(projectEndDate);
  endDate.setDate(endDate.getDate() - 1); // End day before project end

  while (currentDate <= endDate && count < 100) { // Safety limit of 100
    count++;
    
    switch (config.recurringType) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + config.recurringInterval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * config.recurringInterval));
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + config.recurringInterval);
        break;
    }
  }
  
  return count;
}

/**
 * Calculate total time allocation for recurring milestones
 */
export function calculateRecurringTotalAllocation(params: RecurringMilestoneCalculationParams): number {
  const count = calculateRecurringMilestoneCount(params);
  return count * params.config.timeAllocation;
}

/**
 * Generate milestone dates for a recurring configuration
 */
export function generateRecurringMilestoneDates(params: RecurringMilestoneCalculationParams): Date[] {
  const { config, projectStartDate, projectEndDate, projectContinuous = false } = params;
  
  const dates: Date[] = [];
  const currentDate = new Date(projectStartDate);
  currentDate.setDate(currentDate.getDate() + 1);
  
  const endDate = projectContinuous ? 
    new Date(currentDate.getTime() + 365 * 24 * 60 * 60 * 1000) :
    new Date(projectEndDate);
  endDate.setDate(endDate.getDate() - 1);

  let count = 0;
  while (currentDate <= endDate && count < 100) {
    dates.push(new Date(currentDate));
    count++;
    
    switch (config.recurringType) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + config.recurringInterval);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + (7 * config.recurringInterval));
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + config.recurringInterval);
        break;
    }
  }
  
  return dates;
}

/**
 * Detect recurring pattern from existing milestone names and dates
 */
export function detectRecurringPattern(milestones: Array<{ name: string; endDate: Date }>): {
  baseName: string;
  recurringType: 'daily' | 'weekly' | 'monthly';
  interval: number;
} | null {
  const recurringPattern = milestones.filter(m => 
    m.name && /\s\d+$/.test(m.name) // Ends with space and number
  );
  
  if (recurringPattern.length < 2) return null;
  
  const sortedMilestones = recurringPattern.sort((a, b) => 
    new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
  );
  
  // Calculate interval between first two milestones
  const firstDate = new Date(sortedMilestones[0].endDate);
  const secondDate = new Date(sortedMilestones[1].endDate);
  const daysDifference = Math.round(DateCalculations.calculateDurationDays(firstDate, secondDate));
  
  let recurringType: 'daily' | 'weekly' | 'monthly' = 'weekly';
  let interval = 1;
  
  if (daysDifference === 1) {
    recurringType = 'daily';
    interval = 1;
  } else if (daysDifference === 7) {
    recurringType = 'weekly';
    interval = 1;
  } else if (daysDifference >= 28 && daysDifference <= 31) {
    recurringType = 'monthly';
    interval = 1;
  } else if (daysDifference % 7 === 0) {
    recurringType = 'weekly';
    interval = daysDifference / 7;
  }
  
  // Extract base name (remove the number at the end)
  const baseName = sortedMilestones[0].name.replace(/\s\d+$/, '') || 'Recurring Milestone';
  
  return { baseName, recurringType, interval };
}

// ===== MILESTONE UTILITIES FUNCTIONS =====
// Migrated from milestoneUtilitiesService.ts

export interface MilestoneSegment {
  startDate: Date;
  endDate: Date;
  milestone: Milestone;
  estimatedHours: number;
  dailyHours: number;
  workingDays: number;
  position: 'before' | 'during' | 'after';
}

export interface MilestoneDistributionEntry {
  date: Date;
  estimatedHours: number;
  milestone?: Milestone;
  dayIndex: number;
  isDeadlineDay: boolean;
}

/**
 * Calculate milestone segments for timeline visualization
 */
export function calculateMilestoneSegments(
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): MilestoneSegment[] {
  if (!milestones || milestones.length === 0) {
    return [];
  }

  const segments: MilestoneSegment[] = [];
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
  );

  // Create segments between milestones
  for (let i = 0; i < sortedMilestones.length; i++) {
    const milestone = sortedMilestones[i];
    const milestoneDate = new Date(milestone.endDate);
    
    let segmentStart: Date;
    let segmentEnd: Date;
    let position: 'before' | 'during' | 'after';
    
    if (i === 0) {
      // First milestone segment starts from project start
      segmentStart = new Date(projectStartDate);
      segmentEnd = new Date(milestoneDate);
      position = 'before';
    } else {
      // Subsequent segments start from previous milestone
      const prevMilestoneDate = new Date(sortedMilestones[i - 1].endDate);
      const dayAfterPrev = new Date(prevMilestoneDate);
      dayAfterPrev.setDate(dayAfterPrev.getDate() + 1);
      
      segmentStart = dayAfterPrev;
      segmentEnd = new Date(milestoneDate);
      position = 'during';
    }
    
    // Calculate hours per day for this segment
    const estimatedHours = milestone.timeAllocationHours || 0;
    const segmentDays = Math.max(1, Math.ceil((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60 * 60 * 24)));
    
    segments.push({
      startDate: segmentStart,
      endDate: segmentEnd,
      milestone,
      estimatedHours,
      dailyHours: estimatedHours / segmentDays,
      workingDays: segmentDays,
      position
    });
  }

  // Handle period after last milestone if exists
  const lastMilestoneDate = new Date(sortedMilestones[sortedMilestones.length - 1].endDate);
  const dayAfterLast = new Date(lastMilestoneDate);
  dayAfterLast.setDate(dayAfterLast.getDate() + 1);
  
  if (dayAfterLast < projectEndDate) {
    const segmentDays = Math.max(1, Math.ceil((projectEndDate.getTime() - dayAfterLast.getTime()) / (1000 * 60 * 60 * 24)));
    
    segments.push({
      startDate: dayAfterLast,
      endDate: projectEndDate,
      milestone: sortedMilestones[sortedMilestones.length - 1],
      estimatedHours: 0,
      dailyHours: 0,
      workingDays: segmentDays,
      position: 'after'
    });
  }

  return segments;
}

/**
 * Calculate project working days (considering autoEstimateDays)
 */
export function calculateProjectWorkingDays(
  startDate: Date,
  endDate: Date,
  settings: any,
  holidays: any[]
): Date[] {
  const workingDays: Date[] = [];
  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    
    // Check if it's a working day in settings
    const isWorkDay = settings?.weeklyWorkHours?.[dayName]?.length > 0;
    
    // Check if it's a holiday
    const isHoliday = holidays.some(h => {
      const holidayStart = new Date(h.startDate);
      const holidayEnd = new Date(h.endDate);
      return currentDate >= holidayStart && currentDate <= holidayEnd;
    });
    
    if (isWorkDay && !isHoliday) {
      workingDays.push(new Date(currentDate));
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workingDays;
}

/**
 * Calculate milestone distribution over timeline (for visualization)
 */
export function calculateMilestoneDistribution(
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): MilestoneDistributionEntry[] {
  const distribution: MilestoneDistributionEntry[] = [];
  const segments = calculateMilestoneSegments(milestones, projectStartDate, projectEndDate);
  
  let currentDate = new Date(projectStartDate);
  let dayIndex = 0;
  
  while (currentDate <= projectEndDate) {
    const segment = segments.find(s => 
      currentDate >= s.startDate && currentDate <= s.endDate
    );
    
    const isDeadlineDay = milestones.some(m => 
      new Date(m.endDate).toDateString() === currentDate.toDateString()
    );
    
    distribution.push({
      date: new Date(currentDate),
      estimatedHours: segment?.dailyHours || 0,
      milestone: segment?.milestone,
      dayIndex,
      isDeadlineDay
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
    dayIndex++;
  }
  
  return distribution;
}

/**
 * Calculate total allocated hours from milestones
 */
export function calculateTotalAllocatedHours(milestones: Milestone[]): number {
  return milestones.reduce((total, milestone) => total + milestone.timeAllocationHours, 0);
}

/**
 * Validate milestone doesn't exceed project budget
 */
export function validateMilestoneBudget(
  currentAllocated: number,
  newMilestoneHours: number,
  projectBudget: number
): {
  isValid: boolean;
  totalAfterAddition: number;
  remaining: number;
  overage: number;
} {
  const totalAfterAddition = currentAllocated + newMilestoneHours;
  const remaining = Math.max(0, projectBudget - totalAfterAddition);
  const overage = Math.max(0, totalAfterAddition - projectBudget);
  
  return {
    isValid: totalAfterAddition <= projectBudget,
    totalAfterAddition,
    remaining,
    overage
  };
}

/**
 * Calculate hours remaining for project
 */
export function calculateRemainingProjectHours(
  projectEstimatedHours: number,
  existingMilestones: Milestone[]
): number {
  const currentTotal = existingMilestones.reduce((total, milestone) => total + milestone.timeAllocationHours, 0);
  return Math.max(0, projectEstimatedHours - currentTotal);
}

/**
 * Validate milestone order (endDate must be after previous milestone)
 */
export function validateMilestoneOrder(
  newMilestoneDate: Date,
  existingMilestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): {
  isValid: boolean;
  conflictingMilestone?: Milestone;
  suggestedDate?: Date;
} {
  // Check if within project bounds
  if (newMilestoneDate < projectStartDate || newMilestoneDate > projectEndDate) {
    return {
      isValid: false,
      suggestedDate: new Date(projectStartDate)
    };
  }
  
  // Check for date conflicts (same date as another milestone)
  const conflictingMilestone = existingMilestones.find(m => 
    new Date(m.endDate).toDateString() === newMilestoneDate.toDateString()
  );
  
  if (conflictingMilestone) {
    return {
      isValid: false,
      conflictingMilestone
    };
  }
  
  return { isValid: true };
}

/**
 * Find next available milestone date
 */
export function findNextAvailableMilestoneDate(
  startSearchDate: Date,
  existingMilestones: Milestone[],
  projectEndDate: Date
): Date {
  let currentDate = new Date(startSearchDate);
  
  while (currentDate <= projectEndDate) {
    const hasConflict = existingMilestones.some(m => 
      new Date(m.endDate).toDateString() === currentDate.toDateString()
    );
    
    if (!hasConflict) {
      return currentDate;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return projectEndDate;
}

/**
 * Calculate milestone statistics for a project
 */
export function calculateMilestoneStatistics(milestones: Milestone[]): {
  count: number;
  totalHours: number;
  averageHours: number;
  minHours: number;
  maxHours: number;
} {
  if (milestones.length === 0) {
    return {
      count: 0,
      totalHours: 0,
      averageHours: 0,
      minHours: 0,
      maxHours: 0
    };
  }
  
  const hours = milestones.map(m => m.timeAllocationHours);
  
  return {
    count: milestones.length,
    totalHours: hours.reduce((sum, h) => sum + h, 0),
    averageHours: hours.reduce((sum, h) => sum + h, 0) / hours.length,
    minHours: Math.min(...hours),
    maxHours: Math.max(...hours)
  };
}
