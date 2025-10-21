/**
 * Timeline Drag Coordinator Service
 *
 * High-level drag operation coordination service that orchestrates
 * drag calculations, viewport management, and conflict resolution.
 *
 * 🚨 ARCHITECTURAL RULE: Services calculate, Components coordinate
 */

import * as DragCalculationsService from '../positioning/DragPositioning';
import { DragState, DragPositionResult } from '../positioning/DragPositioning';
import * as ProjectOverlapService from '../../calculations/projects/projectEntityCalculations';
import { ConflictDetectionResult, DateAdjustmentResult } from '../../calculations/projects/projectEntityCalculations';
import { TimelineViewport as TimelineViewportService } from '../positioning/ViewportPositioning';
import type { Project } from '@/types/core';

export interface TimelineContext {
  projects: Project[];
  viewportStart: Date;
  viewportEnd: Date;
  timelineMode: 'days' | 'weeks';
  dates: Date[];
}

export interface DragCoordinationResult {
  shouldUpdate: boolean;
  newDragState: DragState;
  autoScrollConfig?: {
    shouldScroll: boolean;
    direction: 'left' | 'right';
  };
  conflictResult?: ConflictDetectionResult;
  adjustmentResult?: DateAdjustmentResult;
}

export interface DragCompletionResult {
  success: boolean;
  finalDates: { startDate: Date; endDate: Date };
  conflictsResolved: boolean;
  error?: string;
}

export interface DragUpdateCallbacks {
  onProjectUpdate?: (projectId: string, updates: any, options?: any) => void;
  onMilestoneUpdate?: (milestoneId: string, updates: any, options?: any) => void;
  onSuccessToast?: (message: string) => void;
}

/**
 * Timeline Drag Coordinator Service
 * Handles high-level coordination of drag operations
 */
export class TimelineDragCoordinatorService {

  /**
   * Coordinate a drag operation by orchestrating all services
   * Handles both project and milestone drags
   */
  static coordinateDragOperation(
    dragState: DragState,
    mouseEvent: MouseEvent,
    timelineContext: TimelineContext
  ): DragCoordinationResult {
    // Route to appropriate handler based on entity type
    if (dragState.milestoneId) {
      return this.coordinateMilestoneDrag(dragState, mouseEvent, timelineContext);
    }
    
    if (dragState.holidayId) {
      return this.coordinateHolidayDrag(dragState, mouseEvent, timelineContext);
    }
    
    // Default: project drag handling
    const { projects, viewportStart, viewportEnd, timelineMode, dates } = timelineContext;

    // 1. Calculate position update
    const positionResult = DragCalculationsService.calculateDragPositionUpdate(
      mouseEvent.clientX,
      mouseEvent.clientY,
      dragState,
      dates,
      timelineMode
    );

    // 2. Check auto-scroll
    const timelineContent = document.querySelector('.timeline-content-area');
    let autoScrollConfig;

    if (timelineContent) {
      const rect = timelineContent.getBoundingClientRect();
      const trigger = TimelineViewportService.calculateAutoScrollTrigger({
        mouseX: mouseEvent.clientX,
        timelineContentRect: rect
      });

      autoScrollConfig = {
        shouldScroll: trigger.shouldScroll,
        direction: trigger.direction
      };
    }

    // 3. Calculate new dates based on drag action
    const newDates = this.calculateNewDates(dragState, positionResult);

    // 4. Validate bounds
    const boundsValidation = DragCalculationsService.validateDragBounds(
      newDates.startDate,
      newDates.endDate,
      viewportStart,
      viewportEnd
    );

    // 5. Check for conflicts if we have a project
    let conflictResult: ConflictDetectionResult | undefined;
    let adjustmentResult: DateAdjustmentResult | undefined;

    if (dragState.projectId && boundsValidation.isValid) {
      const targetProject = projects.find(p => p.id === dragState.projectId);
      if (targetProject) {
        conflictResult = ProjectOverlapService.detectLiveDragConflicts(
          dragState.projectId,
          newDates,
          targetProject.rowId,
          projects
        );

        if (conflictResult.hasConflicts) {
          adjustmentResult = ProjectOverlapService.resolveDragConflicts(
            newDates,
            conflictResult.conflictingProjects,
            'adjust' // Default to adjust strategy
          );
        }
      }
    }

    // 6. Update drag state
    const finalDates = adjustmentResult?.wasAdjusted
      ? { startDate: adjustmentResult.adjustedStartDate, endDate: adjustmentResult.adjustedEndDate }
      : newDates;

    const newDragState: DragState = {
      ...dragState,
      lastDaysDelta: positionResult.daysDelta,
      // Store additional state for next iteration
      pixelDeltaX: positionResult.pixelDeltaX,
      lastSnappedDelta: positionResult.snappedDelta
    } as any;

    return {
      shouldUpdate: positionResult.shouldUpdate,
      newDragState,
      autoScrollConfig,
      conflictResult,
      adjustmentResult
    };
  }

