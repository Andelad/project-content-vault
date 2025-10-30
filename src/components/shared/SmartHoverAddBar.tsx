import React, { useState, useCallback, useMemo, useRef } from 'react';

/**
 * Base configuration for SmartHoverAddBar
 */
interface SmartHoverAddBarConfig<T> {
  dates: Date[];
  items: T[];
  mode: 'days' | 'weeks';
  onCreateItem: (startDate: Date, endDate: Date) => void;
  isDragging?: boolean;
  calculateOccupiedIndices: (items: T[], dates: Date[], mode: 'days' | 'weeks') => number[];
  getLabelText: () => string;
  getValidColor: () => string;
  getInvalidColor: () => string;
  containerClass?: string;
  zIndex?: number;
}

/**
 * Generic SmartHoverAddBar component
 * Handles drag-to-create functionality with occupied space detection
 * Used for both projects and holidays
 */
export function SmartHoverAddBar<T>({
  dates,
  items,
  mode,
  onCreateItem,
  isDragging: globalIsDragging = false,
  calculateOccupiedIndices,
  getLabelText,
  getValidColor,
  getInvalidColor,
  containerClass = '',
  zIndex = 15
}: SmartHoverAddBarConfig<T>) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  
  // Use refs to track current drag state for event handlers
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);

  // Calculate which date indices are occupied by existing items
  const occupiedIndices = useMemo(() => {
    return calculateOccupiedIndices(items, dates, mode);
  }, [items, dates, mode, calculateOccupiedIndices]);

  // Convert mouse position to timeline index
  const convertMousePositionToIndex = useCallback((clientX: number, rect: DOMRect): { index: number; isValid: boolean } => {
    const x = clientX - rect.left;
    let index: number;
    
    if (mode === 'weeks') {
      const dayWidth = 22; // 22px per day (154px ÷ 7 days)
      const totalDays = dates.length * 7;
      index = Math.floor(x / dayWidth);
      index = Math.max(0, Math.min(totalDays - 1, index));
    } else {
      const columnWidth = 40;
      index = Math.floor(x / columnWidth);
      index = Math.max(0, Math.min(dates.length - 1, index));
    }
    
    const maxIndex = mode === 'weeks' ? dates.length * 7 : dates.length;
    const isValid = index >= 0 && index < maxIndex && !occupiedIndices.includes(index);
    
    return { index, isValid };
  }, [mode, dates.length, occupiedIndices]);

  // Convert indices to dates
  const convertIndicesToDates = useCallback((startIndex: number, endIndex: number): [Date, Date] => {
    let startDate: Date, endDate: Date;
    
    if (mode === 'weeks') {
      const startWeekIndex = Math.floor(startIndex / 7);
      const startDayOfWeek = startIndex % 7;
      const endWeekIndex = Math.floor(endIndex / 7);
      const endDayOfWeek = endIndex % 7;
      
      startDate = new Date(dates[startWeekIndex]);
      startDate.setDate(startDate.getDate() + startDayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(dates[endWeekIndex]);
      endDate.setDate(endDate.getDate() + endDayOfWeek);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(dates[startIndex]);
      endDate = new Date(dates[endIndex]);
      endDate.setHours(23, 59, 59, 999);
    }
    
    return [startDate, endDate];
  }, [mode, dates]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragStart !== null || globalIsDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const { index, isValid } = convertMousePositionToIndex(e.clientX, rect);
    
    setHoveredIndex(isValid ? index : null);
  }, [dragStart, globalIsDragging, convertMousePositionToIndex]);

  const handleMouseLeave = useCallback(() => {
    if (dragStart === null && !globalIsDragging) {
      setHoveredIndex(null);
    }
  }, [dragStart, globalIsDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { index: clickIndex, isValid: clickIsValid } = convertMousePositionToIndex(e.clientX, rect);

    if (!clickIsValid) return;
    
    const targetIndex = clickIndex >= 0 ? clickIndex : hoveredIndex;
    if (targetIndex === null || occupiedIndices.includes(targetIndex)) return;
    
    e.preventDefault();
    setDragStart(targetIndex);
    setDragEnd(targetIndex);
    dragStartRef.current = targetIndex;
    dragEndRef.current = targetIndex;

    const handleMouseMove = (e: MouseEvent) => {
      const container = e.currentTarget as Element;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const { index } = convertMousePositionToIndex(e.clientX, rect);
      
      setDragEnd(index);
      dragEndRef.current = index;
    };

    const handleMouseUp = () => {
      const currentDragStart = dragStartRef.current;
      const currentDragEnd = dragEndRef.current;
      
      if (currentDragStart !== null && currentDragEnd !== null) {
        const startIndex = Math.min(currentDragStart, currentDragEnd);
        const endIndex = Math.max(currentDragStart, currentDragEnd);
        
        let canCreate = true;
        for (let i = startIndex; i <= endIndex; i++) {
          if (occupiedIndices.includes(i)) {
            canCreate = false;
            break;
          }
        }
        
        if (canCreate) {
          const [startDate, endDate] = convertIndicesToDates(startIndex, endIndex);
          onCreateItem(startDate, endDate);
        }
      }
      
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
  }, [hoveredIndex, occupiedIndices, convertMousePositionToIndex, convertIndicesToDates, onCreateItem]);

  const renderPreview = () => {
    let startIndex: number, endIndex: number;
    let isValid = true;
    
    if (dragStart !== null && dragEnd !== null) {
      startIndex = Math.min(dragStart, dragEnd);
      endIndex = Math.max(dragStart, dragEnd);
      
      for (let i = startIndex; i <= endIndex; i++) {
        if (occupiedIndices.includes(i)) {
          isValid = false;
          break;
        }
      }
    } else if (hoveredIndex !== null) {
      startIndex = hoveredIndex;
      endIndex = hoveredIndex;
    } else {
      return null;
    }
    
    let width: number, left: number;
    
    if (mode === 'weeks') {
      const dayWidth = 11;
      width = (endIndex - startIndex + 1) * dayWidth;
      left = startIndex * dayWidth;
    } else {
      const columnWidth = 40;
      width = (endIndex - startIndex + 1) * columnWidth;
      left = startIndex * columnWidth;
    }
    
    const colorClass = isValid ? getValidColor() : getInvalidColor();
    
    return (
      <div
        className={`absolute top-1/2 -translate-y-1/2 h-10 border border-solid rounded-md pointer-events-none z-30 flex items-center justify-center ${colorClass}`}
        style={{ left: `${left}px`, width: `${width}px` }}
      >
        <span className="text-xs font-medium text-gray-700">
          {getLabelText()}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`absolute inset-0 cursor-pointer ${containerClass}`}
      style={{ zIndex }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
    >
      {renderPreview()}
    </div>
  );
}
