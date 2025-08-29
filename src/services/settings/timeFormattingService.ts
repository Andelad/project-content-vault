/**
 * Time formatting utilities
 * Extracted from various components for consistency and reusability
 */

/**
 * Format seconds into HH:MM:SS format
 */
export function formatTimeSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format minutes into human-readable format (e.g., "2h 30m", "45m")
 */
export function formatTimeMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Format hours into human-readable format with decimal handling
 */
export function formatTimeHours(totalHours: number, precision: number = 1): string {
  if (totalHours < 1) {
    const minutes = Math.round(totalHours * 60);
    return `${minutes}m`;
  }
  
  const roundedHours = Number(totalHours.toFixed(precision));
  if (roundedHours === Math.floor(roundedHours)) {
    return `${Math.floor(roundedHours)}h`;
  }
  
  return `${roundedHours}h`;
}

/**
 * Format decimal hours into hours and minutes format (e.g., 2.5 -> "2h 30m")
 * Used primarily for project time allocation displays
 */
export function formatTimeHoursMinutes(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);

  if (wholeHours === 0 && minutes === 0) {
    return '0h';
  } else if (wholeHours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${wholeHours}h`;
  } else {
    return `${wholeHours}h ${minutes}m`;
  }
}

/**
 * Parse time string (HH:MM or HH:MM:SS) into total seconds
 */
export function parseTimeToSeconds(timeString: string): number {
  const parts = timeString.split(':').map(Number);
  
  if (parts.length === 2) {
    // HH:MM format
    return parts[0] * 3600 + parts[1] * 60;
  } else if (parts.length === 3) {
    // HH:MM:SS format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
}

/**
 * Convert milliseconds to various time units
 */
export function convertMilliseconds(ms: number): {
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
} {
  return {
    seconds: Math.floor(ms / 1000),
    minutes: Math.floor(ms / (1000 * 60)),
    hours: Math.floor(ms / (1000 * 60 * 60)),
    days: Math.floor(ms / (1000 * 60 * 60 * 24))
  };
}

/**
 * Format a time range (start - end)
 */
export function formatTimeRange(startTime: Date, endTime: Date): string {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };
  
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

/**
 * Format relative time (e.g., "2 hours ago", "in 30 minutes")
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  
  if (Math.abs(diffMinutes) < 1) {
    return 'now';
  } else if (Math.abs(diffMinutes) < 60) {
    return diffMinutes > 0 ? `in ${diffMinutes}m` : `${Math.abs(diffMinutes)}m ago`;
  } else {
    const diffHours = Math.round(diffMinutes / 60);
    return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }
}

/**
 * Time formatting constants
 */
export const TIME_FORMAT_CONSTANTS = {
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  MS_PER_SECOND: 1000,
  MS_PER_MINUTE: 1000 * 60,
  MS_PER_HOUR: 1000 * 60 * 60,
  MS_PER_DAY: 1000 * 60 * 60 * 24
} as const;
