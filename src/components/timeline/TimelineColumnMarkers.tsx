import React, { memo } from 'react';

interface TimelineColumnMarkersProps {
  dates: Date[];
  mode?: 'days' | 'weeks';
}

export const TimelineColumnMarkers = memo(function TimelineColumnMarkers({ dates, mode = 'days' }: TimelineColumnMarkersProps) {
  const columnWidth = mode === 'weeks' ? 77 : 40;
  const today = new Date();
  // Note: holiday overlays are rendered at row level in TimelineView so markers stay behind project bars
  
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
                {/* Weekend day overlays inside week column (show Saturday/Sunday slices) */}
                {Array.from({ length: 7 }).map((_, dayOffset) => {
                  const dayDate = new Date(date);
                  dayDate.setDate(date.getDate() + dayOffset);
                  const dayOfWeek = dayDate.getDay();
                  const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
                  if (!isWeekendDay) return null;

                  const leftPx = (dayOffset / 7) * columnWidth;
                  const dayWidthPx = 11; // Exact 11px per day (77px ÷ 7 days)

                  return (
                    <React.Fragment key={`week-${index}-day-${dayOffset}`}>
                      <div
                        className="absolute top-0 bottom-0 pointer-events-none"
                        style={{
                          left: `${leftPx}px`,
                          width: `${dayWidthPx}px`,
                          backgroundColor: 'rgba(229, 231, 235, 0.15)',
                          zIndex: 1
                        }}
                      />

                      {/* no-op: holiday overlays are rendered at row level */}
                    </React.Fragment>
                  );
                })}

                {/* Today column overlay - blue transparent background similar to date circle */}
                {isToday && (
                  <div 
                    className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none"
                    style={{
                      backgroundColor: 'rgba(219, 234, 254, 0.4)', // bg-blue-100 with 40% opacity
                      zIndex: 2
                    }}
                  />
                )}

                {isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed border-gray-500"
                    style={{
                      left: (() => {
                        // Calculate position within the week for today
                        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
                        const daysFromWeekStart = (dayOfWeek + 6) % 7; // Convert to Monday = 0 system
                        return `${(daysFromWeekStart / 7) * columnWidth}px`;
                      })(),
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
                {/* Today column overlay - blue transparent background similar to date circle */}
                {isToday && (
                  <div 
                    className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none"
                    style={{
                      backgroundColor: 'rgba(219, 234, 254, 0.4)', // bg-blue-100 with 40% opacity
                      zIndex: 2
                    }}
                  />
                )}
                
                {/* no-op: holiday overlays are rendered at row level */}
                {isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed border-gray-500"
                    style={{
                      left: '0px',
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