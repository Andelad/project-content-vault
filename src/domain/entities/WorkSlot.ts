/**
 * WorkSlot Domain Entity
 * 
 * Represents a recurring time block when you're available to work on a specific day of the week.
 * Work slots define your weekly work schedule (e.g., "Every Monday 9am-5pm").
 * 
 * This is a RICH DOMAIN MODEL - state + behavior together.
 * 
 * @see docs/core/App Logic.md#8-work-slot - Entity definition
 * @see docs/core/Business Logic.md - Detailed business rules
 */

import type { WorkSlot as WorkSlotData } from '@/types/core';
import type { DomainResult } from './Project';

/**
 * Work slot creation parameters
 */
export interface CreateWorkSlotParams {
  startTime: string; // HH:MM format (e.g., "09:00")
  endTime: string;   // HH:MM format (e.g., "17:00")
}

/**
 * Work slot update parameters
 */
export interface UpdateWorkSlotParams {
  startTime?: string;
  endTime?: string;
}

/**
 * WorkSlot Domain Entity
 * 
 * Enforces business invariants and encapsulates work slot behavior.
 * Cannot be created in an invalid state.
 * 
 * Key Rules:
 * 1. Work slots CANNOT cross midnight (must be within a single day)
 * 2. Start time must be before end time
 * 3. Times must be in valid HH:MM format
 * 4. Duration is calculated automatically (supports 15min increments)
 */
export class WorkSlot {
  // Immutable core properties
  private readonly _id: string;
  
  // Mutable business properties
  private _startTime: string; // HH:MM format
  private _endTime: string;   // HH:MM format
  private _duration: number;  // Hours (calculated)

  // ============================================================================
  // PUBLIC GETTERS - Backward compatibility for migration (Phase 2a)
  // ============================================================================
  
  get id(): string { return this._id; }
  get startTime(): string { return this._startTime; }
  get endTime(): string { return this._endTime; }
  get duration(): number { return this._duration; }

  private constructor(data: WorkSlotData) {
    // Direct assignment - validation happens in factory methods
    this._id = data.id;
    this._startTime = data.startTime;
    this._endTime = data.endTime;
    this._duration = data.duration;
  }

  // ============================================================================
  // FACTORY METHODS - Enforce invariants at creation
  // ============================================================================

