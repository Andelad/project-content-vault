import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Holiday } from '../../types';

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
    const occupied = new Set<number>();
    
    holidays.forEach(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      
      dates.forEach((date, index) => {
        let shouldOccupy = false;
        
        if (mode === 'weeks') {
          // For weeks mode, check if holiday overlaps with this week
          const weekEnd = new Date(date);
          weekEnd.setDate(date.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          if (!(holidayEnd < date || holidayStart > weekEnd)) {
            shouldOccupy = true;
          }
        } else {
          // For days mode, check if this date falls within holiday range
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);
          
          if (!(holidayEnd < dayStart || holidayStart > dayEnd)) {
            shouldOccupy = true;
          }
        }
        
        // If this index contains a holiday, mark it as occupied
        // Unlike projects, holidays don't need buffer zones since they can't be moved over each other
        if (shouldOccupy) {
          occupied.add(index);
        }
      });
    });
    
    return occupied;
  }, [holidays, dates, mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragStart !== null || globalIsDragging) return; // Don't update hover during any drag operation
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = Math.floor((x / rect.width) * dates.length);
    
    if (index >= 0 && index < dates.length && !occupiedIndices.has(index)) {
      setHoveredIndex(index);
    } else {
      setHoveredIndex(null);
    }
  }, [dates.length, occupiedIndices, dragStart, globalIsDragging]);

  const handleMouseLeave = useCallback(() => {
    if (dragStart === null && !globalIsDragging) {
      setHoveredIndex(null);
    }
  }, [dragStart, globalIsDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't handle mouse down if we're over an occupied area (existing holiday)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickIndex = Math.floor((x / rect.width) * dates.length);
    
    if (clickIndex >= 0 && clickIndex < dates.length && occupiedIndices.has(clickIndex)) {
      // Let the event bubble up to the holiday bar handlers
      return;
    }
    
    // Calculate the index directly in mouse down in case hover didn't update
    const targetIndex = (clickIndex >= 0 && clickIndex < dates.length) ? clickIndex : hoveredIndex;
    
    if (targetIndex === null || occupiedIndices.has(targetIndex)) {
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
      const x = e.clientX - rect.left;
      const index = Math.floor((x / rect.width) * dates.length);
      const clampedIndex = Math.max(0, Math.min(dates.length - 1, index));
      
      setDragEnd(clampedIndex);
      dragEndRef.current = clampedIndex; // Update ref immediately
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
          if (occupiedIndices.has(i)) {
            canCreate = false;
            break;
          }
        }
        
        if (canCreate) {
          const startDate = new Date(dates[startIndex]);
          let endDate: Date;
          
          if (mode === 'weeks') {
            // End date is the end of the last week
            const endWeekStart = new Date(dates[endIndex]);
            endDate = new Date(endWeekStart);
            endDate.setDate(endWeekStart.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
          } else {
            // End date is the end of the last day
            endDate = new Date(dates[endIndex]);
            endDate.setHours(23, 59, 59, 999);
          }
          
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
        if (occupiedIndices.has(i)) {
          isValid = false;
          break;
        }
      }
    } else if (hoveredIndex !== null) {
      // Just hovering - show single day/week preview
      startIndex = endIndex = hoveredIndex;
    } else {
      return null;
    }
    
    const width = ((endIndex - startIndex + 1) / dates.length) * 100;
    const left = (startIndex / dates.length) * 100;
    
    return (
      <div
        className={`absolute top-1 bottom-1 border-2 border-dashed rounded pointer-events-none z-30 flex items-center justify-center ${
          isValid 
            ? 'bg-orange-100/50 border-orange-400' 
            : 'bg-red-100/50 border-red-400'
        }`}
        style={{
          left: `${left}%`,
          width: `${width}%`
        }}
      >
        <span className="text-xs font-medium text-orange-800">
          🏖️ {endIndex - startIndex + 1} {mode === 'weeks' ? 'week' : 'day'}{endIndex - startIndex + 1 !== 1 ? 's' : ''}
        </span>
      </div>
    );
  };

  return (
    <div
      className="absolute inset-0 cursor-pointer holiday-drag-container"
      style={{ zIndex: 15 }} // Above container but below holiday bars (z-20)
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
    >
      {renderPreview()}
    </div>
  );
};
