/**
 * Phase Calculations (formerly Milestone Calculations / PhaseBudget)
 * 
 * KEYWORDS: phase budget, milestone allocation, budget utilization, phase hours,
 *           milestone scheduling, budget validation, overage calculation,
 *           milestone density, allocation distribution, optimal spacing,
 *           budget constraints, phase time allocation
 * 
 * Pure mathematical functions for phase/milestone-related calculations.
 * No side effects, no external dependencies, fully testable.
 * 
 * USE WHEN:
 * - Calculating total phase time allocation
 * - Validating phase budget against project budget
 * - Analyzing budget utilization and overage
 * - Calculating optimal phase spacing
 * - Scheduling milestone occurrences
 * 
 * RELATED FILES:
 * - PhaseValidation.ts - Phase date and constraint validation
 * - PhaseRecurrence.ts - Recurring phase generation
 * - ProjectPhaseSync.ts - Cross-entity budget synchronization (BudgetSync class)
 * 
 * ✅ Pure functions only
 * ✅ Deterministic outputs
 * ✅ Mathematical operations only
 */

import { Holiday, PhaseDTO, Settings } from '@/shared/types/core';
import * as DateCalculations from '@/presentation/utils/dateCalculations';
import { PhaseRecurrenceService, RecurringPhaseConfig as DomainRecurringConfig, RecurringOccurrenceParams } from '@/domain/rules/phases/PhaseRecurrence';

/**
 * Calculate total time allocation across milestones
 */
