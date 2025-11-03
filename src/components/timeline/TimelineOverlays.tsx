import React, { memo } from 'react';
import { normalizeToMidnight, addDaysToDate, UnifiedTimelineService } from '@/services';

interface TimelineOverlaysProps {
  dates: Date[];
  mode: 'days' | 'weeks';
  holidays?: Array<{ id: string; startDate: Date | string; endDate?: Date | string | null }>;
}

/**
 * TimelineOverlays - Renders all timeline overlays (borders, today, weekends, holidays)
 * Combines the functionality of previous TimelineColumnMarkers and TimelineOverlays
 * This component handles both the main timeline and availability card overlays
 */
export const TimelineOverlays = memo(function TimelineOverlays({ dates, mode, holidays }: TimelineOverlaysProps) {
  const columnWidth = mode === 'weeks' ? 153 : 52;
  const dayWidth = mode === 'weeks' ? 22 : columnWidth; // 22px effective spacing (21px + 1px gap)
  
  // Use service to calculate column marker data (borders, today indicator)
  const columnData = UnifiedTimelineService.calculateColumnMarkerData(dates, mode);
  const bufferWidth = mode === 'days' ? columnData[0]?.columnWidth || 52 : 0;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ minWidth: `${dates.length * columnData[0]?.columnWidth + bufferWidth}px`, zIndex: 10 }}>
      {/* Column markers with borders and today indicator */}
      <div className="flex h-full">
        {columnData.map((column) => (
          <div 
            key={column.mode === 'weeks' ? `week-${column.index}` : `day-${column.index}`}
            className={`h-full relative ${column.isNewMonth ? 'border-l-2 border-gray-300' : column.isNewWeek ? 'border-l border-gray-200' : ''}`}
            style={{
              minWidth: `${column.columnWidth}px`,
              width: `${column.columnWidth}px`
            }}
          >
            {/* Today column overlay */}
            {column.isToday && (
              <div 
                className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none"
                style={{
                  backgroundColor: 'rgba(147, 197, 253, 0.15)',
                  zIndex: 2
                }}
              />
            )}

            {/* Today position line */}
            {column.isToday && (
              <div 
                className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed border-gray-500"
                style={{
                  left: column.mode === 'weeks' ? `${column.todayPositionPx}px` : '0px',
                  zIndex: 5
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Weekend overlays */}
      {dates.map((date, dateIndex) => {
        if (mode === 'weeks') {
          // Week mode - render weekend overlays for each day in the week
          const dayOfWeek = date.getDay();
          const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
          const weekStart = addDaysToDate(date, daysToMonday);
          
          // Find Saturday and Sunday positions in this week
          const weekendOverlays = [];
          for (let i = 0; i < 7; i++) {
            const currentDay = addDaysToDate(weekStart, i);
            const dow = currentDay.getDay();
            if (dow === 0 || dow === 6) { // Sunday or Saturday
              weekendOverlays.push(
                <div
                  key={`weekend-${dateIndex}-${i}`}
                  className="absolute top-0"
                  style={{
                    left: `${dateIndex * 153 + i * 22}px`,
                    width: '22px',
                    height: '100%',
                    backgroundColor: 'rgba(229, 229, 229, 0.15)',
                    pointerEvents: 'none'
                  }}
                />
              );
            }
          }
          return weekendOverlays;
        } else {
          // Days mode - check if this date is a weekend
          const dayOfWeek = date.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) return null;
          
          return (
            <div
              key={`weekend-${dateIndex}`}
              className="absolute top-0"
              style={{
                left: `${dateIndex * 52}px`,
                width: '52px',
                height: '100%',
                backgroundColor: 'rgba(163, 163, 163, 0.15)',
                pointerEvents: 'none'
              }}
            />
          );
        }
      })}
      
      {/* Holiday overlays */}
      {holidays && holidays.length > 0 && holidays.map(holiday => {
        const holidayStart = new Date(holiday.startDate);
        const holidayEnd = new Date(holiday.endDate || holiday.startDate);
        const normalizedHolidayStart = normalizeToMidnight(holidayStart);
        const normalizedHolidayEnd = normalizeToMidnight(holidayEnd);
        
        const timelineStart = normalizeToMidnight(new Date(dates[0]));
        const msPerDay = 24 * 60 * 60 * 1000;
        
        const startDay = Math.floor((normalizedHolidayStart.getTime() - timelineStart.getTime()) / msPerDay);
        const endDay = Math.floor((normalizedHolidayEnd.getTime() - timelineStart.getTime()) / msPerDay);
        const holidayLeftPx = startDay * dayWidth;
        const holidayWidthPx = (endDay - startDay + 1) * dayWidth;
        
        const backgroundPattern = mode === 'weeks' 
          ? 'repeating-linear-gradient(-45deg, rgba(107,114,128,0.16) 0 1.5px, transparent 1.5px 4px)'
          : 'repeating-linear-gradient(-45deg, rgba(107,114,128,0.16) 0 2px, transparent 2px 6px)';
        
        return (
          <div
            key={`holiday-${holiday.id}`}
            className="absolute top-0"
            style={{
              left: `${holidayLeftPx}px`,
              width: `${holidayWidthPx}px`,
              height: '100%',
              backgroundImage: backgroundPattern,
              pointerEvents: 'none'
            }}
          />
        );
      })}
    </div>
  );
});
