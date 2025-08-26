import React, { memo } from 'react';

interface TimelineColumnMarkersProps {
  dates: Date[];
  mode?: 'days' | 'weeks';
}

export const TimelineColumnMarkers = memo(function TimelineColumnMarkers({ dates, mode = 'days' }: TimelineColumnMarkersProps) {
  const columnWidth = mode === 'weeks' ? 77 : 40;
  const today = new Date();
  
  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{ minWidth: `${dates.length * columnWidth}px` }}>
      <div className="flex h-full">
        {dates.map((date, index) => {
          // Check if this column represents today
          let isToday = false;
          if (mode === 'days') {
            isToday = date.toDateString() === today.toDateString();
          } else {
            // Weeks mode: check if today falls within this week
            const weekEnd = new Date(date);
            weekEnd.setDate(date.getDate() + 6);
            isToday = today >= date && today <= weekEnd;
          }
          
          if (mode === 'weeks') {
            // Week mode: show month separators and week separators
            const prevDate = index > 0 ? dates[index - 1] : null;
            const isNewMonth = index > 0 && prevDate && date.getMonth() !== prevDate.getMonth();
            const isNewWeek = index > 0; // Every column is a new week in weeks mode
            
            return (
              <div 
                key={`week-${index}`} 
                className={`h-full relative ${isNewMonth ? 'border-l-2 border-gray-300' : isNewWeek ? 'border-l border-gray-200' : ''}`}
                style={{ 
                  minWidth: `${columnWidth}px`,
                  width: `${columnWidth}px`
                }} 
              >
                {isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: (() => {
                        // Calculate position within the week for today
                        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
                        const daysFromWeekStart = (dayOfWeek + 6) % 7; // Convert to Monday = 0 system
                        return `${(daysFromWeekStart / 7) * columnWidth}px`;
                      })(),
                      width: '2px',
                      backgroundColor: 'rgb(219 234 254)', // bg-blue-100 color
                      zIndex: 5
                    }}
                  />
                )}
              </div>
            );
          } else {
            // Days mode: show weekend highlights and month separators
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const prevDate = index > 0 ? dates[index - 1] : null;
            const isNewMonth = index > 0 && prevDate && date.getMonth() !== prevDate.getMonth();
            const isNewWeek = index > 0 && prevDate && dayOfWeek === 1; // Monday starts new week
            
            return (
              <div 
                key={`weekend-${index}`} 
                className={`h-full relative ${isNewMonth ? 'border-l-2 border-gray-300' : isNewWeek ? 'border-l border-gray-200' : ''}`}
                style={{ 
                  backgroundColor: isWeekend ? 'rgba(156, 163, 175, 0.15)' : 'transparent',
                  minWidth: `${columnWidth}px`,
                  width: `${columnWidth}px`
                }} 
              >
                {isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      left: '0px',
                      width: '2px',
                      backgroundColor: 'rgb(219 234 254)', // bg-blue-100 color
                      zIndex: 5
                    }}
                  />
                )}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
});