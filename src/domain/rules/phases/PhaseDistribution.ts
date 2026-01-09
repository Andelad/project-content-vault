/**
 * PhaseDistributionService
 * 
 * Domain Service for Phase Time Distribution Logic
 * 
 * Purpose:
 * - Calculate time distribution across phases
 * - Analyze phase allocation patterns
 * - Generate optimal phase spacing
 * - Calculate timeline segments for visualization
 * - Pure domain logic (no persistence, no UI)
 * 
 * Business Context:
 * - Phases divide project timeline into work segments
 * - Each phase has time allocation that needs distribution
 * - Distribution helps estimate daily workload
 * - Optimal spacing provides planning recommendations
 * 
 * This service contains the "what" (distribution algorithms) not the "how" (persistence).
 */

import type { PhaseDTO } from '@/shared/types/core';

export interface AllocationDistribution {
  min: number;
  max: number;
  avg: number;
  median: number;
  standardDeviation: number;
}

export interface PhaseSegment {
  startDate: Date;
  endDate: Date;
  phase: PhaseDTO;
  estimatedHours: number;
  dailyHours: number;
  workingDays: number;
  position: 'before' | 'during' | 'after';
}

export interface TimelineDistributionEntry {
  date: Date;
  estimatedHours: number;
  phase?: PhaseDTO;
  dayIndex: number;
  isDeadlineDay: boolean;
}

export interface PhaseSpacingRecommendation {
  recommendedDates: Date[];
  intervalDays: number;
  reasoning: string;
}

/**
 * PhaseDistributionService
 * 
 * Pure domain logic for phase time distribution and spacing.
 * No dependencies on Supabase, React, or other external systems.
 */
export class PhaseDistributionService {
  private static readonly MIN_PHASE_SPACING_DAYS = 1;
  private static readonly RECOMMENDED_PHASES_PER_MONTH = 4;

  // ============================================================================
  // ALLOCATION DISTRIBUTION ANALYSIS
  // ============================================================================

  /**
   * Calculate phase allocation distribution statistics
   * 
   * Provides statistical analysis of how time is allocated across phases:
   * - Minimum allocation
   * - Maximum allocation
   * - Average allocation
   * - Median allocation
   * - Standard deviation (measure of variance)
   * 
   * @param phases - Array of phases
   * @returns Distribution statistics
   */
  static calculateAllocationDistribution(phases: PhaseDTO[]): AllocationDistribution {
    if (phases.length === 0) {
      return { min: 0, max: 0, avg: 0, median: 0, standardDeviation: 0 };
    }

    const allocations = phases
      .map(phase => phase.timeAllocationHours ?? phase.timeAllocation ?? 0)
      .sort((a, b) => a - b);

    const min = allocations[0];
    const max = allocations[allocations.length - 1];
    const avg = allocations.reduce((sum, val) => sum + val, 0) / allocations.length;

    // Calculate median
    const medianIndex = Math.floor(allocations.length / 2);
    const median = allocations.length % 2 === 0
      ? (allocations[medianIndex - 1] + allocations[medianIndex]) / 2
      : allocations[medianIndex];

    // Calculate standard deviation
    const variance = allocations.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / allocations.length;
    const standardDeviation = Math.sqrt(variance);

    return { min, max, avg, median, standardDeviation };
  }

  /**
   * Check if phases are evenly distributed
   * 
   * Business Rule: Phases are "evenly distributed" if standard deviation
   * is less than 50% of the average allocation
   * 
   * @param phases - Array of phases
   * @returns True if evenly distributed
   */
  static areAllocationsEvenlyDistributed(phases: PhaseDTO[]): boolean {
    if (phases.length < 2) return true;

    const distribution = this.calculateAllocationDistribution(phases);
    if (distribution.avg === 0) return true;

    return distribution.standardDeviation < (distribution.avg * 0.5);
  }

  /**
   * Find outlier phases (significantly different from average)
   * 
   * Business Rule: Outlier is a phase with allocation more than 2 standard
   * deviations from the mean
   * 
   * @param phases - Array of phases
   * @returns Array of outlier phases
   */
  static findOutlierPhases(phases: PhaseDTO[]): PhaseDTO[] {
    if (phases.length < 3) return [];

    const distribution = this.calculateAllocationDistribution(phases);
    const threshold = distribution.avg + (2 * distribution.standardDeviation);

    return phases.filter(phase => {
      const allocation = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
      return Math.abs(allocation - distribution.avg) > threshold;
    });
  }

  // ============================================================================
  // PHASE SPACING & POSITIONING
  // ============================================================================

