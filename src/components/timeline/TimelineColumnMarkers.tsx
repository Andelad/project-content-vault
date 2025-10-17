import React, { memo } from 'react';
import { UnifiedTimelineService } from '@/services';

interface TimelineColumnMarkersProps {
  dates: Date[];
  mode?: 'days' | 'weeks';
}

export const TimelineColumnMarkers = memo(function TimelineColumnMarkers({ dates, mode = 'days' }: TimelineColumnMarkersProps) {
  // Use service to calculate column marker data
  const columnData = UnifiedTimelineService.calculateColumnMarkerData(dates, mode);
  
  // Add buffer for partial column in days mode
  const bufferWidth = mode === 'days' ? columnData[0]?.columnWidth || 40 : 0;
  
  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{ minWidth: `${dates.length * columnData[0]?.columnWidth + bufferWidth}px` }}>
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
                {/* Weekend day overlays inside week column */}
                {column.weekendDays.map((weekendDay, dayIndex) => (
                  <React.Fragment key={`week-${column.index}-day-${dayIndex}`}>
                    <div
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        left: `${weekendDay.leftPx}px`,
                        width: `${weekendDay.dayWidthPx}px`,
                        backgroundColor: 'rgba(229, 231, 235, 0.15)',
                        zIndex: 1
                      }}
                    />
                  </React.Fragment>
                ))}

                {/* Today column overlay */}
                {column.isToday && (
                  <div 
                    className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none"
                    style={{
                      backgroundColor: 'rgba(219, 234, 254, 0.4)',
                      zIndex: 2
                    }}
                  />
                )}

                {/* Today position line within week */}
                {column.isToday && (
                  <div 
                    className="absolute top-0 bottom-0 pointer-events-none border-l-2 border-dashed border-gray-500"
                    style={{
                      left: `${column.todayPositionPx}px`,
                      zIndex: 5
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
                  backgroundColor: column.isWeekend ? 'rgba(156, 163, 175, 0.15)' : 'transparent',
                  minWidth: `${column.columnWidth}px`,
                  width: `${column.columnWidth}px`
                }} 
              >
                {/* Today column overlay */}
                {column.isToday && (
                  <div 
                    className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none"
                    style={{
                      backgroundColor: 'rgba(219, 234, 254, 0.4)',
                      zIndex: 2
                    }}
                  />
                )}
                
                {/* Today position line */}
                {column.isToday && (
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