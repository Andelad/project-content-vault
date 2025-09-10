/**
 * Planner Insights & Calculations Service
 * 
 * Consolidated calculation functions for:
 * - FullCalendar event preparation and display
 * - Planner insight metrics and analytics
 * 
 * Consolidated from:
 * - plannerCalculations.ts
 * - plannerInsightCalculations.ts
 * 
 * Date: September 10, 2025
 */

import moment from 'moment';
import { CalendarEvent, WorkHour } from '@/types';
import { EventInput } from '@fullcalendar/core';
import { transformCalendarEventToFullCalendar, transformWorkHourToFullCalendar } from '@/services/unified/UnifiedEventTransformService';

// =====================================================================================
// INTERFACES
// =====================================================================================

export interface CalendarInsightOptions {
  isTimeTracking?: boolean;
  currentTrackingEvent?: CalendarEvent | null;
  currentTime?: Date;
}

export interface DailyTotals {
  [key: string]: number;
}

// =====================================================================================
// FULLCALENDAR PREPARATION
// =====================================================================================

/**
 * Calculate and prepare events for FullCalendar display
 */
export class PlannerCalculationService {
  
  /**
   * Combine calendar events and work hours into FullCalendar format
   */
  static prepareEventsForFullCalendar(
    events: CalendarEvent[], 
    workHours: WorkHour[],
    layerMode: 'events' | 'work-hours' | 'both' = 'both',
    options: { selectedEventId?: string | null; projects?: any[] } = {}
  ): EventInput[] {
    const { selectedEventId, projects = [] } = options;
    const fcEvents: EventInput[] = [];

    // Add calendar events
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
   * Filter events by date range for performance
   */
  static filterEventsByDateRange(
    events: CalendarEvent[], 
    startDate: Date, 
    endDate: Date
  ): CalendarEvent[] {
    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Check if event overlaps with the date range
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
   * Calculate total time for events in a period
   */
  static calculateTotalTimeForPeriod(
    events: CalendarEvent[], 
    startDate: Date, 
    endDate: Date
  ): number {
    const filteredEvents = this.filterEventsByDateRange(events, startDate, endDate);
    
    return filteredEvents.reduce((total, event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      const duration = (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60); // hours
      return total + duration;
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

// =====================================================================================
// INSIGHT CALCULATIONS
// =====================================================================================

/**
 * Calculate daily totals for calendar insights
 */
export function calculateDailyTotals(
  events: CalendarEvent[], 
  options: CalendarInsightOptions = {}
): DailyTotals {
  const dailyTotals: DailyTotals = {};
  const { isTimeTracking, currentTrackingEvent, currentTime = new Date() } = options;

  events.forEach(event => {
    const startTime = moment(event.startTime);
    const endTime = moment(event.endTime);
    const dateKey = startTime.format('YYYY-MM-DD');

    // Calculate duration
    let duration = endTime.diff(startTime, 'minutes');

    // Handle time tracking adjustments
    if (isTimeTracking && currentTrackingEvent?.id === (event as any).id) {
      const currentMoment = moment(currentTime);
      if (currentMoment.isAfter(startTime)) {
        duration = currentMoment.diff(startTime, 'minutes');
      }
    }

    // Only count completed events or currently tracking events
    if (event.completed || (isTimeTracking && currentTrackingEvent?.id === (event as any).id)) {
      if (!dailyTotals[dateKey]) {
        dailyTotals[dateKey] = 0;
      }
      dailyTotals[dateKey] += duration;
    }
  });

  return dailyTotals;
}

/**
 * Calculate total minutes from daily totals
 */
export function calculateTotalMinutes(dailyTotals: DailyTotals): number {
  return Object.values(dailyTotals).reduce((sum, minutes) => sum + minutes, 0);
}

/**
 * Calculate average minutes per day
 */
export function calculateAverageMinutesPerDay(dailyTotals: DailyTotals): number {
  const totalMinutes = calculateTotalMinutes(dailyTotals);
  const dayCount = Object.keys(dailyTotals).length;
  return dayCount > 0 ? totalMinutes / dayCount : 0;
}

/**
 * Format minutes to hours and minutes display
 */
export function formatMinutesToHoursMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (hours === 0) {
    return `${remainingMinutes}m`;
  }
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Calculate productivity metrics for insights
 */
export function calculateProductivityMetrics(
  events: CalendarEvent[],
  options: CalendarInsightOptions = {}
): {
  totalMinutes: number;
  averagePerDay: number;
  completedEvents: number;
  totalEvents: number;
  completionRate: number;
} {
  const dailyTotals = calculateDailyTotals(events, options);
  const totalMinutes = calculateTotalMinutes(dailyTotals);
  const averagePerDay = calculateAverageMinutesPerDay(dailyTotals);
  
  const completedEvents = events.filter(event => event.completed).length;
  const totalEvents = events.length;
  const completionRate = totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;

  return {
    totalMinutes,
    averagePerDay,
    completedEvents,
    totalEvents,
    completionRate
  };
}

// =====================================================================================
// LEGACY COMPATIBILITY
// =====================================================================================

// Re-export for backward compatibility
export { PlannerCalculationService as PlannerV2CalculationService };
