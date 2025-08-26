import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Ultra-performance drag system for timeline
 * - Visual updates only during drag (no database calls)
 * - Single database update on drag end
 * - Optimistic UI updates for instant feedback
 */

interface DragState {
  type: 'project' | 'holiday' | 'milestone';
  id: string;
  action: 'move' | 'resize-start' | 'resize-end';
  startX: number;
  originalData: any;
  currentOffset: number;
  lastVisualUpdate: number;
}

interface VisualDragUpdates {
  projects: Map<string, { startDate: Date; endDate: Date }>;
  holidays: Map<string, { startDate: Date; endDate: Date }>;
  milestones: Map<string, { dueDate: Date }>;
}

export function useUltraPerformanceDrag() {
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [visualUpdates, setVisualUpdates] = useState<VisualDragUpdates>({
    projects: new Map(),
    holidays: new Map(),
    milestones: new Map()
  });

  const frameRequestRef = useRef<number>();
  const lastUpdateTime = useRef<number>(0);

  // Clear visual updates when drag ends
  const clearVisualUpdates = useCallback(() => {
    setVisualUpdates({
      projects: new Map(),
      holidays: new Map(),
      milestones: new Map()
    });
  }, []);

  // Start drag operation
  const startDrag = useCallback((
    type: 'project' | 'holiday' | 'milestone',
    id: string,
    action: 'move' | 'resize-start' | 'resize-end',
    startX: number,
    originalData: any
  ) => {
    setIsDragging(true);
    setDragState({
      type,
      id,
      action,
      startX,
      originalData,
      currentOffset: 0,
      lastVisualUpdate: 0
    });
    clearVisualUpdates();
  }, [clearVisualUpdates]);

  // Update drag position (visual only)
  const updateDragPosition = useCallback((
    clientX: number,
    dayWidth: number,
    timelineMode: 'days' | 'weeks'
  ) => {
    if (!dragState) return;

    const deltaX = clientX - dragState.startX;
    const daysDelta = Math.round(deltaX / dayWidth);

    // Throttle visual updates to 60fps max
    const now = performance.now();
    if (now - lastUpdateTime.current < 16) return;
    lastUpdateTime.current = now;

    // Cancel previous frame request
    if (frameRequestRef.current) {
      cancelAnimationFrame(frameRequestRef.current);
    }

    // Schedule visual update on next frame
    frameRequestRef.current = requestAnimationFrame(() => {
      setVisualUpdates(prev => {
        const newUpdates = { ...prev };
        
        if (dragState.type === 'project') {
          const originalStart = new Date(dragState.originalData.startDate);
          const originalEnd = new Date(dragState.originalData.endDate);
          
          let newStart = new Date(originalStart);
          let newEnd = new Date(originalEnd);

          switch (dragState.action) {
            case 'move':
              newStart.setDate(originalStart.getDate() + daysDelta);
              newEnd.setDate(originalEnd.getDate() + daysDelta);
              break;
            case 'resize-start':
              newStart.setDate(originalStart.getDate() + daysDelta);
              break;
            case 'resize-end':
              newEnd.setDate(originalEnd.getDate() + daysDelta);
              break;
          }

          newUpdates.projects.set(dragState.id, { startDate: newStart, endDate: newEnd });
        }
        
        return newUpdates;
      });

      setDragState(prev => prev ? { ...prev, currentOffset: daysDelta } : null);
    });
  }, [dragState]);

  // End drag and commit to database
  const endDrag = useCallback(async (
    updateProject: Function,
    updateHoliday: Function,
    updateMilestone: Function
  ) => {
    if (!dragState) return;

    try {
      // Commit all visual updates to database in a batch
      const promises: Promise<any>[] = [];

      // Update projects
      for (const [projectId, data] of visualUpdates.projects) {
        promises.push(updateProject(projectId, data, { silent: true }));
      }

      // Update holidays
      for (const [holidayId, data] of visualUpdates.holidays) {
        promises.push(updateHoliday(holidayId, data, { silent: true }));
      }

      // Update milestones
      for (const [milestoneId, data] of visualUpdates.milestones) {
        promises.push(updateMilestone(milestoneId, data, { silent: true }));
      }

      // Execute all updates in parallel
      await Promise.all(promises);

    } catch (error) {
      console.error('Failed to commit drag updates:', error);
    } finally {
      setIsDragging(false);
      setDragState(null);
      clearVisualUpdates();
      
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    }
  }, [dragState, visualUpdates, clearVisualUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, []);

  return {
    isDragging,
    dragState,
    visualUpdates,
    startDrag,
    updateDragPosition,
    endDrag
  };
}

/**
 * Hook to get visual position during drag
 */
export function useVisualDragPosition(
  itemId: string,
  itemType: 'project' | 'holiday' | 'milestone',
  originalData: any,
  visualUpdates: VisualDragUpdates
) {
  if (itemType === 'project' && visualUpdates.projects.has(itemId)) {
    return visualUpdates.projects.get(itemId);
  }
  
  if (itemType === 'holiday' && visualUpdates.holidays.has(itemId)) {
    return visualUpdates.holidays.get(itemId);
  }
  
  if (itemType === 'milestone' && visualUpdates.milestones.has(itemId)) {
    return visualUpdates.milestones.get(itemId);
  }
  
  return originalData;
}
