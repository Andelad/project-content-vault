import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import momentPlugin from '@fullcalendar/moment';

/**
 * Base FullCalendar configuration for PlannerV2
 */
export function getBaseFullCalendarConfig(): Partial<CalendarOptions> {
  return {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, momentPlugin],
    
    // Initial view and header
    initialView: 'timeGridWeek',
    headerToolbar: false, // We'll use custom toolbar
    
    // Time settings
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    slotDuration: '00:15:00',
    slotLabelInterval: '01:00:00',
    slotLabelFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    
    // Week settings
    firstDay: 1, // Monday
    weekends: true,
    
    // Custom day header content - show weekday abbreviations (3 letters) + two-digit date
    dayHeaderContent: function(arg) {
      // Get the weekday abbreviation (3 letters) and two-digit date
      const weekday = arg.date.toLocaleDateString('en-US', { weekday: 'short' });
      const day = arg.date.getDate().toString().padStart(2, '0');
      return `${weekday} ${day}`;
    },
    
    // Event settings
    editable: true,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: false,
    allDaySlot: false, // Remove all-day events slot
    
    // Enable event resizing
    eventResizableFromStart: true, // Allow resizing from the start of the event
    eventDurationEditable: true,   // Allow changing event duration
    eventStartEditable: true,      // Allow changing event start time
    
    // Appearance
    height: 'auto',
    expandRows: true,
    stickyHeaderDates: true,
    
    // Time format
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    
    // Snap settings for precise time selection
    snapDuration: '00:15:00',
    
    // Week number
    weekNumbers: false,
    
    // Business hours (can be customized later)
    businessHours: {
      daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday
      startTime: '09:00',
      endTime: '17:00'
    },
    
    // Scrolling - disabled to allow custom scroll positioning
    scrollTime: '00:00:00', // Start at top, custom logic will handle scroll
    scrollTimeReset: false,
    
    // Now indicator
    nowIndicator: true,
    
    // Event display
    displayEventTime: true,
    displayEventEnd: false
  };
}

/**
 * Get view-specific configurations
 */
export function getViewSpecificConfig(view: 'week' | 'day'): Partial<CalendarOptions> {
  const baseConfig = getBaseFullCalendarConfig();
  
  if (view === 'day') {
    return {
      ...baseConfig,
      initialView: 'timeGridDay'
    };
  }
  
  return {
    ...baseConfig,
    initialView: 'timeGridWeek'
  };
}

/**
 * Get event styling configuration
 */
export function getEventStylingConfig(): Partial<CalendarOptions> {
  return {
    eventDisplay: 'block',
    eventBackgroundColor: undefined, // Will be set per event
    eventBorderColor: undefined, // Will be set per event
    eventTextColor: undefined, // Will be set per event
    
    // Custom CSS classes
    eventClassNames: (arg) => {
      const classes = ['planner-v2-event'];
      
      if (arg.event.extendedProps.completed) {
        classes.push('completed');
      }
      
      if (arg.event.extendedProps.isWorkHour) {
        classes.push('work-hour');
      }
      
      return classes;
    }
  };
}
