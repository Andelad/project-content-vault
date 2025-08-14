import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

interface HoverAddProjectBarProps {
  rowId: string;
  dates: Date[];
  onCreateProject: (rowId: string, startDate: Date, endDate: Date) => void;
}

export function HoverAddProjectBar({ rowId, dates, onCreateProject }: HoverAddProjectBarProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<{
    startX: number;
    startDateIndex: number;
    endDateIndex: number;
  } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cellWidth = rect.width / dates.length;
    const startDateIndex = Math.floor(x / cellWidth);

    setIsDragging(true);
    setDragState({
      startX: e.clientX,
      startDateIndex,
      endDateIndex: startDateIndex
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;

      const currentRect = document.querySelector(`[data-row-id="${rowId}"]`)?.getBoundingClientRect();
      if (!currentRect) return;

      const currentX = e.clientX - currentRect.left;
      const currentCellWidth = currentRect.width / dates.length;
      const currentEndDateIndex = Math.max(0, Math.min(dates.length - 1, Math.floor(currentX / currentCellWidth)));

      setDragState(prev => prev ? {
        ...prev,
        endDateIndex: currentEndDateIndex
      } : null);
    };

    const handleMouseUp = () => {
      if (dragState) {
        const startDate = dates[dragState.startDateIndex];
        const endDate = dates[dragState.endDateIndex];
        
        // Ensure start date is before end date
        const actualStartDate = startDate <= endDate ? startDate : endDate;
        const actualEndDate = startDate <= endDate ? endDate : startDate;
        
        onCreateProject(rowId, actualStartDate, actualEndDate);
      }

      setIsDragging(false);
      setDragState(null);
      setIsVisible(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [rowId, dates, onCreateProject, dragState]);

  const renderDragPreview = () => {
    if (!dragState || !isDragging) return null;

    const startIndex = Math.min(dragState.startDateIndex, dragState.endDateIndex);
    const endIndex = Math.max(dragState.startDateIndex, dragState.endDateIndex);
    const width = ((endIndex - startIndex + 1) / dates.length) * 100;
    const left = (startIndex / dates.length) * 100;

    return (
      <div
        className="absolute top-0 h-full bg-blue-200 border border-blue-400 rounded opacity-70 pointer-events-none z-10"
        style={{
          left: `${left}%`,
          width: `${width}%`
        }}
      />
    );
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-gray-50/80 opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-pointer z-20"
      data-row-id={rowId}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => !isDragging && setIsVisible(false)}
      onMouseDown={handleMouseDown}
    >
      {renderDragPreview()}
      <div className="flex items-center gap-2 text-sm text-gray-600 pointer-events-none">
        <Plus className="w-4 h-4" />
        <span>Add project</span>
      </div>
    </div>
  );
}