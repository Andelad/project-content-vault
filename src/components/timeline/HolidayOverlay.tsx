import React, { memo, useMemo } from 'react';
import { useApp } from '../../contexts/AppContext';

interface HolidayOverlayProps {
  dates: Date[];
  type?: 'projects' | 'availability';
  mode?: 'days' | 'weeks';
}

interface HolidaySpan {
  startIndex: number;
  endIndex: number;
  holiday: any;
}

export const HolidayOverlay = memo(function HolidayOverlay({ dates, type = 'projects', mode = 'days' }: HolidayOverlayProps) {
  const { holidays } = useApp();
  const columnWidth = mode === 'weeks' ? 72 : 40;

  // Calculate holiday spans - different logic for days vs weeks
  const holidaySpans = useMemo(() => {
    if (mode === 'days') {
      // Days mode - simple continuous spans
      const spans: HolidaySpan[] = [];
      
      holidays.forEach(holiday => {
        // Normalize holiday dates to remove time components
        const startDate = new Date(holiday.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(holiday.endDate);
        endDate.setHours(0, 0, 0, 0);
        
        let startIndex = -1;
        let endIndex = -1;
        
        dates.forEach((date, index) => {
          // Normalize timeline date for comparison
          const normalizedDate = new Date(date);
          normalizedDate.setHours(0, 0, 0, 0);
          
          if (normalizedDate >= startDate && normalizedDate <= endDate) {
            if (startIndex === -1) {
              startIndex = index;
            }
            endIndex = index;
          }
        });
        
        if (startIndex !== -1 && endIndex !== -1) {
          spans.push({
            startIndex,
            endIndex,
            holiday
          });
        }
      });
      
      return spans;
    } else {
      // Weeks mode - create individual day segments within week columns
      const daySegments: Array<{
        weekIndex: number;
        dayOfWeek: number; // 0-6 (Sun-Sat)
        holiday: any;
      }> = [];
      
      dates.forEach((weekStartDate, weekIndex) => {
        // Get all 7 days for this week
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStartDate);
          date.setDate(weekStartDate.getDate() + i);
          date.setHours(0, 0, 0, 0); // Normalize time component
          weekDates.push(date);
        }
        
        // Check each day in the week against all holidays
        weekDates.forEach((date, dayOfWeek) => {
          holidays.forEach(holiday => {
            // Normalize holiday dates to remove time components
            const startDate = new Date(holiday.startDate);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(holiday.endDate);
            endDate.setHours(0, 0, 0, 0);
            
            if (date >= startDate && date <= endDate) {
              daySegments.push({
                weekIndex,
                dayOfWeek,
                holiday
              });
            }
          });
        });
      });
      
      return daySegments;
    }
  }, [holidays, dates, mode]);

  const patternClass = type === 'availability' ? 'holiday-pattern-availability' : 'holiday-pattern';

  if (mode === 'days') {
    // Days mode - render continuous spans
    if (holidaySpans.length === 0) {
      return null;
    }

    return (
      <div className="absolute inset-0 pointer-events-none flex">
        {(holidaySpans as HolidaySpan[]).map((span, spanIndex) => {
          const getColumnLeftPosition = (index: number) => {
            return index * columnWidth;
          };
          
          const leftPositionPx = getColumnLeftPosition(span.startIndex);
          const rightPositionPx = getColumnLeftPosition(span.endIndex) + columnWidth;
          const widthPx = rightPositionPx - leftPositionPx;
          
          return (
            <div
              key={`holiday-span-${spanIndex}-${span.holiday.id}`}
              className={`absolute inset-y-0 ${patternClass} z-20 pointer-events-none`}
              style={{
                left: `${leftPositionPx}px`,
                width: `${widthPx}px`
              }}
            />
          );
        })}
      </div>
    );
  } else {
    // Weeks mode - render individual day segments within week columns
    if (holidaySpans.length === 0) {
      return null;
    }

    const daySegments = holidaySpans as Array<{
      weekIndex: number;
      dayOfWeek: number;
      holiday: any;
    }>;

    return (
      <div className="absolute inset-0 pointer-events-none flex">
        {daySegments.map((segment, segmentIndex) => {
          // Calculate position within the week column
          const weekColumnLeft = segment.weekIndex * columnWidth; // 72px per week
          const dayWidth = columnWidth / 7; // ~10.3px per day
          const dayLeft = segment.dayOfWeek * dayWidth;
          
          const leftPositionPx = weekColumnLeft + dayLeft;
          const widthPx = dayWidth;
          
          return (
            <div
              key={`holiday-day-${segmentIndex}-${segment.holiday.id}-${segment.weekIndex}-${segment.dayOfWeek}`}
              className={`absolute inset-y-0 ${patternClass} z-20 pointer-events-none`}
              style={{
                left: `${leftPositionPx}px`,
                width: `${widthPx}px`
              }}
            />
          );
        })}
      </div>
    );
  }
});