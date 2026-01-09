import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/shadcn/tooltip';
import type { Project, PhaseDTO } from '@/types/core';
import { getTimelinePositions, normalizeToMidnight } from '@/services';
import { getPhasesSortedByEndDate } from '@/domain/rules/phases/PhaseRules';
import type { DragState } from '@/services/ui/DragPositioning';
import type { TimelinePositionCalculation } from '@/services/ui/ProjectBarPositioning';

interface DraggablePhaseMarkersProps {
  project: Project;
  phases: PhaseDTO[];
  viewportStart: Date;
  viewportEnd: Date;
  dates: Date[];
  mode: 'days' | 'weeks';
  isDragging: boolean;
  dragState: DragState | null;
  calculateBaselineVisualOffsets: (
    positions: TimelinePositionCalculation,
    isDragging: boolean,
    dragState: DragState | null,
    projectId: string,
    mode: 'days' | 'weeks'
  ) => TimelinePositionCalculation;
  onPhaseResizeMouseDown?: (e: React.MouseEvent, projectId: string, phaseId: string, action: 'resize-phase-start' | 'resize-phase-end') => void;
}

/**
 * Renders draggable triangular markers (half diamonds) at phase boundaries
 * - Start markers: triangle pointing right → into the phase
 * - End markers: triangle pointing left ← into the phase
 * - Height: 21px (2/3rds of icon indicator height)
 * - Darkens on hover like other drag handles
 * - Follows non-overlapping phase rules from PhaseRules
 * 
 * Following .cursorrules: timeline visualization component
 * - Pure presentation component - no business logic
 * - Uses domain rules (PhaseRules) for phase sorting
 * - Uses services (getTimelinePositions, normalizeToMidnight) for calculations
 * - Types from @/types/core
 */
