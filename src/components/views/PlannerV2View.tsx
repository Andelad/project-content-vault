import React, { useState, useCallback, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import { Calendar, EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import { usePlannerV2Context } from '@/contexts/PlannerV2Context';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import { TimeTracker } from '@/components/work-hours/TimeTracker';
import { PlannerInsightCard } from '@/components/planner/PlannerInsightCard';
import { getBaseFullCalendarConfig, getEventStylingConfig } from '@/services/plannerV2/fullCalendarConfigService';
import { transformFullCalendarToCalendarEvent } from '@/services/plannerV2/eventTransformService';
import { useToast } from '@/hooks/use-toast';
import './PlannerV2.css';

/**
 * PlannerV2View - FullCalendar-based planner with keyboard shortcuts
 * 
 * Keyboard Shortcuts:
 * - Cmd/Ctrl + Z: Undo last action
 * - Escape: Clear selection
 * - Arrow Left/Right: Navigate prev/next period
 * - Arrow Up/Down: Switch between Week/Day views
 * - T: Go to Today
 * - W: Toggle layer mode (Events → Work Hours → Both)
 * - Delete/Backspace: Delete selected event
 */
export function PlannerV2View() {
  const { 
    events,
    fullCalendarEvents,
    selectedEventId,
    setSelectedEventId,
    updateEventWithUndo,
    deleteEventWithUndo,
    undoLastAction,
    lastAction,
    setCreatingNewEvent,
    layerMode,
    setLayerMode,
    currentView,
    setCurrentView,
    getEventsInDateRange
  } = usePlannerV2Context();
  
  const { projects } = useProjectContext();
  const { currentDate, setCurrentDate } = useTimelineContext();
  const { toast } = useToast();
  
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarDate, setCalendarDate] = useState(new Date(currentDate));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // FullCalendar event handlers
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const eventId = clickInfo.event.id;
    if (eventId.startsWith('work-')) {
      // Handle work hour selection
      console.log('Work hour clicked:', eventId);
    } else {
      // Handle calendar event selection
      setSelectedEventId(eventId);
    }
  }, [setSelectedEventId]);

  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    const eventId = dropInfo.event.id;
    
    if (eventId.startsWith('work-')) {
      // Handle work hour drag - we'll implement this later
      console.log('Work hour dropped:', dropInfo);
      return;
    }

    // Handle calendar event drag
    const updates = transformFullCalendarToCalendarEvent(dropInfo.event);
    
    try {
      await updateEventWithUndo(eventId, updates);
      toast({
        title: "Event updated",
        description: "Press Cmd+Z to undo",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to update event:', error);
      // Revert the change
      dropInfo.revert();
      toast({
        title: "Failed to update event",
        description: "Please try again",
        variant: "destructive",
      });
    }
  }, [updateEventWithUndo]);

  const handleEventResize = useCallback(async (resizeInfo: any) => {
    const eventId = resizeInfo.event.id;
    
    if (eventId.startsWith('work-')) {
      // Handle work hour resize - we'll implement this later
      console.log('Work hour resized:', resizeInfo);
      return;
    }

    // Handle calendar event resize
    const updates = transformFullCalendarToCalendarEvent(resizeInfo.event);
    
    try {
      await updateEventWithUndo(eventId, updates);
      toast({
        title: "Event resized",
        description: "Press Cmd+Z to undo",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to update event:', error);
      // Revert the change
      resizeInfo.revert();
      toast({
        title: "Failed to resize event",
        description: "Please try again",
        variant: "destructive",
      });
    }
  }, [updateEventWithUndo]);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    // Create new event
    setCreatingNewEvent({
      startTime: selectInfo.start,
      endTime: selectInfo.end
    });
    
    // Clear the selection
    selectInfo.view.calendar.unselect();
  }, [setCreatingNewEvent]);

  // Navigation handlers
  const handleNavigate = useCallback((direction: 'prev' | 'next' | 'today') => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return;

    switch (direction) {
      case 'prev':
        calendarApi.prev();
        break;
      case 'next':
        calendarApi.next();
        break;
      case 'today':
        calendarApi.today();
        break;
    }
    
    // Update our state with the new date
    const newDate = calendarApi.getDate();
    setCalendarDate(newDate);
    setCurrentDate(newDate);
  }, [setCurrentDate]);

  const handleDatePickerSelect = useCallback((selectedDate: Date | undefined) => {
    if (!selectedDate) return;
    
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.gotoDate(selectedDate);
      setCalendarDate(selectedDate);
      setCurrentDate(selectedDate);
    }
    
    setIsDatePickerOpen(false);
  }, [setCurrentDate]);

  const handleViewChange = useCallback((view: 'week' | 'day') => {
    setCurrentView(view);
    
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(view === 'week' ? 'timeGridWeek' : 'timeGridDay');
    }
  }, [setCurrentView]);

  // Format date range for display
  const formatDateRange = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (!calendarApi) return '';

    const view = calendarApi.view;
    const start = view.activeStart;
    const end = view.activeEnd;

    if (currentView === 'day') {
      return start.toLocaleDateString('en-GB', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } else {
      const startDate = start.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
      const endDate = new Date(end.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
      return `${startDate} - ${endDate}`;
    }
  }, [currentView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || 
          e.target instanceof HTMLTextAreaElement || 
          (e.target as HTMLElement).contentEditable === 'true') {
        return;
      }

      // Handle modifier key combinations
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (lastAction) {
              undoLastAction();
              toast({
                title: "Action undone",
                description: "Last change has been reverted",
                duration: 2000,
              });
            }
            break;
        }
        return;
      }

      // Handle regular keys
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          setSelectedEventId(null);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handleNavigate('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNavigate('next');
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (currentView === 'day') {
            handleViewChange('week');
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (currentView === 'week') {
            handleViewChange('day');
          }
          break;
        case 't':
        case 'T':
          e.preventDefault();
          handleNavigate('today');
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          if (layerMode === 'events') {
            setLayerMode('work-hours');
          } else if (layerMode === 'work-hours') {
            setLayerMode('both');
          } else {
            setLayerMode('events');
          }
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          e.stopPropagation();
          if (selectedEventId && !selectedEventId.startsWith('work-')) {
            deleteEventWithUndo(selectedEventId);
            setSelectedEventId(null);
            toast({
              title: "Event deleted",
              description: "Press Cmd+Z to undo",
              duration: 3000,
            });
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    lastAction, 
    undoLastAction, 
    toast,
    setSelectedEventId, 
    selectedEventId, 
    deleteEventWithUndo,
    handleNavigate, 
    handleViewChange, 
    currentView, 
    layerMode, 
    setLayerMode
  ]);

  // Prepare FullCalendar configuration
  const calendarConfig = {
    ...getBaseFullCalendarConfig(),
    ...getEventStylingConfig(),
    events: fullCalendarEvents,
    initialView: currentView === 'week' ? 'timeGridWeek' : 'timeGridDay',
    initialDate: calendarDate,
    
    // Event handlers
    eventClick: handleEventClick,
    eventDrop: handleEventDrop,
    eventResize: handleEventResize,
    select: handleDateSelect,
    
    // Ensure events are resizable
    editable: true,
    eventResizableFromStart: true,
    eventDurationEditable: true,
    eventStartEditable: true,
    
    // View change handler
    datesSet: (dateInfo) => {
      setCalendarDate(dateInfo.start);
      setCurrentDate(dateInfo.start);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-[#595956]">Planner V2</h1>
          {lastAction && (
            <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              <span>Press Cmd+Z to undo</span>
            </div>
          )}
        </div>
        
        {/* Time Tracker in top right */}
        <TimeTracker />
      </div>

      {/* Calendar Controls */}
      <div className="px-6 p-[21px]">
        <div className="flex items-center justify-between">
          {/* Left side controls */}
          <div className="flex items-center" style={{ gap: '21px' }}>
            <ToggleGroup
              type="single"
              value={currentView}
              onValueChange={(value) => {
                if (value) {
                  handleViewChange(value as 'week' | 'day');
                }
              }}
              variant="outline"
              className="border border-gray-200 rounded-lg h-9 p-1"
            >
              <ToggleGroupItem value="week" aria-label="Week mode" className="px-3 py-1 h-7">
                Week
              </ToggleGroupItem>
              <ToggleGroupItem value="day" aria-label="Day mode" className="px-3 py-1 h-7">
                Day
              </ToggleGroupItem>
            </ToggleGroup>
            
            <ToggleGroup
              type="single"
              value={layerMode}
              onValueChange={(value) => {
                if (value) {
                  setLayerMode(value as 'events' | 'work-hours' | 'both');
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
              <ToggleGroupItem value="both" aria-label="Both mode" className="px-3 py-1 h-7">
                Both
              </ToggleGroupItem>
            </ToggleGroup>
            
            <Button variant="outline" onClick={() => handleNavigate('today')} className="h-9 gap-2">
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
                  onSelect={handleDatePickerSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Right side navigation */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => handleNavigate('prev')}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <h2 className="text-sm font-semibold text-gray-900 text-center px-2">
              {formatDateRange()}
            </h2>
            
            <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => handleNavigate('next')}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="flex-1 px-6 pb-6 min-h-0">
        <div className="h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <FullCalendar
            ref={calendarRef}
            {...calendarConfig}
            height="100%"
          />
        </div>
      </div>

      {/* Calendar Insight Card */}
      <div className="px-6 pb-6">
        <PlannerInsightCard 
          dates={(() => {
            if (currentView === 'day') {
              return [calendarDate];
            } else {
              // Get the week containing calendarDate
              const startOfWeek = new Date(calendarDate);
              startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
              const dates = [];
              for (let i = 0; i < 7; i++) {
                const date = new Date(startOfWeek);
                date.setDate(startOfWeek.getDate() + i);
                dates.push(date);
              }
              return dates;
            }
          })()}
          events={events}
          view={currentView === 'day' ? 'day' : 'week'}
        />
      </div>
    </div>
  );
}
