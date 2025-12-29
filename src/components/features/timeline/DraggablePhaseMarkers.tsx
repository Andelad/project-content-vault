import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { Project, Phase } from '@/types/core';
import { getTimelinePositions, normalizeToMidnight } from '@/services';
import { getPhasesSortedByEndDate } from '@/domain/rules/PhaseRules';
import type { DragState } from '@/services/ui/DragPositioning';
import type { TimelinePositionCalculation } from '@/services/ui/ProjectBarPositioning';

interface DraggablePhaseMarkersProps {
  project: Project;
  phases: Phase[];
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
  // Get phases for this project (milestones with startDate and endDate)
  const phases = getPhasesSortedByEndDate(phases);

  if (phases.length === 0) {
    return null;
  }

  const projectStartDate = normalizeToMidnight(new Date(project.startDate));
  const projectEndDate = project.continuous
    ? normalizeToMidnight(new Date(viewportEnd))
    : normalizeToMidnight(new Date(project.endDate));

  const MARKER_WIDTH = 12; // Slightly narrower marker per request
  const MARKER_HEIGHT = Math.round(32 * 2 / 3); // 2/3rds of original 32px = ~21px
  const MARKER_TOP = 8 + Math.round((32 - MARKER_HEIGHT) / 2); // Adjust top to keep centered in bar
  const MARKER_INSET = 1; // 1px inset on each side for gap when markers are adjacent
  const MARKER_CORNER_RADIUS = 2; // Rounded corners on the triangle

  // Precomputed rounded half-diamond paths (right and left pointing)
  const markerMidY = MARKER_HEIGHT / 2;
  const rightMarkerPath = `M 0 ${MARKER_CORNER_RADIUS} Q 0 0 ${MARKER_CORNER_RADIUS} 0 L ${MARKER_WIDTH - MARKER_CORNER_RADIUS} ${markerMidY - MARKER_CORNER_RADIUS} Q ${MARKER_WIDTH} ${markerMidY} ${MARKER_WIDTH - MARKER_CORNER_RADIUS} ${markerMidY + MARKER_CORNER_RADIUS} L ${MARKER_CORNER_RADIUS} ${MARKER_HEIGHT} Q 0 ${MARKER_HEIGHT} 0 ${MARKER_HEIGHT - MARKER_CORNER_RADIUS} Z`;
  const leftMarkerPath = `M ${MARKER_WIDTH} ${MARKER_CORNER_RADIUS} Q ${MARKER_WIDTH} 0 ${MARKER_WIDTH - MARKER_CORNER_RADIUS} 0 L ${MARKER_CORNER_RADIUS} ${markerMidY - MARKER_CORNER_RADIUS} Q 0 ${markerMidY} ${MARKER_CORNER_RADIUS} ${markerMidY + MARKER_CORNER_RADIUS} L ${MARKER_WIDTH - MARKER_CORNER_RADIUS} ${MARKER_HEIGHT} Q ${MARKER_WIDTH} ${MARKER_HEIGHT} ${MARKER_WIDTH} ${MARKER_HEIGHT - MARKER_CORNER_RADIUS} Z`;

  // Check if project has recurring template (markers should not be draggable)
  const hasRecurringTemplate = milestones.some(p => m.isRecurring);

  return (
    <TooltipProvider delayDuration={100} skipDelayDuration={0}>
      {phases.map((phase, index) => {
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
          dragState?.milestoneId === phase.id && 
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
                    {/* Triangle pointing right (into phase) - half diamond */}
                    <svg 
                      width={MARKER_WIDTH} 
                      height={MARKER_HEIGHT} 
                      viewBox={`0 0 ${MARKER_WIDTH} ${MARKER_HEIGHT}`}
                      className="absolute inset-0 transition-opacity drop-shadow-sm group-hover:drop-shadow-md"
                      style={{ opacity: hasRecurringTemplate ? 0.3 : 1 }}
                    >
                      <path d={rightMarkerPath} fill={project.color} />
                    </svg>
                    {/* Hover highlighting - darkened overlay triangle */}
                    {!hasRecurringTemplate && (
                      <svg 
                        width={MARKER_WIDTH} 
                        height={MARKER_HEIGHT} 
                        viewBox={`0 0 ${MARKER_WIDTH} ${MARKER_HEIGHT}`}
                        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                      >
                        <path d={rightMarkerPath} fill="black" />
                      </svg>
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

            // In weeks mode, each day is 22px wide within the 153px week column
            // In days mode, each day column is 52px wide
            const dayWidth = mode === 'weeks' ? 22 : 52;
            // Position at the right edge of the phase end date column
            const markerPosition = adjustedEndPositions.baselineStartPx + dayWidth - MARKER_WIDTH;

            markers.push(
            <Tooltip key={`${phase.id}-end-marker`} delayDuration={100}>
              <TooltipTrigger asChild>
                <div
                  className={`absolute pointer-events-auto group transition-shadow duration-150 ${
                    hasRecurringTemplate ? 'cursor-not-allowed' : 'cursor-ew-resize'
                  }`}
                  style={{
                    left: `${markerPosition - MARKER_INSET}px`,
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
                  {/* Triangle pointing left (into phase) - half diamond */}
                  <svg 
                    width={MARKER_WIDTH} 
                    height={MARKER_HEIGHT} 
                    viewBox={`0 0 ${MARKER_WIDTH} ${MARKER_HEIGHT}`}
                    className="absolute inset-0 transition-opacity drop-shadow-sm group-hover:drop-shadow-md"
                    style={{ opacity: hasRecurringTemplate ? 0.3 : 1 }}
                  >
                    <path d={leftMarkerPath} fill={project.color} />
                  </svg>
                  {/* Hover highlighting - darkened overlay triangle */}
                  {!hasRecurringTemplate && (
                    <svg 
                      width={MARKER_WIDTH} 
                      height={MARKER_HEIGHT} 
                      viewBox={`0 0 ${MARKER_WIDTH} ${MARKER_HEIGHT}`}
                      className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                    >
                      <path d={leftMarkerPath} fill="black" />
                    </svg>
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
