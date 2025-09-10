// Time formatting utilities - Single source of truth for time display
export const formatTimeHoursMinutes = (hours: number): string => {
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
};

// Alias for consistency (this is the primary time formatting function)
export const formatDuration = formatTimeHoursMinutes;

// Format duration from minutes to match the hours format
export const formatDurationFromMinutes = (minutes: number): string => {
  return formatTimeHoursMinutes(minutes / 60);
};

// Format duration from hours (alias for the main function)
export const formatDurationFromHours = formatTimeHoursMinutes;

// Format duration preview (alias for consistency)
export const formatDurationPreview = formatTimeHoursMinutes;
