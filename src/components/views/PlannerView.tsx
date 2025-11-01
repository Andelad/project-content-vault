import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePicker } from '@/components/ui/calendar';
import { PlannerInsightCard, DailyProjectSummaryRow, WeekNavigationBar } from '@/components/planner';
import { getBaseFullCalendarConfig, getEventStylingConfig, getResponsiveDayCount } from '@/services';
// Holidays now sourced from PlannerContext to avoid duplicate fetch/state
import { getDateKey } from '@/utils/dateFormatUtils';
import { transformFullCalendarToCalendarEvent } from '@/services';
import { createPlannerViewOrchestrator, type PlannerInteractionContext } from '@/services/orchestrators/PlannerViewOrchestrator';
import { useToast } from '@/hooks/use-toast';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import '../planner/fullcalendar-overrides.css';
// Modal imports
const EventModal = React.lazy(() => import('../modals/EventModal').then(module => ({ default: module.EventModal })));
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
    isEventsLoading,
    habits,
    isHabitsLoading,
    updateHabit,
    holidays,
    isHolidaysLoading,
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
    setCreatingNewHabit,
    creatingNewHabit,
    layerMode,
    setLayerMode,
    currentView,
    setCurrentView,
    getEventsInDateRange,
    workHours
  } = usePlannerContext();
  const { projects, milestones: projectMilestones } = useProjectContext();
  const { 
    currentDate, 
    setCurrentDate,
    setCurrentView: setTimelineView 
  } = useTimelineContext();
  const { isTimeTracking, currentTrackingEventId, settings, updateSettings } = useSettingsContext();
  const { toast } = useToast();
  const calendarRef = useRef<FullCalendar>(null);
  const calendarCardRef = useRef<HTMLDivElement | null>(null);
  
  // Initialize calendar date - for desktop week view, start on Monday of current week
  const getInitialCalendarDate = () => {
    const date = new Date(currentDate);
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    
    if (isDesktop && currentView === 'week') {
      // Calculate Monday of the current week
      const dayOfWeek = date.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(date);
      monday.setDate(date.getDate() + daysToMonday);
      monday.setHours(0, 0, 0, 0);
      return monday;
    }
    
    return date;
  };
  
  const [calendarDate, setCalendarDate] = useState(getInitialCalendarDate());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDraggingProject, setIsDraggingProject] = useState(false);
  const [calendarReady, setCalendarReady] = useState(false);
  const [summaryDateStrings, setSummaryDateStrings] = useState<string[]>([]);
  const [calendarScrollbarWidth, setCalendarScrollbarWidth] = useState(0);
  const [viewportSize, setViewportSize] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    if (window.innerWidth < 768) return 'mobile';
    if (window.innerWidth < 1024) return 'tablet';
    return 'desktop';
  });
  const [visibleRange, setVisibleRange] = useState<{ start: Date; end: Date }>({
    start: new Date(calendarDate),
    end: new Date(calendarDate)
  });
  const [weekStart, setWeekStart] = useState<Date>(new Date(calendarDate));

  // Create milestones map by project ID (use normalized milestones from ProjectContext)
  const milestonesMap = useMemo(() => {
    const map = new Map<string, any[]>();
    (projectMilestones || []).forEach(milestone => {
      const list = map.get(milestone.projectId) || [];
      list.push(milestone);
      map.set(milestone.projectId, list);
    });
    return map;
  }, [projectMilestones]);

  // Derive summary dates from the latest strings (set by datesSet)
  // Do not compute from fallback values to avoid flash

  // Convert date strings to Date objects (stable based on string keys)
  const summaryDates = useMemo(() => {
    return summaryDateStrings.map(dateStr => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setHours(0, 0, 0, 0);
      return date;
    });
  }, [summaryDateStrings]);

  // Removed summaryDatesKey to avoid unnecessary re-mount triggers

  // Create orchestrator context
  const orchestratorContext: PlannerInteractionContext = useMemo(() => ({
    updateEventWithUndo,
    events,
    isTimeTracking,
    toast
  }), [updateEventWithUndo, events, isTimeTracking, toast]);

  // Create orchestrator instance
  const plannerOrchestrator = useMemo(() => 
    createPlannerViewOrchestrator(orchestratorContext), 
    [orchestratorContext]
  );

  // FullCalendar event handlers
  const handleEventClick = (info: any) => {
    // Don't select work slots - they're not selectable
    if (info.event.extendedProps.isWorkHour) {
      return;
    }
    
    // Handle habit clicks - open event modal (will show correct tab based on category)
    if (info.event.extendedProps.category === 'habit') {
      setSelectedEventId(info.event.id);
      return;
    }
    
    setSelectedEventId(info.event.id);
  };
  const handleEventDrop = useCallback(async (dropInfo: EventDropArg) => {
    const eventId = dropInfo.event.id;
    const extendedProps = dropInfo.event.extendedProps;
    
    // Handle habit drag/drop
    if (extendedProps.category === 'habit') {
      const newStart = dropInfo.event.start;
      const newEnd = dropInfo.event.end;
      
      if (!newStart || !newEnd) {
        dropInfo.revert();
        return;
      }
      
      try {
        await updateHabit(eventId, {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        }, { silent: true });
      } catch (error) {
        console.error('Failed to update habit:', error);
        dropInfo.revert();
      }
      return;
    }
    
    // Handle work hour drag/drop - update settings
    if (extendedProps.isWorkHour) {
      const workHour = extendedProps.originalWorkHour;
      const newStart = dropInfo.event.start;
      const newEnd = dropInfo.event.end;
      
      if (!newStart || !newEnd) {
        dropInfo.revert();
        return;
      }
      
      // Parse the work hour ID to get day and slot info
      // Format: settings-{dayName}-{slotId}
      const match = workHour.id.match(/^settings-(\w+)-([^-]+)$/);
      if (!match || !settings?.weeklyWorkHours) {
        toast({
          title: "Cannot update work slot",
          description: "Work slot configuration error",
          variant: "destructive",
        });
        dropInfo.revert();
        return;
      }
      
      const [, dayName, slotId] = match;
      const weeklyWorkHours = settings.weeklyWorkHours;
      const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];
      
      // Update the slot with new times
      const updatedSlots = daySlots.map(slot => {
        if (slot.id === slotId) {
          const startHours = newStart.getHours().toString().padStart(2, '0');
          const startMins = newStart.getMinutes().toString().padStart(2, '0');
          const endHours = newEnd.getHours().toString().padStart(2, '0');
          const endMins = newEnd.getMinutes().toString().padStart(2, '0');
          
          return {
            ...slot,
            startTime: `${startHours}:${startMins}`,
            endTime: `${endHours}:${endMins}`,
            duration: (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60)
          };
        }
        return slot;
      });
      
      await updateSettings({
        weeklyWorkHours: {
          ...weeklyWorkHours,
          [dayName]: updatedSlots
        }
      });
      
      // Settings updated successfully, useEffect will trigger calendar refetch
      return;
    }
    
    // Handle regular event drop
    const updates = transformFullCalendarToCalendarEvent(dropInfo.event);
    const result = await plannerOrchestrator.handleEventDragDrop(
      eventId,
      updates,
      () => dropInfo.revert()
    );
    
    // No additional handling needed - orchestrator manages everything
  }, [plannerOrchestrator, settings, updateSettings, toast]);
  
  const handleEventResize = useCallback(async (resizeInfo: any) => {
    const eventId = resizeInfo.event.id;
    const extendedProps = resizeInfo.event.extendedProps;
    
    // Handle habit resize
    if (extendedProps.category === 'habit') {
      const newStart = resizeInfo.event.start;
      const newEnd = resizeInfo.event.end;
      
      if (!newStart || !newEnd) {
        resizeInfo.revert();
        return;
      }
      
      try {
        await updateHabit(eventId, {
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString()
        }, { silent: true });
      } catch (error) {
        console.error('Failed to resize habit:', error);
        resizeInfo.revert();
      }
      return;
    }
    
    // Handle work hour resize - update settings
    if (extendedProps.isWorkHour) {
      console.log('📏 Work slot resize detected, updating settings...');
      const workHour = extendedProps.originalWorkHour;
      const newStart = resizeInfo.event.start;
      const newEnd = resizeInfo.event.end;
      
      if (!newStart || !newEnd) {
        resizeInfo.revert();
        return;
      }
      
      // Parse the work hour ID to get day and slot info
      const match = workHour.id.match(/^settings-(\w+)-([^-]+)$/);
      if (!match || !settings?.weeklyWorkHours) {
        toast({
          title: "Cannot update work slot",
          description: "Work slot configuration error",
          variant: "destructive",
        });
        resizeInfo.revert();
        return;
      }
      
      const [, dayName, slotId] = match;
      const weeklyWorkHours = settings.weeklyWorkHours;
      const daySlots = weeklyWorkHours[dayName as keyof typeof weeklyWorkHours] || [];
      
      // Update the slot with new times
      const updatedSlots = daySlots.map(slot => {
        if (slot.id === slotId) {
          const startHours = newStart.getHours().toString().padStart(2, '0');
          const startMins = newStart.getMinutes().toString().padStart(2, '0');
          const endHours = newEnd.getHours().toString().padStart(2, '0');
          const endMins = newEnd.getMinutes().toString().padStart(2, '0');
          
          return {
            ...slot,
            startTime: `${startHours}:${startMins}`,
            endTime: `${endHours}:${endMins}`,
            duration: (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60)
          };
        }
        return slot;
      });
      
      await updateSettings({
        weeklyWorkHours: {
          ...weeklyWorkHours,
          [dayName]: updatedSlots
        }
      });
      
      // Settings updated successfully, useEffect will trigger calendar refetch
      
      toast({
        title: "Work slot updated",
        description: "Your work schedule has been updated",
      });
      return;
    }
    
    // Handle regular event resize
    const updates = transformFullCalendarToCalendarEvent(resizeInfo.event);
    const result = await plannerOrchestrator.handleEventResize(
      eventId,
      updates,
      () => resizeInfo.revert()
    );
    
    // No additional handling needed - orchestrator manages everything
  }, [plannerOrchestrator, settings, updateSettings, toast]);
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    // When in work-hours mode, create a work slot instead of an event
    if (layerMode === 'work-hours') {
      // Open modal to create work slot
      // For now, we'll need to implement a work slot modal
      // This will be handled in the next step
      toast({
        title: "Work Slot Creation",
        description: "Creating work slots from the calendar is coming soon. Please use Settings to manage work slots.",
        duration: 3000,
      });
      selectInfo.view.calendar.unselect();
      return;
    }
    
    // Create new event using global context so the modal opens
    setCreatingNewEvent({
      startTime: selectInfo.start,
      endTime: selectInfo.end
    });
    // Clear the selection
    selectInfo.view.calendar.unselect();
  }, [setCreatingNewEvent, layerMode, toast]);

  // Handle project drag start from summary row
  const handleProjectDragStart = useCallback((projectId: string, date: Date, estimatedHours: number) => {
    setIsDraggingProject(true);
  }, []);

  // Handle project drag end
  const handleProjectDragEnd = useCallback(() => {
    setIsDraggingProject(false);
  }, []);

  // Handle download project summary
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
      
      // When switching to week view on desktop (7 days), ensure we start on Monday
      if (view === 'week' && viewportSize === 'desktop') {
        const currentDate = calendarApi.getDate();
        const dayOfWeek = currentDate.getDay();
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(currentDate);
        monday.setDate(currentDate.getDate() + daysToMonday);
        monday.setHours(0, 0, 0, 0);
        
        // Navigate to Monday if not already there
        if (daysToMonday !== 0) {
          calendarApi.gotoDate(monday);
        }
      }
    }
  }, [setCurrentView, viewportSize]);
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
    
    // Render work hours with italic label
    if (extendedProps.isWorkHour) {
      const workHour = extendedProps.originalWorkHour;
      const start = moment(event.start).format('HH:mm');
      const end = moment(event.end).format('HH:mm');
      
      return {
        html: `
          <div style="height: 100%; display: flex; flex-direction: column; padding: 4px 6px; overflow: hidden;">
            <div style="font-size: 11px; font-style: italic; color: #1976d2; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${workHour.title}
            </div>
            <div style="font-size: 10px; color: #1976d2; opacity: 0.8; margin-top: 2px;">
              ${start} - ${end}
            </div>
          </div>
        `
      };
    }

    // Render habits with croissant icon
    if (extendedProps.category === 'habit') {
      const start = moment(event.start).format('HH:mm');
      const end = moment(event.end).format('HH:mm');
      const isCompleted = extendedProps.completed;
      
      // Croissant SVG icon
      const croissantSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4.6 13.11 5.79-3.21c1.89-1.05 4.79 1.78 3.71 3.71l-3.22 5.81C8.8 23.16.79 15.23 4.6 13.11Z"/><path d="m10.5 9.5-1-2.29C9.2 6.48 8.8 6 8 6H4.5C2.79 6 2 6.5 2 8.5a7.71 7.71 0 0 0 2 4.83"/><path d="M8 6c0-1.55.24-4-2-4-2 0-2.5 2.17-2.5 4"/><path d="m14.5 13.5 2.29 1c.73.3 1.21.7 1.21 1.5v3.5c0 1.71-.5 2.5-2.5 2.5a7.71 7.71 0 0 1-4.83-2"/><path d="M18 16c1.55 0 4-.24 4 2 0 2-2.17 2.5-4 2.5"/></svg>';
      
      // Check icon HTML for completion status
      const checkIconSvg = isCompleted 
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="m9 12 2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><circle cx="12" cy="12" r="10"></circle></svg>';
      
      const iconHtml = `<button type="button" style="cursor: pointer; transition: transform 0.2s; background: none; border: none; color: inherit; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center;" 
                          onmouseover="this.style.transform='scale(1.1)'" 
                          onmouseout="this.style.transform='scale(1)'"
                          onclick="event.stopPropagation(); window.plannerToggleHabitCompletion && window.plannerToggleHabitCompletion('${event.id}')"
                          title="${isCompleted ? 'Mark as not completed' : 'Mark as completed'}">${checkIconSvg}</button>`;
      
      // Calculate height for layout
      const durationInMs = event.end ? event.end.getTime() - event.start.getTime() : 0;
      const durationInMinutes = durationInMs / (1000 * 60);
      const approximateHeight = (durationInMinutes / 15) * 21;
      
      const showTwoLines = approximateHeight >= 32;
      
      return {
        html: `
          <div style="height: 100%; display: flex; flex-direction: column; gap: 2px; padding: 2px; overflow: hidden;">
            ${showTwoLines ? `
            <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0;">
                ${croissantSvg}
                <div style="font-size: 12px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${event.title}</div>
              </div>
              <div style="display: flex; align-items: center; color: inherit; flex-shrink: 0;">
                ${iconHtml}
              </div>
            </div>
            <div style="font-size: 10px; opacity: 0.8; line-height: 1;">${start} - ${end}</div>
            ` : `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              ${croissantSvg}
              <div style="font-size: 12px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${event.title}</div>
              <div style="display: flex; align-items: center; color: inherit; flex-shrink: 0;">
                ${iconHtml}
              </div>
            </div>
            `}
          </div>
        `
      };
    }
    
    // Get project info for regular events
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
    // Check if this is a currently tracking event - must match the specific event ID
    const isCurrentlyTracking = eventType === 'tracked' && isTimeTracking && event.id === currentTrackingEventId;
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
                    onclick="event.stopPropagation(); window.plannerToggleCompletion && window.plannerToggleCompletion('${event.id}')"
                    title="${isCompleted ? 'Mark as not completed' : 'Mark as completed'}">${checkIconSvg}</button>`;
    }
    
    // Calculate approximate event height in pixels
    // FullCalendar with slotDuration: '00:15:00' typically renders at ~21px per 15-min slot
    // This means ~84px per hour
    const durationInMs = event.end ? event.end.getTime() - event.start.getTime() : 0;
    const durationInMinutes = durationInMs / (1000 * 60);
    const approximateHeight = (durationInMinutes / 15) * 21; // 21px per 15-minute slot
    
    // Very tight thresholds - just enough space for each line to render:
    // - 1 line (description only): ~18px (font-size 12px + line-height 1.2 + padding)
    // - 2 lines (time + description): ~32px (two lines + gap + padding)
    // - 3 lines (all): ~45px (three lines + gaps + padding)
    
    const showOneLine = approximateHeight >= 18;
    const showTwoLines = approximateHeight >= 32;
    const showThreeLines = approximateHeight >= 45;
    
    return {
      html: `
        <div style="height: 100%; display: flex; flex-direction: column; gap: 2px; padding: 2px; overflow: hidden;">
          ${showThreeLines ? `
          <!-- Show all 3 lines: time, description, project -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <div style="font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${start} - ${end}</div>
            <div style="display: flex; align-items: center; color: inherit; flex-shrink: 0;">
              ${iconHtml}
            </div>
          </div>
          <div style="font-size: 12px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${description}</div>
          <div style="font-size: 11px; opacity: 0.75; line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${projectLine}</div>
          ` : showTwoLines ? `
          <!-- Show 2 lines: time and description -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <div style="font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${start} - ${end}</div>
            <div style="display: flex; align-items: center; color: inherit; flex-shrink: 0;">
              ${iconHtml}
            </div>
          </div>
          <div style="font-size: 12px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${description}</div>
          ` : showOneLine ? `
          <!-- Show 1 line: description only -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
            <div style="font-size: 12px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${description}</div>
            <div style="display: flex; align-items: center; color: inherit; flex-shrink: 0; margin-left: 4px;">
              ${iconHtml}
            </div>
          </div>
          ` : `
          <!-- Fallback for very small events - just icon -->
          <div style="display: flex; align-items: center; justify-content: flex-end; flex-shrink: 0;">
            <div style="display: flex; align-items: center; color: inherit;">
              ${iconHtml}
            </div>
          </div>
          `}
        </div>
      `
    };
  }, [projects, isTimeTracking, currentTrackingEventId]);
  // Handle completion toggle for events
  const handleCompletionToggle = useCallback(async (eventId: string) => {
    const result = await plannerOrchestrator.handleCompletionToggle(eventId);
    // No additional handling needed - orchestrator manages everything
  }, [plannerOrchestrator]);

  // Handle completion toggle for habits
  const handleHabitCompletionToggle = useCallback(async (habitId: string) => {
    try {
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return;
      
      await updateHabit(habitId, { completed: !habit.completed }, { silent: true });
    } catch (error) {
      console.error('Failed to toggle habit completion:', error);
    }
  }, [habits, updateHabit]);

  // Set up global completion toggle functions for HTML onclick events
  useEffect(() => {
    (window as any).plannerToggleCompletion = handleCompletionToggle;
    (window as any).plannerToggleHabitCompletion = handleHabitCompletionToggle;
    return () => {
      delete (window as any).plannerToggleCompletion;
      delete (window as any).plannerToggleHabitCompletion;
    };
  }, [handleCompletionToggle, handleHabitCompletionToggle]);
  // Prepare FullCalendar configuration
  const calendarConfig = {
    ...getBaseFullCalendarConfig(),
    ...getEventStylingConfig(),
    // Use function for events so refetchEvents() will get fresh data
    events: (fetchInfo: any, successCallback: any, failureCallback: any) => {
      try {
        const events = getStyledFullCalendarEvents({ selectedEventId, projects });
        successCallback(events);
      } catch (error) {
        console.error('Error fetching events:', error);
        failureCallback(error);
      }
    },
    initialView: currentView === 'week' ? 'timeGridWeek' : 'timeGridDay',
    initialDate: calendarDate,
    // Custom event content renderer - also handles CSS property updates
    eventContent: (arg: any) => {
      // Update CSS properties on the container element
      // This runs every time the event is rendered, including when properties change
      const { futureEventBorderColor, selectedEventBorderColor } = arg.event.extendedProps;
      
      // Schedule CSS property update to happen after DOM is ready
      setTimeout(() => {
        // Find the event element - FullCalendar wraps our content
        const eventEl = arg.el?.closest('.fc-event');
        if (eventEl) {
          if (futureEventBorderColor) {
            (eventEl as HTMLElement).style.setProperty('--future-event-border-color', futureEventBorderColor);
          }
          if (selectedEventBorderColor) {
            (eventEl as HTMLElement).style.setProperty('--selected-event-border-color', selectedEventBorderColor);
          }
        }
      }, 0);
      
      // Return custom content
      return renderEventContent(arg);
    },
    // Event handlers
    eventClick: handleEventClick,
    eventDrop: handleEventDrop,
    eventResize: handleEventResize,
    select: handleDateSelect,
    eventDidMount: (info: any) => {
      // Set custom CSS properties for border colors on initial mount
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
      
      // Update visible range for week navigation bar
      setVisibleRange({
        start: new Date(dateInfo.start),
        end: new Date(dateInfo.end)
      });
      
      // Calculate week start (Monday)
      const weekStartDate = new Date(dateInfo.start);
      const day = weekStartDate.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
      weekStartDate.setDate(weekStartDate.getDate() + diff);
      weekStartDate.setHours(0, 0, 0, 0);
      setWeekStart(weekStartDate);
      
      // Compute summary date strings directly from FullCalendar view
      const viewStart = new Date(dateInfo.start);
      const viewEnd = new Date(dateInfo.end);
      viewStart.setHours(0, 0, 0, 0);
      viewEnd.setHours(0, 0, 0, 0);
      
      // Calculate the number of days in the view to determine if it's day or week view
      const daysDiff = Math.round((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
      const isDayView = daysDiff === 1;
      
      const next: string[] = [];
      if (isDayView) {
        next.push(getDateKey(viewStart));
      } else {
        const cur = new Date(viewStart);
        while (cur < viewEnd && next.length < 7) {
          next.push(getDateKey(cur));
          cur.setDate(cur.getDate() + 1);
        }
      }
      setSummaryDateStrings(next);
      setCalendarReady(true);
    }
  };
  
  // Refresh calendar when work hours change to show updated work slots
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.refetchEvents();
    }
  }, [workHours]);
  
  // Removed early calendarReady timeout to avoid pre-ready fallback flashes
  
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

  // Scroll to show current time + 2 hours at the bottom of viewport
  useEffect(() => {
    const scrollToCurrentTime = () => {
      const calendarApi = calendarRef.current?.getApi();
      if (!calendarApi) return;

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Calculate target hour: current time + 2 hours
      let targetHour = currentHour + 2;
      let targetMinute = currentMinute;
      
      // Cap at midnight (00:00)
      if (targetHour >= 24) {
        targetHour = 24;
        targetMinute = 0;
      }
      
      // Get the scroller element
      const scroller = document.querySelector('.fc-scroller.fc-scroller-liquid-absolute');
      if (!scroller) return;
      
      // Get the time grid
      const timeGrid = document.querySelector('.fc-timegrid-body');
      if (!timeGrid) return;
      
      // Calculate scroll position
      // Each hour slot is a portion of the total time grid height
      const totalMinutesInDay = 24 * 60; // 1440 minutes
      const targetMinutes = targetHour * 60 + targetMinute;
      const scrollPercentage = targetMinutes / totalMinutesInDay;
      
      // Get viewport height to position target at bottom
      const viewportHeight = scroller.clientHeight;
      const totalScrollHeight = scroller.scrollHeight;
      
      // Calculate scroll position so target time is at the bottom
      const scrollPosition = (scrollPercentage * totalScrollHeight) - viewportHeight;
      
      // Ensure we don't scroll beyond the top
      const finalScrollPosition = Math.max(0, scrollPosition);
      
      scroller.scrollTop = finalScrollPosition;
    };
    
    // Scroll after a short delay to ensure calendar is fully rendered
    const timeoutId = setTimeout(scrollToCurrentTime, 150);
    
    return () => clearTimeout(timeoutId);
  }, [currentView]); // Re-run when view changes (week/day toggle)

  // Handle swipe navigation on mobile/tablet
  const swipeRef = useSwipeNavigation({
    onSwipeLeft: () => {
      if (viewportSize === 'mobile' || viewportSize === 'tablet') {
        handleNavigate('next');
      }
    },
    onSwipeRight: () => {
      if (viewportSize === 'mobile' || viewportSize === 'tablet') {
        handleNavigate('prev');
      }
    },
    enabled: currentView === 'week' && (viewportSize === 'mobile' || viewportSize === 'tablet')
  });

  // Handle clicking on week navigation bar days
  const handleWeekNavDayClick = useCallback((date: Date) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    
    // Navigate to the clicked date
    api.gotoDate(date);
    setCalendarDate(date);
    setCurrentDate(date);
  }, [setCurrentDate]);

  // Handle drop from project summary row
  useEffect(() => {
    const calendarEl = document.querySelector('.fc-timegrid-body');
    if (!calendarEl) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      
      try {
        const data = JSON.parse(e.dataTransfer!.getData('application/json'));
        if (data.type !== 'project-estimate') return;

        const calendarApi = calendarRef.current?.getApi();
        if (!calendarApi) return;

        // Get the column (day) from the mouse position
        const timeSlotElements = document.querySelectorAll('.fc-timegrid-col');
        let targetDate: Date | null = null;
        
        // Find which column was dropped on
        for (const col of Array.from(timeSlotElements)) {
          const rect = col.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            const dataDate = col.getAttribute('data-date');
            if (dataDate) {
              targetDate = new Date(dataDate);
              
              // Calculate time from Y position within the column
              const relativeY = e.clientY - rect.top;
              const totalHeight = rect.height;
              const fractionOfDay = relativeY / totalHeight;
              
              // Assuming 24-hour day view
              const totalMinutes = 24 * 60;
              const minutesFromMidnight = fractionOfDay * totalMinutes;
              
              // Round to nearest 15 minutes
              const roundedMinutes = Math.round(minutesFromMidnight / 15) * 15;
              const hours = Math.floor(roundedMinutes / 60);
              const minutes = roundedMinutes % 60;
              
              targetDate.setHours(hours, minutes, 0, 0);
              break;
            }
          }
        }

        if (!targetDate) {
          toast({
            title: "Invalid drop location",
            description: "Please drop on the calendar grid",
            variant: "destructive",
            duration: 3000,
          });
          return;
        }

        const startTime = targetDate;

        // Calculate end time based on estimated hours
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + Math.floor(data.estimatedHours));
        endTime.setMinutes(endTime.getMinutes() + Math.round((data.estimatedHours % 1) * 60));

        // Check for overlapping events and compress if needed
        const overlappingEvents = events.filter(event => {
          if (event.projectId !== data.projectId) return false;
          const eventStart = new Date(event.startTime);
          const eventEnd = new Date(event.endTime);
          return (startTime < eventEnd && endTime > eventStart);
        });

        let finalEndTime = endTime;
        if (overlappingEvents.length > 0) {
          // Find the earliest overlapping event
          const earliestOverlap = overlappingEvents.reduce((earliest, event) => {
            const eventStart = new Date(event.startTime);
            return eventStart < earliest ? eventStart : earliest;
          }, new Date(endTime));

          // Compress to fit before the overlap
          if (earliestOverlap > startTime) {
            finalEndTime = earliestOverlap;
          } else {
            // Can't fit, show toast
            toast({
              title: "Cannot create event",
              description: "No space available at this time",
              variant: "destructive",
              duration: 3000,
            });
            return;
          }
        }

        // Create the event - store project ID for modal to use
        (window as any).__pendingEventProjectId = data.projectId;
        setCreatingNewEvent({
          startTime,
          endTime: finalEndTime
        });

      } catch (error) {
        console.error('Error handling drop:', error);
      }
    };

    calendarEl.addEventListener('dragover', handleDragOver as EventListener);
    calendarEl.addEventListener('drop', handleDrop as EventListener);

    return () => {
      calendarEl.removeEventListener('dragover', handleDragOver as EventListener);
      calendarEl.removeEventListener('drop', handleDrop as EventListener);
    };
  }, [events, toast, setCreatingNewEvent]);

  // Keep FullCalendar sized to its container (e.g., on sidebar toggle)
  useEffect(() => {
    const el = calendarCardRef.current;
    if (!el) return;
    let lastWidth = el.getBoundingClientRect().width;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (Math.round(cr.width) !== Math.round(lastWidth)) {
          lastWidth = cr.width;
          // Update FullCalendar layout when container width changes
          const api = calendarRef.current?.getApi();
          if (api) {
            api.updateSize();
          }
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Handle window resize for responsive view changes - force remount on viewport size change
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let newSize: 'mobile' | 'tablet' | 'desktop';
      
      if (width < 768) {
        newSize = 'mobile';
      } else if (width < 1024) {
        newSize = 'tablet';
      } else {
        newSize = 'desktop';
      }
      
      // Only update if viewport category changed (forces calendar remount)
      if (newSize !== viewportSize) {
        setViewportSize(newSize);
        
        // When switching to desktop (7-day view) in week mode, ensure we're starting from Monday
        if (newSize === 'desktop' && currentView === 'week') {
          const calendarApi = calendarRef.current?.getApi();
          if (calendarApi) {
            // Get current date
            const currentDate = calendarApi.getDate();
            // Calculate Monday of the week
            const dayOfWeek = currentDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(currentDate);
            monday.setDate(currentDate.getDate() + daysToMonday);
            monday.setHours(0, 0, 0, 0);
            
            // Navigate to Monday to ensure week starts correctly
            setTimeout(() => {
              calendarApi.gotoDate(monday);
            }, 100);
          }
        }
      }
    };

    // Debounce resize handler
    let resizeTimeout: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(resizeTimeout);
    };
  }, [viewportSize, currentView]);

  // Track the vertical scrollbar width of the FullCalendar scroller to align the summary row
  useEffect(() => {
    if (!calendarReady) return;
    const selectScroller = () =>
      document.querySelector('.fc-scroller.fc-scroller-liquid-absolute') ||
      document.querySelector('.fc-scroller');
    const scroller = selectScroller() as HTMLElement | null;
    if (!scroller) return;
    const measure = () => {
      const sw = Math.max(0, scroller.offsetWidth - scroller.clientWidth);
      const rounded = Math.round(sw);
      if (!Number.isNaN(rounded) && rounded !== calendarScrollbarWidth) {
        setCalendarScrollbarWidth(rounded);
        // Trigger a calendar re-measure so shrink column updates in layout
        const api = calendarRef.current?.getApi();
        if (api) api.updateSize();
      }
    };
    // Initial measure after a frame
    const rid = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    // Also listen to window resize as a fallback
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(rid);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [calendarReady, calendarScrollbarWidth]);

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
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

      {/* Week Navigation Bar - Mobile/Tablet Only */}
      <WeekNavigationBar
        visibleStartDate={visibleRange.start}
        visibleEndDate={visibleRange.end}
        weekStartDate={weekStart}
        visibleDayCount={getResponsiveDayCount()}
        onDayClick={handleWeekNavDayClick}
        show={currentView === 'week' && (viewportSize === 'mobile' || viewportSize === 'tablet')}
      />

      {/* Daily Project Summary Row */}
      {calendarReady && summaryDateStrings.length > 0 && !isEventsLoading && !isHolidaysLoading && (
        <div className="px-6 pb-[21px]">
          <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <DailyProjectSummaryRow
              dates={summaryDates}
              projects={projects}
              milestonesMap={milestonesMap}
              events={events}
              settings={settings}
              holidays={holidays}
              viewMode={currentView}
              onDragStart={handleProjectDragStart}
              onDragEnd={handleProjectDragEnd}
              scrollbarWidth={calendarScrollbarWidth}
            />
          </div>
        </div>
      )}

      {/* Calendar Content */}
      <div className="flex-1 px-6 pb-[21px] min-h-0">
        <div
          ref={(el) => {
            calendarCardRef.current = el;
            (swipeRef as any).current = el;
          }}
          className="planner-calendar-card h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
          style={{ ['--planner-scrollbar-width' as any]: `${calendarScrollbarWidth}px` }}
        >
          <FullCalendar
            key={`${currentView}-${viewportSize}`}
            ref={calendarRef}
            {...calendarConfig}
            height="100%"
          />
        </div>
      </div>
      {/* Calendar Insight Card */}
      <div className="px-6 pb-[21px]">
        <PlannerInsightCard 
          key={currentView}
          dates={(() => {
            if (currentView === 'day') {
              return [calendarDate];
            } else {
              // Get the week containing calendarDate
              const startOfWeek = new Date(calendarDate);
              startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
              const dates = [];
              for (let i = 0; i < 7; i++) {
                const date = new Date(startOfWeek.getTime());
                date.setDate(date.getDate() + i);
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
      <React.Suspense fallback={<div>Loading...</div>}>
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
      </React.Suspense>
    </div>
  );
}
