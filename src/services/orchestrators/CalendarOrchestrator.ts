/**
 * Calendar Orchestrator
 * 
 * Coordinates complex calendar operations involving multiple services, integrations,
 * and workflow management. Handles multi-step calendar workflows that span across
 * event management, work hour integration, external calendar imports, and conflict resolution.
 * 
 * Key Responsibilities:
 * - External calendar import workflows (iCal, Google, Outlook)
 * - Event-work hour overlap resolution and time allocation
 * - Calendar conflict detection and resolution workflows
 * - Event transformation and display coordination
 * - Calendar state synchronization across components
 * 
 * @module CalendarOrchestrator
 */

import type { CalendarEvent, WorkHour, Project, Settings } from '@/types/core';
import { 
  CalendarIntegrationService,
  ExternalEvent,
  ImportResult 
} from '../unified/UnifiedCalendarService';
import { 
  calculateDailyTimeBreakdown,
  getProjectTimeAllocation,
  ProjectTimeAllocation,
  DailyTimeBreakdown 
} from '../unified/UnifiedEventWorkHourService';
import { 
  PlannerV2CalculationService 
} from '../calculations/insights/plannerInsights';
import { 
  processEventOverlaps,
  validateEventForSplit,
  type EventSplitResult 
} from '../validators/eventValidations';
import { EventInput } from '@fullcalendar/core';

// =====================================================================================
// ORCHESTRATOR INTERFACES
// =====================================================================================

export interface CalendarImportWorkflow {
  source: 'ical' | 'google' | 'outlook';
  sourceData: string | File;
  projectId?: string;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  conflictResolution: 'skip' | 'overwrite' | 'merge';
}

export interface CalendarImportResult extends ImportResult {
  conflictsDetected: number;
  conflictsResolved: number;
  workflowId: string;
  recommendations: string[];
}

export interface EventConflictDetection {
  conflictingEvents: Array<{
    event1: CalendarEvent;
    event2: CalendarEvent;
    overlapStart: Date;
    overlapEnd: Date;
    severity: 'minor' | 'major' | 'critical';
  }>;
  workHourConflicts: Array<{
    event: CalendarEvent;
    conflictingWorkHours: WorkHour[];
    overlapDuration: number;
  }>;
  recommendedActions: string[];
}

export interface CalendarDisplayCoordination {
  events: EventInput[];
  layerMode: 'events' | 'work-hours' | 'both';
  conflictHighlights: string[]; // event IDs with conflicts
  timeAllocationData: Map<string, DailyTimeBreakdown>;
}

export interface CalendarSyncState {
  lastSyncTime: Date;
  pendingChanges: number;
  conflictCount: number;
  syncStatus: 'idle' | 'syncing' | 'error' | 'conflicts';
  errorMessages: string[];
}

// =====================================================================================
// CALENDAR ORCHESTRATOR CLASS
// =====================================================================================

export class CalendarOrchestrator {

  // -------------------------------------------------------------------------------------
  // EXTERNAL CALENDAR IMPORT WORKFLOWS
  // -------------------------------------------------------------------------------------

