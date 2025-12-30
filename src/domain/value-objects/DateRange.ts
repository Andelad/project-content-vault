/**
 * DateRange Value Object
 * 
 * Represents an immutable date range with start and end dates.
 * Encapsulates validation, comparison, and date range logic.
 * 
 * Usage:
 * ```typescript
 * const rangeResult = DateRange.create(startDate, endDate);
 * if (rangeResult.success) {
 *   const range = rangeResult.data!;
 *   const days = range.getDurationInDays();
 *   const overlaps = range.overlaps(otherRange);
 * }
 * ```
 */

import type { DomainResult } from '@/domain/entities/Project';

export class DateRange {
  private constructor(
    private readonly _start: Date,
    private readonly _end: Date
  ) {}

  // Factory method with validation
  static create(start: Date | string, end: Date | string): DomainResult<DateRange> {
    const errors: string[] = [];

    // Convert to Date objects
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;

    // Validate dates
    if (isNaN(startDate.getTime())) {
      errors.push('Invalid start date');
    }
    if (isNaN(endDate.getTime())) {
      errors.push('Invalid end date');
    }

    // Business rule: end must be after start
    if (startDate >= endDate) {
      errors.push('End date must be after start date');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: new DateRange(startDate, endDate) };
  }

  // Getters
  get start(): Date {
    return new Date(this._start); // Return copy for immutability
  }

  get end(): Date {
    return new Date(this._end); // Return copy for immutability
  }

  // Duration calculations
  getDurationInDays(): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((this._end.getTime() - this._start.getTime()) / msPerDay);
  }

  getDurationInWeeks(): number {
    return Math.ceil(this.getDurationInDays() / 7);
  }

  getDurationInMonths(): number {
    const months =
      (this._end.getFullYear() - this._start.getFullYear()) * 12 +
      (this._end.getMonth() - this._start.getMonth());
    return months;
  }

  // Comparison methods
  contains(date: Date): boolean {
    return date >= this._start && date <= this._end;
  }

  overlaps(other: DateRange): boolean {
    return this._start <= other._end && this._end >= other._start;
  }

  equals(other: DateRange): boolean {
    return (
      this._start.getTime() === other._start.getTime() &&
      this._end.getTime() === other._end.getTime()
    );
  }

  isBefore(other: DateRange): boolean {
    return this._end < other._start;
  }

  isAfter(other: DateRange): boolean {
    return this._start > other._end;
  }

  // Check if range is within another range
  isWithin(other: DateRange): boolean {
    return this._start >= other._start && this._end <= other._end;
  }

  // Transformation methods
  extend(days: number): DomainResult<DateRange> {
    const newEnd = new Date(this._end);
    newEnd.setDate(newEnd.getDate() + days);
    return DateRange.create(this._start, newEnd);
  }

  shift(days: number): DomainResult<DateRange> {
    const newStart = new Date(this._start);
    const newEnd = new Date(this._end);
    newStart.setDate(newStart.getDate() + days);
    newEnd.setDate(newEnd.getDate() + days);
    return DateRange.create(newStart, newEnd);
  }

  // Serialization
  toJSON(): { start: string; end: string } {
    return {
      start: this._start.toISOString(),
      end: this._end.toISOString(),
    };
  }

  toString(): string {
    return `${this._start.toISOString().split('T')[0]} to ${this._end.toISOString().split('T')[0]}`;
  }

  // Validation helpers for common business rules
  static validateNotInPast(range: DateRange): DomainResult<void> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (range._start < now) {
      return {
        success: false,
        errors: ['Start date cannot be in the past'],
      };
    }

    return { success: true };
  }

  static validateMaxDuration(range: DateRange, maxDays: number): DomainResult<void> {
    if (range.getDurationInDays() > maxDays) {
      return {
        success: false,
        errors: [`Duration cannot exceed ${maxDays} days`],
      };
    }

    return { success: true };
  }

  static validateMinDuration(range: DateRange, minDays: number): DomainResult<void> {
    if (range.getDurationInDays() < minDays) {
      return {
        success: false,
        errors: [`Duration must be at least ${minDays} days`],
      };
    }

    return { success: true };
  }
}
