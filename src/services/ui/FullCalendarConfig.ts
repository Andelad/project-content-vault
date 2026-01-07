/**
 * FullCalendar Configuration Service
 * 
 * UI-layer service for FullCalendar-specific configuration.
 * Migrated from UnifiedCalendarService (pure UI concern).
 * 
 * Responsibilities:
 * - FullCalendar plugin configuration
 * - Business hours mapping from Settings
 * - Event filtering by layer visibility
 * - Responsive viewport detection
 * - Calendar styling configuration
 * 
 * NOT responsible for:
 * - Business logic (goes to domain/rules/)
 * - Data transformation (goes to services/data/)
 * - Workflow orchestration (goes to orchestrators/)
 */

import type { Settings } from '@/types/core';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import momentPlugin from '@fullcalendar/moment';
import rrulePlugin from '@fullcalendar/rrule';

/**
 * Layer visibility for calendar events
 */
export interface LayerVisibility {
  events: boolean;
  habits: boolean;
  tasks: boolean;
  workHours: boolean;
}

/**
 * Business hours configuration format
 */
export interface BusinessHoursConfig {
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
}

/**
 * Calendar view types
 */
export type CalendarView = 'week' | 'day';

/**
 * Viewport size categories
 */
export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

/**
 * Day mapping for FullCalendar (0=Sunday, 1=Monday, etc.)
 */
const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

/**
 * Convert Settings.weeklyWorkHours to FullCalendar businessHours format
 */
export function getBusinessHoursConfig(settings: Settings | null | undefined): BusinessHoursConfig | BusinessHoursConfig[] {
  if (!settings?.weeklyWorkHours) {
    return {
      daysOfWeek: [1, 2, 3, 4, 5], // Default: Mon-Fri
      startTime: '09:00',
      endTime: '17:00'
    };
  }

  const businessHours: BusinessHoursConfig[] = [];
  
  Object.entries(settings.weeklyWorkHours).forEach(([dayName, slots]) => {
    const dayNumber = DAY_MAP[dayName.toLowerCase()];
    if (slots && slots.length > 0) {
      slots.forEach(slot => {
        businessHours.push({
          daysOfWeek: [dayNumber],
          startTime: slot.startTime,
          endTime: slot.endTime
        });
      });
    }
  });

  return businessHours.length > 0 ? businessHours : {
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '17:00'
  };
}

/**
 * Filter events based on layer visibility settings
 */
export function filterEventsByLayerVisibility<T extends { extendedProps?: Record<string, unknown> }>(
  events: T[],
  layerVisibility: LayerVisibility
): T[] {
  return events.filter(event => {
    const props = event.extendedProps;
    if (!props) return true;

    // Check layer type and visibility
    if (props.layerType === 'habit' && !layerVisibility.habits) return false;
    if (props.layerType === 'task' && !layerVisibility.tasks) return false;
    if (props.layerType === 'work-hours' && !layerVisibility.workHours) return false;
    if (props.layerType === 'event' && !layerVisibility.events) return false;

    return true;
  });
}

/**
 * Detect current viewport size
 */
export function getViewportSize(): ViewportSize {
  if (typeof window === 'undefined') return 'desktop';
  
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Get responsive day count based on viewport
 */
export function getResponsiveDayCount(): number {
  const size = getViewportSize();
  switch (size) {
    case 'mobile': return 1;
    case 'tablet': return 3;
    default: return 7;
  }
}

/**
 * Check if current viewport is mobile
 */
export function isMobileViewport(): boolean {
  return getViewportSize() === 'mobile';
}

/**
 * Check if current viewport is tablet or smaller
 */
export function isTabletViewport(): boolean {
  const size = getViewportSize();
  return size === 'mobile' || size === 'tablet';
}

/**
 * Get base FullCalendar configuration
 */
export function getBaseFullCalendarConfig(isCompactView: boolean = false): Partial<CalendarOptions> {
  return {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, momentPlugin, rrulePlugin],
    headerToolbar: false, // Custom toolbar in PlannerView
    allDaySlot: false,
    slotDuration: '00:15:00',
    slotLabelInterval: '01:00',
    slotMinTime: '00:00:00',
    slotMaxTime: '24:00:00',
    height: 'auto',
    expandRows: true,
    stickyHeaderDates: true,
    dayMaxEvents: false,
    nowIndicator: true,
    scrollTime: '08:00:00',
    slotEventOverlap: true,
    editable: true,
    selectable: true,
    selectMirror: true,
    weekends: true,
    navLinks: false,
    dayHeaders: true,
    dayHeaderFormat: {
      weekday: isCompactView ? 'narrow' : 'short',
      month: 'numeric',
      day: 'numeric',
      omitCommas: true
    },
    slotLabelFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    },
    eventTimeFormat: {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }
  };
}

/**
 * Get event styling configuration
 */
export function getEventStylingConfig(): Partial<CalendarOptions> {
  return {
    eventClassNames: (arg) => {
      const classes = ['fc-event-custom'];
      
      if (arg.event.extendedProps.layerType) {
        classes.push(`fc-event-layer-${arg.event.extendedProps.layerType}`);
      }
      
      if (arg.event.extendedProps.isRecurring) {
        classes.push('fc-event-recurring');
      }
      
      if (arg.event.extendedProps.isException) {
        classes.push('fc-event-exception');
      }
      
      if (arg.event.extendedProps.projectId) {
        classes.push('fc-event-with-project');
      }
      
      if (arg.event.extendedProps.completed) {
        classes.push('fc-event-completed');
      }
      
      return classes;
    },
    eventContent: (arg) => {
      const { event } = arg;
      const title = event.title || 'Untitled';
      const isWorkHours = event.extendedProps.layerType === 'work-hours';
      
      if (isWorkHours) {
        return {
          html: `
            <div class="fc-event-main-frame">
              <div class="fc-event-time">${arg.timeText}</div>
              <div class="fc-event-title-container">
                <div class="fc-event-title fc-sticky">${title}</div>
              </div>
            </div>
          `
        };
      }
      
      return {
        html: `
          <div class="fc-event-main-frame">
            <div class="fc-event-time">${arg.timeText}</div>
            <div class="fc-event-title-container">
              <div class="fc-event-title fc-sticky">
                ${event.extendedProps.projectName ? `<span class="fc-event-project">${event.extendedProps.projectName}</span>` : ''}
                ${title}
                ${event.extendedProps.completed ? '<span class="fc-event-check">✓</span>' : ''}
              </div>
            </div>
          </div>
        `
      };
    }
  };
}

/**
 * Get view-specific configuration
 */
export function getViewSpecificConfig(view: CalendarView, isCompactView: boolean = false): Partial<CalendarOptions> {
  const baseConfig = {
    initialView: view === 'week' ? 'timeGridWeek' : 'timeGridDay',
  };
  
  if (view === 'week') {
    return {
      ...baseConfig,
      dayCount: isCompactView ? 5 : 7, // 5-day or 7-day week
    };
  }
  
  return baseConfig;
}
