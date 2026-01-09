import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useHolidays } from '@/presentation/hooks/data/useHolidays';
import { ParasolIcon } from '@/shared/assets';
import { normalizeToMidnight, normalizeToEndOfDay, addDaysToDate, calculateOccupiedHolidayIndices, convertIndicesToDates } from '@/presentation/utils/dateCalculations';
import { convertMousePositionToTimelineIndex } from '@/presentation/services/ProjectBarPositioning';;
import type { Holiday } from '@/shared/types/core';
import type { DragState } from '@/presentation/services/DragPositioning';
import type { TimelinePositionCalculation } from '@/presentation/services/ProjectBarPositioning';

type HolidayDragAction = 'move' | 'resize-start-date' | 'resize-end-date';

type HolidaySegment = {
  startIndex: number;
  dayCount: number;
  id: string;
  title: string;
  weekMode: boolean;
  actualStartWeek?: number;
  actualEndWeek?: number;
};

type HolidayMouseEvent = Pick<React.MouseEvent, 'clientX' | 'clientY' | 'preventDefault' | 'stopPropagation'>;

type TouchLikeMouseEvent = HolidayMouseEvent;

interface HolidayBarProps {
  dates: Date[];
  collapsed: boolean;
  isDragging?: boolean;
  dragState?: DragState | null;
  handleHolidayMouseDown?: (e: HolidayMouseEvent, holidayId: string, action: HolidayDragAction) => void;
  mode?: 'days' | 'weeks';
  // Modal handlers - passed from parent to control holiday modal
  onCreateHoliday?: (startDate: Date, endDate: Date) => void;
  onEditHoliday?: (holidayId: string) => void;
}

// Constants for holiday bar dimensions (matching project bar patterns)
const HOLIDAY_BAR_HEIGHT = 40; // px - h-10 Tailwind class
const RESIZE_HANDLE_WIDTH = 6; // px - matches project bar RESIZE_ZONE_WIDTH
const RESIZE_HANDLE_Z_INDEX = 3;

/**
 * Calculate visual holiday dates during drag operations
 * 
 * Applies day offset from dragState to show immediate visual feedback
 * without waiting for database updates. This creates smooth, responsive
 * dragging that matches project bar behavior.
 * 
 * @param holiday - Holiday object with startDate and endDate
 * @param isDragging - Whether a drag operation is in progress
 * @param dragState - Current drag state containing offset information
 * @returns Object with visualStartDate and visualEndDate
 */
function calculateVisualHolidayDates(
  holiday: Holiday,
  isDragging: boolean,
  dragState: DragState | null
): { visualStartDate: Date; visualEndDate: Date } {
  let visualStartDate = new Date(holiday.startDate);
  let visualEndDate = new Date(holiday.endDate);

  // Apply drag offset for immediate visual feedback
  if (isDragging && dragState?.holidayId === holiday.id) {
    const daysOffset = dragState.lastDaysDelta || 0;
    const action = dragState.action;

    if (action === 'move') {
      // Move both start and end
      visualStartDate = new Date(holiday.startDate);
      visualStartDate.setDate(visualStartDate.getDate() + daysOffset);
      visualEndDate = new Date(holiday.endDate);
      visualEndDate.setDate(visualEndDate.getDate() + daysOffset);
    } else if (action === 'resize-start-date') {
      // Only move start date
      visualStartDate = new Date(holiday.startDate);
      visualStartDate.setDate(visualStartDate.getDate() + daysOffset);
      // End date stays the same
    } else if (action === 'resize-end-date') {
      // Only move end date
      visualEndDate = new Date(holiday.endDate);
      visualEndDate.setDate(visualEndDate.getDate() + daysOffset);
      // Start date stays the same
    }
  }

  return { visualStartDate, visualEndDate };
}

