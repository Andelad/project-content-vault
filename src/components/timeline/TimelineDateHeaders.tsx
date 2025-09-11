import React, { memo } from 'react';
import { HoverableDateCell } from './HoverableDateCell';
import { formatMonthYear } from '@/utils/dateFormatUtils';
import { UnifiedTimelineService } from '@/services';

interface TimelineDateHeadersProps {
  dates: Date[];
  mode?: 'days' | 'weeks';
}

export const TimelineDateHeaders = memo(function TimelineDateHeaders({ dates, mode = 'days' }: TimelineDateHeadersProps) {
  if (mode === 'weeks') {
    // Group dates by month to create sticky headers using service
    const monthGroups = UnifiedTimelineService.groupDatesByMonth(dates);

    return (
      <div className="h-12 border-b border-gray-200 bg-gray-50 relative">
        {/* Sticky month labels layer - positioned at top */}
        <div className="absolute top-0 left-0 right-0 h-6 overflow-hidden">
          {monthGroups.map((group, groupIndex) => {
            const isToday = dates.some((weekStart, index) => {
              if (index >= group.startIndex && index <= group.endIndex) {
                return UnifiedTimelineService.isTodayInWeek(weekStart);
              }
              return false;
            });
            
            // Calculate the width and position of this month section in pixels (77px per week column)
            const monthWidthPx = (group.endIndex - group.startIndex + 1) * 77;
            const leftPositionPx = group.startIndex * 77;
            
            return (
              <div
                key={`month-group-${groupIndex}`}
                className="absolute top-0 h-full"
                style={{
                  left: `${leftPositionPx}px`,
                  width: `${monthWidthPx}px`,
                }}
              >
                <div 
                  className="sticky left-0 bg-gray-50 h-full flex items-center z-10"
                  style={{ 
                    width: 'fit-content',
                    minWidth: '120px',
                    maxWidth: '200px'
                  }}
                >
                  <div className={`text-xs pl-4 pr-4 py-1 whitespace-nowrap ${isToday ? 'font-medium text-blue-600' : 'text-gray-600'}`}>
                    {group.monthName}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Week date ranges layer - aligned to bottom */}
        <div className="flex h-full items-end pb-2" style={{ minWidth: 'fit-content' }}>
          {dates.map((weekStart, index) => {
            const isCurrentWeek = UnifiedTimelineService.isTodayInWeek(weekStart);
            
            // Format the date range using service
            const dateRange = UnifiedTimelineService.formatWeekDateRange(weekStart);
            
            return (
              <div key={index} className="text-center" style={{ minWidth: '77px', width: '77px' }}>
                <HoverableDateCell date={weekStart} mode={mode} width={77}>
                  <div className={`text-xs px-1 ${isCurrentWeek ? 'font-medium text-blue-600' : 'text-gray-700'}`}>
                    {dateRange}
                  </div>
                </HoverableDateCell>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Original days mode logic using service
  const monthGroups = UnifiedTimelineService.groupDatesByMonth(dates);

  return (
    <div className="h-12 border-b border-gray-200 bg-gray-50 relative">
      {/* Sticky month labels layer - positioned at top */}
      <div className="absolute top-0 left-0 right-0 h-6 overflow-hidden">
        {monthGroups.map((group, groupIndex) => {
          const isToday = dates.some((date, index) => 
            index >= group.startIndex && 
            index <= group.endIndex && 
            UnifiedTimelineService.isTodayDate(date)
          );
          const hasWeekend = dates.some((date, index) => {
            if (index >= group.startIndex && index <= group.endIndex) {
              return UnifiedTimelineService.isWeekendDate(date);
            }
            return false;
          });
          
          // Calculate the width and position of this month section in pixels
          const monthWidthPx = (group.endIndex - group.startIndex + 1) * 40; // 40px per column
          const leftPositionPx = group.startIndex * 40; // 40px per column
          
          return (
            <div
              key={`month-group-${groupIndex}`}
              className="absolute top-0 h-full"
              style={{
                left: `${leftPositionPx}px`,
                width: `${monthWidthPx}px`,
              }}
            >
              <div 
                className="sticky left-0 bg-gray-50 h-full flex items-center z-10"
                style={{ 
                  width: 'fit-content',
                  minWidth: '120px',
                  maxWidth: '200px'
                }}
              >
                <div className={`text-xs pl-4 pr-4 py-1 whitespace-nowrap ${isToday ? 'font-medium text-blue-600' : hasWeekend ? 'text-gray-400' : 'text-gray-600'}`}>
                  {group.monthName}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Date numbers layer - aligned to bottom */}
      <div className="flex h-full items-end pb-2" style={{ minWidth: 'fit-content' }}>
        {dates.map((date, index) => {
          const isToday = UnifiedTimelineService.isTodayDate(date);
          const isWeekend = UnifiedTimelineService.isWeekendDate(date);
          
          return (
            <div key={index} className="text-center" style={{ minWidth: '40px', width: '40px' }}>
              <HoverableDateCell date={date} mode={mode} width={40}>
                <div className={`text-xs ${isToday ? 'font-medium text-blue-600 bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center mx-auto' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                  {date.getDate()}
                </div>
              </HoverableDateCell>
            </div>
          );
        })}
      </div>
    </div>
  );
});