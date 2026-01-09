/**
 * useProjectResize Hook
 * 
 * Custom hook for handling project bar resize operations (start/end date).
 * Coordinates with TimelineDragCoordinatorService for calculations and validation.
 * 
 * Following AI Dev Rules pattern:
 * - Hook manages React state + coordinates services
 * - Services handle calculations
 * - Updates only on mouse release (not live)
 * 
 * Created: November 2025
 */
import { useCallback } from 'react';
import { toast } from '@/presentation/hooks/ui/use-toast';
import { TimelineDragCoordinatorService } from '@/presentation/services/DragCoordinator';
import { addDaysToDate } from '@/presentation/utils/dateCalculations';;
import type { DragState } from '@/presentation/services/DragPositioning';
import { ErrorHandlingService } from '@/infrastructure/errors/ErrorHandlingService';
import type { DayEstimate, Project } from '@/shared/types/core';
type UpdateProjectFn = (
  id: string,
  updates: Partial<Project>,
  options?: { silent?: boolean }
) => Promise<Project>;

interface UseProjectResizeProps {
  projects: Project[];
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  timelineMode: 'days' | 'weeks';
  dayEstimates: DayEstimate[]; // DayEstimate[] for validation
  updateProject: UpdateProjectFn;
  checkAutoScroll: (clientX: number) => void;
  stopAutoScroll: () => void;
  setIsDragging: (dragging: boolean) => void;
  setDragState: (state: DragState | null) => void;
  dragState: DragState | null;
}
/**
 * Initialize drag state for project resize
 */
function initializeProjectResizeDragState(
  projectId: string,
  originalStartDate: Date,
  originalEndDate: Date,
  startX: number,
  startY: number,
  action: 'resize-start-date' | 'resize-end-date',
  mode: 'days' | 'weeks'
): DragState {
  return {
    projectId,
    action,
    startX,
    startY,
    originalStartDate: new Date(originalStartDate),
    originalEndDate: new Date(originalEndDate),
    lastDaysDelta: 0,
    mode
  };
}
/**
 * Custom hook for handling project bar resize operations
 * Manages state and coordinates with services
 */
export function useProjectResize({
  projects,
  dates,
  viewportStart,
  viewportEnd,
  timelineMode,
  dayEstimates,
  updateProject,
  checkAutoScroll,
  stopAutoScroll,
  setIsDragging,
  setDragState,
  dragState: _dragState
}: UseProjectResizeProps) {
  const handleProjectResizeMouseDown = useCallback((
    e: React.MouseEvent, 
    projectId: string, 
    action: 'resize-start-date' | 'resize-end-date'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;
    // Initialize drag state
    const initialDragState = initializeProjectResizeDragState(
      projectId,
      new Date(targetProject.startDate),
      new Date(targetProject.endDate),
      e.clientX,
      e.clientY,
      action,
      timelineMode
    );
    setIsDragging(true);
    setDragState(initialDragState);
    let hasShownToast = false; // Track if we've shown a toast to avoid duplicates
    let currentDragStateRef = initialDragState; // Track current drag state in closure
    const handleMouseMove = (e: MouseEvent) => {
      try {
        e.preventDefault();
        // Use unified drag coordinator for all calculations
        const result = TimelineDragCoordinatorService.coordinateDragOperation(
          currentDragStateRef,
          e,
          {
            projects,
            viewportStart,
            viewportEnd,
            timelineMode,
            dates,
            dayEstimates // Pass day estimates for validation
          }
        );
        // Check for auto-scroll during drag
        if (result.autoScrollConfig?.shouldScroll) {
          checkAutoScroll(e.clientX);
        }
        // Show toast if collision detected or validation failed (only once)
        if (!hasShownToast) {
          if (result.collisionResult?.hasCollision && result.collisionResult.toastMessage) {
            toast({
              title: "Collision Detected",
              description: result.collisionResult.toastMessage,
            });
            hasShownToast = true;
          } else if (result.resizeValidation?.shouldShowToast && result.resizeValidation.toastMessage) {
            toast({
              title: "Invalid Resize",
              description: result.resizeValidation.toastMessage,
            });
            hasShownToast = true;
          }
        }
        // Update visual state if needed. For resize operations we want live feedback,
        // so update even when the snapped delta has not changed yet.
        if (result.shouldUpdate || action === 'resize-start-date' || action === 'resize-end-date') {
          currentDragStateRef = result.newDragState; // keep latest state inside closure
          setDragState(result.newDragState);
        }
        // Note: We do NOT update the database during drag (only on mouse release)
      } catch (error) {
        ErrorHandlingService.handle(error, { source: 'useProjectResize', action: '🚨 PROJECT RESIZE ERROR:' });
      }
    };
    const handleMouseUp = () => {
      // Capture final delta from closure ref
      const finalDaysDelta = currentDragStateRef.lastDaysDelta || 0;
      stopAutoScroll();
      // Only update database if there was actual movement
      if (finalDaysDelta !== 0) {
        // Calculate final dates
        const finalDates = (() => {
          if (action === 'resize-start-date') {
            const newStartDate = addDaysToDate(new Date(currentDragStateRef.originalStartDate), finalDaysDelta);
            return {
              startDate: newStartDate,
              endDate: new Date(currentDragStateRef.originalEndDate)
            };
          } else {
            const newEndDate = addDaysToDate(new Date(currentDragStateRef.originalEndDate), finalDaysDelta);
            return {
              startDate: new Date(currentDragStateRef.originalStartDate),
              endDate: newEndDate
            };
          }
        })();
        // Update database - keep visual state until update completes
        updateProject(projectId, finalDates, { silent: true })
          .then(() => {
            // Clear drag state AFTER database update completes
            setIsDragging(false);
            setDragState(null);
            toast({
              title: "Success",
              description: "Project dates updated successfully",
            });
          })
          .catch((error: Error) => {
            ErrorHandlingService.handle(error, { source: 'useProjectResize', action: 'Failed to update project:' });
            // Clear drag state even on error
            setIsDragging(false);
            setDragState(null);
            toast({
              title: "Error",
              description: "Failed to update project dates",
              variant: "destructive"
            });
          });
      } else {
        // No movement - clear drag state immediately
        setIsDragging(false);
        setDragState(null);
      }
      // Remove all event listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.removeEventListener('touchcancel', handleMouseUp);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleMouseMove({ clientX: touch.clientX, preventDefault: () => {} } as MouseEvent);
      }
    };
    // Add comprehensive event listeners for all input types (mouse, pen, touch)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove);
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('touchcancel', handleMouseUp);
  }, [
    projects,
    dates,
    viewportStart,
    viewportEnd,
    timelineMode,
    dayEstimates,
    updateProject,
    checkAutoScroll,
    stopAutoScroll,
    setIsDragging,
    setDragState
  ]);
  return { handleProjectResizeMouseDown };
}