export function HolidayBar({ dates, collapsed, isDragging, dragState, handleHolidayMouseDown, mode = 'days', onCreateHoliday, onEditHoliday }: HolidayBarProps) {
  const { holidays: globalHolidays, addHoliday } = useHolidays();
  
  // Wrapper to use prop callback if provided
  const setCreatingNewHoliday = useCallback((data: { startDate: Date; endDate: Date }) => {
    if (onCreateHoliday) {
      onCreateHoliday(data.startDate, data.endDate);
    }
  }, [onCreateHoliday]);

  const setEditingHolidayId = useCallback((holidayId: string) => {
    if (onEditHoliday) {
      onEditHoliday(holidayId);
    }
  }, [onEditHoliday]);
  
  // Hover interaction state
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  
  // Use refs to track current drag state for event handlers
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);
  
  // Convert global holidays to timeline format with visual drag feedback
  // CRITICAL: Must recalculate whenever dragState changes for smooth drag visual feedback
  const timelineHolidays = useMemo<HolidaySegment[]>(() => {
    const segments: HolidaySegment[] = [];

    globalHolidays.forEach((holiday) => {
    // Calculate visual dates if this holiday is being dragged
    const { visualStartDate, visualEndDate } = calculateVisualHolidayDates(holiday, isDragging, dragState);
    if (mode === 'weeks') {
      // For weeks mode, we need to calculate which weeks contain the holiday
      // and then calculate the exact day positions within those weeks
      const holidayStart = normalizeToMidnight(new Date(visualStartDate));
      const holidayEnd = normalizeToMidnight(new Date(visualEndDate));
      
      // Find which week columns this holiday spans
      let startWeekIndex = -1;
      let endWeekIndex = -1;
      
      dates.forEach((weekStart, weekIndex) => {
        const weekStartMidnight = normalizeToMidnight(new Date(weekStart));
        const weekEnd = normalizeToEndOfDay(addDaysToDate(weekStartMidnight, 6));
        
        // Check if holiday overlaps with this week
        if (!(holidayEnd < weekStartMidnight || holidayStart > weekEnd)) {
          if (startWeekIndex === -1) {
            startWeekIndex = weekIndex;
          }
          endWeekIndex = weekIndex;
        }
      });
      
      if (startWeekIndex === -1) {
        return;
      }
      
      // Calculate the day-level start and end indices
      const firstWeekStart = dates[startWeekIndex];
      const msPerDay = 24 * 60 * 60 * 1000;
      
      // Calculate start day index (within the week view timeline)
      const daysFromFirstWeekToHolidayStart = Math.floor((holidayStart.getTime() - firstWeekStart.getTime()) / msPerDay);
      const startDayIndex = startWeekIndex * 7 + daysFromFirstWeekToHolidayStart;
      
      // Calculate end day index
      const daysFromFirstWeekToHolidayEnd = Math.floor((holidayEnd.getTime() - firstWeekStart.getTime()) / msPerDay);
      const endDayIndex = startWeekIndex * 7 + daysFromFirstWeekToHolidayEnd;
      
      // Calculate the day count for display
      const dayCount = endDayIndex - startDayIndex + 1;
      
      segments.push({
        startIndex: startDayIndex,
        dayCount,
        id: holiday.id,
        title: holiday.title,
        weekMode: true,
        actualStartWeek: startWeekIndex,
        actualEndWeek: endWeekIndex
      });
    } else {
      // Days mode: Calculate position relative to viewport, but maintain full holiday width
      const holidayStart = normalizeToMidnight(new Date(visualStartDate));
      // Use midnight for end as well to match overlay logic and avoid DST off-by-one
      const holidayEnd = normalizeToMidnight(new Date(visualEndDate));
      
  if (dates.length === 0) return;
      
      const firstVisibleDate = dates[0];
      const lastVisibleDate = dates[dates.length - 1];
      const msPerDay = 24 * 60 * 60 * 1000;
      
      // Calculate the actual start index relative to the first visible date
      // This can be negative if the holiday starts before the viewport
      const startIndex = Math.floor((holidayStart.getTime() - firstVisibleDate.getTime()) / msPerDay);
      
      // Calculate the full duration of the holiday in days (inclusive)
      const dayCount = Math.floor((holidayEnd.getTime() - holidayStart.getTime()) / msPerDay) + 1;
      
      // Check if holiday is completely outside viewport (optimization)
      const holidayEndIndex = startIndex + dayCount - 1;
      const lastVisibleIndex = dates.length - 1;
      
      if (holidayEndIndex < 0 || startIndex > lastVisibleIndex) {
        return;
      }

      segments.push({
        startIndex,
        dayCount,
        id: holiday.id,
        title: holiday.title,
        weekMode: false
      });
    }
    });

    return segments;
  }, [globalHolidays, dates, mode, isDragging, dragState]);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate which date indices are occupied by existing holidays
  const occupiedIndices = useMemo(() => {
    return calculateOccupiedHolidayIndices(globalHolidays, dates, mode);
  }, [globalHolidays, dates, mode]);

  // Handle holiday creation after drag
  const handleCreateHoliday = useCallback((startDate: Date, endDate: Date) => {
    // Instead of creating the holiday immediately, store the date range for the modal
    setCreatingNewHoliday({ startDate, endDate });
  }, [setCreatingNewHoliday]);

  // Mouse handlers for hover-to-create interaction
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragStart !== null || isDragging) return; // Don't update hover during any drag operation

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    
    // Don't show hover in the first 52px (days) / 153px (weeks) where the add holiday button is
    if (relativeX < 52) {
      setHoveredIndex(null);
      return;
    }
    
    const { dayIndex: index, isValid } = convertMousePositionToTimelineIndex(
      e.clientX,
      rect,
      dates,
      mode,
      occupiedIndices
    );

    if (isValid) {
      setHoveredIndex(index);
    } else {
      setHoveredIndex(null);
    }
  }, [dates, occupiedIndices, dragStart, isDragging, mode]);

  const handleMouseLeave = useCallback(() => {
    if (dragStart === null && !isDragging) {
      setHoveredIndex(null);
    }
  }, [dragStart, isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't handle mouse down if we're over an occupied area (existing holiday)
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    
    // Don't handle clicks in the first 52px (days) / 153px (weeks) where the add holiday button is
    if (relativeX < 52) {
      return;
    }
    
    const { dayIndex: clickIndex, isValid: clickIsValid } = convertMousePositionToTimelineIndex(
      e.clientX,
      rect,
      dates,
      mode,
      occupiedIndices
    );

    if (!clickIsValid) {
      // Let the event bubble up to the holiday bar handlers
      return;
    }
    
    // Calculate the index directly in mouse down in case hover didn't update
    const targetIndex = (clickIndex >= 0 && clickIndex < (mode === 'weeks' ? dates.length * 7 : dates.length)) ? clickIndex : hoveredIndex;
    
    if (targetIndex === null || occupiedIndices.includes(targetIndex)) {
      return;
    }
    
    e.preventDefault();
    setDragStart(targetIndex);
    setDragEnd(targetIndex);
    
    // Also update refs for immediate access in event handlers
    dragStartRef.current = targetIndex;
    dragEndRef.current = targetIndex;

    const handleMouseMoveGlobal = (e: MouseEvent) => {
      const container = document.querySelector('.holiday-drag-container');
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const { dayIndex: index } = convertMousePositionToTimelineIndex(
        e.clientX,
        rect,
        dates,
        mode,
        occupiedIndices
      );

      setDragEnd(index);
      dragEndRef.current = index; // Update ref immediately
    };

    const handleMouseUp = () => {
      // Use refs for immediate access to current values
      const currentDragStart = dragStartRef.current;
      const currentDragEnd = dragEndRef.current;
      
      if (currentDragStart !== null && currentDragEnd !== null) {
        const startIndex = Math.min(currentDragStart, currentDragEnd);
        const endIndex = Math.max(currentDragStart, currentDragEnd);
        
        // Check if the entire range is free
        let canCreate = true;
        for (let i = startIndex; i <= endIndex; i++) {
          if (occupiedIndices.includes(i)) {
            canCreate = false;
            break;
          }
        }
        
        if (canCreate) {
          const dateRange = convertIndicesToDates([startIndex, endIndex], dates, mode);
          const startDate = dateRange[0];
          const endDate = dateRange[1] || startDate;

          handleCreateHoliday(startDate, endDate);
        }
      }
      
      // Reset drag state
      setDragStart(null);
      setDragEnd(null);
      setHoveredIndex(null);
      dragStartRef.current = null;
      dragEndRef.current = null;
      
      document.removeEventListener('mousemove', handleMouseMoveGlobal);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMoveGlobal);
    document.addEventListener('mouseup', handleMouseUp);
  }, [hoveredIndex, occupiedIndices, dates, mode, handleCreateHoliday]);

  // Render preview of where holiday would be created
  const renderPreview = () => {
    let startIndex: number, endIndex: number;
    let isValid = true;
    
    if (dragStart !== null && dragEnd !== null) {
      // During drag
      startIndex = Math.min(dragStart, dragEnd);
      endIndex = Math.max(dragStart, dragEnd);
      
      // Check if entire range is valid
      for (let i = startIndex; i <= endIndex; i++) {
        if (occupiedIndices.includes(i)) {
          isValid = false;
          break;
        }
      }
    } else if (hoveredIndex !== null) {
      // Just hovering - use simple index logic
      const minStartIndex = hoveredIndex;
      const minEndIndex = hoveredIndex; // Minimum size is just one day/week
      
      // Check if index is valid
      if (minStartIndex === -1 || minEndIndex === -1) {
        return null; // No valid range available
      }
      
      startIndex = minStartIndex;
      endIndex = minEndIndex;
    } else {
      return null;
    }
    
    let width: number, left: number;
    
    if (mode === 'weeks') {
      // For week mode with day-level precision
      const dayWidth = 22; // 22px effective spacing (21px + 1px gap)
      width = (endIndex - startIndex + 1) * dayWidth;
      left = startIndex * dayWidth;
    } else {
      // Days mode: use actual column width to match timeline
      const columnWidth = 52; // Match TimelineView's column width
      width = (endIndex - startIndex + 1) * columnWidth;
      left = startIndex * columnWidth;
    }
    
    return (
      <div
        className={`absolute top-1/2 -translate-y-1/2 h-10 border border-solid rounded-md pointer-events-none z-[4] flex items-center justify-center ${
          isValid 
            ? 'bg-orange-100/50 border-orange-300/30' 
            : 'bg-red-100/50 border-red-400'
        }`}
        style={{
          left: `${left}px`,
          width: `${width}px`
        }}
      >
        <span className="text-xs font-medium text-orange-800">
          Add Holiday
        </span>
      </div>
    );
  };

  const dayWidth = dates.length > 0 ? (containerRef.current?.clientWidth || 0) / dates.length : 0;

  return (
    <div className="h-[52px] bg-white relative">
      {/* Timeline section */}
      <div 
        ref={containerRef}
        className="flex-1 relative flex h-full"
      >
        {/* Sticky Add Holiday Icon - matches project indicator style */}
        <div className="absolute left-0 top-0 z-50 pointer-events-auto" style={{ width: '52px', height: '52px' }}>
          <button
            onClick={() => {
              const today = normalizeToMidnight(new Date());
              const endDate = addDaysToDate(today, 2); // 2 days from today
              setCreatingNewHoliday({ startDate: today, endDate });
            }}
            className="absolute top-[10px] left-[10px] w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-md hover:shadow-lg drop-shadow-sm hover:brightness-95 group bg-stone-200"
            title="Add holiday"
          >
            {/* Parasol icon - default state */}
            <div className="transition-opacity duration-200 group-hover:opacity-0">
              <ParasolIcon className="w-4 h-4 text-foreground" />
            </div>
            
            {/* Plus icon - hover state */}
            <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 opacity-0 group-hover:opacity-100">
              <Plus className="w-4 h-4 text-foreground" />
            </div>
          </button>
        </div>
        
        {/* Hover-to-create holiday interaction layer */}
        <div
          className="absolute inset-0 cursor-pointer holiday-drag-container"
          style={{ zIndex: 1 }} // Above container but below holiday bars (z-[5])
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
        >
          {renderPreview()}
        </div>

        {/* Holiday display columns */}
        {dates.map((date, dayIndex) => {
          let holidays: (HolidaySegment | null)[] = [];
          
          if (mode === 'weeks') {
            // In week mode, show ALL holidays that should be rendered in this week column
            // Filter all holidays that span this week and should render here
            holidays = timelineHolidays.filter(h => 
              h.weekMode && 
              dayIndex >= h.actualStartWeek! && 
              dayIndex <= h.actualEndWeek! &&
              dayIndex === h.actualStartWeek // Only render in the first week to avoid duplicates
            );
          } else {
            // Days mode: dayIndex represents actual day index
            // Show all holidays in each day it spans
            holidays = timelineHolidays.filter(h => 
              dayIndex >= h.startIndex && dayIndex < h.startIndex + h.dayCount
            );
          }
          
          // If no holidays for this column, render empty column
          if (holidays.length === 0) {
            holidays = [null];
          }
          
          // Add 1px to first column to account for alignment offset
          const columnWidth = mode === 'weeks' 
            ? (dayIndex === 0 ? 154 : 153)
            : 52;
          
          return (
            <div 
              key={dayIndex}
              className="relative h-[52px] flex items-center justify-center border-r border-gray-100 last:border-r-0"
              style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}
            >
              {/* Render all holidays in this column */}
              {holidays.map((holiday, holidayIndex) => (
                <IndividualHolidayBar
                  key={holiday ? `${dayIndex}-${holiday.id}` : `${dayIndex}-empty`}
                  dayIndex={dayIndex}
                  date={date}
                  holiday={holiday}
                  onHolidayClick={(holidayId) => setEditingHolidayId(holidayId)}
                  isDragging={isDragging}
                  dragState={dragState}
                  handleHolidayMouseDown={handleHolidayMouseDown}
                  mode={mode}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface IndividualHolidayBarProps {
  dayIndex: number;
  date: Date;
  holiday?: HolidaySegment | null;
  onHolidayClick: (holidayId: string) => void;
  isDragging?: boolean;
  dragState?: DragState | null;
  handleHolidayMouseDown?: (e: HolidayMouseEvent, holidayId: string, action: HolidayDragAction) => void;
  mode?: 'days' | 'weeks';
}

function IndividualHolidayBar({ 
  dayIndex, 
  date, 
  holiday, 
  onHolidayClick,
  isDragging,
  dragState,
  handleHolidayMouseDown,
  mode = 'days'
}: IndividualHolidayBarProps) {
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  
  const handleHolidayMouseDownWithClickDetection = (e: HolidayMouseEvent, holidayId: string, action: HolidayDragAction) => {
    e.stopPropagation(); // Prevent event bubbling
    setMouseDownTime(Date.now());
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setHasMoved(false);
    
    if (handleHolidayMouseDown) {
      handleHolidayMouseDown(e, holidayId, action);
    }
  };

  const handleHolidayMouseUp = (e: React.MouseEvent, holidayId: string) => {
    const currentTime = Date.now();
    const timeDiff = mouseDownTime ? currentTime - mouseDownTime : 0;
    
    // Quick click detection - if it was fast and didn't move much, treat as click
    if (timeDiff < 200 && !hasMoved && mouseDownPos) {
      const moveDist = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      
      // If moved less than 3 pixels, consider it a click
      if (moveDist < 3) {
        e.stopPropagation();
        onHolidayClick(holidayId);
      }
    }
    
    setMouseDownTime(null);
    setMouseDownPos(null);
    setHasMoved(false);
  };

  const handleHolidayMouseMove = (e: React.MouseEvent) => {
    if (mouseDownPos) {
      const moveDist = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      // Mark as moved if moved more than 3 pixels
      if (moveDist > 3) {
        setHasMoved(true);
      }
    }
  };
  
  // If no holiday, render nothing (the wrapper div is already created)
  if (!holiday) {
    return null;
  }
  
  return (
    <>
      {/* Existing holiday display - show if holiday exists for this column */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 h-10 border border-orange-300/50 rounded-md flex items-center justify-center text-orange-800 text-sm shadow-sm z-[1] ${
          isDragging && dragState?.holidayId === holiday.id 
            ? 'opacity-90 shadow-lg bg-orange-200/80' 
            : 'hover:bg-orange-300/80 bg-orange-200/80'
        }`}
        style={(() => {
          if (mode === 'weeks') {
            // For week mode, calculate the precise positioning within week columns
            const dayWidth = 22; // 22px effective spacing (21px + 1px gap)
            
            // Use modulo to get position within the current week
            const holidayStartInCurrentWeek = holiday.startIndex % 7; // Day of week (0-6)
            // Add 1px left offset to first day to create gap
            const leftOffset = holidayStartInCurrentWeek * dayWidth + 1;
            
            // Calculate the width based on how many days the holiday spans
            // Subtract 2px (1px from each end) to create 2px total gap
            const width = (holiday.dayCount * dayWidth) - 2;
            
            return {
              left: `${leftOffset}px`,
              width: `${width}px`,
            };
          } else {
            // Days mode: Handle holidays that extend beyond viewport
            // Calculate how far into the holiday this dayIndex is
            const dayIntoHoliday = dayIndex - holiday.startIndex;
            
            // Calculate left offset - if holiday starts before this day, offset left
            // Add 1px to create left gap
            const leftOffset = (dayIntoHoliday > 0 ? -dayIntoHoliday * 52 : 0) + 1;
            
            // Subtract 2px (1px from each end) to create 2px total gap between holidays
            return {
              left: `${leftOffset}px`,
              width: `${(holiday.dayCount * 52) - 2}px`,
            };
          }
        })()}
        title={`${holiday.title} - Click to edit, drag sides to resize, drag center to move`}
      >
          {/* Holiday title */}
          <span className="truncate px-2 pointer-events-none select-none">
            🏖️ {holiday.title}
          </span>

          {/* Left resize handle */}
          <div 
            className="absolute cursor-ew-resize pointer-events-auto group"
            style={{ 
              left: '0px',
              top: '0px',
              width: `${RESIZE_HANDLE_WIDTH}px`,
              height: `${HOLIDAY_BAR_HEIGHT}px`,
              zIndex: RESIZE_HANDLE_Z_INDEX
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              if (!handleHolidayMouseDown) return;
              
              handleHolidayMouseDown(e, holiday.id, 'resize-start-date');
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              if (!handleHolidayMouseDown) return;
              
              const touch = e.touches[0];
              const fakeMouseEvent: TouchLikeMouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {},
                stopPropagation: () => {}
              };
              
              handleHolidayMouseDown(fakeMouseEvent, holiday.id, 'resize-start-date');
            }}
            title="Drag to change start date"
          >
            {/* Hover highlighting - darkened edge */}
            <div 
              className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity rounded-l"
            />
          </div>
          
          {/* Right resize handle */}
          <div 
            className="absolute cursor-ew-resize pointer-events-auto group"
            style={{ 
              right: '0px',
              top: '0px',
              width: `${RESIZE_HANDLE_WIDTH}px`,
              height: `${HOLIDAY_BAR_HEIGHT}px`,
              zIndex: RESIZE_HANDLE_Z_INDEX
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              if (!handleHolidayMouseDown) return;
              
              handleHolidayMouseDown(e, holiday.id, 'resize-end-date');
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.preventDefault();
              
              if (!handleHolidayMouseDown) return;
              
              const touch = e.touches[0];
              const fakeMouseEvent: TouchLikeMouseEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {},
                stopPropagation: () => {}
              };
              
              handleHolidayMouseDown(fakeMouseEvent, holiday.id, 'resize-end-date');
            }}
            title="Drag to change end date"
          >
            {/* Hover highlighting - darkened edge */}
            <div 
              className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity rounded-r"
            />
          </div>

          {/* Main clickable area - Single click to open modal, four-way cursor for dragging */}
          <div 
            className="absolute inset-0 cursor-move"
            style={{ zIndex: 2 }}
            onMouseDown={(e) => handleHolidayMouseDownWithClickDetection(e, holiday.id, 'move')}
            onMouseUp={(e) => handleHolidayMouseUp(e, holiday.id)}
            onMouseMove={handleHolidayMouseMove}
            onClick={(e) => {
              e.stopPropagation();
              // Single click opens modal - prioritize click over drag state
              if (!hasMoved) {
                onHolidayClick(holiday.id);
              }
            }}
            title="Click to edit holiday, drag to move"
          />
        </div>
    </>
  );
}