  /**
   * Create a new work slot (not yet persisted)
   * 
   * Validates all business rules before construction.
   * Cannot create an invalid work slot.
   * 
   * @param params - Work slot creation parameters
   * @returns Result with work slot or validation errors
   */
  static create(params: CreateWorkSlotParams): DomainResult<WorkSlot> {
    const errors: string[] = [];

    // RULE 1: Times must be in valid HH:MM format
    if (!this.isValidTimeFormat(params.startTime)) {
      errors.push('Start time must be in HH:MM format (e.g., "09:00")');
    }
    if (!this.isValidTimeFormat(params.endTime)) {
      errors.push('End time must be in HH:MM format (e.g., "17:00")');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // RULE 2: Start time must be before end time
    const startMinutes = this.timeToMinutes(params.startTime);
    const endMinutes = this.timeToMinutes(params.endTime);

    if (endMinutes <= startMinutes) {
      errors.push('End time must be after start time');
    }

    // RULE 3: Work slots CANNOT cross midnight
    // (This is implicitly enforced by HH:MM format - times are within 00:00-23:59)
    // Additional check: end time wrapping around (like 23:00 to 01:00) not allowed
    if (endMinutes < startMinutes) {
      errors.push('Work slots cannot cross midnight (must be within a single day)');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Calculate duration in hours
    const duration = (endMinutes - startMinutes) / 60;

    const workSlotData: WorkSlotData = {
      id: crypto.randomUUID(),
      startTime: params.startTime,
      endTime: params.endTime,
      duration
    };

    return {
      success: true,
      data: new WorkSlot(workSlotData)
    };
  }

  /**
   * Reconstitute a work slot from database data
   * 
   * Use this when loading existing work slots from settings.
   * Assumes data is already valid (was validated on creation).
   * 
   * @param data - Work slot data from settings
   * @returns WorkSlot entity
   */
  static fromDatabase(data: WorkSlotData): WorkSlot {
    return new WorkSlot(data);
  }

  // ============================================================================
  // VALIDATION HELPERS
  // ============================================================================

  /**
   * Validate time format (HH:MM)
   * 
   * @param time - Time string to validate
   * @returns True if valid HH:MM format
   */
  private static isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  /**
   * Convert time string to minutes since midnight
   * 
   * @param time - Time in HH:MM format
   * @returns Minutes since midnight
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  // ============================================================================
  // BUSINESS OPERATIONS
  // ============================================================================

  /**
   * Update work slot times
   * 
   * Validates all business rules before applying changes.
   * 
   * @param params - Fields to update
   * @returns Result with updated state or validation errors
   */
  update(params: UpdateWorkSlotParams): DomainResult<void> {
    const errors: string[] = [];

    // Validate time formats
    if (params.startTime !== undefined && !WorkSlot.isValidTimeFormat(params.startTime)) {
      errors.push('Start time must be in HH:MM format (e.g., "09:00")');
    }
    if (params.endTime !== undefined && !WorkSlot.isValidTimeFormat(params.endTime)) {
      errors.push('End time must be in HH:MM format (e.g., "17:00")');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Calculate new times
    const newStart = params.startTime ?? this._startTime;
    const newEnd = params.endTime ?? this._endTime;

    const startMinutes = WorkSlot.timeToMinutes(newStart);
    const endMinutes = WorkSlot.timeToMinutes(newEnd);

    // Validate time range
    if (endMinutes <= startMinutes) {
      errors.push('End time must be after start time');
    }

    if (endMinutes < startMinutes) {
      errors.push('Work slots cannot cross midnight (must be within a single day)');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply updates
    if (params.startTime !== undefined) this._startTime = params.startTime;
    if (params.endTime !== undefined) this._endTime = params.endTime;
    
    // Recalculate duration
    this._duration = (WorkSlot.timeToMinutes(this._endTime) - WorkSlot.timeToMinutes(this._startTime)) / 60;

    return { success: true };
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Get duration in hours
   */
  getDurationHours(): number {
    return this._duration;
  }

  /**
   * Get duration in minutes
   */
  getDurationMinutes(): number {
    return this._duration * 60;
  }

  /**
   * Get formatted time range for display
   * 
   * @returns String like "09:00 - 17:00"
   */
  getTimeRangeDisplay(): string {
    return `${this._startTime} - ${this._endTime}`;
  }

  /**
   * Check if work slot is a full day (8+ hours)
   */
  isFullDay(): boolean {
    return this._duration >= 8;
  }

  /**
   * Check if work slot is a half day (4-7.99 hours)
   */
  isHalfDay(): boolean {
    return this._duration >= 4 && this._duration < 8;
  }

  /**
   * Check if work slot overlaps with another slot
   * 
   * @param other - Another work slot to check against
   * @returns True if slots overlap
   */
  overlaps(other: WorkSlot): boolean {
    const thisStart = WorkSlot.timeToMinutes(this._startTime);
    const thisEnd = WorkSlot.timeToMinutes(this._endTime);
    const otherStart = WorkSlot.timeToMinutes(other.startTime);
    const otherEnd = WorkSlot.timeToMinutes(other.endTime);

    return thisStart < otherEnd && thisEnd > otherStart;
  }

  /**
   * Get start time as Date object for a specific day
   * 
   * @param date - The date to apply this work slot to
   * @returns Date object with start time
   */
  getStartTimeForDate(date: Date): Date {
    const [hours, minutes] = this._startTime.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * Get end time as Date object for a specific day
   * 
   * @param date - The date to apply this work slot to
   * @returns Date object with end time
   */
  getEndTimeForDate(date: Date): Date {
    const [hours, minutes] = this._endTime.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  // ============================================================================
  // DATA CONVERSION - For persistence layer
  // ============================================================================

  /**
   * Convert to plain data object for settings persistence
   * 
   * @returns Plain work slot data object
   */
  toData(): WorkSlotData {
    return {
      id: this._id,
      startTime: this._startTime,
      endTime: this._endTime,
      duration: this._duration
    };
  }

  // ============================================================================
  // GETTERS - Read-only access to properties
  // ============================================================================

  getId(): string { return this.id; }
  getStartTime(): string { return this.startTime; }
  getEndTime(): string { return this.endTime; }
  getDuration(): number { return this.duration; }
}
