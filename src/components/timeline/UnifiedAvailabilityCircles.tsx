import React, { memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../ui/tooltip';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useProjectContext } from '../../contexts/ProjectContext';
import { UnifiedTimelineService, formatDuration } from '@/services';
import { formatWeekdayDate, formatDateShort } from '@/utils/dateFormatUtils';
type AvailabilityType = 
  | 'available' 
  | 'busy' 
  | 'overtime-planned' 
  | 'total-planned' 
  | 'other-time';
interface UnifiedAvailabilityCirclesProps {
  dates: Date[];
  projects?: any[];
  settings: any;
  type: AvailabilityType;
  mode?: 'days' | 'weeks';
  displayMode?: 'circles' | 'numbers';
  context?: 'timeline' | 'planner';
  hoveredColumnIndex?: number | null;
  onColumnHover?: (index: number | null) => void;
}
export const UnifiedAvailabilityCircles = memo(function UnifiedAvailabilityCircles({ 
  dates, 
  projects = [], 
  settings, 
  type,
  mode = 'days',
  displayMode = 'circles',
  context = 'timeline',
  hoveredColumnIndex = null,
  onColumnHover
}: UnifiedAvailabilityCirclesProps) {
  const { holidays, events } = usePlannerContext();
  const { milestones } = useProjectContext();
  // Match TimelineView's column width: 154px for weeks, 52px for days
  const columnWidth = mode === 'weeks' ? 153 : 52;
  // Helper function to check if a day has working hours - using service
  const isWorkingDay = (date: Date) => {
    return UnifiedTimelineService.isWorkingDay(date, holidays, settings);
  };
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
  // Memoized calculation of project hours for a specific date - using service
  const getDailyProjectHours = useMemo(() => {
    return (date: Date) => {
      if (!isWorkingDay(date)) {
        return 0;
      }
      return UnifiedTimelineService.calculateDailyProjectHours(date, projects, settings, holidays, milestones, events);
    };
  }, [projects, settings, holidays, milestones, events, isWorkingDay]);
  // Get work hours for a specific day - using service
  const getWorkHoursForDay = (date: Date) => {
    return UnifiedTimelineService.getWorkHoursForDay(date, holidays, settings);
  };
  // Calculate available hours for a specific day after accounting for events - using service
  const getDailyAvailableHours = (date: Date) => {
    return UnifiedTimelineService.calculateDailyAvailableHours(date, events, settings, holidays);
  };
  // Calculate hours for a date or week based on type
  const getHours = (dateOrWeekStart: Date) => {
    if (mode === 'weeks') {
      const weekDates = getWeekDates(dateOrWeekStart);
      switch (type) {
        case 'available':
        case 'busy': {
          // For weeks, calculate total work hours and total project hours for the entire week
          const totalWorkHours = weekDates.reduce((total, date) => total + getWorkHoursForDay(date), 0);
          const totalProjectHours = weekDates.reduce((total, date) => total + getDailyProjectHours(date), 0);

          if (type === 'available') {
            // Show remaining work hours after subtracting allocated project time
            return Math.max(0, totalWorkHours - totalProjectHours);
          } else {
            // Show time worked over the total work hours available
            return Math.max(0, totalProjectHours - totalWorkHours);
          }
        }
        default:
          // For other types, sum the daily values
          return weekDates.reduce((total, date) => total + getDailyHours(date), 0);
      }
    } else {
      return getDailyHours(dateOrWeekStart);
    }
  };
  // Calculate hours for a specific day based on type using service
  const getDailyHours = (date: Date) => {
    switch (type) {
      case 'available': {
        // Show remaining work hours after subtracting allocated project time
        const workHours = getWorkHoursForDay(date);
        const projectHours = getDailyProjectHours(date);
        return Math.max(0, workHours - projectHours);
      }
      case 'busy': {
        // Show time worked over the total work hours available
        const workHours = getWorkHoursForDay(date);
        const projectHours = getDailyProjectHours(date);
        return Math.max(0, projectHours - workHours);
      }
      case 'overtime-planned': {
        return UnifiedTimelineService.calculateOvertimePlannedHours(date, events, settings);
      }
      case 'total-planned': {
        return UnifiedTimelineService.calculateTotalPlannedHours(date, events);
      }
      case 'other-time': {
        return UnifiedTimelineService.calculateOtherTime(date, events);
      }
      default:
        return 0;
    }
  };  // Get color classes and label based on type
  const getColorData = () => {
    switch (type) {
      case 'available':
        return {
          colorClass: 'bg-green-500',
          darkColorClass: 'bg-green-700',
          label: 'Work Hours'
        };
      case 'busy':
        return {
          colorClass: 'bg-red-500',
          darkColorClass: 'bg-red-800',
          label: 'Overcommitted'
        };
      case 'overtime-planned':
        return {
          colorClass: 'bg-orange-500',
          darkColorClass: 'bg-orange-600',
          label: 'Overtime'
        };
      case 'total-planned':
        return {
          colorClass: 'bg-gray-500',
          darkColorClass: 'bg-gray-700',
          label: 'Total Project Time'
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
  const { colorClass, darkColorClass, label } = getColorData();
  // Add buffer for partial column in days mode (timeline only)
  const bufferWidth = context === 'timeline' && mode === 'days' ? columnWidth : 0;
  
  const containerStyle = context === 'planner' 
    ? { width: '100%' } 
    : { minWidth: `${dates.length * columnWidth + bufferWidth}px` };
  
  const columnStyle = context === 'planner'
    ? { flex: '1 1 0%' } // flex-1
    : { minWidth: `${columnWidth}px`, width: `${columnWidth}px` };
  
  return (
    <TooltipProvider delayDuration={100}>
      <div className="h-full relative flex items-center">
        <div className="flex w-full" style={containerStyle}>
        {dates.map((date: Date, dateIndex: number) => {
          const targetHours = getHours(date);

          const handleMouseEnter = () => onColumnHover?.(dateIndex);
          const handleMouseLeave = () => onColumnHover?.(null);

          let innerContent: React.ReactNode;
          let tooltipContent: React.ReactNode | null = null;

          if (displayMode === 'numbers') {
            innerContent = (
              <div className="flex items-center justify-center min-h-[20px]">
                {targetHours > 0 && (
                  <span
                    className={`text-xs font-medium ${
                      type === 'available' ? 'text-green-600' :
                      type === 'busy' ? 'text-red-600' :
                      'text-gray-600'
                    }`}
                  >
                    {formatDuration(targetHours)}
                  </span>
                )}
              </div>
            );
          } else {
            if (targetHours === 0) {
              innerContent = <div className="w-2 h-2" />;
            } else {
              const { outerDiameter, innerDiameter } = UnifiedTimelineService.calculateAvailabilityCircleSize(targetHours, mode || 'days');
              innerContent = (
                <div
                  className={`${colorClass} rounded-full flex items-center justify-center transition-opacity ${
                    hoveredColumnIndex === dateIndex ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    width: `${outerDiameter}px`,
                    height: `${outerDiameter}px`,
                    minWidth: outerDiameter > 0 ? '10px' : '0px',
                    minHeight: outerDiameter > 0 ? '10px' : '0px'
                  }}
                >
                  {innerDiameter > 0 && (
                    <div
                      className={`${darkColorClass} rounded-full`}
                      style={{
                        width: `${Math.min(innerDiameter, outerDiameter - 3)}px`,
                        height: `${Math.min(innerDiameter, outerDiameter - 3)}px`,
                        minWidth: innerDiameter > 0 ? '5px' : '0px',
                        minHeight: innerDiameter > 0 ? '5px' : '0px'
                      }}
                    />
                  )}
                </div>
              );
            }
          }

          if (targetHours === 0) {
            if (displayMode === 'circles' && (type === 'available' || type === 'busy')) {
              tooltipContent = (
                <div className="text-xs">
                  <div className="font-medium text-gray-500">
                    No {type === 'available' ? 'work hours' : 'overcommitment'}
                  </div>
                  <div className="text-gray-500">
                    {type === 'available'
                      ? `${formatDuration(getWorkHoursForDay(date))} work hours`
                      : `${formatDuration(getDailyProjectHours(date))} scheduled, ${formatDuration(getWorkHoursForDay(date))} work hours`}
                  </div>
                </div>
              );
            }
          } else {
            tooltipContent = (
              <div className="text-xs">
                <div
                  className={`font-medium ${
                    type === 'available' ? 'text-green-600' :
                    type === 'busy' ? 'text-red-600' :
                    'text-gray-600'
                  }`}
                >
                  {label}
                </div>
                <div className="text-gray-500">
                  {formatDuration(targetHours)} {
                    type === 'available' ? 'remaining' :
                    type === 'busy' ? 'over' : ''
                  }
                </div>
                {mode === 'weeks' ? (
                  <div className="text-xs text-gray-400">
                    {getWeekDates(date).map(d => formatDateShort(d)).join(', ')}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">
                    {formatWeekdayDate(date)}
                  </div>
                )}
                {(type === 'available' || type === 'busy') && (
                  <div className="text-xs text-gray-400">
                    {mode === 'weeks' ? (() => {
                      const weekDates = getWeekDates(date);
                      const totalWorkHours = weekDates.reduce((total, d) => total + getWorkHoursForDay(d), 0);
                      const totalProjectHours = weekDates.reduce((total, d) => total + getDailyProjectHours(d), 0);
                      return type === 'available'
                        ? `${formatDuration(totalWorkHours)} work hours - ${formatDuration(totalProjectHours)} allocated`
                        : `${formatDuration(totalProjectHours)} allocated - ${formatDuration(totalWorkHours)} work hours`;
                    })() : (
                      type === 'available'
                        ? `${formatDuration(getWorkHoursForDay(date))} work hours - ${formatDuration(getDailyProjectHours(date))} allocated`
                        : `${formatDuration(getDailyProjectHours(date))} allocated - ${formatDuration(getWorkHoursForDay(date))} work hours`
                    )}
                  </div>
                )}
              </div>
            );
          }

          const columnElement = (
            <div
              className={`flex justify-center items-center ${context === 'planner' ? 'border-r border-gray-200' : ''}`}
              style={columnStyle}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="relative">
                {innerContent}
              </div>
            </div>
          );

          if (tooltipContent) {
            return (
              <Tooltip key={dateIndex} open={hoveredColumnIndex === dateIndex}>
                <TooltipTrigger asChild>
                  {columnElement}
                </TooltipTrigger>
                <TooltipContent>
                  {tooltipContent}
                </TooltipContent>
              </Tooltip>
            );
          }

          return React.cloneElement(columnElement, { key: dateIndex });
        })}
      </div>
    </div>
    </TooltipProvider>
  );
});
