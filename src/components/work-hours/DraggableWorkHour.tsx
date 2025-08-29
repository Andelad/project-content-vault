import React, { useState, useRef, useEffect } from 'react';
import { Clock, Move, GripVertical } from 'lucide-react';
import { WorkHour } from '../../types';
import {
  snapToTimeSlot,
  calculateTimeFromPosition as calculateTimeFromPositionService,
  formatDurationFromHours,
  formatTimeForDisplay
} from '@/services/work-hours';

interface DraggableWorkHourProps {
  workHour: WorkHour;
  style: React.CSSProperties;
  calendarMode?: 'events' | 'work-hours';
  onWorkHourChange: (workHourId: string, changes: {
    startTime: Date;
    endTime: Date;
    duration: number;
  }) => void;
  onShowChangeModal: (workHour: WorkHour, changeType: 'modify', changes: {
    startTime: Date;
    endTime: Date;
    duration: number;
  }) => void;
  resetDragState?: boolean; // Add prop to reset drag state from parent
}

interface DragState {
  isDragging: boolean;
  dragType: 'move' | 'resize-top' | 'resize-bottom' | null;
  startPosition: { x: number; y: number };
  originalWorkHour: WorkHour;
  currentChanges: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
}

export function DraggableWorkHour({
  workHour,
  style,
  calendarMode,
  onWorkHourChange,
  onShowChangeModal,
  resetDragState
}: DraggableWorkHourProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverZone, setHoverZone] = useState<'move' | 'resize-top' | 'resize-bottom' | null>(null);
  const [pendingModalData, setPendingModalData] = useState<{
    workHour: WorkHour;
    changes: {
      startTime: Date;
      endTime: Date;
      duration: number;
    };
  } | null>(null);
  const workHourRef = useRef<HTMLDivElement>(null);

  // Reset drag state when parent requests it
  React.useEffect(() => {
    if (resetDragState) {
      setDragState(null);
      setPendingModalData(null);
    }
  }, [resetDragState]);

  // Handle modal triggering after state updates
  React.useEffect(() => {
    if (pendingModalData) {
      onShowChangeModal(pendingModalData.workHour, 'modify', pendingModalData.changes);
      setPendingModalData(null);
    }
  }, [pendingModalData, onShowChangeModal]);

  const formatTime = (date: Date) => {
    return formatTimeForDisplay(date);
  };

  const formatDuration = (duration: number) => {
    return formatDurationFromHours(duration);
  };

  const snapToTimeSlot = (date: Date) => {
    return snapToTimeSlot(date);
  };

  const calculateTimeFromPosition = (clientY: number) => {
    if (!workHourRef.current) return new Date();
    
    return calculateTimeFromPositionService({
      clientY,
      containerElement: workHourRef.current,
      date: workHour.startTime
    });
  };

  const handleMouseDown = (e: React.MouseEvent, dragType: 'move' | 'resize-top' | 'resize-bottom') => {
    if (calendarMode !== 'work-hours') return;
    
    e.preventDefault();
    e.stopPropagation();

    const initialDragState = {
      isDragging: true,
      dragType,
      startPosition: { x: e.clientX, y: e.clientY },
      originalWorkHour: workHour,
      currentChanges: {
        startTime: new Date(workHour.startTime),
        endTime: new Date(workHour.endTime),
        duration: workHour.duration
      }
    };

    setDragState(initialDragState);

    // Add global mouse move and up listeners
    const handleMouseMove = (e: MouseEvent) => {
      const newTime = calculateTimeFromPosition(e.clientY);
      
      setDragState(prev => {
        if (!prev) return null;
        
        let newStartTime = new Date(prev.originalWorkHour.startTime);
        let newEndTime = new Date(prev.originalWorkHour.endTime);
        
        if (prev.dragType === 'move') {
          // Calculate the offset from original position
          const originalStart = prev.originalWorkHour.startTime;
          const timeDiff = newTime.getTime() - originalStart.getTime();
          
          newStartTime = new Date(originalStart.getTime() + timeDiff);
          newEndTime = new Date(prev.originalWorkHour.endTime.getTime() + timeDiff);
          
          // Ensure we don't go outside 24-hour bounds
          if (newStartTime.getHours() < 0) {
            const adjustment = -newStartTime.getHours() * 60 * 60 * 1000;
            newStartTime = new Date(newStartTime.getTime() + adjustment);
            newEndTime = new Date(newEndTime.getTime() + adjustment);
          }
          
          if (newEndTime.getHours() > 23 || (newEndTime.getHours() === 23 && newEndTime.getMinutes() > 45)) {
            const maxEndTime = new Date(newEndTime);
            maxEndTime.setHours(23, 45, 0, 0);
            const adjustment = newEndTime.getTime() - maxEndTime.getTime();
            newEndTime = maxEndTime;
            newStartTime = new Date(newStartTime.getTime() - adjustment);
          }
        } else if (prev.dragType === 'resize-top') {
          newStartTime = newTime;
          // Ensure minimum 15 minutes duration
          if (newStartTime >= newEndTime) {
            newEndTime = new Date(newStartTime.getTime() + 15 * 60 * 1000);
          }
        } else if (prev.dragType === 'resize-bottom') {
          newEndTime = newTime;
          // Ensure minimum 15 minutes duration
          if (newEndTime <= newStartTime) {
            newEndTime = new Date(newStartTime.getTime() + 15 * 60 * 1000);
          }
        }
        
        const duration = (newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60 * 60);
        
        return {
          ...prev,
          currentChanges: {
            startTime: newStartTime,
            endTime: newEndTime,
            duration: Math.max(0.25, duration)
          }
        };
      });
    };

    const handleMouseUp = () => {
      // Don't reset drag state immediately - keep it until modal is resolved
      setDragState(prev => {
        if (prev) {
          // Queue the modal data to be processed in the next render cycle
          setPendingModalData({
            workHour: workHour,
            changes: prev.currentChanges
          });
        }
        return prev; // Keep the drag state until modal resolves
      });
      
      // Don't reset dragState here - let the modal resolution handle it
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (calendarMode !== 'work-hours' || dragState?.isDragging) return;
    
    const rect = workHourRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const relativeY = e.clientY - rect.top;
    const height = rect.height;
    
    // Define zones: top 20% for resize-top, bottom 20% for resize-bottom, middle 60% for move
    if (relativeY < height * 0.2) {
      setHoverZone('resize-top');
    } else if (relativeY > height * 0.8) {
      setHoverZone('resize-bottom');
    } else {
      setHoverZone('move');
    }
  };

  const handleMouseLeave = () => {
    if (!dragState?.isDragging) {
      setHoverZone(null);
    }
  };

  const getCursor = () => {
    if (calendarMode !== 'work-hours') return 'default';
    if (dragState?.isDragging) {
      return dragState.dragType === 'move' ? 'grabbing' : 'ns-resize';
    }
    return hoverZone === 'move' ? 'grab' : hoverZone ? 'ns-resize' : 'default';
  };

  const getDisplayValues = () => {
    if (dragState?.isDragging) {
      return {
        startTime: dragState.currentChanges.startTime,
        endTime: dragState.currentChanges.endTime,
        duration: dragState.currentChanges.duration
      };
    }
    return {
      startTime: workHour.startTime,
      endTime: workHour.endTime,
      duration: workHour.duration
    };
  };

  // Calculate dynamic style that updates during dragging
  const getDynamicStyle = () => {
    const displayValues = getDisplayValues();
    
    if (dragState?.isDragging) {
      // Use the current drag state for positioning
      const startHour = displayValues.startTime.getHours();
      const startMin = displayValues.startTime.getMinutes();
      const duration = displayValues.duration;
      
      const hourHeight = 60;
      const topOffset = (startHour * hourHeight) + (startMin * hourHeight / 60);
      const height = duration * hourHeight;
      
      return {
        ...style, // Preserve original positioning properties like left/right
        top: `${Math.max(0, topOffset)}px`,
        height: `${Math.max(height, 24)}px`,
      };
    }
    
    return style; // Use original style when not dragging
  };

  const displayValues = getDisplayValues();
  const dynamicStyle = getDynamicStyle();
  const isInWorkHoursMode = calendarMode === 'work-hours';

  return (
    <div
      ref={workHourRef}
      className={`absolute rounded-md border text-xs group z-20 ${ 
        isInWorkHoursMode 
          ? 'pointer-events-auto' 
          : 'pointer-events-none'
      } ${
        dragState?.isDragging 
          ? 'shadow-2xl ring-2 ring-blue-500 ring-opacity-50 z-50 transition-none' 
          : isInWorkHoursMode ? 'shadow-sm hover:shadow-md transition-all duration-200' : 'shadow-none transition-all duration-200'
      } ${
        workHour.type === 'work' 
          ? 'bg-stone-100 border-stone-200 text-stone-800' 
          : workHour.type === 'meeting'
          ? 'bg-purple-100 border-purple-200 text-purple-800'
          : 'bg-orange-100 border-orange-200 text-orange-800'
      }`}
      style={{
        ...dynamicStyle,
        cursor: getCursor(),
        opacity: isInWorkHoursMode ? 1 : 0.2
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-work-hour-id={workHour.id}
    >
      {/* Resize handle - Top */}
      {isInWorkHoursMode && hoverZone === 'resize-top' && (
        <div
          className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize bg-blue-500 bg-opacity-20 rounded-t-md transition-opacity duration-150"
          onMouseDown={(e) => handleMouseDown(e, 'resize-top')}
        />
      )}
      
      {/* Resize handle - Bottom */}
      {isInWorkHoursMode && hoverZone === 'resize-bottom' && (
        <div
          className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize bg-blue-500 bg-opacity-20 rounded-b-md transition-opacity duration-150"
          onMouseDown={(e) => handleMouseDown(e, 'resize-bottom')}
        />
      )}
      
      {/* Move handle - Middle area */}
      {isInWorkHoursMode && hoverZone === 'move' && (
        <div
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onMouseDown={(e) => handleMouseDown(e, 'move')}
        >
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-md flex items-center justify-center">
            <Move className="w-4 h-4 text-blue-600 opacity-70" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-2 relative z-10 pointer-events-none">
        {/* Drag handle - like timeline project rows */}
        {isInWorkHoursMode && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <GripVertical className="w-3 h-3 text-gray-400" />
          </div>
        )}
        
        <div className="font-medium truncate pl-4">{workHour.title}</div>
        <div className="flex items-center text-xs opacity-75 mt-1 pl-4">
          <Clock className="w-3 h-3 mr-1" />
          <span>
            {formatTime(displayValues.startTime)} - {formatTime(displayValues.endTime)}
          </span>
        </div>
        <div className="text-xs opacity-60 mt-1 pl-4">
          {formatDuration(displayValues.duration)}
        </div>
      </div>

      {/* Visual feedback during drag */}
      {dragState?.isDragging && (
        <div className="absolute inset-0 border-2 border-blue-500 border-dashed rounded-md pointer-events-none" />
      )}

      {/* Drag type indicator */}
      {isInWorkHoursMode && hoverZone && (
        <div className={`absolute opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
          hoverZone === 'resize-top' ? 'top-1 left-1' :
          hoverZone === 'resize-bottom' ? 'bottom-1 left-1' :
          'top-1 right-1'
        }`}>
          <div className="bg-blue-600 text-white rounded px-1.5 py-0.5 text-xs font-medium shadow-sm">
            {hoverZone === 'move' ? 'Move' : 'Resize'}
          </div>
        </div>
      )}
    </div>
  );
}