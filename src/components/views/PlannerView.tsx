import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import { Calendar, EventClickArg, EventDropArg, DateSelectArg, EventContentArg, EventMountArg, EventSourceFunc, EventInput } from '@fullcalendar/core';
import { EventResizeDoneArg } from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import { usePlannerContext } from '@/contexts/PlannerContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { formatDateLong, formatDateRange as formatDateRangeUtil } from '@/utils/dateFormatUtils';
import { 
  addDaysToDate, 
  normalizeToMidnight,
  formatTimeForValidation,
  getBaseFullCalendarConfig, 
  getEventStylingConfig,
  transformFullCalendarToCalendarEvent,
  UnifiedWorkHoursService,
  UnifiedCalendarService,
  ErrorHandlingService,
  type LayerVisibility
} from '@/services';
import { 
  EstimatedTimeCard, 
  WeekNavigationBar, 
  PlannerToolbar,
  WorkHourEventContent,
  HabitEventContent,
  TaskEventContent,
  RegularEventContent
} from '@/components/features/planner';
import { AvailabilityCard } from '@/components/shared';
import { HABIT_ICON_SVG } from '@/constants/icons';
import { NEUTRAL_COLORS } from '@/constants/colors';
import { getDateKey } from '@/utils/dateFormatUtils';
import { createPlannerViewOrchestrator, type PlannerInteractionContext } from '@/services/orchestrators/PlannerViewOrchestrator';
import { useToast } from '@/hooks/use-toast';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useCalendarKeyboardShortcuts } from '@/hooks/useCalendarKeyboardShortcuts';
import { useCalendarDragDrop } from '@/hooks/useCalendarDragDrop';
import { useHoverableDateHeaders } from '@/hooks/useHoverableDateHeaders';
import '@/components/features/planner/fullcalendar-overrides.css';
// Modal imports
const EventModal = React.lazy(() => import('../modals/EventModal').then(module => ({ default: module.EventModal })));
const HelpModal = React.lazy(() => import('../modals/HelpModal').then(module => ({ default: module.HelpModal })));
import { WorkHourScopeDialog } from '@/components/modals';
import type { PhaseDTO } from '@/types/core';
/**
 * PlannerView - FullCalendar-based planner with keyboard shortcuts
 * 
 * Keyboard Shortcuts:
 * - Cmd/Ctrl + Z: Undo last action
 * - Escape: Clear selection
 * - Arrow Left/Right: Navigate prev/next period
 * - Arrow Up/Down: Switch between Week/Day views
 * - T: Go to Today
 * - L: Toggle layers visibility menu
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
    workHours,
    updateWorkHour,
    deleteWorkHour,
    showWorkHourScopeDialog,
    pendingWorkHourChange,
    confirmWorkHourChange,
    cancelWorkHourChange
  } = usePlannerContext();
  const { projects, phases: projectPhases } = useProjectContext();
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
      const monday = normalizeToMidnight(addDaysToDate(date, daysToMonday));
      return monday;
    }
    return date;
  };
  const [calendarDate, setCalendarDate] = useState(getInitialCalendarDate());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isLayersPopoverOpen, setIsLayersPopoverOpen] = useState(false);
  const [isDraggingProject, setIsDraggingProject] = useState(false);
  const [calendarReady, setCalendarReady] = useState(false);
  const [summaryDateStrings, setSummaryDateStrings] = useState<string[]>([]);
  const [calendarScrollbarWidth, setCalendarScrollbarWidth] = useState(0);
  const [timeAxisWidth, setTimeAxisWidth] = useState(0);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  // Layer visibility state
  const [layerVisibility, setLayerVisibility] = useState({
    events: true,
    habits: true,
    tasks: true,
    workHours: true
  });
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
  const phasesMap = useMemo(() => {
    const map = new Map<string, PhaseDTO[]>();
    (projectPhases || []).forEach(phase => {
      const list = map.get(phase.projectId) || [];
      list.push(phase);
      map.set(phase.projectId, list);
    });
    return map;
  }, [projectPhases]);
  // Derive summary dates from the latest strings (set by datesSet)
  // Do not compute from fallback values to avoid flash
  // Convert date strings to Date objects (stable based on string keys)
  const summaryDates = useMemo(() => {
    return summaryDateStrings.map(dateStr => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return normalizeToMidnight(date);
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
  const handleEventClick = (info: EventClickArg) => {
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
        ErrorHandlingService.handle(error, { source: 'PlannerView', action: 'Failed to update habit:' });
        dropInfo.revert();
      }
      return;
    }
    // Handle work hour drag/drop - trigger scope dialog
    if (extendedProps.isWorkHour) {
      const workHour = extendedProps.originalWorkHour;
      const newStart = dropInfo.event.start;
      const newEnd = dropInfo.event.end;
      if (!newStart || !newEnd) {
        dropInfo.revert();
        return;
      }
      
      // Trigger the scope dialog from useWorkHours hook
      await updateWorkHour(workHour.id, {
        startTime: newStart,
        endTime: newEnd
      });
      
      // If there was an error or the dialog is showing, revert might happen automatically
      // The hook will handle showing the scope dialog
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
  }, [plannerOrchestrator, updateHabit, updateWorkHour]);
  const handleEventResize = useCallback(async (resizeInfo: EventResizeDoneArg) => {
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
        ErrorHandlingService.handle(error, { source: 'PlannerView', action: 'Failed to resize habit:' });
        resizeInfo.revert();
      }
      return;
    }
    // Handle work hour resize - trigger scope dialog
    if (extendedProps.isWorkHour) {
      const workHour = extendedProps.originalWorkHour;
      const newStart = resizeInfo.event.start;
      const newEnd = resizeInfo.event.end;
      if (!newStart || !newEnd) {
        resizeInfo.revert();
        return;
      }
      
      // Trigger the scope dialog from useWorkHours hook
      await updateWorkHour(workHour.id, {
        startTime: newStart,
        endTime: newEnd
      });
      
      // The hook will handle showing the scope dialog
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
  }, [plannerOrchestrator, updateHabit, updateWorkHour]);
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    // Create new event using global context so the modal opens
    setCreatingNewEvent({
      startTime: selectInfo.start,
      endTime: selectInfo.end
    });
    // Clear the selection
    selectInfo.view.calendar.unselect();
  }, [setCreatingNewEvent]);
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
        const monday = normalizeToMidnight(addDaysToDate(currentDate, daysToMonday));
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
      const endDate = addDaysToDate(end, -1);
      return formatDateRangeUtil(start, endDate);
    }
  }, [currentView]);

  // Keyboard shortcuts
  useCalendarKeyboardShortcuts({
    setSelectedEventId,
    setIsLayersPopoverOpen,
    selectedEventId,
    currentView,
    lastAction,
    undoLastAction,
    deleteEventWithUndo,
    handleNavigate,
    handleViewChange,
  });

  // Custom event content renderer
  const renderEventContent = useCallback((eventInfo: EventContentArg) => {
    const event = eventInfo.event;
    const extendedProps = event.extendedProps;
    
    // Debug ALL events being rendered
    console.log('🎨 Rendering event:', event.title, {
      id: event.id,
      start: event.start,
      end: event.end,
      hasRRule: !!extendedProps.rrule,
      rrule: extendedProps.rrule
    });
    
    // Debug RRULE events - log both master and expanded instances
    if (extendedProps.rrule || event.extendedProps.originalEvent?.rrule) {
      console.log('🔁 RRULE Event Render:', {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        rrule: extendedProps.rrule,
        hasRRuleInOriginal: !!event.extendedProps.originalEvent?.rrule,
        allExtendedProps: Object.keys(extendedProps)
      });
    }
    // Render work hours with italic label
    if (extendedProps.isWorkHour) {
      const workHour = extendedProps.originalWorkHour;
      const start = event.start ? formatTimeForValidation(event.start) : '';
      const end = event.end ? formatTimeForValidation(event.end) : '';
      return {
        html: `
          <div style="height: 100%; display: flex; flex-direction: column; padding: 4px 6px; overflow: hidden;">
            <div style="font-size: 11px; font-style: italic; color: ${NEUTRAL_COLORS.gray500}; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${workHour.title}
            </div>
            <div style="font-size: 10px; color: ${NEUTRAL_COLORS.gray500}; opacity: 0.8; margin-top: 2px;">
              ${start} - ${end}
            </div>
          </div>
        `
      };
    }
    // Render habits with croissant icon (no completion checkbox)
    if (extendedProps.category === 'habit') {
      const start = event.start ? formatTimeForValidation(event.start) : '';
      const end = event.end ? formatTimeForValidation(event.end) : '';
      // Calculate height for layout
      const durationInMs = event.end && event.start ? event.end.getTime() - event.start.getTime() : 0;
      const durationInMinutes = durationInMs / (1000 * 60);
      const approximateHeight = settings?.isCompactView 
        ? (durationInMinutes / 30) * 15  // Compact: 15px per 30-minute slot
        : (durationInMinutes / 15) * 21; // Expanded: 21px per 15-minute slot
      const showTwoLines = approximateHeight >= 32;
      return {
        html: `
          <div style="height: 100%; display: flex; flex-direction: column; gap: 2px; padding: 2px; overflow: hidden;">
            ${showTwoLines ? `
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
              ${HABIT_ICON_SVG}
              <div style="font-size: 12px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${event.title}</div>
            </div>
            <div style="font-size: 10px; opacity: 0.8; line-height: 1;">${start} - ${end}</div>
            ` : `
            <div style="display: flex; align-items: center; gap: 4px;">
              ${HABIT_ICON_SVG}
              <div style="font-size: 12px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${event.title}</div>
            </div>
            `}
          </div>
        `
      };
    }
    // Render tasks with square icon and no time display
    if (extendedProps.category === 'task') {
      const isCompleted = extendedProps.completed;
      // Checkbox icon HTML for completion status - filled square when completed
      const checkIconSvg = isCompleted 
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><path d="m9 11 3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;"><rect width="18" height="18" x="3" y="3" rx="2"></rect></svg>';
      const iconHtml = `<button type="button" style="cursor: pointer; transition: transform 0.2s; background: none; border: none; color: inherit; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center;" 
                          onmouseover="this.style.transform='scale(1.1)'" 
                          onmouseout="this.style.transform='scale(1)'"
                          onclick="event.stopPropagation(); window.plannerToggleCompletion && window.plannerToggleCompletion('${event.id}')"
                          title="${isCompleted ? 'Mark as not completed' : 'Mark as completed'}">${checkIconSvg}</button>`;
      return {
        html: `
          <div style="height: 100%; display: flex; align-items: center; gap: 6px; padding: 4px 6px; overflow: hidden;">
            <div style="display: flex; align-items: center; color: inherit; flex-shrink: 0;">
              ${iconHtml}
            </div>
            <div style="font-size: 12px; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${event.title}</div>
          </div>
        `
      };
    }
    // Get project info for regular events
    const projectId = extendedProps.projectId;
    const project = projectId ? projects.find(p => p.id === projectId) : null;
    // Format time
    const start = event.start ? formatTimeForValidation(event.start) : '';
    const end = event.end ? formatTimeForValidation(event.end) : '';
    // Get event title - manual entry always takes precedence
    const eventType = extendedProps.type;
    const description = event.title;
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
    // Expanded view: slotDuration '00:15:00' renders at ~21px per 15-min slot (~84px per hour)
    // Compact view: 30-min slots at 15px each (30px per hour)
    const durationInMs = event.end && event.start ? event.end.getTime() - event.start.getTime() : 0;
    const durationInMinutes = durationInMs / (1000 * 60);
    const approximateHeight = settings?.isCompactView 
      ? (durationInMinutes / 30) * 15  // Compact: 15px per 30-minute slot
      : (durationInMinutes / 15) * 21; // Expanded: 21px per 15-minute slot
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
  }, [projects, isTimeTracking, currentTrackingEventId, settings?.isCompactView]);
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
      ErrorHandlingService.handle(error, { source: 'PlannerView', action: 'Failed to toggle habit completion:' });
    }
  }, [habits, updateHabit]);
  // Set up global completion toggle functions for HTML onclick events
  useEffect(() => {
    type PlannerWindow = Window & {
      plannerToggleCompletion?: (eventId: string) => void;
      plannerToggleHabitCompletion?: (habitId: string) => void;
    };
    const plannerWindow = window as PlannerWindow;
    plannerWindow.plannerToggleCompletion = handleCompletionToggle;
    plannerWindow.plannerToggleHabitCompletion = handleHabitCompletionToggle;
    return () => {
      delete plannerWindow.plannerToggleCompletion;
      delete plannerWindow.plannerToggleHabitCompletion;
    };
  }, [handleCompletionToggle, handleHabitCompletionToggle]);
  // Handle compact view toggle while preserving scroll position
  const handleCompactViewToggle = useCallback(() => {
    // Get current scroll position as percentage
    const scroller = document.querySelector('.fc-scroller.fc-scroller-liquid-absolute') as HTMLElement;
    if (!scroller) {
      updateSettings({ isCompactView: !settings?.isCompactView });
      return;
    }
    const scrollPercentage = scroller.scrollTop / scroller.scrollHeight;
    // Toggle the setting
    updateSettings({ isCompactView: !settings?.isCompactView });
    // After React re-renders, restore scroll position proportionally
    // Use requestAnimationFrame to wait for DOM update
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const updatedScroller = document.querySelector('.fc-scroller.fc-scroller-liquid-absolute') as HTMLElement;
        if (updatedScroller) {
          updatedScroller.scrollTop = scrollPercentage * updatedScroller.scrollHeight;
        }
      });
    });
  }, [settings?.isCompactView, updateSettings]);
  // Convert work hours to FullCalendar businessHours format using UnifiedCalendarService
  const businessHoursConfig = useMemo(() => 
    UnifiedCalendarService.getBusinessHoursConfig(settings),
    [settings]
  );
  // Prepare FullCalendar configuration
  const baseConfig = getBaseFullCalendarConfig(settings?.isCompactView || false);
  console.log('📦 FullCalendar plugins:', baseConfig.plugins?.map((p) => (typeof p === 'object' && p && 'name' in p ? (p as { name?: string }).name : String(p))));
  
  const calendarConfig = {
    ...baseConfig,
    ...getEventStylingConfig(),
    businessHours: businessHoursConfig, // Use work hours for business hours
    // Use function for events so refetchEvents() will get fresh data
    events: ((fetchInfo, successCallback, failureCallback) => {
      try {
        const allEvents = getStyledFullCalendarEvents({ selectedEventId, projects }) as EventInput[];
        // Filter events based on layer visibility using UnifiedCalendarService
        const filteredEvents = UnifiedCalendarService.filterEventsByLayerVisibility(
          allEvents,
          layerVisibility
        ) as EventInput[];
        
        // Debug: Log RRULE events being passed to FullCalendar
        const rruleEventsInFiltered = filteredEvents.filter((e) => Boolean(e.rrule));
        if (rruleEventsInFiltered.length > 0) {
          console.log('🎯 Passing', rruleEventsInFiltered.length, 'RRULE events to FullCalendar:');
          rruleEventsInFiltered.forEach((e) => {
            console.log('  📋', e.title, {
              id: e.id,
              start: e.start,
              end: e.end,
              rrule: e.rrule,
              duration: e.duration,
              allProps: Object.keys(e)
            });
          });
          
          // Try to manually test if RRULE parsing works
          console.log('🧪 Testing RRULE parsing with rrule library...');
          import('rrule').then(({ RRule }) => {
            try {
              const testRule = RRule.fromString(String(rruleEventsInFiltered[0].rrule));
              console.log('✅ RRULE parsing works:', testRule.toString());
              console.log('  First 3 occurrences:', testRule.all().slice(0, 3));
            } catch (err) {
              console.error('❌ RRULE parsing failed:', err);
            }
          }).catch(err => console.error('❌ Failed to load rrule library:', err));
        }
        
        successCallback(filteredEvents);
      } catch (error) {
        ErrorHandlingService.handle(error, { source: 'PlannerView', action: 'Error fetching events:' });
        failureCallback(error);
      }
    }) satisfies EventSourceFunc,
    initialView: currentView === 'week' ? 'timeGridWeek' : 'timeGridDay',
    initialDate: calendarDate,
    // Custom event content renderer - also handles CSS property updates
    eventContent: (arg: EventContentArg & { el?: HTMLElement | null }) => {
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
  eventDidMount: (info: EventMountArg) => {
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
      const normalizedWeekStart = normalizeToMidnight(addDaysToDate(weekStartDate, diff));
      setWeekStart(normalizedWeekStart);
      // Compute summary date strings directly from FullCalendar view
      const viewStart = normalizeToMidnight(new Date(dateInfo.start));
      const viewEnd = normalizeToMidnight(new Date(dateInfo.end));
      // Calculate the number of days in the view to determine if it's day or week view
      const daysDiff = Math.round((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
      const isDayView = daysDiff === 1;
      const next: string[] = [];
      if (isDayView) {
        next.push(getDateKey(viewStart));
      } else {
        let cur = new Date(viewStart);
        while (cur < viewEnd && next.length < 7) {
          next.push(getDateKey(cur));
          cur = addDaysToDate(cur, 1);
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
  // Refresh calendar when layer visibility changes
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.refetchEvents();
    }
  }, [layerVisibility]);
  // Add hoverable functionality to date headers using custom hook
  useHoverableDateHeaders({
    calendarDate,
    currentView,
    setCurrentDate,
    setTimelineView
  });
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
  
  // Handle drop from project summary row using custom hook
  useCalendarDragDrop({
    calendarRef,
    events,
    setCreatingNewEvent,
    toast
  });
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
            const monday = normalizeToMidnight(addDaysToDate(currentDate, daysToMonday));
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
  // Measure the time axis width for AvailabilityCard alignment
  useEffect(() => {
    if (!calendarReady) return;
    const selectAxis = () => {
      const el =
        document.querySelector('.fc-timegrid-axis') ||
        document.querySelector('.fc-timegrid-slot-label-cushion')?.parentElement ||
        document.querySelector('.fc-col-header .fc-timegrid-axis');
      return el as HTMLElement | null;
    };
    const measure = () => {
      const el = selectAxis();
      if (!el) return;
      const width = Math.round(el.getBoundingClientRect().width);
      if (width > 0 && width !== timeAxisWidth) {
        setTimeAxisWidth(width);
      }
    };
    // First measure after two animation frames (FullCalendar finalizes layout after mount)
    const rafId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(measure);
    });
    // Observe future size changes
    const el = selectAxis();
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [calendarReady, timeAxisWidth]);
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Calendar Controls */}
      <PlannerToolbar
        currentView={currentView}
        onViewChange={handleViewChange}
        onNavigate={handleNavigate}
        formatDateRange={formatDateRange}
        calendarDate={calendarDate}
        isDatePickerOpen={isDatePickerOpen}
        onDatePickerOpenChange={setIsDatePickerOpen}
        onDateSelect={handleDatePickerSelect}
        isLayersPopoverOpen={isLayersPopoverOpen}
        onLayersPopoverOpenChange={setIsLayersPopoverOpen}
        layerVisibility={layerVisibility}
        onToggleLayer={(layer) => setLayerVisibility(prev => ({ ...prev, [layer]: !prev[layer] }))}
        isCompactView={settings?.isCompactView || false}
        onToggleCompactView={handleCompactViewToggle}
        onHelpClick={() => setHelpModalOpen(true)}
      />
      {/* Week Navigation Bar - Mobile/Tablet Only */}
      <WeekNavigationBar
        visibleStartDate={visibleRange.start}
        visibleEndDate={visibleRange.end}
        weekStartDate={weekStart}
        visibleDayCount={UnifiedCalendarService.getResponsiveDayCount()}
        onDayClick={handleWeekNavDayClick}
        show={currentView === 'week' && (viewportSize === 'mobile' || viewportSize === 'tablet')}
      />
      {/* Estimated Time Card intentionally hidden */}
      {/* Calendar Content */}
      <div className="flex-1 px-6 pb-[21px] min-h-0">
        <div
          ref={(el) => {
            calendarCardRef.current = el;
            if (swipeRef) {
              swipeRef.current = el;
            }
          }}
          className={`planner-calendar-card h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden ${settings?.isCompactView ? 'planner-compact' : ''}`}
          style={{ '--planner-scrollbar-width': `${calendarScrollbarWidth}px` } as React.CSSProperties}
        >
          <FullCalendar
            key={`${currentView}-${viewportSize}-${settings?.isCompactView ? 'compact' : 'normal'}`}
            ref={calendarRef}
            {...calendarConfig}
            height="100%"
          />
        </div>
      </div>
      {/* Calendar Insight Card */}
      <div className="px-6 pb-[21px]">
        <AvailabilityCard 
          key={currentView}
          collapsed={false}
          dates={(() => {
            if (currentView === 'day') {
              return [calendarDate];
            } else {
              // Get the week containing calendarDate
              const startOfWeek = addDaysToDate(calendarDate, -calendarDate.getDay() + 1); // Monday
              const dates = [];
              for (let i = 0; i < 7; i++) {
                dates.push(addDaysToDate(startOfWeek, i));
              }
              return dates;
            }
          })()}
          projects={projects}
          settings={settings}
          mode={currentView === 'day' ? 'days' : 'weeks'}
          context="planner"
          timeGutterWidth={timeAxisWidth}
          scrollbarWidth={calendarScrollbarWidth}
          phases={projectPhases}
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
        <HelpModal
          open={helpModalOpen}
          onOpenChange={setHelpModalOpen}
          initialTopicId="planner"
        />
      </React.Suspense>
      
      {/* Work Hour Scope Dialog */}
      <WorkHourScopeDialog
        isOpen={showWorkHourScopeDialog}
        onClose={cancelWorkHourChange}
        onThisDay={() => confirmWorkHourChange('this-day')}
        onAllFuture={() => confirmWorkHourChange('all-future')}
        action={pendingWorkHourChange?.type || 'update'}
        workHourDate={pendingWorkHourChange ? formatDateLong(new Date()) : undefined}
      />
    </div>
  );
}
