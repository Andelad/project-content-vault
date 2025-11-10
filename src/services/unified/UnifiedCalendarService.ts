/**
 * UnifiedCalendarService
 * 
 * Single source of truth for all calendar/planner functionality.
 * Main API layer for components to interact with calendar operations.
 * 
 * Architecture:
 * - Components call UnifiedCalendarService methods
 * - Delegates to orchestrators for workflows (PlannerViewOrchestrator)
 * - Delegates to import service for calendar imports (CalendarImportService)
 * - Provides calendar configuration and business logic
 * 
 * Following .cursorrules:
 * - This is a Unified Service - components import from here
 * - Delegates to domain layers (orchestrators, calculations)
 * - No direct database access (uses orchestrators)
 */

import type { Settings } from '@/types/core';
import { CalendarImportService, type ExternalEvent, type ImportResult } from './CalendarImportService';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import momentPlugin from '@fullcalendar/moment';

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
 * Unified Calendar Service
 * 
 * Main API for all calendar/planner operations.
 * Components should use this service for calendar functionality.
 */
export class UnifiedCalendarService {
  
  // ============================================================================
  // CALENDAR CONFIGURATION
  // ============================================================================
  
  /**
   * Day mapping for FullCalendar (0=Sunday, 1=Monday, etc.)
   */
  private static readonly DAY_MAP: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  
  /**
   * Default business hours (Mon-Fri, 9am-5pm)
   */
  private static readonly DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '09:00',
    endTime: '17:00'
  };
  
  /**
   * Get business hours configuration for calendar
   * Converts settings work hours to FullCalendar format
   */
  static getBusinessHoursConfig(settings: Settings | null | undefined): BusinessHoursConfig | BusinessHoursConfig[] {
    if (!settings?.weeklyWorkHours) {
      return this.DEFAULT_BUSINESS_HOURS;
    }
    
    const businessHours: BusinessHoursConfig[] = [];
    
    Object.entries(settings.weeklyWorkHours).forEach(([dayName, slots]) => {
      const dayNumber = this.DAY_MAP[dayName.toLowerCase()];
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
    
    return businessHours.length > 0 ? businessHours : this.DEFAULT_BUSINESS_HOURS;
  }
  
  /**
   * Filter calendar events based on layer visibility
   */
  static filterEventsByLayerVisibility(
    events: any[],
    layerVisibility: LayerVisibility
  ): any[] {
    return events.filter((event: any) => {
      const category = event.extendedProps?.category;
      const isWorkHour = event.extendedProps?.isWorkHour;
      
      // Work hours filtering
      if (isWorkHour) {
        return layerVisibility.workHours;
      }
      
      // Category-based filtering
      if (category === 'habit') {
        return layerVisibility.habits;
      }
      if (category === 'task') {
        return layerVisibility.tasks;
      }
      
      // Default to events layer
      return layerVisibility.events;
    });
  }
  
  /**
   * Get viewport size category based on window width
   */
  static getViewportSize(): ViewportSize {
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
  
  /**
   * Get responsive day count for calendar view
   * Determines how many days to show based on viewport size
   */
  static getResponsiveDayCount(): number {
    const viewportSize = this.getViewportSize();
    
    switch (viewportSize) {
      case 'mobile': return 1;
      case 'tablet': return 3;
      case 'desktop': return 7;
    }
  }
  
  /**
   * Check if viewport is mobile
   */
  static isMobileViewport(): boolean {
    return this.getViewportSize() === 'mobile';
  }
  
  /**
   * Check if viewport is tablet
   */
  static isTabletViewport(): boolean {
    return this.getViewportSize() === 'tablet';
  }
  
  // ============================================================================
  // FULLCALENDAR CONFIGURATION
  // ============================================================================
  
  /**
   * Get base FullCalendar configuration
   * @param isCompactView - Whether to use compact view mode (30-min slot labels instead of 1-hour)
   */
  static getBaseFullCalendarConfig(isCompactView: boolean = false): Partial<CalendarOptions> {
    const isMobile = this.isMobileViewport();
    const isTablet = this.isTabletViewport();
    
    // Determine the number of days to show
    const dayCount = this.getResponsiveDayCount();
    
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
      // Compact view: use 30-min slots to halve vertical space (CSS handles further compression)
      slotMinTime: '00:00:00',
      slotMaxTime: '24:00:00',
      slotDuration: isCompactView ? '00:30:00' : (isMobile ? '00:30:00' : '00:15:00'),
      slotLabelInterval: '01:00:00', // Always show only hours in time column
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
      eventResizableFromStart: true,
      eventDurationEditable: true,
      eventStartEditable: true,
      
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
      
      // Business hours (default - can be overridden)
      businessHours: this.DEFAULT_BUSINESS_HOURS,
      
      // Scrolling - disabled to allow custom scroll positioning
      scrollTime: '00:00:00',
      scrollTimeReset: false,
      
      // Now indicator
      nowIndicator: true,
      
      // Event display
      displayEventTime: true,
      displayEventEnd: false
    };
  }
  
  /**
   * Get event styling configuration for FullCalendar
   */
  static getEventStylingConfig(): Partial<CalendarOptions> {
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
  
  /**
   * Get view-specific configurations with responsive behavior
   * @param view - The view type ('week' or 'day')
   * @param isCompactView - Whether to use compact view mode
   */
  static getViewSpecificConfig(view: CalendarView, isCompactView: boolean = false): Partial<CalendarOptions> {
    const baseConfig = this.getBaseFullCalendarConfig(isCompactView);
    
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
  
  // ============================================================================
  // CALENDAR IMPORT OPERATIONS (Delegates to CalendarImportService)
  // ============================================================================
  
  /**
   * Parse iCal file content and extract events
   * Delegates to CalendarImportService
   */
  static parseICalFile(fileContent: string): ExternalEvent[] {
    return CalendarImportService.parseICalFile(fileContent);
  }
  
  /**
   * Import external events into the calendar
   * Delegates to CalendarImportService
   */
  static async importEvents(
    events: ExternalEvent[],
    projectId: string | null = null,
    dateRangeStart?: Date,
    dateRangeEnd?: Date
  ): Promise<ImportResult> {
    return CalendarImportService.importEvents(events, projectId, dateRangeStart, dateRangeEnd);
  }
}

// Export types for convenience
export type { ExternalEvent, ImportResult } from './CalendarImportService';
