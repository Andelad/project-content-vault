/**
 * Timeline & Day Display Business Rules
 * 
 * Single source of truth for timeline rendering - Events vs Estimates.
 * 
 * CRITICAL DISTINCTION:
 * - EVENTS = Actual calendar time blocks (planned or completed)
 * - ESTIMATES = Calculated projections from project/milestone allocations
 * - These are MUTUALLY EXCLUSIVE on any given day
 * 
 * This is the domain layer - pure business logic with no external dependencies.
 * All timeline calculations should delegate to these rules.
 * 
 * @see docs/BUSINESS_LOGIC_REFERENCE.md - Rule 9: Timeline Day Display
 */

import type { CalendarEvent, Project } from '@/types/core';
import { getDateKey } from '@/utils/dateFormatUtils';
import { isSameDay } from '@/services/calculations/general/dateCalculations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Types of time that can appear on timeline bars
 * 
 * CRITICAL: 'planned' and 'completed' are EVENT types (actual calendar time)
 *           'auto-estimate' is a CALCULATED type (projection, not an event)
 */
export type TimelineTimeType = 'planned-event' | 'completed-event' | 'auto-estimate';

/**
 * Classification of a calendar event for timeline purposes
 */
export interface EventTimeClassification {
  type: 'planned-event' | 'completed-event';
  hours: number;
  isPlanned: boolean;
  isCompleted: boolean;
  blocksEstimates: boolean; // Events block estimates from appearing
}

/**
 * Day display breakdown - Events OR Estimates (never both)
 */
export interface DayTimeBreakdown {
  // Event hours (actual calendar time)
  plannedEventHours: number;
  completedEventHours: number;
  
  // Estimate hours (calculated projection - only if no events)
  autoEstimateHours: number;
  
  // State flags
  hasAnyEvents: boolean;
  shouldShowEstimates: boolean; // Only true if NO events
  
  // Display determination
  displayType: TimelineTimeType;
}

// ============================================================================
// TIMELINE BUSINESS RULES
// ============================================================================

/**
 * Timeline Business Rules
 * 
 * Centralized location for all timeline and day estimate logic.
 * Referenced by the Business Logic Reference document (Rule 9).
 */
export class TimelineRules {
  
  // ==========================================================================
  // RULE 1: EVENT PROJECT FILTERING
  // ==========================================================================
  
  /**
   * RULE 1: Events must be linked to project to contribute to day estimates
   * 
   * Business Logic Reference: Rule 9 - Event Project Filtering
   * Formula: event.projectId === project.id
   * 
   * Critical: Events without projectId or with different projectId are ignored.
   * 
   * @param event - The calendar event to check
   * @param project - The project to check against
   * @returns true if event belongs to this project
   */
  static isEventForProject(event: CalendarEvent, project: Project): boolean {
    return event.projectId === project.id;
  }

  /**
   * Filter events to only those belonging to a specific project
   * 
   * @param events - All calendar events
   * @param project - The project to filter for
   * @returns Events belonging to this project
   */
  static filterEventsForProject(events: CalendarEvent[], project: Project): CalendarEvent[] {
    return events.filter(event => this.isEventForProject(event, project));
  }

  // ==========================================================================
  // RULE 2: EVENT TYPE CLASSIFICATION
  // ==========================================================================
  
  /**
   * RULE 2a: Determine if event is planned time (not yet done)
   * 
   * Business Logic Reference: Rule 9 - Planned Time
   * Formula: completed === false AND type !== 'tracked' AND type !== 'completed'
   * 
   * Planned time represents user's intention for future work.
   * Visual: Lighter color with dashed border
   * 
   * @param event - The calendar event to classify
   * @returns true if event represents planned (not yet done) time
   */
  static isPlannedTime(event: CalendarEvent): boolean {
    // Check completion flag
    if (event.completed === true) return false;
    
    // Check type field
    if (event.type === 'tracked' || event.type === 'completed') return false;
    
    // Everything else is planned time
    return true;
  }

  /**
   * RULE 2b: Determine if event is completed/tracked time (already done)
   * 
   * Business Logic Reference: Rule 9 - Completed/Tracked Time
   * Formula: completed === true OR type === 'tracked' OR type === 'completed'
   * 
   * Completed time represents actual work done.
   * Visual: Darker solid color
   * 
   * @param event - The calendar event to classify
   * @returns true if event represents completed/tracked time
   */
  static isCompletedTime(event: CalendarEvent): boolean {
    // Check completion flag
    if (event.completed === true) return true;
    
    // Check type field
    if (event.type === 'tracked' || event.type === 'completed') return true;
    
    return false;
  }

  /**
   * RULE 2c: Classify event for timeline purposes
   * 
   * @param event - The calendar event to classify
   * @returns Complete classification of the event
   */
  static classifyEvent(event: CalendarEvent): EventTimeClassification {
    const isPlanned = this.isPlannedTime(event);
    const isCompleted = this.isCompletedTime(event);
    
    // Calculate event duration in hours
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const hours = durationMs / (1000 * 60 * 60);

    return {
      type: isCompleted ? 'completed-event' : 'planned-event',
      hours,
      isPlanned,
      isCompleted,
      blocksEstimates: true // Both planned and completed events block estimates
    };
  }

  // ==========================================================================
  // RULE 3: AUTO-ESTIMATE BLOCKING
  // ==========================================================================
  
