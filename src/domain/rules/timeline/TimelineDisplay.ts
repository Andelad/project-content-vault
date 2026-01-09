/**
 * Timeline Display Rules
 * 
 * VIEW-SPECIFIC rules for the Timeline View's display decisions.
 * 
 * ⚠️ ARCHITECTURE NOTE:
 * This file contains DISPLAY LOGIC specific to the Timeline View.
 * For pure domain rules (event classification), see EventClassificationRules.ts.
 * 
 * Key View Constraint (Timeline-specific):
 * - Events and auto-estimates are MUTUALLY EXCLUSIVE per day in Timeline View
 * - This is a UI constraint (bars can't overlap), NOT a domain rule
 * - Other views (Planner, Reports) may show both simultaneously
 * 
 * Part of three-layer architecture:
 * - domain/rules/timeline/TimelineDisplay.ts (THIS FILE - timeline view logic)
 * 
 * Created: 2025 (original TimelineRules)
 * Moved: 2026-01-07 (organized into timeline/ subdirectory)
 * 
 * @see docs/core/View Specifications.md - Timeline View display rules
 * @see docs/core/Business Logic.md - Rule 9 (domain calculations)
 * @see EventClassificationRules.ts - Pure domain event classification
 * @see docs/operations/ARCHITECTURE_REBUILD_PLAN.md
 */
import type { CalendarEvent, Project } from '@/shared/types/core';
import { EventClassificationRules } from '../events/EventClassification';

// ============================================================================
// TYPE DEFINITIONS (Timeline View-Specific)
// ============================================================================

/**
 * Types of time that can appear on timeline bars
 * 
 * View-specific: These map to visual bar styles in Timeline View
 */
export type TimelineTimeType = 'planned-event' | 'completed-event' | 'auto-estimate';

/**
 * Classification of a calendar event for timeline display
 * 
 * @deprecated Prefer EventClassificationRules.classifyEvent() for pure domain logic.
 * Use this only when you need the timeline-specific 'blocksEstimates' property.
 */
export interface EventTimeClassification {
  type: 'planned-event' | 'completed-event';
  hours: number;
  isPlanned: boolean;
  isCompleted: boolean;
  blocksEstimates: boolean; // Timeline-specific: events block estimate bars from appearing
}

/**
 * Day display breakdown for Timeline View
 * 
 * Timeline-specific: Enforces mutual exclusivity (events OR estimates, never both)
 */
export interface DayTimeBreakdown {
  // Event hours (actual calendar time)
  plannedEventHours: number;
  completedEventHours: number;
  // Estimate hours (calculated projection - only if no events)
  autoEstimateHours: number;
  // State flags
  hasAnyEvents: boolean;
  shouldShowEstimates: boolean; // Timeline-specific: Only true if NO events
  // Display determination (Timeline-specific)
  displayType: TimelineTimeType;
}

// ============================================================================
// TIMELINE VIEW RULES
// ============================================================================

/**
 * Timeline Display Rules
 * 
 * View-specific rules for Timeline View rendering.
 * Delegates to EventClassificationRules for pure domain logic.
 * 
 * @see docs/core/View Specifications.md - Timeline View
 */
export class TimelineRules {
  
  // ==========================================================================
  // DELEGATED METHODS (Pure Domain Logic)
  // These delegate to EventClassificationRules for domain purity
  // ==========================================================================

  /**
   * Check if event belongs to a project
   * @see EventClassificationRules.isEventForProject
   */
  static isEventForProject(event: CalendarEvent, project: Project): boolean {
    return EventClassificationRules.isEventForProject(event, project);
  }

  /**
   * Filter events for a specific project
   * @see EventClassificationRules.filterEventsForProject
   */
  static filterEventsForProject(events: CalendarEvent[], project: Project): CalendarEvent[] {
    return EventClassificationRules.filterEventsForProject(events, project);
  }

  /**
   * Check if event is planned time
   * @see EventClassificationRules.isPlannedTime
   */
  static isPlannedTime(event: CalendarEvent): boolean {
    return EventClassificationRules.isPlannedTime(event);
  }

  /**
   * Check if event is completed time
   * @see EventClassificationRules.isCompletedTime
   */
  static isCompletedTime(event: CalendarEvent): boolean {
    return EventClassificationRules.isCompletedTime(event);
  }

