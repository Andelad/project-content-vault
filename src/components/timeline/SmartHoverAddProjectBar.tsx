import React, { useState, useCallback, useMemo } from 'react';

interface SmartHoverAddProjectBarProps {
  rowId: string;
  dates: Date[];
  projects: any[]; // Projects in this specific row
  onCreateProject: (rowId: string, startDate: Date, endDate: Date) => void;
}

export function SmartHoverAddProjectBar({ 
  rowId, 
  dates, 
  projects, 
  onCreateProject 
}: SmartHoverAddProjectBarProps) {
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<{
    startIndex: number;
    currentEndIndex: number;
  } | null>(null);

  // Create a map of occupied dates for this row
  const occupiedDates = useMemo(() => {
    const occupied = new Set<number>();
    
    projects.forEach(project => {
      const startDate = new Date(project.startDate);
      const endDate = new Date(project.endDate);
      
      dates.forEach((date, index) => {
        const dateStr = date.toDateString();
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          if (d.toDateString() === dateStr) {
            occupied.add(index);
            break;
          }
        }
      });
    });
    
    return occupied;
  }, [projects, dates]);

  // Find a valid position for the 5-day preview bar starting from the given index
  const findValidPreviewPosition = useCallback((startIndex: number) => {
    // Try to place 5 days starting from startIndex
    for (let i = 0; i <= 4; i++) {
      const testStart = Math.max(0, startIndex - i);
      const testEnd = Math.min(dates.length - 1, testStart + 4);
      
      // Check if all dates in this range are available
      let isValid = true;
      for (let j = testStart; j <= testEnd; j++) {
        if (occupiedDates.has(j)) {
          isValid = false;
          break;
        }
      }
      
      if (isValid) {
        return { start: testStart, end: testEnd };
      }
    }
    
    return null;
  }, [occupiedDates, dates.length]);

  // Check if a range is valid (no occupied dates)
  const isRangeValid = useCallback((startIndex: number, endIndex: number) => {
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    for (let i = start; i <= end; i++) {
      if (occupiedDates.has(i)) {
        return false;
      }
    }
    return true;
  }, [occupiedDates]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) return; // Don't update hover position while dragging
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cellWidth = rect.width / dates.length;
    const hoveredIndex = Math.floor(x / cellWidth);
    
    setHoverPosition(hoveredIndex);
  }, [dates.length, isDragging]);

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoverPosition(null);
    }
  }, [isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (hoverPosition === null) return;
    
    e.preventDefault();
    e.stopPropagation();

    // Find valid position for starting the project
    const validPosition = findValidPreviewPosition(hoverPosition);
    if (!validPosition) return; // Can't start here
    
    console.log('Starting drag with position:', validPosition);
    
    const initialDragState = {
      startIndex: validPosition.start,
      currentEndIndex: validPosition.end
    };
    
    setIsDragging(true);
    setDragState(initialDragState);

    const handleDocumentMouseMove = (e: MouseEvent) => {
      const rect = document.querySelector(`[data-row-id="${rowId}"]`)?.getBoundingClientRect();
      if (!rect) return;

      const currentX = e.clientX - rect.left;
      const currentCellWidth = rect.width / dates.length;
      const currentHoverIndex = Math.max(0, Math.min(dates.length - 1, Math.floor(currentX / currentCellWidth)));
      
      // Calculate new end index, but don't let it go before start
      const newEndIndex = Math.max(initialDragState.startIndex, currentHoverIndex);
      
      console.log('Dragging to index:', newEndIndex);
      
      setDragState({
        startIndex: initialDragState.startIndex,
        currentEndIndex: newEndIndex
      });
    };

    const handleDocumentMouseUp = () => {
      // Use the current drag state from closure
      setDragState(currentDragState => {
        console.log('Mouse up, dragState:', currentDragState);
        
        if (currentDragState && isRangeValid(currentDragState.startIndex, currentDragState.currentEndIndex)) {
          const startDate = dates[currentDragState.startIndex];
          const endDate = dates[currentDragState.currentEndIndex];
          
          console.log('Creating project:', { startDate, endDate });
          onCreateProject(rowId, startDate, endDate);
        } else {
          console.log('Invalid range or no drag state');
        }
        
        return null; // Clear drag state
      });

      setIsDragging(false);
      setHoverPosition(null);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }, [rowId, dates, hoverPosition, findValidPreviewPosition, isRangeValid, onCreateProject]);

  // Render the hover preview (5 days) or drag preview
  const renderPreview = () => {
    if (isDragging && dragState) {
      // Show drag preview
      const startIndex = dragState.startIndex;
      const endIndex = dragState.currentEndIndex;
      const width = ((endIndex - startIndex + 1) / dates.length) * 100;
      const left = (startIndex / dates.length) * 100;
      const isValid = isRangeValid(startIndex, endIndex);
      
      return (
        <div
          className={`absolute top-1 bottom-1 border-2 border-dashed rounded opacity-80 pointer-events-none z-20 flex items-center justify-center ${
            isValid 
              ? 'bg-blue-200/60 border-blue-400' 
              : 'bg-red-200/60 border-red-400'
          }`}
          style={{
            left: `${left}%`,
            width: `${width}%`
          }}
        >
          <span className="text-xs font-medium text-gray-700">
            {endIndex - startIndex + 1} day{endIndex - startIndex + 1 !== 1 ? 's' : ''}
          </span>
        </div>
      );
    } else if (hoverPosition !== null && !isDragging) {
      // Show 5-day hover preview
      const validPosition = findValidPreviewPosition(hoverPosition);
      if (!validPosition) return null;
      
      const width = ((validPosition.end - validPosition.start + 1) / dates.length) * 100;
      const left = (validPosition.start / dates.length) * 100;
      
      return (
        <div
          className="absolute top-1 bottom-1 bg-blue-100/40 border border-blue-300 border-dashed rounded opacity-60 pointer-events-none z-20 flex items-center justify-center"
          style={{
            left: `${left}%`,
            width: `${width}%`
          }}
        >
          <span className="text-xs font-medium text-blue-700">
            {validPosition.end - validPosition.start + 1} days
          </span>
        </div>
      );
    }
    
    return null;
  };

  // Only show if there are available dates
  const hasAvailableDates = dates.some((_, index) => !occupiedDates.has(index));
  
  if (!hasAvailableDates) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 cursor-crosshair z-15"
      data-row-id={rowId}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
    >
      {renderPreview()}
    </div>
  );
}
