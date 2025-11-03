import React, { memo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatMonthYear } from '@/utils/dateFormatUtils';
import { UnifiedTimelineService, addDaysToDate } from '@/services';
import { useTimelineContext } from '@/contexts/TimelineContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TimelineDateHeadersProps {
  dates: Date[];
  mode?: 'days' | 'weeks';
}

export const TimelineDateHeaders = memo(function TimelineDateHeaders({ dates, mode = 'days' }: TimelineDateHeadersProps) {
  const { setCurrentView, setCurrentDate } = useTimelineContext();
  const [hoveredCellIndex, setHoveredCellIndex] = useState<number | null>(null);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  const renderDateCell = (date: Date, cellIndex: number, width: number, children: React.ReactNode) => {
    const isThisCellHovered = hoveredCellIndex === cellIndex;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      setHoveredCellIndex(cellIndex);
      
      if (mode === 'weeks') {
        // Calculate which day within the week is being hovered
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const dayWidth = 22; // 22px effective spacing (21px + 1px gap)
        const dayIndex = Math.floor(x / dayWidth);
        setHoveredDayIndex(dayIndex >= 0 && dayIndex < 7 ? dayIndex : null);
      } else {
        setHoveredDayIndex(0); // In days mode, treat as single day
      }
    };

    const handleMouseLeave = () => {
      setHoveredCellIndex(null);
      setHoveredDayIndex(null);
    };

    const handleClick = () => {
      let targetDate = new Date(date);
      if (mode === 'weeks' && hoveredDayIndex !== null) {
        // Navigate to the specific day within the week
        targetDate = addDaysToDate(date, hoveredDayIndex);
      }
      
      setCurrentDate(targetDate);
      setCurrentView('calendar');
    };

    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div
              className="relative cursor-pointer h-full w-full"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
            >
              <div className={`transition-opacity duration-200 ${isThisCellHovered ? 'opacity-30' : 'opacity-100'}`}>
                {children}
              </div>
              
              {/* Minimal hover overlay with calendar icon */}
              {isThisCellHovered && hoveredDayIndex !== null && (
                <div 
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={mode === 'weeks' ? {
                    left: `${hoveredDayIndex * 22}px`,
                    width: '22px'
                  } : undefined}
                >
                  <div className="bg-white bg-opacity-90 rounded-full p-1 shadow-sm border">
                    <Calendar size={12} className="text-blue-600" />
                  </div>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Go to Planner</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

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
            
            // Calculate the width and position of this month section in pixels (153px per week column)
            const monthWidthPx = (group.endIndex - group.startIndex + 1) * 153;
            const leftPositionPx = group.startIndex * 153;
            
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
                  className="sticky left-0 bg-gray-50 h-full flex items-center"
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
        <div className="flex h-full items-end pb-2" style={{ minWidth: 'fit-content', gap: 0 }}>
          {dates.map((weekStart, index) => {
            const isCurrentWeek = UnifiedTimelineService.isTodayInWeek(weekStart);
            
            // Format the date range using service
            const dateRange = UnifiedTimelineService.formatWeekDateRange(weekStart);
            
            return (
              <div key={index} className={`text-center ${index < dates.length - 1 ? 'border-r border-gray-200' : ''}`} style={{ minWidth: '153px', width: '153px' }}>
                {renderDateCell(weekStart, index, 153, 
                  <div className={`text-xs px-1 ${isCurrentWeek ? 'font-medium text-blue-600' : 'text-gray-700'}`}>
                    {dateRange}
                  </div>
                )}
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
          const monthWidthPx = (group.endIndex - group.startIndex + 1) * 52; // 52px per column
          const leftPositionPx = group.startIndex * 52; // 52px per column
          
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
                className="sticky left-0 bg-gray-50 h-full flex items-center"
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
      <div className="flex h-full items-end pb-2" style={{ minWidth: 'fit-content', gap: 0 }}>
        {dates.map((date, index) => {
          const isToday = UnifiedTimelineService.isTodayDate(date);
          const isWeekend = UnifiedTimelineService.isWeekendDate(date);
          
          return (
            <div key={index} className="text-center" style={{ minWidth: '52px', width: '52px' }}>
              {renderDateCell(date, index, 52,
                <div className={`text-xs ${isToday ? 'font-medium text-blue-600 bg-blue-100 rounded-full w-5 h-5 flex items-center justify-center mx-auto' : isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                  {date.getDate()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});