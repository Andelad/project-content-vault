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
import { NEUTRAL_COLORS } from '@/constants/colors';
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
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
interface ProjectBarProps {
  project: Project;
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  isDragging: boolean;
  dragState: any;
  mode?: 'days' | 'weeks';
  isMultiProjectRow?: boolean;
  collapsed: boolean;
  onMilestoneDrag?: (milestoneId: string, newDate: Date) => void;
  onMilestoneDragEnd?: () => void;
  onProjectResizeMouseDown?: (e: React.MouseEvent, projectId: string, action: 'resize-start-date' | 'resize-end-date') => void;
}
// Helper function to calculate baseline visual offsets
function calculateBaselineVisualOffsets(positions: any, isDragging: boolean, dragState: any, projectId: string, mode: 'days' | 'weeks' = 'days') {
  try {
    return UnifiedTimelineService.calculateBaselineVisualOffsets(positions, isDragging, dragState, projectId, mode);
  } catch (error) {
    ErrorHandlingService.handle(error, { source: 'ProjectBar', action: 'Error in calculateBaselineVisualOffsets:' });
    return positions; // fallback to original positions
  }
}
// Helper function to calculate visual project dates with consolidated offset logic
function calculateVisualProjectDates(project: any, isDragging: boolean, dragState: any) {
  try {
    return UnifiedTimelineService.calculateVisualProjectDates(project, isDragging, dragState);
  } catch (error) {
    ErrorHandlingService.handle(error, { source: 'ProjectBar', action: 'Error in calculateVisualProjectDates:' });
    return { visualProjectStart: new Date(project.startDate), visualProjectEnd: new Date(project.endDate) }; // fallback
  }
}

