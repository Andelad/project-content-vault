import React, { memo, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { calculateTimelinePositions, getSafePosition } from '@/lib/timelinePositioning';
import { calculateWorkHourCapacity, isHolidayDate } from '@/lib/workHoursUtils';
import { getProjectTimeAllocation, memoizedGetProjectTimeAllocation, generateWorkHoursForDate } from '@/lib/eventWorkHourUtils';
import { calculateMilestoneSegments, getMilestoneSegmentForDate } from '@/lib/milestoneSegmentUtils';
import { ProjectIconIndicator } from './ProjectIconIndicator';
import { ProjectMilestones } from './ProjectMilestones';
import { TimeAllocationService } from '@/services/TimeAllocationService';
import { HeightCalculationService } from '@/services/HeightCalculationService';

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
  onMilestoneDragEnd?: () => void;
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
  onMilestoneDrag,
  onMilestoneDragEnd
}: TimelineBarProps) {
  const { milestones } = useProjectContext();
  const { events, holidays } = usePlannerContext();
  const { settings } = useSettingsContext();
  
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
    // Generate work hours for the project period to get accurate working day calculation
    const workHoursForPeriod = [];
    const projectStart = new Date(project.startDate);
    const projectEnd = project.continuous ? new Date(viewportEnd) : new Date(project.endDate);
    
    for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
      const dayWorkHours = generateWorkHoursForDate(new Date(d), settings);
      workHoursForPeriod.push(...dayWorkHours);
    }
    
    return calculateMilestoneSegments(
      project.id,
      project.startDate,
      project.endDate,
      milestones,
      settings,
      holidays,
      isWorkingDay,
      events,
      project.estimatedHours, // Pass the project total budget
      workHoursForPeriod // Pass work hours for accurate working day calculation
    );
  }, [project.id, project.startDate, project.endDate, milestones, settings, holidays, isWorkingDay, events, project.estimatedHours, project.continuous, viewportEnd]);

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
      ? HeightCalculationService.calculateProjectHeight(exactHoursPerDay)
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
            minWidth: `${dates.length * (mode === 'weeks' ? 77 : 40)}px`,
            zIndex: 20
          }}
        >
          {(() => {
            // Calculate visually adjusted project dates for immediate drag response
            let visualProjectStart = new Date(project.startDate);
            let visualProjectEnd = new Date(project.endDate);
            
            // Apply drag offset to project dates for immediate visual feedback
            if (isDragging && dragState?.projectId === project.id && dragState?.daysDelta) {
              const daysOffset = dragState.daysDelta;
              visualProjectStart = new Date(project.startDate);
              visualProjectStart.setDate(visualProjectStart.getDate() + daysOffset);
              visualProjectEnd = new Date(project.endDate);
              visualProjectEnd.setDate(visualProjectEnd.getDate() + daysOffset);
            }
            
            return dates.map((date, dateIndex) => {
            if (mode === 'weeks') {
              // Week mode logic
              const weekStart = new Date(date);
              weekStart.setHours(0, 0, 0, 0);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              weekEnd.setHours(23, 59, 59, 999);
              
              // Normalize project dates (using visually adjusted dates for immediate drag response)
              const projectStart = new Date(visualProjectStart);
              projectStart.setHours(0, 0, 0, 0);
              const projectEnd = new Date(visualProjectEnd);
              projectEnd.setHours(23, 59, 59, 999);
              
              // Check if project intersects with this week
              const weekIntersectsProject = !(projectEnd < weekStart || projectStart > weekEnd);
              
              if (!weekIntersectsProject) {
                return <div key={dateIndex} className="flex flex-col-reverse" style={{ minWidth: '77px', width: '77px' }}></div>;
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
                return <div key={dateIndex} className="flex flex-col-reverse" style={{ minWidth: '77px', width: '77px' }}></div>;
              }
              
              // For weeks mode, create segments for each day of the week with simple 11px positioning
              // Each week column is 77px, with each day getting exactly 11px
              const dayWidths = [11, 11, 11, 11, 11, 11, 11]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun - all 11px
              
              return (
                <div key={dateIndex} className="flex relative h-full items-end" style={{ minWidth: '77px', width: '77px' }}>
                  {/* Use a fixed cap height so inner day rectangles aren't clipped by project-level estimate */}
                  <div className="flex w-full items-end" style={{ height: `28px` }}>
                    {dayWidths.map((dayWidth, dayOfWeek) => {
                      const currentDay = new Date(weekStart);
                      currentDay.setDate(weekStart.getDate() + dayOfWeek);
                      currentDay.setHours(0, 0, 0, 0);
                      
                      // Normalize project dates for comparison (using visually adjusted dates)
                      const normalizedProjectStart = new Date(visualProjectStart);
                      normalizedProjectStart.setHours(0, 0, 0, 0);
                      const normalizedProjectEnd = new Date(visualProjectEnd);
                      normalizedProjectEnd.setHours(0, 0, 0, 0);
                      
                      const isDayInProject = currentDay >= normalizedProjectStart && currentDay <= normalizedProjectEnd;
                      // Determine if this specific date actually has work capacity (honors overrides + holidays)
                      const dayWorkHours = generateWorkHoursForDate(currentDay, settings);
                      const totalDayWork = Array.isArray(dayWorkHours) ? dayWorkHours.reduce((s, wh) => s + (wh.duration || 0), 0) : 0;
                      const isHoliday = isHolidayDate(currentDay, holidays);
                      const isDayWorking = !isHoliday && totalDayWork > 0;
                      
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
                                // Use centralized time allocation service
                                const allocation = TimeAllocationService.getTimeAllocationForDate(
                                  project.id,
                                  currentDay,
                                  project,
                                  events,
                                  settings,
                                  holidays,
                                  milestoneSegments
                                );

                                const isPlannedTime = allocation.type === 'planned';
                                const dayRectangleHeight = allocation.heightInPixels;

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
            handleMouseDown(e, project.id, 'resize-start-date'); 
                                  }} 
                                />
                              )}
                              
          {dayOfWeek === 6 && (
                                <div 
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100" 
                                  onMouseDown={(e) => { 
                                    e.stopPropagation(); 
            handleMouseDown(e, project.id, 'resize-end-date'); 
                                  }} 
                                />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {(() => {
                              // Use centralized service for consistent tooltip values
                              const allocation = TimeAllocationService.getTimeAllocationForDate(
                                project.id,
                                currentDay,
                                project,
                                events,
                                settings,
                                holidays,
                                milestoneSegments
                              );
                              
                              const tooltipInfo = TimeAllocationService.getTooltipInfo(allocation);
                              
                              return (
                                <div className="text-xs">
                                  <div className="font-medium">
                                    {tooltipInfo.type}
                                  </div>
                                  <div className="text-gray-600">
                                    {tooltipInfo.displayText}
                                  </div>
                                  {allocation.milestoneSegment?.milestone && (
                                    <div className="text-gray-600 mt-1">
                                      Target: {allocation.milestoneSegment.milestone.name} - {allocation.milestoneSegment.milestone.timeAllocation}h
                                    </div>
                                  )}
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
              
              // Don't render rectangle if not a project day OR if it's a 0-hour day OR if it's a holiday (respect overrides)
              const dayWorkHours = generateWorkHoursForDate(date, settings);
              const totalDayWork = Array.isArray(dayWorkHours) ? dayWorkHours.reduce((s, wh) => s + (wh.duration || 0), 0) : 0;
              const isHoliday = isHolidayDate(date, holidays);
              if (!isProjectDay || isHoliday || totalDayWork === 0) {
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

              // Normalize project dates for comparison (using visually adjusted dates)
              const projectStart = new Date(visualProjectStart);
              projectStart.setHours(0, 0, 0, 0);
              const projectEnd = new Date(visualProjectEnd);
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
                const wh = generateWorkHoursForDate(d, settings);
                const total = Array.isArray(wh) ? wh.reduce((s, x) => s + (x.duration || 0), 0) : 0;
                const holiday = isHolidayDate(d, holidays);
                return isInProject && !holiday && total > 0;
              });
              
              const workingDayIndex = visibleWorkingDays.findIndex(d => d.toDateString() === date.toDateString());
              const isFirstWorkingDay = workingDayIndex === 0;
              const isLastWorkingDay = workingDayIndex === visibleWorkingDays.length - 1;

              // Check if there's a milestone segment for this day
              const milestoneSegment = getMilestoneSegmentForDate(date, milestoneSegments);

              // Use centralized time allocation service
              const allocation = TimeAllocationService.getTimeAllocationForDate(
                project.id,
                date,
                project,
                events,
                settings,
                holidays,
                milestoneSegments
              );

              const isPlannedTime = allocation.type === 'planned';
              const dailyHours = allocation.hours;
              const rectangleHeight = allocation.heightInPixels;
              
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
          handleMouseDown(e, project.id, 'resize-start-date'); 
                            }} 
                          />
                        )}
                        
        {isLastWorkingDay && (
                          <div 
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" 
                            onMouseDown={(e) => { 
                              e.stopPropagation(); 
          handleMouseDown(e, project.id, 'resize-end-date'); 
                            }} 
                          />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {(() => {
                        // Use centralized service for consistent tooltip values
                        const tooltipInfo = TimeAllocationService.getTooltipInfo(allocation);
                        
                        return (
                          <div className="text-xs">
                            <div className="font-medium">
                              {tooltipInfo.type}
                            </div>
                            <div className="text-gray-600">
                              {tooltipInfo.displayText}
                            </div>
                            {allocation.milestoneSegment?.milestone && (
                              <div className="text-gray-600 mt-1">
                                Target: {allocation.milestoneSegment.milestone.name} - {allocation.milestoneSegment.milestone.timeAllocation}h
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            }
          });
          })()}
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
          
          // Apply immediate drag offset to project bar positions for responsive UI
          let adjustedPositions = { ...positions };
          if (isDragging && dragState?.projectId === project.id && dragState?.daysDelta) {
            const dragDayWidth = mode === 'weeks' ? 11 : 40;
            const dragOffsetPx = dragState.daysDelta * dragDayWidth;
            
            adjustedPositions = {
              ...positions,
              baselineStartPx: positions.baselineStartPx + dragOffsetPx,
              circleLeftPx: positions.circleLeftPx + dragOffsetPx,
              triangleLeftPx: positions.triangleLeftPx + dragOffsetPx
            };
          }
          
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
                draggable={false} // 🚫 Disable browser drag-and-drop
                style={project.continuous ? {
                  // For continuous projects, use hazard stripe pattern
                  background: `repeating-linear-gradient(
                    -45deg,
                    ${colorScheme.baseline},
                    ${colorScheme.baseline} 3px,
                    ${project.color} 3px,
                    ${project.color} 6px
                  )`,
                  left: `${adjustedPositions.baselineStartPx}px`,
                  width: `${positions.baselineWidthPx}px`,
                  zIndex: 25
                } : {
                  // For regular projects, use solid background
                  backgroundColor: colorScheme.baseline,
                  left: `${adjustedPositions.baselineStartPx}px`,
                  width: `${positions.baselineWidthPx}px`,
                  zIndex: 25
                }}
                onMouseDown={(e) => {
                  e.preventDefault(); // 🚫 Prevent browser drag-and-drop globe
                  e.stopPropagation();
                  handleMouseDown(e, project.id, 'move');
                }}
                title="Drag to move project"
              />
              
              {/* Start date drag circle - center it at the left edge of start column */}
              <div 
                className="absolute w-[11px] h-[11px] rounded-full shadow-sm cursor-ew-resize pointer-events-auto hover:scale-110 transition-transform"
                draggable={false} // 🚫 Disable browser drag-and-drop
                style={{ 
                  backgroundColor: colorScheme.baseline,
                  left: `${adjustedPositions.circleLeftPx - 5.5}px`, // Center circle at left edge of start column
                  top: '-4px', // Center 11px circle on 3px baseline (5.5px above, 2.5px below)
                  zIndex: 30
                }}
                onMouseDown={(e) => {
                  e.preventDefault(); // 🚫 Prevent browser drag-and-drop globe
                  e.stopPropagation();
                  handleMouseDown(e, project.id, 'resize-start-date');
                }}
                title="Drag to change start date"
              />
              
              {/* Project Icon Indicator - positioned above the start circle, becomes sticky when scrolling off-screen */}
              <div 
                className="absolute z-40 pointer-events-auto"
                style={{ 
                  left: `${Math.max(adjustedPositions.circleLeftPx - 12, 8)}px`, // Stick with 8px gap from left edge when scrolling off-screen
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
                  draggable={false} // 🚫 Disable browser drag-and-drop
                  style={{ 
                    left: `${adjustedPositions.triangleLeftPx - 7}px`, // Position triangle so right edge aligns with right edge of end column
                    top: '-4px', // Center 11px triangle on 3px baseline (5.5px above, 2.5px below)
                    width: '0',
                    height: '0',
                    borderTop: '5.5px solid transparent',
                    borderBottom: '5.5px solid transparent',
                    borderRight: `7px solid ${colorScheme.baseline}`
                  }}
                onMouseDown={(e) => {
                  e.preventDefault(); // 🚫 Prevent browser drag-and-drop globe
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
                projectPositions={adjustedPositions}
                isDragging={isDragging}
                dragState={dragState}
                onMilestoneDrag={onMilestoneDrag}
                onMilestoneDragEnd={onMilestoneDragEnd}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
});