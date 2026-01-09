/**
 * Holiday Domain Entity
 * 
 * Represents a date when normal work hours don't apply.
 * Holidays override work slots and affect capacity calculations.
 * 
 * This is a RICH DOMAIN MODEL - state + behavior together.
 * 
 * @see docs/core/App Logic.md#9-holiday - Entity definition
 * @see docs/core/Business Logic.md - Detailed business rules
 */

import type { Holiday as HolidayData } from '@/shared/types/core';
import type { Database } from '@/infrastructure/database/types';
import { normalizeToMidnight } from '@/presentation/utils/dateCalculations';
import type { DomainResult } from './Project';

type HolidayRow = Database['public']['Tables']['holidays']['Row'];

/**
 * Holiday creation parameters
 */
export interface CreateHolidayParams {
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  userId: string;
}

/**
 * Holiday update parameters
 */
export interface UpdateHolidayParams {
  title?: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}

/**
 * Holiday Domain Entity
 * 
 * Enforces business invariants and encapsulates holiday behavior.
 * Cannot be created in an invalid state.
 * 
 * Key Rules:
 * 1. Title is required
 * 2. End date must be on or after start date
 * 3. Holidays override work slots (no capacity on holidays)
 * 4. Can be single day or multiple days
 */
export class Holiday {
  // Immutable core properties
  private readonly _id: string;
  private readonly _userId: string;
  private readonly _createdAt: Date;
  
  // Mutable business properties
  private _title: string;
  private _startDate: Date;
  private _endDate: Date;
  private _notes?: string;
  private _updatedAt: Date;

  // ============================================================================
  // PUBLIC GETTERS - Backward compatibility for migration (Phase 2a)
  // ============================================================================
  
  get id(): string { return this._id; }
  get userId(): string { return this._userId; }
  get title(): string { return this._title; }
  get startDate(): Date { return this._startDate; }
  get endDate(): Date { return this._endDate; }
  get notes(): string | undefined { return this._notes; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }

  private constructor(data: HolidayData & { created_at: string; updated_at: string; user_id: string }) {
    // Direct assignment - validation happens in factory methods
    this._id = data.id;
    this._userId = data.user_id;
    this._title = data.title;
    this._startDate = normalizeToMidnight(new Date(data.startDate));
    this._endDate = normalizeToMidnight(new Date(data.endDate));
    this._notes = data.notes;
    this._createdAt = new Date(data.created_at);
    this._updatedAt = new Date(data.updated_at);
  }

  // ============================================================================
  // FACTORY METHODS - Enforce invariants at creation
  // ============================================================================

