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

import type { Holiday as HolidayData } from '@/types/core';
import { normalizeToMidnight } from '@/services/calculations/general/dateCalculations';
import type { DomainResult } from './Project';

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
  private readonly id: string;
  private readonly userId: string;
  private readonly createdAt: Date;
  
  // Mutable business properties
  private title: string;
  private startDate: Date;
  private endDate: Date;
  private notes?: string;
  private updatedAt: Date;

  private constructor(data: HolidayData & { created_at: string; updated_at: string; user_id: string }) {
    // Direct assignment - validation happens in factory methods
    this.id = data.id;
    this.userId = data.user_id;
    this.title = data.title;
    this.startDate = normalizeToMidnight(new Date(data.startDate));
    this.endDate = normalizeToMidnight(new Date(data.endDate));
    this.notes = data.notes;
    this.createdAt = new Date(data.created_at);
    this.updatedAt = new Date(data.updated_at);
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
   * @param data - Holiday data from database
   * @returns Holiday entity
   */
  static fromDatabase(data: HolidayData & { created_at: string; updated_at: string; user_id: string }): Holiday {
    return new Holiday(data);
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
      const newStart = params.startDate ? normalizeToMidnight(params.startDate) : this.startDate;
      const newEnd = params.endDate ? normalizeToMidnight(params.endDate) : this.endDate;

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
    if (params.title !== undefined) this.title = params.title.trim();
    if (params.startDate !== undefined) this.startDate = normalizeToMidnight(params.startDate);
    if (params.endDate !== undefined) this.endDate = normalizeToMidnight(params.endDate);
    if (params.notes !== undefined) this.notes = params.notes?.trim();
    this.updatedAt = new Date();

    return { success: true };
  }

  // ============================================================================
  // QUERY METHODS - Read current state
  // ============================================================================

  /**
   * Check if holiday is a single day
   */
  isSingleDay(): boolean {
    return this.startDate.getTime() === this.endDate.getTime();
  }

  /**
   * Get number of days in holiday
   */
  getDurationDays(): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((this.endDate.getTime() - this.startDate.getTime()) / msPerDay) + 1;
  }

  /**
   * Check if a specific date falls within this holiday
   * 
   * @param date - Date to check
   * @returns True if date is within holiday period
   */
  containsDate(date: Date): boolean {
    const normalized = normalizeToMidnight(date);
    return normalized >= this.startDate && normalized <= this.endDate;
  }

  /**
   * Check if this holiday overlaps with another holiday
   * 
   * @param other - Another holiday to check against
   * @returns True if holidays overlap
   */
  overlaps(other: Holiday): boolean {
    return this.startDate <= other.endDate && this.endDate >= other.startDate;
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
    return this.startDate <= normalizedEnd && this.endDate >= normalizedStart;
  }

  /**
   * Get all dates in this holiday as an array
   * 
   * @returns Array of dates covered by this holiday
   */
  getDates(): Date[] {
    const dates: Date[] = [];
    const current = new Date(this.startDate);
    
    while (current <= this.endDate) {
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
      return this.startDate.toLocaleDateString('en-US', options);
    }
    
    const startStr = this.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = this.endDate.toLocaleDateString('en-US', options);
    
    return `${startStr} - ${endStr}`;
  }

  /**
   * Check if holiday has notes
   */
  hasNotes(): boolean {
    return !!(this.notes && this.notes.length > 0);
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
      id: this.id,
      title: this.title,
      startDate: this.startDate,
      endDate: this.endDate,
      notes: this.notes
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
      id: this.id,
      title: this.title,
      start_date: this.startDate.toISOString(),
      end_date: this.endDate.toISOString(),
      notes: this.notes,
      user_id: this.userId,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString()
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
