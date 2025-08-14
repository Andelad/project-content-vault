import React, { useState, useCallback, useMemo, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useApp } from '../contexts/AppContext';
import { CalendarEvent, WorkHour } from '../types';
import { Clock, Grip, Edit } from 'lucide-react';
import { DraggableWorkHour } from './DraggableWorkHour';
import { WorkHourCreator } from './WorkHourCreator';

const ItemTypes = {
  EVENT: 'event'
};

interface DraggedEvent {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number;
}

interface DragCreateState {
  isCreating: boolean;
  startTime: Date | null;
  endTime: Date | null;
  startPosition: { x: number; y: number } | null;
}

interface ResizeState {
  isResizing: boolean;
  eventId: string | null;
  resizeType: 'top' | 'bottom' | null;
  originalEvent: CalendarEvent | null;
}

interface TimeSlotProps {
  date: Date;
  hour: number;
  minute: number;
  viewMode: 'events' | 'work-hours' | 'overlay';
  onEventDrop: (event: DraggedEvent, newStartTime: Date) => void;
  onClickCreateEvent: (startTime: Date) => void;
  events: CalendarEvent[];
  dragCreateState: DragCreateState;
  onDragCreateStart: (startTime: Date, position: { x: number; y: number }) => void;
  onDragCreateMove: (endTime: Date) => void;
  isInCreateRange: boolean;
  resizeState: ResizeState;
}

function TimeSlot({ 
  date, 
  hour, 
  minute, 
  viewMode,
  onEventDrop, 
  onClickCreateEvent, 
  events, 
  dragCreateState,
  onDragCreateStart,
  onDragCreateMove,
  isInCreateRange,
  resizeState
}: TimeSlotProps) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ItemTypes.EVENT,
    drop: (item: DraggedEvent) => {
      const newStartTime = new Date(date);
      newStartTime.setHours(hour, minute, 0, 0);
      onEventDrop(item, newStartTime);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  });

  const slotTime = new Date(date);
  slotTime.setHours(hour, minute, 0, 0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if (resizeState.isResizing) return; // Don't start drag create while resizing
    if (viewMode === 'work-hours') return; // Don't allow creating events in work-hours only mode
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    onDragCreateStart(slotTime, { x: e.clientX, y: e.clientY });
  };

  const handleMouseEnter = () => {
    if (dragCreateState.isCreating) {
      onDragCreateMove(slotTime);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // Allow click creation in events mode regardless of work hours presence
    if (!dragCreateState.isCreating && !resizeState.isResizing && viewMode !== 'work-hours' && onClickCreateEvent) {
      onClickCreateEvent(slotTime);
    }
  };

  const isMainHour = minute === 0;
  const isCurrentTime = () => {
    const now = new Date();
    const nowHour = now.getHours();
    const nowDate = now.toDateString();
    const slotDate = date.toDateString();
    
    return nowDate === slotDate && nowHour === hour && now.getMinutes() >= minute && now.getMinutes() < (minute + 30);
  };

  return (
    <div
      ref={drop}
      className={`h-[30px] border-b transition-all duration-150 cursor-pointer relative group select-none ${
        !isMainHour ? 'border-gray-200' : 'border-gray-100'
      } ${
        isInCreateRange ? 'bg-blue-200 border-blue-400' :
        'hover:bg-gray-50'
      } ${
        isCurrentTime() ? 'bg-blue-50 border-blue-200' : ''
      } ${
        dragCreateState.isCreating ? 'cursor-ns-resize' : 
        resizeState.isResizing ? 'cursor-ns-resize' :
        viewMode !== 'work-hours' ? 'cursor-crosshair' : 'cursor-default'
      }`}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
    >
      {/* Current time indicator */}
      {isCurrentTime() && (
        <div className="absolute left-0 top-0 w-full h-0.5 bg-blue-500 z-20">
          <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full" />
        </div>
      )}
    </div>
  );
}

interface DraggableEventProps {
  event: CalendarEvent;
  style: React.CSSProperties;
  onEventUpdate: (eventId: string, updates: Partial<CalendarEvent>) => void;
  onEventEdit: (event: CalendarEvent) => void;
  onResizeStart: (eventId: string, resizeType: 'top' | 'bottom', event: CalendarEvent) => void;
  onResizeMove: (newTime: Date) => void;
  resizeState: ResizeState;
}

