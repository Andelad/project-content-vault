/**
 * Work Hour Orchestrator
 * 
 * Coordinates complex work hour management workflows involving time tracking,
 * event integration, drag-and-drop interactions, and work schedule management.
 * Handles multi-step workflows that span across work hour creation, modification,
 * validation, and integration with calendar events.
 * 
 * Key Responsibilities:
 * - Work hour creation and modification workflows
 * - Drag-and-drop time tracking coordination  
 * - Work hour-event integration and conflict resolution
 * - Time tracker state management and validation
 * - Work schedule validation and optimization
 * 
 * @module WorkHourOrchestrator
 */

import type { WorkHour, CalendarEvent, Project, Settings } from '@/types/core';
import {
  handleWorkHourCreationMove,
  validateWorkHour,
  calculateTimeFromPosition
} from '../calculations/workHourCalculations';
import {
  TimeTrackerCalculationService
} from '../unified/UnifiedTimeTrackerService';
import {
  processEventOverlaps,
  validateEventForSplit,
  type EventSplitResult
} from '../validators/eventValidations';
import { workHourRepository } from '../repositories/WorkHourRepository';

// =====================================================================================
// ORCHESTRATOR INTERFACES
// =====================================================================================

export interface WorkHourCreationWorkflow {
  startPosition: { clientY: number; containerElement: HTMLElement };
  date: Date;
  startTime: Date;
  projectId?: string;
  validationRules: {
    enforceWorkingHours?: boolean;
    allowOverlapping?: boolean;
    maxDuration?: number; // hours
    minDuration?: number; // hours
  };
}

export interface WorkHourCreationResult {
  success: boolean;
  workHour?: WorkHour;
  validationErrors: string[];
  warnings: string[];
  recommendations: string[];
  conflictingEvents?: CalendarEvent[];
}

// Simplified time tracking interfaces
export interface SimpleTimeTrackingSession {
  id: string;
  projectId?: string;
  startTime: Date;
  endTime?: Date;
  description?: string;
  isActive: boolean;
}

export interface SimpleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TimeTrackingWorkflow {
  mode: 'start' | 'stop' | 'pause' | 'resume';
  projectId?: string;
  eventId?: string;
  startTime?: Date;
  endTime?: Date;
  description?: string;
  integrationOptions: {
    createCalendarEvent?: boolean;
    updateExistingEvent?: boolean;
    handleOverlaps?: 'split' | 'merge' | 'ignore';
  };
}

export interface TimeTrackingResult {
  success: boolean;
  session?: SimpleTimeTrackingSession;
  createdWorkHour?: WorkHour;
  createdEvent?: CalendarEvent;
  modifiedEvents?: { eventId: string; modifications: Partial<CalendarEvent> }[];
  validationResults: SimpleValidationResult[];
  recommendations: string[];
}

export interface WorkHourDragWorkflow {
  workHourId: string;
  dragOperation: 'move' | 'resize-start' | 'resize-end' | 'duplicate';
  targetDate: Date;
  targetPosition: { clientY: number; containerElement: HTMLElement };
  validationContext: {
    existingWorkHours: WorkHour[];
    existingEvents: CalendarEvent[];
    workingHourLimits?: { start: Date; end: Date };
  };
}

export interface WorkHourDragResult {
  success: boolean;
  modifiedWorkHour?: WorkHour;
  createdWorkHour?: WorkHour; // for duplicate operation
  validationErrors: string[];
  conflictResolution?: {
    conflictingItems: Array<WorkHour | CalendarEvent>;
    recommendedActions: string[];
    autoResolved: boolean;
  };
}

export interface WorkScheduleOptimization {
  currentWorkHours: WorkHour[];
  targetEfficiency: number; // 0-1 scale
  preferences: {
    preferredWorkBlocks?: number; // hours per block
    maxDailyHours?: number;
    breakMinimums?: number; // minutes between blocks
    projectPriorities?: Map<string, number>;
  };
}

