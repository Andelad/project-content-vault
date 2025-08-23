import React, { useMemo, useEffect, useState } from 'react';
import moment from 'moment';
import { Card } from './ui/card';
import { CalendarEvent } from '../types';
import { useApp } from '../contexts/AppContext';

interface CalendarInsightCardProps {
  dates: Date[];
  events: CalendarEvent[];
  view: 'week' | 'day';
}

export function PlannerInsightCard({ dates, events, view }: CalendarInsightCardProps) {
  const { isTimeTracking } = useApp();
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
          const elapsedMinutes = moment(now).diff(trackingStart, 'minutes');
          totals[dateKey] += elapsedMinutes;
        }
      }
    });
    
    return totals;
  }, [dates, events, isTimeTracking, currentTrackingEvent, now]);

  // Format time for display
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
      return `${mins}m`;
    }
    return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
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
