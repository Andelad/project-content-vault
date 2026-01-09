/**
 * Event Classification Rules
 * 
 * Pure domain rules for classifying calendar events.
 * 
 * Domain Concepts:
 * - PLANNED TIME: Calendar events not yet completed (future intentions)
 * - COMPLETED TIME: Calendar events that are done (actual work)
 * - Events belong to projects (filtering rules)
 * 
 * This is pure business logic with NO view-specific concerns.
 * View-specific display decisions (e.g., mutual exclusivity in Timeline)
 * are handled at the view/service layer.
 * 
 * @see docs/core/Business Logic.md - Rule 9: Time Type Definitions
 */
import type { CalendarEvent, Project } from '@/shared/types/core';
import { getDateKey } from '@/presentation/utils/dateFormatUtils';
import { calculateDurationHours } from '@/presentation/utils/dateCalculations';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Event time classification types (domain concepts, not view-specific)
 */
export type EventTimeType = 'planned' | 'completed';

/**
 * Classification of a calendar event
 */
export interface EventClassification {
  type: EventTimeType;
  hours: number;
  isPlanned: boolean;
  isCompleted: boolean;
}

/**
 * Summary of events on a specific day for a project
 */
export interface DayEventSummary {
  plannedHours: number;
  completedHours: number;
  totalHours: number;
  hasEvents: boolean;
  eventCount: number;
}

// ============================================================================
// EVENT CLASSIFICATION RULES
// ============================================================================

/**
 * Event Classification Rules
 * 
 * Pure domain rules for event classification and filtering.
 * Referenced by Business Logic document (Rule 9).
 */
export class EventClassificationRules {
  
  // ==========================================================================
  // RULE 1: EVENT PROJECT FILTERING
  // ==========================================================================
  
  /**
   * Check if an event belongs to a specific project
   * 
   * Business Logic Reference: Rule 9.4 - Event Project Filtering
   * Formula: event.projectId === project.id AND category !== 'habit' AND category !== 'task'
   * 
   * Habits and tasks NEVER belong to projects (even if legacy data has projectId).
   * 
   * @param event - The calendar event to check
   * @param project - The project to check against
   * @returns true if event belongs to this project
   */
  static isEventForProject(event: CalendarEvent, project: Project): boolean {
    // Habits and tasks never belong to projects
    if (event.category === 'habit' || event.category === 'task') {
      return false;
    }
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
   * Determine if event is planned time (not yet done)
   * 
   * Business Logic Reference: Rule 9.3 - Planned Time
   * Formula: completed === false AND type !== 'tracked' AND type !== 'completed'
   * 
   * @param event - The calendar event to classify
   * @returns true if event represents planned (not yet done) time
   */
  static isPlannedTime(event: CalendarEvent): boolean {
    if (event.completed === true) return false;
    if (event.type === 'tracked' || event.type === 'completed') return false;
    return true;
  }

  /**
   * Determine if event is completed/tracked time (already done)
   * 
   * Business Logic Reference: Rule 9.3 - Completed Time
   * Formula: completed === true OR type === 'tracked' OR type === 'completed'
   * 
   * @param event - The calendar event to classify
   * @returns true if event represents completed/tracked time
   */
  static isCompletedTime(event: CalendarEvent): boolean {
    if (event.completed === true) return true;
    if (event.type === 'tracked' || event.type === 'completed') return true;
    return false;
  }

  /**
   * Calculate event duration in hours
   * 
   * @deprecated Use calculateDurationHours from utils/dateCalculations (single source of truth)
   * This method delegates to the canonical implementation.
   * 
   * @param event - The calendar event
   * @returns Duration in hours
   */
  static calculateEventHours(event: CalendarEvent): number {
    return calculateDurationHours(new Date(event.startTime), new Date(event.endTime));
  }

  /**
   * Classify an event (planned vs completed, with hours)
   * 
   * @param event - The calendar event to classify
   * @returns Complete classification of the event
   */
  static classifyEvent(event: CalendarEvent): EventClassification {
    const isPlanned = this.isPlannedTime(event);
    const isCompleted = this.isCompletedTime(event);
    const hours = this.calculateEventHours(event);

    return {
      type: isCompleted ? 'completed' : 'planned',
      hours,
      isPlanned,
      isCompleted
    };
  }

  // ==========================================================================
  // RULE 3: DAY EVENT SUMMARY
  // ==========================================================================

  /**
   * Summarize events on a specific day
   * 
   * Pure domain calculation - no display logic.
   * 
   * @param eventsOnDay - All events for a project on a day
   * @returns Summary of planned and completed hours
   */
  static summarizeDayEvents(eventsOnDay: CalendarEvent[]): DayEventSummary {
    let plannedHours = 0;
    let completedHours = 0;

    eventsOnDay.forEach(event => {
      const classification = this.classifyEvent(event);
      if (classification.isCompleted) {
        completedHours += classification.hours;
      } else if (classification.isPlanned) {
        plannedHours += classification.hours;
      }
    });

    return {
      plannedHours,
      completedHours,
      totalHours: plannedHours + completedHours,
      hasEvents: eventsOnDay.length > 0,
      eventCount: eventsOnDay.length
    };
  }

  // ==========================================================================
  // RULE 4: EVENT DATE HELPERS
  // ==========================================================================

  /**
   * Extract the date an event occurs on (normalized to midnight)
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
   * @param event - The calendar event
   * @returns Date key in format 'YYYY-MM-DD'
   */
  static getEventDateKey(event: CalendarEvent): string {
    const date = new Date(event.startTime);
    return getDateKey(date);
  }

  // ==========================================================================
  // VALIDATION HELPERS
  // ==========================================================================

  /**
   * Validate that event has required fields for calculations
   * 
   * @param event - The event to validate
   * @returns true if event is valid
   */
  static isValidEvent(event: CalendarEvent): boolean {
    return (
      event.startTime !== undefined &&
      event.endTime !== undefined &&
      new Date(event.startTime) < new Date(event.endTime)
    );
  }

  /**
   * Group events by date
   * 
   * @param events - Events to group
   * @returns Map of dateKey -> events on that date
   */
  static groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
    const grouped = new Map<string, CalendarEvent[]>();

    events.forEach(event => {
      if (!this.isValidEvent(event)) return;

      const dateKey = this.getEventDateKey(event);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    });

    return grouped;
  }
}
