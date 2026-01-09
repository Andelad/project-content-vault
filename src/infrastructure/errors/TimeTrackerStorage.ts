/**
 * Time Tracking Local Storage Service
 * 
 * Handles persistence of time tracking state to browser localStorage.
 */

import type { TimeTrackingState } from '@/shared/types/timeTracking';
import { ErrorHandlingService } from './ErrorHandlingService';

const STORAGE_KEYS = {
  isTracking: 'timeTracker_isTracking',
  startTime: 'timeTracker_startTime',
  eventId: 'timeTracker_eventId',
  selectedProject: 'timeTracker_selectedProject',
  searchQuery: 'timeTracker_searchQuery',
  affectedEvents: 'timeTracker_affectedEvents'
} as const;

export interface TrackingState {
  isTracking: boolean;
  startTime?: Date;
  eventId?: string | null;
  selectedProject?: NonNullable<TimeTrackingState['selectedProject']> | null;
  searchQuery?: string;
  affectedEvents?: string[];
}

/**
 * Save tracking state to localStorage
 */
export function saveTrackingState(trackingData: TrackingState): void {
  if (trackingData.isTracking) {
    localStorage.setItem(STORAGE_KEYS.isTracking, 'true');
    if (trackingData.startTime) {
      localStorage.setItem(STORAGE_KEYS.startTime, trackingData.startTime.toISOString());
    }
    if (trackingData.eventId) {
      localStorage.setItem(STORAGE_KEYS.eventId, trackingData.eventId);
    }
    if (trackingData.selectedProject) {
      localStorage.setItem(STORAGE_KEYS.selectedProject, JSON.stringify(trackingData.selectedProject));
    }
    if (trackingData.searchQuery) {
      localStorage.setItem(STORAGE_KEYS.searchQuery, trackingData.searchQuery);
    }
    if (trackingData.affectedEvents) {
      localStorage.setItem(STORAGE_KEYS.affectedEvents, JSON.stringify(trackingData.affectedEvents));
    }
  } else {
    // Clear all tracking data
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
}

/**
 * Load tracking state from localStorage
 */
export function loadTrackingState(): TrackingState | null {
  const savedIsTracking = localStorage.getItem(STORAGE_KEYS.isTracking) === 'true';
  const savedStartTime = localStorage.getItem(STORAGE_KEYS.startTime);
  const savedEventId = localStorage.getItem(STORAGE_KEYS.eventId);
  const savedProject = localStorage.getItem(STORAGE_KEYS.selectedProject);
  const savedQuery = localStorage.getItem(STORAGE_KEYS.searchQuery);
  const savedAffectedEvents = localStorage.getItem(STORAGE_KEYS.affectedEvents);

  if (!savedIsTracking || !savedStartTime || !savedEventId) {
    return null;
  }

  const trackingState: TrackingState = {
    isTracking: true,
    startTime: new Date(savedStartTime),
    eventId: savedEventId,
    searchQuery: savedQuery || '',
    affectedEvents: []
  };

  if (savedProject) {
    try {
      trackingState.selectedProject = JSON.parse(savedProject);
    } catch (e) {
      ErrorHandlingService.handle(e, { source: 'loadTrackingState', action: 'Failed to parse saved project:' });
    }
  }

  if (savedAffectedEvents) {
    try {
      trackingState.affectedEvents = JSON.parse(savedAffectedEvents);
    } catch (e) {
      ErrorHandlingService.handle(e, { source: 'loadTrackingState', action: 'Failed to parse saved affected events:' });
    }
  }

  return trackingState;
}

/**
 * Get storage keys for external access
 */
export function getTimeTrackerStorageKeys() {
  return STORAGE_KEYS;
}
