/**
 * Time Tracker Calculation Service
 *
 * Centralizes a  static calculateActiveTimeSpent(startTime: Date): { totalSeconds: number; duration: number } {
    const now = new Date();
    const totalSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    // ✅ DELEGATE to domain layer instead of manual calculation
    const duration = calculateDurationHours(startTime, now);
    return { totalSeconds, duration };
  }e tracking business logic, calculations, and transformations.
 * Extracted from TimeTracker component to follow architectural pattern of keeping
 * calculations in services rather than components.
 */

import { CalendarEvent } from '@/types/core';
import { calculateDurationHours } from '@/services/calculations/general/dateCalculations';
import {
  processEventOverlaps,
  calculateElapsedTime,
  createTimeRange,
  type EventSplitResult
} from '@/services/calculations/events/eventSplittingCalculations';

export interface TrackingState {
  isTracking: boolean;
  startTime?: Date;
  eventId?: string | null;
  selectedProject?: any;
  searchQuery?: string;
  affectedEvents?: string[];
}

export interface SearchResult {
  type: 'project' | 'client';
  id: string;
  name: string;
  client?: string;
}

export interface TrackingEventData {
  title: string;
  startTime: Date;
  endTime: Date;
  projectId?: string;
  color: string;
  description: string;
  duration: number;
  type: 'tracked' | 'completed';
  completed?: boolean;
}

import { timeTrackingOrchestrator } from '../orchestrators/timeTrackingOrchestrator';
import type { TimeTrackingState } from '../../types/timeTracking';

/**
 * Unified Time Tracker Service
 * 
 * Main API for time tracking functionality following the architecture pattern:
 * Components → Unified Services → Orchestrators → Validators/Calculations/Repositories
 * 
 * This service provides both:
 * - Calculation/transformation methods (static)
 * - Workflow coordination (delegates to orchestrator)
 */
export class UnifiedTimeTrackerService {
  private static readonly STORAGE_KEYS = {
    isTracking: 'timeTracker_isTracking',
    startTime: 'timeTracker_startTime',
    eventId: 'timeTracker_eventId',
    selectedProject: 'timeTracker_selectedProject',
    searchQuery: 'timeTracker_searchQuery',
    affectedEvents: 'timeTracker_affectedEvents'
  };

  // ===================================================================================
  // ORCHESTRATOR DELEGATION METHODS (for workflow coordination)
  // ===================================================================================

  static async startTracking(projectId: string): Promise<void> {
    return timeTrackingOrchestrator.startTracking(projectId);
  }

  static async stopTracking(): Promise<void> {
    return timeTrackingOrchestrator.stopTracking();
  }

  static async pauseTracking(): Promise<void> {
    return timeTrackingOrchestrator.pauseTracking();
  }

  static async resumeTracking(): Promise<void> {
    return timeTrackingOrchestrator.resumeTracking();
  }

  static async loadState(): Promise<TimeTrackingState | null> {
    return timeTrackingOrchestrator.loadState();
  }

  static async syncState(state: Partial<TimeTrackingState>, skipLocalCallback?: boolean): Promise<void> {
    return timeTrackingOrchestrator.syncState(state, skipLocalCallback);
  }

  static async handleTimeTrackingToggle(context: any): Promise<any> {
    return timeTrackingOrchestrator.handleTimeTrackingToggle(context);
  }

  static async loadTrackingStateWorkflow(context: any): Promise<any> {
    return timeTrackingOrchestrator.loadTrackingStateWorkflow(context);
  }

  static setUserId(userId: string): void {
    timeTrackingOrchestrator.setUserId(userId);
  }

  static setOnStateChangeCallback(callback?: (state: TimeTrackingState) => void): void {
    timeTrackingOrchestrator.setOnStateChangeCallback(callback);
  }

  static async setupRealtimeSubscription(): Promise<any> {
    return timeTrackingOrchestrator.setupRealtimeSubscription();
  }

  static cleanup(): void {
    timeTrackingOrchestrator.cleanup();
  }

  /**
   * Check for active tracking session conflicts
   * Returns the active session if found, null otherwise
   */
  static async checkForActiveSession(): Promise<TimeTrackingState | null> {
    return timeTrackingOrchestrator.checkForConflict();
  }

  // ===================================================================================
  // CALCULATION & TRANSFORMATION METHODS (static utilities)
  // ===================================================================================

  /**
   * Calculate elapsed time from start time to now
   */
  static calculateElapsedTime(startTime: Date): { totalSeconds: number; duration: number } {
    const now = new Date();
    const totalSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    // ✅ DELEGATE to domain layer instead of manual calculation
    const duration = calculateDurationHours(startTime, now);
    return { totalSeconds, duration };
  }

  /**
   * Calculate duration between two dates in hours
   */
  static calculateDurationInHours(startTime: Date, endTime: Date): number {
    // ✅ DELEGATE to domain layer - no manual date math!
    return calculateDurationHours(startTime, endTime);
  }

