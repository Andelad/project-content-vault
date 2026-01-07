import { CalendarEvent, Project, WorkHour, WorkHourException } from '@/types';
import { EventInput } from '@fullcalendar/core';
import { calculateEventStyle, type EventStyleConfig } from '@/domain/rules/availability/EventWorkHourIntegration';
import { OKLCH_FALLBACK_GRAY, OKLCH_HABIT_BROWN, NEUTRAL_COLORS } from '@/constants/colors';
import { calculateDurationHours } from '@/utils/dateCalculations';

/**
 * Event Transformations for FullCalendar
 * 
 * UI layer service for transforming domain events to/from FullCalendar format.
 * Migrated from UnifiedEventTransformService (pure UI concern).
 * 
 * Responsibilities:
 * - Transform CalendarEvent ↔ FullCalendar EventInput
 * - Combine events + work hours for FullCalendar display
 * - Handle RRULE exceptions and styling
 * 
 * NOT responsible for:
 * - Business logic (goes to domain/rules/)
 * - Event validation (goes to domain/rules/)
 * - Database operations (goes to orchestrators/)
 */

/**
 * Prepare events and work hours for FullCalendar display
 * Combines calendar events, habits, tasks, and work hours into FullCalendar format
 */
export function prepareEventsForFullCalendar(
  events: CalendarEvent[], 
  workHours: WorkHour[],
  layerMode: 'events' | 'work-hours' | 'both' = 'both',
  options: { selectedEventId?: string | null; projects?: Project[]; habits?: unknown[]; exceptions?: WorkHourException[] } = {}
): EventInput[] {
  const { selectedEventId, projects = [], exceptions = [] } = options;
  const fcEvents: EventInput[] = [];

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

  // Add work hours with exception handling
  if (layerMode === 'work-hours' || layerMode === 'both') {
    // Build a map of deleted exceptions for efficient lookup
    const deletedExceptions = new Map<string, Set<string>>(); // slotId -> Set of dates (YYYY-MM-DD)
    exceptions.forEach((exception) => {
      if (exception.exceptionType === 'deleted') {
        const dateStr = new Date(exception.exceptionDate).toISOString().split('T')[0];
        if (!deletedExceptions.has(exception.slotId)) {
          deletedExceptions.set(exception.slotId, new Set());
        }
        deletedExceptions.get(exception.slotId)!.add(dateStr);
      }
    });

    workHours.forEach(workHour => {
      const fcEvent = transformWorkHourToFullCalendar(workHour);
      if (fcEvent) {
        // If this is an RRULE work hour, add EXDATE for deleted exceptions
        if (workHour.rrule && workHour.slotId && deletedExceptions.has(workHour.slotId)) {
          const exdates = Array.from(deletedExceptions.get(workHour.slotId)!);
          if (exdates.length > 0) {
            // Add EXDATE to the RRULE string
            // Format: DTSTART:...\nRRULE:...\nEXDATE:20251115,20251116
            const exdateStr = exdates.map(d => d.replace(/-/g, '')).join(',');
            fcEvent.rrule = `${fcEvent.rrule}\nEXDATE:${exdateStr}`;
          }
        }
        fcEvents.push(fcEvent);
      }
    });
  }

  return fcEvents;
}

/**
 * Transform CalendarEvent to FullCalendar EventInput format
 */
