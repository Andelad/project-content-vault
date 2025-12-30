/**
 * Value Objects
 * 
 * Value Objects represent primitive domain concepts that are:
 * - Immutable
 * - Defined by their value, not identity
 * - Self-validating
 * - Side-effect free
 * 
 * Examples:
 * - DateRange: A range between two dates with validation
 * - EmailAddress: A validated email address
 * - PhoneNumber: A validated phone number
 * - Color: A validated hex color with manipulation methods
 */

export { DateRange } from './DateRange';
export { EmailAddress } from './EmailAddress';
export { PhoneNumber } from './PhoneNumber';
export { Color } from './Color';
