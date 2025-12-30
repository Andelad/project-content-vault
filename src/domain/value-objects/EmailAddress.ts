/**
 * EmailAddress Value Object
 * 
 * Represents a validated email address.
 * Encapsulates email validation and formatting logic.
 * 
 * Usage:
 * ```typescript
 * const emailResult = EmailAddress.create('user@example.com');
 * if (emailResult.success) {
 *   const email = emailResult.data!;
 *   console.log(email.value); // 'user@example.com'
 *   console.log(email.domain); // 'example.com'
 * }
 * ```
 */

import type { DomainResult } from '@/domain/entities/Project';

export class EmailAddress {
  private constructor(private readonly _value: string) {}

  // Email regex from ClientRules
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Factory method with validation
  static create(email: string | null | undefined): DomainResult<EmailAddress> {
    // Empty email is valid (optional field)
    if (!email || email.trim() === '') {
      return {
        success: false,
        errors: ['Email address is required'],
      };
    }

    const trimmed = email.trim().toLowerCase();

    // Validate format
    if (!this.EMAIL_REGEX.test(trimmed)) {
      return {
        success: false,
        errors: ['Invalid email address format'],
      };
    }

    // Validate length
    if (trimmed.length > 254) {
      return {
        success: false,
        errors: ['Email address too long (max 254 characters)'],
      };
    }

    return { success: true, data: new EmailAddress(trimmed) };
  }

  // Factory method for optional email (allows null/undefined)
  static createOptional(email: string | null | undefined): DomainResult<EmailAddress | null> {
    if (!email || email.trim() === '') {
      return { success: true, data: null };
    }

    const result = EmailAddress.create(email);
    if (!result.success) {
      return result as DomainResult<EmailAddress | null>;
    }

    return { success: true, data: result.data! };
  }

  // Getters
  get value(): string {
    return this._value;
  }

  get localPart(): string {
    return this._value.split('@')[0];
  }

  get domain(): string {
    return this._value.split('@')[1];
  }

  // Comparison
  equals(other: EmailAddress): boolean {
    return this._value === other._value;
  }

  // Domain checks
  hasDomain(domain: string): boolean {
    return this.domain === domain.toLowerCase();
  }

  isCommonProvider(): boolean {
    const commonDomains = [
      'gmail.com',
      'yahoo.com',
      'outlook.com',
      'hotmail.com',
      'icloud.com',
      'protonmail.com',
    ];
    return commonDomains.includes(this.domain);
  }

  // Serialization
  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }
}
