import React, { memo } from 'react';
import { normalizeToMidnight, addDaysToDate, UnifiedTimelineService } from '@/services';
import { NEUTRAL_COLORS } from '@/constants/colors';

interface TimelineBackgroundProps {
  dates: Date[];
  mode: 'days' | 'weeks';
  holidays?: Array<{ id: string; startDate: Date | string; endDate?: Date | string | null }>;
}

/**
 * TimelineBackground - Renders all timeline overlays (borders, today, weekends, holidays)
 * Combines the functionality of previous TimelineColumnMarkers and TimelineOverlays
 * This component handles both the main timeline and availability card overlays
 */
export const TimelineBackground = memo(function TimelineBackground({ dates, mode, holidays }: TimelineBackgroundProps) {
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
                  backgroundColor: 'oklch(0.92 0.05 232 / 0.5)',
                  zIndex: 2
                }}
              />
            )}

            {/* Today position line */}
            {column.isToday && (
              <div 
                className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed"
                style={{
                  left: column.mode === 'weeks' ? `${column.todayPositionPx}px` : '0px',
                  zIndex: 5,
                  borderColor: 'oklch(0.50 0.127 232)'
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
                    backgroundColor: 'rgba(229, 229, 229, 0.35)',
                    pointerEvents: 'none',
                    zIndex: 3
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
                backgroundColor: 'rgba(163, 163, 163, 0.35)',
                pointerEvents: 'none',
                zIndex: 3
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
        
        // Using NEUTRAL_COLORS.gray500 with 20% opacity (33 in hex)
        const backgroundPattern = mode === 'weeks' 
          ? `repeating-linear-gradient(-45deg, ${NEUTRAL_COLORS.gray500}33 0 1.5px, transparent 1.5px 4px)`
          : `repeating-linear-gradient(-45deg, ${NEUTRAL_COLORS.gray500}33 0 2px, transparent 2px 6px)`;
        
        if (mode === 'weeks') {
          // Week mode - render holiday overlay for each day in affected weeks
          const holidayOverlays = [];
          
          dates.forEach((date, dateIndex) => {
            const dayOfWeek = date.getDay();
            const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
            const weekStart = addDaysToDate(date, daysToMonday);
            
            // Check each day in this week
            for (let i = 0; i < 7; i++) {
              const currentDay = addDaysToDate(weekStart, i);
              const normalizedCurrentDay = normalizeToMidnight(currentDay);
              
              // Check if this day falls within the holiday range
              if (normalizedCurrentDay >= normalizedHolidayStart && normalizedCurrentDay <= normalizedHolidayEnd) {
                holidayOverlays.push(
                  <div
                    key={`holiday-${holiday.id}-${dateIndex}-${i}`}
                    className="absolute top-0"
                    style={{
                      left: `${dateIndex * 153 + i * 22}px`,
                      width: '22px',
                      height: '100%',
                      backgroundImage: backgroundPattern,
                      pointerEvents: 'none'
                    }}
                  />
                );
              }
            }
          });
          
          return holidayOverlays;
        } else {
          // Days mode - render holiday overlay for matching dates
          const holidayOverlays = [];
          
          dates.forEach((date, dateIndex) => {
            const normalizedDate = normalizeToMidnight(date);
            
            // Check if this date falls within the holiday range
            if (normalizedDate >= normalizedHolidayStart && normalizedDate <= normalizedHolidayEnd) {
              holidayOverlays.push(
                <div
                  key={`holiday-${holiday.id}-${dateIndex}`}
                  className="absolute top-0"
                  style={{
                    left: `${dateIndex * 52}px`,
                    width: '52px',
                    height: '100%',
                    backgroundImage: backgroundPattern,
                    pointerEvents: 'none'
                  }}
                />
              );
            }
          });
          
          return holidayOverlays;
        }
      })}
    </div>
  );
});
