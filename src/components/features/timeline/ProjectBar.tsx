import React, { memo, useMemo } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shadcn/tooltip';
import { useProjectContext } from '@/contexts/ProjectContext';
import { usePlannerContext } from '@/contexts/PlannerContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { isSameDate } from '@/utils/dateFormatUtils';
import type { Project, PhaseDTO } from '@/types/core';
import { 
  calculateBaselineVisualOffsets as baselineOffsets,
  calculateVisualProjectDates as visualDates,
  createWorkingDayChecker
} from '@/services';
import { getTimelineBarData } from '@/services/orchestrators/TimelineOrchestrator';
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
import { getPhasesSortedByEndDate } from '@/domain/rules/phases/PhaseRules';
import { ProjectIconIndicator } from './ProjectIconIndicator';
import { DraggablePhaseMarkers } from './DraggablePhaseMarkers';
import { ErrorHandlingService } from '@/services/infrastructure/ErrorHandlingService';
import { PhaseRecurrenceService } from '@/domain/rules/phases/PhaseRecurrence';
import type { DragState } from '@/services/ui/DragPositioning';
import type { TimelinePositionCalculation } from '@/services/ui/ProjectBarPositioning';

interface ProjectBarProps {
  project: Project;
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  isDragging: boolean;
  dragState: DragState | null;
  mode?: 'days' | 'weeks';
  isMultiProjectRow?: boolean;
  collapsed: boolean;
  onMilestoneDrag?: (milestoneId: string, newDate: Date) => void;
  onMilestoneDragEnd?: () => void;
  onProjectResizeMouseDown?: (e: React.MouseEvent, projectId: string, action: 'resize-start-date' | 'resize-end-date') => void;
  onPhaseResizeMouseDown?: (e: React.MouseEvent, projectId: string, phaseId: string, action: 'resize-phase-start' | 'resize-phase-end') => void;
}
// Helper function to calculate baseline visual offsets
function calculateBaselineVisualOffsets(
  positions: TimelinePositionCalculation,
  isDragging: boolean,
  dragState: DragState | null,
  projectId: string,
  mode: 'days' | 'weeks' = 'days'
) {
  try {
    return baselineOffsets(positions, isDragging, dragState, projectId, mode);
  } catch (error) {
    ErrorHandlingService.handle(error, { source: 'ProjectBar', action: 'Error in calculateBaselineVisualOffsets:' });
    return positions; // fallback to original positions
  }
}
// Helper function to calculate visual project dates with consolidated offset logic
function calculateVisualProjectDates(
  project: Project,
  isDragging: boolean,
  dragState: DragState | null
) {
  try {
    return visualDates(project, isDragging, dragState);
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
  onProjectResizeMouseDown,
  onPhaseResizeMouseDown
}: ProjectBarProps) {
  // Always call ALL hooks first, before any early returns (React Rules of Hooks)
  const {phases} = useProjectContext();
  const { events, holidays } = usePlannerContext();
  const { settings } = useSettingsContext();
  // CRITICAL: Call this hook at top level, NOT inside useMemo
  // This was causing "Do not call Hooks inside useMemo" error
  const isWorkingDayChecker = createWorkingDayChecker(
    settings.weeklyWorkHours, 
    holidays
  );
  // Centralized filtered milestones for this project (once per relevant change)
  const filteredProjectMilestones = useMemo<PhaseDTO[]>(() => {
    if (!project) return [];
    const projectStart = new Date(project.startDate);
    const projectEnd = project.continuous || !project.endDate ? null : new Date(project.endDate);
    let projectPhases = phases.filter(p => {
      if (p.projectId !== project.id) return false;
      const phaseDate = new Date(p.endDate || p.dueDate);
      if (phaseDate < projectStart) return false;
      if (project.continuous || !projectEnd) return true;
      return phaseDate <= projectEnd;
    });
    const hasTemplateMilestone = projectPhases.some(p => p.isRecurring === true);
    if (hasTemplateMilestone) {
      projectPhases = projectPhases.filter(p => 
        p.isRecurring === true || (!p.isRecurring && (!p.name || !/\s\d+$/.test(p.name)))
      );
    }
    return projectPhases;
  }, [project, phases]);

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
  // Get comprehensive timeline bar data - MUST be before early returns
  const timelineData = useMemo<ReturnType<typeof getTimelineBarData>>(() => {
    const options = visualProjectDates
      ? {
          visualProjectDates: {
            startDate: visualProjectDates.visualProjectStart,
            endDate: visualProjectDates.visualProjectEnd
          }
        }
      : undefined;

    return getTimelineBarData(
      project,
      dates,
      viewportStart,
      viewportEnd,
      filteredProjectMilestones, // Use filtered phases, not all milestones
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
    dayEstimates,
    workHoursForPeriod,
    milestoneSegments, // DEPRECATED: kept for backward compatibility
    projectMetrics,
    colorScheme,
    visualDates,
    isWorkingDay,
    getPerDateSummary
  } = timelineData;
  const { exactDailyHours, dailyHours, dailyMinutes, heightInPixels, workingDaysCount } = projectMetrics;
  
  // Debug logging removed
  
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
        {/* White background - split by phases if they exist */}
        {(() => {
          const sortedPhases = getPhasesSortedByEndDate(filteredProjectMilestones);
          const hasPhases = sortedPhases.length > 0;
          
          // For continuous projects with recurring phases, generate segments from occurrence dates
          if (project.continuous && hasPhases && sortedPhases.some(p => p.isRecurring)) {
            
            // Get the recurring phase
            const recurringPhase = sortedPhases.find(p => p.isRecurring);
            
            if (recurringPhase) {
              // Only generate occurrences for visible viewport + buffer
              const viewportStartNormalized = normalizeToMidnight(new Date(viewportStart));
              const viewportEndNormalized = normalizeToMidnight(new Date(viewportEnd));
              
              // Add buffer: 1 occurrence before and after viewport
              const bufferStart = new Date(viewportStartNormalized);
              bufferStart.setDate(bufferStart.getDate() - 90); // ~3 months buffer before
              
              const bufferEnd = new Date(viewportEndNormalized);
              bufferEnd.setDate(bufferEnd.getDate() + 90); // ~3 months buffer after
              
              const effectiveStart = bufferStart < new Date(project.startDate) ? new Date(project.startDate) : bufferStart;
              const effectiveEnd = project.continuous ? bufferEnd : (project.endDate ? new Date(project.endDate) : bufferEnd);
              
              // Generate occurrence dates only for buffered viewport (not all ~1000 occurrences!)
              // Use RRule directly to generate only visible occurrences
              const rruleString = recurringPhase.recurringConfig.rrule || 
                PhaseRecurrenceService.generateRRuleFromConfig(
                  recurringPhase.recurringConfig,
                  effectiveStart,
                  effectiveEnd,
                  false // Don't use continuous flag here - we want limited range
                );
              
              const viewportOccurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
                rruleString,
                effectiveStart,
                effectiveEnd,
                undefined // No max limit - the date range is already constrained
              );
              
              const occurrenceDates = viewportOccurrences.map(occ => occ.date);
              
              // Convert occurrence dates to occurrence ranges (from one occurrence to the next)
              const phaseOccurrences: Array<{ startDate: Date; endDate: Date }> = [];
              
              // Handle FIRST occurrence specially - it may extend from before the viewport
              if (occurrenceDates.length > 0) {
                const firstOccurrence = new Date(occurrenceDates[0]);
                const secondOccurrence = occurrenceDates.length > 1 ? new Date(occurrenceDates[1]) : null;
                
                // CRITICAL: First segment ALWAYS starts from project start, not from first occurrence
                // This ensures we don't skip days before the first weekly/monthly anchor
                const periodStart = new Date(project.startDate);
                
                // First segment ends the day BEFORE the first occurrence (the anchor)
                let periodEnd: Date = new Date(firstOccurrence);
                periodEnd.setDate(periodEnd.getDate() - 1); // Day BEFORE first anchor
                
                // Only add if valid period (project start might be same as first occurrence)
                if (periodStart <= periodEnd) {
                  phaseOccurrences.push({
                    startDate: periodStart,
                    endDate: periodEnd
                  });
                }
              }
              
              // Handle remaining occurrences (from FIRST occurrence onwards, not second)
              for (let i = 1; i < occurrenceDates.length; i++) {
                const prevOccurrence = new Date(occurrenceDates[i - 1]);
                const currentOccurrence = new Date(occurrenceDates[i]);
                
                // Work period: FROM anchor (inclusive) TO day before next anchor (inclusive)
                // This matches the logic in dayEstimateCalculations.ts and gives exactly 7 days for weekly
                const rawStart = prevOccurrence; // Start ON the anchor, not day after
                const rawEnd = new Date(currentOccurrence);
                rawEnd.setDate(rawEnd.getDate() - 1); // Day BEFORE next anchor
                
                // Clamp to project window (for first occurrence when anchor is before project start)
                const periodStart = rawStart < new Date(project.startDate) 
                  ? new Date(project.startDate) 
                  : rawStart;
                const periodEnd = rawEnd;
                
                // Skip if period is invalid
                if (periodStart > periodEnd) {
                  continue;
                }
                
                phaseOccurrences.push({
                  startDate: periodStart,
                  endDate: periodEnd
                });
              }
              
              
              // Render segments for each occurrence
              return (
              <>
                {phaseOccurrences.map((occurrence, index) => {
                  const positions = (() => {
                    try {
                      return getTimelinePositions(
                        occurrence.startDate,
                        occurrence.endDate,
                        viewportStart,
                        viewportEnd,
                        dates,
                        mode
                      );
                    } catch (error) {
                      ErrorHandlingService.handle(error, { source: 'ProjectBar', action: 'Error getting phase occurrence positions:' });
                      return null;
                    }
                  })();
                  
                  if (index === 0) {
                    console.log('🔍 DEBUG - First segment positions check:', {
                      index,
                      startDate: occurrence.startDate.toISOString().split('T')[0],
                      endDate: occurrence.endDate.toISOString().split('T')[0],
                      viewportStart,
                      viewportEnd,
                      positions,
                      positionsIsNull: positions === null
                    });
                  }
                  
                  if (!positions) return null;
                  
                  const adjustedPositions = calculateBaselineVisualOffsets(
                    positions, isDragging, dragState, project.id, mode
                  );
                  
                  let leftPx = adjustedPositions.baselineStartPx;
                  let widthPx = adjustedPositions.baselineWidthPx ?? positions.baselineWidthPx;
                  
                  // In weeks mode, reduce width to prevent overlap between segments
                  if (mode === 'weeks' && index < phaseOccurrences.length - 1) {
                    widthPx = Math.max(0, widthPx - 5); // Reduce by 5px so segments just touch
                  }
                  
                  if (widthPx <= 0) return null;
                  
                  // Determine if this occurrence extends beyond viewport
                  const normalizedViewportStart = normalizeToMidnight(new Date(viewportStart));
                  const normalizedViewportEnd = normalizeToMidnight(new Date(viewportEnd));
                  const extendsLeft = occurrence.startDate < normalizedViewportStart;
                  const extendsRight = index === phaseOccurrences.length - 1 && occurrence.endDate >= normalizedViewportEnd;
                  
                  // Calculate border radius
                  let borderRadius = '6px';
                  if (extendsLeft && extendsRight) {
                    borderRadius = '0px';
                  } else if (extendsLeft) {
                    borderRadius = '0px 6px 6px 0px';
                  } else if (extendsRight) {
                    borderRadius = '6px 0px 0px 6px';
                  }
                  
                  // Calculate borders
                  const borderLeft = (index === 0 && !extendsLeft) ? `1px solid ${NEUTRAL_COLORS.gray200}` : 'none';
                  const borderRight = (index === phaseOccurrences.length - 1 && !extendsRight) ? `1px solid ${NEUTRAL_COLORS.gray200}` : 'none';
                  const borderTop = `1px solid ${NEUTRAL_COLORS.gray200}`;
                  const borderBottom = `1px solid ${NEUTRAL_COLORS.gray200}`;
                  
                  return (
                    <div
                      key={`phase-occurrence-${index}`}
                      className="absolute pointer-events-none"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.75)',
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
                  );
                })}
                
                {/* Draw connecting lines and curves between occurrences */}
                {phaseOccurrences.map((occurrence, index) => {
                  if (index === phaseOccurrences.length - 1) return null; // No line after last occurrence
                  
                  const currentOccurrenceEnd = normalizeToMidnight(new Date(occurrence.endDate));
                  const nextOccurrence = phaseOccurrences[index + 1];
                  const nextOccurrenceStart = normalizeToMidnight(new Date(nextOccurrence.startDate));
                  
                  // Check if there's a gap between occurrences
                  const daysBetween = Math.floor((nextOccurrenceStart.getTime() - currentOccurrenceEnd.getTime()) / (24 * 60 * 60 * 1000)) - 1;
                  
                  if (daysBetween > 0) {
                    // Calculate line position
                    const endPositions = (() => {
                      try {
                        return getTimelinePositions(
                          currentOccurrenceEnd,
                          currentOccurrenceEnd,
                          viewportStart,
                          viewportEnd,
                          dates,
                          mode
                        );
                      } catch (error) {
                        return null;
                      }
                    })();
                    
                    const startPositions = (() => {
                      try {
                        return getTimelinePositions(
                          nextOccurrenceStart,
                          nextOccurrenceStart,
                          viewportStart,
                          viewportEnd,
                          dates,
                          mode
                        );
                      } catch (error) {
                        return null;
                      }
                    })();
                    
                    if (!endPositions || !startPositions) return null;
                    
                    const adjustedEndPos = calculateBaselineVisualOffsets(
                      endPositions, isDragging, dragState, project.id, mode
                    );
                    const adjustedStartPos = calculateBaselineVisualOffsets(
                      startPositions, isDragging, dragState, project.id, mode
                    );
                    
                    // Position line from end of current occurrence to start of next occurrence
                    const dayRectWidth = mode === 'weeks' ? 21 : 50;
                    const weeksModeOffset = mode === 'weeks' ? 4 : 0;
                    const lineStart = adjustedEndPos.baselineStartPx + dayRectWidth + weeksModeOffset;
                    const lineEnd = adjustedStartPos.baselineStartPx;
                    const lineWidth = lineEnd - lineStart;
                    
                    if (lineWidth <= 0) return null;
                    
                    const barHeight = 48;
                    const lineHeight = 3;
                    const lineTop = (barHeight - lineHeight) / 2;
                    
                    const curveSquareSize = lineTop - 0;
                    const curveWidth = curveSquareSize;
                    const curveHeight = curveSquareSize * 2;
                    const curveTop = (barHeight - curveHeight) / 2;
                    
                    return (
                      <React.Fragment key={`occurrence-connector-${index}`}>
                        {/* Right curve from end of current occurrence */}
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: `${lineStart}px`,
                            top: `${curveTop}px`,
                            width: `${curveWidth}px`,
                            height: `${curveHeight}px`,
                            zIndex: 1,
                          }}
                        >
                          <path
                            d={`M 0 0 Q 0 ${curveSquareSize} ${curveWidth} ${curveSquareSize} L ${curveWidth} ${curveSquareSize + lineHeight} Q 0 ${curveSquareSize + lineHeight} 0 ${curveHeight} Z`}
                            fill="rgba(255, 255, 255, 0.75)"
                            stroke={NEUTRAL_COLORS.gray200}
                            strokeWidth="1"
                          />
                        </svg>
                        
                        {/* Connecting line */}
                        <div
                          className="absolute pointer-events-none"
                          style={{
                            backgroundColor: NEUTRAL_COLORS.gray300,
                            left: `${lineStart + curveWidth}px`,
                            width: `${lineWidth - (curveWidth * 2)}px`,
                            top: `${lineTop}px`,
                            height: `${lineHeight}px`,
                            zIndex: 1,
                            borderTop: `1px solid ${NEUTRAL_COLORS.gray200}`,
                            borderBottom: `1px solid ${NEUTRAL_COLORS.gray200}`,
                            boxShadow: '0 0.5px 1.5px 0 rgba(0, 0, 0, 0.1), 0 0.5px 1px 0 rgba(0, 0, 0, 0.06)'
                          }}
                        />
                        
                        {/* Left curve into start of next occurrence */}
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: `${lineEnd - curveWidth}px`,
                            top: `${curveTop}px`,
                            width: `${curveWidth}px`,
                            height: `${curveHeight}px`,
                            zIndex: 1,
                          }}
                        >
                          <path
                            d={`M 0 ${curveSquareSize} Q ${curveWidth} ${curveSquareSize} ${curveWidth} 0 L ${curveWidth} ${curveHeight} Q ${curveWidth} ${curveSquareSize + lineHeight} 0 ${curveSquareSize + lineHeight} Z`}
                            fill="rgba(255, 255, 255, 0.75)"
                            stroke={NEUTRAL_COLORS.gray200}
                            strokeWidth="1"
                          />
                        </svg>
                      </React.Fragment>
                    );
                  }
                  return null;
                })}
              </>
            );
            }
          }
          
          // If project has phases (non-continuous or non-recurring), render a segment for each phase
          if (hasPhases) {
            return (
              <>
                {sortedPhases.map((phase, index) => {
                  const phaseStartDate = normalizeToMidnight(new Date(phase.startDate!));
                  const phaseEndDate = normalizeToMidnight(new Date(phase.endDate!));
                  
                  const positions = (() => {
                    try {
                      return getTimelinePositions(
                        phaseStartDate,
                        phaseEndDate,
                        viewportStart,
                        viewportEnd,
                        dates,
                        mode
                      );
                    } catch (error) {
                      ErrorHandlingService.handle(error, { source: 'ProjectBar', action: 'Error getting phase segment positions:' });
                      return null;
                    }
                  })();
                  
                  if (!positions) return null;
                  
                  const adjustedPositions = calculateBaselineVisualOffsets(
                    positions, isDragging, dragState, project.id, mode
                  );
                  
                  const leftPx = adjustedPositions.baselineStartPx;
                  const widthPx = adjustedPositions.baselineWidthPx ?? positions.baselineWidthPx;
                  
                  if (widthPx <= 0) return null;
                  
                  // Determine if this phase extends beyond viewport
                  const normalizedViewportStart = normalizeToMidnight(new Date(viewportStart));
                  const normalizedViewportEnd = normalizeToMidnight(new Date(viewportEnd));
                  const extendsLeft = phaseStartDate < normalizedViewportStart;
                  const extendsRight = phaseEndDate > normalizedViewportEnd;
                  
                  // Calculate border radius - all corners rounded like project bar
                  let borderRadius = '6px';
                  if (extendsLeft && extendsRight) {
                    borderRadius = '0px';
                  } else if (extendsLeft) {
                    borderRadius = '0px 6px 6px 0px';
                  } else if (extendsRight) {
                    borderRadius = '6px 0px 0px 6px';
                  }
                  
                  // Calculate borders
                  const borderLeft = (index === 0 && !extendsLeft) ? `1px solid ${NEUTRAL_COLORS.gray200}` : 'none';
                  const borderRight = (index === sortedPhases.length - 1 && !extendsRight) ? `1px solid ${NEUTRAL_COLORS.gray200}` : 'none';
                  const borderTop = `1px solid ${NEUTRAL_COLORS.gray200}`;
                  const borderBottom = `1px solid ${NEUTRAL_COLORS.gray200}`;
                  
                  return (
                    <div
                      key={`phase-segment-${phase.id}`}
                      className="absolute pointer-events-none"
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.75)',
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
                  );
                })}
                
                {/* Draw connecting lines and curves between phases */}
                {sortedPhases.map((phase, index) => {
                  if (index === sortedPhases.length - 1) return null; // No line after last phase
                  
                  const currentPhaseEndDate = normalizeToMidnight(new Date(phase.endDate!));
                  const nextPhase = sortedPhases[index + 1];
                  const nextPhaseStartDate = normalizeToMidnight(new Date(nextPhase.startDate!));
                  
                  // Check if there's a gap between phases
                  const daysBetween = Math.floor((nextPhaseStartDate.getTime() - currentPhaseEndDate.getTime()) / (24 * 60 * 60 * 1000)) - 1;
                  
                  if (daysBetween > 0) {
                    // Calculate line position
                    const endPositions = (() => {
                      try {
                        return getTimelinePositions(
                          currentPhaseEndDate,
                          currentPhaseEndDate,
                          viewportStart,
                          viewportEnd,
                          dates,
                          mode
                        );
                      } catch (error) {
                        return null;
                      }
                    })();
                    
                    const startPositions = (() => {
                      try {
                        return getTimelinePositions(
                          nextPhaseStartDate,
                          nextPhaseStartDate,
                          viewportStart,
                          viewportEnd,
                          dates,
                          mode
                        );
                      } catch (error) {
                        return null;
                      }
                    })();
                    
                    if (!endPositions || !startPositions) return null;
                    
                    const adjustedEndPos = calculateBaselineVisualOffsets(
                      endPositions, isDragging, dragState, project.id, mode
                    );
                    const adjustedStartPos = calculateBaselineVisualOffsets(
                      startPositions, isDragging, dragState, project.id, mode
                    );
                    
                    // Position line from end of current phase to start of next phase
                    const dayRectWidth = mode === 'weeks' ? 21 : 50;
                    const weeksModeOffset = mode === 'weeks' ? 4 : 0;
                    const lineStart = adjustedEndPos.baselineStartPx + dayRectWidth + weeksModeOffset;
                    const lineEnd = adjustedStartPos.baselineStartPx;
                    const lineWidth = lineEnd - lineStart;
                    
                    if (lineWidth <= 0) return null;
                    
                    const barHeight = 48;
                    const lineHeight = 3;
                    const lineTop = (barHeight - lineHeight) / 2; // Vertical center (22.5)
                    
                    // Each curve is a square - width = height
                    // We have top and bottom curves, so total height is 2x the width
                    const curveSquareSize = lineTop - 0; // Distance from top to line center (22.5)
                    const curveWidth = curveSquareSize; // Make it square: 22.5px wide x 22.5px tall for each
                    const curveHeight = curveSquareSize * 2; // Total height for both curves (45px)
                    const curveTop = (barHeight - curveHeight) / 2; // Center vertically (1.5)
                    
                    return (
                      <React.Fragment key={`phase-connector-${phase.id}`}>
                        {/* Right curve from end of current phase - extends into gap */}
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: `${lineStart}px`,
                            top: `${curveTop}px`,
                            width: `${curveWidth}px`,
                            height: `${curveHeight}px`,
                            zIndex: 1,
                          }}
                        >
                          {/* Fill area with convex curves */}
                          <path
                            d={`M 0 0 Q 0 ${curveSquareSize} ${curveWidth} ${curveSquareSize} L ${curveWidth} ${curveSquareSize + lineHeight} Q 0 ${curveSquareSize + lineHeight} 0 ${curveHeight} Z`}
                            fill="rgba(255, 255, 255, 0.75)"
                            stroke={NEUTRAL_COLORS.gray200}
                            strokeWidth="1"
                          />
                        </svg>
                        
                        {/* Connecting line */}
                        <div
                          className="absolute pointer-events-none"
                          style={{
                            backgroundColor: NEUTRAL_COLORS.gray300,
                            left: `${lineStart + curveWidth}px`,
                            width: `${lineWidth - (curveWidth * 2)}px`,
                            top: `${lineTop}px`,
                            height: `${lineHeight}px`,
                            zIndex: 1,
                            borderTop: `1px solid ${NEUTRAL_COLORS.gray200}`,
                            borderBottom: `1px solid ${NEUTRAL_COLORS.gray200}`,
                            boxShadow: '0 0.5px 1.5px 0 rgba(0, 0, 0, 0.1), 0 0.5px 1px 0 rgba(0, 0, 0, 0.06)'
                          }}
                        />
                        
                        {/* Left curve into start of next phase - extends into gap */}
                        <svg
                          className="absolute pointer-events-none"
                          style={{
                            left: `${lineEnd - curveWidth}px`,
                            top: `${curveTop}px`,
                            width: `${curveWidth}px`,
                            height: `${curveHeight}px`,
                            zIndex: 1,
                          }}
                        >
                          {/* Fill area with convex curves */}
                          <path
                            d={`M 0 ${curveSquareSize} Q ${curveWidth} ${curveSquareSize} ${curveWidth} 0 L ${curveWidth} ${curveHeight} Q ${curveWidth} ${curveSquareSize + lineHeight} 0 ${curveSquareSize + lineHeight} Z`}
                            fill="rgba(255, 255, 255, 0.75)"
                            stroke={NEUTRAL_COLORS.gray200}
                            strokeWidth="1"
                          />
                        </svg>
                      </React.Fragment>
                    );
                  }
                  return null;
                })}
              </>
            );
          }
          
          // No phases - render single background for entire project
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
          
          // Calculate position and width
          const leftPx = adjustedPositions.baselineStartPx;
          let widthPx = adjustedPositions.baselineWidthPx ?? positions.baselineWidthPx;
          
          // For continuous projects, calculate width based on furthest day with estimates
          if (extendsRight && dayEstimates && dayEstimates.length > 0) {
            const columnWidth = mode === 'weeks' ? 153 : 52;
            
            // Find the furthest date with day estimates
            const furthestEstimateDate = dayEstimates.reduce((latest, estimate) => {
              const estDate = new Date(estimate.date);
              return estDate > latest ? estDate : latest;
            }, new Date(dayEstimates[0].date));
            
            // Find the index of this date in the dates array (or calculate if beyond)
            const furthestDateNormalized = normalizeToMidnight(furthestEstimateDate);
            const viewportStartNormalized = normalizeToMidnight(viewportStart);
            
            // Calculate days from viewport start to furthest estimate
            const daysDiff = Math.ceil((furthestDateNormalized.getTime() - viewportStartNormalized.getTime()) / (1000 * 60 * 60 * 24));
            const furthestColumnPx = daysDiff * columnWidth;
            
            // Extend a bit beyond the furthest estimate to show continuation
            widthPx = Math.max(widthPx, furthestColumnPx - leftPx + (columnWidth * 10));
          }
          
          // Calculate border radius
          let borderRadius = '6px';
          if (extendsLeft && extendsRight) {
            borderRadius = '0px';
          } else if (extendsLeft) {
            borderRadius = '0px 6px 6px 0px';
          } else if (extendsRight) {
            borderRadius = '6px 0px 0px 6px';
          }
          
          // Calculate borders
          const borderLeft = extendsLeft ? 'none' : `1px solid ${NEUTRAL_COLORS.gray200}`;
          const borderRight = extendsRight ? 'none' : `1px solid ${NEUTRAL_COLORS.gray200}`;
          const borderTop = `1px solid ${NEUTRAL_COLORS.gray200}`;
          const borderBottom = `1px solid ${NEUTRAL_COLORS.gray200}`;
          
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.75)',
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
              const { dailyHours: totalHours, allocationType } = getPerDateSummary
                ? getPerDateSummary(dateNormalized)
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
              // In weeks mode: 21px per day (with 1px gaps between days 0-5, no gap after day 6)
              // In days mode: 50px rectangle in 52px column
              const dayRectWidth = mode === 'weeks' ? 21 : 50;
              // Week mode: last day of week (index 6) is 21px, all others are 22px (21px + 1px gap)
              const isLastDayOfWeek = mode === 'weeks' && dateIndex % 7 === 6;
              const dayColumnWidth = mode === 'weeks' 
                ? (isLastDayOfWeek ? 21 : 22) 
                : 52;
              
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
                    left: `${adjustedPositions.baselineStartPx + (adjustedPositions.baselineWidthPx ?? positions.baselineWidthPx) - RESIZE_ZONE_WIDTH}px`,
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

        {/* Phase markers (draggable rectangles at phase boundaries) */}
        <DraggablePhaseMarkers
          project={project}
          phases={filteredProjectMilestones}
          viewportStart={viewportStart}
          viewportEnd={viewportEnd}
          dates={dates}
          mode={mode}
          isDragging={isDragging}
          dragState={dragState}
          calculateBaselineVisualOffsets={calculateBaselineVisualOffsets}
          onPhaseResizeMouseDown={onPhaseResizeMouseDown}
        />
      </div>
    );
  } catch (error) {
    console.error('Error rendering TimelineBar for project:', project?.id, error);
    return <div style={{ height: '40px', background: NEUTRAL_COLORS.gray100 }}>Error rendering project bar</div>;
  }
}, (prevProps, nextProps) => {
  // If a resize drag is active for this project, always re-render for live feedback
  if (nextProps.isDragging && nextProps.dragState?.projectId === nextProps.project.id &&
      (nextProps.dragState?.action === 'resize-start-date' || 
       nextProps.dragState?.action === 'resize-end-date' ||
       nextProps.dragState?.action === 'resize-phase-start' ||
       nextProps.dragState?.action === 'resize-phase-end')) {
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