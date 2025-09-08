import React, { useState } from 'react';
import { Project } from '../../types';
import { usePlannerContext } from '../../contexts/PlannerContext';
import { useTimelineContext } from '../../contexts/TimelineContext';
import { calculateProjectDuration } from '@/services';
import { calculateProjectHeight } from '@/services';
import { CommittedHoursCalculationService } from '@/services';
import { calculateProjectBarPosition } from '@/services/ui/TimelinePositioning';

interface ProjectTimelineProps {
  project: Project;
  dates: Date[];
  currentDate: Date;
}

export function ProjectTimeline({ project, dates, currentDate }: ProjectTimelineProps) {
  const { events } = usePlannerContext();
  const { timelineEntries, updateTimelineEntry } = useTimelineContext();
  const [draggedDay, setDraggedDay] = useState<string | null>(null);

  // Calculate if date is within project range
  const isDateInProject = (date: Date) => {
    return date >= project.startDate && date <= project.endDate;
  };

  // Calculate project duration in days
  const getProjectDuration = () => {
    return calculateProjectDuration(project);
  };

  // Calculate default hours per day
  const getDefaultHoursPerDay = () => {
    // Use project's estimated hours divided by duration, or default to 8 hours
    if (project.estimatedHours && project.startDate && project.endDate) {
      const startDate = new Date(project.startDate);
      const endDate = new Date(project.endDate);
      const durationMs = endDate.getTime() - startDate.getTime();
      const totalDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
      const businessDays = Math.max(1, Math.ceil(totalDays * 5/7)); // Estimate business days
      return Math.max(1, project.estimatedHours / businessDays);
    }
    return 8; // Default 8 hours per day
  };

  // Get allocated hours for a specific date from timeline entries
  const getAllocatedHours = (date: Date) => {
    const dateKey = date.toISOString().split('T')[0];
    const entry = timelineEntries.find(entry => 
      entry.date.toISOString().split('T')[0] === dateKey && entry.projectId === project.id
    );
    
    if (entry) {
      return entry.hours;
    }
    
    // Default allocation if within project range
    if (isDateInProject(date)) {
      return Math.max(0.5, getDefaultHoursPerDay()); // Minimum 0.5 hours for visibility
    }
    
    return 0;
  };

  // Get committed hours from calendar events using service
  const getCommittedHours = (date: Date) => {
    return CommittedHoursCalculationService.calculateCommittedHoursForDate(
      date,
      project.id,
      events
    );
  };

  // Calculate bar height based on hours (max 8 hours = full height)
  const getBarHeight = (hours: number) => {
    return calculateProjectHeight(hours);
  };

  // Handle time allocation adjustment
  const handleTimeAdjustment = (date: Date, newHours: number) => {
    updateTimelineEntry({ date, projectId: project.id, hours: Math.max(0, newHours) });
  };

  // Handle drag start
  const handleDragStart = (date: Date, event: React.MouseEvent) => {
    const dateKey = date.toISOString().split('T')[0];
    setDraggedDay(dateKey);
    
    const startY = event.clientY;
    const startHours = getAllocatedHours(date);
    
    const handleDrag = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      const hoursChange = deltaY / 5; // 5px per hour
      const newHours = Math.max(0, startHours + hoursChange);
      handleTimeAdjustment(date, newHours);
    };
    
    const handleDragEnd = () => {
      setDraggedDay(null);
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
    };
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };

  // Render project info
  const renderProjectInfo = () => (
    <div className="flex items-center space-x-2 mb-2">
      <div
        className="w-3 h-3 rounded-sm"
        style={{ backgroundColor: project.color }}
      ></div>
      <span className="text-sm font-medium text-[#595956]">{project.name}</span>
      <span className="text-sm text-[#adaba1]">• {project.client}</span>
      <span className="text-xs text-[#adaba1] ml-2">
        ({project.estimatedHours}h estimated)
      </span>
    </div>
  );

  // Find the start and end positions for the timeline bar using unified positioning
  const timelinePosition = calculateProjectBarPosition(
    new Date(project.startDate),
    new Date(project.endDate),
    dates[0] || new Date(project.startDate),
    dates[dates.length - 1] || new Date(project.endDate),
    dates,
    'days'
  );

  return (
    <div className="relative">
      {renderProjectInfo()}
      
      {/* Timeline container */}
      <div className="relative h-20">
        {/* Background timeline bar */}
        {timelinePosition.width > 0 && (
          <div
            className="absolute top-4 h-2 rounded-sm opacity-20"
            style={{
              backgroundColor: project.color,
              left: `${timelinePosition.startIndex * 48}px`,
              width: `${timelinePosition.width}px`
            }}
          ></div>
        )}
        
        {/* Time allocation bars */}
        <div className="flex">
          {dates.map((date, index) => {
            const allocatedHours = getAllocatedHours(date);
            const committedHours = getCommittedHours(date);
            const isInProject = isDateInProject(date);
            const dateKey = date.toISOString().split('T')[0];
            const isDragged = draggedDay === dateKey;
            
            if (!isInProject && allocatedHours === 0) {
              return <div key={index} className="w-12"></div>;
            }
            
            const barHeight = getBarHeight(allocatedHours);
            const committedHeight = getBarHeight(committedHours);
            
            return (
              <div key={index} className="w-12 flex justify-center">
                <div className="relative">
                  {/* Allocated hours bar */}
                  {allocatedHours > 0 && (
                    <div
                      className={`absolute bottom-0 w-8 rounded-t cursor-ns-resize transition-opacity ${
                        isDragged ? 'opacity-80' : ''
                      }`}
                      style={{
                        height: `${barHeight}px`,
                        backgroundColor: `${project.color}40` // 40 = 25% opacity
                      }}
                      onMouseDown={(e) => handleDragStart(date, e)}
                      title={`${allocatedHours.toFixed(1)} hours allocated`}
                    ></div>
                  )}
                  
                  {/* Committed hours overlay */}
                  {committedHours > 0 && (
                    <div
                      className="absolute bottom-0 w-8 rounded-t border-2 border-dashed"
                      style={{
                        height: `${committedHeight}px`,
                        borderColor: project.color,
                        backgroundColor: 'transparent'
                      }}
                      title={`${committedHours.toFixed(1)} hours scheduled`}
                    ></div>
                  )}
                  
                  {/* Overcommitment indicator */}
                  {committedHours > allocatedHours && (
                    <div
                      className="absolute bottom-0 w-8 rounded-t bg-red-200 border border-red-400"
                      style={{
                        height: `${getBarHeight(committedHours - allocatedHours)}px`,
                        transform: `translateY(-${barHeight}px)`
                      }}
                      title={`${(committedHours - allocatedHours).toFixed(1)} hours overcommitted`}
                    ></div>
                  )}
                  
                  {/* Hours display on hover */}
                  {(allocatedHours > 0 || committedHours > 0) && (
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                      {allocatedHours > 0 && `${allocatedHours.toFixed(1)}h allocated`}
                      {committedHours > 0 && (
                        <>
                          {allocatedHours > 0 && <br />}
                          {`${committedHours.toFixed(1)}h scheduled`}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}