export function calculateTotalAllocation(phases: PhaseDTO[]): number {
  return phases.reduce((sum, phase) => {
    const hours = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
    return sum + hours;
  }, 0);
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
 * Validate milestone scheduling against budget constraints
 * 
 * Checks if adding a new milestone would exceed the project budget.
 * This is the SINGLE SOURCE OF TRUTH for budget validation.
 * 
 * @param existingPhases - Current phases in project
 * @param newMilestone - Milestone being scheduled
 * @param projectBudget - Total project budget in hours
 * @returns Validation result with specific budget conflicts
 */
export function validateMilestoneScheduling(
  existingPhases: PhaseDTO[],
  newMilestone: Partial<PhaseDTO>,
  projectBudget: number
): {
  canSchedule: boolean;
  budgetConflicts: string[];
  currentAllocation: number;
  newAllocation: number;
} {
  const currentAllocation = existingPhases.reduce(
    (sum, phase) => sum + (phase.timeAllocationHours || phase.timeAllocation || 0), 
    0
  );
  
  const newAllocation = currentAllocation + (
    newMilestone.timeAllocationHours || 
    newMilestone.timeAllocation || 
    0
  );
  
  const budgetConflicts: string[] = [];
  
  if (newAllocation > projectBudget) {
    budgetConflicts.push(
      `Would exceed project budget by ${newAllocation - projectBudget} hours`
    );
  }
  
  return {
    canSchedule: budgetConflicts.length === 0,
    budgetConflicts,
    currentAllocation,
    newAllocation
  };
}

/**
 * Calculate milestone density (milestones per day) for a date range
 */
export function calculateMilestoneDensity(
  phases: PhaseDTO[],
  startDate: Date,
  endDate: Date
): number {
  const milestonesInRange = phases.filter(phase => {
    const phaseDate = phase.endDate || phase.dueDate;
    return DateCalculations.isDateInRange(phaseDate, startDate, endDate);
  });
  
  const totalDays = DateCalculations.calculateDayDifference(startDate, endDate);
  return totalDays > 0 ? milestonesInRange.length / totalDays : 0;
}

/**
 * Calculate average milestone allocation
 */
export function calculateAverageMilestoneAllocation(phases: PhaseDTO[]): number {
  if (phases.length === 0) return 0;
  return calculateTotalAllocation(phases) / phases.length;
}

/**
 * Calculate milestone allocation distribution (min, max, avg)
 */
export function calculateAllocationDistribution(phases: PhaseDTO[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
} {
  if (phases.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0 };
  }

  const allocations = phases.map(phase => phase.timeAllocation || 0).sort((a, b) => a - b);
  const min = allocations[0];
  const max = allocations[allocations.length - 1];
  const avg = calculateAverageMilestoneAllocation(phases);
  
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
    const phaseDate = new Date(projectStartDate);
    phaseDate.setDate(phaseDate.getDate() + (interval * i));
    milestones.push(phaseDate);
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
  phases: PhaseDTO[],
  projectStartDate: Date,
  projectEndDate: Date
): {
  pressure: number; // 0-1 scale, 1 = very tight
  averageDaysBetween: number;
  minDaysBetween: number;
  maxDaysBetween: number;
} {
  if (phases.length <= 1) {
    return { pressure: 0, averageDaysBetween: 0, minDaysBetween: 0, maxDaysBetween: 0 };
  }

  // Sort milestones by date
  const sortedPhases = [...phases].sort((a, b) => {
    const dateA = a.endDate || a.dueDate;
    const dateB = b.endDate || b.dueDate;
    return dateA.getTime() - dateB.getTime();
  });
  
  // Calculate gaps between consecutive milestones
  const gaps: number[] = [];
  
  // Gap from project start to first milestone
  const firstDate = sortedPhases[0].endDate || sortedPhases[0].dueDate;
  gaps.push(DateCalculations.calculateDayDifference(projectStartDate, firstDate));
  
  // Gaps between consecutive milestones
  for (let i = 1; i < sortedPhases.length; i++) {
    const prevDate = sortedPhases[i - 1].endDate || sortedPhases[i - 1].dueDate;
    const currDate = sortedPhases[i].endDate || sortedPhases[i].dueDate;
    gaps.push(DateCalculations.calculateDayDifference(prevDate, currDate));
  }
  
  // Gap from last milestone to project end
  const lastDate = sortedPhases[sortedPhases.length - 1].endDate || sortedPhases[sortedPhases.length - 1].dueDate;
  gaps.push(DateCalculations.calculateDayDifference(lastDate, projectEndDate));

  const averageDaysBetween = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const minDaysBetween = Math.min(...gaps);
  const maxDaysBetween = Math.max(...gaps);
  
  // Calculate pressure (inverse of average gap, normalized)
  const totalProjectDays = DateCalculations.calculateDayDifference(projectStartDate, projectEndDate);
  const idealGap = totalProjectDays / (phases.length + 1);
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
  completedMilestones: PhaseDTO[],
  totalMilestones: PhaseDTO[],
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
  const expectedCompletedByNow = totalMilestones.filter(phase => {
    const phaseDate = phase.endDate || phase.dueDate;
    return phaseDate <= currentDate;
  }).length;
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
export function sortMilestonesByDate(phases: PhaseDTO[]): PhaseDTO[] {
  return [...phases].sort((a, b) => {
    const dateA = a.endDate || a.dueDate;
    const dateB = b.endDate || b.dueDate;
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Find appropriate gap between milestones for positioning
 */
export function findMilestoneGap(
  sortedPhases: PhaseDTO[], 
  targetDate: Date
): { startDate: Date; endDate: Date } | null {
  if (sortedPhases.length === 0) {
    return null;
  }

  // Find the gap where the target date should be placed
  for (let i = 0; i < sortedPhases.length - 1; i++) {
    const current = sortedPhases[i];
    const next = sortedPhases[i + 1];
    
    const currentDate = current.endDate || current.dueDate;
    const nextDate = next.endDate || next.dueDate;
    
    if (targetDate > currentDate && targetDate < nextDate) {
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() + 1);
      
      const endDate = new Date(nextDate);
      endDate.setDate(endDate.getDate() - 1);
      
      return { startDate, endDate };
    }
  }
  
  return null;
}

// ============================================================================
// RECURRING MILESTONE CALCULATIONS
// ============================================================================

/**
 * @deprecated Use PhaseRecurrenceService types directly
 * Kept for backward compatibility during migration
 */
export interface RecurringPhaseConfig {
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
  timeAllocation: number;
  weeklyDayOfWeek?: number; // 0-6 (Sunday-Saturday) for weekly recurrence
  monthlyPattern?: 'date' | 'dayOfWeek'; // Pattern type for monthly recurrence
  monthlyDate?: number; // 1-31 for specific date of month
  monthlyWeekOfMonth?: number; // 1-4 for which week of the month
  monthlyDayOfWeek?: number; // 0-6 for day of week in monthly pattern
}

export interface RecurringPhaseCalculationParams {
  config: RecurringPhaseConfig;
  projectStartDate: Date;
  projectEndDate: Date;
  projectContinuous?: boolean;
}

/**
 * Convert legacy config to domain service config
 */
function toDomainConfig(config: RecurringPhaseConfig): DomainRecurringConfig {
  return {
    type: config.recurringType,
    interval: config.recurringInterval,
    weeklyDayOfWeek: config.weeklyDayOfWeek,
    monthlyPattern: config.monthlyPattern,
    monthlyDate: config.monthlyDate,
    monthlyWeekOfMonth: config.monthlyWeekOfMonth,
    monthlyDayOfWeek: config.monthlyDayOfWeek,
  };
}

/**
 * Calculate how many milestones a recurring configuration would generate
 * 
 * @deprecated Use PhaseRecurrenceService.calculateOccurrenceCount instead
 * Kept for backward compatibility during migration
 */
export function calculateRecurringPhaseCount(params: RecurringPhaseCalculationParams): number {
  const domainParams: RecurringOccurrenceParams = {
    config: toDomainConfig(params.config),
    projectStartDate: params.projectStartDate,
    projectEndDate: params.projectEndDate,
    projectContinuous: params.projectContinuous,
  };
  
  return PhaseRecurrenceService.calculateOccurrenceCount(domainParams);
}

/**
 * Calculate total time allocation for recurring phases
 * 
 * @deprecated Use PhaseRecurrenceService.calculateTotalAllocation instead
 * Kept for backward compatibility during migration
 */
export function calculateRecurringTotalAllocation(params: RecurringPhaseCalculationParams): number {
  const domainParams: RecurringOccurrenceParams = {
    config: toDomainConfig(params.config),
    projectStartDate: params.projectStartDate,
    projectEndDate: params.projectEndDate,
    projectContinuous: params.projectContinuous,
  };
  
  return PhaseRecurrenceService.calculateTotalAllocation(domainParams, params.config.timeAllocation);
}

/**
 * Generate milestone dates for a recurring configuration
 * 
 * @deprecated Use PhaseRecurrenceService.generateOccurrences instead
 * Kept for backward compatibility during migration
 */
export function generateRecurringPhaseDates(params: RecurringPhaseCalculationParams): Date[] {
  const domainParams: RecurringOccurrenceParams = {
    config: toDomainConfig(params.config),
    projectStartDate: params.projectStartDate,
    projectEndDate: params.projectEndDate,
    projectContinuous: params.projectContinuous,
  };
  
  const occurrences = PhaseRecurrenceService.generateOccurrences(domainParams);
  return occurrences.map(occ => occ.date);
}

/**
 * Detect recurring pattern from existing milestone names and dates
 */
export function detectRecurringPattern(milestones: Array<{ name: string; dueDate: Date }>): {
  baseName: string;
  recurringType: 'daily' | 'weekly' | 'monthly';
  interval: number;
} | null {
  const recurringPattern = milestones.filter(p => 
    p.name && /\s\d+$/.test(p.name) // Ends with space and number
  );
  
  if (recurringPattern.length < 2) return null;
  
  const sortedPhases = recurringPattern.sort((a, b) => 
    a.dueDate.getTime() - b.dueDate.getTime()
  );
  
  // Calculate interval between first two milestones
  const firstDate = sortedPhases[0].dueDate;
  const secondDate = sortedPhases[1].dueDate;
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
  const baseName = sortedPhases[0].name.replace(/\s\d+$/, '') || 'Recurring Milestone';
  
  return { baseName, recurringType, interval };
}

// ===== MILESTONE UTILITIES FUNCTIONS =====
// Migrated from milestoneUtilitiesService.ts

export interface MilestoneSegment {
  startDate: Date;
  endDate: Date;
  milestone: PhaseDTO;
  estimatedHours: number;
  dailyHours: number;
  workingDays: number;
  position: 'before' | 'during' | 'after';
}

export interface MilestoneDistributionEntry {
  date: Date;
  estimatedHours: number;
  milestone?: PhaseDTO;
  dayIndex: number;
  isDeadlineDay: boolean;
}

/**
 * Calculate milestone segments for timeline visualization
 */
export function calculateMilestoneSegments(
  phases: PhaseDTO[],
  projectStartDate: Date,
  projectEndDate: Date
): MilestoneSegment[] {
  if (!phases || phases.length === 0) {
    return [];
  }

  const segments: MilestoneSegment[] = [];
  const sortedPhases = [...phases].sort((a, b) => {
    const dateA = a.endDate || a.dueDate;
    const dateB = b.endDate || b.dueDate;
    return dateA.getTime() - dateB.getTime();
  });

  // Create segments between milestones
  for (let i = 0; i < sortedPhases.length; i++) {
    const phase = sortedPhases[i];
    const phaseDate = phase.endDate || phase.dueDate;
    
    let segmentStart: Date;
    let segmentEnd: Date;
    let position: 'before' | 'during' | 'after';
    
    if (i === 0) {
      // First milestone segment starts from project start
      segmentStart = new Date(projectStartDate);
      segmentEnd = new Date(phaseDate);
      position = 'before';
    } else {
      // Subsequent segments start from previous milestone
      const prevMilestoneDate = sortedPhases[i - 1].endDate || sortedPhases[i - 1].dueDate;
      const dayAfterPrev = new Date(prevMilestoneDate);
      dayAfterPrev.setDate(dayAfterPrev.getDate() + 1);
      
      segmentStart = dayAfterPrev;
      segmentEnd = new Date(phaseDate);
      position = 'during';
    }
    
    // Calculate hours per day for this segment
    const estimatedHours = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
    const segmentDays = Math.max(1, Math.ceil((segmentEnd.getTime() - segmentStart.getTime()) / (1000 * 60 * 60 * 24)));
    
    segments.push({
      startDate: segmentStart,
      endDate: segmentEnd,
      milestone: phase,
      estimatedHours,
      dailyHours: estimatedHours / segmentDays,
      workingDays: segmentDays,
      position
    });
  }

  // Handle period after last milestone if exists
  const lastMilestoneDate = sortedPhases[sortedPhases.length - 1].endDate || sortedPhases[sortedPhases.length - 1].dueDate;
  const dayAfterLast = new Date(lastMilestoneDate);
  dayAfterLast.setDate(dayAfterLast.getDate() + 1);
  
  if (dayAfterLast < projectEndDate) {
    const segmentDays = Math.max(1, Math.ceil((projectEndDate.getTime() - dayAfterLast.getTime()) / (1000 * 60 * 60 * 24)));
    
    segments.push({
      startDate: dayAfterLast,
      endDate: projectEndDate,
      milestone: sortedPhases[sortedPhases.length - 1],
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
  settings: Pick<Settings, 'weeklyWorkHours'> | null | undefined,
  holidays: Holiday[]
): Date[] {
  const workingDays: Date[] = [];
  const currentDate = new Date(startDate);
  
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
  phases: PhaseDTO[],
  projectStartDate: Date,
  projectEndDate: Date
): MilestoneDistributionEntry[] {
  const distribution: MilestoneDistributionEntry[] = [];
  const segments = calculateMilestoneSegments(phases, projectStartDate, projectEndDate);
  
  const currentDate = new Date(projectStartDate);
  let dayIndex = 0;
  
  while (currentDate <= projectEndDate) {
    const segment = segments.find(s => 
      currentDate >= s.startDate && currentDate <= s.endDate
    );
    
    const isDeadlineDay = phases.some(phase => {
      const phaseDate = phase.endDate || phase.dueDate;
      return phaseDate.toDateString() === currentDate.toDateString();
    });
    
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
export function calculateTotalAllocatedHours(phases: PhaseDTO[]): number {
  return phases.reduce((total, phase) => {
    const hours = phase.timeAllocationHours ?? phase.timeAllocation;
    return total + hours;
  }, 0);
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
  existingPhases: PhaseDTO[]
): number {
  const currentTotal = existingPhases.reduce((total, phase) => {
    const hours = phase.timeAllocationHours ?? phase.timeAllocation;
    return total + hours;
  }, 0);
  return Math.max(0, projectEstimatedHours - currentTotal);
}

/**
 * Validate milestone order (endDate must be after previous milestone)
 */
export function validateMilestoneOrder(
  newMilestoneDate: Date,
  existingPhases: PhaseDTO[],
  projectStartDate: Date,
  projectEndDate: Date
): {
  isValid: boolean;
  conflictingMilestone?: PhaseDTO;
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
  const conflictingMilestone = existingPhases.find(phase => {
    const phaseDate = phase.endDate || phase.dueDate;
    return phaseDate.toDateString() === newMilestoneDate.toDateString();
  });
  
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
  existingPhases: PhaseDTO[],
  projectEndDate: Date
): Date {
  const currentDate = new Date(startSearchDate);
  
  while (currentDate <= projectEndDate) {
    const hasConflict = existingPhases.some(phase => {
      const phaseDate = phase.endDate || phase.dueDate;
      return phaseDate.toDateString() === currentDate.toDateString();
    });
    
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
export function calculateMilestoneStatistics(phases: PhaseDTO[]): {
  count: number;
  totalHours: number;
  averageHours: number;
  minHours: number;
  maxHours: number;
} {
  if (phases.length === 0) {
    return {
      count: 0,
      totalHours: 0,
      averageHours: 0,
      minHours: 0,
      maxHours: 0
    };
  }
  
  const hours = phases.map(phase => phase.timeAllocation);
  
  return {
    count: phases.length,
    totalHours: hours.reduce((sum, h) => sum + h, 0),
    averageHours: hours.reduce((sum, h) => sum + h, 0) / hours.length,
    minHours: Math.min(...hours),
    maxHours: Math.max(...hours)
  };
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
 * Calculate budget adjustment recommendations for project-milestone compatibility
 */
export function calculateBudgetAdjustment(
  projectBudget: number,
  totalAllocated: number,
  targetUtilization: number = 0.9 // 90% utilization target
): {
  currentBudget: number;
  suggestedBudget: number;
  adjustmentNeeded: number;
  reason: string;
} {
  const currentBudget = projectBudget;

  let suggestedBudget = currentBudget;
  let reason = 'No adjustment needed';

  if (totalAllocated > currentBudget) {
    // Over-allocated: need to increase budget
    suggestedBudget = Math.ceil(totalAllocated / targetUtilization);
    reason = 'Increase needed to accommodate milestone allocations';
  } else if (totalAllocated < currentBudget * 0.5) {
    // Significantly under-allocated: could reduce budget
    suggestedBudget = Math.ceil(totalAllocated / targetUtilization);
    reason = 'Potential reduction due to low milestone utilization';
  }

  return {
    currentBudget,
    suggestedBudget,
    adjustmentNeeded: suggestedBudget - currentBudget,
    reason
  };
}

/**
 * Validate budget allocation for phases
 * Legacy compatibility function for orchestrators
 */
export function validateBudgetAllocation(
  phases: PhaseDTO[],
  projectBudget: number,
  excludePhaseId?: string
): { isValid: boolean; errors: string[]; warnings: string[]; totalAllocated: number } {
  const phasesToCheck = excludePhaseId 
    ? phases.filter(p => p.id !== excludePhaseId)
    : phases;
  
  const totalAllocated = calculateTotalAllocation(phasesToCheck);
  const utilization = calculateBudgetUtilization(totalAllocated, projectBudget);
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (totalAllocated > projectBudget) {
    errors.push(
      `Total phase allocation (${totalAllocated}h) exceeds project budget (${projectBudget}h)`
    );
  } else if (utilization > 90) {
    warnings.push(
      `Phase allocation is at ${utilization.toFixed(1)}% of project budget`
    );
  }
  
  return {
    isValid: errors.length === 0,
    totalAllocated,
    errors,
    warnings
  };
}

