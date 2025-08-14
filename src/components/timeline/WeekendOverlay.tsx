import React, { memo } from 'react';

interface WeekendOverlayProps {
  dates: Date[];
  mode?: 'days' | 'weeks';
}

export const WeekendOverlay = memo(function WeekendOverlay({ dates, mode = 'days' }: WeekendOverlayProps) {
  const columnWidth = mode === 'weeks' ? 72 : 40;
  
  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{ minWidth: `${dates.length * columnWidth}px` }}>
      <div className="flex h-full">
        {dates.map((date, index) => {
          if (mode === 'weeks') {
            // Week mode: show month separators and week separators
            const prevDate = index > 0 ? dates[index - 1] : null;
            const isNewMonth = index > 0 && prevDate && date.getMonth() !== prevDate.getMonth();
            const isNewWeek = index > 0; // Every column is a new week in weeks mode
            
            return (
              <div 
                key={`week-${index}`} 
                className={`h-full ${isNewMonth ? 'border-l-2 border-gray-300' : isNewWeek ? 'border-l border-gray-200' : ''}`}
                style={{ 
                  minWidth: `${columnWidth}px`,
                  width: `${columnWidth}px`
                }} 
              />
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
                className={`h-full ${isNewMonth ? 'border-l-2 border-gray-300' : isNewWeek ? 'border-l border-gray-200' : ''}`}
                style={{ 
                  backgroundColor: isWeekend ? 'rgba(156, 163, 175, 0.15)' : 'transparent',
                  minWidth: `${columnWidth}px`,
                  width: `${columnWidth}px`
                }} 
              />
            );
          }
        })}
      </div>
    </div>
  );
});