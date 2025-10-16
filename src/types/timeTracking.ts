/**
 * Time Tracking State Interface
 * 
 * Represents the current state of time tracking across the application.
 * Maintains backward compatibility with existing UI components.
 */
export interface TimeTrackingState {
  // Core tracking state
  isTracking: boolean;
  isPaused?: boolean;
  projectId?: string | null;
  startTime?: Date | null;
  pausedAt?: Date | null;
  totalPausedDuration?: number; // in milliseconds
  lastUpdateTime?: Date | null;
  
  // Legacy fields for backward compatibility with existing components
  currentSeconds?: number;
  eventId?: string | null;
  selectedProject?: any;
  searchQuery?: string;
  affectedEvents?: string[];
  lastUpdated?: Date; // Legacy field name
}

/**
 * Serialized version of TimeTrackingState for storage/transmission
 */
export interface SerializedTimeTrackingState {
  isTracking: boolean;
  isPaused: boolean;
  projectId: string | null;
  startTime: string | null; // ISO string
  pausedAt: string | null; // ISO string
  totalPausedDuration: number;
  lastUpdateTime: string | null; // ISO string
  
  // UI state fields for persistence across views
  eventId?: string | null;
  selectedProject?: any;
  searchQuery?: string;
  affectedEvents?: string[];
  currentSeconds?: number;
}

/**
 * Time tracking validation result
 */
export interface TimeTrackingValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Cross-window message types for time tracking sync
 */
export interface TimeTrackingSyncMessage {
  type: 'TIME_TRACKING_STATE_UPDATED';
  state: SerializedTimeTrackingState;
  timestamp: number;
}

/**
 * Time tracking operation types
 */
export type TimeTrackingOperation = 'start' | 'stop' | 'pause' | 'resume';

/**
 * Time tracking event callback type
 */
export type TimeTrackingStateChangeCallback = (state: TimeTrackingState) => void;
