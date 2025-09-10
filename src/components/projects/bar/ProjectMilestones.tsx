import React, { memo, useMemo, useState } from 'react';
import { Flag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { useProjectContext } from '../../../contexts/ProjectContext';
import { type TimelinePositionCalculation } from '@/services';
import { Milestone } from '@/types/core';
import { useToast } from '@/hooks/use-toast';

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
  projectPositions: TimelinePositionCalculation; // Add the project's calculated positions
  isDragging?: boolean; // Re-add for immediate drag response
  dragState?: any; // Re-add for immediate drag response
  onMilestoneDrag?: (milestoneId: string, newDate: Date) => void;
  onMilestoneDragEnd?: () => void;
}

export const ProjectMilestones = memo(function ProjectMilestones({
  project,
  dates,
  viewportStart,
  viewportEnd,
  mode,
  colorScheme,
  projectPositions,
  isDragging,
  dragState,
  onMilestoneDrag,
  onMilestoneDragEnd
}: ProjectMilestonesProps) {
  const { milestones } = useProjectContext();
  const [draggingMilestone, setDraggingMilestone] = useState<string | null>(null);
  const { toast } = useToast();

  // Helper function to check if a milestone is part of a recurring pattern
  const isRecurringMilestone = (milestone: Milestone) => {
    return milestone.name && /\s\d+$/.test(milestone.name);
  };

  // Get milestones for this project
  const projectMilestones = useMemo(() => {
    return milestones
      .filter(m => m.projectId === project.id)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [milestones, project.id]);

  // Calculate positions for each milestone relative to the project's baseline positioning
  const milestonePositions = useMemo(() => {
    // For 'move' actions during drag, use original dates + daysDelta offset for consistent visuals
    const effectiveProjectStart = (() => {
      if (isDragging && dragState?.projectId === project.id && dragState?.action === 'move' && dragState?.originalStartDate) {
        const startDate = new Date(dragState.originalStartDate);
        const offset = typeof dragState.fractionalDaysDelta === 'number' ? dragState.fractionalDaysDelta : (dragState.daysDelta || 0);
        startDate.setDate(startDate.getDate() + offset);
        return startDate;
      }
      return new Date(project.startDate);
    })();
    effectiveProjectStart.setHours(0, 0, 0, 0);
    
    return projectMilestones.map(milestone => {
      // For 'move' actions during drag, use original milestone date + daysDelta offset
      const effectiveMilestoneDate = (() => {
        if (isDragging && dragState?.projectId === project.id && dragState?.action === 'move' && dragState?.originalMilestones) {
          const originalMilestone = dragState.originalMilestones.find((m: any) => m.id === milestone.id);
          if (originalMilestone) {
            const milestoneDate = new Date(originalMilestone.originalDueDate);
            const offset = typeof dragState.fractionalDaysDelta === 'number' ? dragState.fractionalDaysDelta : (dragState.daysDelta || 0);
            milestoneDate.setDate(milestoneDate.getDate() + offset);
            return milestoneDate;
          }
        }
        return new Date(milestone.dueDate);
      })();
      effectiveMilestoneDate.setHours(0, 0, 0, 0);

      // Check if milestone is within viewport
      if (effectiveMilestoneDate < viewportStart || effectiveMilestoneDate > viewportEnd) {
        return { milestone, visible: false, position: 0 };
      }

      // Calculate milestone position relative to project start
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysFromProjectStart = Math.floor((effectiveMilestoneDate.getTime() - effectiveProjectStart.getTime()) / msPerDay);
      
      // Use the project's positioning data directly (already includes drag offset if applicable)
      let milestonePosition: number;
      
      if (mode === 'weeks') {
        // In weeks mode, use simple 11px per day calculation
        const dayWidth = 11; // Same as in timelinePositioning.ts
        // Position milestone at END of day column (start + offset days + current day width)
        milestonePosition = projectPositions.circleLeftPx + (daysFromProjectStart * dayWidth) + dayWidth;
      } else {
        // In days mode, use column-based positioning
        const columnWidth = 40;
        // Position milestone at END of day column (start + offset days + current day width)
        milestonePosition = projectPositions.circleLeftPx + (daysFromProjectStart * columnWidth) + columnWidth;
      }

      return {
        milestone,
        visible: true,
        position: milestonePosition
      };
    });
  }, [projectMilestones, viewportStart, viewportEnd, project.startDate, project.id, mode, projectPositions, isDragging, dragState]);

  // Handle milestone drag start
  const handleMilestoneMouseDown = (e: React.MouseEvent, milestoneId: string) => {
    e.stopPropagation();
    
    const originalMilestone = projectMilestones.find(m => m.id === milestoneId);
    if (!originalMilestone) return;

    // Check if this is a recurring milestone and prevent dragging
    if (isRecurringMilestone(originalMilestone)) {
      toast({
        title: "Recurring milestone",
        description: "Go to project modal to change.",
        variant: "destructive",
      });
      return;
    }

    setDraggingMilestone(milestoneId);

    const startX = e.clientX;
    // Calculate actual day width based on mode
    const dayWidth = mode === 'weeks' ? 11 : 40; // 11px for weeks, 40px for days

    const originalDate = new Date(originalMilestone.dueDate);
    originalDate.setHours(0, 0, 0, 0);

    // Project boundaries
    const projectStart = new Date(project.startDate);
    projectStart.setHours(0, 0, 0, 0);
    const projectEnd = new Date(project.endDate);
    projectEnd.setHours(0, 0, 0, 0);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!onMilestoneDrag) return;

      // Calculate days delta from original position
      const deltaX = moveEvent.clientX - startX;
      
      // In weeks view: smooth movement, in days view: snap to day boundaries
      const daysDelta = mode === 'weeks' 
        ? deltaX / dayWidth  // Smooth movement in weeks
        : Math.round(deltaX / dayWidth);  // Snap to days in days view
      
      // Only round when we've moved at least 0.5 days worth of pixels (for weeks view)
      const roundedDaysDelta = mode === 'weeks' 
        ? Math.round(daysDelta) 
        : daysDelta; // Already rounded for days view
      
      // Calculate new date
      const newDate = new Date(originalDate);
      newDate.setDate(originalDate.getDate() + roundedDaysDelta);
      newDate.setHours(0, 0, 0, 0);

      // Constrain milestone within project boundaries and prevent overlaps
      const projectStart = new Date(project.startDate);
      projectStart.setHours(0, 0, 0, 0);
      const projectEnd = new Date(project.endDate);
      projectEnd.setHours(0, 0, 0, 0);
      
      // Get all other milestone dates and project boundaries
      const otherMilestones = projectMilestones.filter(m => m.id !== milestoneId);
      const blockingDates = [
        projectStart,
        projectEnd,
        ...otherMilestones.map(m => {
          const date = new Date(m.dueDate);
          date.setHours(0, 0, 0, 0);
          return date;
        })
      ];
      
      // Find the valid range for this milestone
      let minAllowedDate = new Date(projectStart);
      minAllowedDate.setDate(projectStart.getDate() + 1); // 1 day after start
      
      let maxAllowedDate = new Date(projectEnd);
      maxAllowedDate.setDate(projectEnd.getDate() - 1); // 1 day before end
      
      // Narrow down the range based on other milestones
      blockingDates.forEach(blockingDate => {
        if (blockingDate < originalDate && blockingDate >= minAllowedDate) {
          // This blocking date is before our original position, so update minimum
          const dayAfterBlocking = new Date(blockingDate);
          dayAfterBlocking.setDate(blockingDate.getDate() + 1);
          if (dayAfterBlocking > minAllowedDate) {
            minAllowedDate = dayAfterBlocking;
          }
        } else if (blockingDate > originalDate && blockingDate <= maxAllowedDate) {
          // This blocking date is after our original position, so update maximum
          const dayBeforeBlocking = new Date(blockingDate);
          dayBeforeBlocking.setDate(blockingDate.getDate() - 1);
          if (dayBeforeBlocking < maxAllowedDate) {
            maxAllowedDate = dayBeforeBlocking;
          }
        }
      });
      
      // Clamp the new date to the allowed range
      if (newDate < minAllowedDate) {
        newDate.setTime(minAllowedDate.getTime());
      } else if (newDate > maxAllowedDate) {
        newDate.setTime(maxAllowedDate.getTime());
      }

      // Only update if we've moved at least half a day and the date is valid
      if (Math.abs(daysDelta) >= 0.5 && newDate >= minAllowedDate && newDate <= maxAllowedDate) {
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
    // Position milestones using the same coordinate system as the project baseline
    <>
      {milestonePositions.map(({ milestone, visible, position }) => {
        if (!visible) return null;

        const estimatedHours = milestone.timeAllocation;
        const isRecurring = isRecurringMilestone(milestone);

        return (
          <Tooltip key={milestone.id} delayDuration={100}>
            <TooltipTrigger asChild>
              <div
                className={`absolute pointer-events-auto transform -translate-x-1/2 transition-all duration-150 ${
                  isRecurring 
                    ? 'cursor-not-allowed opacity-75' 
                    : 'cursor-ew-resize hover:scale-105 hover:z-30'
                } ${
                  draggingMilestone === milestone.id ? 'scale-110 z-40' : ''
                }`}
                style={{
                  left: `${position}px`,
                  top: '-3px', // Center 9px diamond on 3px baseline (3px above, 3px below)
                  zIndex: 25
                }}
                onMouseDown={(e) => onMilestoneDrag && handleMilestoneMouseDown(e, milestone.id!)}
                title={isRecurring ? "Recurring milestone - use project modal to change" : "Drag to change milestone date"}
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
                  {isRecurring && (
                    <span className="text-orange-500 text-xs font-normal">(Recurring)</span>
                  )}
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
                {isRecurring && (
                  <div className="text-orange-500 text-xs mt-1">
                    Use project modal to modify recurring milestones
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
});