  /**
   * Create a new holiday (not yet persisted)
   * 
   * Validates all business rules before construction.
   * Cannot create an invalid holiday.
   * 
   * @param params - Holiday creation parameters
   * @returns Result with holiday or validation errors
   */
  static create(params: CreateHolidayParams): DomainResult<Holiday> {
    const errors: string[] = [];

    // RULE 1: Title is required
    if (!params.title || params.title.trim().length === 0) {
      errors.push('Holiday title is required');
    } else if (params.title.trim().length > 200) {
      errors.push('Holiday title must be 200 characters or less');
    }

    // RULE 2: Dates must be valid
    const normalizedStart = normalizeToMidnight(params.startDate);
    const normalizedEnd = normalizeToMidnight(params.endDate);

    if (isNaN(normalizedStart.getTime())) {
      errors.push('Invalid start date');
    }
    if (isNaN(normalizedEnd.getTime())) {
      errors.push('Invalid end date');
    }

    // RULE 3: End date must be on or after start date
    if (normalizedEnd < normalizedStart) {
      errors.push('Holiday end date must be on or after start date');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const holidayData = {
      id: crypto.randomUUID(),
      title: params.title.trim(),
      startDate: normalizedStart,
      endDate: normalizedEnd,
      notes: params.notes?.trim(),
      user_id: params.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      success: true,
      data: new Holiday(holidayData)
    };
  }

  /**
   * Reconstitute a holiday from database data
   * 
   * Use this when loading existing holidays from the database.
   * Assumes data is already valid (was validated on creation).
   * 
   * @param data - Holiday data from database (snake_case)
   * @returns Holiday entity
   */
  static fromDatabase(data: HolidayRow): Holiday {
    // Convert database format (snake_case) to entity format (mixed for constructor)
    const holidayData: HolidayData & { created_at: string; updated_at: string; user_id: string } = {
      id: data.id,
      title: data.title,
      startDate: new Date(data.start_date),
      endDate: new Date(data.end_date),
      notes: data.notes || undefined,
      created_at: data.created_at,
      updated_at: data.updated_at,
      user_id: data.user_id,
    };
    return new Holiday(holidayData);
  }

  // ============================================================================
  // BUSINESS OPERATIONS
  // ============================================================================

  /**
   * Update holiday details
   * 
   * Validates all business rules before applying changes.
   * 
   * @param params - Fields to update
   * @returns Result with updated state or validation errors
   */
  update(params: UpdateHolidayParams): DomainResult<void> {
    const errors: string[] = [];

    // Validate title if provided
    if (params.title !== undefined) {
      if (params.title.trim().length === 0) {
        errors.push('Holiday title is required');
      } else if (params.title.trim().length > 200) {
        errors.push('Holiday title must be 200 characters or less');
      }
    }

    // Validate date range if either date is provided
    if (params.startDate || params.endDate) {
      const newStart = params.startDate ? normalizeToMidnight(params.startDate) : this._startDate;
      const newEnd = params.endDate ? normalizeToMidnight(params.endDate) : this._endDate;

      if (params.startDate && isNaN(newStart.getTime())) {
        errors.push('Invalid start date');
      }
      if (params.endDate && isNaN(newEnd.getTime())) {
        errors.push('Invalid end date');
      }

      if (newEnd < newStart) {
        errors.push('Holiday end date must be on or after start date');
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Apply updates
    if (params.title !== undefined) this._title = params.title.trim();
    if (params.startDate !== undefined) this._startDate = normalizeToMidnight(params.startDate);
    if (params.endDate !== undefined) this._endDate = normalizeToMidnight(params.endDate);
    if (params.notes !== undefined) this._notes = params.notes?.trim();
    this._updatedAt = new Date();

    return { success: true };
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Check if holiday is a single day
   */
  isSingleDay(): boolean {
    return this._startDate.getTime() === this._endDate.getTime();
  }

  /**
   * Get number of days in holiday
   */
  getDurationDays(): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((this._endDate.getTime() - this._startDate.getTime()) / msPerDay) + 1;
  }

  /**
   * Check if a specific date falls within this holiday
   * 
   * @param date - Date to check
   * @returns True if date is within holiday period
   */
  containsDate(date: Date): boolean {
    const normalized = normalizeToMidnight(date);
    return normalized >= this._startDate && normalized <= this._endDate;
  }

  /**
   * Check if this holiday overlaps with another holiday
   * 
   * @param other - Another holiday to check against
   * @returns True if holidays overlap
   */
  overlaps(other: Holiday): boolean {
    return this._startDate <= other.endDate && this._endDate >= other.startDate;
  }

  /**
   * Check if holiday overlaps with a date range
   * 
   * @param startDate - Range start date
   * @param endDate - Range end date
   * @returns True if holiday overlaps with range
   */
  overlapsDateRange(startDate: Date, endDate: Date): boolean {
    const normalizedStart = normalizeToMidnight(startDate);
    const normalizedEnd = normalizeToMidnight(endDate);
    return this._startDate <= normalizedEnd && this._endDate >= normalizedStart;
  }

  /**
   * Get all dates in this holiday as an array
   * 
   * @returns Array of dates covered by this holiday
   */
  getDates(): Date[] {
    const dates: Date[] = [];
    const current = new Date(this._startDate);
    
    while (current <= this._endDate) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * Get formatted date range for display
   * 
   * @returns String like "Dec 25, 2025" or "Dec 25-27, 2025"
   */
  getDateRangeDisplay(): string {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    
    if (this.isSingleDay()) {
      return this._startDate.toLocaleDateString('en-US', options);
    }
    
    const startStr = this._startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = this._endDate.toLocaleDateString('en-US', options);
    
    return `${startStr} - ${endStr}`;
  }

  /**
   * Check if holiday has notes
   */
  hasNotes(): boolean {
    return !!(this._notes && this._notes.length > 0);
  }

  // ============================================================================
  // DATA CONVERSION - For persistence layer
  // ============================================================================

  /**
   * Convert to plain data object for database persistence
   * 
   * @returns Plain holiday data object
   */
  toData(): HolidayData {
    return {
      id: this._id,
      title: this._title,
      startDate: this._startDate,
      endDate: this._endDate,
      notes: this._notes
    };
  }

  /**
   * Convert to database row format (with snake_case fields)
   * 
   * @returns Database row format
   */
  toDatabaseRow(): {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    notes?: string;
    user_id: string;
    created_at: string;
    updated_at: string;
  } {
    return {
      id: this._id,
      title: this._title,
      start_date: this._startDate.toISOString(),
      end_date: this._endDate.toISOString(),
      notes: this._notes,
      user_id: this._userId,
      created_at: this._createdAt.toISOString(),
      updated_at: this._updatedAt.toISOString()
    };
  }

  // ============================================================================
  // GETTERS - Read-only access to properties
  // ============================================================================

  getId(): string { return this.id; }
  getTitle(): string { return this.title; }
  getStartDate(): Date { return this.startDate; }
  getEndDate(): Date { return this.endDate; }
  getNotes(): string | undefined { return this.notes; }
  getUserId(): string { return this.userId; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }
}