  /**
   * Orchestrate complete external calendar import workflow
   * Handles parsing, conflict detection, resolution, and database import
   */
  static async executeImportWorkflow(
    workflow: CalendarImportWorkflow
  ): Promise<CalendarImportResult> {
    const workflowId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let externalEvents: ExternalEvent[] = [];
    
    try {
      // Step 1: Parse external calendar data
      if (workflow.source === 'ical') {
        const fileContent = typeof workflow.sourceData === 'string' 
          ? workflow.sourceData 
          : await this.readFileContent(workflow.sourceData as File);
        externalEvents = CalendarIntegrationService.parseICalFile(fileContent);
      }
      // TODO: Add Google/Outlook parsing when implemented

      // Step 2: Pre-import conflict detection
      const conflictAnalysis = await this.detectImportConflicts(
        externalEvents, 
        workflow.projectId,
        workflow.dateRangeStart,
        workflow.dateRangeEnd
      );

      // Step 3: Apply conflict resolution strategy
      const resolvedEvents = await this.resolveImportConflicts(
        externalEvents,
        conflictAnalysis,
        workflow.conflictResolution
      );

      // Step 4: Execute database import
      const importResult = await CalendarIntegrationService.importEvents(
        resolvedEvents,
        workflow.projectId,
        workflow.dateRangeStart,
        workflow.dateRangeEnd
      );

      // Step 5: Record import history and generate recommendations
      await CalendarIntegrationService.recordImportHistory(
        `${workflow.source}_file` as any,
        'manual',
        importResult,
        workflow.sourceData instanceof File ? workflow.sourceData.name : undefined,
        undefined,
        workflow.dateRangeStart,
        workflow.dateRangeEnd
      );

      const recommendations = this.generateImportRecommendations(
        importResult,
        conflictAnalysis,
        workflow
      );

      return {
        ...importResult,
        conflictsDetected: conflictAnalysis.conflictingEvents.length + conflictAnalysis.workHourConflicts.length,
        conflictsResolved: externalEvents.length - resolvedEvents.length,
        workflowId,
        recommendations
      };

    } catch (error) {
      console.error(`Calendar import workflow failed [${workflowId}]:`, error);
      return {
        success: false,
        imported: 0,
        updated: 0,
        failed: externalEvents.length,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        conflictsDetected: 0,
        conflictsResolved: 0,
        workflowId,
        recommendations: ['Check calendar file format and try again']
      };
    }
  }

  /**
   * Detect conflicts before importing external events
   */
  private static async detectImportConflicts(
    externalEvents: ExternalEvent[],
    projectId?: string,
    dateRangeStart?: Date,
    dateRangeEnd?: Date
  ): Promise<EventConflictDetection> {
    // TODO: Implement conflict detection logic
    // This would check against existing events and work hours
    return {
      conflictingEvents: [],
      workHourConflicts: [],
      recommendedActions: []
    };
  }

  /**
   * Resolve import conflicts based on strategy
   */
  private static async resolveImportConflicts(
    externalEvents: ExternalEvent[],
    conflictAnalysis: EventConflictDetection,
    resolution: 'skip' | 'overwrite' | 'merge'
  ): Promise<ExternalEvent[]> {
    // TODO: Implement conflict resolution strategies
    return externalEvents; // For now, return all events
  }

  // -------------------------------------------------------------------------------------
  // EVENT-WORK HOUR COORDINATION
  // -------------------------------------------------------------------------------------

  /**
   * Orchestrate comprehensive event-work hour time analysis
   * Coordinates multiple calculation services for complete time breakdown
   */
  static async calculateComprehensiveTimeAnalysis(
    date: Date,
    events: CalendarEvent[],
    workHours: WorkHour[],
    projects: Project[],
    settings: Settings,
    holidays: any[] = []
  ): Promise<{
    dailyBreakdown: DailyTimeBreakdown;
    projectAllocations: Map<string, ProjectTimeAllocation>;
    conflictDetection: EventConflictDetection;
    recommendations: string[];
  }> {
    // Step 1: Calculate daily time breakdown
    const dailyBreakdown = calculateDailyTimeBreakdown(
      date, 
      events, 
      workHours
    );

    // Step 2: Calculate project-specific allocations
    const projectAllocations = new Map<string, ProjectTimeAllocation>();
    for (const project of projects) {
      const allocation = getProjectTimeAllocation(
        project.id,
        date,
        events,
        project,
        settings,
        holidays
      );
      projectAllocations.set(project.id, allocation);
    }

    // Step 3: Detect conflicts and overlaps
    const conflictDetection = await this.detectCalendarConflicts(events, workHours);

    // Step 4: Generate recommendations
    const recommendations = this.generateTimeManagementRecommendations(
      dailyBreakdown,
      projectAllocations,
      conflictDetection
    );

    return {
      dailyBreakdown,
      projectAllocations,
      conflictDetection,
      recommendations
    };
  }

  // -------------------------------------------------------------------------------------
  // CALENDAR DISPLAY COORDINATION
  // -------------------------------------------------------------------------------------

