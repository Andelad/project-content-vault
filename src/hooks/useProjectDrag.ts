import { useCallback } from 'react';
import { 
  TimelineDragCoordinatorService,
  initializeDragState,
  throttledDragUpdate,
  clearDragQueue,
  throttledVisualUpdate,
  addDaysToDate
} from '@/services';

interface UseProjectDragProps {
  projects: any[];
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  timelineMode: 'days' | 'weeks';
  milestones: any[];
  updateProject: (id: string, updates: any, options?: any) => Promise<any>;
  updateMilestone: (id: string, updates: any, options?: any) => Promise<any>;
  showProjectSuccessToast: (message: string) => void;
  checkAutoScroll: (clientX: number) => void;
  stopAutoScroll: () => void;
  setIsDragging: (dragging: boolean) => void;
  setDragState: (state: any) => void;
  dragState: any;
}

/**
 * Custom hook for handling project drag operations (move and resize)
 * Coordinates with TimelineDragCoordinatorService for calculations
 */
export function useProjectDrag({
  projects,
  dates,
  viewportStart,
  viewportEnd,
  timelineMode,
  milestones,
  updateProject,
  updateMilestone,
  showProjectSuccessToast,
  checkAutoScroll,
  stopAutoScroll,
  setIsDragging,
  setDragState,
  dragState
}: UseProjectDragProps) {
  
  const handleMouseDown = useCallback((e: React.MouseEvent, projectId: string, action: string) => {
    // 🚫 PREVENT BROWSER DRAG-AND-DROP: Stop the globe/drag indicator
    e.preventDefault();
    e.stopPropagation();
    
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;
    
    // Initialize drag state using unified service
    const initialDragState = initializeDragState(
      {
        id: projectId,
        startDate: targetProject.startDate,
        endDate: targetProject.endDate
      },
      action,
      e.clientX,
      e.clientY,
      timelineMode
    );
    
    setIsDragging(true);
    setDragState(initialDragState);
    
    const handleMouseMove = (e: MouseEvent) => {
      try {
        // 🚫 PREVENT BROWSER DRAG BEHAVIOR
        e.preventDefault();
        
        // Use unified drag coordinator for all calculations
        const result = TimelineDragCoordinatorService.coordinateDragOperation(
          dragState || initialDragState,
          e,
          {
            projects,
            viewportStart,
            viewportEnd,
            timelineMode,
            dates
          }
        );
        
        // Check for auto-scroll during drag
        if (result.autoScrollConfig?.shouldScroll) {
          checkAutoScroll(e.clientX);
        }
        
        // Update visual state if needed
        if (result.shouldUpdate) {
          throttledVisualUpdate(() => {
            setDragState(result.newDragState);
          }, timelineMode);
        }
        
        // Handle background persistence (throttled database updates)
        const daysDelta = result.newDragState.lastDaysDelta;
        if (daysDelta !== (dragState?.lastDaysDelta || 0)) {
          const throttleMs = timelineMode === 'weeks' ? 100 : 50;
          throttledDragUpdate(async () => {
            if (action === 'resize-start-date') {
              const newStartDate = addDaysToDate(new Date(initialDragState.originalStartDate), daysDelta);
              const endDate = new Date(initialDragState.originalEndDate);
              const oneDayBefore = addDaysToDate(endDate, -1);
              if (newStartDate <= oneDayBefore) {
                updateProject(projectId, { startDate: newStartDate }, { silent: true });
              }
            } else if (action === 'resize-end-date') {
              const newEndDate = addDaysToDate(new Date(initialDragState.originalEndDate), daysDelta);
              const startDate = new Date(initialDragState.originalStartDate);
              const oneDayAfter = addDaysToDate(startDate, 1);
              if (newEndDate >= oneDayAfter) {
                updateProject(projectId, { endDate: newEndDate }, { silent: true });
              }
            } else if (action === 'move') {
              const newStartDate = addDaysToDate(new Date(initialDragState.originalStartDate), daysDelta);
              const newEndDate = addDaysToDate(new Date(initialDragState.originalEndDate), daysDelta);
              // Update project and all milestones in parallel
              const projectUpdate = updateProject(projectId, { 
                startDate: newStartDate,
                endDate: newEndDate 
              }, { silent: true });
              const projectMilestones = milestones.filter(m => m.projectId === projectId);
              const milestoneUpdates = projectMilestones.map(milestone => {
                const originalMilestoneDate = new Date(milestone.dueDate);
                const newMilestoneDate = addDaysToDate(originalMilestoneDate, daysDelta);
                return updateMilestone(milestone.id, { 
                  dueDate: new Date(newMilestoneDate.toISOString().split('T')[0] + 'T00:00:00+00:00')
                }, { silent: true });
              });
              Promise.all([projectUpdate, ...milestoneUpdates]);
            }
          }, throttleMs);
        }
      } catch (error) {
        console.error('🚨 PROJECT DRAG ERROR:', error);
      }
    };
    
    const handleMouseUp = () => {
      const hadMovement = dragState && dragState.lastDaysDelta !== 0;
      setIsDragging(false);
      setDragState(null);
      stopAutoScroll(); // Fix infinite scrolling
      
      // Clear any pending drag updates for better performance
      clearDragQueue();
      
      // Only show success toast if there was actual movement/change
      if (hadMovement) {
        showProjectSuccessToast("Project updated successfully");
      }
      
      // Remove ALL possible event listeners for robust pen/tablet support
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
        // Create a more complete mouse event for touch with both coordinates
        const mouseEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          preventDefault: () => e.preventDefault(),
          stopPropagation: () => e.stopPropagation()
        } as MouseEvent;
        handleMouseMove(mouseEvent);
      }
    };
    
    // Add comprehensive event listeners for all input types (mouse, pen, touch)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove);
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp); // Critical for pen input
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('touchcancel', handleMouseUp);
  }, [
    projects,
    dates,
    viewportStart,
    viewportEnd,
    timelineMode,
    milestones,
    updateProject,
    updateMilestone,
    checkAutoScroll,
    stopAutoScroll,
    showProjectSuccessToast,
    setIsDragging,
    setDragState,
    dragState
  ]);
  
  return { handleMouseDown };
}
