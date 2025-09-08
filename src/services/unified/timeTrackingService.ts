import { timeTrackingOrchestrator } from '../orchestrators/timeTrackingOrchestrator';
import type { TimeTrackingState } from '../../types/timeTracking';

/**
 * Unified Time Tracking Service
 * 
 * This is the main interface for time tracking functionality.
 * It delegates to the orchestrator for complex operations.
 */
export class TimeTrackingService {
  private static instance: TimeTrackingService;

  private constructor() {}

  static getInstance(): TimeTrackingService {
    if (!this.instance) {
      this.instance = new TimeTrackingService();
    }
    return this.instance;
  }

  // Delegate to orchestrator
  async startTracking(projectId: string): Promise<void> {
    return timeTrackingOrchestrator.startTracking(projectId);
  }

  async stopTracking(): Promise<void> {
    return timeTrackingOrchestrator.stopTracking();
  }

  async pauseTracking(): Promise<void> {
    return timeTrackingOrchestrator.pauseTracking();
  }

  async resumeTracking(): Promise<void> {
    return timeTrackingOrchestrator.resumeTracking();
  }

  async loadState(): Promise<TimeTrackingState | null> {
    return timeTrackingOrchestrator.loadState();
  }

  async syncState(state: Partial<TimeTrackingState>): Promise<void> {
    return timeTrackingOrchestrator.syncState(state);
  }

  setUserId(userId: string): void {
    timeTrackingOrchestrator.setUserId(userId);
  }

  setOnStateChangeCallback(callback?: (state: TimeTrackingState) => void): void {
    timeTrackingOrchestrator.setOnStateChangeCallback(callback);
  }

  async setupRealtimeSubscription(): Promise<any> {
    return timeTrackingOrchestrator.setupRealtimeSubscription();
  }

  cleanup(): void {
    timeTrackingOrchestrator.cleanup();
  }
}

export const timeTrackingService = TimeTrackingService.getInstance();
