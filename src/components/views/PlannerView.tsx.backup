import React, { useState, useCallback, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import { Calendar, EventClickArg, EventDropArg, DateSelectArg } from '@fullcalendar/core';
import moment from 'moment';
import { usePlannerContext } from '@/contexts/PlannerContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { formatDateLong, formatDateRange as formatDateRangeUtil } from '@/utils/dateFormatUtils';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch, CheckCircle2, Circle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import { TimeTracker } from '@/components/work-hours/TimeTracker';
import { PlannerInsightCard } from '@/components/planner';
import { getBaseFullCalendarConfig, getEventStylingConfig } from '@/services';
import { transformFullCalendarToCalendarEvent } from '@/services';
import { useToast } from '@/hooks/use-toast';
import '../planner/fullcalendar-overrides.css';

// Modal imports
import { EventModal } from '../modals/EventModal';
import { WorkSlotModal } from '../modals/WorkSlotModal';

/**
 * PlannerView - FullCalendar-based planner with keyboard shortcuts
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
export function PlannerView() {
  const { 
    events,
    fullCalendarEvents,
    getStyledFullCalendarEvents,
    selectedEventId,
    setSelectedEventId,
    updateEventWithUndo,
    deleteEventWithUndo,
    undoLastAction,
    lastAction,
    setCreatingNewEvent,
    creatingNewEvent,
    layerMode,
    setLayerMode,
    currentView,
    setCurrentView,
    getEventsInDateRange
  } = usePlannerContext();
  
  const { projects } = useProjectContext();
  const { 
    currentDate, 
    setCurrentDate,
    setCurrentView: setTimelineView 
  } = useTimelineContext();
  const { isTimeTracking } = useSettingsContext();
  const { toast } = useToast();
  
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarDate, setCalendarDate] = useState(new Date(currentDate));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // FullCalendar event handlers
    const handleEventClick = (info: any) => {
    setSelectedEventId(info.event.id);
  };

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
  }, [updateEventWithUndo, toast]);

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
  }, [updateEventWithUndo, toast]);

  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    // Create new event using global context so the modal opens
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
      return formatDateLong(start);
    } else {
      // Calculate the actual end date (FullCalendar's end is exclusive)
      const endDate = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return formatDateRangeUtil(start, endDate);
    }
  }, [currentView]);  // Keyboard shortcuts
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

  // Custom event content renderer
  const renderEventContent = useCallback((eventInfo: any) => {
    const event = eventInfo.event;
    const extendedProps = event.extendedProps;
    
    // Skip custom rendering for work hours - let them use default display
    if (extendedProps.isWorkHour) {
      return { html: '' }; // Use default FullCalendar rendering
    }
    
    // Get project info
    const projectId = extendedProps.projectId;
    const project = projectId ? projects.find(p => p.id === projectId) : null;
    
    // Format time
    const start = moment(event.start).format('HH:mm');
    const end = moment(event.end).format('HH:mm');
    
    // Get event description or title
    const eventType = extendedProps.type;
    const description = (eventType === 'tracked' || eventType === 'completed') 
      ? 'Tracked Time' 
      : (extendedProps.description || event.title);
    
    // Create project/client line
    const projectLine = project 
      ? `${project.name}${project.client ? ` • ${project.client}` : ''}`
      : 'No Project';
    
    // Check if this is a currently tracking event
    const isCurrentlyTracking = eventType === 'tracked' && isTimeTracking;
    const isCompleted = extendedProps.completed;
    
    // Create the icon HTML
    let iconHtml = '';
    if (isCurrentlyTracking) {
      iconHtml = '<div style="width: 8px; height: 8px; border-radius: 50%; background-color: #ef4444; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;" title="Currently recording"></div>';
    } else {
      // Use check icons for completion status - improved centering
      const checkIconSvg = isCompleted 
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="m9 12 2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"></circle></svg>';
      
      iconHtml = `<button type="button" style="cursor: pointer; transition: transform 0.2s; background: none; border: none; color: inherit; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center;" 
                    onmouseover="this.style.transform='scale(1.1)'" 
                    onmouseout="this.style.transform='scale(1)'"
                    onclick="window.plannerToggleCompletion && window.plannerToggleCompletion('${event.id}')"
                    title="${isCompleted ? 'Mark as not completed' : 'Mark as completed'}">${checkIconSvg}</button>`;
    }
    
    return {
      html: `
        <div style="height: 100%; display: flex; flex-direction: column; gap: 2px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="font-size: 11px; font-weight: 500; line-height: 1;">${start} - ${end}</div>
            <div style="display: flex; align-items: center; color: inherit;">
              ${iconHtml}
            </div>
          </div>
          <div style="font-size: 12px; font-weight: 600; line-height: 1.2; word-wrap: break-word;">${description}</div>
          <div style="font-size: 11px; opacity: 0.75; line-height: 1; word-wrap: break-word;">${projectLine}</div>
        </div>
      `
    };
  }, [projects, isTimeTracking]);

  // Handle completion toggle for events
  const handleCompletionToggle = useCallback(async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    // Don't allow toggling completion for currently tracking events
    if (event.type === 'tracked' && isTimeTracking) {
      return;
    }
    
    try {
      await updateEventWithUndo(eventId, { completed: !event.completed });
    } catch (error) {
      console.error('Failed to toggle completion:', error);
      toast({
        title: "Failed to update event",
        description: "Please try again",
        variant: "destructive",
      });
    }
  }, [events, isTimeTracking, updateEventWithUndo, toast]);

  // Set up global completion toggle function for HTML onclick events
  useEffect(() => {
    (window as any).plannerToggleCompletion = handleCompletionToggle;
    
    return () => {
      delete (window as any).plannerToggleCompletion;
    };
  }, [handleCompletionToggle]);

  // Prepare FullCalendar configuration
  const calendarConfig = {
    ...getBaseFullCalendarConfig(),
    ...getEventStylingConfig(),
    events: getStyledFullCalendarEvents({ selectedEventId, projects }),
    initialView: currentView === 'week' ? 'timeGridWeek' : 'timeGridDay',
    initialDate: calendarDate,
    
    // Custom event content renderer
    eventContent: renderEventContent,
    
    // Event handlers
    eventClick: handleEventClick,
    eventDrop: handleEventDrop,
    eventResize: handleEventResize,
    select: handleDateSelect,
    eventDidMount: (info: any) => {
      // Set custom CSS properties for border colors
      const { futureEventBorderColor, selectedEventBorderColor } = info.event.extendedProps;
      if (futureEventBorderColor) {
        info.el.style.setProperty('--future-event-border-color', futureEventBorderColor);
      }
      if (selectedEventBorderColor) {
        info.el.style.setProperty('--selected-event-border-color', selectedEventBorderColor);
      }
    },
    
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

  // Add hoverable functionality to date headers after calendar renders
  useEffect(() => {
    const addHoverableHeaders = () => {
      const calendar = calendarRef.current?.getApi();
      if (!calendar) return;

      // Find all column header cells
      const headerCells = document.querySelectorAll('.fc-col-header-cell');
      
      headerCells.forEach((cell) => {
        // Skip if already processed
        if (cell.hasAttribute('data-hoverable-processed')) return;
        
        // Mark as processed
        cell.setAttribute('data-hoverable-processed', 'true');
        
        // Get the date for this cell
        const dateAttr = cell.getAttribute('data-date');
        if (!dateAttr) return;
        
        const cellDate = new Date(dateAttr);
        
        // Add hover and click functionality
        let isHovered = false;
        let hoverOverlay: HTMLElement | null = null;
        let tooltip: HTMLElement | null = null;
        let hoverTimeout: NodeJS.Timeout | null = null;
        
        const handleMouseEnter = () => {
          if (isHovered) return;
          isHovered = true;
          
          // Add 300ms delay to match React tooltip
          hoverTimeout = setTimeout(() => {
            if (!isHovered) return; // Check if still hovered after delay
            
            // Create and append hover overlay
            hoverOverlay = document.createElement('div');
            hoverOverlay.className = 'absolute inset-0 flex items-center justify-center pointer-events-none z-50';
            hoverOverlay.innerHTML = `
              <div class="bg-white bg-opacity-90 rounded-full p-1 shadow-sm border">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="21" y1="6" x2="3" y2="6"></line>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                  <line x1="17" y1="18" x2="3" y2="18"></line>
                </svg>
              </div>
            `;
            
            // Create tooltip that matches React component styling
            tooltip = document.createElement('div');
            
            // Get cell position relative to viewport for fixed positioning
            const cellRect = cell.getBoundingClientRect();
            
            tooltip.style.cssText = `
              position: fixed;
              top: ${cellRect.top - 40}px;
              left: ${cellRect.left + cellRect.width / 2}px;
              transform: translateX(-50%) scale(0.95);
              background: #ffffff;
              color: #1f2937;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 6px 12px;
              font-size: 14px;
              white-space: nowrap;
              pointer-events: none;
              z-index: 99999;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
              opacity: 0;
              transition: opacity 150ms ease-in-out, transform 150ms ease-in-out;
            `;
            tooltip.innerHTML = 'Go to Timeline';
            
            // Make cell content semi-transparent
            const cellContent = cell.querySelector('.fc-col-header-cell-cushion');
            if (cellContent) {
              (cellContent as HTMLElement).style.opacity = '0.3';
            }
            
            // Make cell position relative for overlay positioning
            (cell as HTMLElement).style.position = 'relative';
            (cell as HTMLElement).style.cursor = 'pointer';
            
            cell.appendChild(hoverOverlay);
            // Append tooltip to document body instead of cell to avoid clipping
            document.body.appendChild(tooltip);
            
            // Trigger animation after a frame to ensure DOM is updated
            requestAnimationFrame(() => {
              if (tooltip) {
                tooltip.style.opacity = '1';
                tooltip.style.transform = 'translateX(-50%) scale(1)';
              }
            });
          }, 300);
        };
        
        const handleMouseLeave = () => {
          if (!isHovered) return;
          isHovered = false;
          
          // Clear timeout if still pending
          if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
          }
          
          // Remove hover overlay
          if (hoverOverlay) {
            hoverOverlay.remove();
            hoverOverlay = null;
          }
          
          // Remove tooltip with fade out animation
          if (tooltip) {
            tooltip.style.opacity = '0';
            tooltip.style.transform = 'translateX(-50%) scale(0.95)';
            // Remove from DOM after animation
            setTimeout(() => {
              if (tooltip) {
                tooltip.remove();
                tooltip = null;
              }
            }, 150);
          }
          
          // Restore cell content opacity
          const cellContent = cell.querySelector('.fc-col-header-cell-cushion');
          if (cellContent) {
            (cellContent as HTMLElement).style.opacity = '1';
          }
        };
        
        const handleClick = () => {
          // Navigate to timeline at the specified date
          setCurrentDate(new Date(cellDate));
          setTimelineView('timeline');
        };
        
        // Add event listeners
        cell.addEventListener('mouseenter', handleMouseEnter);
        cell.addEventListener('mouseleave', handleMouseLeave);
        cell.addEventListener('click', handleClick);
      });
    };

    // Add headers after a short delay to ensure calendar is rendered
    const timeoutId = setTimeout(addHoverableHeaders, 100);
    
    return () => {
      clearTimeout(timeoutId);
      // Clean up any processed headers
      const headerCells = document.querySelectorAll('.fc-col-header-cell[data-hoverable-processed]');
      headerCells.forEach((cell) => {
        cell.removeAttribute('data-hoverable-processed');
        (cell as HTMLElement).style.position = '';
        (cell as HTMLElement).style.cursor = '';
        
        const cellContent = cell.querySelector('.fc-col-header-cell-cushion');
        if (cellContent) {
          (cellContent as HTMLElement).style.opacity = '';
        }
      });
    };
  }, [calendarDate, currentView, setCurrentDate, setTimelineView]);

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="h-20 border-b border-[#e2e2e2] flex items-center justify-between px-8">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold text-[#595956]">Planner</h1>
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
      
      {/* Modals */}
      <EventModal
        isOpen={!!creatingNewEvent}
        onClose={() => setCreatingNewEvent(null)}
        defaultStartTime={creatingNewEvent?.startTime}
        defaultEndTime={creatingNewEvent?.endTime}
      />
      
      {/* Event Edit Modal */}
      <EventModal
        isOpen={!!selectedEventId}
        onClose={() => setSelectedEventId(null)}
        eventId={selectedEventId || undefined}
      />
    </div>
  );
}
