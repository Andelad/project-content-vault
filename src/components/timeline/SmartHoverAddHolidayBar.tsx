import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Holiday } from '../../types';
import { calculateOccupiedHolidayIndices, convertMousePositionToTimelineIndex, convertIndicesToDates, calculateMinimumHoverOverlaySize } from '@/services';

interface SmartHoverAddHolidayBarProps {
  dates: Date[];
  holidays: Holiday[];
  mode: 'days' | 'weeks';
  onCreateHoliday: (startDate: Date, endDate: Date) => void;
  isDragging?: boolean;
}

export const SmartHoverAddHolidayBar: React.FC<SmartHoverAddHolidayBarProps> = ({
  dates,
  holidays,
  mode,
  onCreateHoliday,
  isDragging: globalIsDragging = false
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  
  // Use refs to track current drag state for event handlers
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);

  // Calculate which date indices are occupied by existing holidays
  const occupiedIndices = useMemo(() => {
    return calculateOccupiedHolidayIndices(holidays, dates, mode);
  }, [holidays, dates, mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragStart !== null || globalIsDragging) return; // Don't update hover during any drag operation

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
  }, [dates, occupiedIndices, dragStart, globalIsDragging, mode]);

  const handleMouseLeave = useCallback(() => {
    if (dragStart === null && !globalIsDragging) {
      setHoveredIndex(null);
    }
  }, [dragStart, globalIsDragging]);

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

    const handleMouseMove = (e: MouseEvent) => {
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

          onCreateHoliday(startDate, endDate);
        }
      }
      
      // Reset drag state
      setDragStart(null);
      setDragEnd(null);
      setHoveredIndex(null);
      dragStartRef.current = null;
      dragEndRef.current = null;
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [hoveredIndex, occupiedIndices, dates, mode, onCreateHoliday, dragStart, dragEnd]);

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

  return (
    <div
      className="absolute inset-0 cursor-pointer holiday-drag-container"
      style={{ zIndex: 1 }} // Above container but below holiday bars (z-[5])
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
    >
      {renderPreview()}
    </div>
  );
};
