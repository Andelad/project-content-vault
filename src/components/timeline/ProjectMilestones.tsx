import React, { memo, useMemo, useState } from 'react';
import { Flag } from 'lucide-react';
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
  onMilestoneDragEnd?: () => void;
  isDragging?: boolean;
  dragState?: any;
}

export const ProjectMilestones = memo(function ProjectMilestones({
  project,
  dates,
  viewportStart,
  viewportEnd,
  mode,
  colorScheme,
  onMilestoneDrag,
  onMilestoneDragEnd,
  isDragging,
  dragState
}: ProjectMilestonesProps) {
  const { milestones } = useAppDataOnly();
  const [draggingMilestone, setDraggingMilestone] = useState<string | null>(null);

  // Get milestones for this project
  const projectMilestones = useMemo(() => {
    return milestones
      .filter(m => m.projectId === project.id)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [milestones, project.id]);

  // Calculate positions for each milestone
  const milestonePositions = useMemo(() => {
    return projectMilestones.map(milestone => {
      const milestoneDate = new Date(milestone.dueDate);
      milestoneDate.setHours(0, 0, 0, 0);

      // If project is being dragged, adjust milestone date accordingly
      let adjustedMilestoneDate = milestoneDate;
      if (isDragging && dragState?.projectId === project.id && dragState?.action === 'move') {
        adjustedMilestoneDate = new Date(milestoneDate);
        const daysDelta = dragState.daysDelta || 0;
        adjustedMilestoneDate.setDate(adjustedMilestoneDate.getDate() + daysDelta);
      }

      // Check if milestone is within viewport (use adjusted date for visibility check)
      if (adjustedMilestoneDate < viewportStart || adjustedMilestoneDate > viewportEnd) {
        return { milestone, visible: false, position: 0 };
      }

      // Calculate position using the adjusted date
      const positions = calculateTimelinePositions(
        adjustedMilestoneDate,
        adjustedMilestoneDate,
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
  }, [projectMilestones, viewportStart, viewportEnd, dates, mode, isDragging, dragState, project.id]);

  // Handle milestone drag start
  const handleMilestoneMouseDown = (e: React.MouseEvent, milestoneId: string) => {
    e.stopPropagation();
    setDraggingMilestone(milestoneId);

    const startX = e.clientX;
    // Calculate actual day width based on mode
    const dayWidth = mode === 'weeks' ? (72 / 7) : 40; // 10.3px for weeks, 40px for days
    const originalMilestone = projectMilestones.find(m => m.id === milestoneId);
    if (!originalMilestone) return;

    const originalDate = new Date(originalMilestone.dueDate);
    originalDate.setHours(0, 0, 0, 0);

    // Project boundaries
    const projectStart = new Date(project.startDate);
    projectStart.setHours(0, 0, 0, 0);
    const projectEnd = new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!onMilestoneDrag) return;

      // Calculate days delta from original position - use fractional movement for responsiveness
      const deltaX = moveEvent.clientX - startX;
      const daysDelta = deltaX / dayWidth; // Don't round yet - allow fractional movement
      
      // Only round when we've moved at least 0.5 days worth of pixels
      const roundedDaysDelta = Math.round(daysDelta);
      
      // Calculate new date
      const newDate = new Date(originalDate);
      newDate.setDate(originalDate.getDate() + roundedDaysDelta);
      newDate.setHours(0, 0, 0, 0);

      // Constrain milestone within project boundaries (with 1 day buffer)
      const minDate = new Date(projectStart);
      minDate.setDate(projectStart.getDate() + 1); // 1 day after start
      const maxDate = new Date(projectEnd);
      maxDate.setDate(projectEnd.getDate() - 1); // 1 day before end

      if (newDate < minDate) {
        newDate.setTime(minDate.getTime());
      } else if (newDate > maxDate) {
        newDate.setTime(maxDate.getTime());
      }

      // Check if the new position would overlap with other milestones
      const otherMilestones = projectMilestones.filter(m => m.id !== milestoneId);
      const wouldOverlap = otherMilestones.some(m => {
        const mDate = new Date(m.dueDate);
        mDate.setHours(0, 0, 0, 0);
        return Math.abs(mDate.getTime() - newDate.getTime()) < 24 * 60 * 60 * 1000; // Same day
      });

      // Only update if no overlap, within project boundaries, and we've moved at least half a day
      if (!wouldOverlap && newDate >= minDate && newDate <= maxDate && Math.abs(daysDelta) >= 0.5) {
        onMilestoneDrag(milestoneId, newDate);
      }
    };

    const handleMouseUp = () => {
      setDraggingMilestone(null);
      
      // Call the drag end callback to show success toast
      if (onMilestoneDragEnd) {
        onMilestoneDragEnd();
      }
      
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

        const estimatedHours = milestone.timeAllocation;

        return (
          <Tooltip key={milestone.id} delayDuration={100}>
            <TooltipTrigger asChild>
              <div
                className={`absolute pointer-events-auto cursor-ew-resize transform -translate-x-1/2 transition-all duration-150 ${
                  draggingMilestone === milestone.id ? 'scale-110 z-40' : 'hover:scale-105 hover:z-30'
                }`}
                style={{
                  left: `${position}px`,
                  top: '-3px', // Center 9px diamond on 3px baseline (3px above, 3px below)
                  zIndex: 25
                }}
                onMouseDown={(e) => onMilestoneDrag && handleMilestoneMouseDown(e, milestone.id!)}
                title="Drag to change milestone date"
              >
                {/* Diamond shape */}
                <div
                  className={`relative transition-all duration-150 ${
                    draggingMilestone === milestone.id ? 'shadow-lg' : 'hover:shadow-md'
                  }`}
                  style={{
                    width: '9px',
                    height: '9px',
                    backgroundColor: colorScheme.baseline,
                    transform: 'rotate(45deg)',
                    boxShadow: draggingMilestone === milestone.id 
                      ? '0 4px 12px rgba(0, 0, 0, 0.3)' 
                      : '0 1px 3px rgba(0, 0, 0, 0.2)'
                  }}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="flex items-center gap-1 font-medium">
                  <Flag className="w-3 h-3" />
                  {milestone.name}
                </div>
                <div className="text-gray-500">
                  Due: {milestone.dueDate.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </div>
                <div className="text-gray-500">
                  {estimatedHours}h
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
});