  /**
   * RULE 3: Auto-estimates only appear on days WITHOUT any events
   * 
   * Business Logic Reference: Rule 9 - Auto-Estimate Time
   * 
   * Critical: If a day has ANY events (planned or completed) for a project,
   * that day should NOT show auto-estimate time for that project.
   * 
   * @param eventsOnDay - Events on a specific day for a project
   * @returns true if auto-estimates should be shown (no events present)
   */
  static shouldShowAutoEstimate(eventsOnDay: CalendarEvent[]): boolean {
    // If there are any events on this day, don't show auto-estimate
    return eventsOnDay.length === 0;
  }

  /**
   * Check if a specific event blocks auto-estimates
   * 
   * @param event - The event to check
   * @returns true if this event blocks auto-estimates
   */
  static doesEventBlockAutoEstimate(event: CalendarEvent): boolean {
    // Both planned and completed events block auto-estimates
    return true;
  }

  // ==========================================================================
  // RULE 4: DAY TIME BREAKDOWN
  // ==========================================================================
  
  /**
   * RULE 4: Calculate day display breakdown
   * 
   * Analyzes all events on a day and determines what to display.
   * Events and estimates are mutually exclusive.
   * 
   * @param eventsOnDay - All events for this project on this day
   * @returns Complete breakdown for display
   */
  static calculateDayTimeBreakdown(eventsOnDay: CalendarEvent[]): DayTimeBreakdown {
    let plannedEventHours = 0;
    let completedEventHours = 0;

    // Classify and sum up EVENT hours
    eventsOnDay.forEach(event => {
      const classification = this.classifyEvent(event);
      
      // DEBUG: Log each event classification
      const eventDate = getDateKey(new Date(event.startTime));
      if (eventDate === '2024-10-13') {
        console.log(`[TimelineRules] Event on Oct 13:`, {
          id: event.id,
          startTime: event.startTime,
          endTime: event.endTime,
          completed: event.completed,
          type: event.type,
          classification: {
            type: classification.type,
            hours: classification.hours,
            isPlanned: classification.isPlanned,
            isCompleted: classification.isCompleted
          }
        });
      }
      
      if (classification.isCompleted) {
        completedEventHours += classification.hours;
      } else if (classification.isPlanned) {
        plannedEventHours += classification.hours;
      }
    });

    const hasAnyEvents = eventsOnDay.length > 0;
    const shouldShowEstimates = this.shouldShowAutoEstimate(eventsOnDay);

    // Determine what to display
    // CRITICAL: If any events exist, show events. Otherwise show estimates.
    let displayType: TimelineTimeType;
    if (hasAnyEvents) {
      // Current rule: If has both planned and completed, show as planned
      // Future: Stack them separately
      displayType = plannedEventHours > 0 ? 'planned-event' : 'completed-event';
    } else {
      displayType = 'auto-estimate';
    }

    return {
      plannedEventHours,
      completedEventHours,
      autoEstimateHours: 0, // Will be calculated separately if needed
      hasAnyEvents,
      shouldShowEstimates,
      displayType
    };
  }

  // ==========================================================================
  // RULE 5: EVENT DATE EXTRACTION
  // ==========================================================================
  
  /**
   * RULE 5: Extract the date an event occurs on (normalized)
   * 
   * Events are associated with dates for day estimate calculations.
   * Time component is stripped to get the calendar day.
   * 
   * @param event - The calendar event
   * @returns Date normalized to midnight (00:00:00)
   */
  static getEventDate(event: CalendarEvent): Date {
    const eventDate = new Date(event.startTime);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate;
  }

  /**
   * Get date key for grouping events by day
   * 
   * Uses centralized timezone-safe date key function from utils.
   * 
   * @param event - The calendar event
   * @returns Date key in format 'YYYY-MM-DD'
   */
  static getEventDateKey(event: CalendarEvent): string {
    const date = new Date(event.startTime);
    return getDateKey(date);
  }

  // ==========================================================================
  // RULE 6: VISUAL STYLING RULES
  // ==========================================================================
  
  /**
   * RULE 6: Determine visual styling based on time type
   * 
   * Defines the visual appearance for each type of time on timeline.
   * 
   * @param timeType - The type of time to get styling for
   * @returns Styling description
   */
  static getVisualStyling(timeType: TimelineTimeType): {
    description: string;
    hasBorder: boolean;
    borderStyle?: string;
    colorIntensity: 'light' | 'medium' | 'dark';
  } {
    switch (timeType) {
      case 'planned-event':
        return {
          description: 'Lighter color with dashed border (actual calendar event)',
          hasBorder: true,
          borderStyle: 'dashed',
          colorIntensity: 'medium'
        };
      case 'completed-event':
        return {
          description: 'Darker solid color (actual calendar event)',
          hasBorder: false,
          colorIntensity: 'dark'
        };
      case 'auto-estimate':
        return {
          description: 'Lightest color, no border (calculated projection)',
          hasBorder: false,
          colorIntensity: 'light'
        };
    }
  }

  // ==========================================================================
  // VALIDATION HELPERS
  // ==========================================================================
  
  /**
   * Validate that event has required fields for timeline calculations
   * 
   * @param event - The event to validate
   * @returns true if event is valid for timeline
   */
  static isValidTimelineEvent(event: CalendarEvent): boolean {
    return (
      event.startTime !== undefined &&
      event.endTime !== undefined &&
      new Date(event.startTime) < new Date(event.endTime)
    );
  }

  /**
   * Group events by date for day estimate calculations
   * 
   * @param events - Events to group
   * @returns Map of dateKey -> events on that date
   */
  static groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
    const grouped = new Map<string, CalendarEvent[]>();
    
    events.forEach(event => {
      if (!this.isValidTimelineEvent(event)) return;
      
      const dateKey = this.getEventDateKey(event);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    });
    
    return grouped;
  }
}
