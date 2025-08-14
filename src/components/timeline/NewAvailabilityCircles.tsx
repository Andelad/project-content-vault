import React, { memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useApp } from '../../contexts/AppContext';
import { isHolidayDate } from '@/lib/workHoursUtils';
import { 
  generateWorkHoursForDate,
  calculateOvertimePlannedHours,
  calculateTotalPlannedHours,
  calculateOtherTime
} from '@/lib/eventWorkHourUtils';

interface NewAvailabilityCirclesProps {
  dates: Date[];
  settings: any;
  type: 'overtime-planned' | 'total-planned' | 'other-time';
  mode?: 'days' | 'weeks';
}

export const NewAvailabilityCircles = memo(function NewAvailabilityCircles({ 
  dates, 
  settings, 
  type,
  mode = 'days'
}: NewAvailabilityCirclesProps) {
  const { holidays, events } = useApp();
  const columnWidth = mode === 'weeks' ? 72 : 40;
  
  // For weeks mode, get all days in the week
  const getWeekDates = (weekStart: Date) => {
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  };

  // Calculate hours for a date or week
  const getHours = (dateOrWeekStart: Date) => {
    if (mode === 'weeks') {
      // Sum up all days in the week
      const weekDates = getWeekDates(dateOrWeekStart);
      return weekDates.reduce((total, date) => total + getDailyHours(date), 0);
    } else {
      return getDailyHours(dateOrWeekStart);
    }
  };

  // Calculate hours for a specific day based on type
  const getDailyHours = (date: Date) => {
    const workHours = generateWorkHoursForDate(date, settings);
    
    switch (type) {
      case 'overtime-planned':
        return calculateOvertimePlannedHours(date, events, workHours);
      case 'total-planned':
        return calculateTotalPlannedHours(date, events);
      case 'other-time':
        return calculateOtherTime(date, events);
      default:
        return 0;
    }
  };

  // Get color classes based on type
  const getColorClasses = () => {
    switch (type) {
      case 'overtime-planned':
        return {
          colorClass: 'bg-gray-400',
          darkColorClass: 'bg-gray-600',
          label: 'Overtime Planned'
        };
      case 'total-planned':
        return {
          colorClass: 'bg-gray-500',
          darkColorClass: 'bg-gray-700',
          label: 'Total Project Planned'
        };
      case 'other-time':
        return {
          colorClass: 'bg-gray-300',
          darkColorClass: 'bg-gray-500',
          label: 'Other Time'
        };
      default:
        return {
          colorClass: 'bg-gray-400',
          darkColorClass: 'bg-gray-600',
          label: 'Unknown'
        };
    }
  };

  const { colorClass, darkColorClass, label } = getColorClasses();
  
  return (
    <div className="h-full relative flex items-center">
      <div className="flex w-full" style={{ minWidth: `${dates.length * columnWidth}px` }}>
        {dates.map((date: Date, dateIndex: number) => {
          const targetHours = getHours(date);
          
          if (targetHours === 0) {
            return <div key={dateIndex} className="flex justify-center items-center" style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}></div>;
          }
          
          // Split hours: first 8 hours (main circle), then up to 7 more hours (inner circle)
          const mainHours = Math.min(targetHours, 8);
          const extraHours = Math.max(0, Math.min(targetHours - 8, 7));
          
          // Convert to pixels (3px = 1 hour)
          const outerDiameter = mainHours * 3;
          const innerDiameter = extraHours * 3;
          
          return (
            <div key={dateIndex} className="flex justify-center items-center" style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    {/* Main circle */}
                    <div 
                      className={`${colorClass} rounded-full opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center`}
                      style={{
                        width: `${outerDiameter}px`,
                        height: `${outerDiameter}px`,
                        minWidth: outerDiameter > 0 ? '6px' : '0px',
                        minHeight: outerDiameter > 0 ? '6px' : '0px'
                      }}
                    >
                      {/* Inner circle for additional hours */}
                      {extraHours > 0 && (
                        <div 
                          className={`${darkColorClass} rounded-full`}
                          style={{
                            width: `${Math.min(innerDiameter, outerDiameter - 3)}px`,
                            height: `${Math.min(innerDiameter, outerDiameter - 3)}px`,
                            minWidth: innerDiameter > 0 ? '3px' : '0px',
                            minHeight: innerDiameter > 0 ? '3px' : '0px'
                          }}
                        />
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div className="font-medium text-gray-600">
                      {label}
                    </div>
                    <div className="text-gray-500">
                      {targetHours.toFixed(1)} hour{Math.round(targetHours * 10) !== 10 ? 's' : ''}
                    </div>
                    {mode === 'weeks' ? (
                      <div className="text-xs text-gray-400">
                        {getWeekDates(date).map(d => d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })).join(', ')}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">
                        {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
});