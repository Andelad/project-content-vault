import React, { memo, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useAppDataOnly } from '../../contexts/AppContext';
import { calculateTimelinePositions, getSafePosition } from '@/lib/timelinePositioning';
import { calculateWorkHourCapacity, isHolidayDate } from '@/lib/workHoursUtils';
import { getProjectTimeAllocation, generateWorkHoursForDate } from '@/lib/eventWorkHourUtils';
import { ProjectIconIndicator } from './ProjectIconIndicator';

interface TimelineBarProps {
  project: any;
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  isDragging: boolean;
  dragState: any;
  handleMouseDown: (e: React.MouseEvent, projectId: string, action: string) => void;
  mode?: 'days' | 'weeks';
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
  mode
}: TimelineBarProps) {
  const { settings, events, holidays } = useAppDataOnly();
  
  // Memoize color calculations
  const colors = useMemo(() => ({
    hover: getHoverColor(project.color),
    baseline: getBaselineColor(project.color),
    midTone: getMidToneColor(project.color),
    autoEstimate: getAutoEstimateColor(project.color)
  }), [project.color]);
  
  const { hover: hoverColor, baseline: baselineColor, midTone: midToneColor, autoEstimate: autoEstimateColor } = colors;
  
  // Memoize project days calculation
  const projectDays = useMemo(() => {
    // Normalize project dates to remove time components
    const projectStart = new Date(project.startDate);
    projectStart.setHours(0, 0, 0, 0);
    const projectEnd = new Date(project.endDate);
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
  }, [project.startDate, project.endDate, viewportStart, viewportEnd]);
  
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
    
    // Calculate precise height in pixels (minimum 3px)
    const heightInPixels = Math.max(3, Math.round(exactHoursPerDay * 2));
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
  
  const { exactDailyHours, dailyHours, dailyMinutes, heightInPixels, workingDaysCount } = projectMetrics;
  
  if (projectDays.length === 0) {
    return (
      <div className="relative h-[52px] group">
        {/* Project Icon Indicator */}
        <ProjectIconIndicator project={project} mode={mode} />
      </div>
    );
  }
  
  return (
    <div className="relative h-[52px] group">
      <div className="h-full relative flex flex-col">
        {/* Project rectangles area - positioned to sit on top of baseline */}
        <div className="flex w-full relative z-20 flex-1 items-end" style={{ minWidth: `${dates.length * (mode === 'weeks' ? 72 : 40)}px` }}>
          
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
                <div key={dateIndex} className="flex flex-col-reverse relative" style={{ minWidth: '72px', width: '72px' }}>
                  <div className="flex w-full" style={{ height: `${heightInPixels}px` }}>
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
                        <Tooltip key={dayOfWeek}>
                          <TooltipTrigger asChild>
                            <div
                              className={`transition-all shadow-sm hover:shadow-md cursor-move relative ${
                                isDragging && dragState?.projectId === project.id 
                                  ? 'opacity-90 shadow-lg' 
                                  : ''
                              }`}
                              style={(() => {
                                // Get time allocation info for this specific day
                                const timeAllocation = getProjectTimeAllocation(
                                  project.id,
                                  currentDay,
                                  events,
                                  project,
                                  settings,
                                  holidays
                                );

                                // Determine styling based on time allocation type
                                const isPlannedTime = timeAllocation.type === 'planned';

                                // Calculate daily height based on allocated hours (like day view)
                                const dailyHours = timeAllocation.hours;
                                const calculatedHeight = Math.max(3, Math.round(dailyHours * 2));
                                const dayRectangleHeight = Math.min(calculatedHeight, 28);

                                return {
                                  backgroundColor: isPlannedTime ? project.color : autoEstimateColor,
                                  height: `${dayRectangleHeight}px`,
                                  width: `${dayWidth}px`,
                                  borderTopLeftRadius: '2px', // 2px rounded corners as requested
                                  borderTopRightRadius: '2px', // 2px rounded corners as requested
                                  // Handle borders based on planned time like in day view
                                  ...(isPlannedTime ? {
                                    borderLeft: `2px dashed ${baselineColor}`,
                                    borderRight: `2px dashed ${baselineColor}`,
                                    borderTop: `2px dashed ${baselineColor}`,
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
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" 
                                  onMouseDown={(e) => { 
                                    e.stopPropagation(); 
                                    handleMouseDown(e, project.id, 'resize-left'); 
                                  }} 
                                />
                              )}
                              
                              {dayOfWeek === 6 && (
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
                              // Use daily calculations like in day view
                              const timeAllocation = getProjectTimeAllocation(
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
                              
                              const tooltipType = timeAllocation.type === 'planned' ? 'planned time' : 'auto-estimate';
                              const displayHours = Math.floor(timeAllocation.hours);
                              const displayMinutes = Math.round((timeAllocation.hours - displayHours) * 60);
                              
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
                return normalizedProjectDay.toDateString() === normalizedTimelineDate.toDateString();
              });
              
              // Don't render rectangle if not a project day OR if it's a 0-hour day OR if it's a holiday
              if (!isProjectDay || !isWorkingDay(date)) {
                return <div key={dateIndex} className="flex flex-col-reverse" style={{ minWidth: '40px', width: '40px' }}></div>;
              }

              // Get time allocation info for this date
              const timeAllocation = getProjectTimeAllocation(
                project.id,
                normalizedTimelineDate, // Use normalized date
                events,
                project,
                settings,
                holidays
              );

              // Don't render if no time allocation
              if (timeAllocation.type === 'none') {
                return <div key={dateIndex} className="flex flex-col-reverse" style={{ minWidth: '40px', width: '40px' }}></div>;
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

              // Calculate height based on allocated hours
              const dailyHours = timeAllocation.hours;
              const calculatedHeight = Math.max(3, Math.round(dailyHours * 2));
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
              const isPlannedTime = timeAllocation.type === 'planned';
              const rectangleStyle = {
                backgroundColor: isPlannedTime ? project.color : autoEstimateColor,
                borderTopLeftRadius: borderTopLeftRadius,
                borderTopRightRadius: borderTopRightRadius,
                borderBottomLeftRadius: borderBottomLeftRadius,
                borderBottomRightRadius: borderBottomRightRadius,
                height: `${rectangleHeight}px`,
                width: isLastWorkingDay ? '40px' : '39px',
                // Handle borders based on planned time and position
                ...(isPlannedTime ? {
                  borderLeft: `2px dashed ${baselineColor}`,
                  borderRight: `2px dashed ${baselineColor}`,
                  borderTop: `2px dashed ${baselineColor}`,
                  borderBottom: 'none'
                } : {
                  borderRight: isLastWorkingDay ? 'none' : '1px solid rgba(255, 255, 255, 0.3)',
                  borderLeft: 'none',
                  borderTop: 'none',
                  borderBottom: 'none'
                })
              };
              
              return (
                <div key={dateIndex} className="flex flex-col-reverse" style={{ minWidth: '40px', width: '40px' }}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className={`w-full transition-all shadow-sm hover:shadow-md group cursor-move relative ${ 
                          isDragging && dragState?.projectId === project.id 
                            ? 'opacity-90 shadow-lg' 
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
                                  backgroundColor: midToneColor,
                                  // Cap inner rectangle to 3px from top of outer rectangle (max 22px for new row height)
                                  height: `${Math.min((dailyHours - 16) * 2, 22)}px`,
                                  width: 'calc(100% - 8px)' // 4px padding on each side
                                }}
                              />
                            ) : (
                              <div 
                                className="rounded-t-[3px] relative flex items-center justify-center"
                                style={{
                                  backgroundColor: midToneColor,
                                  height: '22px', // Max inner rectangle height (28px - 6px)
                                  width: 'calc(100% - 8px)' // 4px padding on each side
                                }}
                              >
                                <div className="relative">
                                  <AlertTriangle 
                                    className="w-4 h-4" 
                                    style={{ 
                                      fill: baselineColor,
                                      stroke: baselineColor,
                                      strokeWidth: 0
                                    }}
                                  />
                                  <div 
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{ color: midToneColor }}
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
                        
                        const tooltipType = timeAllocation.type === 'planned' ? 'planned time' : 'auto-estimate';
                        const displayHours = Math.floor(timeAllocation.hours);
                        const displayMinutes = Math.round((timeAllocation.hours - displayHours) * 60);
                        
                        return (
                          <div className="text-xs">
                            <div className="font-medium">{project.name}</div>
                            <div className="text-gray-500">
                              {displayMinutes > 0 
                                ? `${displayHours}h ${displayMinutes}m/day ${tooltipType}`
                                : `${displayHours} hour${displayHours !== 1 ? 's' : ''}/day ${tooltipType}`
                              }
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
          const projectEnd = new Date(project.endDate);
          
          // Use utility function for consistent positioning calculations
          const positions = calculateTimelinePositions(
            projectStart,
            projectEnd,
            viewportStart,
            viewportEnd,
            dates,
            mode
          );
          
          // Check if project should be visible
          if (projectEnd < viewportStart || projectStart > viewportEnd) {
            return null;
          }
          
          return (
            <div className="relative flex w-full h-[8px] z-20" style={{ overflow: 'visible' }}>
              {/* Baseline line using absolute pixel positioning like HolidayOverlay */}
              <div 
                className="absolute top-0 h-[3px] z-20 cursor-move hover:opacity-80 transition-opacity"
                style={{ 
                  backgroundColor: baselineColor,
                  left: `${positions.baselineStartPx}px`, // Use exact positioning without artificial constraints in weeks mode
                  width: `${positions.baselineWidthPx}px` 
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, project.id, 'move');
                }}
                title="Drag to move project"
              />
              
              {/* Start date drag circle - center it at the left edge of start column */}
              <div 
                className="absolute w-[11px] h-[11px] rounded-full shadow-sm cursor-ew-resize z-30"
                style={{ 
                  backgroundColor: baselineColor,
                  left: `${positions.circleLeftPx - 5.5}px`, // Center circle at left edge of start column
                  top: '-4px'
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, project.id, 'resize-start-date');
                }}
                title="Drag to change start date"
              />
              
              {/* Project Icon Indicator - positioned above the start circle */}
              <div 
                className="absolute z-40"
                style={{ 
                  left: `${positions.circleLeftPx - 12}px`, // Center the indicator on the start circle
                  top: '-32px' // Position above the start circle
                }}
              >
                <ProjectIconIndicator project={project} mode={mode} />
              </div>
              
              {/* End date drag triangle - align right edge with right edge of end column */}
              <div 
                className="absolute cursor-ew-resize z-30"
                style={{ 
                  left: `${positions.triangleLeftPx - 7}px`, // Position triangle so right edge aligns with right edge of end column
                  top: '-4px',
                  width: '0',
                  height: '0',
                  borderTop: '5.5px solid transparent',
                  borderBottom: '5.5px solid transparent',
                  borderRight: `7px solid ${baselineColor}`
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(e, project.id, 'resize-end-date');
                }}
                title="Drag to change end date"
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
});