function DraggableEvent({ event, style, onEventUpdate, onEventEdit, onResizeStart, onResizeMove, resizeState }: DraggableEventProps) {
  const { projects } = useApp();
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: ItemTypes.EVENT,
    item: {
      id: event.id,
      startTime: event.startTime,
      endTime: event.endTime,
      duration: event.duration
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    canDrag: () => !resizeState.isResizing // Disable dragging while resizing
  });

  const project = event.projectId ? projects.find(p => p.id === event.projectId) : null;
  const backgroundColor = event.color || (project ? project.color : '#6b7280');

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEventEdit(event);
  };

  const handleSingleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Could add selection state here in the future
  };

  const handleResizeMouseDown = (e: React.MouseEvent, resizeType: 'top' | 'bottom') => {
    e.stopPropagation();
    e.preventDefault();
    onResizeStart(event.id, resizeType, event);
  };

  const isCurrentlyResizing = resizeState.isResizing && resizeState.eventId === event.id;

  return (
    <div
      ref={dragPreview}
      className={`absolute rounded-md text-white text-xs shadow-lg border border-white/20 overflow-hidden transition-all duration-200 group cursor-pointer ${
        isDragging ? 'opacity-50 scale-105 z-50' : 
        isCurrentlyResizing ? 'shadow-2xl ring-2 ring-blue-500 ring-opacity-50 z-40' :
        'opacity-100 hover:shadow-xl hover:scale-[1.02]'
      }`}
      style={{
        ...style,
        backgroundColor,
        minHeight: '24px'
      }}
      onDoubleClick={handleDoubleClick}
      onClick={handleSingleClick}
    >
      {/* Top resize handle */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity ${
          isCurrentlyResizing && resizeState.resizeType === 'top' ? 'opacity-100 bg-white/40' : ''
        }`}
        onMouseDown={(e) => handleResizeMouseDown(e, 'top')}
      />

      {/* Bottom resize handle */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize opacity-0 group-hover:opacity-100 hover:bg-white/30 transition-opacity ${
          isCurrentlyResizing && resizeState.resizeType === 'bottom' ? 'opacity-100 bg-white/40' : ''
        }`}
        onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
      />

      {/* Drag handle */}
      <div
        ref={drag}
        className={`absolute top-1 right-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/20 cursor-grab active:cursor-grabbing transition-opacity ${
          resizeState.isResizing ? 'pointer-events-none' : ''
        }`}
      >
        <Grip className="w-3 h-3" />
      </div>

      {/* Edit indicator */}
      <div className="absolute top-1 left-1 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity">
        <Edit className="w-3 h-3" />
      </div>

      <div className="p-2">
        <div className="font-medium truncate pr-8">{event.title}</div>
        
        <div className="flex items-center text-xs opacity-90 mt-1">
          <Clock className="w-3 h-3 mr-1" />
          <span className="truncate">
            {formatTime(event.startTime)} - {formatTime(event.endTime)}
          </span>
        </div>
        
        {project && (
          <div className="text-xs opacity-75 truncate mt-1">
            {project.name} • {project.client}
          </div>
        )}
        
        {/* Duration indicator */}
        <div className="text-xs opacity-60 mt-1">
          {event.duration < 1 
            ? `${Math.round(event.duration * 60)} min` 
            : event.duration === 1 
              ? '1 hour' 
              : `${event.duration} hours`
          }
        </div>
      </div>

      {/* Resize indicators */}
      {isCurrentlyResizing && (
        <div className="absolute inset-0 border-2 border-blue-500 border-dashed rounded-md pointer-events-none" />
      )}
    </div>
  );
}

interface CalendarGridProps {
  viewType: 'week' | 'month';
  currentDate: Date;
  events: CalendarEvent[];
  workHours: WorkHour[];
  viewMode: 'events' | 'work-hours' | 'overlay';
  calendarMode?: 'events' | 'work-hours';
  onEventDrop: (eventId: string, newStartTime: Date) => void;
  onDragCreateEvent?: (startTime: Date, endTime: Date) => void;
  onClickCreateEvent?: (startTime: Date) => void;
  onEventEdit: (event: CalendarEvent) => void;
  onEventUpdate: (eventId: string, updates: Partial<CalendarEvent>) => void;
  onWorkHourChange?: (workHourId: string, changes: {
    startTime: Date;
    endTime: Date;
    duration: number;
  }) => void;
  onShowWorkHourChangeModal?: (workHour: WorkHour, changeType: 'modify' | 'new', changes: {
    startTime: Date;
    endTime: Date;
    duration: number;
  }) => void;
  onCreateWorkHour?: (workHour: {
    startTime: Date;
    endTime: Date;
    duration: number;
    day: string;
  }) => void;
  resetWorkHourDragState?: boolean;
}

