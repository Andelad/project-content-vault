/**
 * CalendarEvent Domain Entity
 * 
 * Represents a specific time block for work (planned or completed).
 * Events are defined by HOURS (specific times), not days.
 * 
 * Key Concepts:
 * - Events linked to a project count toward that project's time
 * - Habits and tasks NEVER count toward project time
 * - Events can be recurring (using RRule standard)
 * 
 * This is a RICH DOMAIN MODEL - state + behavior together.
 * 
 * @see docs/core/App Logic.md#7-calendar-event - Entity definition
 * @see docs/core/Business Logic.md - Detailed business rules
 */

import type { CalendarEvent as CalendarEventData } from '@/types/core';
import type { DomainResult } from './Project';

/**
 * Event category types
 */
export type EventCategory = 'event' | 'habit' | 'task';

/**
 * Event type for tracking status
 */
export type EventType = 'planned' | 'tracked' | 'completed';

/**
 * Legacy recurring configuration (use rrule instead for new events)
 */
export interface LegacyRecurringConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  count?: number;
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;
  monthlyWeekOfMonth?: number;
  monthlyDayOfWeek?: number;
}

/**
 * Calendar event creation parameters
 */
export interface CreateCalendarEventParams {
  title: string;
  startTime: Date;
  endTime: Date;
  projectId?: string;
  color: string;
  completed?: boolean;
  description?: string;
  category?: EventCategory;
  rrule?: string; // RFC 5545 RRULE string
  recurring?: LegacyRecurringConfig; // Legacy
  recurringGroupId?: string;
}

/**
 * Calendar event update parameters
 */
export interface UpdateCalendarEventParams {
  title?: string;
  startTime?: Date;
  endTime?: Date;
  projectId?: string;
  color?: string;
  completed?: boolean;
  description?: string;
  category?: EventCategory;
  rrule?: string;
}

/**
 * CalendarEvent Domain Entity
 * 
 * Enforces business invariants and encapsulates calendar event behavior.
 * Cannot be created in an invalid state.
 * 
 * Key Rules:
 * 1. Event must have title
 * 2. End time must be after start time
 * 3. Habits and tasks cannot be linked to projects
 * 4. Tasks have no duration (startTime === endTime)
 */
export class CalendarEvent {
  // Immutable core properties
  private readonly id: string;
  
  // Mutable business properties
  private title: string;
  private startTime: Date;
  private endTime: Date;
  private projectId?: string;
  private color: string;
  private completed: boolean;
  private description?: string;
  private category: EventCategory;
  private type?: EventType;
  private rrule?: string;
  private recurring?: LegacyRecurringConfig;
  private recurringGroupId?: string;
  
  // Midnight-crossing event properties
  private originalEventId?: string;
  private isSplitEvent?: boolean;

  private constructor(data: CalendarEventData) {
    // Direct assignment - validation happens in factory methods
    this.id = data.id;
    this.title = data.title;
    this.startTime = new Date(data.startTime);
    this.endTime = new Date(data.endTime);
    this.projectId = data.projectId;
    this.color = data.color;
    this.completed = data.completed ?? false;
    this.description = data.description;
    this.category = data.category ?? 'event';
    this.type = data.type;
    this.rrule = data.rrule;
    this.recurring = data.recurring;
    this.recurringGroupId = data.recurringGroupId;
    this.originalEventId = data.originalEventId;
    this.isSplitEvent = data.isSplitEvent;
  }

  // ============================================================================
  // FACTORY METHODS - Enforce invariants at creation
  // ============================================================================

