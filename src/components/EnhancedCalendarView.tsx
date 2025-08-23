import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Calendar as BigCalendar, momentLocalizer, View, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import 'moment/locale/en-gb'; // Import GB locale for Monday week start
import { useApp } from '../contexts/AppContext';
import { CalendarEvent, WorkHour } from '../types';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar as CalendarIcon, MapPin, CalendarSearch } from 'lucide-react';
import { EventDetailModal } from './EventDetailModal';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar as DatePicker } from './ui/calendar';
import { TimeTracker } from './TimeTracker';
import { WorkHourCreationModal } from './WorkHourCreationModal';
import { WorkHourScopeDialog } from './WorkHourScopeDialog';
import { CalendarInsightCard } from './CalendarInsightCard';
import { useWorkHours } from '../hooks/useWorkHours';
import { getCalendarEventBackgroundColor, getCalendarEventTextColor, OKLCH_FALLBACK_GRAY } from '@/constants/colors';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './calendar-overrides.css';

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
}

function CustomEvent({ event }: CustomEventProps) {
  const { projects } = useApp();
  const { deleteWorkHour } = useWorkHours();
  const { updateEvent, isTimeTracking } = useApp();
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
    // Show built-in label for work hours (we don't hide it) and our content below
    return (
      <div className="h-full flex items-center justify-between px-2 py-1">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{workHour.title}</div>
          {workHour.description && <div className="text-xs opacity-75 truncate">{workHour.description}</div>}
        </div>
        <button className="ml-2 text-red-500 hover:text-red-700 text-xs opacity-60 hover:opacity-100" onClick={handleDeleteWorkHour} title="Delete work hour">
          ×
        </button>
      </div>
    );
  }

  if (calendarEvent) {
    // Custom top row: time (left) + checkbox/red dot (right), then client/project lines
    const start = moment(event.start).format('HH:mm');
    const end = moment(event.end).format('HH:mm');
    const handleCompletionToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (calendarEvent && !isCurrentlyTracking) {
        updateEvent(calendarEvent.id, { completed: !calendarEvent.completed });
      }
    };

    return (
  <div className="h-full flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] leading-none opacity-80 font-medium">{start} - {end}</div>
          <div className="text-current">
            {isCurrentlyTracking ? (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Currently recording" />
            ) : (
              <button type="button" className="cursor-pointer hover:scale-110 transition-transform text-current" onClick={handleCompletionToggle} aria-label={calendarEvent.completed ? 'Mark as not completed' : 'Mark as completed'}>
                {calendarEvent.completed ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>
        {project?.client && <div className="text-xs opacity-75 truncate leading-tight">{project.client}</div>}
        {project && <div className="text-xs opacity-75 truncate leading-tight">{project.name}</div>}
      </div>
    );
  }

  return null;
}

export function EnhancedCalendarView() {
  const {
    currentDate,
    setCurrentDate,
    events,
    addEvent,
    updateEvent,
    projects,
    setSelectedEventId,
    setCreatingNewEvent
  } = useApp();
  
  const { workHours, addWorkHour, updateWorkHour, deleteWorkHour, showScopeDialog, pendingWorkHourChange, confirmWorkHourChange, cancelWorkHourChange, setCurrentViewDate } = useWorkHours();
  
  const [view, setView] = useState<View>(Views.WEEK);
  const [calendarDate, setCalendarDate] = useState(new Date(currentDate));
  const [showWorkHours, setShowWorkHours] = useState(true);
  const [showWorkHourCreator, setShowWorkHourCreator] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

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

  // Convert our events to Big Calendar format
  const bigCalendarEvents: BigCalendarEvent[] = useMemo(() => {
    const eventItems: BigCalendarEvent[] = events.map(event => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      resource: event,
      isWorkHour: false
    }));

    // Add work hours if enabled
    if (showWorkHours) {
      const workHourEvents: BigCalendarEvent[] = workHours.map(workHour => ({
        id: `work-${workHour.id}`,
        title: `Work: ${workHour.title}`,
        start: workHour.startTime,
        end: workHour.endTime,
        resource: workHour,
        isWorkHour: true
      }));
      
      return [...eventItems, ...workHourEvents];
    }

    return eventItems;
  }, [events, workHours, showWorkHours]);

  // Style events based on project colors and completion status
  const eventStyleGetter = useCallback((event: BigCalendarEvent) => {
    const resource = event.resource;
    
    // Type guard to check if resource is CalendarEvent
    const isCalendarEvent = (res: CalendarEvent | WorkHour): res is CalendarEvent => {
      return 'projectId' in res;
    };
    
    // Check if event is in the future (precise to minute)
    const now = new Date();
    const eventStart = new Date(event.start);
    const isFutureEvent = eventStart > now;
    
    if (event.isWorkHour || !isCalendarEvent(resource)) {
      // Style for work hours
      return {
        style: {
          backgroundColor: '#e3f2fd',
          color: '#1976d2',
          border: '2px dashed #1976d2',
          borderRadius: '6px',
          opacity: 0.7,
          fontSize: '12px',
          padding: '2px'
        }
      };
    } else {
      // Style for regular calendar events
      const calendarEvent = resource as CalendarEvent;
      const project = calendarEvent.projectId ? projects.find(p => p.id === calendarEvent.projectId) : null;
      
      // Get the base color (project color or fallback)
      const baseColor = calendarEvent.color || (project ? project.color : OKLCH_FALLBACK_GRAY);
      
      // Create light background and dark text versions
      let backgroundColor = getCalendarEventBackgroundColor(baseColor);
      const textColor = getCalendarEventTextColor(baseColor);
      
      // Make future events even lighter by increasing lightness further
      if (isFutureEvent) {
        // For future events, set lightness very high and reduce chroma for almost white appearance
        const match = backgroundColor.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
        if (match) {
          const [, lightness, chroma, hue] = match;
          // Set to very high lightness (0.98) and very low chroma (0.02) for almost white appearance
          const newLightness = 0.98;
          const newChroma = 0.02; // Much lower chroma for subtle tint
          backgroundColor = `oklch(${newLightness} ${newChroma} ${hue})`;
        }
      }
      
      return {
        style: {
          backgroundColor,
          borderRadius: '6px',
          opacity: calendarEvent.completed ? 0.6 : 1,
          color: textColor,
          fontSize: '12px',
          // Set CSS variable for future event border color
          '--future-event-border-color': baseColor
        } as React.CSSProperties,
        className: `${isFutureEvent ? 'future-event' : ''} hide-label`.trim()
      };
    }
  }, [projects]);

  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    if (!event.isWorkHour) {
      setSelectedEventId(event.resource.id);
    }
  }, [setSelectedEventId]);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    // Check if it's a Ctrl+click for work hours
    const isCtrlClick = window.event && (window.event as any).ctrlKey;
    
    if (isCtrlClick) {
      // Create work hour
      setSelectedSlot({ start, end });
      setShowWorkHourCreator(true);
    } else {
      // Create regular event
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
  }, [setCreatingNewEvent]);

  const handleEventDrop = useCallback(({ event, start, end }: { 
    event: BigCalendarEvent; 
    start: Date; 
    end: Date; 
  }) => {
    if (event.isWorkHour) {
      // Update work hour
      const workHourId = event.id.replace('work-', '');
      console.log('Dragging work hour:', { originalEventId: event.id, workHourId, start, end });
      updateWorkHour(workHourId, {
        startTime: start,
        endTime: end,
      });
    } else {
      // Update regular event
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      updateEvent(event.id, {
        startTime: start,
        endTime: end,
        duration
      });
    }
  }, [updateEvent, updateWorkHour]);

  const handleEventResize = useCallback(({ event, start, end }: { 
    event: BigCalendarEvent; 
    start: Date; 
    end: Date; 
  }) => {
    if (event.isWorkHour) {
      // Update work hour
      const workHourId = event.id.replace('work-', '');
      console.log('Resizing work hour:', { originalEventId: event.id, workHourId, start, end });
      updateWorkHour(workHourId, {
        startTime: start,
        endTime: end,
      });
    } else {
      // Update regular event
      const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      updateEvent(event.id, {
        startTime: start,
        endTime: end,
        duration
      });
    }
  }, [updateEvent, updateWorkHour]);

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

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Calendar Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-[#595956]">Planner</h1>
          
          {/* Work Hours Toggle */}
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showWorkHours}
              onChange={(e) => setShowWorkHours(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-600">Show Work Hours</span>
          </label>
          
          <div className="text-xs text-gray-500">
            Ctrl+Click to create work hours
          </div>
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
              event: (props: any) => <CustomEvent {...props} />,
              toolbar: () => null
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
        <CalendarInsightCard 
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
          events={events}
          view={view === Views.DAY ? 'day' : 'week'}
        />
      </div>

      {/* Work Hour Creation Modal */}
      {showWorkHourCreator && selectedSlot && (
        <WorkHourCreationModal
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
    </div>
  );
}