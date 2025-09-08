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
  return milestones.reduce((sum, milestone) => sum + (milestone.timeAllocation || 0), 0);
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
    DateCalculations.isDateInRange(m.dueDate, startDate, endDate)
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

  const allocations = milestones.map(m => m.timeAllocation || 0).sort((a, b) => a - b);
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
  const sortedMilestones = [...milestones].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  
  // Calculate gaps between consecutive milestones
  const gaps: number[] = [];
  
  // Gap from project start to first milestone
  gaps.push(DateCalculations.calculateDayDifference(projectStartDate, sortedMilestones[0].dueDate));
  
  // Gaps between consecutive milestones
  for (let i = 1; i < sortedMilestones.length; i++) {
    gaps.push(DateCalculations.calculateDayDifference(
      sortedMilestones[i - 1].dueDate,
      sortedMilestones[i].dueDate
    ));
  }
  
  // Gap from last milestone to project end
  gaps.push(DateCalculations.calculateDayDifference(
    sortedMilestones[sortedMilestones.length - 1].dueDate,
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
  const expectedCompletedByNow = totalMilestones.filter(m => m.dueDate <= currentDate).length;
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
 * Sort milestones by due date
 */
export function sortMilestonesByDate(milestones: Milestone[]): Milestone[] {
  return [...milestones].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
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
    
    if (targetDate > current.dueDate && targetDate < next.dueDate) {
      const startDate = new Date(current.dueDate);
      startDate.setDate(startDate.getDate() + 1);
      
      const endDate = new Date(next.dueDate);
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
export function detectRecurringPattern(milestones: Array<{ name: string; dueDate: Date }>): {
  baseName: string;
  recurringType: 'daily' | 'weekly' | 'monthly';
  interval: number;
} | null {
  const recurringPattern = milestones.filter(m => 
    m.name && /\s\d+$/.test(m.name) // Ends with space and number
  );
  
  if (recurringPattern.length < 2) return null;
  
  const sortedMilestones = recurringPattern.sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  // Calculate interval between first two milestones
  const firstDate = new Date(sortedMilestones[0].dueDate);
  const secondDate = new Date(sortedMilestones[1].dueDate);
  const daysDifference = Math.round((secondDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  
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
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  // Create segments between milestones
  for (let i = 0; i < sortedMilestones.length; i++) {
    const milestone = sortedMilestones[i];
    const milestoneDate = new Date(milestone.dueDate);
    
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
      const prevMilestoneDate = new Date(sortedMilestones[i - 1].dueDate);
      segmentStart = new Date(prevMilestoneDate);
      segmentStart.setDate(segmentStart.getDate() + 1);
      segmentEnd = new Date(milestoneDate);
      position = 'during';
    }
    
    // Calculate working days (simplified - excludes weekends)
    const timeDiff = segmentEnd.getTime() - segmentStart.getTime();
    const totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    const workingDays = Math.max(1, Math.floor(totalDays * 5/7)); // Approximate working days
    
    const estimatedHours = milestone.timeAllocation || 0;
    const dailyHours = workingDays > 0 ? estimatedHours / workingDays : 0;
    
    segments.push({
      startDate: segmentStart,
      endDate: segmentEnd,
      milestone,
      estimatedHours,
      dailyHours,
      workingDays,
      position
    });
  }
  
  // Add final segment after last milestone if needed
  const lastMilestone = sortedMilestones[sortedMilestones.length - 1];
  const lastMilestoneDate = new Date(lastMilestone.dueDate);
  if (lastMilestoneDate < projectEndDate) {
    const finalStart = new Date(lastMilestoneDate);
    finalStart.setDate(finalStart.getDate() + 1);
    
    const timeDiff = projectEndDate.getTime() - finalStart.getTime();
    const totalDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    const workingDays = Math.max(1, Math.floor(totalDays * 5/7));
    
    segments.push({
      startDate: finalStart,
      endDate: new Date(projectEndDate),
      milestone: lastMilestone, // Reference last milestone
      estimatedHours: 0, // No specific allocation for post-milestone work
      dailyHours: 0,
      workingDays,
      position: 'after'
    });
  }
  
  return segments;
}

/**
 * Get milestone segment for a specific date
 */
export function getMilestoneSegmentForDate(
  date: Date,
  segments: MilestoneSegment[]
): MilestoneSegment | null {
  return segments.find(segment => 
    date >= segment.startDate && date <= segment.endDate
  ) || null;
}

/**
 * Calculate milestone interval for scheduling
 */
export function calculateMilestoneInterval(
  milestones: Milestone[],
  projectDurationDays: number
): number {
  if (!milestones || milestones.length <= 1) {
    return projectDurationDays;
  }
  
  const sortedMilestones = [...milestones].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  let totalInterval = 0;
  for (let i = 1; i < sortedMilestones.length; i++) {
    const prevDate = new Date(sortedMilestones[i - 1].dueDate);
    const currentDate = new Date(sortedMilestones[i].dueDate);
    const interval = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    totalInterval += interval;
  }
  
  return totalInterval / (sortedMilestones.length - 1);
}

/**
 * Get estimated hours for a specific date based on milestone distribution
 */
export function getEstimatedHoursForDate(
  date: Date,
  milestones: Milestone[],
  projectStartDate: Date,
  projectEndDate: Date
): number {
  const segments = calculateMilestoneSegments(milestones, projectStartDate, projectEndDate);
  const segment = getMilestoneSegmentForDate(date, segments);
  return segment ? segment.dailyHours : 0;
}

/**
 * Get milestone for a specific date
 */
export function getMilestoneForDate(
  date: Date,
  milestones: Milestone[]
): Milestone | null {
  return milestones.find(milestone => {
    const milestoneDate = new Date(milestone.dueDate);
    // Check if it's the same date (ignoring time)
    return milestoneDate.toDateString() === date.toDateString();
  }) || null;
}

/**
 * Get milestones in a date range
 */
export function getMilestonesInDateRange(
  startDate: Date,
  endDate: Date,
  milestones: Milestone[]
): Milestone[] {
  return milestones.filter(milestone => {
    const milestoneDate = new Date(milestone.dueDate);
    return milestoneDate >= startDate && milestoneDate <= endDate;
  });
}

// =============================================================================
// LEGACY MILESTONE CALCULATION SERVICE FUNCTIONS
// Migrated from: services/legacy/milestones/milestoneCalculationService.ts
// =============================================================================

/**
 * Milestone interface for validation functions
 */
export interface LegacyMilestone {
  id: string;
  name: string;
  dueDate: string | Date;
  timeAllocation: number;
}

/**
 * Recurring pattern interface
 */
export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  baseName: string;
}

/**
 * Milestone validation result interface
 */
export interface MilestoneValidationResult {
  isValid: boolean;
  totalAllocation: number;
  exceedsBy?: number;
  message?: string;
}

/**
 * Validate milestone allocation against project budget
 */
export function validateMilestoneAllocation(
  milestones: LegacyMilestone[],
  projectEstimatedHours: number,
  excludeMilestoneId?: string
): MilestoneValidationResult {
  const relevantMilestones = excludeMilestoneId 
    ? milestones.filter(m => m.id !== excludeMilestoneId)
    : milestones;
  
  const totalAllocation = Math.ceil(relevantMilestones.reduce((total, milestone) => total + milestone.timeAllocation, 0));
  const isValid = totalAllocation <= projectEstimatedHours;
  
  if (!isValid) {
    const exceedsBy = totalAllocation - projectEstimatedHours;
    return {
      isValid: false,
      totalAllocation,
      exceedsBy,
      message: `Total milestone allocation (${totalAllocation}h) exceeds project budget (${projectEstimatedHours}h) by ${exceedsBy}h.`
    };
  }
  
  return {
    isValid: true,
    totalAllocation
  };
}

/**
 * Validate adding a new milestone to existing allocation
 */
export function validateNewMilestoneAllocation(
  existingMilestones: LegacyMilestone[],
  newMilestoneAllocation: number,
  projectEstimatedHours: number
): MilestoneValidationResult {
  const currentTotal = existingMilestones.reduce((total, milestone) => total + milestone.timeAllocation, 0);
  const newTotal = Math.ceil(currentTotal + newMilestoneAllocation);
  const isValid = newTotal <= projectEstimatedHours;
  
  if (!isValid) {
    const exceedsBy = newTotal - projectEstimatedHours;
    return {
      isValid: false,
      totalAllocation: newTotal,
      exceedsBy,
      message: `Total milestone allocation (${newTotal}h) would exceed project budget (${projectEstimatedHours}h) by ${exceedsBy}h.`
    };
  }
  
  return {
    isValid: true,
    totalAllocation: newTotal
  };
}

/**
 * Validate updating an existing milestone allocation
 */
export function validateMilestoneUpdate(
  milestones: LegacyMilestone[],
  milestoneId: string,
  newAllocation: number,
  projectEstimatedHours: number
): MilestoneValidationResult {
  const updatedMilestones = milestones.map(m => 
    m.id === milestoneId ? { ...m, timeAllocation: newAllocation } : m
  );
  
  return validateMilestoneAllocation(updatedMilestones, projectEstimatedHours);
}

/**
 * Calculate days difference between two dates
 */
export function calculateDaysDifference(firstDate: Date | string, secondDate: Date | string): number {
  const first = new Date(firstDate);
  const second = new Date(secondDate);
  return Math.round((second.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Detect recurring pattern from legacy milestones
 */
export function detectLegacyRecurringPattern(milestones: LegacyMilestone[]): RecurringPattern | null {
  // Filter milestones that match recurring pattern (ends with space and number)
  const recurringPattern = milestones.filter(m => 
    m.name && /\s\d+$/.test(m.name)
  );
  
  if (recurringPattern.length < 1) {
    return null;
  }
  
  // Sort by due date
  const sortedMilestones = recurringPattern.sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
  
  let type: 'daily' | 'weekly' | 'monthly' = 'weekly';
  let interval = 1;
  
  if (sortedMilestones.length > 1) {
    // Calculate interval between milestones
    const daysDifference = calculateDaysDifference(
      sortedMilestones[0].dueDate,
      sortedMilestones[1].dueDate
    );
    
    if (daysDifference === 1) {
      type = 'daily';
      interval = 1;
    } else if (daysDifference === 7) {
      type = 'weekly';
      interval = 1;
    } else if (daysDifference >= 28 && daysDifference <= 31) {
      type = 'monthly';
      interval = 1;
    } else if (daysDifference % 7 === 0) {
      type = 'weekly';
      interval = daysDifference / 7;
    }
  }
  
  // Extract base name (remove the number at the end)
  const baseName = sortedMilestones[0].name.replace(/\s\d+$/, '') || 'Recurring Milestone';
  
  return {
    type,
    interval,
    baseName
  };
}

/**
 * Calculate dynamic input width based on content length
 */
export function calculateInputWidth(content: string, baseWidth: number = 80, charWidth: number = 8): number {
  return Math.max(content.length * charWidth + 40, baseWidth);
}

/**
 * Sort legacy milestones by due date
 */
export function sortLegacyMilestonesByDate(milestones: LegacyMilestone[]): LegacyMilestone[] {
  return [...milestones].sort((a, b) => 
    new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );
}

/**
 * Format milestone date for display
 */
export function formatMilestoneDate(date: Date | string): string {
  const milestoneDate = new Date(date);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${months[milestoneDate.getMonth()]} ${milestoneDate.getDate()}`;
}

/**
 * Check if milestone date matches a specific date
 */
export function isMilestoneDueOnDate(milestone: LegacyMilestone, targetDate: Date): boolean {
  const milestoneDate = new Date(milestone.dueDate);
  return milestoneDate.toDateString() === targetDate.toDateString();
}

/**
 * Generate temporary milestone ID
 */
export function generateTempId(): string {
  return `temp-${Date.now()}`;
}

/**
 * Calculate ordinal number suffix (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalNumber(num: number): string {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const value = num % 100;
  return num + (suffix[(value - 20) % 10] || suffix[value] || suffix[0]);
}

// =============================================================================
// LEGACY COMPATIBILITY CLASS
// This class provides static method access for backward compatibility
// =============================================================================

/**
 * MilestoneCalculationService - Legacy compatibility class
 * 
 * @deprecated Use individual functions instead of static class methods
 * This class will be removed in a future version.
 */
export class MilestoneCalculationService {
  static calculateTotalAllocation(milestones: LegacyMilestone[]): number {
    return milestones.reduce((total, milestone) => total + milestone.timeAllocation, 0);
  }

  static validateMilestoneAllocation(
    milestones: LegacyMilestone[],
    projectEstimatedHours: number,
    excludeMilestoneId?: string
  ): MilestoneValidationResult {
    return validateMilestoneAllocation(milestones, projectEstimatedHours, excludeMilestoneId);
  }

  static validateNewMilestoneAllocation(
    existingMilestones: LegacyMilestone[],
    newMilestoneAllocation: number,
    projectEstimatedHours: number
  ): MilestoneValidationResult {
    return validateNewMilestoneAllocation(existingMilestones, newMilestoneAllocation, projectEstimatedHours);
  }

  static validateMilestoneUpdate(
    milestones: LegacyMilestone[],
    milestoneId: string,
    newAllocation: number,
    projectEstimatedHours: number
  ): MilestoneValidationResult {
    return validateMilestoneUpdate(milestones, milestoneId, newAllocation, projectEstimatedHours);
  }

  static calculateDaysDifference(firstDate: Date | string, secondDate: Date | string): number {
    return calculateDaysDifference(firstDate, secondDate);
  }

  static detectRecurringPattern(milestones: LegacyMilestone[]): RecurringPattern | null {
    return detectLegacyRecurringPattern(milestones);
  }

  static calculateInputWidth(content: string, baseWidth?: number, charWidth?: number): number {
    return calculateInputWidth(content, baseWidth, charWidth);
  }

  static sortMilestonesByDate(milestones: LegacyMilestone[]): LegacyMilestone[] {
    return sortLegacyMilestonesByDate(milestones);
  }

  static formatMilestoneDate(date: Date | string): string {
    return formatMilestoneDate(date);
  }

  static isMilestoneDueOnDate(milestone: LegacyMilestone, targetDate: Date): boolean {
    return isMilestoneDueOnDate(milestone, targetDate);
  }

  static generateTempId(): string {
    return generateTempId();
  }

  static getOrdinalNumber(num: number): string {
    return getOrdinalNumber(num);
  }
}
