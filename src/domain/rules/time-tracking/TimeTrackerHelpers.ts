/**
 * Time Tracker Business Logic Helpers
 * 
 * RESPONSIBILITIES:
 * - Calculate tracking event data structures
 * - Filter and search project/client results
 * - Handle event overlap logic during time tracking
 * 
 * NOT RESPONSIBLE FOR:
 * - Database operations (orchestrators handle this)
 * - State persistence (infrastructure layer handles this)
 * - Date calculations (calculations layer handles this)
 */

import { CalendarEvent, Project } from '@/types/core';
import { calculateDurationHours } from '@/utils/dateCalculations';
import {
  processEventOverlaps,
  createTimeRange,
  type EventSplitResult
} from '@/domain/rules/events/EventSplitting';
import type { TimeTrackingState } from '@/types/timeTracking';

type SelectedProject = NonNullable<TimeTrackingState['selectedProject']>;

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

/**
 * Calculate elapsed time from start time to now
 */
export function calculateElapsedTime(startTime: Date): { totalSeconds: number; duration: number } {
  const now = new Date();
  const totalSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
  const duration = calculateDurationHours(startTime, now);
  return { totalSeconds, duration };
}

/**
 * Calculate duration between two dates in hours
 */
export function calculateDurationInHours(startTime: Date, endTime: Date): number {
  return calculateDurationHours(startTime, endTime);
}

/**
 * Handle planned event overlaps with tracking event
 * Determines which events need to be deleted, split, or trimmed when tracking time
 */
export function handlePlannedEventOverlaps(
  events: CalendarEvent[],
  trackingStart: Date,
  trackingEnd: Date,
  currentEventId: string | null,
  onDeleteEvent: (eventId: string, options?: { silent?: boolean }) => void,
  onUpdateEvent: (eventId: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => void,
  onAddEvent: (event: Partial<CalendarEvent>) => Promise<CalendarEvent | void | undefined>
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
  
  const splitResults = eventsToProcess.map(event => processEventOverlaps(event, trackingRange));

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
            color: result.newEvent.color || '#3b82f6' // Default blue color
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
export function filterSearchResults(
  projects: Project[], 
  searchQuery: string, 
  clientNameById: Record<string, string> = {}
): SearchResult[] {
  if (!searchQuery.trim()) return [];

  const query = searchQuery.toLowerCase();
  const results: SearchResult[] = [];

  // Search projects with authoritative client name via clientId mapping when available
  projects.forEach(project => {
    const clientName = clientNameById[project.clientId] || project.client;
    const matchesName = project.name?.toLowerCase().includes(query);
    const matchesClient = clientName?.toLowerCase().includes(query) ?? false;
    
    if (matchesName || matchesClient) {
      results.push({
        type: 'project',
        id: project.id,
        name: project.name,
        client: clientName
      });
    }
  });

  // Search unique clients using client map (fall back to project.client strings)
  const uniqueClients = Array.from(new Set(
    projects.map(p => clientNameById[p.clientId] || p.client).filter(Boolean)
  ));
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
export function createTrackingEventData(
  selectedProject: SelectedProject | null,
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
export function createCompletedEventData(
  selectedProject: SelectedProject | null,
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
    completed: true,
    type: 'completed'
  };
}
