import React, { memo, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useAppDataOnly } from '../../contexts/AppContext';
import { calculateTimelinePositions, getSafePosition } from '@/lib/timelinePositioning';
import { calculateWorkHourCapacity, isHolidayDate } from '@/lib/workHoursUtils';
import { getProjectTimeAllocation, memoizedGetProjectTimeAllocation, generateWorkHoursForDate } from '@/lib/eventWorkHourUtils';
import { calculateMilestoneSegments, getMilestoneSegmentForDate } from '@/lib/milestoneSegmentUtils';
import { ProjectIconIndicator } from './ProjectIconIndicator';
import { ProjectMilestones } from './ProjectMilestones';

interface TimelineBarProps {
  project: any;
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  isDragging: boolean;
  dragState: any;
  handleMouseDown: (e: React.MouseEvent, projectId: string, action: string) => void;
  mode?: 'days' | 'weeks';
  isMultiProjectRow?: boolean;
  collapsed: boolean;
  onMilestoneDrag?: (milestoneId: string, newDate: Date) => void;
}

// Helper function to get hover color
function getHoverColor(oklchColor: string): string {
  // Increase both lightness and chroma slightly for hover effect
  return oklchColor.replace('0.8 0.12', '0.86 0.16');
}

// Helper function to get baseline color (darker version for the line)
function getBaselineColor(oklchColor: string): string {
  // Convert from 0.8 lightness to 0.5 lightness for the baseline
  return oklchColor.replace('0.8 0.12', '0.5 0.12');
}

// Helper function to get mid-tone color (between baseline and outer rectangle)
function getMidToneColor(oklchColor: string): string {
  // Convert from 0.8 lightness to 0.65 lightness (halfway between 0.5 and 0.8)
  return oklchColor.replace('0.8 0.12', '0.65 0.12');
}

// Helper function to get auto-estimate color (slightly lighter)
function getAutoEstimateColor(oklchColor: string): string {
  // Increase lightness from 0.8 to 0.85 for auto-estimate rectangles
  return oklchColor.replace('0.8 0.12', '0.85 0.12');
}

