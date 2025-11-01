import { CalendarEvent, WorkHour } from '@/types';
import { EventInput } from '@fullcalendar/core';
import { calculateEventStyle } from './UnifiedEventWorkHourService';
import { OKLCH_FALLBACK_GRAY } from '@/constants/colors';
import { type EventStyleConfig } from './UnifiedEventWorkHourService';
import { calculateDurationHours } from '@/services/calculations/general/dateCalculations';

/**
 * Transform CalendarEvent to FullCalendar EventInput format
 */
export function transformCalendarEventToFullCalendar(event: CalendarEvent, options: { isSelected?: boolean; projects?: any[] } = {}): EventInput {
  const { isSelected = false, projects = [] } = options;
  
  // Find project for color fallback
  const project = event.projectId ? projects.find(p => p.id === event.projectId) : null;
  
  // Get the base color (project color or fallback)
  const baseColor = event.color || (project ? project.color : OKLCH_FALLBACK_GRAY);
  
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
  
  return {
    id: event.id,
    title: event.title,
    start: event.startTime,
    end: event.endTime,
    backgroundColor,
    // Don't set borderColor - let CSS classes handle borders completely
    textColor,
    className: cssClasses,
    extendedProps: {
      description: event.description,
      projectId: event.projectId,
      completed: event.completed,
      duration: event.duration,
      type: event.type,
      recurring: event.recurring,
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
    title: workHour.title, // Remove prefix, will be styled in rendering
    start: workHour.startTime,
    end: workHour.endTime,
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
    textColor: '#1976d2',
    extendedProps: {
      isWorkHour: true,
      originalWorkHour: workHour
    },
    editable: true,
    startEditable: true,
    durationEditable: true,
    resizable: true,
    display: 'block', // Changed from 'background' to allow custom rendering with labels
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
 */
function getContrastTextColor(backgroundColor: string): string {
  // Simple contrast calculation - could be enhanced with more sophisticated logic
  if (!backgroundColor) return '#000';
  
  // Convert OKLCH or hex to a simple brightness check
  // For now, return white for dark colors, black for light colors
  if (backgroundColor.includes('oklch')) {
    // Extract lightness value from OKLCH
    const lightnessMatch = backgroundColor.match(/oklch\(([0-9.]+)%/);
    if (lightnessMatch) {
      const lightness = parseFloat(lightnessMatch[1]);
      return lightness < 50 ? '#fff' : '#000';
    }
  }
  
  // Default contrast logic for hex colors
  if (backgroundColor.startsWith('#')) {
    const hex = backgroundColor.slice(1);
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000' : '#fff';
  }
  
  return '#000';
}