  /**
   * Calculate optimal phase spacing for a project
   * 
   * Business Rules:
   * - Phases should be evenly distributed across project timeline
   * - Minimum spacing is 1 day between phases
   * - Recommended spacing considers project duration and phase count
   * 
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param targetPhaseCount - Desired number of phases
   * @returns Array of recommended phase dates
   */
  static calculateOptimalPhaseSpacing(
    projectStartDate: Date,
    projectEndDate: Date,
    targetPhaseCount: number
  ): Date[] {
    if (targetPhaseCount <= 0) return [];

    const totalDays = this.calculateDayDifference(projectStartDate, projectEndDate);
    const interval = Math.floor(totalDays / (targetPhaseCount + 1));

    const recommendedDates: Date[] = [];
    const currentDate = new Date(projectStartDate);

    for (let i = 0; i < targetPhaseCount; i++) {
      currentDate.setDate(currentDate.getDate() + interval);
      recommendedDates.push(new Date(currentDate));
    }

    return recommendedDates;
  }

  /**
   * Generate phase spacing recommendation
   * 
   * Provides actionable recommendations for phase placement
   * 
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param currentPhaseCount - Current number of phases
   * @returns Spacing recommendation with reasoning
   */
  static generateSpacingRecommendation(
    projectStartDate: Date,
    projectEndDate: Date,
    currentPhaseCount: number
  ): PhaseSpacingRecommendation {
    const totalDays = this.calculateDayDifference(projectStartDate, projectEndDate);
    const months = totalDays / 30;
    const recommendedCount = Math.max(1, Math.round(months * this.RECOMMENDED_PHASES_PER_MONTH));

    const recommendedDates = this.calculateOptimalPhaseSpacing(
      projectStartDate,
      projectEndDate,
      recommendedCount
    );

    const intervalDays = recommendedDates.length > 1
      ? this.calculateDayDifference(recommendedDates[0], recommendedDates[1])
      : totalDays;

    let reasoning: string;
    if (currentPhaseCount === 0) {
      reasoning = `Consider adding ${recommendedCount} phases for this ${Math.round(months)}-month project (approximately ${this.RECOMMENDED_PHASES_PER_MONTH} phases per month)`;
    } else if (currentPhaseCount < recommendedCount / 2) {
      reasoning = `Current phase count (${currentPhaseCount}) is low for project duration. Consider adding more phases for better progress tracking`;
    } else if (currentPhaseCount > recommendedCount * 2) {
      reasoning = `Current phase count (${currentPhaseCount}) is high. Consider consolidating phases for simpler project management`;
    } else {
      reasoning = `Current phase count (${currentPhaseCount}) is appropriate for project duration`;
    }

    return {
      recommendedDates,
      intervalDays,
      reasoning
    };
  }

  /**
   * Calculate actual spacing between consecutive phases
   * 
   * @param phases - Array of phases (will be sorted by date)
   * @returns Array of intervals in days between phases
   */
  static calculateActualPhaseSpacing(phases: PhaseDTO[]): number[] {
    if (phases.length < 2) return [];

    const sortedPhases = this.sortPhasesByDate(phases);
    const intervals: number[] = [];

    for (let i = 1; i < sortedPhases.length; i++) {
      const prevDate = sortedPhases[i - 1].endDate || sortedPhases[i - 1].dueDate;
      const currDate = sortedPhases[i].endDate || sortedPhases[i].dueDate;
      const days = this.calculateDayDifference(prevDate, currDate);
      intervals.push(days);
    }

    return intervals;
  }

  // ============================================================================
  // TIMELINE SEGMENTATION
  // ============================================================================

  /**
   * Calculate phase segments for timeline visualization
   * 
   * Divides project timeline into segments based on phases.
   * Each segment represents work leading up to a phase deadline.
   * 
   * Business Rules:
   * - First segment starts from project start
   * - Each subsequent segment starts day after previous phase
   * - Daily hours = phase hours / segment days
   * - Segment after last phase has 0 daily hours
   * 
   * @param phases - Project phases
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @returns Array of timeline segments
   */
  static calculatePhaseSegments(
    phases: PhaseDTO[],
    projectStartDate: Date,
    projectEndDate: Date
  ): PhaseSegment[] {
    if (!phases || phases.length === 0) {
      return [];
    }

    const segments: PhaseSegment[] = [];
    const sortedPhases = this.sortPhasesByDate(phases);

    // Create segments between phases
    for (let i = 0; i < sortedPhases.length; i++) {
      const phase = sortedPhases[i];
      const phaseDate = phase.endDate || phase.dueDate;

      let segmentStart: Date;
      let segmentEnd: Date;
      let position: 'before' | 'during' | 'after';

      if (i === 0) {
        // First phase segment starts from project start
        segmentStart = new Date(projectStartDate);
        segmentEnd = new Date(phaseDate);
        position = 'before';
      } else {
        // Subsequent segments start from previous phase
        const prevPhaseDate = sortedPhases[i - 1].endDate || sortedPhases[i - 1].dueDate;
        const dayAfterPrev = new Date(prevPhaseDate);
        dayAfterPrev.setDate(dayAfterPrev.getDate() + 1);

        segmentStart = dayAfterPrev;
        segmentEnd = new Date(phaseDate);
        position = 'during';
      }

      // Calculate hours per day for this segment
      const estimatedHours = phase.timeAllocationHours ?? phase.timeAllocation ?? 0;
      const segmentDays = Math.max(1, this.calculateDayDifference(segmentStart, segmentEnd) + 1);

      segments.push({
        startDate: segmentStart,
        endDate: segmentEnd,
        phase,
        estimatedHours,
        dailyHours: estimatedHours / segmentDays,
        workingDays: segmentDays,
        position
      });
    }

    // Handle period after last phase if exists
    const lastPhaseDate = sortedPhases[sortedPhases.length - 1].endDate || sortedPhases[sortedPhases.length - 1].dueDate;
    const dayAfterLast = new Date(lastPhaseDate);
    dayAfterLast.setDate(dayAfterLast.getDate() + 1);

    if (dayAfterLast < projectEndDate) {
      const segmentDays = Math.max(1, this.calculateDayDifference(dayAfterLast, projectEndDate) + 1);

      segments.push({
        startDate: dayAfterLast,
        endDate: projectEndDate,
        phase: sortedPhases[sortedPhases.length - 1],
        estimatedHours: 0,
        dailyHours: 0,
        workingDays: segmentDays,
        position: 'after'
      });
    }

    return segments;
  }