export const TimelineBar = memo(function TimelineBar({ 
  project, 
  dates, 
  viewportStart, 
  viewportEnd, 
  isDragging, 
  dragState, 
  handleMouseDown,
  mode,
  isMultiProjectRow,
  collapsed,
  onMilestoneDrag
}: TimelineBarProps) {
  const { settings, events, holidays, milestones } = useAppDataOnly();
  
  // Memoize project days calculation
  const projectDays = useMemo(() => {
    // Normalize project dates to remove time components
    const projectStart = new Date(project.startDate);
    projectStart.setHours(0, 0, 0, 0);
    
    // For continuous projects, use viewport end as the effective end date
    // This prevents infinite rendering while still showing the project as ongoing
    const projectEnd = project.continuous 
      ? new Date(viewportEnd)
      : new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);
    
    // Normalize viewport dates
    const normalizedViewportStart = new Date(viewportStart);
    normalizedViewportStart.setHours(0, 0, 0, 0);
    const normalizedViewportEnd = new Date(viewportEnd);
    normalizedViewportEnd.setHours(0, 0, 0, 0);
    
    if (projectEnd < normalizedViewportStart || projectStart > normalizedViewportEnd) {
      return [];
    }
    
    const projectDays = [];
    const visibleStart = projectStart < normalizedViewportStart ? normalizedViewportStart : projectStart;
    const visibleEnd = projectEnd > normalizedViewportEnd ? normalizedViewportEnd : projectEnd;
    
    for (let d = new Date(visibleStart); d <= visibleEnd; d.setDate(d.getDate() + 1)) {
      const dayToAdd = new Date(d);
      dayToAdd.setHours(0, 0, 0, 0); // Normalize time component
      projectDays.push(dayToAdd);
    }
    
    return projectDays;
  }, [project.startDate, project.endDate, project.continuous, viewportStart, viewportEnd]);
  
  // Memoize working day checker
  const isWorkingDay = useMemo(() => {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return (date: Date) => {
      // First check if it's a holiday - holidays have 0 work hours
      if (isHolidayDate(date, holidays)) {
        return false;
      }
      
      const dayName = dayNames[date.getDay()] as keyof typeof settings.weeklyWorkHours;
      const workSlots = settings.weeklyWorkHours[dayName];
      // Sum up all work slot durations for this day
      const totalHours = Array.isArray(workSlots) 
        ? workSlots.reduce((sum, slot) => sum + slot.duration, 0)
        : 0;
      return totalHours > 0;
    };
  }, [settings.weeklyWorkHours, holidays]);

  // Memoize milestone segments calculation
  const milestoneSegments = useMemo(() => {
    return calculateMilestoneSegments(
      project.id,
      project.startDate,
      project.endDate,
      milestones,
      settings,
      holidays,
      isWorkingDay,
      events
    );
  }, [project.id, project.startDate, project.endDate, milestones, settings, holidays, isWorkingDay, events]);

  // Memoize project metrics calculation
  const projectMetrics = useMemo(() => {
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    
    // Count only working days (days with > 0 hours in settings and not holidays)
    const workingDays = [];
    for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
      if (isWorkingDay(new Date(d))) {
        workingDays.push(new Date(d));
      }
    }
    
    const totalWorkingDays = workingDays.length;
    
    // If no working days, don't divide by zero
    if (totalWorkingDays === 0) {
      return {
        exactDailyHours: 0,
        dailyHours: 0,
        dailyMinutes: 0,
        heightInPixels: 0,
        workingDaysCount: 0
      };
    }
    
    const exactHoursPerDay = project.estimatedHours / totalWorkingDays;
    const dailyHours = Math.floor(exactHoursPerDay);
    const dailyMinutes = Math.round((exactHoursPerDay - dailyHours) * 60);
    
    // Calculate precise height in pixels (minimum 3px only if estimated hours > 0)
    const heightInPixels = project.estimatedHours > 0 
      ? Math.max(3, Math.round(exactHoursPerDay * 2))
      : 0;
    // Cap the outer rectangle at 40px to stay within taller row height (52px - 12px padding)
    const cappedHeight = Math.min(heightInPixels, 40);
    
    return {
      exactDailyHours: exactHoursPerDay,
      dailyHours,
      dailyMinutes,
      heightInPixels: cappedHeight,
      workingDaysCount: totalWorkingDays
    };
  }, [project.startDate, project.endDate, project.estimatedHours, isWorkingDay]);
  
  // Memoize color calculations to avoid repeated parsing
  const colorScheme = useMemo(() => {
    const baselineColor = getBaselineColor(project.color);
    const midToneColor = getMidToneColor(project.color);
    const hoverColor = getHoverColor(project.color);
    const autoEstimateColor = getAutoEstimateColor(project.color);
    
    return {
      baseline: baselineColor,
      main: project.color,
      midTone: midToneColor,
      hover: hoverColor,
      autoEstimate: autoEstimateColor
    };
  }, [project.color]);
  
  const { exactDailyHours, dailyHours, dailyMinutes, heightInPixels, workingDaysCount } = projectMetrics;
  
  if (projectDays.length === 0) {
    return null; // Don't render anything for projects with no duration
  }
  
  return (
    <div className="relative h-[52px] group pointer-events-none">
      <div className="h-full relative flex flex-col pointer-events-none">
        {/* Project rectangles area - positioned to rest bottom edge on top of baseline */}
        <div 
          className="flex w-full relative z-20 flex-1 pointer-events-none" 
          style={{ 
            minWidth: `${dates.length * (mode === 'weeks' ? 72 : 40)}px`,
            zIndex: 20
          }}
        >
          
          {dates.map((date, dateIndex) => {
            if (mode === 'weeks') {
              // Week mode logic
              const weekStart = new Date(date);
              weekStart.setHours(0, 0, 0, 0);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              weekEnd.setHours(23, 59, 59, 999);
              
              // Normalize project dates
              const projectStart = new Date(project.startDate);
              projectStart.setHours(0, 0, 0, 0);
              const projectEnd = new Date(project.endDate);
              projectEnd.setHours(23, 59, 59, 999);
              
              // Check if project intersects with this week
              const weekIntersectsProject = !(projectEnd < weekStart || projectStart > weekEnd);
              
              if (!weekIntersectsProject) {
                return <div key={dateIndex} className="flex flex-col-reverse" style={{ minWidth: '72px', width: '72px' }}></div>;
              }
              
              // Calculate working days in this week that are part of the project
              const workingDaysInWeek = [];
              for (let d = new Date(Math.max(weekStart.getTime(), projectStart.getTime())); 
                   d <= new Date(Math.min(weekEnd.getTime(), projectEnd.getTime())); 
                   d.setDate(d.getDate() + 1)) {
                const normalizedDay = new Date(d);
                normalizedDay.setHours(0, 0, 0, 0);
                if (isWorkingDay(normalizedDay)) {
                  workingDaysInWeek.push(normalizedDay);
                }
              }
              
              if (workingDaysInWeek.length === 0) {
                return <div key={dateIndex} className="flex flex-col-reverse" style={{ minWidth: '72px', width: '72px' }}></div>;
              }
              
              // For weeks mode, create segments for each day of the week with fine-grained positioning
              // Each week column is 72px, so each day gets approximately 10.3px (72/7)
              // Use the specified increments: 5 x 10px and 2 x 11px = 72px total
              const dayWidths = [10, 10, 10, 10, 10, 11, 11]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
              
              return (
                <div key={dateIndex} className="flex relative h-full items-end" style={{ minWidth: '72px', width: '72px' }}>
                  <div className="flex w-full items-end" style={{ height: `${heightInPixels}px` }}>
                    {dayWidths.map((dayWidth, dayOfWeek) => {
                      const currentDay = new Date(weekStart);
                      currentDay.setDate(weekStart.getDate() + dayOfWeek);
                      currentDay.setHours(0, 0, 0, 0);
                      
                      // Normalize project dates for comparison
                      const normalizedProjectStart = new Date(project.startDate);
                      normalizedProjectStart.setHours(0, 0, 0, 0);
                      const normalizedProjectEnd = new Date(project.endDate);
                      normalizedProjectEnd.setHours(0, 0, 0, 0);
                      
                      const isDayInProject = currentDay >= normalizedProjectStart && currentDay <= normalizedProjectEnd;
                      const isDayWorking = isWorkingDay(currentDay);
                      
                      if (!isDayInProject || !isDayWorking) {
                        return <div key={dayOfWeek} style={{ width: `${dayWidth}px` }}></div>;
                      }
                      
                      // Calculate position for visual continuity
                      const leftPosition = dayWidths.slice(0, dayOfWeek).reduce((sum, w) => sum + w, 0);
                      
                      return (
                        <Tooltip key={dayOfWeek} delayDuration={100}>
                          <TooltipTrigger asChild>
                            <div
                              className={`cursor-move relative pointer-events-auto ${
                                isDragging && dragState?.projectId === project.id 
                                  ? 'opacity-90' 
                                  : ''
                              }`}
                              style={(() => {
                                // Get time allocation info for this specific day
                                const timeAllocation = memoizedGetProjectTimeAllocation(
                                  project.id,
                                  currentDay,
                                  events,
                                  project,
                                  settings,
                                  holidays
                                );

                                // Check if there's a milestone segment for this day
                                const milestoneSegment = getMilestoneSegmentForDate(currentDay, milestoneSegments);

                                // Determine styling based on time allocation type and milestone segment
                                const isPlannedTime = timeAllocation.type === 'planned';

                                // Calculate daily height - use milestone segment if available, otherwise fallback to timeAllocation
                                let dailyHours: number;
                                let heightInPixels: number;
                                
                                if (isPlannedTime) {
                                  // For planned time, use actual planned hours
                                  dailyHours = timeAllocation.hours;
                                  heightInPixels = timeAllocation.hours > 0 
                                    ? Math.max(3, Math.round(dailyHours * 2))
                                    : 0;
                                } else if (milestoneSegment) {
                                  // For auto-estimate with milestone segment, use segment hours per day
                                  dailyHours = milestoneSegment.hoursPerDay;
                                  heightInPixels = milestoneSegment.heightInPixels;
                                } else {
                                  // Fallback to project auto-estimate
                                  dailyHours = timeAllocation.hours;
                                  heightInPixels = timeAllocation.hours > 0 
                                    ? Math.max(3, Math.round(dailyHours * 2))
                                    : 0;
                                }

                                const dayRectangleHeight = Math.min(heightInPixels, 28);

                                return {
                                  backgroundColor: isPlannedTime ? project.color : colorScheme.autoEstimate,
                                  height: `${dayRectangleHeight}px`,
                                  width: `${dayWidth}px`,
                                  borderTopLeftRadius: '2px',
                                  borderTopRightRadius: '2px',
                                  // Remove all animations and transitions
                                  // Handle borders based on planned time like in day view
                                  ...(isPlannedTime ? {
                                    borderLeft: `2px dashed ${colorScheme.baseline}`,
                                    borderRight: `2px dashed ${colorScheme.baseline}`,
                                    borderTop: `2px dashed ${colorScheme.baseline}`,
                                    borderBottom: 'none'
                                  } : {
                                    borderRight: dayOfWeek === 6 ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                                    borderLeft: 'none',
                                    borderTop: 'none',
                                    borderBottom: 'none'
                                  })
                                };
                              })()}
                              onMouseDown={(e) => { 
                                e.stopPropagation(); 
                                handleMouseDown(e, project.id, 'move'); 
                              }}
                            >
                              {/* Resize handles for first and last day segments */}
                              {dayOfWeek === 0 && (
                                <div 
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100" 
                                  onMouseDown={(e) => { 
                                    e.stopPropagation(); 
                                    handleMouseDown(e, project.id, 'resize-left'); 
                                  }} 
                                />
                              )}
                              
                              {dayOfWeek === 6 && (
                                <div 
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100" 
                                  onMouseDown={(e) => { 
                                    e.stopPropagation(); 
                                    handleMouseDown(e, project.id, 'resize-right'); 
                                  }} 
                                />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {(() => {
                              // Use daily calculations like in day view
                              const timeAllocation = memoizedGetProjectTimeAllocation(
                                project.id,
                                currentDay,
                                events,
                                project,
                                settings,
                                holidays
                              );

                              // Generate work hours for this specific date to calculate capacity
                              const workHours = generateWorkHoursForDate(currentDay, settings);
                              
                              // Use holiday-aware capacity calculation
                              const capacity = isHolidayDate(currentDay, holidays) 
                                ? { totalHours: 0, allocatedHours: 0, availableHours: 0, events: [] }
                                : calculateWorkHourCapacity(workHours, events, currentDay);
                              
                              // Check if there's a milestone segment for this day for tooltip display
                              const milestoneSegmentForTooltip = getMilestoneSegmentForDate(currentDay, milestoneSegments);
                              
                              const tooltipType = timeAllocation.type === 'planned' ? 'planned time' : 'auto-estimate';
                              
                              // Use milestone segment hours if available and not planned time
                              let tooltipHours: number;
                              if (timeAllocation.type === 'planned') {
                                tooltipHours = timeAllocation.hours;
                              } else if (milestoneSegmentForTooltip) {
                                tooltipHours = milestoneSegmentForTooltip.hoursPerDay;
                              } else {
                                tooltipHours = timeAllocation.hours;
                              }
                              
                              const displayHours = Math.floor(tooltipHours);
                              const displayMinutes = Math.round((tooltipHours - displayHours) * 60);
                              
                              return (
                                <div className="text-xs">
                                  <div className="font-medium">{project.name}</div>
                                  <div className="text-gray-500">
                                    {currentDay.toLocaleDateString('en-US', { 
                                      weekday: 'short', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </div>
                                  <div className="text-gray-500">
                                    {displayMinutes > 0 
                                      ? `${displayHours}h ${displayMinutes}m/day ${tooltipType}`
                                      : `${displayHours} hour${displayHours !== 1 ? 's' : ''}/day ${tooltipType}`
                                    }
                                    {milestoneSegmentForTooltip && timeAllocation.type !== 'planned' && (
                                      <div className="text-blue-600 text-xs mt-1">
                                        Target: {milestoneSegmentForTooltip.milestone?.name}
                                      </div>
                                    )}
                                  </div>
                                  {capacity.totalHours > 0 && (
                                    <>
                                      {capacity.allocatedHours > 0 && (
                                        <div className="text-orange-600 mt-1">
                                          Events: {capacity.allocatedHours.toFixed(1)}h
                                        </div>
                                      )}
                                      {capacity.allocatedHours > capacity.totalHours && (
                                        <div className="text-red-600 font-medium">⚠ Overbooked</div>
                                      )}
                                    </>
                                  )}
                                  <div className="text-gray-400 mt-1">
                                    {workingDaysCount} working day{workingDaysCount !== 1 ? 's' : ''} total
                                  </div>
                                </div>
                              );
                            })()}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            } else {
              // Original days mode logic
              // Normalize the timeline date for comparison
              const normalizedTimelineDate = new Date(date);
              normalizedTimelineDate.setHours(0, 0, 0, 0);
              
              const isProjectDay = projectDays.some(projectDay => {
                const normalizedProjectDay = new Date(projectDay);
                normalizedProjectDay.setHours(0, 0, 0, 0);
                const normalizedTimelineDate = new Date(date);
                normalizedTimelineDate.setHours(0, 0, 0, 0);
                return normalizedProjectDay.getTime() === normalizedTimelineDate.getTime();
              });
              
              // Don't render rectangle if not a project day OR if it's a 0-hour day OR if it's a holiday
              if (!isProjectDay || !isWorkingDay(date)) {
                return <div key={dateIndex} className="h-full" style={{ minWidth: '40px', width: '40px' }}></div>;
              }

              // Get time allocation info for this date
              const timeAllocation = memoizedGetProjectTimeAllocation(
                project.id,
                date, // Use the original date from the dates array (already normalized)
                events,
                project,
                settings,
                holidays
              );

              // Don't render if no time allocation
              if (timeAllocation.type === 'none') {
                return <div key={dateIndex} className="h-full" style={{ minWidth: '40px', width: '40px' }}></div>;
              }

              // Normalize project dates for comparison
              const projectStart = new Date(project.startDate);
              projectStart.setHours(0, 0, 0, 0);
              const projectEnd = new Date(project.endDate);
              projectEnd.setHours(0, 0, 0, 0);
              
              // Normalize viewport dates
              const normalizedViewportStart = new Date(viewportStart);
              normalizedViewportStart.setHours(0, 0, 0, 0);
              const normalizedViewportEnd = new Date(viewportEnd);
              normalizedViewportEnd.setHours(0, 0, 0, 0);
              
              const extendsLeft = projectStart < normalizedViewportStart;
              const extendsRight = projectEnd > normalizedViewportEnd;
              
              // Find the position of this date among visible working project days
              const visibleWorkingDays = dates.filter((d, i) => {
                const isInProject = projectDays.some(pd => pd.toDateString() === d.toDateString());
                return isInProject && isWorkingDay(d);
              });
              
              const workingDayIndex = visibleWorkingDays.findIndex(d => d.toDateString() === date.toDateString());
              const isFirstWorkingDay = workingDayIndex === 0;
              const isLastWorkingDay = workingDayIndex === visibleWorkingDays.length - 1;

              // Check if there's a milestone segment for this day
              const milestoneSegment = getMilestoneSegmentForDate(date, milestoneSegments);

              // Determine styling based on time allocation type and milestone segment
              const isPlannedTime = timeAllocation.type === 'planned';

              // Calculate daily height - use milestone segment if available, otherwise fallback to timeAllocation
              let dailyHours: number;
              let calculatedHeight: number;
              
              if (isPlannedTime) {
                // For planned time, use actual planned hours
                dailyHours = timeAllocation.hours;
                calculatedHeight = timeAllocation.hours > 0 
                  ? Math.max(3, Math.round(dailyHours * 2))
                  : 0;
              } else if (milestoneSegment) {
                // For auto-estimate with milestone segment, use segment hours per day
                dailyHours = milestoneSegment.hoursPerDay;
                calculatedHeight = milestoneSegment.heightInPixels;
              } else {
                // Fallback to project auto-estimate
                dailyHours = timeAllocation.hours;
                calculatedHeight = timeAllocation.hours > 0 
                  ? Math.max(3, Math.round(dailyHours * 2))
                  : 0;
              }
              const rectangleHeight = Math.min(calculatedHeight, 28);
              
              // Determine border radius for this day rectangle based on working days
              // Always round upper corners by 3px, remove bottom rounding on last rectangles
              let borderTopLeftRadius = '3px';
              let borderTopRightRadius = '3px';
              let borderBottomLeftRadius = '0px';
              let borderBottomRightRadius = '0px';
              
              // Handle horizontal continuity for grouped rectangles
              if (visibleWorkingDays.length === 1) {
                // Single working day - handle extensions
                if (extendsLeft && extendsRight) {
                  borderTopLeftRadius = '0px';
                  borderTopRightRadius = '0px';
                } else if (extendsLeft) {
                  borderTopLeftRadius = '0px';
                } else if (extendsRight) {
                  borderTopRightRadius = '0px';
                }
              } else {
                // Multiple working days - handle first/last
                if (isFirstWorkingDay && extendsLeft) {
                  borderTopLeftRadius = '0px';
                }
                if (isLastWorkingDay && extendsRight) {
                  borderTopRightRadius = '0px';
                }
              }

              // Determine styling based on time allocation type
              const rectangleStyle = {
                backgroundColor: isPlannedTime ? project.color : colorScheme.autoEstimate,
                borderTopLeftRadius: borderTopLeftRadius,
                borderTopRightRadius: borderTopRightRadius,
                borderBottomLeftRadius: borderBottomLeftRadius,
                borderBottomRightRadius: borderBottomRightRadius,
                height: `${rectangleHeight}px`,
                width: isLastWorkingDay ? '40px' : '39px',
                // Handle borders based on planned time and position
                ...(isPlannedTime ? {
                  borderLeft: `2px dashed ${colorScheme.baseline}`,
                  borderRight: `2px dashed ${colorScheme.baseline}`,
                  borderTop: `2px dashed ${colorScheme.baseline}`,
                  borderBottom: 'none'
                } : {
                  borderRight: isLastWorkingDay ? 'none' : '1px solid rgba(255, 255, 255, 0.3)',
                  borderLeft: 'none',
                  borderTop: 'none',
                  borderBottom: 'none'
                })
              };
              
              return (
                <div key={dateIndex} className="flex items-end h-full" style={{ minWidth: '40px', width: '40px' }}>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                      <div 
                        className={`cursor-move relative pointer-events-auto ${ 
                          isDragging && dragState?.projectId === project.id 
                            ? 'opacity-90' 
                            : ''
                        }`}
                        style={rectangleStyle}
                        onMouseDown={(e) => { 
                          e.stopPropagation(); 
                          handleMouseDown(e, project.id, 'move'); 
                        }}

                      >
                        {/* Overflow indicator for high hours (16+ hours) */}
                        {dailyHours > 16 && (
                          <div className="absolute bottom-0 left-1 right-1 flex justify-center">
                            {dailyHours <= 27 ? (
                              <div 
                                className="rounded-t-[3px] relative"
                                style={{
                                  backgroundColor: colorScheme.midTone,
                                  // Cap inner rectangle to 3px from top of outer rectangle (max 22px for new row height)
                                  height: `${Math.min((dailyHours - 16) * 2, 22)}px`,
                                  width: 'calc(100% - 8px)' // 4px padding on each side
                                }}
                              />
                            ) : (
                              <div 
                                className="rounded-t-[3px] relative flex items-center justify-center"
                                style={{
                                  backgroundColor: colorScheme.midTone,
                                  height: '22px', // Max inner rectangle height (28px - 6px)
                                  width: 'calc(100% - 8px)' // 4px padding on each side
                                }}
                              >
                                <div className="relative">
                                  <AlertTriangle 
                                    className="w-4 h-4" 
                                    style={{ 
                                      fill: colorScheme.baseline,
                                      stroke: colorScheme.baseline,
                                      strokeWidth: 0
                                    }}
                                  />
                                  <div 
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{ color: colorScheme.midTone }}
                                  >
                                    <span className="text-xs font-bold leading-none">!</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Resize handles */}
                        {isFirstWorkingDay && (
                          <div 
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" 
                            onMouseDown={(e) => { 
                              e.stopPropagation(); 
                              handleMouseDown(e, project.id, 'resize-left'); 
                            }} 
                          />
                        )}
                        
                        {isLastWorkingDay && (
                          <div 
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" 
                            onMouseDown={(e) => { 
                              e.stopPropagation(); 
                              handleMouseDown(e, project.id, 'resize-right'); 
                            }} 
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {(() => {
                        // Generate work hours for this specific date to calculate capacity
                        const workHours = generateWorkHoursForDate(date, settings);
                        
                        // Use holiday-aware capacity calculation
                        const capacity = isHolidayDate(date, holidays) 
                          ? { totalHours: 0, allocatedHours: 0, availableHours: 0, events: [] }
                          : calculateWorkHourCapacity(workHours, events, date);
                        
                        // Check if there's a milestone segment for this day for tooltip display
                        const milestoneSegmentForTooltip = getMilestoneSegmentForDate(date, milestoneSegments);
                        
                        const tooltipType = timeAllocation.type === 'planned' ? 'planned time' : 'auto-estimate';
                        
                        // Use milestone segment hours if available and not planned time
                        let tooltipHours: number;
                        if (timeAllocation.type === 'planned') {
                          tooltipHours = timeAllocation.hours;
                        } else if (milestoneSegmentForTooltip) {
                          tooltipHours = milestoneSegmentForTooltip.hoursPerDay;
                        } else {
                          tooltipHours = timeAllocation.hours;
                        }
                        
                        const displayHours = Math.floor(tooltipHours);
                        const displayMinutes = Math.round((tooltipHours - displayHours) * 60);
                        
                        return (
                          <div className="text-xs">
                            <div className="font-medium">{project.name}</div>
                            <div className="text-gray-500">
                              {displayMinutes > 0 
                                ? `${displayHours}h ${displayMinutes}m/day ${tooltipType}`
                                : `${displayHours} hour${displayHours !== 1 ? 's' : ''}/day ${tooltipType}`
                              }
                              {milestoneSegmentForTooltip && timeAllocation.type !== 'planned' && (
                                <div className="text-blue-600 text-xs mt-1">
                                  Target: {milestoneSegmentForTooltip.milestone?.name}
                                </div>
                              )}
                            </div>
                            {capacity.totalHours > 0 && (
                              <>
                                {capacity.allocatedHours > 0 && (
                                  <div className="text-orange-600 mt-1">
                                    Events: {capacity.allocatedHours.toFixed(1)}h
                                  </div>
                                )}
                                {capacity.allocatedHours > capacity.totalHours && (
                                  <div className="text-red-600 font-medium">⚠ Overbooked</div>
                                )}
                              </>
                            )}
                            <div className="text-gray-400 mt-1">
                              {workingDaysCount} working day{workingDaysCount !== 1 ? 's' : ''} total
                            </div>
                          </div>
                        );
                      })()}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            }
          })}
        </div>
        
        {/* Project baseline - positioned below the rectangles */}
        {(() => {
          const projectStart = new Date(project.startDate);
          // For continuous projects, use viewport end for positioning calculations
          const projectEnd = project.continuous 
            ? new Date(viewportEnd)
            : new Date(project.endDate);
          
          // Use utility function for consistent positioning calculations
          const positions = calculateTimelinePositions(
            projectStart,
            projectEnd,
            viewportStart,
            viewportEnd,
            dates,
            mode
          );
          
          // Check if project should be visible (continuous projects are always visible if started)
          const originalProjectEnd = new Date(project.endDate);
          if (!project.continuous && (originalProjectEnd < viewportStart || projectStart > viewportEnd)) {
            return null;
          }
          if (project.continuous && projectStart > viewportEnd) {
            return null;
          }
          
          return (
            <div className="relative flex w-full h-[8px]" style={{ overflow: 'visible', zIndex: 20 }}>
              {/* Baseline line using absolute pixel positioning like HolidayOverlay */}
              <div 
                className="absolute top-0 h-[3px] cursor-move hover:opacity-80 pointer-events-auto"
                style={project.continuous ? {
                  // For continuous projects, use hazard stripe pattern
                  background: `repeating-linear-gradient(
                    -45deg,
                    ${colorScheme.baseline},
                    ${colorScheme.baseline} 3px,
                    ${project.color} 3px,
                    ${project.color} 6px
                  )`,
                  left: `${positions.baselineStartPx}px`,
                  width: `${positions.baselineWidthPx}px`,
                  zIndex: 20
                } : {
                  // For regular projects, use solid background
                  backgroundColor: colorScheme.baseline,
                  left: `${positions.baselineStartPx}px`,
                  width: `${positions.baselineWidthPx}px`,
                  zIndex: 20
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, project.id, 'move');
                }}
                title="Drag to move project"
              />
              
              {/* Start date drag circle - center it at the left edge of start column */}
              <div 
                className="absolute w-[11px] h-[11px] rounded-full shadow-sm cursor-ew-resize z-30 pointer-events-auto"
                style={{ 
                  backgroundColor: colorScheme.baseline,
                  left: `${positions.circleLeftPx - 5.5}px`, // Center circle at left edge of start column
                  top: '-4px' // Center 11px circle on 3px baseline (5.5px above, 2.5px below)
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, project.id, 'resize-start-date');
                }}
                title="Drag to change start date"
              />
              
              {/* Project Icon Indicator - positioned above the start circle, becomes sticky when scrolling off-screen */}
              <div 
                className="absolute z-40 pointer-events-auto"
                style={{ 
                  left: `${Math.max(positions.circleLeftPx - 12, 8)}px`, // Stick with 8px gap from left edge when scrolling off-screen
                  top: '-32px' // Position above the start circle
                }}
              >
                <ProjectIconIndicator project={project} mode={mode} />
              </div>
              
              {/* End date drag triangle - align right edge with right edge of end column */}
              {/* Hide for continuous projects since they don't have an end date */}
              {!project.continuous && (
                <div 
                  className="absolute cursor-ew-resize z-30 pointer-events-auto"
                  style={{ 
                    left: `${positions.triangleLeftPx - 7}px`, // Position triangle so right edge aligns with right edge of end column
                    top: '-4px', // Center 11px triangle on 3px baseline (5.5px above, 2.5px below)
                    width: '0',
                    height: '0',
                    borderTop: '5.5px solid transparent',
                    borderBottom: '5.5px solid transparent',
                    borderRight: `7px solid ${colorScheme.baseline}`
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleMouseDown(e, project.id, 'resize-end-date');
                  }}
                  title="Drag to change end date"
                />
              )}
              
              {/* Project Milestones */}
              <ProjectMilestones
                project={project}
                dates={dates}
                viewportStart={viewportStart}
                viewportEnd={viewportEnd}
                mode={mode}
                colorScheme={colorScheme}
                onMilestoneDrag={onMilestoneDrag}
                isDragging={isDragging}
                dragState={dragState}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
});