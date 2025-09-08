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