function CalendarGrid({ 
  viewType, 
  currentDate, 
  events, 
  workHours,
  viewMode,
  calendarMode,
  onEventDrop, 
  onDragCreateEvent,
  onClickCreateEvent,
  onEventEdit,
  onEventUpdate,
  onWorkHourChange,
  onShowWorkHourChangeModal,
  onCreateWorkHour,
  resetWorkHourDragState
}: CalendarGridProps) {
  const [dragCreateState, setDragCreateState] = useState<DragCreateState>({
    isCreating: false,
    startTime: null,
    endTime: null,
    startPosition: null
  });

  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    eventId: null,
    resizeType: null,
    originalEvent: null
  });

  const calendarRef = useRef<HTMLDivElement>(null);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const [hasDragged, setHasDragged] = useState(false);

  // Generate dates based on view type
  const dates = useMemo(() => {
    if (viewType === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setHours(0, 0, 0, 0); // Normalize time component
      const day = startOfWeek.getDay();
      // Adjust for Monday start: if day is 0 (Sunday), go back 6 days; otherwise go back (day - 1) days
      const daysToSubtract = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(currentDate.getDate() - daysToSubtract);
      
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        date.setHours(0, 0, 0, 0); // Ensure normalized dates
        return date;
      });
    } else {
      // Month view - simplified to show current week for now
      const startOfWeek = new Date(currentDate);
      startOfWeek.setHours(0, 0, 0, 0); // Normalize time component
      const day = startOfWeek.getDay();
      // Adjust for Monday start: if day is 0 (Sunday), go back 6 days; otherwise go back (day - 1) days
      const daysToSubtract = day === 0 ? 6 : day - 1;
      startOfWeek.setDate(currentDate.getDate() - daysToSubtract);
      
      return Array.from({ length: 7 }, (_, i) => {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        date.setHours(0, 0, 0, 0); // Ensure normalized dates
        return date;
      });
    }
  }, [currentDate, viewType]);

  const hours = Array.from({ length: 24 }, (_, i) => i); // 00:00 to 23:00 (24 hours)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Handle drag create start
  const handleDragCreateStart = (startTime: Date, position: { x: number; y: number }) => {
    if (resizeState.isResizing) return; // Don't start drag create while resizing
    setHasDragged(false);
    setDragCreateState({
      isCreating: true,
      startTime,
      endTime: startTime,
      startPosition: position
    });
  };

  // Handle drag create move
  const handleDragCreateMove = (endTime: Date) => {
    if (dragCreateState.isCreating && dragCreateState.startTime) {
      setHasDragged(true);
      // Ensure end time is after start time
      const adjustedEndTime = endTime > dragCreateState.startTime ? endTime : dragCreateState.startTime;
      setDragCreateState(prev => ({
        ...prev,
        endTime: adjustedEndTime
      }));
    }
  };

  // Handle resize start
  const handleResizeStart = (eventId: string, resizeType: 'top' | 'bottom', event: CalendarEvent) => {
    setResizeState({
      isResizing: true,
      eventId,
      resizeType,
      originalEvent: event
    });
  };

  // Handle resize move
  const handleResizeMove = (newTime: Date) => {
    if (!resizeState.isResizing || !resizeState.originalEvent) return;

    const { originalEvent, resizeType } = resizeState;
    let newStartTime = originalEvent.startTime;
    let newEndTime = originalEvent.endTime;

    // Round to nearest 30 minutes
    const roundedTime = new Date(newTime);
    const minutes = roundedTime.getMinutes();
    const roundedMinutes = Math.round(minutes / 30) * 30;
    roundedTime.setMinutes(roundedMinutes, 0, 0);

    if (resizeType === 'top') {
      // Resizing from top (changing start time)
      newStartTime = roundedTime;
      // Ensure minimum 30 minutes duration
      if (newStartTime >= originalEvent.endTime) {
        const minEndTime = new Date(newStartTime);
        minEndTime.setMinutes(minEndTime.getMinutes() + 30);
        newEndTime = minEndTime;
      }
    } else {
      // Resizing from bottom (changing end time)
      newEndTime = roundedTime;
      // Ensure minimum 30 minutes duration
      if (newEndTime <= originalEvent.startTime) {
        const minEndTime = new Date(originalEvent.startTime);
        minEndTime.setMinutes(minEndTime.getMinutes() + 30);
        newEndTime = minEndTime;
      }
    }

    const duration = (newEndTime.getTime() - newStartTime.getTime()) / (1000 * 60 * 60); // hours

    onEventUpdate(resizeState.eventId!, {
      startTime: newStartTime,
      endTime: newEndTime,
      duration: Math.max(duration, 0.5) // Minimum 30 minutes
    });
  };

  // Handle mouse up to finish drag create or resize
  const handleMouseUp = useCallback(() => {
    if (dragCreateState.isCreating && dragCreateState.startTime && dragCreateState.endTime) {
      const duration = (dragCreateState.endTime.getTime() - dragCreateState.startTime.getTime()) / (1000 * 60 * 60);
      
      // If user dragged and created meaningful duration, create event immediately
      if (hasDragged && duration >= 0.5 && onDragCreateEvent) {
        onDragCreateEvent(dragCreateState.startTime, dragCreateState.endTime);
      } else if (!hasDragged && onClickCreateEvent) {
        // If user just clicked without dragging, open dialog for detailed creation
        onClickCreateEvent(dragCreateState.startTime);
      }
    }

    // Reset states
    setDragCreateState({
      isCreating: false,
      startTime: null,
      endTime: null,
      startPosition: null
    });
    setResizeState({
      isResizing: false,
      eventId: null,
      resizeType: null,
      originalEvent: null
    });
    setHasDragged(false);
  }, [dragCreateState, hasDragged, onDragCreateEvent, onClickCreateEvent, resizeState]);

  // Handle mouse move for resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizeState.isResizing || !calendarRef.current) return;

    const rect = calendarRef.current.getBoundingClientRect();
    const relativeY = e.clientY - rect.top - 64; // Subtract header height
    
    // Calculate which time slot the mouse is over
    const hourHeight = 60; // Each hour is 60px
    const slotHeight = 30; // Each 30-minute slot is 30px
    const slotIndex = Math.floor(relativeY / slotHeight);
    const hour = Math.floor(slotIndex / 2); // Starting from 00:00
    const minute = (slotIndex % 2) * 30;

    // Find which day column
    const relativeX = e.clientX - rect.left;
    const dayWidth = (rect.width - 49) / 7; // Subtract time column width (49px)
    const dayIndex = Math.max(0, Math.min(6, Math.floor((relativeX - 49) / dayWidth))); // Clamp to valid range

    if (dayIndex >= 0 && dayIndex < dates.length && hour >= 0 && hour < 24) {
      const newTime = new Date(dates[dayIndex]);
      newTime.setHours(hour, minute, 0, 0);
      handleResizeMove(newTime);
    }
  }, [resizeState, dates, handleResizeMove]);

  // Add global mouse up and mouse move listeners
  React.useEffect(() => {
    if (dragCreateState.isCreating || resizeState.isResizing) {
      document.addEventListener('mouseup', handleMouseUp);
      if (resizeState.isResizing) {
        document.addEventListener('mousemove', handleMouseMove);
      }
      
      return () => {
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [dragCreateState.isCreating, resizeState.isResizing, handleMouseUp, handleMouseMove]);

  // Auto-scroll to 6am when component mounts or dates change
  React.useEffect(() => {
    if (timeGridRef.current) {
      // Each hour is 60px tall, so 6am is at 6 * 60 = 360px
      const sixAmPosition = 6 * 60;
      timeGridRef.current.scrollTop = sixAmPosition;
    }
  }, [dates]); // Trigger when dates change (navigation)

  const handleEventDrop = (draggedEvent: DraggedEvent, newStartTime: Date) => {
    onEventDrop(draggedEvent.id, newStartTime);
  };

  const getEventsForDate = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    return events.filter(event => {
      const eventDateKey = event.startTime.toISOString().split('T')[0];
      return eventDateKey === dateKey;
    });
  };

  const getWorkHoursForDate = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    return workHours.filter(workHour => {
      const workHourDateKey = workHour.startTime.toISOString().split('T')[0];
      return workHourDateKey === dateKey;
    });
  };

  const getEventStyle = (event: CalendarEvent, date: Date) => {
    const startHour = event.startTime.getHours();
    const startMin = event.startTime.getMinutes();
    const duration = event.duration;
    
    // Calculate position (00:00 = 0, each hour = dynamic height based on available space)
    const hourHeight = 60; // Fixed height per hour for consistent iCal-like experience
    const topOffset = (startHour * hourHeight) + (startMin * hourHeight / 60);
    const height = duration * hourHeight;
    
    return {
      top: `${Math.max(0, topOffset)}px`,
      height: `${Math.max(height, 24)}px`, // Minimum height
      left: '4px',
      right: '4px'
    };
  };

  const getWorkHourStyle = (workHour: WorkHour, date: Date) => {
    const startHour = workHour.startTime.getHours();
    const startMin = workHour.startTime.getMinutes();
    const duration = workHour.duration;
    
    const hourHeight = 60;
    const topOffset = (startHour * hourHeight) + (startMin * hourHeight / 60);
    const height = duration * hourHeight;
    
    return {
      top: `${Math.max(0, topOffset)}px`,
      height: `${Math.max(height, 24)}px`,
      left: '0px',
      right: '0px'
    };
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    if (hour < 12) return `${hour}a`;
    return `${hour - 12}p`;
  };

  // Check if a time slot is in the create range
  const isTimeSlotInCreateRange = (date: Date, hour: number, minute: number) => {
    if (!dragCreateState.isCreating || !dragCreateState.startTime || !dragCreateState.endTime) {
      return false;
    }

    const slotTime = new Date(date);
    slotTime.setHours(hour, minute, 0, 0);

    const startTime = dragCreateState.startTime;
    const endTime = dragCreateState.endTime;

    // Check if this slot is in the same day and within the time range
    const sameDay = slotTime.toDateString() === startTime.toDateString();
    return sameDay && slotTime >= startTime && slotTime <= endTime;
  };

  return (
    <div 
      ref={calendarRef}
      className={`h-full flex flex-col bg-white overflow-hidden ${
        dragCreateState.isCreating || resizeState.isResizing ? 'select-none' : ''
      }`}
    >
      {/* Header Row */}
      <div className="flex border-b border-gray-200 bg-gray-50 h-12">
        <div className="grid flex-1" style={{ gridTemplateColumns: '49px repeat(7, 1fr)' }}>
          <div className="px-1 py-2 border-r border-gray-200 flex items-center justify-center">
            <span className="text-xs text-gray-600">Time</span>
          </div>
          {dates.map((date, index) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // Map JavaScript day index (0=Sun, 1=Mon, etc.) to our Monday-first array index
            const dayNameIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday becomes index 6, others subtract 1
            
            return (
              <div key={index} className="py-2 px-0 text-center border-r border-gray-200 last:border-r-0 flex items-center justify-center">
                <div className={`text-xs ${isToday ? 'font-medium text-blue-600' : isWeekend ? 'text-gray-400' : 'text-gray-600'}`}>
                  {dayNames[dayNameIndex]} {date.getDate()}
                  {isToday && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mx-auto mt-1"></div>}
                </div>
              </div>
            );
          })}
        </div>
        {/* Scrollbar spacer to align with the scrollable content below */}
        <div className="w-2 flex-shrink-0 bg-gray-50"></div>
      </div>

      {/* Time Grid */}
      <div ref={timeGridRef} className="grid relative overflow-y-auto flex-1 light-scrollbar" style={{ gridTemplateColumns: '49px repeat(7, 1fr)' }}>
        {/* Time Column */}
        <div className="border-r border-gray-200 bg-white sticky left-0 z-10">
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] flex items-start justify-center px-1 pt-2 border-b border-gray-100">
              <span className="text-xs text-gray-600 text-center">
                {formatHour(hour)}
              </span>
            </div>
          ))}
        </div>

        {/* Day Columns */}
        {dates.map((date, dayIndex) => (
          <div key={dayIndex} className="border-r border-gray-200 last:border-r-0 relative bg-white" data-calendar-grid>
            {/* Time Slots */}
            {hours.map((hour) => (
              <div key={hour} className="relative">
                {/* 2 half-hour slots per hour */}
                {[0, 30].map((minute) => (
                  <TimeSlot
                    key={`${hour}-${minute}`}
                    date={date}
                    hour={hour}
                    minute={minute}
                    viewMode={viewMode}
                    onEventDrop={handleEventDrop}
                    onClickCreateEvent={onClickCreateEvent}
                    events={getEventsForDate(date)}
                    dragCreateState={dragCreateState}
                    onDragCreateStart={handleDragCreateStart}
                    onDragCreateMove={handleDragCreateMove}
                    isInCreateRange={isTimeSlotInCreateRange(date, hour, minute)}
                    resizeState={resizeState}
                  />
                ))}
              </div>
            ))}

            {/* Work Hour Creator - invisible layer for creating new work hours in work-hours mode */}
            {calendarMode === 'work-hours' && onCreateWorkHour && (
              <WorkHourCreator
                date={date}
                calendarMode={calendarMode}
                onCreateWorkHour={onCreateWorkHour}
              />
            )}

            {/* Work Hours - Draggable when in work-hours mode */}
            {getWorkHoursForDate(date).map((workHour) => (
              <DraggableWorkHour
                key={workHour.id}
                workHour={workHour}
                style={getWorkHourStyle(workHour, date)}
                calendarMode={calendarMode}
                onWorkHourChange={onWorkHourChange || (() => {})}
                onShowChangeModal={onShowWorkHourChangeModal || (() => {})}
                resetDragState={resetWorkHourDragState}
              />
            ))}

            {/* Events */}
            {getEventsForDate(date).map((event) => (
              <div
                key={event.id}
                className={`transition-opacity duration-200 ${
                  calendarMode === 'work-hours' ? 'opacity-20' : 'opacity-100'
                }`}
              >
                <DraggableEvent
                  event={event}
                  style={getEventStyle(event, date)}
                  onEventUpdate={onEventUpdate}
                  onEventEdit={onEventEdit}
                  onResizeStart={handleResizeStart}
                  onResizeMove={handleResizeMove}
                  resizeState={resizeState}
                />
              </div>
            ))}

            {/* Drag create preview */}
            {dragCreateState.isCreating && 
             dragCreateState.startTime && 
             dragCreateState.endTime && 
             date.toDateString() === dragCreateState.startTime.toDateString() && (
              <div
                className="absolute bg-blue-400 bg-opacity-60 border-2 border-blue-500 border-dashed rounded-md pointer-events-none z-30"
                style={{
                  top: `${(dragCreateState.startTime.getHours() * 60) + (dragCreateState.startTime.getMinutes() * 60 / 60)}px`,
                  height: `${Math.max(((dragCreateState.endTime.getTime() - dragCreateState.startTime.getTime()) / (1000 * 60 * 60)) * 60, 15)}px`,
                  left: '4px',
                  right: '4px'
                }}
              >
                <div className="p-2 text-white text-xs font-medium">
                  New Event ({Math.round(((dragCreateState.endTime.getTime() - dragCreateState.startTime.getTime()) / (1000 * 60)) / 30) * 30}min)
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Status messages */}
      {dragCreateState.isCreating && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-2 rounded-md text-sm z-50">
          {hasDragged ? 'Release to create event' : 'Drag to set duration or release to open dialog'}
        </div>
      )}

      {resizeState.isResizing && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-2 rounded-md text-sm z-50">
          Resizing event - release to confirm
        </div>
      )}
    </div>
  );
}

