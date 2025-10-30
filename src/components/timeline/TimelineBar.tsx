import React, { memo, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { isSameDate } from '@/utils/dateFormatUtils';
import type { Project } from '@/types/core';
import { UnifiedTimelineService } from '@/services';
import { ColorCalculationService } from '@/services/ui/ColorCalculations';
import type { TimelineAllocationType } from '@/constants/styles';
import { 
  generateWorkHoursForDate,
  calculateWorkHoursTotal,
  isHolidayDateCapacity,
  getMilestoneSegmentForDate,
  getTimelinePositions,
  calculateRectangleHeight,
  normalizeToMidnight
} from '@/services';
import { ProjectIconIndicator } from '@/components';
interface TimelineBarProps {
  project: Project;
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
// Helper function to calculate baseline visual offsets
function calculateBaselineVisualOffsets(positions: any, isDragging: boolean, dragState: any, projectId: string, mode: 'days' | 'weeks' = 'days') {
  try {
    return UnifiedTimelineService.calculateBaselineVisualOffsets(positions, isDragging, dragState, projectId, mode);
  } catch (error) {
    console.error('Error in calculateBaselineVisualOffsets:', error);
    return positions; // fallback to original positions
  }
}
// Helper function to calculate visual project dates with consolidated offset logic
function calculateVisualProjectDates(project: any, isDragging: boolean, dragState: any) {
  try {
    return UnifiedTimelineService.calculateVisualProjectDates(project, isDragging, dragState);
  } catch (error) {
    console.error('Error in calculateVisualProjectDates:', error);
    return { visualProjectStart: new Date(project.startDate), visualProjectEnd: new Date(project.endDate) }; // fallback
  }
}
// Reusable drag handle component
interface DragHandleProps {
  projectId: string;
  action: string;
  onMouseDown: (e: React.MouseEvent, projectId: string, action: string) => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  children?: React.ReactNode;
}
const DragHandle = memo(function DragHandle({ 
  projectId, 
  action, 
  onMouseDown, 
  className = "", 
  style = {}, 
  title = "", 
  children 
}: DragHandleProps) {
  const handlePointerDown = (e: React.PointerEvent) => {
    // Prefer pointer events for pen/tablet reliability
    try {
      (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    } catch {}
    e.preventDefault();
    e.stopPropagation();
    onMouseDown(e as unknown as React.MouseEvent, projectId, action);
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    // Fallback for older devices
    e.preventDefault();
    e.stopPropagation();
    onMouseDown(e, projectId, action);
  };
  return (
    <div
      className={`${className} pointer-events-auto`}
      style={style}
      draggable={false}
      onPointerDown={handlePointerDown}
      onMouseDown={handleMouseDown}
      title={title}
    >
      {children}
    </div>
  );
});
// Color calculation functions are now centralized in ColorCalculationService
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
  // Always call ALL hooks first, before any early returns (React Rules of Hooks)
  const { milestones } = useProjectContext();
  const { events, holidays } = usePlannerContext();
  const { settings } = useSettingsContext();
  // CRITICAL: Call this hook at top level, NOT inside useMemo
  // This was causing "Do not call Hooks inside useMemo" error
  const isWorkingDayChecker = UnifiedTimelineService.getCachedWorkingDayChecker(
    settings.weeklyWorkHours, 
    holidays
  );
  // Centralized filtered milestones for this project (once per relevant change)
  const filteredProjectMilestones = useMemo(() => {
    if (!project) return [] as any[];
    const projectStart = new Date(project.startDate);
    const projectEnd = project.continuous ? null : new Date(project.endDate);
    let projectMilestones = milestones.filter(m => {
      if (m.projectId !== project.id) return false;
      const milestoneDate = new Date(m.endDate || m.dueDate);
      if (milestoneDate < projectStart) return false;
      if (project.continuous) return true;
      return milestoneDate <= projectEnd!;
    });
    const hasTemplateMilestone = projectMilestones.some(m => m.isRecurring === true);
    if (hasTemplateMilestone) {
      projectMilestones = projectMilestones.filter(m => 
        m.isRecurring === true || (!m.isRecurring && (!m.name || !/\s\d+$/.test(m.name)))
      );
    }
    return projectMilestones;
  }, [project, milestones]);

  // Calculate day estimates ONCE per project/milestones/events change
  // This should NOT recalculate when scrolling (viewport changes)
  const dayEstimates = useMemo(() => {
    if (!project) return [];
    return UnifiedTimelineService.calculateProjectDayEstimates(
      project,
      filteredProjectMilestones,
      settings,
      holidays,
      events
    );
  }, [project, filteredProjectMilestones, settings, holidays, events]);
  // Get comprehensive timeline bar data from UnifiedTimelineService - MUST be before early returns
  const timelineData = useMemo(() => {
    if (!project) {
      // Return a minimal default structure that matches UnifiedTimelineService.getTimelineBarData
      return {
        projectData: null,
        projectDays: [],
        workHoursForPeriod: [],
        dayEstimates: [],
        milestoneSegments: [],
        projectMetrics: { 
          exactDailyHours: [], 
          dailyHours: [], 
          dailyMinutes: [], 
          heightInPixels: [], 
          workingDaysCount: 0 
        },
        colorScheme: { 
          baseline: '#666666', 
          completedPlanned: '#cccccc', 
          main: '#888888', 
          midTone: '#aaaaaa', 
          hover: '#999999', 
          autoEstimate: '#dddddd' 
        },
        visualDates: null,
        isWorkingDay: () => false
      };
    }
    return UnifiedTimelineService.getTimelineBarData(
      project,
      dates,
      viewportStart,
      viewportEnd,
      filteredProjectMilestones, // Use filtered milestones, not all milestones
      holidays,
      settings,
      isDragging,
      dragState,
      isWorkingDayChecker, // Pass the hook result, don't call hook inside service
      events // Pass events for planned time calculations
    );
  }, [project, dates, viewportStart, viewportEnd, filteredProjectMilestones, holidays, settings, isDragging, dragState, events]);
  // Override dayEstimates in timelineData with the memoized version
  const finalTimelineData = useMemo(() => ({
    ...timelineData,
    dayEstimates // Use the separately memoized dayEstimates
  }), [timelineData, dayEstimates]);
  // Extract data for use in component
  const {
    projectDays,
    workHoursForPeriod,
    milestoneSegments, // DEPRECATED: kept for backward compatibility
    projectMetrics,
    colorScheme,
    visualDates,
    isWorkingDay
  } = finalTimelineData;
  const { exactDailyHours, dailyHours, dailyMinutes, heightInPixels, workingDaysCount } = projectMetrics;
  // Now we can do early returns - AFTER all hooks
  if (!project) {
    return null;
  }
  if (projectDays.length === 0) {
    return null; // Don't render anything for projects with no duration
  }
  
  // Add buffer for partial column in days mode
  const columnWidth = mode === 'weeks' ? 154 : 52;
  const bufferWidth = mode === 'days' ? columnWidth : 0;
  
  try {
    // ✅ Main return - AFTER all hooks
    return (
      <div className="h-[48px] relative flex flex-col pointer-events-none">
        {/* White background - render first so it's behind everything */}
        {(() => {
          const projectStart = new Date(project.startDate);
          const projectEnd = project.continuous 
            ? new Date(viewportEnd)
            : new Date(project.endDate);
          
          const positions = (() => {
            try {
              const result = getTimelinePositions(
                projectStart,
                projectEnd,
                viewportStart,
                viewportEnd,
                dates,
                mode
              );
              return result;
            } catch (error) {
              console.error('Error getting timeline positions:', error);
              return null;
            }
          })();
          
          if (!positions) return null;
          
          const adjustedPositions = calculateBaselineVisualOffsets(
            positions, isDragging, dragState, project.id, mode
          );
          
          // Determine if project extends beyond viewport edges
          const normalizedProjectStart = normalizeToMidnight(new Date(project.startDate));
          const normalizedViewportStart = normalizeToMidnight(new Date(viewportStart));
          const normalizedViewportEnd = normalizeToMidnight(new Date(viewportEnd));
          
          const extendsLeft = normalizedProjectStart < normalizedViewportStart;
          const extendsRight = project.continuous; // Continuous projects always extend right
          
          // Calculate position and width, extending beyond viewport for continuous projects
          let leftPx = adjustedPositions.baselineStartPx;
          let widthPx = (adjustedPositions as any).baselineWidthPx ?? positions.baselineWidthPx;
          
          // Extend width to viewport edge (plus buffer) for continuous projects
          if (extendsRight) {
            const columnWidth = mode === 'weeks' ? 154 : 52;
            const bufferWidth = mode === 'days' ? columnWidth : 0;
            const totalViewportWidth = dates.length * columnWidth + bufferWidth;
            widthPx = totalViewportWidth - leftPx + 100; // Add 100px buffer to extend beyond edge
          }
          
                    // Calculate border radius based on extensions
          let borderRadius = '6px';
          if (extendsLeft && extendsRight) {
            borderRadius = '0px';
          } else if (extendsLeft) {
            borderRadius = '0px 6px 6px 0px';
          } else if (extendsRight) {
            borderRadius = '6px 0px 0px 6px';
          }
          
          // Calculate which borders to show
          const borderLeft = extendsLeft ? 'none' : '1px solid #e5e7eb';
          const borderRight = extendsRight ? 'none' : '1px solid #e5e7eb';
          const borderTop = '1px solid #e5e7eb';
          const borderBottom = '1px solid #e5e7eb';
          
          return (
            <>
              {/* White background with outline, rounded corners, and drop shadow */}
              <div
                className="absolute pointer-events-none"
                style={{
                  // Make project bar background 85% opacity for partial see-through
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  left: `${leftPx}px`,
                  width: `${widthPx}px`,
                  top: '0px',
                  height: '48px',
                  zIndex: 1,
                  borderLeft,
                  borderRight,
                  borderTop,
                  borderBottom,
                  borderRadius,
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                }}
              />
            </>
          );
        })()}
        {/* Project rectangles area - positioned to rest bottom edge on top of baseline */}
        <div 
          className="flex w-full relative z-20 flex-1 pointer-events-none" 
          style={{ 
            minWidth: `${dates.length * columnWidth + bufferWidth}px`,
            zIndex: 20,
            gap: 0
          }}
        >
          {(() => {
            // Calculate visually adjusted project dates using consolidated offset logic
            const { visualProjectStart, visualProjectEnd } = calculateVisualProjectDates(
              project, isDragging, dragState
            );
            return dates.map((date, dateIndex) => {
            if (mode === 'weeks') {
              // Weeks mode: Show 7 days in one column (Mon-Sun)
              // Get the week start (Monday) from the date
              const weekStart = new Date(date);
              const dayOfWeek = weekStart.getDay();
              const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek); // Adjust to Monday
              weekStart.setDate(weekStart.getDate() + daysToMonday);
              weekStart.setHours(0, 0, 0, 0);
              // Each week column is 154px, with each day getting exactly 20px
              const dayWidths = [20, 20, 20, 20, 20, 20, 20]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
              return (
                <div key={dateIndex} className="relative h-full items-end" style={{ minWidth: '154px', width: '154px' }}>
                  {/* Flexbox container to align rectangles to baseline */}
                  <div className="flex w-full items-end gap-px h-full">
                    {dayWidths.map((dayWidth, dayIndex) => {
                      const currentDay = new Date(weekStart);
                      currentDay.setDate(weekStart.getDate() + dayIndex);
                      currentDay.setHours(0, 0, 0, 0);
                      // Get pre-aggregated summary for this day from service data
                      const { dailyHours, allocationType, isPlannedTime, isCompletedTime } = (finalTimelineData as any).getPerDateSummary
                        ? (finalTimelineData as any).getPerDateSummary(currentDay)
                        : { dailyHours: 0, allocationType: 'none' as const, isPlannedTime: false, isCompletedTime: false };
                      const rectangleHeight = calculateRectangleHeight(dailyHours);
                      
                      // Determine allocation type for centralized styling
                      const allocType: TimelineAllocationType = isCompletedTime 
                        ? 'completed' 
                        : isPlannedTime 
                          ? 'planned' 
                          : 'auto-estimate';
                      
                      // Get centralized styles
                      const timelineStyle = ColorCalculationService.getTimelineAllocationStyle(
                        allocType,
                        colorScheme
                      );
                      
                      const rectangleStyle = {
                        ...timelineStyle,
                        height: `${rectangleHeight}px`,
                        width: `${dayWidth}px`,
                        position: 'absolute' as const,
                        bottom: '3px',
                        zIndex: 0,
                        borderRadius: '3px',
                      };
                      
                      // NOTE: Work day filtering already handled by dayEstimateCalculations
                      // If an estimate exists, we should render it (trust the calculation)
                      // For planned/completed time, always show regardless of work day settings
                      // Check if this day is within the project date range
                      const currentDayNormalized = normalizeToMidnight(new Date(currentDay));
                      const projectStart = normalizeToMidnight(new Date(visualProjectStart));
                      // For continuous projects, treat viewportEnd as the effective end for range checks; otherwise use visual end
                      const effectiveProjectEnd = normalizeToMidnight(project.continuous 
                        ? new Date(viewportEnd)
                        : new Date(visualProjectEnd));
                      const isDateInProjectRange = currentDayNormalized >= projectStart && currentDayNormalized <= effectiveProjectEnd;
                      
                      return (
                        <div key={dayIndex} className="relative h-full" style={{ width: `${dayWidth}px` }}>
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              <div className="relative h-full w-full group">
                                  {/* Base hover background */}
                                  <div 
                                    className="absolute pointer-events-auto group-hover:bg-gray-100/50 transition-colors rounded"
                                    style={{
                                      top: '3px',
                                      bottom: '3px',
                                      left: 0,
                                      right: 0,
                                      zIndex: 0
                                    }}
                                  />
                                  {/* Holiday pattern overlay - only visible on hover */}
                                  {isHolidayDateCapacity(currentDay, holidays) && (
                                    <div 
                                      className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                      style={{
                                        top: '3px',
                                        bottom: '3px',
                                        left: 0,
                                        right: 0,
                                        backgroundImage: 'repeating-linear-gradient(-45deg, rgba(107,114,128,0.16) 0 1.5px, transparent 1.5px 4px)',
                                        zIndex: 1
                                      }}
                                    />
                                  )}
                                  
                                  {/* Time rectangle - only render if has time */}
                                  {allocationType !== 'none' && (
                                    <div
                                      className={`cursor-move pointer-events-auto absolute ${
                                        isDragging && dragState?.projectId === project.id 
                                          ? 'opacity-90' 
                                          : ''
                                      }`}
                                      style={rectangleStyle}
                                      onMouseDown={(e) => { 
                                        e.preventDefault();
                                        e.stopPropagation(); 
                                        handleMouseDown(e, project.id, 'move'); 
                                      }}
                                      title="Drag to move project"
                                    >
                                      {/* Resize handles for first and last day segments */}
                                      {dayIndex === 0 && (
                                        <div
                                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMouseDown(e, project.id, 'resize-start-date');
                                          }}
                                          title="Drag to change start date"
                                        />
                                      )}
                                      {dayIndex === 6 && (
                                        <div
                                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleMouseDown(e, project.id, 'resize-end-date');
                                          }}
                                          title="Drag to change end date"
                                        />
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                            <TooltipContent
                              backgroundColor={(() => {
                                const match = project.color.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
                                if (!match) return project.color;
                                const [, lightness, chroma, hue] = match;
                                const newLightness = Math.min(1, parseFloat(lightness) + 0.25);
                                const newChroma = Math.max(0, parseFloat(chroma) * 0.3);
                                return `oklch(${newLightness} ${newChroma} ${hue})`;
                              })()}
                              textColor="#1f2937"
                            >
                              <div className="text-xs">
                                <div className="font-semibold mb-1">
                                  {project.name}
                                </div>
                                {allocationType !== 'none' ? (
                                  <>
                                    <div className="font-medium">
                                      {allocationType === 'planned' ? 'Planned Time' : allocationType === 'completed' ? 'Completed Time' : 'Auto-Estimate'}
                                    </div>
                                    <div className="text-gray-600">
                                      {(() => {
                                        const hours = Math.floor(dailyHours);
                                        const minutes = Math.round((dailyHours - hours) * 60);
                                        if (hours > 0 && minutes > 0) {
                                          return `${hours}h${minutes.toString().padStart(2, '0')}`;
                                        } else if (hours > 0) {
                                          return `${hours}h`;
                                        } else {
                                          return `${minutes}m`;
                                        }
                                      })()}
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-gray-600">
                                    {currentDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          
                          {/* Overflow indicator for hours exceeding 8 (second layer: 8-16 hours) - darker overlay */}
                          {isDateInProjectRange && dailyHours > 8 && (
                            <div 
                              className="absolute pointer-events-none"
                              style={{
                                backgroundColor: ColorCalculationService.getDarkerColor(colorScheme.main, 0.20),
                                bottom: '3px',
                                left: '0',
                                width: `${dayWidth}px`,
                                height: `${Math.max(4, Math.min((dailyHours - 8) * 5, 40))}px`,
                                zIndex: 1,
                                borderRadius: '3px',
                              }}
                            />
                          )}
                          
                          {/* Overflow indicator for hours exceeding 16 (third layer: 16-24 hours) - darkest overlay */}
                          {dailyHours > 16 && (
                            <div 
                              className="absolute pointer-events-none"
                              style={{
                                backgroundColor: ColorCalculationService.getDarkerColor(colorScheme.main, 0.30),
                                bottom: '3px',
                                left: '0',
                                width: `${dayWidth}px`,
                                height: `${Math.max(4, Math.min((dailyHours - 16) * 5, 40))}px`,
                                zIndex: 2,
                                borderRadius: '3px',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            } else {
              // Original days mode logic
              // Get time allocation info from day estimates
              const dateNormalized = normalizeToMidnight(new Date(date));
              const { dailyHours: totalHours, allocationType } = (finalTimelineData as any).getPerDateSummary
                ? (finalTimelineData as any).getPerDateSummary(dateNormalized)
                : { dailyHours: 0, allocationType: 'none' as const };
              
              // Determine why there's no time for this day (for tooltip)
              // Check holiday first as it takes precedence
              let noTimeReason: 'holiday' | 'non-project-day' | 'non-work-day' | null = null;
              if (allocationType === 'none') {
                if (isHolidayDateCapacity(date, holidays)) {
                  noTimeReason = 'holiday';
                } else {
                  // Normalize project dates for comparison (using visually adjusted dates)
                  const projectStartCheck = normalizeToMidnight(new Date(visualProjectStart));
                  const projectEndCheck = normalizeToMidnight(new Date(visualProjectEnd));
                  
                  const isInProjectRange = dateNormalized >= projectStartCheck && dateNormalized <= projectEndCheck;
                  
                  if (!isInProjectRange) {
                    noTimeReason = 'non-project-day';
                  } else {
                    const wh = generateWorkHoursForDate(date, settings);
                    const total = calculateWorkHoursTotal(wh);
                    if (total === 0) {
                      noTimeReason = 'non-work-day';
                    }
                  }
                }
              }
              // NOTE: Work day filtering already handled by dayEstimateCalculations
              // If an estimate exists, we should render it (trust the calculation)
              // For planned/completed time, always show regardless of work day settings
              // Normalize project dates for comparison (using visually adjusted dates)
              const projectStart = normalizeToMidnight(new Date(visualProjectStart));
              // For continuous projects, use viewport end as the effective end date
              const projectEnd = normalizeToMidnight(project.continuous 
                ? new Date(viewportEnd) 
                : new Date(visualProjectEnd));
              // Normalize viewport dates
              const normalizedViewportStart = normalizeToMidnight(new Date(viewportStart));
              const normalizedViewportEnd = normalizeToMidnight(new Date(viewportEnd));
              const extendsLeft = projectStart < normalizedViewportStart;
              const extendsRight = project.continuous || projectEnd > normalizedViewportEnd;
              // Find the position of this date among visible working project days
              const visibleWorkingDays = dates.filter((d, i) => {
                const isInProject = projectDays.some(pd => isSameDate(pd, d));
                const wh = generateWorkHoursForDate(d, settings);
                const total = calculateWorkHoursTotal(wh);
                const holiday = isHolidayDateCapacity(d, holidays);
                return isInProject && !holiday && total > 0;
              });
              const workingDayIndex = visibleWorkingDays.findIndex(d => isSameDate(d, date));
              const isFirstWorkingDay = workingDayIndex === 0;
              const isLastWorkingDay = workingDayIndex === visibleWorkingDays.length - 1;
              // Check if there's a milestone segment for this day
              const milestoneSegment = getMilestoneSegmentForDate(date, milestoneSegments);
              // Use the estimates we already calculated correctly above
              const isPlannedTime = allocationType === 'planned';
              const isCompletedTime = allocationType === 'completed';
              const dailyHours = totalHours;
              const rectangleHeight = allocationType === 'none' ? 0 : calculateRectangleHeight(dailyHours);
              // All rectangles now have rounded corners on all sides (4px)
              let borderTopLeftRadius = '4px';
              let borderTopRightRadius = '4px';
              let borderBottomLeftRadius = '4px';
              let borderBottomRightRadius = '4px';
              // Handle horizontal continuity for grouped rectangles
              if (visibleWorkingDays.length === 1) {
                // Single working day - handle extensions
                if (extendsLeft && extendsRight) {
                  borderTopLeftRadius = '0px';
                  borderTopRightRadius = '0px';
                  if (project.continuous) {
                    borderBottomLeftRadius = '0px';
                    borderBottomRightRadius = '0px';
                  }
                } else if (extendsLeft) {
                  borderTopLeftRadius = '0px';
                  if (project.continuous) {
                    borderBottomLeftRadius = '0px';
                  }
                } else if (extendsRight) {
                  borderTopRightRadius = '0px';
                  if (project.continuous) {
                    borderBottomRightRadius = '0px';
                  }
                }
              } else {
                // Multiple working days - handle first/last
                if (isFirstWorkingDay && extendsLeft) {
                  borderTopLeftRadius = '0px';
                  if (project.continuous) {
                    borderBottomLeftRadius = '0px';
                  }
                }
                if (isLastWorkingDay && extendsRight) {
                  borderTopRightRadius = '0px';
                  if (project.continuous) {
                    borderBottomRightRadius = '0px';
                  }
                }
              }
              // Determine allocation type for centralized styling
              const allocType: TimelineAllocationType = isCompletedTime 
                ? 'completed' 
                : isPlannedTime 
                  ? 'planned' 
                  : 'auto-estimate';
              // Get centralized styles
              const timelineStyle = ColorCalculationService.getTimelineAllocationStyle(
                allocType,
                colorScheme
              );
              // Week view specific: add subtle separator for auto-estimate
              const weekViewBorderOverride = allocType === 'auto-estimate' ? {
                borderRight: isLastWorkingDay ? 'none' : '1px solid rgba(255, 255, 255, 0.3)',
              } : {};
              const rectangleStyle = {
                ...timelineStyle,
                ...weekViewBorderOverride,
                borderTopLeftRadius: borderTopLeftRadius,
                borderTopRightRadius: borderTopRightRadius,
                borderBottomLeftRadius: borderBottomLeftRadius,
                borderBottomRightRadius: borderBottomRightRadius,
                height: `${rectangleHeight}px`,
                width: '50px',
                position: 'absolute' as const,
                bottom: '3px',
                zIndex: 0,
              };
              // Check if this date is within the project date range
              const isDateInProject = dateNormalized >= projectStart && dateNormalized <= projectEnd;
              
              return (
                <div key={dateIndex} className="relative h-full" style={{ minWidth: '52px', width: '52px' }}>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                      <div className="relative h-full w-full group">
                        {/* Hover background - only show for dates within project range */}
                        {isDateInProject && (
                          <>
                            {/* Base hover background */}
                            <div 
                              className="absolute pointer-events-auto group-hover:bg-gray-100/50 transition-colors rounded"
                              style={{ 
                                zIndex: 0,
                                height: '40px',
                                width: '50px',
                                left: '1px',
                                top: '3px'
                              }}
                            />
                            {/* Holiday pattern overlay - only visible on hover */}
                            {isHolidayDateCapacity(date, holidays) && (
                              <div 
                                className="absolute pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                style={{ 
                                  zIndex: 1,
                                  height: '40px',
                                  width: '50px',
                                  left: '1px',
                                  top: '3px',
                                  backgroundImage: 'repeating-linear-gradient(-45deg, rgba(107,114,128,0.16) 0 2px, transparent 2px 6px)'
                                }}
                              />
                            )}
                          </>
                        )}
                        
                        {/* Base rectangle - only render if has time */}
                        {allocationType !== 'none' && (
                          <div 
                            className={`cursor-move pointer-events-auto absolute ${ 
                              isDragging && dragState?.projectId === project.id 
                                ? 'opacity-90' 
                                : ''
                            }`}
                            style={rectangleStyle}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleMouseDown(e, project.id, 'move');
                            }}
                          >
                            {/* Resize handles */}
                            {isFirstWorkingDay && (
                              <div
                                className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleMouseDown(e, project.id, 'resize-start-date');
                                }}
                                title="Drag to change start date"
                              />
                            )}
                            {isLastWorkingDay && (
                              <div
                                className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleMouseDown(e, project.id, 'resize-end-date');
                                }}
                                title="Drag to change end date"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      backgroundColor={(() => {
                        const match = project.color.match(/oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+)\)/);
                        if (!match) return project.color;
                        const [, lightness, chroma, hue] = match;
                        const newLightness = Math.min(1, parseFloat(lightness) + 0.25);
                        const newChroma = Math.max(0, parseFloat(chroma) * 0.3);
                        return `oklch(${newLightness} ${newChroma} ${hue})`;
                      })()}
                      textColor="#1f2937"
                    >
                      <div className="text-xs">
                        <div className="font-semibold mb-1">
                          {project.name}
                        </div>
                        {allocationType !== 'none' ? (
                          <>
                            <div className="font-medium">
                              {allocationType === 'planned' ? 'Planned Time' : allocationType === 'completed' ? 'Completed Time' : 'Auto-Estimate'}
                            </div>
                            <div className="text-gray-600">
                              {(() => {
                                const hours = Math.floor(dailyHours);
                                const minutes = Math.round((dailyHours - hours) * 60);
                                if (hours > 0 && minutes > 0) {
                                  return `${hours}h${minutes.toString().padStart(2, '0')}`;
                                } else if (hours > 0) {
                                  return `${hours}h`;
                                } else {
                                  return `${minutes}m`;
                                }
                              })()}
                            </div>
                          </>
                        ) : (
                          <div className="text-gray-500">
                            {noTimeReason === 'holiday' ? 'Holiday' : 
                             noTimeReason === 'non-project-day' ? 'Non-project day' : 
                             noTimeReason === 'non-work-day' ? 'Non-work day' : '0 hrs'}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* Overflow indicator for hours exceeding 8 (second layer: 8-16 hours) - darker overlay */}
                  {allocationType !== 'none' && dailyHours > 8 && (
                    <div 
                      className="absolute pointer-events-none"
                      style={{
                        backgroundColor: ColorCalculationService.getDarkerColor(colorScheme.main, 0.20), // Darker than base
                        bottom: '3px', // Same position as base rectangle - overlays on top
                        left: '0',
                        width: '50px',
                        height: `${Math.max(4, Math.min((dailyHours - 8) * 5, 40))}px`,
                        zIndex: 1,
                        borderRadius: '4px',
                      }}
                    />
                  )}
                  
                  {/* Overflow indicator for hours exceeding 16 (third layer: 16-24 hours) - darkest overlay */}
                  {allocationType !== 'none' && dailyHours > 16 && (
                    <div 
                      className="absolute pointer-events-none"
                      style={{
                        backgroundColor: ColorCalculationService.getDarkerColor(colorScheme.main, 0.30), // Even darker
                        bottom: '3px', // Same position as base rectangle - overlays on top
                        left: '0',
                        width: '50px',
                        height: `${Math.max(4, Math.min((dailyHours - 16) * 5, 40))}px`,
                        zIndex: 2,
                        borderRadius: '4px',
                      }}
                    />
                  )}
                </div>
              );
            }
          });
          })()}
        </div>
        
        {/* Project Icon Indicator - positioned at the start of the project */}
        {(() => {
          const projectStart = new Date(project.startDate);
          const projectEnd = project.continuous 
            ? new Date(viewportEnd)
            : new Date(project.endDate);
          
          const positions = (() => {
            try {
              const result = getTimelinePositions(
                projectStart,
                projectEnd,
                viewportStart,
                viewportEnd,
                dates,
                mode
              );
              return result;
            } catch (error) {
              console.error('Error getting timeline positions:', error);
              return null;
            }
          })();
          
          if (!positions) return null;
          
          const adjustedPositions = calculateBaselineVisualOffsets(
            positions, isDragging, dragState, project.id, mode
          );
          
          return (
            <div 
              className="absolute z-40 pointer-events-auto"
              style={{ 
                left: `${Math.max(adjustedPositions.circleLeftPx - 12, 8)}px`, // Stick with 8px gap from left edge when scrolling off-screen
                top: '12px' // Position vertically centered in the 48px project bar
              }}
            >
              <ProjectIconIndicator project={project} mode={mode} />
            </div>
          );
        })()}
      </div>
    );
  } catch (error) {
    console.error('Error rendering TimelineBar for project:', project?.id, error);
    return <div style={{ height: '40px', background: '#ffebee' }}>Error rendering project bar</div>;
  }
});