import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import momentPlugin from '@fullcalendar/moment';

/**
 * Detect if current viewport is mobile or tablet
 */
export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

export function isTabletViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth >= 768 && window.innerWidth < 1024;
}

/**
 * Base FullCalendar configuration for PlannerV2
 */
export function getBaseFullCalendarConfig(): Partial<CalendarOptions> {
  const isMobile = isMobileViewport();
  const isTablet = isTabletViewport();
  
  // Determine the number of days to show
  const dayCount = isMobile ? 2 : isTablet ? 3 : 7;
  
  return {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, momentPlugin],
    
    // Initial view and header
    initialView: isMobile ? 'timeGridDay' : 'timeGridWeek',
    headerToolbar: false, // We'll use custom toolbar
    
    // Define custom views for responsive day counts
    views: {
      timeGridWeek: {
        type: 'timeGrid',
        duration: { days: dayCount },
        buttonText: 'week',
        // Ensure week view always starts on Monday when showing 7 days
        ...(dayCount === 7 && { 
          dayCount: 7,
          dateAlignment: 'week'  // This forces alignment to week boundaries (respects firstDay)
        })
      },
      timeGridDay: {
        type: 'timeGrid',
        duration: { days: 1 }
      }
    },
    
    // Time settings - larger slots on mobile for better touch targets
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    slotDuration: isMobile ? '00:30:00' : '00:15:00',
    slotLabelInterval: '01:00:00',
    slotLabelFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    
    // Week settings - CRITICAL: Monday start for all week views
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
    
    // Responsive settings
    handleWindowResize: true,
    windowResizeDelay: 100,
    
    // Mobile-specific settings
    eventMinHeight: isMobile ? 20 : 15,
    slotEventOverlap: isMobile ? false : true,
    
    // Time format
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    
    // Snap settings for precise time selection - larger on mobile
    snapDuration: isMobile ? '00:30:00' : '00:15:00',
    
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
 * Get view-specific configurations with responsive behavior
 */
export function getViewSpecificConfig(view: 'week' | 'day'): Partial<CalendarOptions> {
  const baseConfig = getBaseFullCalendarConfig();
  
  if (view === 'day') {
    return {
      ...baseConfig,
      initialView: 'timeGridDay'
    };
  }
  
  // Week view - responsive columns handled by custom views definition
  return {
    ...baseConfig,
    initialView: 'timeGridWeek'
  };
}

/**
 * Get the number of visible days for current viewport
 */
export function getResponsiveDayCount(): number {
  const isMobile = isMobileViewport();
  const isTablet = isTabletViewport();
  
  if (isMobile) return 2;
  if (isTablet) return 3;
  return 7;
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
