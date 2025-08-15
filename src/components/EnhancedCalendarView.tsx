import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import moment from 'moment';
import { useApp } from '../contexts/AppContext';
import { CalendarEvent } from '../types';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar as CalendarIcon } from 'lucide-react';
import { EventDetailModal } from './EventDetailModal';
import { Checkbox } from './ui/checkbox';
import { Badge } from './ui/badge';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './calendar-overrides.css';

const localizer = momentLocalizer(moment);
const DragAndDropCalendar = withDragAndDrop(Calendar);

interface BigCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CalendarEvent;
}

interface CustomEventProps {
  event: BigCalendarEvent;
}

function CustomEvent({ event }: CustomEventProps) {
  const { updateEvent, projects } = useApp();
  const calendarEvent = event.resource;
  
  const project = calendarEvent.projectId ? projects.find(p => p.id === calendarEvent.projectId) : null;
  
  const handleCompletionToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    updateEvent(calendarEvent.id, { completed: !calendarEvent.completed });
  }, [calendarEvent.id, calendarEvent.completed, updateEvent]);
  
  return (
    <div className="h-full flex items-center justify-between px-2 py-1">
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium truncate ${calendarEvent.completed ? 'line-through opacity-60' : ''}`}>
          {calendarEvent.title}
        </div>
        {project && (
          <div className="text-xs opacity-75 truncate">
            {project.name}
          </div>
        )}
      </div>
      <div 
        className="ml-2 cursor-pointer hover:scale-110 transition-transform"
        onClick={handleCompletionToggle}
      >
        {calendarEvent.completed ? (
          <CheckCircle2 className="w-4 h-4 text-green-300" />
        ) : (
          <Circle className="w-4 h-4 text-white/60 hover:text-white" />
        )}
      </div>
    </div>
  );
}

interface CustomToolbarProps {
  onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void;
  onView: (view: View) => void;
  label: string;
  view: View;
}

function CustomToolbar({ onNavigate, onView, label, view }: CustomToolbarProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('PREV')}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('TODAY')}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('NEXT')}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      
      <h2 className="text-lg font-semibold">{label}</h2>
      
      <div className="flex items-center space-x-2">
        <Button
          variant={view === Views.MONTH ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView(Views.MONTH)}
        >
          Month
        </Button>
        <Button
          variant={view === Views.WEEK ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView(Views.WEEK)}
        >
          Week
        </Button>
        <Button
          variant={view === Views.DAY ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView(Views.DAY)}
        >
          Day
        </Button>
        <Button
          variant={view === Views.AGENDA ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView(Views.AGENDA)}
        >
          Agenda
        </Button>
      </div>
    </div>
  );
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
  
  const [view, setView] = useState<View>(Views.WEEK);
  const [calendarDate, setCalendarDate] = useState(new Date(currentDate));

  // Convert our events to Big Calendar format
  const bigCalendarEvents: BigCalendarEvent[] = useMemo(() => {
    return events.map(event => ({
      id: event.id,
      title: event.title,
      start: new Date(event.startTime),
      end: new Date(event.endTime),
      resource: event
    }));
  }, [events]);

  // Style events based on project colors and completion status
  const eventStyleGetter = useCallback((event: BigCalendarEvent) => {
    const calendarEvent = event.resource;
    const project = calendarEvent.projectId ? projects.find(p => p.id === calendarEvent.projectId) : null;
    const backgroundColor = calendarEvent.color || (project ? project.color : '#6b7280');
    
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: calendarEvent.completed ? 0.6 : 1,
        border: 'none',
        color: 'white',
        fontSize: '12px',
        padding: '2px'
      }
    };
  }, [projects]);

  const handleSelectEvent = useCallback((event: BigCalendarEvent) => {
    setSelectedEventId(event.resource.id);
  }, [setSelectedEventId]);

  const handleSelectSlot = useCallback(({ start, end }: { start: Date; end: Date }) => {
    // Ensure we create the event with the correct dates
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
  }, [setCreatingNewEvent]);

  const handleEventDrop = useCallback(({ event, start, end }: { 
    event: BigCalendarEvent; 
    start: Date; 
    end: Date; 
  }) => {
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    updateEvent(event.id, {
      startTime: start,
      endTime: end,
      duration
    });
  }, [updateEvent]);

  const handleEventResize = useCallback(({ event, start, end }: { 
    event: BigCalendarEvent; 
    start: Date; 
    end: Date; 
  }) => {
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    updateEvent(event.id, {
      startTime: start,
      endTime: end,
      duration
    });
  }, [updateEvent]);

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
  }, [calendarDate, view, setCurrentDate]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
            </div>
            
            {/* Stats */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                {events.filter(e => e.completed).length} / {events.length} completed
              </div>
              <Badge variant="secondary">
                {events.filter(e => !e.completed).length} pending
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 p-6">
        <Card className="h-full">
          <div className="p-6 h-full">
            <DragAndDropCalendar
              localizer={localizer}
              events={bigCalendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              view={view}
              onView={setView}
              date={calendarDate}
              onNavigate={setCalendarDate}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
              selectable
              resizable
              eventPropGetter={eventStyleGetter}
              components={{
                event: CustomEvent,
                toolbar: CustomToolbar
              }}
              formats={{
                timeGutterFormat: 'HH:mm',
                eventTimeRangeFormat: ({ start, end }) => 
                  `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
                agendaTimeFormat: 'HH:mm',
                agendaTimeRangeFormat: ({ start, end }) => 
                  `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`
              }}
              step={30}
              timeslots={2}
              min={moment().hours(6).minutes(0).toDate()}
              max={moment().hours(22).minutes(0).toDate()}
              defaultView={Views.WEEK}
              popup
              popupOffset={30}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}