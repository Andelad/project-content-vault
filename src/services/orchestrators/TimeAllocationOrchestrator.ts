/**
 * Time Allocation Orchestrator - Phase 4 Updated
 * 
 * Uses UnifiedDayEstimateService as single source of truth for time allocations.
 * Coordinates between planned events and day estimates.
 */
import { CalendarEvent, Milestone, DayEstimate, Project, Settings, Holiday } from '@/types/core';
import { UnifiedDayEstimateService } from '@/services/unified/UnifiedDayEstimateService';
import { memoizedGetProjectTimeAllocation, isProjectFullyCompletedOnDate, calculateDayHeight } from '@/services';

export interface TimeAllocationResult {
  type: 'planned' | 'auto-estimate' | 'none';
  hours: number;
  heightInPixels: number;
  source: 'planned-events' | 'milestone-allocation' | 'project-auto-estimate' | 'none';
  dayEstimates?: DayEstimate[]; // New: underlying day estimates
  isPlannedAndCompleted?: boolean; // Whether this is planned time that has been completed
}
export class TimeAllocationService {
  /**
   * Get comprehensive time allocation information for a specific date
   * Uses UnifiedDayEstimateService as single source of truth
   */
  static generateTimeAllocation(
    projectId: string, 
    date: Date, 
    events: CalendarEvent[], 
    project: Project, 
    settings: Settings, 
    holidays: Holiday[], 
    dayEstimates: DayEstimate[], // NEW: Pre-calculated day estimates
    options?: any
  ): TimeAllocationResult {
    // Check for planned events first (they override everything)
    const timeAllocation = memoizedGetProjectTimeAllocation(
      projectId,
      date,
      events,
      project,
      settings,
      holidays
    );

    if (timeAllocation.type === 'planned') {
      // Planned events take absolute priority
      const isPlannedAndCompleted = isProjectFullyCompletedOnDate(projectId, events, date);
      const heightInPixels = calculateDayHeight(timeAllocation.hours);
      
      return {
        type: 'planned',
        hours: timeAllocation.hours,
        heightInPixels,
        source: 'planned-events',
        isPlannedAndCompleted
      };
    }

    // Get day estimates for this specific date
    const dateEstimates = UnifiedDayEstimateService.getDayEstimatesForDate(dayEstimates, date);
    
    if (dateEstimates.length > 0) {
      // Calculate total hours from all estimates for this day
      const totalHours = UnifiedDayEstimateService.calculateDateTotalHours(dayEstimates, date);
      const heightInPixels = calculateDayHeight(totalHours);
      
      // Determine source based on estimate types
      const source = dateEstimates.some(est => est.source === 'milestone-allocation')
        ? 'milestone-allocation'
        : 'project-auto-estimate';
      
      return {
        type: 'auto-estimate',
        hours: totalHours,
        heightInPixels,
        source,
        dayEstimates: dateEstimates,
        isPlannedAndCompleted: false
      };
    }

    // No allocation for this date
    return {
      type: 'none',
      hours: 0,
      heightInPixels: 0,
      source: 'none',
      isPlannedAndCompleted: false
    };
  }
  /**
   * Get tooltip information for a specific date
   */
  static getTooltipInfo(allocation: TimeAllocationResult): {
    type: string;
    hours: number;
    displayText: string;
  } {
    const isPlanned = allocation.type === 'planned';
    const tooltipType = isPlanned ? 'Planned time' : 'Auto-estimate';
    const displayHours = Math.floor(allocation.hours);
    const displayMinutes = Math.round((allocation.hours - displayHours) * 60);
    // Debug log for tooltip generation
    const displayText = displayMinutes > 0 
      ? `${displayHours}h ${displayMinutes}m/day`
      : `${displayHours} hour${displayHours !== 1 ? 's' : ''}/day`;
    // Extra aggressive debug log to catch all tooltip text generation
    if (displayText.includes('3m') || displayText.includes('3 m') || displayMinutes === 3) {
    }
    return {
      type: tooltipType,
      hours: allocation.hours,
      displayText
    };
  }
}
