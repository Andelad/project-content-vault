import { CalendarEvent, WorkHour } from '@/types';
import { EventInput } from '@fullcalendar/core';
import { transformCalendarEventToFullCalendar, transformWorkHourToFullCalendar } from './eventTransformService';

/**
 * Calculate and prepare events for FullCalendar display
 */
export class PlannerV2CalculationService {
  
  /**
   * Combine calendar events and work hours into FullCalendar format
   */
  static prepareEventsForFullCalendar(
    events: CalendarEvent[], 
    workHours: WorkHour[],
    layerMode: 'events' | 'work-hours' | 'both' = 'both'
  ): EventInput[] {
    const fcEvents: EventInput[] = [];
    
    // Add calendar events if in events or both mode
    if (layerMode === 'events' || layerMode === 'both') {
      events.forEach(event => {
        fcEvents.push(transformCalendarEventToFullCalendar(event));
      });
    }
    
    // Add work hours if in work-hours or both mode
    if (layerMode === 'work-hours' || layerMode === 'both') {
      workHours.forEach(workHour => {
        fcEvents.push(transformWorkHourToFullCalendar(workHour));
      });
    }
    
    return fcEvents;
  }
  
  /**
   * Filter events by date range
   */
  static filterEventsByDateRange(
    events: CalendarEvent[], 
    startDate: Date, 
    endDate: Date
  ): CalendarEvent[] {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Event overlaps with the date range
      return eventStart <= endDate && eventEnd >= startDate;
    });
  }
  
  /**
   * Get events for a specific date
   */
  static getEventsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
    const dateStr = date.toISOString().split('T')[0];
    
    return events.filter(event => {
      const eventStartDate = event.startTime.toISOString().split('T')[0];
      const eventEndDate = event.endTime.toISOString().split('T')[0];
      
      return dateStr >= eventStartDate && dateStr <= eventEndDate;
    });
  }
  
  /**
   * Calculate total time for events in a date range
   */
  static calculateTotalTimeForPeriod(
    events: CalendarEvent[], 
    startDate: Date, 
    endDate: Date
  ): number {
    const filteredEvents = this.filterEventsByDateRange(events, startDate, endDate);
    
    return filteredEvents.reduce((total, event) => {
      return total + (event.duration || 0);
    }, 0);
  }
  
  /**
   * Detect event conflicts/overlaps
   */
  static detectEventConflicts(events: CalendarEvent[]): Array<{
    event1: CalendarEvent;
    event2: CalendarEvent;
    overlapStart: Date;
    overlapEnd: Date;
  }> {
    const conflicts = [];
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];
        
        const start1 = new Date(event1.startTime);
        const end1 = new Date(event1.endTime);
        const start2 = new Date(event2.startTime);
        const end2 = new Date(event2.endTime);
        
        // Check for overlap
        const overlapStart = new Date(Math.max(start1.getTime(), start2.getTime()));
        const overlapEnd = new Date(Math.min(end1.getTime(), end2.getTime()));
        
        if (overlapStart < overlapEnd) {
          conflicts.push({
            event1,
            event2,
            overlapStart,
            overlapEnd
          });
        }
      }
    }
    
    return conflicts;
  }
}
