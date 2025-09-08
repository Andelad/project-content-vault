import type { TimeTrackingState, TimeTrackingValidationResult } from '../../types/timeTracking';

/**
 * Time Tracking Validator
 * 
 * Validates time tracking state changes and business rules.
 */
class TimeTrackingValidator {
  
  /**
   * Validates if tracking can be started
   */
  canStartTracking(currentState: TimeTrackingState | null): boolean {
    // Can start if not currently tracking
    return !currentState?.isTracking;
  }

  /**
   * Validates if tracking can be stopped
   */
  canStopTracking(currentState: TimeTrackingState | null): boolean {
    // Can stop if currently tracking
    return currentState?.isTracking === true;
  }

  /**
   * Validates if tracking can be paused
   */
  canPauseTracking(currentState: TimeTrackingState | null): boolean {
    // Can pause if tracking and not already paused
    return currentState?.isTracking === true && currentState?.isPaused === false;
  }

  /**
   * Validates if tracking can be resumed
   */
  canResumeTracking(currentState: TimeTrackingState | null): boolean {
    // Can resume if tracking and currently paused
    return currentState?.isTracking === true && currentState?.isPaused === true;
  }

  /**
   * Validates the state object structure and values
   */
  validateState(state: Partial<TimeTrackingState>): TimeTrackingState {
    const errors: string[] = [];

    // Validate required fields
    if (typeof state.isTracking !== 'boolean') {
      errors.push('isTracking must be a boolean');
    }

    // Validate business rules
    if (state.isTracking === false && state.isPaused === true) {
      errors.push('Cannot be paused when not tracking');
    }

    if (state.isTracking === true && !state.projectId && !state.eventId) {
      // Either projectId or eventId should be set when tracking
      console.warn('Neither projectId nor eventId is set when tracking');
    }

    // Validate time relationships
    if (state.startTime && state.pausedAt && state.startTime > state.pausedAt) {
      errors.push('pausedAt cannot be before startTime');
    }

    if (state.totalPausedDuration && state.totalPausedDuration < 0) {
      errors.push('totalPausedDuration cannot be negative');
    }

    if (errors.length > 0) {
      throw new Error(`Time tracking state validation failed: ${errors.join(', ')}`);
    }

    // Return validated state with defaults
    return {
      isTracking: state.isTracking ?? false,
      isPaused: state.isPaused ?? false,
      projectId: state.projectId ?? null,
      startTime: state.startTime ?? null,
      pausedAt: state.pausedAt ?? null,
      totalPausedDuration: state.totalPausedDuration ?? 0,
      lastUpdateTime: state.lastUpdateTime ?? new Date(),
      
      // Legacy fields for backward compatibility
      currentSeconds: state.currentSeconds,
      eventId: state.eventId,
      selectedProject: state.selectedProject,
      searchQuery: state.searchQuery,
      affectedEvents: state.affectedEvents,
      lastUpdated: state.lastUpdated ?? state.lastUpdateTime ?? new Date()
    };
  }

  /**
   * Validates state change transition
   */
  validateStateTransition(
    fromState: TimeTrackingState | null, 
    toState: Partial<TimeTrackingState>
  ): TimeTrackingValidationResult {
    const errors: string[] = [];

    // If starting tracking
    if (!fromState?.isTracking && toState.isTracking) {
      if (!this.canStartTracking(fromState)) {
        errors.push('Cannot start tracking in current state');
      }
    }

    // If stopping tracking
    if (fromState?.isTracking && toState.isTracking === false) {
      if (!this.canStopTracking(fromState)) {
        errors.push('Cannot stop tracking in current state');
      }
    }

    // If pausing tracking
    if (fromState?.isTracking && !fromState?.isPaused && toState.isPaused) {
      if (!this.canPauseTracking(fromState)) {
        errors.push('Cannot pause tracking in current state');
      }
    }

    // If resuming tracking
    if (fromState?.isPaused && toState.isPaused === false) {
      if (!this.canResumeTracking(fromState)) {
        errors.push('Cannot resume tracking in current state');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates project ID format
   */
  validateProjectId(projectId: string): boolean {
    return typeof projectId === 'string' && projectId.length > 0;
  }

  /**
   * Validates that time values are reasonable
   */
  validateTimeValues(state: TimeTrackingState): boolean {
    const now = new Date();
    const maxReasonableTime = 24 * 60 * 60 * 1000; // 24 hours in ms

    // Start time shouldn't be in the future
    if (state.startTime && state.startTime > now) {
      return false;
    }

    // Paused at shouldn't be in the future
    if (state.pausedAt && state.pausedAt > now) {
      return false;
    }

    // Total paused duration shouldn't be more than 24 hours
    if (state.totalPausedDuration > maxReasonableTime) {
      return false;
    }

    return true;
  }
}

export const timeTrackingValidator = new TimeTrackingValidator();
