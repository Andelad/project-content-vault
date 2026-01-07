import { useCallback } from 'react';
import { toast } from '@/hooks/ui/use-toast';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import {
  TimelineDragCoordinatorService,
  initializeHolidayDragState,
  addDaysToDate
} from '@/services';
import type { Holiday, Project } from '@/types/core';
import type { DragState } from '@/services/ui/DragPositioning';

interface UseHolidayDragProps {
  holidays: Holiday[];
  projects: Project[];
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  timelineMode: 'days' | 'weeks';
  updateHoliday: (id: string, updates: Partial<Holiday>, options?: { silent?: boolean }) => Promise<unknown>;
  checkAutoScroll: (clientX: number) => void;
  stopAutoScroll: () => void;
  setIsDragging: (dragging: boolean) => void;
  setDragState: (state: DragState | null) => void;
  dragState: DragState | null;
}

/**
 * Check if a holiday date range overlaps with any existing holidays
 * 
 * @param startDate - Proposed start date for the holiday
 * @param endDate - Proposed end date for the holiday
 * @param currentHolidayId - ID of the holiday being dragged (excluded from overlap check)
 * @param allHolidays - Array of all existing holidays
 * @returns true if there's an overlap with another holiday, false otherwise
 */
function checkHolidayOverlap(
  startDate: Date,
  endDate: Date,
  currentHolidayId: string,
  allHolidays: Holiday[]
): boolean {
  return allHolidays.some(holiday => {
    // Skip the holiday being dragged
    if (holiday.id === currentHolidayId) return false;
    
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    
    // Normalize all dates to midnight for comparison
    holidayStart.setHours(0, 0, 0, 0);
    holidayEnd.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    
    // Check if dates overlap
    return startDate <= holidayEnd && holidayStart <= endDate;
  });
}

/**
 * Custom hook for handling holiday drag operations (move and resize)
 * 
 * Coordinates with TimelineDragCoordinatorService for smooth, responsive dragging.
 * Implements the same drag pattern as project bars:
 * - Visual updates only during drag (no database writes)
 * - Single database update on mouseUp
 * - Overlap validation before committing changes
 * - Supports mouse, touch, and pen input
 * 
 * @param props - Configuration object with timeline context and callbacks
 * @returns Object containing handleHolidayMouseDown callback
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
  
  const handleHolidayMouseDown = useCallback((e: React.MouseEvent, holidayId: string, action: 'move' | 'resize-start-date' | 'resize-end-date') => {
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
      action,
      timelineMode
    );
    
    setIsDragging(true);
    setDragState(initialDragState);
    
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
            dates
          }
        );
        
        // Check for auto-scroll during drag
        if (result.autoScrollConfig?.shouldScroll) {
          checkAutoScroll(e.clientX);
        }
        
        // Update visual state immediately for smooth dragging (like projects)
        if (result.shouldUpdate || action === 'resize-start-date' || action === 'resize-end-date' || action === 'move') {
          currentDragStateRef = result.newDragState; // Keep latest state in closure
          setDragState(result.newDragState);
        }
        
        // Note: We do NOT update the database during drag (only on mouse release)
        // This matches project bar behavior for smooth, responsive dragging
      } catch (error) {
        ErrorHandlingService.handle(error, { source: 'useHolidayDrag', action: '🚨 HOLIDAY DRAG ERROR:' });
      }
    };
    
    const handleMouseUp = async () => {
      // Capture final delta from closure ref
      const daysDelta = currentDragStateRef?.lastDaysDelta || 0;
      
      setIsDragging(false);
      setDragState(null);
      stopAutoScroll();
      
      // Perform final update to sync local state with database
      // This ensures the holiday stays in its new position after drag ends
      if (daysDelta !== 0) {
        try {
          let newStartDate: Date, newEndDate: Date;
          let isValid = false;
          
          if (action === 'resize-start-date') {
            newStartDate = addDaysToDate(new Date(initialDragState.originalStartDate), daysDelta);
            newEndDate = new Date(initialDragState.originalEndDate);
            
            // Validate: start date must be <= end date and no overlaps
            isValid = newStartDate <= newEndDate && 
                      !checkHolidayOverlap(newStartDate, newEndDate, holidayId, holidays);
            
            if (isValid) {
              await updateHoliday(holidayId, { startDate: newStartDate }, { silent: false });
            }
          } else if (action === 'resize-end-date') {
            newStartDate = new Date(initialDragState.originalStartDate);
            newEndDate = addDaysToDate(new Date(initialDragState.originalEndDate), daysDelta);
            
            // Validate: end date must be >= start date and no overlaps
            isValid = newEndDate >= newStartDate && 
                      !checkHolidayOverlap(newStartDate, newEndDate, holidayId, holidays);
            
            if (isValid) {
              await updateHoliday(holidayId, { endDate: newEndDate }, { silent: false });
            }
          } else if (action === 'move') {
            newStartDate = addDaysToDate(new Date(initialDragState.originalStartDate), daysDelta);
            newEndDate = addDaysToDate(new Date(initialDragState.originalEndDate), daysDelta);
            
            // Validate: no overlaps
            isValid = !checkHolidayOverlap(newStartDate, newEndDate, holidayId, holidays);
            
            if (isValid) {
              await updateHoliday(holidayId, { 
                startDate: newStartDate,
                endDate: newEndDate 
              }, { silent: false });
            }
          }
          
          // If the final position was invalid, show a warning
          if (!isValid) {
            toast({
              title: "Invalid Position",
              description: "Holiday cannot overlap with existing holidays",
              variant: "destructive",
            });
          }
        } catch (error) {
          ErrorHandlingService.handle(error, { source: 'useHolidayDrag', action: 'Error in final holiday update:' });
        }
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
        const syntheticMouse: Pick<MouseEvent, 'clientX'> = { clientX: touch.clientX };
        handleMouseMove(syntheticMouse as MouseEvent);
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
    setDragState
  ]);
  
  return { handleHolidayMouseDown };
}