export interface WorkScheduleOptimizationResult {
  optimizedSchedule: WorkHour[];
  efficiencyGain: number;
  timesSaved: number; // hours
  recommendations: string[];
  implementationSteps: string[];
}

// =====================================================================================
// WORK HOUR ORCHESTRATOR CLASS
// =====================================================================================

export class WorkHourOrchestrator {

  // -------------------------------------------------------------------------------------
  // WORK HOUR CREATION WORKFLOWS
  // -------------------------------------------------------------------------------------

  /**
   * Orchestrate complete work hour creation workflow
   * Handles validation, conflict detection, and integration with events
   */
  static async executeWorkHourCreation(
    workflow: WorkHourCreationWorkflow
  ): Promise<WorkHourCreationResult> {
    const { startPosition, date, startTime, projectId, validationRules } = workflow;
    const { clientY, containerElement } = startPosition;

    try {
      // Step 1: Calculate end time based on drag position
      const dragResult = handleWorkHourCreationMove(clientY, containerElement, date, startTime);
      
      // Step 2: Create proposed work hour object  
      const proposedWorkHour: Omit<WorkHour, 'id'> = {
        title: projectId ? `Work: ${projectId}` : 'Work Session',
        description: `Work session${projectId ? ` for ${projectId}` : ''}`,
        startTime: startTime,
        endTime: dragResult.endTime,
        duration: dragResult.duration,
        type: 'work'
      };

      // Step 3: Validate work hour creation
      const validation = validateWorkHour(proposedWorkHour);

      if (!validation.isValid) {
        return {
          success: false,
          validationErrors: validation.errors,
          warnings: [],
          recommendations: this.generateCreationRecommendations(validation),
        };
      }

      // Step 4: Check for conflicts with existing events
      // TODO: Implement conflict detection with existing work hours and events
      const conflictingEvents: CalendarEvent[] = [];

      // Step 5: Generate recommendations
      const recommendations = this.generateWorkHourRecommendations(
        proposedWorkHour,
        conflictingEvents,
        validationRules
      );

      return {
        success: true,
        workHour: {
          ...proposedWorkHour,
          id: this.generateWorkHourId()
        } as WorkHour,
        validationErrors: [],
        warnings: [],
        recommendations,
        conflictingEvents: conflictingEvents.length > 0 ? conflictingEvents : undefined
      };

    } catch (error) {
      return {
        success: false,
        validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        recommendations: ['Try creating the work hour again with different parameters']
      };
    }
  }

  // -------------------------------------------------------------------------------------
  // TIME TRACKING WORKFLOWS
  // -------------------------------------------------------------------------------------

