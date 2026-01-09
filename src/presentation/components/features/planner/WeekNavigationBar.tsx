import React, { useMemo } from 'react';
import { cn } from '@/presentation/app/lib/utils';

interface WeekNavigationBarProps {
  /** The start date of the currently visible range */
  visibleStartDate: Date;
  /** The end date of the currently visible range (exclusive) */
  visibleEndDate: Date;
  /** The start date of the week we're navigating within */
  weekStartDate: Date;
  /** Number of days currently visible (2 on mobile, 3 on tablet, 7 on desktop) */
  visibleDayCount: number;
  /** Callback when a day is clicked */
  onDayClick: (date: Date) => void;
  /** Whether to show the navigation bar (typically only on mobile/tablet) */
  show: boolean;
}

/**
 * WeekNavigationBar - Shows all 7 days of the week with indicators for currently visible days
 * Similar to iCal's mobile week navigation
 */
export function WeekNavigationBar({
  visibleStartDate,
  visibleEndDate,
  weekStartDate,
  visibleDayCount,
  onDayClick,
  show
}: WeekNavigationBarProps) {
  // Generate array of 7 days starting from the week start
  const weekDays = useMemo(() => {
    const days = [];
    const start = new Date(weekStartDate);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }
    
    return days;
  }, [weekStartDate]);

  // Check if a date is within the visible range
  const isVisible = (date: Date) => {
    const dateTime = date.getTime();
    const startTime = visibleStartDate.getTime();
    const endTime = visibleEndDate.getTime();
    
    return dateTime >= startTime && dateTime < endTime;
  };

  // Check if a date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (!show) return null;

  return (
    <div className="week-navigation-bar bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex justify-between items-center gap-1">
        {weekDays.map((date, index) => {
          const visible = isVisible(date);
          const today = isToday(date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNumber = date.getDate();

          return (
            <button
              key={index}
              onClick={() => onDayClick(date)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center rounded-lg transition-all duration-200",
                "min-w-0 py-2 px-1",
                visible && "bg-blue-50 ring-2 ring-blue-500 ring-inset",
                !visible && "hover:bg-gray-50",
                today && !visible && "text-blue-600 font-semibold"
              )}
              aria-label={`Navigate to ${date.toDateString()}`}
              aria-pressed={visible}
            >
              <span className={cn(
                "text-xs uppercase leading-none mb-1",
                visible ? "text-blue-700 font-semibold" : "text-gray-500"
              )}>
                {dayName.substring(0, 1)}
              </span>
              <span className={cn(
                "text-sm leading-none font-medium",
                visible ? "text-blue-700" : today ? "text-blue-600" : "text-gray-700"
              )}>
                {dayNumber}
              </span>
              {/* Indicator dot for visible days */}
              {visible && (
                <div className="mt-1 w-1 h-1 rounded-full bg-blue-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
