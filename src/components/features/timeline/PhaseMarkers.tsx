import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Project, PhaseDTO } from '@/types/core';
import { getTimelinePositions, normalizeToMidnight } from '@/services';
import { getPhasesSortedByEndDate } from '@/domain/rules/phases/PhaseRules';
import type { DragState } from '@/ui/DragPositioning';
import type { TimelinePositionCalculation } from '@/ui/ProjectBarPositioning';

interface PhaseMarkersProps {
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
}

/**
 * Renders diamond-shaped markers at phase end dates on the timeline
 * Pure UI component - delegates position calculations to services
 * Following .cursorrules: timeline visualization component
 */
export function PhaseMarkers({
  project,
  phases,
  viewportStart,
  viewportEnd,
  dates,
  mode,
  isDragging,
  dragState,
  calculateBaselineVisualOffsets
}: PhaseMarkersProps) {
  // Get phases for this project (milestones with startDate and endDate)
  const sortedPhases = getPhasesSortedByEndDate(phases);

  if (sortedPhases.length === 0) {
    return null;
  }

  const projectEndDate = project.continuous
    ? new Date(viewportEnd)
    : normalizeToMidnight(new Date(project.endDate));

  // Calculate positions for phase end markers
  return (
    <>
      {sortedPhases.map((phase, index) => {
        const phaseEndDate = normalizeToMidnight(new Date(phase.endDate!));

        // Don't show marker for the last phase if it ends at project end date
        if (phaseEndDate.getTime() === projectEndDate.getTime()) {
          return null;
        }

        // Check if phase end is within viewport
        if (
          phaseEndDate < normalizeToMidnight(viewportStart) ||
          phaseEndDate > normalizeToMidnight(viewportEnd)
        ) {
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
          positions,
          isDragging,
          dragState,
          project.id,
          mode
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
                className="absolute pointer-events-auto transform -translate-x-1/2 transition-transform duration-150 hover:scale-110 hover:z-30"
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
                <div className="font-medium">End of {phase.name}</div>
                <div className="text-gray-500">
                  {phaseEndDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                {phase.timeAllocation > 0 && (
                  <div className="text-gray-500">{phase.timeAllocation}h allocated</div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}
