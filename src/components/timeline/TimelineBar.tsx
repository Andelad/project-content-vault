import React, { memo, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useProjectContext } from '../../contexts/ProjectContext';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { isSameDate } from '@/utils/dateFormatUtils';
import type { Project } from '@/types/core';
import { UnifiedTimelineService } from '@/services';
import { ColorCalculationService } from '@/services/infrastructure/colorCalculations';
import type { TimelineAllocationType } from '@/constants/styles';
import { 
  calculateWeekProjectIntersection,
  generateWorkHoursForDate,
  calculateWorkHoursTotal,
  isHolidayDateCapacity,
  getMilestoneSegmentForDate,
  getTimelinePositions,
  UnifiedDayEstimateService,
  calculateRectangleHeight
} from '@/services';
import { getDateKey } from '@/utils/dateFormatUtils';
import { ProjectIconIndicator, ProjectMilestones } from '@/components';
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
  // Calculate day estimates ONCE per project/milestones/events change
  // This should NOT recalculate when scrolling (viewport changes)
  const dayEstimates = useMemo(() => {
    if (!project) return [];
    // CRITICAL: Filter milestones to only include those for THIS project and WITHIN project dates
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    // Filter milestones for this project within date boundaries
    let projectMilestones = milestones.filter(m => 
      m.projectId === project.id &&
      new Date(m.endDate || m.dueDate) >= projectStart &&
      new Date(m.endDate || m.dueDate) <= projectEnd
    );
    // HYBRID SYSTEM: If there's a template milestone (isRecurring=true), 
    // exclude old numbered instances to prevent double-counting
    const hasTemplateMilestone = projectMilestones.some(m => m.isRecurring === true);
    if (hasTemplateMilestone) {
      projectMilestones = projectMilestones.filter(m => 
        // Keep template milestones
        m.isRecurring === true ||
        // Keep non-recurring regular milestones
        (!m.isRecurring && (!m.name || !/\s\d+$/.test(m.name)))
      );
    }
    const startTime = performance.now();
    const result = UnifiedTimelineService.calculateProjectDayEstimates(
      project,
      projectMilestones, // Use filtered milestones, not all milestones
      settings,
      holidays,
      events
    );
    const endTime = performance.now();
    const calculationTime = endTime - startTime;
    // Warn if calculation takes >10ms (indicates performance issue)
    // Note: 200-300ms can occur for projects with many milestones and long timespans
    // This is because milestone.startDate was corrupted by migration, forcing calculation
    // from project.startDate to milestone.endDate (potentially years of working days)
    // TODO: Fix milestone.startDate in database to enable shorter calculation ranges
    if (calculationTime > 10) {
      console.warn(`[TimelineBar] Day estimates calculation took ${calculationTime.toFixed(2)}ms for project:`, project.name);
    }
    return result;
  }, [project, milestones, settings, holidays, events]);
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
    // CRITICAL: Filter milestones to only include those for THIS project and WITHIN project dates
    const projectStart = new Date(project.startDate);
    const projectEnd = new Date(project.endDate);
    // Filter milestones for this project within date boundaries
    let projectMilestones = milestones.filter(m => 
      m.projectId === project.id &&
      new Date(m.endDate || m.dueDate) >= projectStart &&
      new Date(m.endDate || m.dueDate) <= projectEnd
    );
    // HYBRID SYSTEM: If there's a template milestone (isRecurring=true), 
    // exclude old numbered instances to prevent double-counting
    const hasTemplateMilestone = projectMilestones.some(m => m.isRecurring === true);
    if (hasTemplateMilestone) {
      projectMilestones = projectMilestones.filter(m => 
        // Keep template milestones
        m.isRecurring === true ||
        // Keep non-recurring regular milestones
        (!m.isRecurring && (!m.name || !/\s\d+$/.test(m.name)))
      );
    }
    return UnifiedTimelineService.getTimelineBarData(
      project,
      dates,
      viewportStart,
      viewportEnd,
      projectMilestones, // Use filtered milestones, not all milestones
      holidays,
      settings,
      isDragging,
      dragState,
      isWorkingDayChecker, // Pass the hook result, don't call hook inside service
      events // Pass events for planned time calculations
    );
  }, [project, dates, viewportStart, viewportEnd, milestones, holidays, settings, isDragging, dragState, events]);
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
    console.warn('TimelineBar: No project provided');
    return null;
  }
  if (projectDays.length === 0) {
    return null; // Don't render anything for projects with no duration
  }
  try {
    // Add buffer for partial column in days mode
    const columnWidth = mode === 'weeks' ? 77 : 40;
    const bufferWidth = mode === 'days' ? columnWidth : 0;
    return (
      <div className="relative h-[52px] group pointer-events-none">
      <div className="h-full relative flex flex-col pointer-events-none">
        {/* Project rectangles area - positioned to rest bottom edge on top of baseline */}
        <div 
          className="flex w-full relative z-20 flex-1 pointer-events-none" 
          style={{ 
            minWidth: `${dates.length * columnWidth + bufferWidth}px`,
            zIndex: 20
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
              // Each week column is 77px, with each day getting exactly 11px
              const dayWidths = [11, 11, 11, 11, 11, 11, 11]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
              return (
                <div key={dateIndex} className="relative h-full items-end" style={{ minWidth: '77px', width: '77px' }}>
                  {/* Flexbox container to align rectangles to baseline */}
                  <div className="flex w-full items-end gap-px h-full">
                    {dayWidths.map((dayWidth, dayIndex) => {
                      const currentDay = new Date(weekStart);
                      currentDay.setDate(weekStart.getDate() + dayIndex);
                      currentDay.setHours(0, 0, 0, 0);
                      // Get time allocation for this day from day estimates
                      const dateEstimates = dayEstimates?.filter(est => {
                        const estDate = new Date(est.date);
                        estDate.setHours(0, 0, 0, 0);
                        return estDate.getTime() === currentDay.getTime();
                      }) || [];
                      const totalHours = dateEstimates.reduce((sum, est) => sum + est.hours, 0);
                      // If no allocation, skip (the calculation already ensured this is in project range)
                      if (totalHours === 0) {
                        return <div key={dayIndex} style={{ width: `${dayWidth}px` }}></div>;
                      }
                      // CRITICAL: Events and estimates are mutually exclusive
                      // Domain Rule: Only one type of time per day
                      const eventEstimate = dateEstimates.find(est => est.source === 'event');
                      let allocationType: 'planned' | 'completed' | 'auto-estimate' | 'none';
                      let isPlannedTime = false;
                      let isCompletedTime = false;
                      // DEBUG for Budgi Oct 14-18 and Aug 13
                      const debugDate = getDateKey(currentDay);
                      const shouldDebug = project.name === 'Budgi' && (
                        (debugDate >= '2024-10-14' && debugDate <= '2024-10-18') ||
                        debugDate === '2024-08-13'
                      );
                      if (eventEstimate) {
                        if (shouldDebug) {
                          console.log(`[TimelineBar ${debugDate}] eventEstimate:`, {
                            source: eventEstimate.source,
                            isPlannedEvent: eventEstimate.isPlannedEvent,
                            isCompletedEvent: eventEstimate.isCompletedEvent,
                            hours: eventEstimate.hours
                          });
                        }
                        // This day has EVENT time (not estimates)
                        // Check if it's planned, completed, or both
                        if (eventEstimate.isPlannedEvent && eventEstimate.isCompletedEvent) {
                          // Mixed: has both planned and completed events (show as planned for now)
                          allocationType = 'planned';
                          isPlannedTime = true;
                        } else if (eventEstimate.isPlannedEvent) {
                          allocationType = 'planned';
                          isPlannedTime = true;
                        } else if (eventEstimate.isCompletedEvent) {
                          allocationType = 'completed';
                          isCompletedTime = true;
                        } else {
                          allocationType = 'none';
                        }
                        if (shouldDebug) {
                        }
                      } else if (totalHours > 0) {
                        // No events, but has hours = auto-estimate
                        allocationType = 'auto-estimate';
                        if (shouldDebug) {
                        }
                      } else {
                        allocationType = 'none';
                      }
                      const heightInPixels = calculateRectangleHeight(totalHours);
                      // NOTE: Work day filtering already handled by dayEstimateCalculations
                      // If an estimate exists, we should render it (trust the calculation)
                      // For planned/completed time, always show regardless of work day settings
                      return (
                        <Tooltip key={dayIndex} delayDuration={100}>
                          <TooltipTrigger asChild>
                            <div
                              className={`cursor-move relative pointer-events-auto ${
                                isDragging && dragState?.projectId === project.id 
                                  ? 'opacity-90' 
                                  : ''
                              }`}
                              style={(() => {
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
                                return {
                                  ...timelineStyle,
                                  height: `${heightInPixels}px`,
                                  width: `${dayWidth}px`, // Full width since gap-px handles spacing
                                  borderTopLeftRadius: '2px',
                                  borderTopRightRadius: '2px',
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
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleMouseDown(e, project.id, 'resize-start-date');
                                  }}
                                  title="Drag to change start date"
                                />
                              )}
                              {dayOfWeek === 6 && (
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
                          </TooltipTrigger>
                          <TooltipContent>
                            {(() => {
                              // Calculate tooltip info - FIX: Include completed time
                              const tooltipType = isPlannedTime ? 'Planned time' : isCompletedTime ? 'Completed time' : 'Auto-estimate';
                              const displayHours = Math.floor(totalHours);
                              const displayMinutes = Math.round((totalHours - displayHours) * 60);
                              const displayText = displayHours > 0 && displayMinutes > 0
                                ? `${displayHours}h ${displayMinutes}m`
                                : displayHours > 0 
                                  ? `${displayHours}h`
                                  : `${displayMinutes}m`;
                              return (
                                <div className="text-xs">
                                  <div className="font-medium">
                                    {tooltipType}
                                  </div>
                                  <div className="text-gray-600">
                                    {displayText}
                                  </div>
                                  {dateEstimates.length > 0 && (
                                    <div className="text-gray-600 mt-1">
                                      {dateEstimates.map((est, idx) => {
                                        const estHours = Math.floor(est.hours);
                                        const estMinutes = Math.round((est.hours - estHours) * 60);
                                        const estText = estHours > 0 && estMinutes > 0
                                          ? `${estHours}h ${estMinutes}m`
                                          : estHours > 0
                                            ? `${estHours}h`
                                            : `${estMinutes}m`;
                                        // FIX: Handle event source properly
                                        let sourceLabel = 'Auto-estimate';
                                        if (est.source === 'event') {
                                          sourceLabel = est.isPlannedEvent ? 'Planned event' : 'Completed event';
                                        } else if (est.source === 'milestone-allocation') {
                                          sourceLabel = 'Milestone';
                                        }
                                        return (
                                          <div key={idx}>
                                            {`${sourceLabel}: ${estText}`}
                                          </div>
                                        );
                                      })}
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
              // Get time allocation info from day estimates
              const dateNormalized = new Date(date);
              dateNormalized.setHours(0, 0, 0, 0);
              const estimatesForDate = dayEstimates?.filter(est => {
                const estDate = new Date(est.date);
                estDate.setHours(0, 0, 0, 0);
                return estDate.getTime() === dateNormalized.getTime();
              }) || [];
              const totalHours = estimatesForDate.reduce((sum, est) => sum + est.hours, 0);
              // CRITICAL: Events and estimates are mutually exclusive
              const eventEstimate = estimatesForDate.find(est => est.source === 'event');
              let allocationType: 'planned' | 'completed' | 'auto-estimate' | 'none';
              if (eventEstimate) {
                // This day has EVENT time (not estimates)
                if (eventEstimate.isPlannedEvent && eventEstimate.isCompletedEvent) {
                  // Mixed: has both planned and completed events (show as planned for now)
                  allocationType = 'planned';
                } else if (eventEstimate.isPlannedEvent) {
                  allocationType = 'planned';
                } else if (eventEstimate.isCompletedEvent) {
                  allocationType = 'completed';
                } else {
                  allocationType = 'none';
                }
              } else if (totalHours > 0) {
                // No events, but has hours = auto-estimate
                allocationType = 'auto-estimate';
              } else {
                allocationType = 'none';
              }
              // Don't render if no time allocation (the calculation already ensured this is in project range)
              if (allocationType === 'none') {
                return <div key={dateIndex} className="h-full" style={{ minWidth: '40px', width: '40px' }}></div>;
              }
              // NOTE: Work day filtering already handled by dayEstimateCalculations
              // If an estimate exists, we should render it (trust the calculation)
              // For planned/completed time, always show regardless of work day settings
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
              const rectangleHeight = calculateRectangleHeight(dailyHours);
              // Determine border radius for this day rectangle based on working days
              // Always round upper corners by 3px, remove bottom rounding on last rectangles
              let borderTopLeftRadius = '3px';
              let borderTopRightRadius = '3px';
              const borderBottomLeftRadius = '0px';
              const borderBottomRightRadius = '0px';
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
                width: isLastWorkingDay ? '40px' : '39px',
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
                      >
                        <div
                          className="absolute inset-0"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleMouseDown(e, project.id, 'move');
                          }}
                          title="Drag to move project"
                        />
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
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs">
                        <div className="font-medium">
                          {allocationType === 'planned' ? 'Planned Time' : allocationType === 'completed' ? 'Completed Time' : 'Auto-Estimate'}
                        </div>
                        <div className="text-gray-600">
                          {(() => {
                            const hours = Math.floor(dailyHours);
                            const minutes = Math.round((dailyHours - hours) * 60);
                            if (hours > 0 && minutes > 0) {
                              return `${hours}h ${minutes}m`;
                            } else if (hours > 0) {
                              return `${hours}h`;
                            } else {
                              return `${minutes}m`;
                            }
                          })()}
                        </div>
                      </div>
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
          // Use unified UI positioning service for consistent calculations
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
          if (!positions) {
            console.error('Failed to get timeline positions');
            return null;
          }
          // Apply immediate drag offset using consolidated visual offset logic
          const adjustedPositions = calculateBaselineVisualOffsets(
            positions, isDragging, dragState, project.id, mode
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
                  left: `${adjustedPositions.baselineStartPx}px`,
                  width: `${(adjustedPositions as any).baselineWidthPx ?? positions.baselineWidthPx}px`,
                  zIndex: 25
                } : {
                  // For regular projects, use solid background
                  backgroundColor: colorScheme.baseline,
                  left: `${adjustedPositions.baselineStartPx}px`,
                  width: `${(adjustedPositions as any).baselineWidthPx ?? positions.baselineWidthPx}px`,
                  zIndex: 25
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMouseDown(e, project.id, 'move');
                }}
                title="Drag to move project"
              />
              {/* Start date drag circle - center it at the left edge of start column */}
              <div
                className="absolute w-[11px] h-[11px] rounded-full shadow-sm cursor-ew-resize pointer-events-auto hover:scale-110 transition-transform"
                style={{ 
                  backgroundColor: colorScheme.baseline,
                  left: `${adjustedPositions.circleLeftPx - 5.5}px`, // Center circle at left edge of start column
                  top: '-4px', // Center 11px circle on 3px baseline (5.5px above, 2.5px below)
                  zIndex: 30
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
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
                    e.preventDefault();
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
                projectPositions={
                  // Only apply drag offset to milestones during 'move' action
                  isDragging && dragState?.projectId === project.id && dragState?.action === 'move'
                    ? adjustedPositions
                    : positions
                }
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
    )
  } catch (error) {
    console.error('Error rendering TimelineBar for project:', project?.id, error);
    return <div style={{ height: '40px', background: '#ffebee' }}>Error rendering project bar</div>;
  }
});