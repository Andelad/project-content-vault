import { useState, useCallback, useRef, useMemo } from 'react';
import { DragState } from '@/lib/dragUtils';

/**
 * Ultra-high performance drag system
 * - Zero database calls during drag
 * - Pure visual updates with requestAnimationFrame
 * - Single batch commit on drag end
 */

interface VisualDragState {
  projectId?: string;
  holidayId?: string;
  action: string;
  daysDelta: number;
  isActive: boolean;
}

export function useHighPerformanceDrag({
  projects,
  holidays,
  dates,
  timelineMode,
  updateProject,
  updateHoliday,
  setCurrentDate
}: any) {
  const [isDragging, setIsDragging] = useState(false);
  const [visualDragState, setVisualDragState] = useState<VisualDragState | null>(null);
  const [originalDragState, setOriginalDragState] = useState<DragState | null>(null);
  
  const frameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // Get visual position for dragged items
  const getVisualPosition = useCallback((itemId: string, itemType: 'project' | 'holiday') => {
    if (!visualDragState || !visualDragState.isActive) return null;
    
    if (itemType === 'project' && visualDragState.projectId === itemId) {
      return { daysDelta: visualDragState.daysDelta };
    }
    
    if (itemType === 'holiday' && visualDragState.holidayId === itemId) {
      return { daysDelta: visualDragState.daysDelta };
    }
    
    return null;
  }, [visualDragState]);

  // Start drag with original data capture
  const startDrag = useCallback((dragState: DragState) => {
    setIsDragging(true);
    setOriginalDragState(dragState);
    setVisualDragState({
      projectId: dragState.projectId,
      holidayId: dragState.holidayId,
      action: dragState.action,
      daysDelta: 0,
      isActive: true
    });
  }, []);

  // Update visual position (no database calls)
  const updateVisualPosition = useCallback((clientX: number, startX: number) => {
    if (!originalDragState) return;

    // Throttle to ~60fps
    const now = performance.now();
    if (now - lastUpdateRef.current < 16) return;
    lastUpdateRef.current = now;

    // Cancel previous frame
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }

    // Schedule visual update
    frameRef.current = requestAnimationFrame(() => {
      const deltaX = clientX - startX;
      const columnWidth = timelineMode === 'weeks' ? 77 : 40;
      let daysDelta: number;

      if (timelineMode === 'weeks') {
        const dayWidth = columnWidth / 7; // ~10.286px per day
        daysDelta = Math.round(deltaX / dayWidth);
      } else {
        daysDelta = Math.round(deltaX / columnWidth);
      }

      setVisualDragState(prev => prev ? {
        ...prev,
        daysDelta
      } : null);
    });
  }, [originalDragState, timelineMode]);

  // Commit changes to database (only called once at end)
  const commitDragChanges = useCallback(async () => {
    if (!originalDragState || !visualDragState) return;

    try {
      const { daysDelta } = visualDragState;
      
      if (originalDragState.projectId) {
        const currentProject = projects.find((p: any) => p.id === originalDragState.projectId);
        if (!currentProject) return;

        let updateData: any = {};

        switch (originalDragState.action) {
          case 'resize-start-date':
            const newStartDate = new Date(originalDragState.originalStartDate);
            newStartDate.setDate(newStartDate.getDate() + daysDelta);
            updateData = { startDate: newStartDate };
            break;

          case 'resize-end-date':
            const newEndDate = new Date(originalDragState.originalEndDate);
            newEndDate.setDate(newEndDate.getDate() + daysDelta);
            updateData = { endDate: newEndDate };
            break;

          case 'move':
            const moveStartDate = new Date(originalDragState.originalStartDate);
            const moveEndDate = new Date(originalDragState.originalEndDate);
            
            moveStartDate.setDate(moveStartDate.getDate() + daysDelta);
            moveEndDate.setDate(moveEndDate.getDate() + daysDelta);
            
            updateData = { 
              startDate: moveStartDate,
              endDate: moveEndDate 
            };
            break;
        }

        // Single database update
        await updateProject(originalDragState.projectId, updateData);
        
      } else if (originalDragState.holidayId) {
        const currentHoliday = holidays.find((h: any) => h.id === originalDragState.holidayId);
        if (!currentHoliday) return;

        let updateData: any = {};

        switch (originalDragState.action) {
          case 'resize-start-date':
            const newStartDate = new Date(originalDragState.originalStartDate);
            newStartDate.setDate(newStartDate.getDate() + daysDelta);
            updateData = { startDate: newStartDate };
            break;

          case 'resize-end-date':
            const newEndDate = new Date(originalDragState.originalEndDate);
            newEndDate.setDate(newEndDate.getDate() + daysDelta);
            updateData = { endDate: newEndDate };
            break;

          case 'move':
            const moveStartDate = new Date(originalDragState.originalStartDate);
            const moveEndDate = new Date(originalDragState.originalEndDate);
            
            moveStartDate.setDate(moveStartDate.getDate() + daysDelta);
            moveEndDate.setDate(moveEndDate.getDate() + daysDelta);
            
            updateData = { 
              startDate: moveStartDate,
              endDate: moveEndDate 
            };
            break;
        }

        // Single database update
        await updateHoliday(originalDragState.holidayId, updateData);
      }

    } catch (error) {
      console.error('Failed to commit drag changes:', error);
    }
  }, [originalDragState, visualDragState, projects, holidays, updateProject, updateHoliday]);

  // End drag operation
  const endDrag = useCallback(async () => {
    // Commit changes to database
    await commitDragChanges();

    // Clean up state
    setIsDragging(false);
    setVisualDragState(null);
    setOriginalDragState(null);
    
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
  }, [commitDragChanges]);

  // Cancel drag operation
  const cancelDrag = useCallback(() => {
    setIsDragging(false);
    setVisualDragState(null);
    setOriginalDragState(null);
    
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
  }, []);

  return {
    isDragging,
    visualDragState,
    getVisualPosition,
    startDrag,
    updateVisualPosition,
    endDrag,
    cancelDrag
  };
}