export function transformCalendarEventToFullCalendar(event: CalendarEvent, options: { isSelected?: boolean; projects?: Project[] } = {}): EventInput {
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
  
  // For RRULE events, don't include 'end' - only 'start' and 'duration'
  // FullCalendar's RRULE plugin will use dtstart from 'start' and calculate each occurrence
  const baseEvent = {
    id: event.id,
    title: event.title,
    // RRULE plugin needs start as ISO string, not Date object
    start: event.rrule ? new Date(event.startTime).toISOString() : event.startTime,
    backgroundColor: finalBackgroundColor,
    // Don't set borderColor - let CSS classes handle borders completely
    textColor: finalTextColor,
    className: cssClasses,
    // Habits render as background events (like work hours) - never cause stacking
    // But they're still interactive via CSS
    display: event.category === 'habit' ? 'background' : 'block',
  };
  
  return {
    ...baseEvent,
    // Add RRULE support for FullCalendar expansion
    // When using RRULE, provide only rrule and duration (NOT end time)
    // When NOT using RRULE, provide end time (NOT rrule or duration)
    ...(event.rrule ? { 
      // FullCalendar RRULE plugin expects RRULE string in RFC format
      // Format: "DTSTART:20251114T083000Z\nRRULE:FREQ=DAILY;INTERVAL=1"
      // Add UNTIL as safety limit if no COUNT or UNTIL exists (prevents infinite expansion)
      rrule: (() => {
        let rruleStr = event.rrule;
        
        // If RRULE has no COUNT or UNTIL, add UNTIL date (2 years from start)
        // This matches how Google Calendar/iCal handle recurring events
        // FullCalendar only expands instances within the visible date range anyway
        if (!rruleStr.includes('COUNT=') && !rruleStr.includes('UNTIL=')) {
          const startDate = new Date(event.startTime);
          const untilDate = new Date(startDate);
          untilDate.setFullYear(untilDate.getFullYear() + 2); // 2 years from start
          
          // Format: YYYYMMDDTHHMMSSZ
          const untilStr = untilDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
          rruleStr = `${rruleStr};UNTIL=${untilStr}`;
        }
        
        return `DTSTART:${new Date(event.startTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}\nRRULE:${rruleStr}`;
      })(),
      duration: (() => {
        // FullCalendar expects duration as object like { hours: 1, minutes: 30 }
        const durationHours = calculateDurationHours(new Date(event.startTime), new Date(event.endTime));
        const hours = Math.floor(durationHours);
        const minutes = Math.round((durationHours - hours) * 60);
        
        // Return as object with hours and minutes for FullCalendar
        return { hours, minutes };
      })()
    } : {
      end: event.endTime
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
 * Supports both single-instance and RRULE-based work hours
 */
export function transformWorkHourToFullCalendar(workHour: WorkHour): EventInput {
  const baseEvent = {
    id: `work-${workHour.id}`,
    title: workHour.title,
    start: workHour.startTime,
    backgroundColor: '#ffffff',
    borderColor: NEUTRAL_COLORS.gray200,
    textColor: NEUTRAL_COLORS.gray500,
    extendedProps: {
      isWorkHour: true,
      originalWorkHour: workHour,
      dayOfWeek: workHour.dayOfWeek,
      slotId: workHour.slotId
    },
    editable: true,
    startEditable: true,
    durationEditable: true,
    resizable: true,
    display: 'background', // Render as background - this is KEY for not causing stacking!
    // Background events can still be interactive with the right CSS
    classNames: ['work-slot-event']
  };

  // If work hour has RRULE, use RRULE format for infinite recurrence
  if (workHour.rrule) {
    const durationHours = calculateDurationHours(
      new Date(workHour.startTime),
      new Date(workHour.endTime)
    );
    const hours = Math.floor(durationHours);
    const minutes = Math.round((durationHours - hours) * 60);

    return {
      ...baseEvent,
      // Format RRULE for FullCalendar: DTSTART + RRULE
      rrule: `DTSTART:${new Date(workHour.startTime).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}\nRRULE:${workHour.rrule}`,
      duration: { hours, minutes }
      // Note: When using RRULE, don't include 'end' property
    };
  } else {
    // Single-instance work hour (for exceptions or non-recurring)
    return {
      ...baseEvent,
      end: workHour.endTime
    };
  }
}

/**
 * Transform FullCalendar event back to CalendarEvent format
 */
export function transformFullCalendarToCalendarEvent(fcEvent: EventInput): Partial<CalendarEvent> {
  return {
    id: fcEvent.id,
    title: fcEvent.title,
    startTime: new Date(fcEvent.start as string | Date),
    endTime: new Date(fcEvent.end as string | Date),
    // ✅ DELEGATE to domain layer - no manual date math!
    duration: calculateDurationHours(new Date(fcEvent.start as string | Date), new Date(fcEvent.end as string | Date))
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