  /**
   * Orchestrate comprehensive time tracking workflows
   * Coordinates tracking start/stop with event creation and validation
   */
  static async executeTimeTrackingWorkflow(
    workflow: TimeTrackingWorkflow,
    currentEvents: CalendarEvent[] = [],
    currentWorkHours: WorkHour[] = []
  ): Promise<TimeTrackingResult> {
    const { mode, projectId, eventId, startTime, endTime, description, integrationOptions } = workflow;

    try {
      let session: SimpleTimeTrackingSession | undefined;
      let createdWorkHour: WorkHour | undefined;
      let createdEvent: CalendarEvent | undefined;
      let modifiedEvents: { eventId: string; modifications: Partial<CalendarEvent> }[] = [];
      let validationResults: SimpleValidationResult[] = [];

      if (mode === 'start') {
        // Create simple time tracking session
        session = {
          id: this.generateWorkHourId(), // Reuse the existing method
          projectId,
          startTime: startTime || new Date(),
          description,
          isActive: true
        };
        
        validationResults = [{
          isValid: true,
          errors: [],
          warnings: []
        }];

        // Create calendar event if requested
        if (integrationOptions.createCalendarEvent && projectId) {
          createdEvent = {
            id: this.generateEventId(),
            title: `Work: ${projectId}`,
            startTime: startTime || new Date(),
            endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // Default 2 hours
            projectId,
            color: '#10b981', // Green for tracking
            completed: false,
            description: description || 'Time tracking session',
            type: 'tracked'
          } as CalendarEvent;
        }

      } else if (mode === 'stop' && eventId) {
        // Create session from stop operation
        session = {
          id: eventId,
          projectId,
          startTime: startTime || new Date(),
          endTime: endTime || new Date(),
          description,
          isActive: false
        };

        validationResults = [{
          isValid: true,
          errors: [],
          warnings: []
        }];

        // Create work hour from completed session
        if (session.startTime && session.endTime) {
          createdWorkHour = {
            id: this.generateWorkHourId(),
            title: projectId ? `Work: ${projectId}` : 'Work Session',
            description: description || 'Tracked time',
            startTime: session.startTime,
            endTime: session.endTime,
            duration: (session.endTime.getTime() - session.startTime.getTime()) / (1000 * 60 * 60),
            type: 'work'
          } as WorkHour;

          // Handle event overlaps if required
          if (integrationOptions.handleOverlaps !== 'ignore') {
            const overlapResults = this.handleTimeTrackingOverlaps(
              createdWorkHour,
              currentEvents,
              integrationOptions.handleOverlaps
            );
            modifiedEvents = overlapResults.modifiedEvents;
          }
        }
      }

      const recommendations = this.generateTimeTrackingRecommendations(
        mode,
        session,
        createdWorkHour,
        validationResults
      );

      return {
        success: true,
        session,
        createdWorkHour,
        createdEvent,
        modifiedEvents,
        validationResults,
        recommendations
      };

    } catch (error) {
      return {
        success: false,
        validationResults: [{
          isValid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: []
        }],
        recommendations: ['Check time tracking configuration and try again']
      };
    }
  }

  // -------------------------------------------------------------------------------------
  // WORK HOUR DRAG & DROP WORKFLOWS  
  // -------------------------------------------------------------------------------------

