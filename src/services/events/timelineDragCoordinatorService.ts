/**
 * Timeline Drag Coordinator Service
 *
 * High-level drag operation coordination service that orchestrates
 * drag calculations, viewport management, and conflict resolution.
 *
 * 🚨 ARCHITECTURAL RULE: Services calculate, Components coordinate
 */

import * as DragCalculationService from './dragCalculationService';
import { DragState, DragPositionResult } from './dragCalculationService';
import * as ProjectOverlapService from '../projects/projectOverlapService';
import { ConflictDetectionResult, DateAdjustmentResult } from '../projects/projectOverlapService';
import { TimelineViewportService } from '../timeline/timelineViewportService';
import { Project } from '../projects/projectOverlapService';

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
   */
  static coordinateDragOperation(
    dragState: DragState,
    mouseEvent: MouseEvent,
    timelineContext: TimelineContext
  ): DragCoordinationResult {
    const { projects, viewportStart, viewportEnd, timelineMode, dates } = timelineContext;

    // 1. Calculate position update
    const positionResult = DragCalculationService.calculateDragPositionUpdate(
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
    const boundsValidation = DragCalculationService.validateDragBounds(
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
   * Complete a drag operation
   */
  static async completeDragOperation(
    dragState: DragState,
    finalDates: { startDate: Date; endDate: Date },
    updateCallbacks: DragUpdateCallbacks
  ): Promise<DragCompletionResult> {
    try {
      const { onProjectUpdate, onMilestoneUpdate, onSuccessToast } = updateCallbacks;

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
    console.log('🛑 DRAG CANCELLED:', {
      projectId: dragState.projectId,
      action: dragState.action,
      restoreToOriginal
    });
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
