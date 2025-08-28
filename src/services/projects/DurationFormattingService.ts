/**
 * Duration Formatting Service
 * Handles formatting of time durations and date ranges for project displays
 */

export class DurationFormattingService {
  /**
   * Format a date range as a human-readable duration string
   * @param startDate - Start date of the period
   * @param endDate - End date of the period
   * @returns Formatted duration string (e.g., "2w 3d", "5 days", "3 weeks")
   */
  static formatDuration(startDate: Date, endDate: Date): string {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    const days = diffDays % 7;

    if (weeks === 0) return `${diffDays} days`;
    if (days === 0) return `${weeks} weeks`;
    return `${weeks}w ${days}d`;
  }

  /**
   * Format duration in days only
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of days as string
   */
  static formatDurationInDays(startDate: Date, endDate: Date): string {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} days`;
  }

  /**
   * Format duration in weeks only
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Number of weeks as string
   */
  static formatDurationInWeeks(startDate: Date, endDate: Date): string {
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} weeks`;
  }
}
