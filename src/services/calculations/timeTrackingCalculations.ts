import type { TimeTrackingState } from '../../types/timeTracking';
import { calculateDurationMinutes } from './dateCalculations';
import { formatDuration } from './dateCalculations';

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
    return calculateDurationMinutes(startTime, endTime) * 60 * 1000;
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
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
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