  /**
   * Create a new calendar event (not yet persisted)
   * 
   * Validates all business rules before construction.
   * Cannot create an invalid event.
   * 
   * @param params - Calendar event creation parameters
   * @returns Result with event or validation errors
   */
  static create(params: CreateCalendarEventParams): DomainResult<CalendarEvent> {
    const errors: string[] = [];

    // RULE 1: Event must have title
    if (!params.title || params.title.trim().length === 0) {
      errors.push('Event title is required');
    } else if (params.title.trim().length > 200) {
      errors.push('Event title must be 200 characters or less');
    }

    // RULE 2: End time must be after start time (except for tasks)
    const category = params.category ?? 'event';
    if (category !== 'task' && params.endTime <= params.startTime) {
      errors.push('Event end time must be after start time');
    }

    // RULE 3: Habits and tasks cannot be linked to projects
    if ((category === 'habit' || category === 'task') && params.projectId) {
      errors.push(`${category === 'habit' ? 'Habits' : 'Tasks'} cannot be linked to projects`);
    }

    // RULE 4: Tasks must have same start and end time (no duration)
    if (category === 'task' && params.startTime.getTime() !== params.endTime.getTime()) {
      errors.push('Tasks cannot have duration - start and end time must be the same');
    }

    // RULE 5: Color must be valid hex format
    if (!this.isValidColor(params.color)) {
      errors.push('Event color must be a valid hex color (e.g., #FF5733)');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Calculate duration for events
    const duration = category !== 'task' 
      ? (params.endTime.getTime() - params.startTime.getTime()) / (1000 * 60 * 60)
      : 0;

    const eventData: CalendarEventData = {
      id: crypto.randomUUID(),
      title: params.title.trim(),
      startTime: params.startTime,
      endTime: params.endTime,
      projectId: params.projectId,
      color: params.color,
      completed: params.completed ?? false,
      description: params.description?.trim(),
      duration,
      category,
      rrule: params.rrule,
      recurring: params.recurring,
      recurringGroupId: params.recurringGroupId
    };

    return {
      success: true,
      data: new CalendarEvent(eventData)
    };
  }

  /**
   * Reconstitute a calendar event from database data
   * 
   * Use this when loading existing events from the database.
   * Assumes data is already valid (was validated on creation).
   * 
   * @param data - Calendar event data from database
   * @returns CalendarEvent entity
   */
  static fromDatabase(data: CalendarEventData): CalendarEvent {
    return new CalendarEvent(data);
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Validate hex color format
   * 
   * @param color - Color string to validate
   * @returns True if valid hex color
   */
  private static isValidColor(color: string): boolean {
    // Accepts #RGB or #RRGGBB format
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color.trim());
  }

  // ============================================================================
  // BUSINESS OPERATIONS
  // ============================================================================

  /**
   * Update event details
   * 
   * Validates all business rules before applying changes.
   * 
   * @param params - Fields to update
   * @returns Result with updated state or validation errors
   */
  update(params: UpdateCalendarEventParams): DomainResult<void> {
    const errors: string[] = [];

    // Validate title if provided
    if (params.title !== undefined) {
      if (params.title.trim().length === 0) {
        errors.push('Event title is required');
      } else if (params.title.trim().length > 200) {
        errors.push('Event title must be 200 characters or less');
      }
    }

    // Validate time range if either time is provided
    if (params.startTime || params.endTime) {
      const newStart = params.startTime ?? this.startTime;
      const newEnd = params.endTime ?? this.endTime;
      
      if (this.category !== 'task' && newEnd <= newStart) {
        errors.push('Event end time must be after start time');
      }
      
      if (this.category === 'task' && newStart.getTime() !== newEnd.getTime()) {
        errors.push('Tasks cannot have duration - start and end time must be the same');
      }
    }

    // Validate category change
    if (params.category !== undefined) {
      if ((params.category === 'habit' || params.category === 'task') && this.projectId) {
        errors.push(`Cannot change to ${params.category} - event is linked to a project`);
      }
    }

    // Validate project link
    if (params.projectId !== undefined) {
      if ((this.category === 'habit' || this.category === 'task') && params.projectId) {
        errors.push(`${this.category === 'habit' ? 'Habits' : 'Tasks'} cannot be linked to projects`);
      }
    }

    // Validate color if provided
    if (params.color !== undefined && !CalendarEvent.isValidColor(params.color)) {
      errors.push('Event color must be a valid hex color (e.g., #FF5733)');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply updates
    if (params.title !== undefined) this.title = params.title.trim();
    if (params.startTime !== undefined) this.startTime = params.startTime;
    if (params.endTime !== undefined) this.endTime = params.endTime;
    if (params.projectId !== undefined) this.projectId = params.projectId;
    if (params.color !== undefined) this.color = params.color;
    if (params.completed !== undefined) this.completed = params.completed;
    if (params.description !== undefined) this.description = params.description?.trim();
    if (params.category !== undefined) this.category = params.category;
    if (params.rrule !== undefined) this.rrule = params.rrule;

    return { success: true };
  }

  /**
   * Mark event as completed
   */
  markCompleted(): void {
    this.completed = true;
    this.type = 'completed';
  }

  /**
   * Mark event as incomplete
   */
  markIncomplete(): void {
    this.completed = false;
  }

  /**
   * Link event to a project
   * 
   * @param projectId - Project ID to link to
   * @returns Result indicating success or validation errors
   */
  linkToProject(projectId: string): DomainResult<void> {
    if (this.category === 'habit' || this.category === 'task') {
      return {
        success: false,
        errors: [`${this.category === 'habit' ? 'Habits' : 'Tasks'} cannot be linked to projects`]
      };
    }

    this.projectId = projectId;
    return { success: true };
  }

  /**
   * Unlink event from project
   */
  unlinkFromProject(): void {
    this.projectId = undefined;
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Check if event is linked to a project
   */
  isLinkedToProject(): boolean {
    return !!this.projectId;
  }

  /**
   * Check if event counts toward project time
   * Only events (not habits or tasks) count toward project time
   */
  countsTowardProjectTime(): boolean {
    return this.category === 'event' && !!this.projectId;
  }

  /**
   * Check if event is completed
   */
  isCompleted(): boolean {
    return this.completed;
  }

  /**
   * Check if event is a task
   */
  isTask(): boolean {
    return this.category === 'task';
  }

  /**
   * Check if event is a habit
   */
  isHabit(): boolean {
    return this.category === 'habit';
  }

  /**
   * Check if event is recurring
   */
  isRecurring(): boolean {
    return !!(this.rrule || this.recurring);
  }

  /**
   * Get event duration in hours
   */
  getDurationHours(): number {
    if (this.category === 'task') return 0;
    return (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Get event duration in minutes
   */
  getDurationMinutes(): number {
    if (this.category === 'task') return 0;
    return (this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60);
  }

  /**
   * Check if event occurs on a specific date
   * 
   * @param date - Date to check
   * @returns True if event occurs on this date
   */
  occursOnDate(date: Date): boolean {
    const eventDate = new Date(this.startTime);
    return eventDate.toDateString() === date.toDateString();
  }

  /**
   * Check if event crosses midnight
   */
  crossesMidnight(): boolean {
    const startDate = this.startTime.toDateString();
    const endDate = this.endTime.toDateString();
    return startDate !== endDate;
  }

  // ============================================================================
  // DATA CONVERSION - For persistence layer
  // ============================================================================

  /**
   * Convert to plain data object for database persistence
   * 
   * @returns Plain calendar event data object
   */
  toData(): CalendarEventData {
    return {
      id: this.id,
      title: this.title,
      startTime: this.startTime,
      endTime: this.endTime,
      projectId: this.projectId,
      color: this.color,
      completed: this.completed,
      description: this.description,
      duration: this.getDurationHours(),
      type: this.type,
      category: this.category,
      rrule: this.rrule,
      recurring: this.recurring,
      recurringGroupId: this.recurringGroupId,
      originalEventId: this.originalEventId,
      isSplitEvent: this.isSplitEvent
    };
  }

  // ============================================================================
  // GETTERS - Read-only access to properties
  // ============================================================================

  getId(): string { return this.id; }
  getTitle(): string { return this.title; }
  getStartTime(): Date { return this.startTime; }
  getEndTime(): Date { return this.endTime; }
  getProjectId(): string | undefined { return this.projectId; }
  getColor(): string { return this.color; }
  getCompleted(): boolean { return this.completed; }
  getDescription(): string | undefined { return this.description; }
  getCategory(): EventCategory { return this.category; }
  getType(): EventType | undefined { return this.type; }
  getRRule(): string | undefined { return this.rrule; }
  getRecurring(): LegacyRecurringConfig | undefined { return this.recurring; }
  getRecurringGroupId(): string | undefined { return this.recurringGroupId; }
  getOriginalEventId(): string | undefined { return this.originalEventId; }
  getIsSplitEvent(): boolean | undefined { return this.isSplitEvent; }
}
