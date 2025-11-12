import { CalendarEvent, WorkHour } from '@/types';
import { EventInput } from '@fullcalendar/core';
import { calculateEventStyle } from './UnifiedEventWorkHourService';
import { OKLCH_FALLBACK_GRAY, OKLCH_HABIT_BROWN, NEUTRAL_COLORS } from '@/constants/colors';
import { type EventStyleConfig } from './UnifiedEventWorkHourService';
import { calculateDurationHours } from '@/services/calculations/general/dateCalculations';

/**
 * Unified Event Transform Service
 * 
 * Centralizes all event transformation logic for FullCalendar integration.
 * Handles color calculations, styling, and format conversions.
 */

/**
 * Prepare events and work hours for FullCalendar display
 * Combines calendar events, habits, tasks, and work hours into FullCalendar format
 */
export function prepareEventsForFullCalendar(
  events: CalendarEvent[], 
  workHours: WorkHour[],
  layerMode: 'events' | 'work-hours' | 'both' = 'both',
  options: { selectedEventId?: string | null; projects?: any[]; habits?: any[] } = {}
): EventInput[] {
  const { selectedEventId, projects = [] } = options;
  const fcEvents: EventInput[] = [];
  
  // Debug: Log RRULE events being prepared
  const rruleEvents = events.filter(e => e.rrule);
  if (rruleEvents.length > 0) {
    console.log('📅 prepareEventsForFullCalendar: Preparing', rruleEvents.length, 'RRULE master events for FullCalendar');
    rruleEvents.forEach(e => {
      console.log('  🔁', e.title, '- RRULE:', e.rrule, '- Start:', new Date(e.startTime).toISOString());
    });
  }

  // Add calendar events (all categories: events, habits, tasks)
  if (layerMode === 'events' || layerMode === 'both') {
    events.forEach(event => {
      const fcEvent = transformCalendarEventToFullCalendar(event, { projects });
      if (fcEvent) {
        // Highlight selected event
        if (selectedEventId === event.id) {
          fcEvent.className = `${fcEvent.className || ''} selected-event`.trim();
        }
        fcEvents.push(fcEvent);
      }
    });
  }

  // Add work hours
  if (layerMode === 'work-hours' || layerMode === 'both') {
    workHours.forEach(workHour => {
      const fcEvent = transformWorkHourToFullCalendar(workHour);
      if (fcEvent) {
        fcEvents.push(fcEvent);
      }
    });
  }

  return fcEvents;
}

/**
 * Transform CalendarEvent to FullCalendar EventInput format
 */