  /**
   * Classify event for timeline display (includes blocksEstimates property)
   */
  static classifyEvent(event: CalendarEvent): EventTimeClassification {
    const domainClassification = EventClassificationRules.classifyEvent(event);
    
    return {
      type: domainClassification.isCompleted ? 'completed-event' : 'planned-event',
      hours: domainClassification.hours,
      isPlanned: domainClassification.isPlanned,
      isCompleted: domainClassification.isCompleted,
      blocksEstimates: true // Timeline-specific: both planned and completed block estimates
    };
  }

  /**
   * Get event date
   * @see EventClassificationRules.getEventDate
   */
  static getEventDate(event: CalendarEvent): Date {
    return EventClassificationRules.getEventDate(event);
  }

  /**
   * Get event date key
   * @see EventClassificationRules.getEventDateKey
   */
  static getEventDateKey(event: CalendarEvent): string {
    return EventClassificationRules.getEventDateKey(event);
  }

  /**
   * Validate event for timeline
   * @see EventClassificationRules.isValidEvent
   */
  static isValidTimelineEvent(event: CalendarEvent): boolean {
    return EventClassificationRules.isValidEvent(event);
  }

  /**
   * Group events by date
   * @see EventClassificationRules.groupEventsByDate
   */
  static groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
    return EventClassificationRules.groupEventsByDate(events);
  }

  // ==========================================================================
  // TIMELINE VIEW-SPECIFIC RULES
  // These implement the mutual exclusivity constraint for Timeline View
  // ==========================================================================

  /**
   * TIMELINE VIEW RULE: Auto-estimates only appear on days WITHOUT any events
   * 
   * This is a VIEW CONSTRAINT (bars can't overlap), not a domain rule.
   * Other views (Planner, Reports) may show both events and estimates.
   * 
   * @see docs/core/View Specifications.md - Timeline View mutual exclusivity
   * 
   * @param eventsOnDay - Events on a specific day for a project
   * @returns true if auto-estimates should be shown (no events present)
   */
  static shouldShowAutoEstimate(eventsOnDay: CalendarEvent[]): boolean {
    return eventsOnDay.length === 0;
  }

  /**
   * Check if a specific event blocks auto-estimates in Timeline View
   * 
   * @param event - The event to check
   * @returns true if this event blocks auto-estimates (always true for Timeline)
   */
  static doesEventBlockAutoEstimate(event: CalendarEvent): boolean {
    return true; // All events block auto-estimates in Timeline View
  }

  /**
   * TIMELINE VIEW RULE: Calculate day display breakdown
   * 
   * Implements mutual exclusivity: shows EITHER events OR auto-estimates, never both.
   * This is a Timeline View UI constraint, not a domain rule.
   * 
   * @see docs/core/View Specifications.md - Timeline View display rules
   * 
   * @param eventsOnDay - All events for this project on this day
   * @returns Complete breakdown for Timeline display
   */
  static calculateDayTimeBreakdown(eventsOnDay: CalendarEvent[]): DayTimeBreakdown {
    // Delegate to domain rules for event summary
    const summary = EventClassificationRules.summarizeDayEvents(eventsOnDay);

    const hasAnyEvents = summary.hasEvents;
    const shouldShowEstimates = this.shouldShowAutoEstimate(eventsOnDay);

    // TIMELINE VIEW RULE: Determine what to display (mutual exclusivity)
    let displayType: TimelineTimeType;
    if (hasAnyEvents) {
      // Show events: prefer planned if both exist
      displayType = summary.plannedHours > 0 ? 'planned-event' : 'completed-event';
    } else {
      displayType = 'auto-estimate';
    }

    return {
      plannedEventHours: summary.plannedHours,
      completedEventHours: summary.completedHours,
      autoEstimateHours: 0, // Calculated separately if needed
      hasAnyEvents,
      shouldShowEstimates,
      displayType
    };
  }

  // ==========================================================================
  // TIMELINE VISUAL STYLING (View-Specific)
  // ==========================================================================

  /**
   * Get visual styling for time type on Timeline View
   * 
   * View-specific: Defines bar appearance in Timeline
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
          description: 'Lighter color with dashed border (scheduled future work)',
          hasBorder: true,
          borderStyle: 'dashed',
          colorIntensity: 'medium'
        };
      case 'completed-event':
        return {
          description: 'Darker solid color (work already done)',
          hasBorder: false,
          colorIntensity: 'dark'
        };
      case 'auto-estimate':
        return {
          description: 'Lightest color, no border (calculated daily allocation)',
          hasBorder: false,
          colorIntensity: 'light'
        };
    }
  }
}
