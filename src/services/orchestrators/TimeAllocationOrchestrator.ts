/**
 * Time Allocation Service
 * Centralized service for determining time allocation type and hours for specific dates
 */

import { CalendarEvent, Milestone } from '@/types/core';
import { memoizedGetProjectTimeAllocation, getMilestoneSegmentForDate, type MilestoneSegment, isPlannedTimeCompleted, calculateDayHeight } from '@/services';

export interface TimeAllocationResult {
  type: 'planned' | 'auto-estimate' | 'none';
  hours: number;
  heightInPixels: number;
  source: 'planned-events' | 'milestone-segment' | 'project-estimate' | 'none';
  milestoneSegment?: MilestoneSegment;
  isPlannedAndCompleted?: boolean; // Whether this is planned time that has been completed
}

export class TimeAllocationService {
  /**
   * Get comprehensive time allocation information for a specific date
   * Centralizes the decision logic for planned vs auto-estimate vs none
   */
  static generateTimeAllocation(
    projectId: string, 
    date: Date, 
    events: CalendarEvent[], 
    project: any, 
    settings: any, 
    holidays: any[], 
    milestoneSegments: MilestoneSegment[],
    options?: any
  ): any {
    
    // Get the current implementation registry
    const timeAllocation = memoizedGetProjectTimeAllocation(
      projectId,
      date,
      events,
      project,
      settings,
      holidays
    );

    // Check for milestone segment
    const milestoneSegment = getMilestoneSegmentForDate(date, milestoneSegments);

    // Determine final hours and source
    let finalHours: number;
    let source: TimeAllocationResult['source'];
    
    if (timeAllocation.type === 'planned') {
      // Planned time takes priority
      finalHours = timeAllocation.hours;
      source = 'planned-events';
    } else if (milestoneSegment) {
      // Use milestone segment calculation
      finalHours = milestoneSegment.dailyHours;
      source = 'milestone-segment';
    } else if (timeAllocation.type === 'auto-estimate') {
      // Fallback to project-level auto-estimate
      finalHours = timeAllocation.hours;
      source = 'project-estimate';
    } else {
      // No time allocation
      finalHours = 0;
      source = 'none';
    }

    // Check if planned time is completed
    const isPlannedAndCompleted = timeAllocation.type === 'planned' && 
      isPlannedTimeCompleted(projectId, date, events);

    // Calculate height using centralized service
    const heightInPixels = calculateDayHeight(finalHours);

    return {
      type: timeAllocation.type,
      hours: finalHours,
      heightInPixels,
      source,
      milestoneSegment: milestoneSegment || undefined,
      isPlannedAndCompleted
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
      console.log(`[FOUND 3 MINUTES!] Tooltip text: "${displayText}" from ${allocation.hours}h (${(allocation.hours * 60).toFixed(1)} min), source: ${allocation.source}`);
    }

    return {
      type: tooltipType,
      hours: allocation.hours,
      displayText
    };
  }
}