  /**
   * Coordinate milestone drag operation
   * Handles milestone-specific drag calculations and validation
   */
  private static coordinateMilestoneDrag(
    dragState: DragState,
    mouseEvent: MouseEvent,
    timelineContext: TimelineContext
  ): DragCoordinationResult {
    const { timelineMode } = timelineContext;

    // 1. Calculate milestone drag update (with snap behavior)
    const positionResult = DragCalculationsService.calculateMilestoneDragUpdate(
      mouseEvent.clientX,
      dragState,
      timelineMode
    );

    // 2. Check auto-scroll (same as projects)
    const timelineContent = document.querySelector('.timeline-content-area');
    let autoScrollConfig;

    if (timelineContent) {
      const rect = timelineContent.getBoundingClientRect();
      const trigger = TimelineViewportService.calculateAutoScrollTrigger({
        mouseX: mouseEvent.clientX,
        timelineContentRect: rect
      });

      autoScrollConfig = {
        shouldScroll: trigger.shouldScroll,
        direction: trigger.direction
      };
    }

    // 3. Calculate new milestone date
    const { daysDelta } = positionResult;
    const newDate = new Date(dragState.originalStartDate);
    newDate.setDate(dragState.originalStartDate.getDate() + daysDelta);
    newDate.setHours(0, 0, 0, 0);

    // 4. Update drag state with visual delta for smooth rendering
    const newDragState: DragState = {
      ...dragState,
      lastDaysDelta: positionResult.daysDelta,
      pixelDeltaX: positionResult.pixelDeltaX,
      visualDelta: positionResult.visualDelta
    } as any;

    return {
      shouldUpdate: positionResult.shouldUpdate,
      newDragState,
      autoScrollConfig,
      // Milestones don't have conflict detection with other projects
      conflictResult: undefined,
      adjustmentResult: undefined
    };
  }

  /**
   * Coordinate holiday drag operation
   * Handles holiday-specific drag calculations and validation
   */
  private static coordinateHolidayDrag(
    dragState: DragState,
    mouseEvent: MouseEvent,
    timelineContext: TimelineContext
  ): DragCoordinationResult {
    const { timelineMode } = timelineContext;

    // 1. Calculate holiday drag update (with snap behavior)
    const positionResult = DragCalculationsService.calculateHolidayDragUpdate(
      mouseEvent.clientX,
      dragState,
      timelineMode
    );

    // 2. Check auto-scroll (same as projects)
    const timelineContent = document.querySelector('.timeline-content-area');
    let autoScrollConfig;

    if (timelineContent) {
      const rect = timelineContent.getBoundingClientRect();
      const trigger = TimelineViewportService.calculateAutoScrollTrigger({
        mouseX: mouseEvent.clientX,
        timelineContentRect: rect
      });

      autoScrollConfig = {
        shouldScroll: trigger.shouldScroll,
        direction: trigger.direction
      };
    }

    // 3. Calculate new holiday dates based on action
    const { daysDelta } = positionResult;
    let newStartDate: Date;
    let newEndDate: Date;

    if (dragState.action === 'resize-start-date') {
      newStartDate = new Date(dragState.originalStartDate);
      newStartDate.setDate(dragState.originalStartDate.getDate() + daysDelta);
      newEndDate = new Date(dragState.originalEndDate);
    } else if (dragState.action === 'resize-end-date') {
      newStartDate = new Date(dragState.originalStartDate);
      newEndDate = new Date(dragState.originalEndDate);
      newEndDate.setDate(dragState.originalEndDate.getDate() + daysDelta);
    } else {
      // move
      newStartDate = new Date(dragState.originalStartDate);
      newEndDate = new Date(dragState.originalEndDate);
      newStartDate.setDate(dragState.originalStartDate.getDate() + daysDelta);
      newEndDate.setDate(dragState.originalEndDate.getDate() + daysDelta);
    }

    // 4. Validate holiday bounds
    const validation = DragCalculationsService.validateHolidayBounds(
      newStartDate,
      newEndDate,
      dragState.action as 'move' | 'resize-start-date' | 'resize-end-date'
    );

    // 5. Update drag state with visual delta for smooth rendering
    const newDragState: DragState = {
      ...dragState,
      lastDaysDelta: positionResult.daysDelta,
      pixelDeltaX: positionResult.pixelDeltaX,
      visualDelta: positionResult.visualDelta,
      isValid: validation.isValid
    } as any;

    return {
      shouldUpdate: positionResult.shouldUpdate,
      newDragState,
      autoScrollConfig,
      // Holidays don't have conflict detection
      conflictResult: undefined,
      adjustmentResult: undefined
    };
  }