export function transformCalendarEventToFullCalendar(event: CalendarEvent, options: { isSelected?: boolean; projects?: any[] } = {}): EventInput {
  const { isSelected = false, projects = [] } = options;
  
  // Find project for color fallback
  const project = event.projectId ? projects.find(p => p.id === event.projectId) : null;
  
  // Get the base color - habits always use OKLCH brown, regardless of stored color
  const baseColor = event.category === 'habit' 
    ? OKLCH_HABIT_BROWN 
    : (event.color || (project ? project.color : OKLCH_FALLBACK_GRAY));
  
  // Check if event is in the future (non-completed)
  const now = new Date();
  const eventStart = new Date(event.startTime);
  const isFutureEvent = eventStart > now;
  const isNonCompleted = !event.completed;
  
  // Calculate event styling using service (same as regular planner)
  const styleConfig: EventStyleConfig = {
    isSelected,
    isFutureEvent: isNonCompleted, // All non-completed events get future styling
    isActiveLayer: true, // Always active in PlannerV2
    isCompleted: event.completed
  };
  
  const { backgroundColor, textColor, borderColor } = calculateEventStyle(baseColor, styleConfig);
  
  // For habits, make the background more transparent and ensure dark text
  // For tasks, use transparent white background with dark text
  let finalBackgroundColor = backgroundColor;
  let finalTextColor = textColor;
  
  if (event.category === 'habit') {
    finalBackgroundColor = backgroundColor.replace(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/, 'oklch($1 $2 $3 / 0.7)');
    finalTextColor = 'oklch(0.28 0.07 65)'; // Dark brown text matching the habit color
  } else if (event.category === 'task') {
    finalBackgroundColor = 'rgba(255, 255, 255, 0.6)'; // Transparent white
    finalTextColor = 'oklch(0.3 0 0)'; // Dark text for visibility
  }
  
  // Determine CSS classes for styling
  const cssClasses = ['planner-v2-event'];
  if (event.completed) {
    cssClasses.push('completed');
  }
  if (isNonCompleted) {
    cssClasses.push('future-event');
  }
  if (isSelected) {
    cssClasses.push('selected-event');
  }
  if (event.category === 'habit') {
    cssClasses.push('habit-event');
  }
  if (event.category === 'task') {
    cssClasses.push('task-event');
  }
  
  return {
    id: event.id,
    title: event.title,
    start: event.startTime,
    end: event.endTime,
    backgroundColor: finalBackgroundColor,
    // Don't set borderColor - let CSS classes handle borders completely
    textColor: finalTextColor,
    className: cssClasses,
    // Add RRULE support for FullCalendar expansion
    // When using RRULE, FullCalendar needs:
    // 1. rrule: the RRULE string
    // 2. duration: how long each occurrence lasts (in milliseconds)
    // 3. start: will be used as dtstart for the rrule
    ...(event.rrule && { 
      rrule: event.rrule,
      duration: { milliseconds: calculateDurationHours(new Date(event.startTime), new Date(event.endTime)) * 60 * 60 * 1000 }
    }),
    extendedProps: {
      description: event.description,
      projectId: event.projectId,
      completed: event.completed,
      duration: event.duration,
      type: event.type,
      category: event.category,
      recurring: event.recurring,
      rrule: event.rrule, // Also store in extendedProps for reference
      originalEvent: event,
      // Store colors for CSS custom properties
      futureEventBorderColor: baseColor,
      selectedEventBorderColor: borderColor
    },
    editable: true,
    startEditable: true,
    durationEditable: true,
    resizable: true
  };
}

/**
 * Transform WorkHour to FullCalendar EventInput format
 */
export function transformWorkHourToFullCalendar(workHour: WorkHour): EventInput {
  return {
    id: `work-${workHour.id}`,
    title: workHour.title,
    start: workHour.startTime,
    end: workHour.endTime,
    backgroundColor: '#ffffff',
    borderColor: NEUTRAL_COLORS.gray200,
    textColor: NEUTRAL_COLORS.gray500,
    extendedProps: {
      isWorkHour: true,
      originalWorkHour: workHour
    },
    editable: true,
    startEditable: true,
    durationEditable: true,
    resizable: true,
    display: 'background', // Background display so they don't interact with regular events
    classNames: ['work-slot-event']
  };
}

/**
 * Transform FullCalendar event back to CalendarEvent format
 */
export function transformFullCalendarToCalendarEvent(fcEvent: any): Partial<CalendarEvent> {
  return {
    id: fcEvent.id,
    title: fcEvent.title,
    startTime: new Date(fcEvent.start),
    endTime: new Date(fcEvent.end),
    // ✅ DELEGATE to domain layer - no manual date math!
    duration: calculateDurationHours(new Date(fcEvent.start), new Date(fcEvent.end))
  };
}

/**
 * Get contrasting text color based on background color
 * Returns white for dark backgrounds, black for light backgrounds
 */
function getContrastTextColor(backgroundColor: string): string {
  const WHITE = '#ffffff';
  const BLACK = '#000000';
  
  if (!backgroundColor) return BLACK;
  
  // Convert OKLCH or hex to a simple brightness check
  if (backgroundColor.includes('oklch')) {
    // Extract lightness value from OKLCH
    const lightnessMatch = backgroundColor.match(/oklch\(([0-9.]+)%/);
    if (lightnessMatch) {
      const lightness = parseFloat(lightnessMatch[1]);
      return lightness < 50 ? WHITE : BLACK;
    }
  }
  
  // Default contrast logic for hex colors
  if (backgroundColor.startsWith('#')) {
    const hex = backgroundColor.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? BLACK : WHITE;
  }
  
  return BLACK;
}