  /**
   * Calculate timeline distribution for visualization
   * 
   * Generates day-by-day breakdown of estimated hours across project timeline.
   * Useful for charts, calendars, and workload visualization.
   * 
   * @param phases - Project phases
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @returns Array of daily distribution entries
   */
  static calculateTimelineDistribution(
    phases: PhaseDTO[],
    projectStartDate: Date,
    projectEndDate: Date
  ): TimelineDistributionEntry[] {
    const distribution: TimelineDistributionEntry[] = [];
    const segments = this.calculatePhaseSegments(phases, projectStartDate, projectEndDate);

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
        phase: segment?.phase,
        dayIndex,
        isDeadlineDay
      });

      currentDate.setDate(currentDate.getDate() + 1);
      dayIndex++;
    }

    return distribution;
  }

  /**
   * Get phases within a specific date range
   * 
   * @param phases - All phases
   * @param startDate - Range start
   * @param endDate - Range end
   * @returns Phases with deadlines in range
   */
  static getPhasesInDateRange(
    phases: PhaseDTO[],
    startDate: Date,
    endDate: Date
  ): PhaseDTO[] {
    return phases.filter(phase => {
      const phaseDate = phase.endDate || phase.dueDate;
      return phaseDate >= startDate && phaseDate <= endDate;
    });
  }

  // ============================================================================
  // WORKLOAD ANALYSIS
  // ============================================================================

  /**
   * Calculate peak workload day
   * 
   * Finds the day with highest estimated hours
   * 
   * @param phases - Project phases
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @returns Peak day with hours
   */
  static calculatePeakWorkloadDay(
    phases: PhaseDTO[],
    projectStartDate: Date,
    projectEndDate: Date
  ): { date: Date; hours: number } | null {
    const distribution = this.calculateTimelineDistribution(phases, projectStartDate, projectEndDate);
    if (distribution.length === 0) return null;

    const peak = distribution.reduce((max, entry) =>
      entry.estimatedHours > max.estimatedHours ? entry : max
    );

    return {
      date: peak.date,
      hours: peak.estimatedHours
    };
  }

  /**
   * Calculate average daily workload
   * 
   * @param phases - Project phases
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @returns Average hours per day
   */
  static calculateAverageDailyWorkload(
    phases: PhaseDTO[],
    projectStartDate: Date,
    projectEndDate: Date
  ): number {
    const totalHours = phases.reduce((sum, phase) =>
      sum + (phase.timeAllocationHours ?? phase.timeAllocation ?? 0), 0
    );

    const totalDays = this.calculateDayDifference(projectStartDate, projectEndDate) + 1;
    return totalDays > 0 ? totalHours / totalDays : 0;
  }

  /**
   * Identify workload bottlenecks
   * 
   * Finds periods where daily workload exceeds threshold
   * 
   * @param phases - Project phases
   * @param projectStartDate - Project start date
   * @param projectEndDate - Project end date
   * @param thresholdHours - Maximum acceptable daily hours
   * @returns Array of bottleneck dates
   */
  static identifyWorkloadBottlenecks(
    phases: PhaseDTO[],
    projectStartDate: Date,
    projectEndDate: Date,
    thresholdHours: number
  ): Date[] {
    const distribution = this.calculateTimelineDistribution(phases, projectStartDate, projectEndDate);

    return distribution
      .filter(entry => entry.estimatedHours > thresholdHours)
      .map(entry => entry.date);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Sort phases by date (ascending)
   * 
   * @param phases - Phases to sort
   * @returns Sorted phases
   */
  private static sortPhasesByDate(phases: PhaseDTO[]): PhaseDTO[] {
    return [...phases].sort((a, b) => {
      const dateA = a.endDate || a.dueDate;
      const dateB = b.endDate || b.dueDate;
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * Calculate day difference between two dates
   * 
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of days
   */
  private static calculateDayDifference(startDate: Date, endDate: Date): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }
}