  /**
   * Orchestrate complete calendar display preparation
   * Coordinates event transformation, conflict highlighting, and layer management
   */
  static prepareCalendarDisplay(
    events: CalendarEvent[],
    workHours: WorkHour[],
    projects: Project[],
    displayOptions: {
      layerMode: 'events' | 'work-hours' | 'both';
      selectedEventId?: string | null;
      highlightConflicts?: boolean;
      dateRange?: { start: Date; end: Date };
    }
  ): CalendarDisplayCoordination {
    const { layerMode, selectedEventId, highlightConflicts = false, dateRange } = displayOptions;

    // Step 1: Filter events by date range if specified
    let filteredEvents = events;
    if (dateRange) {
      filteredEvents = PlannerV2CalculationService.filterEventsByDateRange(
        events, 
        dateRange.start, 
        dateRange.end
      );
    }

    // Step 2: Transform to FullCalendar format
    const fcEvents = PlannerV2CalculationService.prepareEventsForFullCalendar(
      filteredEvents,
      workHours,
      layerMode,
      { selectedEventId, projects }
    );

    // Step 3: Detect conflicts for highlighting
    let conflictHighlights: string[] = [];
    if (highlightConflicts) {
      const conflicts = PlannerV2CalculationService.detectEventConflicts(filteredEvents);
      conflictHighlights = conflicts.flatMap(conflict => [
        conflict.event1.id,
        conflict.event2.id
      ]);
    }

    // Step 4: Calculate time allocation data for tooltips/overlays
    const timeAllocationData = new Map<string, DailyTimeBreakdown>();
    // TODO: Calculate daily breakdowns for visible date range

    return {
      events: fcEvents,
      layerMode,
      conflictHighlights,
      timeAllocationData
    };
  }

  // -------------------------------------------------------------------------------------
  // CONFLICT DETECTION & RESOLUTION
  // -------------------------------------------------------------------------------------

  /**
   * Detect all types of calendar conflicts
   */
  static async detectCalendarConflicts(
    events: CalendarEvent[],
    workHours: WorkHour[]
  ): Promise<EventConflictDetection> {
    // Detect event-event conflicts
    const eventConflicts = PlannerV2CalculationService.detectEventConflicts(events);
    
    // Transform to our interface format with severity assessment
    const conflictingEvents = eventConflicts.map(conflict => ({
      ...conflict,
      severity: this.assessConflictSeverity(conflict) as 'minor' | 'major' | 'critical'
    }));

    // TODO: Detect event-work hour conflicts
    const workHourConflicts: any[] = [];

    // Generate recommended actions
    const recommendedActions = this.generateConflictRecommendations(
      conflictingEvents,
      workHourConflicts
    );

    return {
      conflictingEvents,
      workHourConflicts,
      recommendedActions
    };
  }

  // -------------------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------------------

  private static async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private static generateImportRecommendations(
    importResult: ImportResult,
    conflictAnalysis: EventConflictDetection,
    workflow: CalendarImportWorkflow
  ): string[] {
    const recommendations: string[] = [];
    
    if (importResult.failed > 0) {
      recommendations.push('Some events failed to import - check event format and date ranges');
    }
    
    if (conflictAnalysis.conflictingEvents.length > 0) {
      recommendations.push('Calendar conflicts detected - review overlapping events');
    }

    if (importResult.imported > 50) {
      recommendations.push('Large import completed - consider organizing events into projects');
    }

    return recommendations;
  }

  private static generateTimeManagementRecommendations(
    dailyBreakdown: DailyTimeBreakdown,
    projectAllocations: Map<string, ProjectTimeAllocation>,
    conflicts: EventConflictDetection
  ): string[] {
    const recommendations: string[] = [];

    if (dailyBreakdown.overtimeHours > 2) {
      recommendations.push('High overtime detected - consider redistributing work');
    }

    if (conflicts.conflictingEvents.length > 0) {
      recommendations.push('Event conflicts found - resolve scheduling overlaps');
    }

    return recommendations;
  }

  private static assessConflictSeverity(conflict: any): string {
    const overlapDuration = conflict.overlapEnd.getTime() - conflict.overlapStart.getTime();
    const overlapHours = overlapDuration / (1000 * 60 * 60);

    if (overlapHours >= 2) return 'critical';
    if (overlapHours >= 0.5) return 'major';
    return 'minor';
  }

  private static generateConflictRecommendations(
    eventConflicts: any[],
    workHourConflicts: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (eventConflicts.length > 0) {
      recommendations.push('Resolve overlapping events by adjusting times or splitting events');
    }

    if (workHourConflicts.length > 0) {
      recommendations.push('Events extend beyond work hours - consider overtime tracking');
    }

    return recommendations;
  }
}
