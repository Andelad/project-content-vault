import React, { memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
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
}

export const UnifiedAvailabilityCircles = memo(function UnifiedAvailabilityCircles({ 
  dates, 
  projects = [], 
  settings, 
  type,
  mode = 'days',
  displayMode = 'circles'
}: UnifiedAvailabilityCirclesProps) {
  const { holidays, events } = usePlannerContext();
  const { milestones } = useProjectContext();
  const columnWidth = mode === 'weeks' ? 77 : 40;
  
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
      return weekDates.reduce((total, date) => total + getDailyHours(date), 0);
    } else {
      return getDailyHours(dateOrWeekStart);
    }
  };

  // Calculate hours for a specific day based on type using service
  const getDailyHours = (date: Date) => {
    switch (type) {
      case 'available': {
        const availableHours = getDailyAvailableHours(date);
        const projectHours = getDailyProjectHours(date);
        
        // Debug for all dates in the current viewport
        console.log(`[AvailabilityCircles] ${date.toDateString()} - available: ${availableHours}, project: ${projectHours}, result: ${Math.max(0, availableHours - projectHours)}`);
        
        return Math.max(0, availableHours - projectHours);
      }
      case 'busy': {
        const availableHours = getDailyAvailableHours(date);
        const projectHours = getDailyProjectHours(date);
        return Math.max(0, projectHours - availableHours);
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
          label: 'Available Work Slots'
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
  
  // Add buffer for partial column in days mode
  const bufferWidth = mode === 'days' ? columnWidth : 0;
  
  return (
    <div className="h-full relative flex items-center">
      <div className="flex w-full" style={{ minWidth: `${dates.length * columnWidth + bufferWidth}px` }}>
        {dates.map((date: Date, dateIndex: number) => {
          const targetHours = getHours(date);
          
          // Show empty space for zero hours
          if (targetHours === 0) {
            return (
              <div key={dateIndex} className="flex justify-center items-center" style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}>
                {displayMode === 'numbers' ? (
                  /* Numbers display for zero hours - show nothing */
                  <div className="flex items-center justify-center min-h-[20px]">
                    {/* Empty div - no content for 0h */}
                  </div>
                ) : (
                  /* Circles display for zero hours - only show tooltip for available/busy types */
                  (type === 'available' || type === 'busy') && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="relative w-2 h-2"></div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <div className="font-medium text-gray-500">
                            No {type === 'available' ? 'availability' : 'overcommitment'}
                          </div>
                          <div className="text-gray-500">
                            {type === 'available' 
                              ? `${formatDuration(getDailyAvailableHours(date))} available, ${formatDuration(getDailyProjectHours(date))} scheduled`
                              : `${formatDuration(getDailyProjectHours(date))} scheduled, ${formatDuration(getDailyAvailableHours(date))} available`
                            }
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )
                )}
              </div>
            );
          }
          
          return (
            <div key={dateIndex} className="flex justify-center items-center" style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    {displayMode === 'circles' ? (
                      <>
                        {/* Split hours: first 8 hours (main circle), then up to 7 more hours (inner circle) */}
                        {(() => {
                          // Use service for circle sizing calculation
                          const { outerDiameter, innerDiameter } = UnifiedTimelineService.calculateAvailabilityCircleSize(targetHours, mode || 'days');
                          
                          return (
                            <>
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
                                {innerDiameter > 0 && (
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
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      /* Numbers display */
                      <div className="flex items-center justify-center min-h-[20px]">
                        <span className={`text-xs font-medium ${
                          type === 'available' ? 'text-green-600' : 
                          type === 'busy' ? 'text-red-600' : 
                          'text-gray-600'
                        }`}>
                          {formatDuration(targetHours)}
                        </span>
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div className={`font-medium ${
                      type === 'available' ? 'text-green-600' : 
                      type === 'busy' ? 'text-red-600' : 
                      'text-gray-600'
                    }`}>
                      {label}
                    </div>
                    <div className="text-gray-500">
                      {formatDuration(targetHours)} {
                        type === 'available' ? 'free' : 
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
                        {formatDuration(getDailyAvailableHours(date))} available, {formatDuration(getDailyProjectHours(date))} scheduled
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