  /**
   * Orchestrate work hour drag and drop operations
   * Handles validation, conflict resolution, and state updates
   */
  static async executeWorkHourDrag(
    workflow: WorkHourDragWorkflow
  ): Promise<WorkHourDragResult> {
    const { 
      workHourId, 
      dragOperation, 
      targetDate, 
      targetPosition, 
      validationContext 
    } = workflow;

    try {
      // Find existing work hour
      const existingWorkHour = validationContext.existingWorkHours.find(wh => wh.id === workHourId);
      if (!existingWorkHour) {
        return {
          success: false,
          validationErrors: ['Work hour not found']
        };
      }

      // Calculate new position/time based on operation
      const newTime = calculateTimeFromPosition({
        clientY: targetPosition.clientY,
        containerElement: targetPosition.containerElement,
        date: targetDate
      });

      let modifiedWorkHour: WorkHour | undefined;
      let createdWorkHour: WorkHour | undefined;

      switch (dragOperation) {
        case 'move':
          const duration = existingWorkHour.endTime.getTime() - existingWorkHour.startTime.getTime();
          modifiedWorkHour = {
            ...existingWorkHour,
            startTime: newTime,
            endTime: new Date(newTime.getTime() + duration)
          };
          break;

        case 'resize-start':
          modifiedWorkHour = {
            ...existingWorkHour,
            startTime: newTime,
            duration: (existingWorkHour.endTime.getTime() - newTime.getTime()) / (1000 * 60 * 60)
          };
          break;

        case 'resize-end':
          modifiedWorkHour = {
            ...existingWorkHour,
            endTime: newTime,
            duration: (newTime.getTime() - existingWorkHour.startTime.getTime()) / (1000 * 60 * 60)
          };
          break;

        case 'duplicate':
          const duplicateDuration = existingWorkHour.endTime.getTime() - existingWorkHour.startTime.getTime();
          createdWorkHour = {
            ...existingWorkHour,
            id: this.generateWorkHourId(),
            startTime: newTime,
            endTime: new Date(newTime.getTime() + duplicateDuration)
          };
          break;
      }

      // Validate the operation
      const validationErrors: string[] = [];
      
      if (modifiedWorkHour && modifiedWorkHour.startTime >= modifiedWorkHour.endTime) {
        validationErrors.push('Invalid time range: start time must be before end time');
      }

      if (modifiedWorkHour?.duration && modifiedWorkHour.duration < 0.25) {
        validationErrors.push('Work hour duration must be at least 15 minutes');
      }

      // Check for conflicts
      const conflictingItems: Array<WorkHour | CalendarEvent> = [];
      const targetWorkHour = modifiedWorkHour || createdWorkHour;

      if (targetWorkHour) {
        // Check work hour conflicts
        const workHourConflicts = validationContext.existingWorkHours.filter(wh => 
          wh.id !== workHourId && this.doTimeRangesOverlap(
            wh.startTime, wh.endTime,
            targetWorkHour.startTime, targetWorkHour.endTime
          )
        );
        conflictingItems.push(...workHourConflicts);

        // Check event conflicts  
        const eventConflicts = validationContext.existingEvents.filter(event =>
          this.doTimeRangesOverlap(
            event.startTime, event.endTime,
            targetWorkHour.startTime, targetWorkHour.endTime
          )
        );
        conflictingItems.push(...eventConflicts);
      }

      return {
        success: validationErrors.length === 0,
        modifiedWorkHour,
        createdWorkHour,
        validationErrors,
        conflictResolution: conflictingItems.length > 0 ? {
          conflictingItems,
          recommendedActions: this.generateConflictRecommendations(conflictingItems),
          autoResolved: false
        } : undefined
      };

    } catch (error) {
      return {
        success: false,
        validationErrors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // -------------------------------------------------------------------------------------
  // PRIVATE HELPER METHODS
  // -------------------------------------------------------------------------------------

  private static generateWorkHourId(): string {
    return `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateCreationRecommendations(validation: any): string[] {
    const recommendations: string[] = [];
    
    if (validation.errors?.includes('Duration too short')) {
      recommendations.push('Extend the work hour to at least 15 minutes');
    }
    
    if (validation.errors?.includes('Outside working hours')) {
      recommendations.push('Consider scheduling during regular working hours');
    }

    return recommendations;
  }

  private static generateWorkHourRecommendations(
    workHour: Omit<WorkHour, 'id'>,
    conflictingEvents: CalendarEvent[],
    validationRules: any
  ): string[] {
    const recommendations: string[] = [];

    if (workHour.duration > 4) {
      recommendations.push('Consider adding breaks for work sessions longer than 4 hours');
    }

    if (conflictingEvents.length > 0) {
      recommendations.push('Review conflicting calendar events before finalizing');
    }

    if (!workHour.title || workHour.title === 'Work Session') {
      recommendations.push('Consider adding a more descriptive title for this work session');
    }

    return recommendations;
  }

  private static generateTimeTrackingRecommendations(
    mode: string,
    session: SimpleTimeTrackingSession | undefined,
    workHour: WorkHour | undefined,
    validationResults: SimpleValidationResult[]
  ): string[] {
    const recommendations: string[] = [];

    if (mode === 'start' && session) {
      recommendations.push('Remember to stop tracking when you finish working');
    }

    if (workHour && workHour.duration > 6) {
      recommendations.push('Long work session detected - consider logging breaks');
    }

    if (validationResults.some(v => v.warnings?.length)) {
      recommendations.push('Review tracking warnings for optimal time management');
    }

    return recommendations;
  }

  private static handleTimeTrackingOverlaps(
    workHour: WorkHour,
    existingEvents: CalendarEvent[],
    handleMode: 'split' | 'merge'
  ): { modifiedEvents: { eventId: string; modifications: Partial<CalendarEvent> }[] } {
    const modifiedEvents: { eventId: string; modifications: Partial<CalendarEvent> }[] = [];

    // TODO: Implement overlap handling logic
    // This would use event split/merge logic from validators

    return { modifiedEvents };
  }

  private static doTimeRangesOverlap(
    start1: Date, end1: Date,
    start2: Date, end2: Date
  ): boolean {
    return start1 < end2 && end1 > start2;
  }

  private static generateConflictRecommendations(
    conflicts: Array<WorkHour | CalendarEvent>
  ): string[] {
    const recommendations: string[] = [];

    if (conflicts.length === 1) {
      recommendations.push('Adjust timing to avoid the conflicting item');
    } else {
      recommendations.push(`Resolve ${conflicts.length} timing conflicts before saving`);
    }

    recommendations.push('Consider splitting large time blocks or rescheduling conflicts');
    return recommendations;
  }

  // -------------------------------------------------------------------------------------
  // REPOSITORY-INTEGRATED WORKFLOWS (Phase 5D)
  // -------------------------------------------------------------------------------------

  /**
   * Create work hour with repository persistence
   * Enhanced workflow that persists to database following repository pattern
   */
  static async createWorkHour(workHourData: Omit<WorkHour, 'id'>): Promise<{
    success: boolean;
    workHour?: WorkHour;
    error?: string;
  }> {
    try {
      // Step 1: Validate work hour data
      const validation = validateWorkHour(workHourData);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Step 2: Create via repository
      const workHour = await workHourRepository.create(workHourData);

      return {
        success: true,
        workHour
      };
    } catch (error) {
      console.error('WorkHourOrchestrator.createWorkHour failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Update work hour with repository persistence
   * Enhanced workflow that validates and persists changes to database
   */
  static async updateWorkHour(
    id: string, 
    updates: Partial<Omit<WorkHour, 'id'>>
  ): Promise<{
    success: boolean;
    workHour?: WorkHour;
    error?: string;
  }> {
    try {
      // Step 1: Get existing work hour
      const existing = await workHourRepository.getById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Work hour not found'
        };
      }

      // Step 2: Validate merged data
      const mergedData = { ...existing, ...updates };
      const validation = validateWorkHour(mergedData);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Step 3: Update via repository
      const updatedWorkHour = await workHourRepository.update(id, updates);

      return {
        success: true,
        workHour: updatedWorkHour
      };
    } catch (error) {
      console.error('WorkHourOrchestrator.updateWorkHour failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Delete work hour with repository persistence
   * Enhanced workflow that removes from database
   */
  static async deleteWorkHour(id: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Step 1: Verify work hour exists
      const existing = await workHourRepository.getById(id);
      if (!existing) {
        return {
          success: false,
          error: 'Work hour not found'
        };
      }

      // Step 2: Delete via repository
      await workHourRepository.delete(id);

      return {
        success: true
      };
    } catch (error) {
      console.error('WorkHourOrchestrator.deleteWorkHour failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get work hours with repository data access
   * Enhanced workflow for retrieving work hour data
   */
  static async getWorkHours(): Promise<{
    success: boolean;
    workHours?: WorkHour[];
    error?: string;
  }> {
    try {
      const workHours = await workHourRepository.getAll();
      return {
        success: true,
        workHours
      };
    } catch (error) {
      console.error('WorkHourOrchestrator.getWorkHours failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get work hours by date range with repository data access
   * Enhanced workflow for retrieving filtered work hour data
   */
  static async getWorkHoursByDateRange(
    startDate: Date, 
    endDate: Date
  ): Promise<{
    success: boolean;
    workHours?: WorkHour[];
    error?: string;
  }> {
    try {
      const workHours = await workHourRepository.getByDateRange(startDate, endDate);
      return {
        success: true,
        workHours
      };
    } catch (error) {
      console.error('WorkHourOrchestrator.getWorkHoursByDateRange failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}
