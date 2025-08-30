import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Calendar as BigCalendar, momentLocalizer, View, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/en-gb'; // Import GB locale for Monday week start
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { usePlannerV2Context } from '../../contexts/PlannerV2Context';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { CalendarEvent, WorkHour } from '../../types';
import { Button } from '../ui/button';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar as CalendarIcon, MapPin, CalendarSearch, Trash2 } from 'lucide-react';
import { EventModal } from '../modals/EventModal';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar as DatePicker } from '../ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { TimeTracker } from '../work-hours/TimeTracker';
import { WorkSlotModal } from '../modals/WorkSlotModal';
import { WorkHourScopeDialog } from '../work-hours/WorkHourScopeDialog';
import { PlannerInsightCard } from '../planner/PlannerInsightCard';
import { CustomWeekHeader, CustomDayHeader } from '../planner/CustomCalendarHeaders';
import { splitMidnightCrossingEvents } from '@/services/events/eventSplittingService';
import { useWorkHours } from '../../hooks/useWorkHours';
import { getCalendarEventBackgroundColor, getCalendarEventTextColor, OKLCH_FALLBACK_GRAY } from '@/constants/colors';
import { calculateEventStyle, type EventStyleConfig } from '@/services/events/eventWorkHourIntegrationService';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '../planner/planner-overrides.css';

// Set moment locale to ensure Monday week start
moment.locale('en-gb');
moment.updateLocale('en-gb', {
  week: {
    dow: 1, // Monday is the first day of the week
    doy: 4  // The week that contains Jan 4th is the first week of the year
  }
});

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(BigCalendar);

interface BigCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEvent | WorkHour;
  isWorkHour?: boolean;
}

interface CustomEventProps {
  event: BigCalendarEvent;
  layerMode: 'events' | 'work-hours';
  updateEventWithUndo?: (eventId: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => void;
}

function CustomEvent({ event, layerMode, updateEventWithUndo }: CustomEventProps) {
  const { projects } = useProjectContext();
  const { deleteWorkHour } = useWorkHours();
  const { updateEvent } = usePlannerV2Context();
  const { isTimeTracking } = useSettingsContext();
  const resource = event.resource;

  const isCalendarEvent = (res: CalendarEvent | WorkHour): res is CalendarEvent => 'projectId' in res;
  const isWorkHour = event.isWorkHour || !isCalendarEvent(resource);
  const workHour = isWorkHour ? (resource as WorkHour) : null;
  const calendarEvent = !isWorkHour ? (resource as CalendarEvent) : null;
  const project = calendarEvent?.projectId ? projects.find(p => p.id === calendarEvent.projectId) : null;
  const isCurrentlyTracking = !!(calendarEvent && isTimeTracking && (calendarEvent.type === 'tracked' || calendarEvent.title?.startsWith('🔴')));

  const handleDeleteWorkHour = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (workHour) {
      deleteWorkHour(workHour.id);
    }
  }, [workHour?.id, deleteWorkHour]);

  if (isWorkHour && workHour) {
    // Show work hours with same layout as events
    const canInteract = layerMode === 'work-hours';
    const start = moment(workHour.startTime).format('HH:mm');
    const end = moment(workHour.endTime).format('HH:mm');
    
    return (
      <div className="h-full flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] leading-none opacity-80 font-medium">{start} - {end}</div>
          {canInteract && (
            <button className="text-red-500 hover:text-red-700 text-xs opacity-60 hover:opacity-100" onClick={handleDeleteWorkHour} title="Delete work hour">
              ×
            </button>
          )}
        </div>
        <div className="text-xs opacity-75 truncate leading-tight">{workHour.title}</div>
        {workHour.description && <div className="text-xs opacity-75 truncate leading-tight">{workHour.description}</div>}
      </div>
    );
  }

  if (calendarEvent) {
    // Custom top row: time (left) + checkbox/red dot (right), then client/project lines
    const start = moment(event.start).format('HH:mm');
    const end = moment(event.end).format('HH:mm');
    const canInteract = layerMode === 'events';
    
    const handleCompletionToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (calendarEvent && !isCurrentlyTracking && canInteract) {
        const updateFn = updateEventWithUndo || updateEvent;
        updateFn(calendarEvent.id, { completed: !calendarEvent.completed });
      }
    };

    return (
      <div className="h-full flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] leading-none font-medium">{start} - {end}</div>
          <div className="text-current">
            {isCurrentlyTracking ? (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Currently recording" />
            ) : canInteract ? (
              <button type="button" className="cursor-pointer hover:scale-110 transition-transform text-current" onClick={handleCompletionToggle} aria-label={calendarEvent.completed ? 'Mark as not completed' : 'Mark as completed'}>
                {calendarEvent.completed ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              </button>
            ) : (
              <div className="text-current opacity-50">
                {calendarEvent.completed ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              </div>
            )}
          </div>
        </div>
        <div className="text-xs font-semibold truncate leading-tight">
          {calendarEvent.type === 'tracked' || calendarEvent.type === 'completed' ? 'Tracked Time' : (calendarEvent.description || calendarEvent.title)}
        </div>
        <div className="text-xs opacity-75 truncate leading-tight">
          {project ? `${project.name}${project.client ? ` • ${project.client}` : ''}` : 'No Project'}
        </div>
      </div>
    );
  }

  return null;
}

