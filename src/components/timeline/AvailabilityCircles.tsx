import React, { memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useApp } from '../../contexts/AppContext';
import { isHolidayDate } from '@/lib/workHoursUtils';
import { 
  calculateAvailabilityReduction, 
  generateWorkHoursForDate,
  memoizedGetProjectTimeAllocation,
  memoizedProjectWorkingDays 
} from '@/lib/eventWorkHourUtils';

interface AvailabilityCirclesProps {
  dates: Date[];
  projects: any[];
  settings: any;
  type: 'available' | 'busy';
  mode?: 'days' | 'weeks';
}

export const AvailabilityCircles = memo(function AvailabilityCircles({ 
  dates, 
  projects, 
  settings, 
  type,
  mode = 'days'
}: AvailabilityCirclesProps) {
  const { holidays, events } = useApp();
  const columnWidth = mode === 'weeks' ? 72 : 40;
  
  // Helper function to check if a day has working hours
  const isWorkingDay = (date: Date) => {
    // First check if it's a holiday - holidays have 0 work hours
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

  // Calculate project hours for a date or week
  const getProjectHours = (dateOrWeekStart: Date) => {
    if (mode === 'weeks') {
      // Sum up all days in the week
      const weekDates = getWeekDates(dateOrWeekStart);
      return weekDates.reduce((total, date) => total + getDailyProjectHours(date), 0);
    } else {
      return getDailyProjectHours(dateOrWeekStart);
    }
  };

  // Get available hours for a date or week (accounting for event reductions)
  const getAvailableHours = (dateOrWeekStart: Date) => {
    if (mode === 'weeks') {
      // Sum up all days in the week
      const weekDates = getWeekDates(dateOrWeekStart);
      return weekDates.reduce((total, date) => total + getDailyAvailableHours(date), 0);
    } else {
      return getDailyAvailableHours(dateOrWeekStart);
    }
  };

  // Calculate available hours for a specific day after accounting for events
  const getDailyAvailableHours = (date: Date) => {
    const workHours = getWorkHoursForDay(date);
    
    if (workHours === 0) {
      return 0;
    }

    // Generate work hours for this date and calculate event reduction
    const workHourObjects = generateWorkHoursForDate(date, settings);
    const eventReduction = calculateAvailabilityReduction(date, events, workHourObjects);
    
    return Math.max(0, workHours - eventReduction);
  };
  
  // Get work hours for a date or week
  const getWorkHours = (dateOrWeekStart: Date) => {
    if (mode === 'weeks') {
      // Sum up all days in the week
      const weekDates = getWeekDates(dateOrWeekStart);
      return weekDates.reduce((total, date) => total + getWorkHoursForDay(date), 0);
    } else {
      return getWorkHoursForDay(dateOrWeekStart);
    }
  };
  
  // Memoized calculation of project hours for a specific date
  const getDailyProjectHours = useMemo(() => {
    return (date: Date) => {
      let totalHours = 0;
      
      // If this isn't a working day, no hours should be allocated
      if (!isWorkingDay(date)) {
        return 0;
      }
      
      projects.forEach((project: any) => {
        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);
        
        if (date >= projectStart && date <= projectEnd) {
          // Use the memoized working days calculation
          const workingDays = memoizedProjectWorkingDays(projectStart, projectEnd, settings, holidays);
          const totalWorkingDays = workingDays.length;
          
          // If no working days, don't allocate hours
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
    // If it's a holiday, return 0 hours
    if (isHolidayDate(date, holidays)) {
      return 0;
    }
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
    const dayData = settings.weeklyWorkHours[dayName];
    
    // Handle both old (number) and new (WorkSlot[]) formats
    if (Array.isArray(dayData)) {
      return dayData.reduce((total: number, slot: any) => {
        return total + (typeof slot.duration === 'number' ? slot.duration : 0);
      }, 0);
    }
    
    return typeof dayData === 'number' ? dayData : 0;
  };
  
  return (
    <div className="h-full relative flex items-center">
      <div className="flex w-full" style={{ minWidth: `${dates.length * columnWidth}px` }}>
        {dates.map((date: Date, dateIndex: number) => {
          const workHours = getWorkHours(date);
          const projectHours = getProjectHours(date);
          const availableHours = getAvailableHours(date);
          
          // If this is a 0-hour day, don't show any availability indicators
          if (workHours === 0) {
            return <div key={dateIndex} style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}></div>;
          }
          
          let targetHours = 0;
          let colorClass = '';
          let darkColorClass = '';
          let label = '';
          
          if (type === 'available') {
            // Available = work hours - project allocation - event time (only overlapping with work hours)
            targetHours = Math.max(0, availableHours - projectHours);
            
            colorClass = 'bg-green-500';
            darkColorClass = 'bg-green-700';
            label = 'Work Hours';
          } else {
            targetHours = Math.max(0, projectHours - availableHours);
            colorClass = 'bg-red-500';
            darkColorClass = 'bg-red-800';
            label = 'Overcommitted';
          }
          
          if (targetHours === 0) {
            return <div key={dateIndex} className="flex justify-center items-center" style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div className="font-medium text-gray-500">
                      No availability
                    </div>
                    <div className="text-gray-500">
                      {availableHours.toFixed(1)}h available, {projectHours}h scheduled
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>;
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
                    <div className={`font-medium ${type === 'available' ? 'text-green-600' : 'text-red-600'}`}>
                      {label}
                    </div>
                    <div className="text-gray-500">
                      {targetHours.toFixed(1)} hour{Math.round(targetHours * 10) !== 10 ? 's' : ''} {type === 'available' ? 'free' : 'over'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {availableHours.toFixed(1)}h available, {projectHours}h scheduled
                    </div>
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