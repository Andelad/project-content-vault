/**
 * Timeline Drag Coordinator Service
 *
 * High-level drag operation coordination service that orchestrates
 * drag calculations, viewport management, and conflict resolution.
 *
 * 🚨 ARCHITECTURAL RULE: Services calculate, Components coordinate
 */

import * as DragCalculationsService from './DragPositioning';
import { DragState, DragPositionResult } from './DragPositioning';
import * as ProjectOverlapService from '../calculations/projects/projectEntityCalculations';
import { ConflictDetectionResult, DateAdjustmentResult } from '../calculations/projects/projectEntityCalculations';
import { calculateProjectDays } from './ProjectBarPositioning';
import { calculateWorkHoursTotal, calculateDayWorkHours } from '../calculations/availability/workHourGeneration';
import { TimelineViewport as TimelineViewportService } from './TimelineViewportService';
import * as ProjectBarResizeService from './ProjectBarResizeService';
import { normalizeToMidnight, addDaysToDate } from '../calculations/general/dateCalculations';
import type { Project, Phase, DayEstimate } from '@/types/core';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';

export interface TimelineContext {
  projects: Project[];
  viewportStart: Date;
  viewportEnd: Date;
  timelineMode: 'days' | 'weeks';
  dates: Date[];
  dayEstimates?: DayEstimate[]; // Optional: for resize validation against planned/completed time
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
  resizeValidation?: ProjectBarResizeService.ResizeValidationResult;
  collisionResult?: ProjectBarResizeService.CollisionDetectionResult;
}

export interface DragCompletionResult {
  success: boolean;
  finalDates: { startDate: Date; endDate: Date };
  conflictsResolved: boolean;
  error?: string;
}

export interface DragUpdateCallbacks {
  onProjectUpdate?: (projectId: string, updates: Partial<Project>, options?: { silent?: boolean }) => void;
  onMilestoneUpdate?: (milestoneId: string, updates: Partial<Phase>, options?: { silent?: boolean }) => void;
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

    const dayInMs = 24 * 60 * 60 * 1000;
    let snappedDaysDelta = positionResult.daysDelta;

    // 5. Check for conflicts if we have a project
    let conflictResult: ConflictDetectionResult | undefined;
    let adjustmentResult: DateAdjustmentResult | undefined;
  let resizeValidation: ProjectBarResizeService.ResizeValidationResult | undefined;
  let collisionResult: ProjectBarResizeService.CollisionDetectionResult | undefined;
    const targetProject = dragState.projectId
      ? projects.find(p => p.id === dragState.projectId)
      : undefined;

    if (targetProject && boundsValidation.isValid) {
      if (dragState.action === 'resize-start-date' || dragState.action === 'resize-end-date') {
        const { dayEstimates } = timelineContext;

        if (dayEstimates) {
          const newDate = dragState.action === 'resize-start-date' ? newDates.startDate : newDates.endDate;
          resizeValidation = ProjectBarResizeService.validateResizeBounds(
            dragState.action,
            newDate,
            targetProject,
            dayEstimates
          );
        }

        const newDateForCollision = dragState.action === 'resize-start-date' ? newDates.startDate : newDates.endDate;
        collisionResult = ProjectBarResizeService.detectRowCollision(
          dragState.action,
          newDateForCollision,
          targetProject,
          projects
        );
      }
    }

    // 6. Apply resize-specific adjustments and update drag state
    let finalDates = adjustmentResult?.wasAdjusted
      ? { startDate: adjustmentResult.adjustedStartDate, endDate: adjustmentResult.adjustedEndDate }
      : newDates;
    let appliedAdjustment = adjustmentResult;

