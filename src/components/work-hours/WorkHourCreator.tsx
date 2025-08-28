import React, { useState, useRef, useCallback } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { 
  handleWorkHourCreationStart,
  handleWorkHourCreationMove,
  handleWorkHourCreationComplete,
  getWorkHourOverlapInfo,
  generateWorkHourPreviewStyle,
  formatDurationPreview,
  getWorkHourCreationCursor,
  shouldAllowWorkHourCreation,
  type WorkHourCreateState
} from '@/services';

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
  const { workHours, settings } = useSettingsContext();

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!shouldAllowWorkHourCreation(e.target as HTMLElement)) return;
    
    const newState = handleWorkHourCreationStart(e, containerRef, date, calendarMode);
    if (!newState) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setHasDragged(false);
    setCreateState(newState);
    
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
    // Get existing slots for validation
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const daySlotName = dayName as keyof typeof settings.weeklyWorkHours;
    const existingSlots = settings.weeklyWorkHours[daySlotName] || [];
    
    const result = handleWorkHourCreationMove(e, createState, containerRef, date, existingSlots);
    if (!result) return;
    
    setHasDragged(result.hasDragged);
    setCreateState(result.updatedState);
    
    // Update state change callback with overlap status
    if (onWorkHourCreateStateChange) {
      onWorkHourCreateStateChange({
        isCreating: true,
        hasDragged: result.hasDragged,
        hasOverlaps: result.validationResult.hasOverlaps
      });
    }
  }, [createState, date, settings.weeklyWorkHours, onWorkHourCreateStateChange]);

  const handleMouseUp = useCallback(() => {
    // Get existing slots for validation
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const daySlotName = dayName as keyof typeof settings.weeklyWorkHours;
    const existingSlots = settings.weeklyWorkHours[daySlotName] || [];
    
    const result = handleWorkHourCreationComplete(createState, date, existingSlots, hasDragged);
    
    if (result && result.isValid) {
      onCreateWorkHour({
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.duration,
        day: result.day
      });
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

  // Check for overlaps during creation
  const getOverlapInfo = () => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()];
    const daySlotName = dayName as keyof typeof settings.weeklyWorkHours;
    const existingSlots = settings.weeklyWorkHours[daySlotName] || [];
    
    return getWorkHourOverlapInfo(createState, date, existingSlots);
  };

  const overlapInfo = getOverlapInfo();

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-5"
      style={{
        pointerEvents: calendarMode === 'work-hours' ? 'auto' : 'none',
        cursor: getWorkHourCreationCursor(calendarMode, createState.isCreating)
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Creation preview - using service for styling */}
      {createState.isCreating && createState.startTime && createState.endTime && (
        <div 
          className={`absolute pointer-events-none z-30 rounded-md border-2 border-dashed ${
            overlapInfo.hasOverlaps 
              ? 'bg-red-400 bg-opacity-60 border-red-500' 
              : 'bg-blue-400 bg-opacity-60 border-blue-500'
          }`}
          style={generateWorkHourPreviewStyle(
            createState.startTime, 
            createState.endTime, 
            overlapInfo.hasOverlaps
          )}
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
                <span>New Work Hours ({formatDurationPreview(createState.startTime, createState.endTime)})</span>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Instructions overlay when in work-hours mode but not creating */}
      {calendarMode === 'work-hours' && !createState.isCreating && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-md text-sm font-medium">
            Drag to create work hours
          </div>
        </div>
      )}
    </div>
  );
}