export function DraggablePhaseMarkers({
  project,
  phases,
  viewportStart,
  viewportEnd,
  dates,
  mode,
  isDragging,
  dragState,
  calculateBaselineVisualOffsets,
  onPhaseResizeMouseDown
}: DraggablePhaseMarkersProps) {
  // Get phases for this project (each phase has startDate and endDate)
  const sortedPhases = getPhasesSortedByEndDate(phases);

  if (sortedPhases.length === 0) {
    return null;
  }

  const projectStartDate = normalizeToMidnight(new Date(project.startDate));
  const projectEndDate = project.continuous
    ? normalizeToMidnight(new Date(viewportEnd))
    : normalizeToMidnight(new Date(project.endDate));

  const MARKER_WIDTH = 6; // Width to match project bar end styling
  const MARKER_HEIGHT = 48; // Full height of project bar
  const MARKER_TOP = 0; // Align with project bar top
  const MARKER_INSET = 0; // No inset - flush with phase edges

  // Check if project has recurring template (markers should not be draggable)
  const hasRecurringTemplate = sortedPhases.some(p => p.isRecurring);

  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={0}>
      {sortedPhases.map((phase, index) => {
        const phaseStartDate = normalizeToMidnight(new Date(phase.startDate!));
        const phaseEndDate = normalizeToMidnight(new Date(phase.endDate!));
        const isFirstPhase = index === 0;
        const isLastPhase = index === phases.length - 1;

        // Don't show start marker for first phase (locked to project start)
        const showStartMarker = !isFirstPhase && 
          phaseStartDate >= normalizeToMidnight(viewportStart) && 
          phaseStartDate <= normalizeToMidnight(viewportEnd);

        // Don't show end marker for last phase (locked to project end)
        const showEndMarker = !isLastPhase && 
          phaseEndDate >= normalizeToMidnight(viewportStart) && 
          phaseEndDate <= normalizeToMidnight(viewportEnd);

        const markers = [];

        // Check if this phase is being dragged
        const isThisPhaseDragging = isDragging && 
          (dragState?.phaseId ?? dragState?.milestoneId) === phase.id && 
          (dragState?.action === 'resize-phase-start' || dragState?.action === 'resize-phase-end');

        // Calculate visual date during drag
        const visualStartDate = isThisPhaseDragging && dragState?.action === 'resize-phase-start'
          ? new Date(new Date(phase.startDate!).getTime() + (dragState.lastDaysDelta * 24 * 60 * 60 * 1000))
          : phaseStartDate;

        const visualEndDate = isThisPhaseDragging && dragState?.action === 'resize-phase-end'
          ? new Date(new Date(phase.endDate!).getTime() + (dragState.lastDaysDelta * 24 * 60 * 60 * 1000))
          : phaseEndDate;

        // START MARKER (rounded corners facing into phase - right side)
        if (showStartMarker) {
          const startPositions = getTimelinePositions(
            visualStartDate,
            visualStartDate,
            viewportStart,
            viewportEnd,
            dates,
            mode
          );

          if (startPositions) {
            const adjustedStartPositions = calculateBaselineVisualOffsets(
              startPositions,
              isDragging,
              dragState,
              project.id,
              mode
            );

            // Position at the left edge of the phase start date column
            const markerPosition = adjustedStartPositions.baselineStartPx;

            markers.push(
              <Tooltip key={`${phase.id}-start-marker`} delayDuration={100}>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute pointer-events-auto group transition-shadow duration-150 ${
                      hasRecurringTemplate ? 'cursor-not-allowed' : 'cursor-ew-resize'
                    }`}
                    style={{
                      left: `${markerPosition + MARKER_INSET}px`,
                      top: `${MARKER_TOP}px`,
                      width: `${MARKER_WIDTH}px`,
                      height: `${MARKER_HEIGHT}px`,
                      zIndex: 40
                    }}
                    title={hasRecurringTemplate ? 'Edit recurring template to change phase dates' : `Drag to change start of ${phase.name}`}
                    onMouseDown={(e) => {
                      if (hasRecurringTemplate) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      if (onPhaseResizeMouseDown) {
                        e.stopPropagation();
                        e.preventDefault();
                        onPhaseResizeMouseDown(e, project.id, phase.id, 'resize-phase-start');
                      }
                    }}
                  >
                    {/* Simple rectangle styled like project bar end */}
                    <div
                      className="absolute inset-0 transition-opacity"
                      style={{
                        backgroundColor: project.color,
                        opacity: hasRecurringTemplate ? 0.3 : 0.3,
                        borderRadius: '0px 2px 2px 0px', // Rounded on right edge
                      }}
                    />
                    {/* Hover highlighting */}
                    {!hasRecurringTemplate && (
                      <div
                        className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity"
                        style={{
                          borderRadius: '0px 2px 2px 0px',
                        }}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    {hasRecurringTemplate ? (
                      <>
                        <div className="font-medium text-amber-600">Recurring Template Active</div>
                        <div className="text-gray-500">Edit the template to change dates</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium">Start of {phase.name}</div>
                        <div className="text-gray-500">
                          {phaseStartDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="text-gray-500 text-[10px] mt-1">
                          Drag left/right to adjust • Min 1 day
                        </div>
                      </>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }
        }

        // END MARKER (rounded corners facing into phase - left side)
        if (showEndMarker) {
          const endPositions = getTimelinePositions(
            visualEndDate,
            visualEndDate,
            viewportStart,
            viewportEnd,
            dates,
            mode
          );

          if (endPositions) {
            const adjustedEndPositions = calculateBaselineVisualOffsets(
              endPositions,
              isDragging,
              dragState,
              project.id,
              mode
            );

            // Calculate the width of the actual day rectangle (not the column)
            // In weeks mode: rectangles are 21px, columns are 22px (21px + 1px gap) except last day (21px)
            // In days mode: rectangles are 50px, columns are 52px
            const dayRectWidth = mode === 'weeks' ? 21 : 50;
            
            // Position at the right edge of the day rectangle
            // In weeks mode, there's a consistent offset that needs correction (likely from baseline padding)
            const weeksModeOffset = mode === 'weeks' ? 4 : 0;
            const markerPosition = adjustedEndPositions.baselineStartPx + dayRectWidth + weeksModeOffset - MARKER_WIDTH;

            markers.push(
            <Tooltip key={`${phase.id}-end-marker`} delayDuration={100}>
              <TooltipTrigger asChild>
                <div
                  className={`absolute pointer-events-auto group transition-shadow duration-150 ${
                    hasRecurringTemplate ? 'cursor-not-allowed' : 'cursor-ew-resize'
                  }`}
                  style={{
                    left: `${markerPosition}px`,
                    top: `${MARKER_TOP}px`,
                    width: `${MARKER_WIDTH}px`,
                    height: `${MARKER_HEIGHT}px`,
                    zIndex: 40
                  }}
                  title={hasRecurringTemplate ? 'Edit recurring template to change phase dates' : `Drag to change end of ${phase.name}`}
                  onMouseDown={(e) => {
                    if (hasRecurringTemplate) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    if (onPhaseResizeMouseDown) {
                      e.stopPropagation();
                      e.preventDefault();
                      onPhaseResizeMouseDown(e, project.id, phase.id, 'resize-phase-end');
                    }
                  }}
                >
                  {/* Simple rectangle styled like project bar end */}
                  <div
                    className="absolute inset-0 transition-opacity"
                    style={{
                      backgroundColor: project.color,
                      opacity: hasRecurringTemplate ? 0.3 : 0.3,
                      borderRadius: '2px 0px 0px 2px', // Rounded on left edge
                    }}
                  />
                  {/* Hover highlighting */}
                  {!hasRecurringTemplate && (
                    <div
                      className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity"
                      style={{
                        borderRadius: '2px 0px 0px 2px',
                      }}
                    />
                  )}
                </div>
              </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    {hasRecurringTemplate ? (
                      <>
                        <div className="font-medium text-amber-600">Recurring Template Active</div>
                        <div className="text-gray-500">Edit the template to change dates</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium">End of {phase.name}</div>
                        <div className="text-gray-500">
                          {phaseEndDate.toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="text-gray-500 text-[10px] mt-1">
                          Drag left/right to adjust • Min 1 day
                        </div>
                      </>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          }
        }

        return markers;
      })}
    </TooltipProvider>
  );
}