interface DragDropCalendarProps {
  viewType: 'week' | 'month';
  currentDate: Date;
  events: CalendarEvent[];
  workHours: WorkHour[];
  viewMode: 'events' | 'work-hours' | 'overlay';
  calendarMode?: 'events' | 'work-hours';
  onEventDrop: (eventId: string, newStartTime: Date) => void;
  onDragCreateEvent?: (startTime: Date, endTime: Date) => void;
  onClickCreateEvent?: (startTime: Date) => void;
  onEventEdit: (event: CalendarEvent) => void;
  onEventUpdate: (eventId: string, updates: Partial<CalendarEvent>) => void;
  onWorkHourChange?: (workHourId: string, changes: {
    startTime: Date;
    endTime: Date;
    duration: number;
  }) => void;
  onShowWorkHourChangeModal?: (workHour: WorkHour, changeType: 'modify' | 'new', changes: {
    startTime: Date;
    endTime: Date;
    duration: number;
  }) => void;
  onCreateWorkHour?: (workHour: {
    startTime: Date;
    endTime: Date;
    duration: number;
    day: string;
  }) => void;
  resetWorkHourDragState?: boolean;
}

export function DragDropCalendar(props: DragDropCalendarProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <CalendarGrid {...props} />
    </DndProvider>
  );
}