import React, { memo, useMemo, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useAppDataOnly } from '../../contexts/AppContext';
import { calculateTimelinePositions } from '@/lib/timelinePositioning';
import { Milestone } from '@/types/core';

interface ProjectMilestonesProps {
  project: any;
  dates: Date[];
  viewportStart: Date;
  viewportEnd: Date;
  mode?: 'days' | 'weeks';
  colorScheme: {
    baseline: string;
    main: string;
    midTone: string;
    autoEstimate: string;
    hover: string;
  };
  onMilestoneDrag?: (milestoneId: string, newDate: Date) => void;
}

export const ProjectMilestones = memo(function ProjectMilestones({
  project,
  dates,
  viewportStart,
  viewportEnd,
  mode,
  colorScheme,
  onMilestoneDrag
}: ProjectMilestonesProps) {
  const { milestones } = useAppDataOnly();
  const [draggingMilestone, setDraggingMilestone] = useState<string | null>(null);

  // Get milestones for this project
  const projectMilestones = useMemo(() => {
    return milestones
      .filter(m => m.projectId === project.id)
      .sort((a, b) => a.order - b.order);
  }, [milestones, project.id]);

  // Calculate positions for each milestone
  const milestonePositions = useMemo(() => {
    return projectMilestones.map(milestone => {
      const milestoneDate = new Date(milestone.dueDate);
      milestoneDate.setHours(0, 0, 0, 0);

      // Check if milestone is within viewport
      if (milestoneDate < viewportStart || milestoneDate > viewportEnd) {
        return { milestone, visible: false, position: 0 };
      }

      // Calculate position using the same logic as the project bar
      const positions = calculateTimelinePositions(
        milestoneDate,
        milestoneDate,
        viewportStart,
        viewportEnd,
        dates,
        mode
      );

      return {
        milestone,
        visible: true,
        position: positions.circleLeftPx
      };
    });
  }, [projectMilestones, viewportStart, viewportEnd, dates, mode]);

  // Handle milestone drag start
  const handleMilestoneMouseDown = (e: React.MouseEvent, milestoneId: string) => {
    e.stopPropagation();
    setDraggingMilestone(milestoneId);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!onMilestoneDrag) return;

      // Calculate new date based on mouse position
      const rect = (e.target as HTMLElement).closest('.timeline-dates')?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = moveEvent.clientX - rect.left;
      const dayWidth = mode === 'weeks' ? rect.width / dates.length : 40; // 40px per day in day mode
      const dayIndex = Math.floor(mouseX / dayWidth);
      
      if (dayIndex >= 0 && dayIndex < dates.length) {
        const newDate = new Date(dates[dayIndex]);
        newDate.setHours(0, 0, 0, 0);
        
        // Check if the new position would overlap with other milestones
        const otherMilestones = projectMilestones.filter(m => m.id !== milestoneId);
        const wouldOverlap = otherMilestones.some(m => {
          const mDate = new Date(m.dueDate);
          mDate.setHours(0, 0, 0, 0);
          return Math.abs(mDate.getTime() - newDate.getTime()) < 24 * 60 * 60 * 1000; // Same day
        });

        if (!wouldOverlap) {
          onMilestoneDrag(milestoneId, newDate);
        }
      }
    };

    const handleMouseUp = () => {
      setDraggingMilestone(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (projectMilestones.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 25 }}>
      {milestonePositions.map(({ milestone, visible, position }) => {
        if (!visible) return null;

        const estimatedHours = (milestone.timeAllocation * project.estimatedHours) / 100;

        return (
          <Tooltip key={milestone.id} delayDuration={100}>
            <TooltipTrigger asChild>
              <div
                className={`absolute pointer-events-auto cursor-move transform -translate-x-1/2 transition-transform ${
                  draggingMilestone === milestone.id ? 'scale-110' : 'hover:scale-105'
                }`}
                style={{
                  left: `${position}px`,
                  top: '-4px',
                  zIndex: 25
                }}
                onMouseDown={(e) => onMilestoneDrag && handleMilestoneMouseDown(e, milestone.id!)}
              >
                {/* Diamond shape */}
                <div
                  className="relative"
                  style={{
                    width: '11px',
                    height: '11px',
                    backgroundColor: colorScheme.baseline,
                    transform: 'rotate(45deg)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
                    border: `1px solid ${colorScheme.main}`
                  }}
                >
                  {/* Inner dot for contrast */}
                  <div
                    className="absolute inset-0 m-auto"
                    style={{
                      width: '5px',
                      height: '5px',
                      backgroundColor: colorScheme.main,
                      borderRadius: '1px'
                    }}
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">{milestone.name}</div>
                <div className="text-gray-500">
                  Due: {milestone.dueDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-gray-500">
                  {milestone.timeAllocation}% ({estimatedHours.toFixed(1)}h)
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
});