  /**
   * Complete a drag operation
   * Handles project, milestone, and holiday completion
   */
  static async completeDragOperation(
    dragState: DragState,
    finalDates: { startDate: Date; endDate: Date },
    updateCallbacks: DragUpdateCallbacks
  ): Promise<DragCompletionResult> {
    try {
      const { onProjectUpdate, onMilestoneUpdate, onSuccessToast } = updateCallbacks;

      // Handle milestone drag completion
      if (dragState.milestoneId && onMilestoneUpdate) {
        onMilestoneUpdate(dragState.milestoneId, {
          dueDate: finalDates.startDate // Milestones use dueDate
        }, { silent: true });

        if (onSuccessToast) {
          onSuccessToast("Milestone updated successfully");
        }

        return {
          success: true,
          finalDates,
          conflictsResolved: false
        };
      }

      // Handle project drag completion
      if (dragState.action === 'move' && dragState.projectId && onProjectUpdate) {
        onProjectUpdate(dragState.projectId, {
          startDate: finalDates.startDate,
          endDate: finalDates.endDate
        }, { silent: true });

        // TODO: Update milestones if needed
        // This would require access to milestones data

      } else if (dragState.action === 'resize-start-date' && dragState.projectId && onProjectUpdate) {
        onProjectUpdate(dragState.projectId, {
          startDate: finalDates.startDate
        }, { silent: true });

      } else if (dragState.action === 'resize-end-date' && dragState.projectId && onProjectUpdate) {
        onProjectUpdate(dragState.projectId, {
          endDate: finalDates.endDate
        }, { silent: true });
      }

      if (onSuccessToast) {
        onSuccessToast("Project updated successfully");
      }

      return {
        success: true,
        finalDates,
        conflictsResolved: false // TODO: Track if conflicts were resolved
      };

    } catch (error) {
      console.error('🚨 DRAG COMPLETION ERROR:', error);
      return {
        success: false,
        finalDates,
        conflictsResolved: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cancel a drag operation and restore to original state
   */
  static cancelDragOperation(
    dragState: DragState,
    restoreToOriginal: boolean = true
  ): void {
    // Note: Auto-scroll cleanup should be handled by the component
    // since TimelineViewportService doesn't have a stopAutoScroll method

    // If restoreToOriginal is true, the component should handle restoring
    // the visual state to the original dates
  }

  /**
   * Calculate new dates based on drag action and position result
   */
  private static calculateNewDates(
    dragState: DragState,
    positionResult: DragPositionResult
  ): { startDate: Date; endDate: Date } {
    const { daysDelta } = positionResult;

    switch (dragState.action) {
      case 'move':
        return {
          startDate: new Date(dragState.originalStartDate.getTime() + daysDelta * 24 * 60 * 60 * 1000),
          endDate: new Date(dragState.originalEndDate.getTime() + daysDelta * 24 * 60 * 60 * 1000)
        };

      case 'resize-start-date':
        return {
          startDate: new Date(dragState.originalStartDate.getTime() + daysDelta * 24 * 60 * 60 * 1000),
          endDate: dragState.originalEndDate
        };

      case 'resize-end-date':
        return {
          startDate: dragState.originalStartDate,
          endDate: new Date(dragState.originalEndDate.getTime() + daysDelta * 24 * 60 * 60 * 1000)
        };

      default:
        return {
          startDate: dragState.originalStartDate,
          endDate: dragState.originalEndDate
        };
    }
  }
}
