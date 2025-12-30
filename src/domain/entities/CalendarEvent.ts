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
import type { Database } from '@/integrations/supabase/types';
import type { DomainResult } from './Project';

type CalendarEventRow = Database['public']['Tables']['calendar_events']['Row'];

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
  private readonly _id: string;
  
  // Mutable business properties
  private _title: string;
  private _startTime: Date;
  private _endTime: Date;
  private _projectId?: string;
  private _color: string;
  private _completed: boolean;
  private _description?: string;
  private _category: EventCategory;
  private _type?: EventType;
  private _rrule?: string;
  private _recurring?: LegacyRecurringConfig;
  private _recurringGroupId?: string;
  
  // Midnight-crossing event properties
  private _originalEventId?: string;
  private _isSplitEvent?: boolean;

  // ============================================================================
  // PUBLIC GETTERS - Backward compatibility for migration (Phase 2a)
  // ============================================================================
  
  get id(): string { return this._id; }
  get title(): string { return this._title; }
  get startTime(): Date { return this._startTime; }
  get endTime(): Date { return this._endTime; }
  get projectId(): string | undefined { return this._projectId; }
  get color(): string { return this._color; }
  get completed(): boolean { return this._completed; }
  get description(): string | undefined { return this._description; }
  get category(): EventCategory { return this._category; }
  get type(): EventType | undefined { return this._type; }
  get rrule(): string | undefined { return this._rrule; }
  get recurring(): LegacyRecurringConfig | undefined { return this._recurring; }
  get recurringGroupId(): string | undefined { return this._recurringGroupId; }
  get originalEventId(): string | undefined { return this._originalEventId; }
  get isSplitEvent(): boolean | undefined { return this._isSplitEvent; }

  private constructor(data: CalendarEventData) {
    // Direct assignment - validation happens in factory methods
    this._id = data.id;
    this._title = data.title;
    this._startTime = new Date(data.startTime);
    this._endTime = new Date(data.endTime);
    this._projectId = data.projectId;
    this._color = data.color;
    this._completed = data.completed ?? false;
    this._description = data.description;
    this._category = data.category ?? 'event';
    this._type = data.type;
    this._rrule = data.rrule;
    this._recurring = data.recurring;
    this._recurringGroupId = data.recurringGroupId;
    this._originalEventId = data.originalEventId;
    this._isSplitEvent = data.isSplitEvent;
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
   * @param data - Calendar event data from database (snake_case)
   * @returns CalendarEvent entity
   */
  static fromDatabase(data: CalendarEventRow): CalendarEvent {
    // Convert database format (snake_case) to entity format (camelCase)
    // Build recurring config from flat database fields if they exist
    let recurring = undefined;
    if (data.recurring_type) {
      recurring = {
        type: data.recurring_type as 'daily' | 'weekly' | 'monthly' | 'yearly',
        interval: data.recurring_interval || 1,
        endDate: data.recurring_end_date ? new Date(data.recurring_end_date) : undefined,
        count: data.recurring_count || undefined,
      };
    }
    
    const eventData: CalendarEventData = {
      id: data.id,
      title: data.title,
      startTime: new Date(data.start_time),
      endTime: new Date(data.end_time),
      projectId: data.project_id || undefined,
      color: data.color,
      completed: data.completed || undefined,
      description: data.description || undefined,
      duration: data.duration || undefined,
      type: (data.event_type as EventType) || undefined,
      category: (data.category as EventCategory) || undefined,
      rrule: data.rrule || undefined,
      recurring,
      recurringGroupId: data.recurring_group_id || undefined,
    };
    return new CalendarEvent(eventData);
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
      const newStart = params.startTime ?? this._startTime;
      const newEnd = params.endTime ?? this._endTime;
      
      if (this._category !== 'task' && newEnd <= newStart) {
        errors.push('Event end time must be after start time');
      }
      
      if (this._category === 'task' && newStart.getTime() !== newEnd.getTime()) {
        errors.push('Tasks cannot have duration - start and end time must be the same');
      }
    }

    // Validate category change
    if (params.category !== undefined) {
      if ((params.category === 'habit' || params.category === 'task') && this._projectId) {
        errors.push(`Cannot change to ${params.category} - event is linked to a project`);
      }
    }

    // Validate project link
    if (params.projectId !== undefined) {
      if ((this._category === 'habit' || this._category === 'task') && params.projectId) {
        errors.push(`${this._category === 'habit' ? 'Habits' : 'Tasks'} cannot be linked to projects`);
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
    if (params.title !== undefined) this._title = params.title.trim();
    if (params.startTime !== undefined) this._startTime = params.startTime;
    if (params.endTime !== undefined) this._endTime = params.endTime;
    if (params.projectId !== undefined) this._projectId = params.projectId;
    if (params.color !== undefined) this._color = params.color;
    if (params.completed !== undefined) this._completed = params.completed;
    if (params.description !== undefined) this._description = params.description?.trim();
    if (params.category !== undefined) this._category = params.category;
    if (params.rrule !== undefined) this._rrule = params.rrule;

    return { success: true };
  }

  /**
   * Mark event as completed
   */
  markCompleted(): void {
    this._completed = true;
    this._type = 'completed';
  }

  /**
   * Mark event as incomplete
   */
  markIncomplete(): void {
    this._completed = false;
  }

  /**
   * Link event to a project
   * 
   * @param projectId - Project ID to link to
   * @returns Result indicating success or validation errors
   */
  linkToProject(projectId: string): DomainResult<void> {
    if (this._category === 'habit' || this._category === 'task') {
      return {
        success: false,
        errors: [`${this._category === 'habit' ? 'Habits' : 'Tasks'} cannot be linked to projects`]
      };
    }

    this._projectId = projectId;
    return { success: true };
  }

  /**
   * Unlink event from project
   */
  unlinkFromProject(): void {
    this._projectId = undefined;
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Check if event is linked to a project
   */
  isLinkedToProject(): boolean {
    return !!this._projectId;
  }

  /**
   * Check if event counts toward project time
   * Only events (not habits or tasks) count toward project time
   */
  countsTowardProjectTime(): boolean {
    return this._category === 'event' && !!this._projectId;
  }

  /**
   * Check if event is completed
   */
  isCompleted(): boolean {
    return this._completed;
  }

  /**
   * Check if event is a task
   */
  isTask(): boolean {
    return this._category === 'task';
  }

  /**
   * Check if event is a habit
   */
  isHabit(): boolean {
    return this._category === 'habit';
  }

  /**
   * Check if event is recurring
   */
  isRecurring(): boolean {
    return !!(this._rrule || this._recurring);
  }

  /**
   * Get event duration in hours
   */
  getDurationHours(): number {
    if (this._category === 'task') return 0;
    return (this._endTime.getTime() - this._startTime.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Get event duration in minutes
   */
  getDurationMinutes(): number {
    if (this._category === 'task') return 0;
    return (this._endTime.getTime() - this._startTime.getTime()) / (1000 * 60);
  }

  /**
   * Check if event occurs on a specific date
   * 
   * @param date - Date to check
   * @returns True if event occurs on this date
   */
  occursOnDate(date: Date): boolean {
    const eventDate = new Date(this._startTime);
    return eventDate.toDateString() === date.toDateString();
  }

  /**
   * Check if event crosses midnight
   */
  crossesMidnight(): boolean {
    const startDate = this._startTime.toDateString();
    const endDate = this._endTime.toDateString();
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
      id: this._id,
      title: this._title,
      startTime: this._startTime,
      endTime: this._endTime,
      projectId: this._projectId,
      color: this._color,
      completed: this._completed,
      description: this._description,
      duration: this.getDurationHours(),
      type: this._type,
      category: this._category,
      rrule: this._rrule,
      recurring: this._recurring,
      recurringGroupId: this._recurringGroupId,
      originalEventId: this._originalEventId,
      isSplitEvent: this._isSplitEvent
    };
  }

  // ============================================================================
  // GETTERS - Read-only access to properties
  // ============================================================================

  getId(): string { return this._id; }
  getTitle(): string { return this._title; }
  getStartTime(): Date { return this._startTime; }
  getEndTime(): Date { return this._endTime; }
  getProjectId(): string | undefined { return this._projectId; }
  getColor(): string { return this._color; }
  getCompleted(): boolean { return this._completed; }
  getDescription(): string | undefined { return this._description; }
  getCategory(): EventCategory { return this._category; }
  getType(): EventType | undefined { return this._type; }
  getRRule(): string | undefined { return this._rrule; }
  getRecurring(): LegacyRecurringConfig | undefined { return this._recurring; }
  getRecurringGroupId(): string | undefined { return this._recurringGroupId; }
  getOriginalEventId(): string | undefined { return this._originalEventId; }
  getIsSplitEvent(): boolean | undefined { return this._isSplitEvent; }
}
