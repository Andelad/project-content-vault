import React, { memo } from 'react';
import { calculateTimelineColumnMarkerData } from '@/services';

interface TimelineColumnMarkersProps {
  dates: Date[];
  mode?: 'days' | 'weeks';
}

export const TimelineColumnMarkers = memo(function TimelineColumnMarkers({ dates, mode = 'days' }: TimelineColumnMarkersProps) {
  // Use service to calculate column marker data
  const columnData = calculateTimelineColumnMarkerData(dates, mode);
  
  // Add buffer for partial column in days mode
  const bufferWidth = mode === 'days' ? columnData[0]?.columnWidth || 52 : 0;
  
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ minWidth: `${dates.length * columnData[0]?.columnWidth + bufferWidth}px`, zIndex: 10 }}>
      <div className="flex h-full">
        {columnData.map((column) => {
          if (column.mode === 'weeks') {
            return (
              <div 
                key={`week-${column.index}`} 
                className={`h-full relative ${column.isNewMonth ? 'border-l-2 border-gray-300' : column.isNewWeek ? 'border-l border-gray-200' : ''}`}
                style={{
                  minWidth: `${column.columnWidth}px`,
                  width: `${column.columnWidth}px`
                }}
              >
                {/* Today column overlay */}
                {column.isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      backgroundColor: 'oklch(0.92 0.05 232 / 0.5)',
                      zIndex: 2,
                      left: `${column.todayPositionPx}px`,
                      width: '22px'
                    }}
                  />
                )}

                {/* Today position line within week */}
                {column.isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed"
                    style={{
                      left: `${column.todayPositionPx}px`,
                      zIndex: 5,
                      borderColor: 'oklch(0.50 0.127 232)'
                    }}
                  />
                )}
              </div>
            );
          } else {
            // Days mode
            return (
              <div 
                key={`day-${column.index}`} 
                className={`h-full relative ${column.isNewMonth ? 'border-l-2 border-gray-300' : column.isNewWeek ? 'border-l border-gray-200' : ''}`}
                style={{ 
                  minWidth: `${column.columnWidth}px`,
                  width: `${column.columnWidth}px`
                }} 
              >
                {/* Today column overlay */}
                {column.isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      backgroundColor: 'oklch(0.92 0.05 232 / 0.5)',
                      zIndex: 2,
                      left: '0px',
                      width: '100%'
                    }}
                  />
                )}
                
                {/* Today position line */}
                {column.isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed"
                    style={{
                      left: '0px',
                      zIndex: 5,
                      borderColor: 'oklch(0.50 0.127 232)'
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