  /**
   * Handle planned event overlaps with tracking event
   */
  static handlePlannedEventOverlaps(
    events: CalendarEvent[],
    trackingStart: Date,
    trackingEnd: Date,
    currentEventId: string | null,
    onDeleteEvent: (eventId: string, options?: { silent?: boolean }) => void,
    onUpdateEvent: (eventId: string, updates: any, options?: any) => void,
    onAddEvent: (event: any) => Promise<any>
  ): string[] {
    const trackingRange = createTimeRange(trackingStart, trackingEnd);
    
    // CRITICAL OPTIMIZATION: Only process planned events in the tracking time window
    const eventsToProcess = events.filter(event => {
      // Skip current tracking event and other tracked events
      if (event.id === currentEventId || event.type === 'tracked' || event.type === 'completed') {
        return false;
      }
      
      // TEMPORAL FILTERING: Only check events that overlap with tracking window
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return eventEnd >= trackingStart && eventStart <= trackingEnd;
    });
    
    // Early exit if no relevant events
    if (eventsToProcess.length === 0) {
      return [];
    }
    
    const splitResults = eventsToProcess.map(event => processEventOverlaps(event as any, trackingRange));

    const newAffectedEvents: string[] = [];

    splitResults.forEach((result: EventSplitResult) => {
      switch (result.action) {
        case 'delete':
          onDeleteEvent(result.originalEvent.id, { silent: true });
          break;

        case 'split':
          // Update the first part
          if (result.updatedEvent) {
            onUpdateEvent(result.originalEvent.id, result.updatedEvent);
          }

          // Create the second part if needed
          if (result.newEvent) {
            onAddEvent({
              ...result.newEvent,
              color: result.newEvent.color || '#3b82f6', // Default blue color
              type: 'planned'
            });
          }
          break;

        case 'trim-start':
        case 'trim-end':
          if (result.updatedEvent) {
            onUpdateEvent(result.originalEvent.id, result.updatedEvent, { silent: true });
            newAffectedEvents.push(result.originalEvent.id);
          }
          break;
      }
    });

    return newAffectedEvents;
  }

  /**
   * Filter projects and clients based on search query
   */
  static filterSearchResults(projects: any[], searchQuery: string): SearchResult[] {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search projects
    projects.forEach(project => {
      const matchesName = project.name.toLowerCase().includes(query);
      const matchesClient = project.client?.toLowerCase().includes(query) ?? false;
      
      if (matchesName || matchesClient) {
        results.push({
          type: 'project',
          id: project.id,
          name: project.name,
          client: project.client
        });
      }
    });

    // Search unique clients (filter out undefined/null clients)
    const uniqueClients = Array.from(new Set(projects.map(p => p.client).filter(Boolean)));
    uniqueClients.forEach(client => {
      if (client && client.toLowerCase().includes(query) &&
          !results.some(r => r.type === 'client' && r.name === client)) {
        results.push({
          type: 'client',
          id: client,
          name: client
        });
      }
    });

    return results.slice(0, 8); // Limit to 8 results
  }

  /**
   * Create tracking event data
   */
  static createTrackingEventData(
    selectedProject: any,
    searchQuery: string,
    startTime: Date
  ): Omit<TrackingEventData, 'id'> {
    const projectName = selectedProject?.name || searchQuery || 'Time Tracking';

    return {
      title: 'Tracked Time',
      startTime,
      endTime: new Date(startTime.getTime() + 60000), // Start with 1 minute
      projectId: selectedProject?.id,
      color: selectedProject?.color || '#DC2626', // Red color for tracking
      description: `🔴 ${projectName}`,
      duration: 0.0167, // 1 minute in hours
      type: 'tracked',
      completed: true // Time being tracked is considered completed by default
    };
  }

  /**
   * Create completed tracking event data
   */
  static createCompletedEventData(
    selectedProject: any,
    searchQuery: string,
    startTime: Date,
    endTime: Date,
    duration: number,
    totalSeconds: number,
    formatTimeFn: (seconds: number) => string
  ): Partial<TrackingEventData> {
    const projectName = selectedProject?.name || searchQuery || 'Time Tracking';

    return {
      endTime,
      duration,
      title: 'Tracked Time',
      description: `🔴 ${projectName} - ${formatTimeFn(totalSeconds)}`,
      completed: true, // Mark as completed
      type: 'completed' // Change type to completed
    };
  }

  /**
   * Save tracking state to localStorage
   */
  static saveTrackingState(trackingData: TrackingState): void {
    if (trackingData.isTracking) {
      localStorage.setItem(this.STORAGE_KEYS.isTracking, 'true');
      if (trackingData.startTime) {
        localStorage.setItem(this.STORAGE_KEYS.startTime, trackingData.startTime.toISOString());
      }
      if (trackingData.eventId) {
        localStorage.setItem(this.STORAGE_KEYS.eventId, trackingData.eventId);
      }
      if (trackingData.selectedProject) {
        localStorage.setItem(this.STORAGE_KEYS.selectedProject, JSON.stringify(trackingData.selectedProject));
      }
      if (trackingData.searchQuery) {
        localStorage.setItem(this.STORAGE_KEYS.searchQuery, trackingData.searchQuery);
      }
      if (trackingData.affectedEvents) {
        localStorage.setItem(this.STORAGE_KEYS.affectedEvents, JSON.stringify(trackingData.affectedEvents));
      }
    } else {
      // Clear all tracking data
      Object.values(this.STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  }

  /**
   * Load tracking state from localStorage
   */
  static loadTrackingState(): TrackingState | null {
    const savedIsTracking = localStorage.getItem(this.STORAGE_KEYS.isTracking) === 'true';
    const savedStartTime = localStorage.getItem(this.STORAGE_KEYS.startTime);
    const savedEventId = localStorage.getItem(this.STORAGE_KEYS.eventId);
    const savedProject = localStorage.getItem(this.STORAGE_KEYS.selectedProject);
    const savedQuery = localStorage.getItem(this.STORAGE_KEYS.searchQuery);
    const savedAffectedEvents = localStorage.getItem(this.STORAGE_KEYS.affectedEvents);

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
        console.error('Failed to parse saved project:', e);
      }
    }

    if (savedAffectedEvents) {
      try {
        trackingState.affectedEvents = JSON.parse(savedAffectedEvents);
      } catch (e) {
        console.error('Failed to parse saved affected events:', e);
      }
    }

    return trackingState;
  }

  /**
   * Get storage keys for external access
   */
  static getStorageKeys() {
    return this.STORAGE_KEYS;
  }
}
