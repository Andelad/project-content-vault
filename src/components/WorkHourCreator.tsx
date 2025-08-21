import React, { useState, useRef, useCallback } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { validateWorkSlotTimes } from '@/lib/workSlotOverlapUtils';

interface WorkHourCreatorProps {
  date: Date;
  calendarMode?: 'events' | 'work-hours';
  onCreateWorkHour: (workHour: {
    startTime: Date;
    endTime: Date;
    duration: number;
    day: string;
  }) => void;
  onWorkHourCreateStateChange?: (state: {
    isCreating: boolean;
    hasDragged: boolean;
    hasOverlaps: boolean;
  }) => void;
}

interface CreateState {
  isCreating: boolean;
  startTime: Date | null;
  endTime: Date | null;
  startPosition: { x: number; y: number } | null;
}

export function WorkHourCreator({
  date,
  calendarMode,
  onCreateWorkHour,
  onWorkHourCreateStateChange
}: WorkHourCreatorProps) {
  const [createState, setCreateState] = useState<CreateState>({
    isCreating: false,
    startTime: null,
    endTime: null,
    startPosition: null
  });
  const [hasDragged, setHasDragged] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { workHours, settings } = useApp();

  const snapToTimeSlot = (date: Date) => {
    const snapped = new Date(date);
    const minutes = snapped.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15; // Changed from 30 to 15
    snapped.setMinutes(roundedMinutes, 0, 0);
    return snapped;
  };

  const calculateTimeFromPosition = useCallback((clientY: number) => {
    if (!containerRef.current) return new Date();
    
    // Get the calendar grid container
    const calendarGrid = containerRef.current.closest('[data-calendar-grid]');
    if (!calendarGrid) return new Date();
    
    const gridRect = calendarGrid.getBoundingClientRect();
    const relativeY = clientY - gridRect.top; // Removed the -48 offset that was causing the 1-hour shift
    
    // Each hour is 60px, each 15-min slot is 15px (changed from 30px)
    const slotHeight = 15;
    const slotIndex = Math.max(0, Math.floor(relativeY / slotHeight));
    const hour = Math.floor(slotIndex / 4); // 4 slots per hour now (was 2)
    const minute = (slotIndex % 4) * 15; // 15min increments (was 30)
    
    const newTime = new Date(date);
    newTime.setHours(Math.min(23, Math.max(0, hour)), minute, 0, 0);
    
    return snapToTimeSlot(newTime);
  }, [date]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (calendarMode !== 'work-hours') return;
    if (e.button !== 0) return; // Only left click
    
    // Check if clicking on an existing work hour - if so, let it handle the event
    const target = e.target as HTMLElement;
    const workHourElement = target.closest('[data-work-hour-id]');
    if (workHourElement) {
      return; // Let the work hour handle the event
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const startTime = calculateTimeFromPosition(e.clientY);
    setHasDragged(false);
    setCreateState({
      isCreating: true,
      startTime,
      endTime: startTime,
      startPosition: { x: e.clientX, y: e.clientY }
    });
    
    // Update state change callback
    if (onWorkHourCreateStateChange) {
      onWorkHourCreateStateChange({
        isCreating: true,
        hasDragged: false,
        hasOverlaps: false
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (createState.isCreating && createState.startTime) {
      setHasDragged(true);
      const endTime = calculateTimeFromPosition(e.clientY);
      
      // Ensure end time is after start time and minimum 15 minutes
      const adjustedEndTime = endTime > createState.startTime 
        ? endTime 
        : new Date(createState.startTime.getTime() + 15 * 60 * 1000);
      
      setCreateState(prev => ({
        ...prev,
        endTime: adjustedEndTime
      }));
      
      // Check for overlaps with the adjusted end time
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[date.getDay()];
      const daySlotName = dayName as keyof typeof settings.weeklyWorkHours;
      const existingSlots = settings.weeklyWorkHours[daySlotName] || [];
      
      const startTimeStr = createState.startTime.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const endTimeStr = adjustedEndTime.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const validation = validateWorkSlotTimes(startTimeStr, endTimeStr, existingSlots);
      
      // Update state change callback with overlap status
      if (onWorkHourCreateStateChange) {
        onWorkHourCreateStateChange({
          isCreating: true,
          hasDragged: true,
          hasOverlaps: !validation.isValid
        });
      }
    }
  }, [createState.isCreating, createState.startTime, calculateTimeFromPosition, onWorkHourCreateStateChange, date, settings.weeklyWorkHours]);

  const handleMouseUp = useCallback(() => {
    if (createState.isCreating && createState.startTime && createState.endTime) {
      // Only create if user dragged for meaningful duration
      if (hasDragged) {
        const duration = (createState.endTime.getTime() - createState.startTime.getTime()) / (1000 * 60 * 60);
        
        if (duration >= 0.25) { // Minimum 15 minutes
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const dayName = dayNames[date.getDay()];
          
          // Check for overlaps before creating
          const daySlotName = dayName as keyof typeof settings.weeklyWorkHours;
          const existingSlots = settings.weeklyWorkHours[daySlotName] || [];
          
          const startTime = createState.startTime.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const endTime = createState.endTime.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          const validation = validateWorkSlotTimes(startTime, endTime, existingSlots);
          
          // Only proceed if no overlaps
          if (validation.isValid) {
            onCreateWorkHour({
              startTime: createState.startTime,
              endTime: createState.endTime,
              duration,
              day: dayName
            });
          }
          // If there are overlaps, we simply don't create - the user already sees the visual feedback
        }
      }
    }
    
    // Reset state
    setCreateState({
      isCreating: false,
      startTime: null,
      endTime: null,
      startPosition: null
    });
    setHasDragged(false);
    
    // Update state change callback
    if (onWorkHourCreateStateChange) {
      onWorkHourCreateStateChange({
        isCreating: false,
        hasDragged: false,
        hasOverlaps: false
      });
    }
  }, [createState, hasDragged, date, onCreateWorkHour, settings.weeklyWorkHours, onWorkHourCreateStateChange]);

  // Add global event listeners during creation
  React.useEffect(() => {
    if (createState.isCreating) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [createState.isCreating, handleMouseMove, handleMouseUp]);

  const getCreatePreviewStyle = () => {
    if (!createState.isCreating || !createState.startTime || !createState.endTime) {
      return { display: 'none' };
    }
    
    const startHour = createState.startTime.getHours();
    const startMin = createState.startTime.getMinutes();
    const duration = (createState.endTime.getTime() - createState.startTime.getTime()) / (1000 * 60 * 60);
    
    const hourHeight = 60;
    const topOffset = (startHour * hourHeight) + (startMin * hourHeight / 60);
    const height = duration * hourHeight;
    
    // Change colors based on overlap status
    const hasOverlap = overlapInfo.hasOverlaps;
    
    return {
      position: 'absolute' as const,
      top: `${Math.max(0, topOffset)}px`,
      height: `${Math.max(height, 24)}px`,
      left: '0px',
      right: '0px',
      backgroundColor: hasOverlap ? 'rgba(239, 68, 68, 0.2)' : 'rgba(139, 195, 74, 0.2)', // Red for overlap, green for valid
      border: hasOverlap ? '2px dashed rgb(239, 68, 68)' : '2px dashed rgb(139, 195, 74)',
      borderRadius: '0.375rem',
      pointerEvents: 'none' as const,
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    };
  };

  const formatDurationPreview = () => {
    if (!createState.startTime || !createState.endTime) return '';
    
    const duration = (createState.endTime.getTime() - createState.startTime.getTime()) / (1000 * 60);
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  const isWorkHoursMode = calendarMode === 'work-hours';

  // Check for overlaps during creation
  const getOverlapInfo = () => {
    if (!createState.isCreating || !createState.startTime || !createState.endTime) {
      return { hasOverlaps: false, overlaps: [] };
    }
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const daySlotName = dayName as keyof typeof settings.weeklyWorkHours;
    const existingSlots = settings.weeklyWorkHours[daySlotName] || [];
    
    const startTime = createState.startTime.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const endTime = createState.endTime.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const validation = validateWorkSlotTimes(startTime, endTime, existingSlots);
    
    return {
      hasOverlaps: !validation.isValid,
      overlaps: validation.overlaps || []
    };
  };

  const overlapInfo = getOverlapInfo();

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-5"
      style={{
        pointerEvents: isWorkHoursMode ? 'auto' : 'none',
        cursor: isWorkHoursMode ? (createState.isCreating ? 'ns-resize' : 'crosshair') : 'default'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Creation preview - matching event creation style */}
      {createState.isCreating && (
        <div 
          className={`absolute pointer-events-none z-30 rounded-md border-2 border-dashed ${
            overlapInfo.hasOverlaps 
              ? 'bg-red-400 bg-opacity-60 border-red-500' 
              : 'bg-blue-400 bg-opacity-60 border-blue-500'
          }`}
          style={{
            top: `${Math.max(0, (createState.startTime!.getHours() * 60) + (createState.startTime!.getMinutes() * 60 / 60))}px`,
            height: `${Math.max(((createState.endTime!.getTime() - createState.startTime!.getTime()) / (1000 * 60 * 60)) * 60, 15)}px`,
            left: '4px',
            right: '4px'
          }}
        >
          <div className={`p-2 text-white text-xs font-medium flex items-center gap-2 ${
            overlapInfo.hasOverlaps ? 'text-red-100' : 'text-white'
          }`}>
            {overlapInfo.hasOverlaps ? (
              <>
                <AlertTriangle className="w-3 h-3" />
                <span>Cannot overlap existing work hours!</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                <span>New Work Hours ({formatDurationPreview()})</span>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Instructions overlay when in work-hours mode but not creating */}
      {isWorkHoursMode && !createState.isCreating && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-md text-sm font-medium">
            Drag to create work hours
          </div>
        </div>
      )}
    </div>
  );
}