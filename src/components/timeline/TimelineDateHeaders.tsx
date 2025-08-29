import React, { memo } from 'react';
import { HoverableDateCell } from './HoverableDateCell';

interface TimelineDateHeadersProps {
  dates: Date[];
  mode?: 'days' | 'weeks';
}

export const TimelineDateHeaders = memo(function TimelineDateHeaders({ dates, mode = 'days' }: TimelineDateHeadersProps) {
  if (mode === 'weeks') {
    // Group dates by month to create sticky headers
    const monthGroups: { monthName: string; startIndex: number; endIndex: number; }[] = [];
    let currentMonth = -1;
    let currentYear = -1;
    
    dates.forEach((date, index) => {
      const month = date.getMonth();
      const year = date.getFullYear();
      
      if (month !== currentMonth || year !== currentYear) {
        // End the previous month group
        if (monthGroups.length > 0) {
          monthGroups[monthGroups.length - 1].endIndex = index - 1;
        }
        
        // Start a new month group
        const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        monthGroups.push({
          monthName,
          startIndex: index,
          endIndex: dates.length - 1 // Will be updated when next month starts
        });
        
        currentMonth = month;
        currentYear = year;
      }
    });

    return (
      <div className="h-12 border-b border-gray-200 bg-gray-50 relative">
        {/* Sticky month labels layer - positioned at top */}
        <div className="absolute top-0 left-0 right-0 h-6 overflow-hidden">
          {monthGroups.map((group, groupIndex) => {
            const isToday = dates.some((weekStart, index) => {
              if (index >= group.startIndex && index <= group.endIndex) {
                const today = new Date();
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                return today >= weekStart && today <= weekEnd;
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
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            
            const today = new Date();
            const isCurrentWeek = today >= weekStart && today <= weekEnd;
            
            // Format the date range as "4 - 11"
            const startDate = weekStart.getDate();
            const endDate = weekEnd.getDate();
            const dateRange = `${startDate} - ${endDate}`;
            
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

  // Original days mode logic
  // Group dates by month to create sticky headers
  const monthGroups: { monthName: string; startIndex: number; endIndex: number; }[] = [];
  let currentMonth = -1;
  let currentYear = -1;
  
  dates.forEach((date, index) => {
    const month = date.getMonth();
    const year = date.getFullYear();
    
    if (month !== currentMonth || year !== currentYear) {
      // End the previous month group
      if (monthGroups.length > 0) {
        monthGroups[monthGroups.length - 1].endIndex = index - 1;
      }
      
      // Start a new month group
      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      monthGroups.push({
        monthName,
        startIndex: index,
        endIndex: dates.length - 1 // Will be updated when next month starts
      });
      
      currentMonth = month;
      currentYear = year;
    }
  });

  return (
    <div className="h-12 border-b border-gray-200 bg-gray-50 relative">
      {/* Sticky month labels layer - positioned at top */}
      <div className="absolute top-0 left-0 right-0 h-6 overflow-hidden">
        {monthGroups.map((group, groupIndex) => {
          const isToday = dates.some((date, index) => 
            index >= group.startIndex && 
            index <= group.endIndex && 
            date.toDateString() === new Date().toDateString()
          );
          const hasWeekend = dates.some((date, index) => {
            if (index >= group.startIndex && index <= group.endIndex) {
              const dayOfWeek = date.getDay();
              return dayOfWeek === 0 || dayOfWeek === 6;
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
          const isToday = date.toDateString() === new Date().toDateString();
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          
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