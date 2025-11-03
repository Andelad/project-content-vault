import { useCallback } from 'react';
import { toast } from './use-toast';
import { 
  TimelineDragCoordinatorService,
  initializeHolidayDragState,
  throttledDragUpdate,
  throttledVisualUpdate,
  addDaysToDate
} from '@/services';

interface UseHolidayDragProps {
  holidays: any[];
  projects: any[];
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  timelineMode: 'days' | 'weeks';
  updateHoliday: (id: string, updates: any, options?: any) => Promise<any>;
  checkAutoScroll: (clientX: number) => void;
  stopAutoScroll: () => void;
  setIsDragging: (dragging: boolean) => void;
  setDragState: (state: any) => void;
  dragState: any;
}

/**
 * Custom hook for handling holiday drag operations (move and resize)
 * Coordinates with TimelineDragCoordinatorService for calculations
 */
export function useHolidayDrag({
  holidays,
  projects,
  dates,
  viewportStart,
  viewportEnd,
  timelineMode,
  updateHoliday,
  checkAutoScroll,
  stopAutoScroll,
  setIsDragging,
  setDragState,
  dragState
}: UseHolidayDragProps) {
  
  const handleHolidayMouseDown = useCallback((e: React.MouseEvent, holidayId: string, action: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const targetHoliday = holidays.find(h => h.id === holidayId);
    if (!targetHoliday) return;
    
    // Use unified drag initialization
    const initialDragState = initializeHolidayDragState(
      holidayId,
      new Date(targetHoliday.startDate),
      new Date(targetHoliday.endDate),
      e.clientX,
      e.clientY,
      action as 'move' | 'resize-start-date' | 'resize-end-date',
      timelineMode
    );
    
    setIsDragging(true);
    setDragState(initialDragState);
    
    const handleMouseMove = (e: MouseEvent) => {
      try {
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
              // Allow start date to equal end date (single day holiday)
              if (newStartDate <= endDate) {
                updateHoliday(holidayId, { startDate: newStartDate }, { silent: true });
              }
            } else if (action === 'resize-end-date') {
              const newEndDate = addDaysToDate(new Date(initialDragState.originalEndDate), daysDelta);
              const startDate = new Date(initialDragState.originalStartDate);
              // Allow end date to equal start date (single day holiday)
              if (newEndDate >= startDate) {
                updateHoliday(holidayId, { endDate: newEndDate }, { silent: true });
              }
            } else if (action === 'move') {
              const newStartDate = addDaysToDate(new Date(initialDragState.originalStartDate), daysDelta);
              const newEndDate = addDaysToDate(new Date(initialDragState.originalEndDate), daysDelta);
              updateHoliday(holidayId, { 
                startDate: newStartDate,
                endDate: newEndDate 
              }, { silent: true });
            }
          }, throttleMs);
        }
      } catch (error) {
        console.error('🚨 HOLIDAY DRAG ERROR:', error);
      }
    };
    
    const handleMouseUp = () => {
      // Only show toast if there was actual movement (daysDelta !== 0)
      const daysDelta = dragState?.lastDaysDelta || initialDragState.lastDaysDelta || 0;
      
      setIsDragging(false);
      setDragState(null);
      stopAutoScroll();
      
      // Only show success toast if the holiday was actually moved/resized
      if (daysDelta !== 0) {
        toast({
          title: "Success",
          description: "Holiday updated successfully",
        });
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
        handleMouseMove({ clientX: touch.clientX } as MouseEvent);
      }
    };
    
    // Add comprehensive event listeners for all input types (mouse, pen, touch)
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('pointermove', handleMouseMove);
    document.addEventListener('pointerup', handleMouseUp);
    document.addEventListener('pointercancel', handleMouseUp); // Critical for pen input
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('touchcancel', handleMouseUp);
  }, [
    holidays,
    projects,
    dates,
    viewportStart,
    viewportEnd,
    timelineMode,
    updateHoliday,
    checkAutoScroll,
    stopAutoScroll,
    setIsDragging,
    setDragState,
    dragState
  ]);
  
  return { handleHolidayMouseDown };
}
