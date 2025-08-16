import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Project } from '../../types';

interface SmartHoverAddProjectBarProps {
  dates: Date[];
  projects: Project[];
  rowId: string;
  mode: 'days' | 'weeks';
  onCreateProject: (rowId: string, startDate: Date, endDate: Date) => void;
  isDragging?: boolean;
}

export const SmartHoverAddProjectBar: React.FC<SmartHoverAddProjectBarProps> = ({
  dates,
  projects,
  rowId,
  mode,
  onCreateProject,
  isDragging: globalIsDragging = false
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  
  // Use refs to track current drag state for event handlers
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);

  // Calculate which date indices are occupied by existing projects
  const occupiedIndices = useMemo(() => {
    const occupied = new Set<number>();
    
    projects.forEach(project => {
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      
      if (mode === 'weeks') {
        // For weeks mode with day-level precision, calculate which day indices are occupied
        dates.forEach((weekStartDate, weekIndex) => {
          for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const dayDate = new Date(weekStartDate);
            dayDate.setDate(weekStartDate.getDate() + dayOfWeek);
            dayDate.setHours(0, 0, 0, 0);
            
            const dayEnd = new Date(dayDate);
            dayEnd.setHours(23, 59, 59, 999);
            
            // Check if this day falls within project range
            if (!(projectEnd < dayDate || projectStart > dayEnd)) {
              const dayIndex = weekIndex * 7 + dayOfWeek;
              occupied.add(dayIndex);
              
              // Add buffer zones: avoid adjacent days to prevent hover conflicts
              if (dayIndex > 0) {
                occupied.add(dayIndex - 1);
              }
              if (dayIndex < dates.length * 7 - 1) {
                occupied.add(dayIndex + 1);
              }
            }
          }
        });
      } else {
        // Original days mode logic
        dates.forEach((date, index) => {
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);
          
          if (!(projectEnd < dayStart || projectStart > dayEnd)) {
            occupied.add(index);
            
            // Add buffer zones: half column on each side to prevent hover conflicts
            if (index > 0) {
              occupied.add(index - 1);
            }
            if (index < dates.length - 1) {
              occupied.add(index + 1);
            }
          }
        });
      }
    });
    
    return occupied;
  }, [projects, dates, mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragStart !== null || globalIsDragging) return; // Don't update hover during any drag operation
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let index: number;
    
    if (mode === 'weeks') {
      // In week mode, calculate precise day-level index within week columns
      const columnWidth = 72;
      const dayWidth = columnWidth / 7; // ~10.3px per day
      const totalDays = dates.length * 7; // Total number of days across all weeks
      const dayIndex = Math.floor(x / dayWidth);
      index = Math.max(0, Math.min(totalDays - 1, dayIndex));
    } else {
      // Days mode uses the original calculation
      index = Math.floor((x / rect.width) * dates.length);
    }
    
    if (index >= 0 && index < (mode === 'weeks' ? dates.length * 7 : dates.length) && !occupiedIndices.has(index)) {
      setHoveredIndex(index);
    } else {
      setHoveredIndex(null);
    }
  }, [dates.length, occupiedIndices, dragStart, globalIsDragging, mode]);

  const handleMouseLeave = useCallback(() => {
    if (dragStart === null && !globalIsDragging) {
      setHoveredIndex(null);
    }
  }, [dragStart, globalIsDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Calculate the index directly in mouse down in case hover didn't update
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let clickIndex: number;
    
    if (mode === 'weeks') {
      // In week mode, calculate precise day-level index within week columns
      const dayWidth = 72 / 7; // ~10.3px per day
      const totalDays = dates.length * 7; // Total number of days across all weeks
      clickIndex = Math.floor(x / dayWidth);
      clickIndex = Math.max(0, Math.min(totalDays - 1, clickIndex));
    } else {
      // Days mode uses the original calculation
      clickIndex = Math.floor((x / rect.width) * dates.length);
    }
    
    // Use the calculated index if it's valid, fallback to hoveredIndex
    const targetIndex = (clickIndex >= 0 && clickIndex < (mode === 'weeks' ? dates.length * 7 : dates.length)) ? clickIndex : hoveredIndex;
    
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
      const container = document.querySelector(`[data-row-id="${rowId}"]`);
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      let index: number;
      
      if (mode === 'weeks') {
        // In week mode, calculate precise day-level index within week columns
        const dayWidth = 72 / 7; // ~10.3px per day
        const totalDays = dates.length * 7; // Total number of days across all weeks
        index = Math.floor(x / dayWidth);
        index = Math.max(0, Math.min(totalDays - 1, index));
      } else {
        // Days mode uses the original calculation
        index = Math.floor((x / rect.width) * dates.length);
        index = Math.max(0, Math.min(dates.length - 1, index));
      }
      
      console.log('🔍 DRAG MOVE: index:', index, 'clampedIndex:', index);
      setDragEnd(index);
      dragEndRef.current = index; // Update ref immediately
    };

    const handleMouseUp = () => {
      console.log('🔍 DRAG DEBUG: handleMouseUp called');
      console.log('🔍 dragStart state:', dragStart);
      console.log('🔍 dragEnd state:', dragEnd);
      console.log('🔍 dragStartRef.current:', dragStartRef.current);
      console.log('🔍 dragEndRef.current:', dragEndRef.current);
      console.log('🔍 targetIndex:', targetIndex);
      
      // Use refs for immediate access to current values
      const currentDragStart = dragStartRef.current;
      const currentDragEnd = dragEndRef.current;
      
      console.log('🔍 Using currentDragStart:', currentDragStart, 'currentDragEnd:', currentDragEnd);
      
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
          let startDate: Date, endDate: Date;
          
          if (mode === 'weeks') {
            // Convert day-level indices back to actual dates
            const startWeekIndex = Math.floor(startIndex / 7);
            const startDayOfWeek = startIndex % 7;
            const endWeekIndex = Math.floor(endIndex / 7);
            const endDayOfWeek = endIndex % 7;
            
            // Calculate start date
            startDate = new Date(dates[startWeekIndex]);
            startDate.setDate(startDate.getDate() + startDayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            
            // Calculate end date
            endDate = new Date(dates[endWeekIndex]);
            endDate.setDate(endDate.getDate() + endDayOfWeek);
            endDate.setHours(23, 59, 59, 999);
          } else {
            // Days mode: use existing logic
            startDate = new Date(dates[startIndex]);
            endDate = new Date(dates[endIndex]);
            endDate.setHours(23, 59, 59, 999);
          }
          
          console.log('🎯 Creating project with dates:', startDate, 'to', endDate);
          console.log('🎯 DETAILED: startDate ISO:', startDate.toISOString(), 'endDate ISO:', endDate.toISOString());
          console.log('🎯 DETAILED: rowId being passed:', rowId);
          onCreateProject(rowId, startDate, endDate);
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
  }, [hoveredIndex, occupiedIndices, rowId, dates, mode, onCreateProject, dragStart, dragEnd]);

  // Render preview of where project would be created
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
      // Just hovering
      startIndex = endIndex = hoveredIndex;
    } else {
      return null;
    }
    
    let width: number, left: number;
    
    if (mode === 'weeks') {
      // For week mode with day-level precision
      const dayWidth = 72 / 7; // ~10.3px per day
      const totalWidth = dates.length * 72; // Total timeline width
      width = ((endIndex - startIndex + 1) * dayWidth / totalWidth) * 100;
      left = (startIndex * dayWidth / totalWidth) * 100;
    } else {
      // Days mode uses original calculation
      width = ((endIndex - startIndex + 1) / dates.length) * 100;
      left = (startIndex / dates.length) * 100;
    }
    
    return (
      <div
        className={`absolute top-1 bottom-1 border-2 border-dashed rounded pointer-events-none z-30 flex items-center justify-center ${
          isValid 
            ? 'bg-blue-100/50 border-blue-400' 
            : 'bg-red-100/50 border-red-400'
        }`}
        style={{
          left: `${left}%`,
          width: `${width}%`
        }}
      >
        <span className="text-xs font-medium text-gray-700">
          Add Project
        </span>
      </div>
    );
  };

  return (
    <div
      className="absolute inset-0 cursor-pointer"
      data-row-id={rowId}
      style={{ zIndex: 15 }} // Above container but below project rectangles (z-20)
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
    >
      {renderPreview()}
    </div>
  );
}