export function PlannerView() {
  const { projects } = useProjectContext();
  const { currentDate, setCurrentDate } = useTimelineContext();
  
  // Use PlannerV2Context for events since PlannerV2 will replace this view
  const {
    events,
    addEvent,
    updateEvent,
    deleteEvent
  } = usePlannerV2Context();
  
  // Keep PlannerContext for global modal state management
  const {
    setSelectedEventId,
    selectedEventId,
    setCreatingNewEvent
  } = usePlannerContext();
  
  const { workHours, addWorkHour, updateWorkHour, deleteWorkHour, showScopeDialog, pendingWorkHourChange, confirmWorkHourChange, cancelWorkHourChange, setCurrentViewDate } = useWorkHours();
  
  const [view, setView] = useState<View>(Views.WEEK);
  const [calendarDate, setCalendarDate] = useState(new Date(currentDate));
  const [layerMode, setLayerMode] = useState<'events' | 'work-hours'>('events');
  const [showWorkHourCreator, setShowWorkHourCreator] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  
  // State for undo functionality
  const [lastAction, setLastAction] = useState<{
    type: 'update' | 'create' | 'delete';
    eventId: string;
    previousState?: Partial<CalendarEvent>;
    event?: CalendarEvent;
  } | null>(null);

  // Set initial view date for work hours
  useEffect(() => {
    setCurrentViewDate(calendarDate);
  }, []);

  // Scroll to 6am on initial load and view changes
  useEffect(() => {
    const scrollToDefaultTime = () => {
      // Find the time content container
      const timeContent = document.querySelector('.rbc-time-content');
      if (timeContent) {
        // Calculate scroll position for 6am
        // Each hour is approximately 60px (timeslot-group height)
        const hourHeight = 60;
        const sixAmPosition = 6 * hourHeight;
        
        // Smooth scroll to position
        timeContent.scrollTo({
          top: sixAmPosition,
          behavior: 'smooth'
        });
      }
    };

    // Use multiple attempts to ensure DOM is ready
    let attempts = 0;
    const maxAttempts = 5;
    
    const scrollWithRetry = () => {
      const timeContent = document.querySelector('.rbc-time-content');
      if (timeContent && timeContent.scrollHeight > 0) {
        scrollToDefaultTime();
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(scrollWithRetry, 200);
      }
    };

    // Initial attempt after a short delay
    const timer = setTimeout(scrollWithRetry, 100);
    return () => clearTimeout(timer);
  }, [view, calendarDate]);

  // Keyboard shortcut handlers
  const handleEscape = useCallback(() => {
    // Clear all possible open states
    if (selectedEventId) {
      setSelectedEventId(null);
    }
    if (isDatePickerOpen) {
      setIsDatePickerOpen(false);
    }
    if (showWorkHourCreator) {
      setShowWorkHourCreator(false);
      setSelectedSlot(null);
    }
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
      setEventToDelete(null);
    }
  }, [selectedEventId, isDatePickerOpen, showWorkHourCreator, showDeleteConfirm, setSelectedEventId]);

  const handleUndo = useCallback(() => {
    if (!lastAction) return;

    try {
      switch (lastAction.type) {
        case 'update':
          if (lastAction.previousState && lastAction.eventId) {
            updateEvent(lastAction.eventId, lastAction.previousState, { silent: true });
            setLastAction(null);
          }
          break;
        case 'delete':
          if (lastAction.event) {
            // Re-create the deleted event
            const { id, ...eventData } = lastAction.event;
            addEvent(eventData);
            setLastAction(null);
          }
          break;
        // Note: We don't undo 'create' actions as they're more complex
        // and would require deleting the newly created event
      }
    } catch (error) {
      console.error('Failed to undo action:', error);
    }
  }, [lastAction, updateEvent, addEvent]);

  // Enhanced updateEvent wrapper to track changes for undo
  const updateEventWithUndo = useCallback((eventId: string, updates: Partial<CalendarEvent>, options?: { silent?: boolean }) => {
    if (!options?.silent) {
      const originalEvent = events.find(e => e.id === eventId);
      if (originalEvent) {
        // Store the previous state for undo (only the fields being updated)
        const previousState: Partial<CalendarEvent> = {};
        Object.keys(updates).forEach(key => {
          const typedKey = key as keyof CalendarEvent;
          (previousState as any)[typedKey] = originalEvent[typedKey];
        });
        
        setLastAction({
          type: 'update',
          eventId,
          previousState
        });
      }
    }
    
    updateEvent(eventId, updates, options);
  }, [events, updateEvent]);

  const handleToggleCompletion = useCallback(() => {
    if (!selectedEventId || layerMode !== 'events') return;

    let selectedEvent = events.find(e => e.id === selectedEventId);
    
    // Handle split events - if we can't find the event by ID, check if it's a split event
    if (!selectedEvent && selectedEventId?.includes('-split-')) {
      const originalEventId = selectedEventId.split('-split-')[0];
      selectedEvent = events.find(e => e.id === originalEventId);
    }
    
    if (!selectedEvent) return;

    // Get the original event ID in case this is a split event
    const originalEventId = selectedEventId?.includes('-split-') 
      ? selectedEventId.split('-split-')[0] 
      : selectedEvent.id;

    updateEventWithUndo(originalEventId, { completed: !selectedEvent.completed });
  }, [selectedEventId, events, layerMode, updateEventWithUndo]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedEventId || layerMode !== 'events') {
      return;
    }

    let selectedEvent = events.find(e => e.id === selectedEventId);
    
    // Handle split events - if we can't find the event by ID, check if it's a split event
    if (!selectedEvent && selectedEventId?.includes('-split-')) {
      const originalEventId = selectedEventId.split('-split-')[0];
      selectedEvent = events.find(e => e.id === originalEventId);
    }
    
    if (!selectedEvent) {
      return;
    }

    // Show confirmation dialog instead of deleting immediately
    setEventToDelete(selectedEventId);
    setShowDeleteConfirm(true);
  }, [selectedEventId, events, layerMode]);

  const handleConfirmDelete = useCallback(() => {
    if (!eventToDelete) return;

    let selectedEvent = events.find(e => e.id === eventToDelete);
    
    // Handle split events - if we can't find the event by ID, check if it's a split event
    if (!selectedEvent && eventToDelete?.includes('-split-')) {
      const originalEventId = eventToDelete.split('-split-')[0];
      selectedEvent = events.find(e => e.id === originalEventId);
    }
    
    if (selectedEvent) {
      // Get the original event ID in case this is a split event
      const originalEventId = eventToDelete?.includes('-split-') 
        ? eventToDelete.split('-split-')[0] 
        : selectedEvent.id;
      
      // Store for undo
      setLastAction({
        type: 'delete',
        eventId: originalEventId,
        event: selectedEvent
      });

      deleteEvent(originalEventId);
      setSelectedEventId(null);
    }

    setShowDeleteConfirm(false);
    setEventToDelete(null);
  }, [eventToDelete, events, deleteEvent, setSelectedEventId]);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setEventToDelete(null);
  }, []);

  const handleCreateNewEvent = useCallback(() => {
    if (layerMode === 'events') {
      // Create a 1-hour event starting at the current time or 9 AM
      const now = new Date();
      const startTime = new Date(calendarDate);
      
      // If viewing today, start from current time, otherwise start at 9 AM
      if (startTime.toDateString() === now.toDateString()) {
        startTime.setHours(now.getHours(), 0, 0, 0);
      } else {
        startTime.setHours(9, 0, 0, 0);
      }
      
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 1);
      
      setCreatingNewEvent({ startTime, endTime });
    } else {
      // Create work hour
      const startTime = new Date(calendarDate);
      startTime.setHours(9, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(17, 0, 0, 0);
      
      setSelectedSlot({ start: startTime, end: endTime });
      setShowWorkHourCreator(true);
    }
  }, [layerMode, calendarDate, setCreatingNewEvent]);

  // Convert our events to Big Calendar format
  const bigCalendarEvents: BigCalendarEvent[] = useMemo(() => {
    // Split events that cross midnight to ensure proper display across days
    const splitEvents = splitMidnightCrossingEvents(events);
    
    const eventItems: BigCalendarEvent[] = splitEvents.map(event => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      resource: event,
      isWorkHour: false
    }));

    // Always include work hours, but their styling will depend on layerMode
    const workHourEvents: BigCalendarEvent[] = workHours.map(workHour => ({
      id: `work-${workHour.id}`,
      title: `Work: ${workHour.title}`,
      start: workHour.startTime,
      end: workHour.endTime,
      resource: workHour,
      isWorkHour: true
    }));
    
    return [...eventItems, ...workHourEvents];
  }, [events, workHours]);

  // Style events based on project colors and completion status
  const eventStyleGetter = useCallback((event: BigCalendarEvent) => {
    const resource = event.resource;
    
    // Type guard to check if resource is CalendarEvent
    const isCalendarEvent = (res: CalendarEvent | WorkHour): res is CalendarEvent => {
      return 'projectId' in res;
    };
    
    // Check if this event is selected
    const isSelected = !event.isWorkHour && selectedEventId === event.resource.id;
    
    // Check if event is in the future (precise to minute)
    const now = new Date();
    const eventStart = new Date(event.start);
    const isFutureEvent = eventStart > now;
    
    if (event.isWorkHour || !isCalendarEvent(resource)) {
      // Style for work hours
      const isActiveLayer = layerMode === 'work-hours';
      
      // Check if work hour is in the past
      const workHourEnd = new Date(event.end);
      const isPastWorkHour = workHourEnd < now;
      
      let opacity = isActiveLayer ? 0.7 : 0.3; // Faded when not active layer
      let pointerEvents: 'auto' | 'none' = isActiveLayer ? 'auto' : 'none';
      
      // Further fade and disable past work hours
      if (isPastWorkHour) {
        opacity = Math.min(opacity, 0.4);
        pointerEvents = 'none';
      }
      
      return {
        style: {
          backgroundColor: '#e3f2fd',
          color: '#1976d2',
          borderRadius: '6px',
          opacity,
          fontSize: '12px',
          padding: '2px',
          pointerEvents, // Disable interaction when not active or in past
        },
        className: 'hide-label work-hour-event'
      };
    } else {
      // Style for regular calendar events
      const calendarEvent = resource as CalendarEvent;
      const project = calendarEvent.projectId ? projects.find(p => p.id === calendarEvent.projectId) : null;
      const isActiveLayer = layerMode === 'events';
      
      // Get the base color (project color or fallback)
      const baseColor = calendarEvent.color || (project ? project.color : OKLCH_FALLBACK_GRAY);
      
      // Calculate event styling using service
      const styleConfig: EventStyleConfig = {
        isSelected,
        isFutureEvent,
        isActiveLayer,
        isCompleted: calendarEvent.completed
      };
      
      const { backgroundColor, textColor, borderColor, opacity: finalOpacity } = calculateEventStyle(baseColor, styleConfig);
      
      return {
        style: {
          backgroundColor,
          borderRadius: '6px',
          opacity: finalOpacity,
          color: textColor,
          fontSize: '12px',
          pointerEvents: isActiveLayer ? 'auto' : 'none', // Disable interaction when not active
          outline: 'none', // Ensure no focus outline
          boxShadow: 'none', // Ensure no box shadow
          // Set CSS variables for border colors
          '--future-event-border-color': baseColor,
          '--selected-event-border-color': borderColor
        } as React.CSSProperties,
        className: `${isFutureEvent ? 'future-event' : ''} ${isSelected ? 'selected-event' : ''} hide-label`.trim()
      };
    }
  }, [projects, layerMode, selectedEventId]);

  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    // Only allow selection if we're in the correct layer mode
    if (event.isWorkHour && layerMode === 'work-hours') {
      // Work hour selected in work hours mode
      // Currently no specific action needed for work hour selection
      // Could add work hour editing modal here in the future
      return;
    } else if (!event.isWorkHour && layerMode === 'events') {
      // Regular event selected in events mode
      setSelectedEventId(event.resource.id);
      return;
    }
    
    // Prevent any interaction when not in the appropriate mode
  }, [setSelectedEventId, layerMode]);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    if (layerMode === 'work-hours') {
      // Create work hour when in work hours mode
      setSelectedSlot({ start, end });
      setShowWorkHourCreator(true);
    } else {
      // Create regular event when in events mode
      const startTime = new Date(start);
      const endTime = new Date(end);
      
      // For all-day events (when start and end are the same day at midnight)
      if (startTime.getHours() === 0 && endTime.getHours() === 0 && 
          startTime.toDateString() === endTime.toDateString()) {
        // Set to a 1-hour event starting at 9 AM
        startTime.setHours(9, 0, 0, 0);
        endTime.setHours(10, 0, 0, 0);
      }
      
      setCreatingNewEvent({
        startTime,
        endTime
      });
    }
  }, [setCreatingNewEvent, layerMode]);

  const handleEventDrop = useCallback(({ event, start, end }: { 
    event: BigCalendarEvent; 
    start: Date; 
    end: Date; 
  }) => {
    // Only allow drag and drop when in the appropriate layer mode
    if (event.isWorkHour && layerMode === 'work-hours') {
      // Update work hour
      const workHourId = event.id.replace('work-', '');
      updateWorkHour(workHourId, {
        startTime: start,
        endTime: end,
      });
    } else if (!event.isWorkHour && layerMode === 'events') {
      // Update regular event
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      updateEventWithUndo(event.id, {
        startTime: start,
        endTime: end,
        duration
      });
    }
    // Ignore drag operations when not in the appropriate mode
  }, [updateEventWithUndo, updateWorkHour, layerMode]);

  const handleEventResize = useCallback(({ event, start, end }: { 
    event: BigCalendarEvent; 
    start: Date; 
    end: Date; 
  }) => {
    // Only allow resize when in the appropriate layer mode
    if (event.isWorkHour && layerMode === 'work-hours') {
      // Update work hour
      const workHourId = event.id.replace('work-', '');
      updateWorkHour(workHourId, {
        startTime: start,
        endTime: end,
      });
    } else if (!event.isWorkHour && layerMode === 'events') {
      // Update regular event
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      updateEventWithUndo(event.id, {
        startTime: start,
        endTime: end,
        duration
      });
    }
    // Ignore resize operations when not in the appropriate mode
  }, [updateEventWithUndo, updateWorkHour, layerMode]);

  const handleCreateWorkHour = useCallback((workHourData: Omit<WorkHour, 'id'>) => {
    // Don't pass scope - let the hook handle showing the dialog
    addWorkHour(workHourData);
    setShowWorkHourCreator(false);
    setSelectedSlot(null);
  }, [addWorkHour]);

  const handleNavigate = useCallback((action: 'PREV' | 'NEXT' | 'TODAY') => {
    let newDate = new Date(calendarDate);
    
    switch (action) {
      case 'PREV':
        if (view === Views.MONTH) {
          newDate.setMonth(newDate.getMonth() - 1);
        } else if (view === Views.WEEK) {
          newDate.setDate(newDate.getDate() - 7);
        } else if (view === Views.DAY) {
          newDate.setDate(newDate.getDate() - 1);
        }
        break;
      case 'NEXT':
        if (view === Views.MONTH) {
          newDate.setMonth(newDate.getMonth() + 1);
        } else if (view === Views.WEEK) {
          newDate.setDate(newDate.getDate() + 7);
        } else if (view === Views.DAY) {
          newDate.setDate(newDate.getDate() + 1);
        }
        break;
      case 'TODAY':
        newDate = new Date();
        break;
    }
    
    setCalendarDate(newDate);
    setCurrentDate(newDate);
    setCurrentViewDate(newDate);
  }, [calendarDate, view, setCurrentDate, setCurrentViewDate]);

  const handleOnNavigate = useCallback((date: Date) => {
    setCalendarDate(date);
    setCurrentDate(date);
    setCurrentViewDate(date);
  }, [setCurrentDate, setCurrentViewDate]);

  const handleDateSelect = useCallback((selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    
    // Normalize the selected date
    const normalizedDate = new Date(selectedDate);
    normalizedDate.setHours(0, 0, 0, 0);
    
    // Close the date picker
    setIsDatePickerOpen(false);
    
    // Update calendar view to the selected date
    setCalendarDate(normalizedDate);
    setCurrentDate(normalizedDate);
    setCurrentViewDate(normalizedDate);
  }, [setCurrentDate, setCurrentViewDate]);

  const formatDateRange = useCallback(() => {
    const start = moment(calendarDate);
    
    if (view === Views.WEEK) {
      const weekStart = start.clone().startOf('week');
      const weekEnd = start.clone().endOf('week');
      
      if (weekStart.month() === weekEnd.month()) {
        return `${weekStart.format('MMM D')} - ${weekEnd.format('D, YYYY')}`;
      } else {
        return `${weekStart.format('MMM D')} - ${weekEnd.format('MMM D, YYYY')}`;
      }
    } else if (view === Views.DAY) {
      return start.format('MMMM D, YYYY');
    } else {
      return start.format('MMMM YYYY');
    }
  }, [calendarDate, view]);

  // Keyboard shortcuts - defined after all handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement || 
          (e.target as HTMLElement).contentEditable === 'true') {
        return;
      }

      // Handle modifier key combinations first
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            handleUndo();
            break;
        }
        return;
      }

      // Handle regular keys
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          // Add a small delay to ensure modal handlers complete first
          setTimeout(() => handleEscape(), 10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleNavigate('PREV');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNavigate('NEXT');
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (view === Views.WEEK) {
            setView(Views.MONTH);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (view === Views.MONTH) {
            setView(Views.WEEK);
          } else if (view === Views.WEEK) {
            setView(Views.DAY);
          }
          break;
        case ' ': // Spacebar
          e.preventDefault();
          handleToggleCompletion();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          handleDeleteSelected();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          handleCreateNewEvent();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          handleNavigate('TODAY');
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          setLayerMode(layerMode === 'events' ? 'work-hours' : 'events');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleEscape, handleUndo, handleNavigate, handleToggleCompletion, handleDeleteSelected, handleCreateNewEvent, view, layerMode, setLayerMode, setView]);

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Calendar Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-[#595956]">Planner</h1>
        </div>
        
        {/* Time Tracker in top right */}
        <TimeTracker />
      </div>

      {/* Calendar Controls - styled like Timeline view */}
      <div className="px-6 p-[21px]">
        <div className="flex items-center justify-between">
          {/* Left side controls */}
          <div className="flex items-center" style={{ gap: '21px' }}>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(value) => {
                if (value) {
                  setView(value as View);
                }
              }}
              variant="outline"
              className="border border-gray-200 rounded-lg h-9 p-1"
            >
              <ToggleGroupItem value={Views.WEEK} aria-label="Week mode" className="px-3 py-1 h-7">
                Week
              </ToggleGroupItem>
              <ToggleGroupItem value={Views.DAY} aria-label="Day mode" className="px-3 py-1 h-7">
                Day
              </ToggleGroupItem>
            </ToggleGroup>
            
            <ToggleGroup
              type="single"
              value={layerMode}
              onValueChange={(value) => {
                if (value) {
                  setLayerMode(value as 'events' | 'work-hours');
                }
              }}
              variant="outline"
              className="border border-gray-200 rounded-lg h-9 p-1"
            >
              <ToggleGroupItem value="events" aria-label="Events mode" className="px-3 py-1 h-7">
                Events
              </ToggleGroupItem>
              <ToggleGroupItem value="work-hours" aria-label="Work Hours mode" className="px-3 py-1 h-7">
                Work Hours
              </ToggleGroupItem>
            </ToggleGroup>
            
            <Button variant="outline" onClick={() => handleNavigate('TODAY')} className="h-9 gap-2">
              <MapPin className="w-4 h-4" />
              Today
            </Button>
            
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <CalendarSearch className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DatePicker
                  mode="single"
                  selected={calendarDate}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Right side navigation */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => handleNavigate('PREV')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h2 className="text-sm font-semibold text-gray-900 text-center px-2">
              {formatDateRange()}
            </h2>
            
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => handleNavigate('NEXT')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <DragAndDropCalendar
            localizer={localizer}
            events={bigCalendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: '100%' }}
            view={view}
            onView={setView}
            date={calendarDate}
            onNavigate={handleOnNavigate}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
            selectable
            resizable
            // Enhanced drag and drop configuration
            draggableAccessor={() => true}
            resizableAccessor={() => true}
            dragFromOutsideItem={null}
            eventPropGetter={eventStyleGetter}
            components={{
              event: (props: any) => <CustomEvent {...props} layerMode={layerMode} updateEventWithUndo={updateEventWithUndo} />,
              toolbar: () => null,
              week: {
                header: CustomWeekHeader,
              },
              day: {
                header: CustomDayHeader,
              }
            }}
            formats={{
              dayFormat: 'ddd DD', // Day abbreviation followed by date (e.g., "Mon 23")
              timeGutterFormat: 'HH:mm',
              eventTimeRangeFormat: ({ start, end }) => 
                `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
              agendaTimeFormat: 'HH:mm',
              agendaTimeRangeFormat: ({ start, end }) => 
                `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`
            }}
            step={15}
            timeslots={4}
            scrollToTime={moment().hours(6).minutes(0).toDate()}
            defaultView={Views.WEEK}
            popup
            popupOffset={30}
            culture="en-GB"
            titleAccessor="title"
            allDayAccessor={() => false}
            messages={{
              week: 'Week',
              day: 'Day',
              month: 'Month',
              previous: 'Previous',
              next: 'Next',
              today: 'Today',
              agenda: 'Agenda'
            }}
          />
        </div>
      </div>

      {/* Calendar Insight Card */}
      <div className="px-6 pb-6">
        <PlannerInsightCard 
          dates={useMemo(() => {
            if (view === Views.DAY) {
              return [calendarDate];
            } else if (view === Views.WEEK) {
              // Get the week containing calendarDate
              const startOfWeek = moment(calendarDate).startOf('week');
              const dates = [];
              for (let i = 0; i < 7; i++) {
                dates.push(startOfWeek.clone().add(i, 'days').toDate());
              }
              return dates;
            }
            return [calendarDate];
          }, [view, calendarDate])}
          events={splitMidnightCrossingEvents(events)}
          view={view === Views.DAY ? 'day' : 'week'}
        />
      </div>

      {/* Work Hour Creation Modal */}
      {showWorkHourCreator && selectedSlot && (
        <WorkSlotModal
          isOpen={showWorkHourCreator}
          onClose={() => {
            setShowWorkHourCreator(false);
            setSelectedSlot(null);
          }}
          onSave={handleCreateWorkHour}
          defaultStart={selectedSlot.start}
          defaultEnd={selectedSlot.end}
        />
      )}

      {/* Work Hour Scope Dialog */}
      {showScopeDialog && pendingWorkHourChange && (
        <WorkHourScopeDialog
          isOpen={showScopeDialog}
          onClose={cancelWorkHourChange}
          onConfirm={confirmWorkHourChange}
          changeType={pendingWorkHourChange.type}
          isFromSettings={pendingWorkHourChange.isFromSettings}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone (though you can use Ctrl+Z to undo immediately after).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}