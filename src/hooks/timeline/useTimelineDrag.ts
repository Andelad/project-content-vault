import { useState, useCallback, useRef, useEffect } from 'react';
import { calculateDaysDelta } from '../../lib/dragUtils';
import type { DragState, AutoScrollState } from '../../types/core';

interface UseTimelineDragProps {
  projects: any[];
  holidays: any[];
  dates: Date[];
  timelineMode: 'days' | 'weeks';
  updateProject: (id: string, updates: any) => void;
  updateHoliday: (id: string, updates: any) => void;
  setCurrentDate: (date: Date) => void;
}

export function useTimelineDrag({
  projects,
  holidays,
  dates,
  timelineMode,
  updateProject,
  updateHoliday,
  setCurrentDate
}: UseTimelineDragProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [autoScrollState, setAutoScrollState] = useState<AutoScrollState>({
    isScrolling: false,
    direction: null,
    intervalId: null
  });

  // Auto-scroll functions
  const startAutoScroll = useCallback((direction: 'left' | 'right', setViewportStart: (fn: (prev: Date) => Date) => void) => {
    if (autoScrollState.isScrolling && autoScrollState.direction === direction) return;
    
    // Clear any existing auto-scroll
    if (autoScrollState.intervalId) {
      clearInterval(autoScrollState.intervalId);
    }
    
    const scrollAmount = timelineMode === 'weeks' ? 7 : 3;
    const intervalMs = 150;
    
    const intervalId = setInterval(() => {
      setViewportStart(prevStart => {
        const newStart = new Date(prevStart);
        const days = direction === 'left' ? -scrollAmount : scrollAmount;
        newStart.setDate(prevStart.getDate() + days);
        setCurrentDate(new Date(newStart));
        return newStart;
      });
    }, intervalMs);
    
    setAutoScrollState({
      isScrolling: true,
      direction,
      intervalId
    });
  }, [autoScrollState, timelineMode, setCurrentDate]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollState.intervalId) {
      clearInterval(autoScrollState.intervalId);
    }
    setAutoScrollState({
      isScrolling: false,
      direction: null,
      intervalId: null
    });
  }, [autoScrollState.intervalId]);

  const checkAutoScroll = useCallback((clientX: number, setViewportStart: (fn: (prev: Date) => Date) => void) => {
    if (!isDragging) return;
    
    const timelineContent = document.querySelector('.timeline-content-area');
    if (!timelineContent) return;
    
    const rect = timelineContent.getBoundingClientRect();
    const scrollThreshold = 80;
    
    const distanceFromLeft = clientX - rect.left;
    const distanceFromRight = rect.right - clientX;
    
    if (distanceFromLeft < scrollThreshold && distanceFromLeft >= 0) {
      startAutoScroll('left', setViewportStart);
    } else if (distanceFromRight < scrollThreshold && distanceFromRight >= 0) {
      startAutoScroll('right', setViewportStart);
    } else {
      stopAutoScroll();
    }
  }, [isDragging, startAutoScroll, stopAutoScroll]);

  // Project drag handler
  const handleProjectMouseDown = useCallback((e: React.MouseEvent, projectId: string, action: string) => {
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;
    
    const initialDragState: DragState = {
      projectId,
      action: action as any,
      startX: e.clientX,
      startY: e.clientY,
      originalStartDate: new Date(targetProject.startDate),
      originalEndDate: new Date(targetProject.endDate),
      lastDaysDelta: 0
    };
    
    setIsDragging(true);
    setDragState(initialDragState);
    
    return initialDragState;
  }, [projects]);

  // Holiday drag handler
  const handleHolidayMouseDown = useCallback((e: React.MouseEvent, holidayId: string, action: string) => {
    const targetHoliday = holidays.find(h => h.id === holidayId);
    if (!targetHoliday) return;
    
    const initialDragState: DragState = {
      holidayId,
      action: action as any,
      startX: e.clientX,
      startY: e.clientY,
      originalStartDate: new Date(targetHoliday.startDate),
      originalEndDate: new Date(targetHoliday.endDate),
      lastDaysDelta: 0
    };
    
    setIsDragging(true);
    setDragState(initialDragState);
    
    return initialDragState;
  }, [holidays]);

  // Process drag movement for projects
  const processDragMovement = useCallback((
    e: MouseEvent, 
    dragState: DragState,
    setViewportStart: (fn: (prev: Date) => Date) => void
  ) => {
    if (!dragState) return;

    const daysDelta = calculateDaysDelta(e.clientX, dragState.startX, dates, true, timelineMode);
    checkAutoScroll(e.clientX, setViewportStart);

    if (daysDelta === dragState.lastDaysDelta) return;

    if (dragState.projectId) {
      const currentProject = projects.find(p => p.id === dragState.projectId);
      if (!currentProject) return;

      switch (dragState.action) {
        case 'resize-start-date':
          const newStartDate = new Date(dragState.originalStartDate);
          newStartDate.setDate(newStartDate.getDate() + daysDelta);
          
          const endDate = new Date(currentProject.endDate);
          const oneDayBefore = new Date(endDate);
          oneDayBefore.setDate(endDate.getDate() - 1);
          
          if (newStartDate <= oneDayBefore) {
            updateProject(dragState.projectId, { startDate: newStartDate });
            dragState.lastDaysDelta = daysDelta;
          }
          break;

        case 'resize-end-date':
          const newEndDate = new Date(dragState.originalEndDate);
          newEndDate.setDate(newEndDate.getDate() + daysDelta);
          
          const startDate = new Date(currentProject.startDate);
          const oneDayAfter = new Date(startDate);
          oneDayAfter.setDate(startDate.getDate() + 1);
          
          if (newEndDate >= oneDayAfter) {
            updateProject(dragState.projectId, { endDate: newEndDate });
            dragState.lastDaysDelta = daysDelta;
          }
          break;

        case 'move':
          const moveStartDate = new Date(dragState.originalStartDate);
          const moveEndDate = new Date(dragState.originalEndDate);
          
          moveStartDate.setDate(moveStartDate.getDate() + daysDelta);
          moveEndDate.setDate(moveEndDate.getDate() + daysDelta);
          
          updateProject(dragState.projectId, { 
            startDate: moveStartDate,
            endDate: moveEndDate 
          });
          dragState.lastDaysDelta = daysDelta;
          break;
      }
    } else if (dragState.holidayId) {
      const currentHoliday = holidays.find(h => h.id === dragState.holidayId);
      if (!currentHoliday) return;

      switch (dragState.action) {
        case 'resize-start-date':
          const newStartDate = new Date(dragState.originalStartDate);
          newStartDate.setDate(newStartDate.getDate() + daysDelta);
          
          const endDate = new Date(currentHoliday.endDate);
          const oneDayBefore = new Date(endDate);
          oneDayBefore.setDate(endDate.getDate() - 1);
          
          if (newStartDate <= oneDayBefore) {
            updateHoliday(dragState.holidayId, { startDate: newStartDate });
            dragState.lastDaysDelta = daysDelta;
          }
          break;

        case 'resize-end-date':
          const newEndDate = new Date(dragState.originalEndDate);
          newEndDate.setDate(newEndDate.getDate() + daysDelta);
          
          const startDate = new Date(currentHoliday.startDate);
          const oneDayAfter = new Date(startDate);
          oneDayAfter.setDate(startDate.getDate() + 1);
          
          if (newEndDate >= oneDayAfter) {
            updateHoliday(dragState.holidayId, { endDate: newEndDate });
            dragState.lastDaysDelta = daysDelta;
          }
          break;

        case 'move':
          const moveStartDate = new Date(dragState.originalStartDate);
          const moveEndDate = new Date(dragState.originalEndDate);
          
          moveStartDate.setDate(moveStartDate.getDate() + daysDelta);
          moveEndDate.setDate(moveEndDate.getDate() + daysDelta);
          
          updateHoliday(dragState.holidayId, { 
            startDate: moveStartDate,
            endDate: moveEndDate 
          });
          dragState.lastDaysDelta = daysDelta;
          break;
      }
    }
  }, [projects, holidays, dates, timelineMode, updateProject, updateHoliday, checkAutoScroll]);

  // Cleanup on unmount
  useEffect(() => {
    if (!isDragging) {
      stopAutoScroll();
    }
  }, [isDragging, stopAutoScroll]);

  useEffect(() => {
    return () => {
      if (autoScrollState.intervalId) {
        clearInterval(autoScrollState.intervalId);
      }
    };
  }, [autoScrollState.intervalId]);

  // End drag operation
  const endDrag = useCallback(() => {
    setIsDragging(false);
    setDragState(null);
    stopAutoScroll();
  }, [stopAutoScroll]);

  return {
    isDragging,
    dragState,
    handleProjectMouseDown,
    handleHolidayMouseDown,
    processDragMovement,
    endDrag,
    checkAutoScroll
  };
}