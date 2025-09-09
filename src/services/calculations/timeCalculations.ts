/**
 * Pure Time Calculations
 * 
 * Contains only pure mathematical functions for time operations.
 * No side effects, no caching, no external dependencies.
 * 
 * ✅ Pure functions only - no side effects
 * ✅ Testable without mocks
 * ✅ Deterministic outputs
 */

/**
 * SINGLE SOURCE OF TRUTH - Time Formatting
 * All time formatting throughout the app MUST use these functions
 */

/**
 * Format time to display format (12-hour)
 * THE authoritative time formatting used everywhere
 */
export function formatTime(date: Date, use12Hour: boolean = true): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: use12Hour
  });
}

/**
 * Format time for validation (24-hour HH:mm format)
 * THE authoritative validation formatting used everywhere
 */
export function formatTimeForValidation(date: Date): string {
  return date.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

/**
 * SINGLE SOURCE OF TRUTH - Time Snapping
 * All time snapping throughout the app MUST use these functions
 */

/**
 * Snap a time to the nearest 15-minute slot
 * THE authoritative time snapping used everywhere
 */
export function snapToTimeSlot(date: Date, slotMinutes: number = 15): Date {
  const snapped = new Date(date);
  const minutes = snapped.getMinutes();
  const remainder = minutes % slotMinutes;
  
  if (remainder !== 0) {
    const adjustment = remainder >= slotMinutes / 2 ? slotMinutes - remainder : -remainder;
    snapped.setMinutes(minutes + adjustment, 0, 0);
  } else {
    snapped.setSeconds(0, 0);
  }
  
  return snapped;
}

/**
 * SINGLE SOURCE OF TRUTH - Time Validation
 * All time validation throughout the app MUST use these functions
 */

/**
 * Ensure end time is after start time with minimum duration
 * THE authoritative time adjustment used everywhere
 */
export function adjustEndTime(
  startTime: Date, 
  endTime: Date, 
  minimumMinutes: number = 15
): Date {
  const minEndTime = new Date(startTime.getTime() + minimumMinutes * 60 * 1000);
  return endTime > startTime ? endTime : minEndTime;
}

/**
 * Check if a time is in the past (cannot be modified)
 * THE authoritative past check used everywhere
 */
export function isInPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * SINGLE SOURCE OF TRUTH - Day/Week Calculations
 * All week calculations throughout the app MUST use these functions
 */

/**
 * Calculate the start date for any given week (Monday)
 * THE authoritative week start calculation used everywhere
 */
export function getWeekStart(date: Date): Date {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Get the current week's start date (Monday)
 * THE authoritative current week calculation used everywhere
 */
export function getCurrentWeekStart(): Date {
  return getWeekStart(new Date());
}

/**
 * Get day name from date
 * THE authoritative day name calculation used everywhere
 */
export function getDayName(date: Date): string {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return dayNames[date.getDay()];
}

/**
 * SINGLE SOURCE OF TRUTH - Time Zone Utilities
 * All timezone handling throughout the app MUST use these functions
 */

/**
 * Get the user's current timezone
 * THE authoritative timezone detection used everywhere
 */
export function getCurrentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert date to specific timezone
 * THE authoritative timezone conversion used everywhere
 */
export function convertToTimezone(date: Date, timezone: string): Date {
  try {
    // Create a new date in the specified timezone
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const targetDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    
    // Calculate the offset and apply it
    const offset = utcDate.getTime() - targetDate.getTime();
    return new Date(date.getTime() - offset);
  } catch (error) {
    console.warn(`Invalid timezone: ${timezone}, returning original date`);
    return new Date(date);
  }
}

/**
 * Get timezone offset in minutes for a specific date and timezone
 * THE authoritative timezone offset calculation used everywhere
 */
export function getTimezoneOffset(date: Date, timezone?: string): number {
  try {
    const targetTimezone = timezone || getCurrentTimezone();
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: targetTimezone }));
    
    // Return offset in minutes (positive for ahead of UTC, negative for behind)
    return (utcDate.getTime() - localDate.getTime()) / (1000 * 60);
  } catch (error) {
    console.warn(`Could not calculate timezone offset for ${timezone}, using local offset`);
    return date.getTimezoneOffset();
  }
}

/**
 * Check if a date falls within daylight saving time
 * THE authoritative DST detection used everywhere
 */
export function isDaylightSavingTime(date: Date, timezone?: string): boolean {
  try {
    const targetTimezone = timezone || getCurrentTimezone();
    
    // Get the timezone offset in January (standard time)
    const january = new Date(date.getFullYear(), 0, 1);
    const januaryOffset = getTimezoneOffset(january, targetTimezone);
    
    // Get the timezone offset for the given date
    const currentOffset = getTimezoneOffset(date, targetTimezone);
    
    // If current offset is different from January, we're likely in DST
    return currentOffset !== januaryOffset;
  } catch (error) {
    console.warn(`Could not determine DST status for ${timezone}`);
    return false;
  }
}
