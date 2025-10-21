import React, { useMemo, useEffect, useState } from 'react';
import moment from 'moment';
import { Card } from '../ui/card';
import { CalendarEvent } from '../../types';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { calculateEventDurationOnDate, aggregateEventDurationsByDate } from '@/services';
import { formatDuration } from '@/services';
// Keep the original import for now to avoid breaking changes
import { calculateEventDurationOnDateLegacy as originalCalculateEventDurationOnDate } from '@/services';
import { calculateDurationMinutes } from '@/services';

interface CalendarInsightCardProps {
  dates: Date[];
  events: CalendarEvent[];
  view: 'week' | 'day';
}

export function PlannerInsightCard({ dates, events, view }: CalendarInsightCardProps) {
  const { isTimeTracking } = useSettingsContext();
  const [now, setNow] = useState(new Date());

  // Find currently tracking event
  const currentTrackingEvent = useMemo(() => {
    if (!isTimeTracking) return null;
    return events.find(event => 
      event.type === 'tracked' || event.title?.startsWith('🔴')
    );
  }, [events, isTimeTracking]);

  // Update current time every second when tracking
  useEffect(() => {
    if (!isTimeTracking) return;
    
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isTimeTracking]);

  // Calculate total time for each day
  const dailyTotals = useMemo(() => {
    const totals: { [key: string]: number } = {};
    
    dates.forEach(date => {
      const dateKey = moment(date).format('YYYY-MM-DD');
      totals[dateKey] = 0;
      
      // Add completed events for this day using proper midnight-crossing calculation
      events.forEach(event => {
        if (event.completed) {
          const durationHours = originalCalculateEventDurationOnDate(event, date);
          if (durationHours > 0) {
            // Convert to minutes and round to avoid decimal minutes
            // Use the already-calculated durationHours which is specific to this date
            const durationMinutes = Math.round(durationHours * 60);
            totals[dateKey] += durationMinutes;
          }
        }
      });
      
      // Add currently tracking time if it's for this date
      if (isTimeTracking && currentTrackingEvent) {
        const trackingDurationHours = originalCalculateEventDurationOnDate(currentTrackingEvent, date);
        if (trackingDurationHours > 0) {
          // For tracking events, add the live duration
          const trackingStart = moment(currentTrackingEvent.startTime);
          const elapsedMinutes = moment(now).diff(trackingStart, 'minutes');
          
          // Calculate how much of the elapsed time is on this specific date
          const trackingDateStart = moment(date).startOf('day');
          const trackingDateEnd = moment(date).endOf('day');
          const effectiveStart = moment.max(trackingStart, trackingDateStart);
          const effectiveEnd = moment.min(moment(now), trackingDateEnd);
          
          if (effectiveEnd.isAfter(effectiveStart)) {
            const dailyElapsedMinutes = effectiveEnd.diff(effectiveStart, 'minutes');
            totals[dateKey] += dailyElapsedMinutes;
          }
        }
      }
    });
    
    return totals;
  }, [dates, events, isTimeTracking, currentTrackingEvent, now]);

  // Format time for display
  const formatTime = (minutes: number) => {
    return formatDuration(minutes / 60);
  };

  return (
    <Card className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="flex h-12">
        {/* Left label area - matches calendar time gutter width approximately */}
        <div className="w-20 flex items-center justify-start pl-4 border-r border-gray-100 bg-gray-50">
          <span className="text-xs font-medium text-gray-600">Total time</span>
        </div>
        
        {/* Data columns - align with calendar day columns */}
        <div className="flex-1 flex relative">
          {dates.map((date, index) => {
            const dateKey = moment(date).format('YYYY-MM-DD');
            const totalMinutes = dailyTotals[dateKey] || 0;
            
            return (
              <div
                key={dateKey}
                className="flex-1 flex items-center justify-center border-r border-gray-100 last:border-r-0 bg-white"
              >
                <span className="text-xs font-medium text-gray-900">
                  {totalMinutes > 0 ? formatTime(totalMinutes) : '0m'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
