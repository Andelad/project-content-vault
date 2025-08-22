import React, { memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useApp } from '../../contexts/AppContext';
import { isHolidayDate } from '@/lib/workHoursUtils';
import { 
  calculateAvailabilityReduction, 
  generateWorkHoursForDate,
  memoizedGetProjectTimeAllocation,
  memoizedProjectWorkingDays,
  calculateOvertimePlannedHours,
  calculateTotalPlannedHours,
  calculateOtherTime
} from '@/lib/eventWorkHourUtils';

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
  const { holidays, events } = useApp();
  const columnWidth = mode === 'weeks' ? 72 : 40;
  
  // Helper function to check if a day has working hours
  const isWorkingDay = (date: Date) => {
    if (isHolidayDate(date, holidays)) {
      return false;
    }
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
    const daySlots = settings.weeklyWorkHours[dayName] || [];
    return Array.isArray(daySlots) ? daySlots.length > 0 : daySlots > 0;
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

  // Memoized calculation of project hours for a specific date
  const getDailyProjectHours = useMemo(() => {
    return (date: Date) => {
      let totalHours = 0;
      
      if (!isWorkingDay(date)) {
        return 0;
      }
      
      projects.forEach((project: any) => {
        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);
        
        if (date >= projectStart && date <= projectEnd) {
          const workingDays = memoizedProjectWorkingDays(projectStart, projectEnd, settings, holidays);
          const totalWorkingDays = workingDays.length;
          
          if (totalWorkingDays === 0) {
            return;
          }
          
          const hoursPerDay = project.estimatedHours / totalWorkingDays;
          const roundedHoursPerDay = Math.ceil(hoursPerDay);
          totalHours += roundedHoursPerDay;
        }
      });
      
      return totalHours;
    };
  }, [projects, settings, holidays, isWorkingDay]);

  // Get work hours for a specific day
  const getWorkHoursForDay = (date: Date) => {
    if (isHolidayDate(date, holidays)) {
      return 0;
    }
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
    const dayData = settings.weeklyWorkHours[dayName];
    
    if (Array.isArray(dayData)) {
      return dayData.reduce((total: number, slot: any) => {
        return total + (typeof slot.duration === 'number' ? slot.duration : 0);
      }, 0);
    }
    
    return typeof dayData === 'number' ? dayData : 0;
  };

  // Calculate available hours for a specific day after accounting for events
  const getDailyAvailableHours = (date: Date) => {
    const workHours = getWorkHoursForDay(date);
    
    if (workHours === 0) {
      return 0;
    }
    
    const workHourObjects = generateWorkHoursForDate(date, settings);
    const eventReduction = calculateAvailabilityReduction(date, events, workHourObjects);
    
    return Math.max(0, workHours - eventReduction);
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

  // Calculate hours for a specific day based on type
  const getDailyHours = (date: Date) => {
    switch (type) {
      case 'available': {
        const availableHours = getDailyAvailableHours(date);
        const projectHours = getDailyProjectHours(date);
        return Math.max(0, availableHours - projectHours);
      }
      case 'busy': {
        const availableHours = getDailyAvailableHours(date);
        const projectHours = getDailyProjectHours(date);
        return Math.max(0, projectHours - availableHours);
      }
      case 'overtime-planned': {
        const workHours = generateWorkHoursForDate(date, settings);
        return calculateOvertimePlannedHours(date, events, workHours);
      }
      case 'total-planned': {
        return calculateTotalPlannedHours(date, events);
      }
      case 'other-time': {
        return calculateOtherTime(date, events);
      }
      default:
        return 0;
    }
  };

  // Get color classes and label based on type
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

  const { colorClass, darkColorClass, label } = getColorData();
  
  return (
    <div className="h-full relative flex items-center">
      <div className="flex w-full" style={{ minWidth: `${dates.length * columnWidth}px` }}>
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
                              ? `${getDailyAvailableHours(date).toFixed(1)}h available, ${getDailyProjectHours(date)}h scheduled`
                              : `${getDailyProjectHours(date)}h scheduled, ${getDailyAvailableHours(date).toFixed(1)}h available`
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
                          const mainHours = Math.min(targetHours, 8);
                          const extraHours = Math.max(0, Math.min(targetHours - 8, 7));
                          
                          // Convert to pixels (3px = 1 hour)
                          const outerDiameter = mainHours * 3;
                          const innerDiameter = extraHours * 3;
                          
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
                          {targetHours.toFixed(1)}
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
                      {targetHours.toFixed(1)} hour{Math.round(targetHours * 10) !== 10 ? 's' : ''} {
                        type === 'available' ? 'free' : 
                        type === 'busy' ? 'over' : ''
                      }
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
                    {(type === 'available' || type === 'busy') && (
                      <div className="text-xs text-gray-400">
                        {getDailyAvailableHours(date).toFixed(1)}h available, {getDailyProjectHours(date)}h scheduled
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