    if (
      targetProject &&
      boundsValidation.isValid &&
      (dragState.action === 'resize-start-date' || dragState.action === 'resize-end-date')
    ) {
      const originalDate = dragState.action === 'resize-start-date'
        ? new Date(dragState.originalStartDate)
        : new Date(dragState.originalEndDate);
      const attemptedDate = dragState.action === 'resize-start-date'
        ? newDates.startDate
        : newDates.endDate;

      const updateMinBound = (current: Date | null, candidate: Date) => {
        if (!current) return candidate;
        return candidate.getTime() > current.getTime() ? candidate : current;
      };
      const updateMaxBound = (current: Date | null, candidate: Date) => {
        if (!current) return candidate;
        return candidate.getTime() < current.getTime() ? candidate : current;
      };

      let minBound: Date | null = null;
      let maxBound: Date | null = null;
      let adjustmentReason: string | undefined;

      if (resizeValidation && resizeValidation.isValid === false && resizeValidation.adjustedDate) {
        adjustmentReason = resizeValidation.toastMessage || resizeValidation.reason || adjustmentReason;

        if (dragState.action === 'resize-start-date') {
          maxBound = updateMaxBound(maxBound, resizeValidation.adjustedDate);
        } else {
          minBound = updateMinBound(minBound, resizeValidation.adjustedDate);
        }
      }

      if (collisionResult?.hasCollision && collisionResult.snapToDate) {
        adjustmentReason = adjustmentReason || collisionResult.toastMessage;

        if (collisionResult.constraint === 'min') {
          minBound = updateMinBound(minBound, collisionResult.snapToDate);
        } else if (collisionResult.constraint === 'max') {
          maxBound = updateMaxBound(maxBound, collisionResult.snapToDate);
        } else if (dragState.action === 'resize-start-date') {
          minBound = updateMinBound(minBound, collisionResult.snapToDate);
        } else {
          maxBound = updateMaxBound(maxBound, collisionResult.snapToDate);
        }
      }

      let snappedDate = attemptedDate;

      if (minBound && snappedDate < minBound) {
        snappedDate = minBound;
      }
      if (maxBound && snappedDate > maxBound) {
        snappedDate = maxBound;
      }

      if (minBound && maxBound && minBound.getTime() > maxBound.getTime()) {
        snappedDate = originalDate;
      }

      const resizedDates = ProjectBarResizeService.calculateResizedDates(
        dragState.action,
        snappedDate,
        targetProject
      );

      finalDates = resizedDates;

      if (snappedDate.getTime() !== attemptedDate.getTime()) {
        appliedAdjustment = {
          originalStartDate: dragState.originalStartDate,
          originalEndDate: dragState.originalEndDate,
          adjustedStartDate: resizedDates.startDate,
          adjustedEndDate: resizedDates.endDate,
          wasAdjusted: true,
          adjustmentReason: adjustmentReason || '',
          daysMoved: snappedDaysDelta
        };
      }
    }

    if (dragState.action === 'resize-start-date') {
      snappedDaysDelta = Math.round(
        (finalDates.startDate.getTime() - dragState.originalStartDate.getTime()) / dayInMs
      );
    } else if (dragState.action === 'resize-end-date') {
      snappedDaysDelta = Math.round(
        (finalDates.endDate.getTime() - dragState.originalEndDate.getTime()) / dayInMs
      );
    }

    const shouldUpdate = positionResult.shouldUpdate || snappedDaysDelta !== dragState.lastDaysDelta;

    const newDragState: DragState = {
      ...dragState,
      lastDaysDelta: snappedDaysDelta,
      pixelDeltaX: positionResult.pixelDeltaX,
      lastSnappedDelta: snappedDaysDelta
    };

    return {
      shouldUpdate,
      newDragState,
      autoScrollConfig,
      conflictResult,
      adjustmentResult: appliedAdjustment,
      resizeValidation,
      collisionResult
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
    let newDate = new Date(dragState.originalStartDate);
    newDate = addDaysToDate(dragState.originalStartDate, daysDelta);
    newDate = normalizeToMidnight(newDate);

    // 4. Update drag state with visual delta for smooth rendering
    const newDragState: DragState = {
      ...dragState,
      lastDaysDelta: positionResult.daysDelta,
      pixelDeltaX: positionResult.pixelDeltaX,
      visualDelta: positionResult.visualDelta
    };

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
      newStartDate = addDaysToDate(dragState.originalStartDate, daysDelta);
      newEndDate = new Date(dragState.originalEndDate);
    } else if (dragState.action === 'resize-end-date') {
      newStartDate = new Date(dragState.originalStartDate);
      newEndDate = new Date(dragState.originalEndDate);
      newEndDate = addDaysToDate(dragState.originalEndDate, daysDelta);
    } else {
      // move
      newStartDate = new Date(dragState.originalStartDate);
      newEndDate = new Date(dragState.originalEndDate);
      newStartDate = addDaysToDate(dragState.originalStartDate, daysDelta);
      newEndDate = addDaysToDate(dragState.originalEndDate, daysDelta);
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
    };

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

      // Handle project resize completion
      if (dragState.action === 'resize-start-date' && dragState.projectId && onProjectUpdate) {
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
      ErrorHandlingService.handle(error, { source: 'DragCoordinator', action: '🚨 DRAG COMPLETION ERROR:' });
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
