/**
 * Calendar insight calculations
 * Extracted from CalendarInsightCard component
 */

import moment from 'moment';

export interface CalendarEvent {
  startTime: string | Date;
  endTime: string | Date;
  completed: boolean;
}

export interface CalendarInsightOptions {
  isTimeTracking?: boolean;
  currentTrackingEvent?: CalendarEvent | null;
  currentTime?: Date;
}

/**
 * Calculate total time worked for each day
 */
export function calculateDailyTotals(
  dates: Date[],
  events: CalendarEvent[],
  options: CalendarInsightOptions = {}
): { [key: string]: number } {
  const { isTimeTracking = false, currentTrackingEvent = null, currentTime = new Date() } = options;
  const totals: { [key: string]: number } = {};
  
  dates.forEach(date => {
    const dateKey = moment(date).format('YYYY-MM-DD');
    totals[dateKey] = 0;
    
    // Add completed events for this day
    events.forEach(event => {
      const eventStart = moment(event.startTime);
      const eventEnd = moment(event.endTime);
      const eventDate = eventStart.format('YYYY-MM-DD');
      
      if (eventDate === dateKey && event.completed) {
        const duration = eventEnd.diff(eventStart, 'minutes');
        totals[dateKey] += duration;
      }
    });
    
    // Add currently tracking time if it's for today
    if (isTimeTracking && currentTrackingEvent) {
      const trackingStart = moment(currentTrackingEvent.startTime);
      const trackingDate = trackingStart.format('YYYY-MM-DD');
      
      if (trackingDate === dateKey) {
        const elapsedMinutes = moment(currentTime).diff(trackingStart, 'minutes');
        totals[dateKey] += elapsedMinutes;
      }
    }
  });
  
  return totals;
}

/**
 * Calculate total minutes across all days
 */
export function calculateTotalMinutes(dailyTotals: { [key: string]: number }): number {
  return Object.values(dailyTotals).reduce((sum, minutes) => sum + minutes, 0);
}

/**
 * Calculate average minutes per day (excluding days with zero time)
 */
export function calculateAverageMinutesPerDay(dailyTotals: { [key: string]: number }): number {
  const nonZeroDays = Object.values(dailyTotals).filter(minutes => minutes > 0);
  if (nonZeroDays.length === 0) return 0;
  
  return Math.round(nonZeroDays.reduce((sum, minutes) => sum + minutes, 0) / nonZeroDays.length);
}

/**
 * Find the most productive day
 */
export function findMostProductiveDay(dailyTotals: { [key: string]: number }): { date: string; minutes: number } | null {
  const entries = Object.entries(dailyTotals);
  if (entries.length === 0) return null;
  
  const [bestDate, bestMinutes] = entries.reduce(
    (best, [date, minutes]) => minutes > best[1] ? [date, minutes] : best,
    ['', 0]
  );
  
  return bestMinutes > 0 ? { date: bestDate, minutes: bestMinutes } : null;
}
