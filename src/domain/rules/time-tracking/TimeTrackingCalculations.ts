import type { TimeTrackingState } from '@/shared/types/timeTracking';
import { calculateDurationHours as calculateDurationHoursCore, formatDuration } from '@/presentation/app/utils/dateCalculations';

/**
 * Time Tracking Calculations
 * 
 * Handles all time-related calculations for time tracking.
 */
class TimeTrackingCalculations {
  
  /**
   * Calculate the duration between two dates in milliseconds
   * Delegates to core date calculations for consistency
   */
  calculateDuration(startTime: Date, endTime: Date): number {
    // Use core calculation and convert to milliseconds
    return calculateDurationHoursCore(startTime, endTime) * 60 * 60 * 1000;
  }

  /**
   * Calculate the duration between two dates in hours
   * Delegates to core date calculations for consistency
   */
  calculateDurationHours(startTime: Date, endTime: Date): number {
    return calculateDurationHoursCore(startTime, endTime);
  }

  /**
   * Calculate elapsed time in seconds from a start time to now
   * Used for real-time timer display in time tracking UI
   * 
   * @param startTime - The start time of the tracking session
   * @param currentTime - Current time (defaults to now)
   * @returns Elapsed time in seconds (floored to whole seconds)
   */
  calculateElapsedSeconds(startTime: Date, currentTime: Date = new Date()): number {
    return Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
  }

  /**
   * Validate that a time segment is valid
   * Used for validating time tracking operations
   * 
   * @param startTime - Start of the time segment
   * @param endTime - End of the time segment (defaults to now)
   * @returns Validation result
   */
  validateTimeSegment(
    startTime: Date | null | undefined,
    endTime: Date = new Date()
  ): {
    isValid: boolean;
    error?: string;
  } {
    if (!startTime) {
      return {
        isValid: false,
        error: 'Start time is required'
      };
    }

    const startDate = new Date(startTime);
    
    if (isNaN(startDate.getTime())) {
      return {
        isValid: false,
        error: 'Invalid start time'
      };
    }

    if (startDate > endTime) {
      return {
        isValid: false,
        error: 'Start time cannot be after end time'
      };
    }

    const maxDuration = 24 * 60 * 60 * 1000; // 24 hours
    if (endTime.getTime() - startDate.getTime() > maxDuration) {
      return {
        isValid: false,
        error: 'Time segment cannot exceed 24 hours'
      };
    }

    return { isValid: true };
  }

  /**
   * Calculate paused duration in milliseconds
   */
  calculatePausedDuration(pausedAt: Date, resumedAt: Date): number {
    return this.calculateDuration(pausedAt, resumedAt);
  }

  /**
   * Calculate total active tracking time (excluding paused time)
   */
  calculateActiveTrackingTime(state: TimeTrackingState, currentTime: Date = new Date()): number {
    if (!state.isTracking || !state.startTime) {
      return 0;
    }

    const totalElapsed = this.calculateDuration(state.startTime, currentTime);
    let totalPaused = state.totalPausedDuration || 0;

    // If currently paused, add current pause duration
    if (state.isPaused && state.pausedAt) {
      totalPaused += this.calculateDuration(state.pausedAt, currentTime);
    }

    return Math.max(0, totalElapsed - totalPaused);
  }

  /**
   * Calculate total tracking time (including paused time)
   */
  calculateTotalTrackingTime(state: TimeTrackingState, currentTime: Date = new Date()): number {
    if (!state.isTracking || !state.startTime) {
      return 0;
    }

    return this.calculateDuration(state.startTime, currentTime);
  }

  /**
   * Format duration in milliseconds to human-readable string
   */
  formatDuration(durationMs: number): string {
    const hours = this.durationToHours(durationMs);
    return formatDuration(hours);
  }

  /**
   * Format duration to hours and minutes only
   * DELEGATES to single source of truth
   */
  formatDurationHoursMinutes(durationMs: number): string {
    const hours = this.durationToHours(durationMs);
    return formatDuration(hours);
  }

  /**
   * Convert duration to hours as decimal
   */
  durationToHours(durationMs: number): number {
    return durationMs / (1000 * 60 * 60);
  }

  /**
   * Convert hours to duration in milliseconds
   */
  hoursToDuration(hours: number): number {
    return hours * 60 * 60 * 1000;
  }

  /**
   * Calculate work session efficiency (active time / total time)
   */
  calculateEfficiency(state: TimeTrackingState, currentTime: Date = new Date()): number {
    const totalTime = this.calculateTotalTrackingTime(state, currentTime);
    const activeTime = this.calculateActiveTrackingTime(state, currentTime);

    if (totalTime === 0) {
      return 1; // 100% efficiency if no time tracked
    }

    return activeTime / totalTime;
  }

  /**
   * Calculate average session length from multiple tracking sessions
   */
  calculateAverageSessionLength(sessions: Array<{ startTime: Date; endTime: Date }>): number {
    if (sessions.length === 0) {
      return 0;
    }

    const totalDuration = sessions.reduce((sum, session) => {
      return sum + this.calculateDuration(session.startTime, session.endTime);
    }, 0);

    return totalDuration / sessions.length;
  }

  /**
   * Calculate time until target hours are reached
   */
  calculateTimeToTarget(
    currentDuration: number, 
    targetDurationMs: number
  ): number {
    return Math.max(0, targetDurationMs - currentDuration);
  }

  /**
   * Check if tracking session is considered "idle" (too long without activity)
   */
  isSessionIdle(
    state: TimeTrackingState, 
    currentTime: Date = new Date(), 
    idleThresholdMs: number = 30 * 60 * 1000 // 30 minutes
  ): boolean {
    if (!state.isTracking || !state.lastUpdateTime) {
      return false;
    }

    const timeSinceUpdate = this.calculateDuration(state.lastUpdateTime, currentTime);
    return timeSinceUpdate > idleThresholdMs;
  }

  /**
   * Calculate percentage of target time completed
   */
  calculateTargetPercentage(currentDuration: number, targetDurationMs: number): number {
    if (targetDurationMs === 0) {
      return 0;
    }

    return Math.min(100, (currentDuration / targetDurationMs) * 100);
  }

  /**
   * Round duration to nearest interval (e.g., 15 minutes)
   */
  roundDurationToInterval(durationMs: number, intervalMs: number): number {
    return Math.round(durationMs / intervalMs) * intervalMs;
  }

  /**
   * Calculate billing time (rounded up to next interval)
   */
  calculateBillingTime(
    durationMs: number, 
    minimumBillableMs: number = 15 * 60 * 1000, // 15 minutes
    roundingIntervalMs: number = 15 * 60 * 1000 // 15 minutes
  ): number {
    const billingDuration = Math.max(durationMs, minimumBillableMs);
    return Math.ceil(billingDuration / roundingIntervalMs) * roundingIntervalMs;
  }
}

export const timeTrackingCalculations = new TimeTrackingCalculations();
