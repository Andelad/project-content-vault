/**
 * PhoneNumber Value Object
 * 
 * Represents a validated phone number.
 * Encapsulates phone validation and formatting logic.
 * 
 * Usage:
 * ```typescript
 * const phoneResult = PhoneNumber.create('+1-555-123-4567');
 * if (phoneResult.success) {
 *   const phone = phoneResult.data!;
 *   console.log(phone.value); // '+1-555-123-4567'
 *   console.log(phone.digitsOnly); // '15551234567'
 * }
 * ```
 */

import type { DomainResult } from '@/domain/entities/Project';

export class PhoneNumber {
  private constructor(private readonly _value: string) {}

  // Phone regex from ClientRules (allows +, -, spaces, parentheses)
  private static readonly PHONE_REGEX = /^[\d\s\-\+\(\)]+$/;

  // Factory method with validation
  static create(phone: string | null | undefined): DomainResult<PhoneNumber> {
    // Empty phone is invalid
    if (!phone || phone.trim() === '') {
      return {
        success: false,
        errors: ['Phone number is required'],
      };
    }

    const trimmed = phone.trim();

    // Validate format
    if (!this.PHONE_REGEX.test(trimmed)) {
      return {
        success: false,
        errors: ['Invalid phone number format (only digits, spaces, +, -, parentheses allowed)'],
      };
    }

    // Validate has at least some digits
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      return {
        success: false,
        errors: ['Phone number must contain at least 7 digits'],
      };
    }

    if (digitsOnly.length > 15) {
      return {
        success: false,
        errors: ['Phone number cannot exceed 15 digits'],
      };
    }

    return { success: true, data: new PhoneNumber(trimmed) };
  }

  // Factory method for optional phone (allows null/undefined)
  static createOptional(phone: string | null | undefined): DomainResult<PhoneNumber | null> {
    if (!phone || phone.trim() === '') {
      return { success: true, data: null };
    }

    const result = PhoneNumber.create(phone);
    if (!result.success) {
      return result as DomainResult<PhoneNumber | null>;
    }

    return { success: true, data: result.data! };
  }

  // Getters
  get value(): string {
    return this._value;
  }

  get digitsOnly(): string {
    return this._value.replace(/\D/g, '');
  }

  get hasCountryCode(): boolean {
    return this._value.startsWith('+');
  }

  // Comparison
  equals(other: PhoneNumber): boolean {
    // Compare digits only (ignore formatting)
    return this.digitsOnly === other.digitsOnly;
  }

  // Formatting helpers
  formatInternational(): string {
    const digits = this.digitsOnly;
    if (digits.length === 10) {
      // US format: (555) 123-4567
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      // US with country code: +1 (555) 123-4567
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    // Return original if not standard format
    return this._value;
  }

  // Serialization
  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }
}