// Color calculation functions are now centralized in ColorCalculationService
export const ProjectBar = memo(function ProjectBar({ 
  project, 
  dates, 
  viewportStart, 
  viewportEnd, 
  isDragging, 
  dragState, 
  mode,
  isMultiProjectRow,
  collapsed,
  onMilestoneDrag,
  onMilestoneDragEnd,
  onProjectResizeMouseDown
}: ProjectBarProps) {
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

  const visualProjectDates = useMemo(() => {
    if (!project) return null;
    const isResizing = isDragging &&
      dragState?.projectId === project.id &&
      (dragState?.action === 'resize-start-date' || dragState?.action === 'resize-end-date');

    if (!isResizing) {
      return null;
    }

    return calculateVisualProjectDates(project, isDragging, dragState);
  }, [project, isDragging, dragState]);
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
          baseline: NEUTRAL_COLORS.gray600, 
          completedPlanned: NEUTRAL_COLORS.gray300, 
          main: NEUTRAL_COLORS.gray500, 
          midTone: NEUTRAL_COLORS.gray400, 
          hover: NEUTRAL_COLORS.gray500, 
          autoEstimate: NEUTRAL_COLORS.gray200 
        },
        visualDates: null,
        isWorkingDay: () => false
      };
    }
    const options = visualProjectDates
      ? {
          visualProjectDates: {
            startDate: visualProjectDates.visualProjectStart,
            endDate: visualProjectDates.visualProjectEnd
          }
        }
      : undefined;

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
      events, // Pass events for planned time calculations
      options
    );
  }, [
    project,
    dates,
    viewportStart,
    viewportEnd,
    filteredProjectMilestones,
    holidays,
    settings,
    isDragging,
    dragState,
    events,
    visualProjectDates,
    isWorkingDayChecker
  ]);
  // Extract data for use in component
  const {
    projectDays,
    workHoursForPeriod,
    milestoneSegments, // DEPRECATED: kept for backward compatibility
    projectMetrics,
    colorScheme,
    visualDates,
    isWorkingDay
  } = timelineData as any;
  const { exactDailyHours, dailyHours, dailyMinutes, heightInPixels, workingDaysCount } = projectMetrics;
  // Now we can do early returns - AFTER all hooks
  if (!project) {
    return null;
  }
  if (projectDays.length === 0) {
    return null; // Don't render anything for projects with no duration
  }
  
  // Add buffer for partial column in days mode
  const columnWidth = mode === 'weeks' ? 153 : 52;
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
              ErrorHandlingService.handle(error, { source: 'ProjectBar', action: 'Error getting timeline positions:' });
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
            const columnWidth = mode === 'weeks' ? 153 : 52;
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
          const borderLeft = extendsLeft ? 'none' : `1px solid ${NEUTRAL_COLORS.gray200}`;
          const borderRight = extendsRight ? 'none' : `1px solid ${NEUTRAL_COLORS.gray200}`;
          const borderTop = `1px solid ${NEUTRAL_COLORS.gray200}`;
          const borderBottom = `1px solid ${NEUTRAL_COLORS.gray200}`;
          
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
            const { visualProjectStart, visualProjectEnd } = visualProjectDates
              ?? calculateVisualProjectDates(project, isDragging, dragState);
            
            // In weeks mode, expand each week date into 7 individual days
            // In days mode, use dates as-is
            const individualDates = mode === 'weeks' 
              ? dates.flatMap(weekStart => {
                  return Array.from({ length: 7 }, (_, dayOffset) => {
                    const day = new Date(weekStart);
                    day.setDate(weekStart.getDate() + dayOffset);
                    return normalizeToMidnight(day);
                  });
                })
              : dates;
            
            return individualDates.map((date, dateIndex) => {
              // Get time allocation info from day estimates
              const dateNormalized = normalizeToMidnight(new Date(date));
              const { dailyHours: totalHours, allocationType } = (timelineData as any).getPerDateSummary
                ? (timelineData as any).getPerDateSummary(dateNormalized)
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
                    const wh = generateWorkHoursForDate(date, settings, holidays);
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
                const wh = generateWorkHoursForDate(d, settings, holidays);
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
              // Mode-dependent width calculations
              // In weeks mode: 21px per day (with 1px gaps between)
              // In days mode: 50px rectangle in 52px column
              const dayRectWidth = mode === 'weeks' ? 21 : 50;
              const dayColumnWidth = mode === 'weeks' ? 22 : 52; // includes 1px gap for weeks
              
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
                width: `${dayRectWidth}px`,
                position: 'absolute' as const,
                bottom: '3px',
                zIndex: 0,
              };
              // Check if this date is within the project date range
              const isDateInProject = dateNormalized >= projectStart && dateNormalized <= projectEnd;
              
              return (
                <div key={dateIndex} className="relative h-full" style={{ minWidth: `${dayColumnWidth}px`, width: `${dayColumnWidth}px` }}>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                      <div className="relative h-full w-full group">
                        {/* Hover background - only show for dates within project range */}
                        {isDateInProject && (
                          <>
                            {/* Base hover background - matches availability card darkness */}
                            <div 
                              className="absolute pointer-events-auto rounded"
                              style={{ 
                                zIndex: 0,
                                height: '40px',
                                width: `${dayRectWidth}px`,
                                left: mode === 'weeks' ? '0' : '1px',
                                top: '3px'
                              }}
                            />
                            {/* Darkening overlay on hover - matches availability card */}
                            <div 
                              className="absolute bg-black transition-opacity duration-200 pointer-events-none rounded opacity-0 group-hover:opacity-[0.04]"
                              style={{ 
                                zIndex: 0,
                                height: '40px',
                                width: `${dayRectWidth}px`,
                                left: mode === 'weeks' ? '0' : '1px',
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
                                  width: `${dayRectWidth}px`,
                                  left: mode === 'weeks' ? '0' : '1px',
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
                            className={`pointer-events-none absolute ${ 
                              isDragging && dragState?.projectId === project.id 
                                ? 'opacity-90' 
                                : ''
                            }`}
                            style={rectangleStyle}
                          >
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
                      textColor={NEUTRAL_COLORS.gray800}
                    >
                      <div className="text-xs">
                        <div className="font-semibold mb-1">
                          {project.name}
                          {(project.clientData?.name || project.client) && (
                            <span className="text-gray-500 font-normal"> • {project.clientData?.name || project.client}</span>
                          )}
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
                        width: `${dayRectWidth}px`,
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
                        width: `${dayRectWidth}px`,
                        height: `${Math.max(4, Math.min((dailyHours - 16) * 5, 40))}px`,
                        zIndex: 2,
                        borderRadius: '4px',
                      }}
                    />
                  )}
                </div>
              );
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
              ErrorHandlingService.handle(error, { source: 'ProjectBar', action: 'Error getting timeline positions:' });
              return null;
            }
          })();
          
          if (!positions) return null;
          
          const adjustedPositions = calculateBaselineVisualOffsets(
            positions, isDragging, dragState, project.id, mode
          );
          
          return (
            <div 
              className="absolute z-50 pointer-events-none"
              style={{ 
                left: `${Math.max(adjustedPositions.baselineStartPx - 26, 0)}px`, // Position container
                top: '0px',
                width: '52px',
                height: '48px'
              }}
            >
              <ProjectIconIndicator project={project} mode={mode} />
            </div>
          );
        })()}
        
        {/* Resize handles for project bar start/end dates */}
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
              ErrorHandlingService.handle(error, { source: 'ProjectBar', action: 'Error getting timeline positions:' });
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
          const extendsRight = project.continuous;
          
          const RESIZE_ZONE_WIDTH = 6; // 6px edge zone for resize detection
          
          return (
            <>
              {/* Left resize handle - only show if project doesn't extend beyond left viewport edge */}
              {!extendsLeft && onProjectResizeMouseDown && (
                <div 
                  className="absolute cursor-ew-resize pointer-events-auto group"
                  style={{ 
                    left: `${adjustedPositions.baselineStartPx}px`,
                    top: '0px',
                    width: `${RESIZE_ZONE_WIDTH}px`,
                    height: '48px',
                    zIndex: 40
                  }}
                  title="Drag to change start date"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onProjectResizeMouseDown(e, project.id, 'resize-start-date');
                  }}
                >
                  {/* Hover highlighting - darkened edge */}
                  <div 
                    className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity rounded-l"
                  />
                </div>
              )}
              
              {/* Right resize handle - only show for non-continuous projects */}
              {!extendsRight && onProjectResizeMouseDown && (
                <div 
                  className="absolute cursor-ew-resize pointer-events-auto group"
                  style={{ 
                    left: `${adjustedPositions.baselineStartPx + ((adjustedPositions as any).baselineWidthPx ?? positions.baselineWidthPx) - RESIZE_ZONE_WIDTH}px`,
                    top: '0px',
                    width: `${RESIZE_ZONE_WIDTH}px`,
                    height: '48px',
                    zIndex: 40
                  }}
                  title="Drag to change end date"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onProjectResizeMouseDown(e, project.id, 'resize-end-date');
                  }}
                >
                  {/* Hover highlighting - darkened edge */}
                  <div 
                    className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity rounded-r"
                  />
                </div>
              )}
            </>
          );
        })()}

        {/* Phase markers (diamond shapes) */}
        {(() => {
          // Get phases for this project
          // A phase is a milestone with an endDate (phases track time periods, not just due dates)
          const phases = filteredProjectMilestones.filter(m => {
            return m.endDate !== undefined;
          }).sort((a, b) => {
            const aDate = new Date(a.endDate!).getTime();
            const bDate = new Date(b.endDate!).getTime();
            return aDate - bDate;
          });

          if (phases.length === 0) {
            return null;
          }

          const projectEndDate = project.continuous 
            ? new Date(viewportEnd)
            : normalizeToMidnight(new Date(project.endDate));

          // Calculate positions for phase end markers
          return phases.map((phase, index) => {
            const phaseEndDate = normalizeToMidnight(new Date(phase.endDate!));
            
            // Don't show marker for the last phase if it ends at project end date
            if (phaseEndDate.getTime() === projectEndDate.getTime()) {
              return null;
            }

            // Check if phase end is within viewport
            if (phaseEndDate < normalizeToMidnight(viewportStart) || 
                phaseEndDate > normalizeToMidnight(viewportEnd)) {
              return null;
            }

            // Calculate position relative to viewport
            const positions = getTimelinePositions(
              phaseEndDate,
              phaseEndDate,
              viewportStart,
              viewportEnd,
              dates,
              mode
            );

            if (!positions) {
              return null;
            }

            const adjustedPositions = calculateBaselineVisualOffsets(
              positions, isDragging, dragState, project.id, mode
            );

            // In weeks mode, each day is 22px wide within the 153px week column
            // In days mode, each day column is 52px wide
            const dayWidth = mode === 'weeks' ? 22 : 52;
            // Position marker at the right edge of the phase end date
            const markerPosition = adjustedPositions.baselineStartPx + dayWidth;

            return (
              <Tooltip key={`${phase.id}-marker`} delayDuration={100}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute pointer-events-auto transform -translate-x-1/2 transition-all duration-150 hover:scale-110 hover:z-30"
                    style={{
                      left: `${markerPosition}px`,
                      top: '17.25px', // Center vertically in 48px height (24px midpoint - 6.75px for half diamond)
                      zIndex: 25
                    }}
                    title={`End of ${phase.name}`}
                  >
                    {/* Diamond shape */}
                    <div
                      className="relative transition-all duration-150 hover:shadow-md"
                      style={{
                        width: '13.5px',
                        height: '13.5px',
                        backgroundColor: project.color, // Use project color to match icon indicator
                        transform: 'rotate(45deg)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                      }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div className="font-medium">
                      End of {phase.name}
                    </div>
                    <div className="text-gray-500">
                      {phaseEndDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    {phase.timeAllocation > 0 && (
                      <div className="text-gray-500">
                        {phase.timeAllocation}h allocated
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          });
        })()}
      </div>
    );
  } catch (error) {
    console.error('Error rendering TimelineBar for project:', project?.id, error);
    return <div style={{ height: '40px', background: NEUTRAL_COLORS.gray100 }}>Error rendering project bar</div>;
  }
}, (prevProps, nextProps) => {
  // If a resize drag is active for this project, always re-render for live feedback
  if (nextProps.isDragging && nextProps.dragState?.projectId === nextProps.project.id &&
      (nextProps.dragState?.action === 'resize-start-date' || nextProps.dragState?.action === 'resize-end-date')) {
    return false;
  }

  // If dragging state toggled, re-render to keep visuals in sync
  if (prevProps.isDragging !== nextProps.isDragging) {
    return false;
  }

  // Re-render if drag state object actually changed
  if (prevProps.dragState !== nextProps.dragState) {
    return false;
  }

  // Fall back to shallow checks for key props
  if (prevProps.project.id !== nextProps.project.id) return false;
  if (prevProps.project.startDate !== nextProps.project.startDate) return false;
  if (prevProps.project.endDate !== nextProps.project.endDate) return false;
  if (prevProps.mode !== nextProps.mode) return false;
  if (prevProps.collapsed !== nextProps.collapsed) return false;
  if (prevProps.viewportStart.getTime() !== nextProps.viewportStart.getTime()) return false;
  if (prevProps.viewportEnd.getTime() !== nextProps.viewportEnd.getTime()) return false;

  return true;
});