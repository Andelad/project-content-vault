import { timeTrackingRepository } from '../repositories/timeTrackingRepository';
import { timeTrackingValidator } from '../validators/timeTrackingValidator';
import { timeTrackingCalculations } from '../calculations/timeTrackingCalculations';
import type { TimeTrackingState } from '../../types/timeTracking';

/**
 * Time Tracking Orchestrator
 * 
 * Coordinates between validation, calculations, and repository operations.
 * Handles cross-window synchronization and state management.
 */
class TimeTrackingOrchestrator {
  private userId: string | null = null;
  private onStateChangeCallback?: (state: TimeTrackingState) => void;
  private broadcastChannel?: BroadcastChannel;
  private realtimeSubscription?: any;

  constructor() {
    this.initializeCrossWindowSync();
  }

  private initializeCrossWindowSync(): void {
    // Try to use BroadcastChannel for modern browsers
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('timeTracker_crossWindowSync');
      this.broadcastChannel.addEventListener('message', (event) => {
        this.handleCrossWindowMessage(event.data);
      });
    }

    // Fallback to localStorage events for older browsers
    window.addEventListener('storage', (event) => {
      if (event.key === 'timeTracker_crossWindowSync' && event.newValue) {
        try {
          const state = JSON.parse(event.newValue);
          this.handleCrossWindowMessage(state);
        } catch (error) {
          console.error('Error parsing cross-window sync message:', error);
        }
      }
    });
  }

  private handleCrossWindowMessage(data: any): void {
    if (data.type === 'TIME_TRACKING_STATE_UPDATED' && data.state) {
      const deserializedState = this.deserializeState(data.state);
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(deserializedState);
      }
    }
  }

  private broadcastStateChange(state: TimeTrackingState): void {
    const serializedState = this.serializeState(state);
    const message = {
      type: 'TIME_TRACKING_STATE_UPDATED',
      state: serializedState,
      timestamp: Date.now()
    };

    // Use BroadcastChannel if available
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage(message);
    }

    // Also use localStorage as fallback
    localStorage.setItem('timeTracker_crossWindowSync', JSON.stringify(message));
  }

  private serializeState(state: TimeTrackingState): any {
    return {
      ...state,
      startTime: state.startTime?.toISOString(),
      pausedAt: state.pausedAt?.toISOString(),
      lastUpdateTime: state.lastUpdateTime?.toISOString()
    };
  }

  private deserializeState(serializedState: any): TimeTrackingState {
    return {
      ...serializedState,
      startTime: serializedState.startTime ? new Date(serializedState.startTime) : null,
      pausedAt: serializedState.pausedAt ? new Date(serializedState.pausedAt) : null,
      lastUpdateTime: serializedState.lastUpdateTime ? new Date(serializedState.lastUpdateTime) : null
    };
  }

  setUserId(userId: string): void {
    this.userId = userId;
    timeTrackingRepository.setUserId(userId);
  }

  setOnStateChangeCallback(callback?: (state: TimeTrackingState) => void): void {
    this.onStateChangeCallback = callback;
  }

  async startTracking(projectId: string): Promise<void> {
    const currentState = await this.loadState();
    
    if (!timeTrackingValidator.canStartTracking(currentState)) {
      throw new Error('Cannot start tracking in current state');
    }

    const newState: TimeTrackingState = {
      isTracking: true,
      isPaused: false,
      projectId,
      startTime: new Date(),
      pausedAt: null,
      totalPausedDuration: currentState?.totalPausedDuration || 0,
      lastUpdateTime: new Date()
    };

    await this.syncState(newState);
  }

  async stopTracking(): Promise<void> {
    const currentState = await this.loadState();
    
    if (!timeTrackingValidator.canStopTracking(currentState)) {
      throw new Error('Cannot stop tracking - no active session');
    }

    const newState: TimeTrackingState = {
      isTracking: false,
      isPaused: false,
      projectId: null,
      startTime: null,
      pausedAt: null,
      totalPausedDuration: 0,
      lastUpdateTime: new Date()
    };

    await this.syncState(newState);
  }

  async pauseTracking(): Promise<void> {
    const currentState = await this.loadState();
    
    if (!timeTrackingValidator.canPauseTracking(currentState)) {
      throw new Error('Cannot pause tracking in current state');
    }

    const newState: TimeTrackingState = {
      ...currentState!,
      isPaused: true,
      pausedAt: new Date(),
      lastUpdateTime: new Date()
    };

    await this.syncState(newState);
  }

  async resumeTracking(): Promise<void> {
    const currentState = await this.loadState();
    
    if (!timeTrackingValidator.canResumeTracking(currentState)) {
      throw new Error('Cannot resume tracking in current state');
    }

    const pausedDuration = currentState!.pausedAt ? 
      timeTrackingCalculations.calculatePausedDuration(currentState!.pausedAt, new Date()) : 0;

    const newState: TimeTrackingState = {
      ...currentState!,
      isPaused: false,
      pausedAt: null,
      totalPausedDuration: (currentState!.totalPausedDuration || 0) + pausedDuration,
      lastUpdateTime: new Date()
    };

    await this.syncState(newState);
  }

  async loadState(): Promise<TimeTrackingState | null> {
    return timeTrackingRepository.loadState();
  }

  async syncState(state: Partial<TimeTrackingState>): Promise<void> {
    const validatedState = timeTrackingValidator.validateState(state);
    
    // Save to database
    await timeTrackingRepository.saveState(validatedState);
    
    // Broadcast to other windows
    this.broadcastStateChange(validatedState);
    
    // Trigger local callback
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(validatedState);
    }
  }

  async setupRealtimeSubscription(): Promise<any> {
    if (!this.userId) {
      throw new Error('User ID must be set before setting up realtime subscription');
    }

    this.realtimeSubscription = await timeTrackingRepository.setupRealtimeSubscription((state) => {
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback(state);
      }
      this.broadcastStateChange(state);
    });

    return this.realtimeSubscription;
  }

  cleanup(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    if (this.realtimeSubscription) {
      timeTrackingRepository.cleanupRealtimeSubscription(this.realtimeSubscription);
    }
  }
}

export const timeTrackingOrchestrator = new TimeTrackingOrchestrator();
