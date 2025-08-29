import { CalendarEvent, WorkHour } from '@/types';
import { EventInput } from '@fullcalendar/core';

/**
 * Transform CalendarEvent to FullCalendar EventInput format
 */
export function transformCalendarEventToFullCalendar(event: CalendarEvent): EventInput {
  return {
    id: event.id,
    title: event.title,
    start: event.startTime,
    end: event.endTime,
    backgroundColor: event.color,
    borderColor: event.color,
    textColor: getContrastTextColor(event.color || '#666'),
    extendedProps: {
      description: event.description,
      projectId: event.projectId,
      completed: event.completed,
      duration: event.duration,
      type: event.type,
      recurring: event.recurring,
      originalEvent: event
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
    title: `Work: ${workHour.title}`,
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
    display: 'background' // Render as background event
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
    duration: (new Date(fcEvent.end).getTime() - new Date(fcEvent.start).getTime()) / (1000 * 60 * 60)
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
