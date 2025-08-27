import React, { useMemo, useEffect, useState } from 'react';
import moment from 'moment';
import { Card } from './ui/card';
import { CalendarEvent } from '../types';
import { useSettingsContext } from '../contexts/SettingsContext';
import { calculateDailyTotals } from '@/services/calendarInsightService';
import { formatTimeMinutes } from '@/services';

interface CalendarInsightCardProps {
  dates: Date[];
  events: CalendarEvent[];
  view: 'week' | 'day';
}

export function CalendarInsightCard({ dates, events, view }: CalendarInsightCardProps) {
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
    const eventsWithCompleted = events.map(event => ({
      ...event,
      completed: event.completed ?? false
    }));
    return calculateDailyTotals(dates, eventsWithCompleted, {
      isTimeTracking,
      currentTrackingEvent: currentTrackingEvent ? {
        ...currentTrackingEvent,
        completed: currentTrackingEvent.completed ?? false
      } : null,
      currentTime: now
    });
  }, [dates, events, isTimeTracking, currentTrackingEvent, now]);

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
                  {totalMinutes > 0 ? formatTimeMinutes(totalMinutes) : '0m'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
