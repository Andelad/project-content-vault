/**
 * DailyProjectSummaryRow Component
 * 
 * Diexport function DailyProjectSummaryRow({
  dates,
  proj  const summariesByDate = useMemo(() => {
    if (isLoading || events.length === 0) {
      return new Map<string, DailyProjectSummary[]>();
    }

    return UnifiedDayEstimateService.getDailyProjectSummaries({
      dates,
      projects,
      milestonesMap,
      events,
      settings,
      holidays,
    });
  }, [dates, projects, milestonesMap, events, settings, holidays, isLoading]);lestonesMap,
  events,
  settings,
  holidays,
  viewMode,
  isLoading = false,
  onDragStart,
  onDragEnd,
}: DailyProjectSummaryRowProps) {w above the calendar showing project summaries for each day.
 * Each day column shows count of projects with estimated time and total hours.
 * Clicking opens a tooltip with project details. Labels are draggable to create events.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Project, Milestone, CalendarEvent, Settings, Holiday } from '@/types/core';
import { UnifiedDayEstimateService } from '@/services';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ClockArrowDown } from 'lucide-react';
import { getDateKey } from '@/utils/dateFormatUtils';
import * as DateCalculations from '@/services/calculations/general/dateCalculations';

interface DailyProjectSummaryRowProps {
  /** Array of dates to show (one per column) */
  dates: Date[];
  /** All projects */
  projects: Project[];
  /** Map of project ID to milestones */
  milestonesMap: Map<string, Milestone[]>;
  /** All calendar events */
  events: CalendarEvent[];
  /** User settings */
  settings: Settings;
  /** Holiday definitions */
  holidays: Holiday[];
  /** Current view mode */
  viewMode: 'week' | 'day';
  /** Callback when a project is being dragged */
  onDragStart?: (projectId: string, date: Date, estimatedHours: number) => void;
  /** Callback when drag ends */
  onDragEnd?: () => void;
}

interface ProjectSummary {
  projectId: string;
  projectName: string;
  client: string | null;
  estimatedHours: number;
  color?: string;
}

export function DailyProjectSummaryRow({
  dates,
  projects,
  milestonesMap,
  events,
  settings,
  holidays,
  viewMode,
  onDragStart,
  onDragEnd,
}: DailyProjectSummaryRowProps) {
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [draggedProject, setDraggedProject] = useState<{ projectId: string; date: Date; estimatedHours: number } | null>(null);
  const [timeAxisWidth, setTimeAxisWidth] = useState<number>(70); // Default fallback

  // Measure the actual FullCalendar time axis width
  useEffect(() => {
    const measureTimeAxis = () => {
      // Try multiple selectors to find the time axis
      const timeAxisElement = 
        document.querySelector('.fc-timegrid-axis') ||
        document.querySelector('.fc-timegrid-slot-label-cushion')?.parentElement ||
        document.querySelector('.fc-col-header .fc-timegrid-axis');
      
      if (timeAxisElement) {
        const width = timeAxisElement.getBoundingClientRect().width;
        if (width > 0) {
          setTimeAxisWidth(Math.round(width));
        }
      }
    };

    // Measure after a delay to ensure calendar is rendered
    const timeoutId = setTimeout(measureTimeAxis, 100);
    
    // Also measure on window resize
    window.addEventListener('resize', measureTimeAxis);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', measureTimeAxis);
    };
  }, []);

  // Calculate summaries for all dates
  const summariesByDate = useMemo(() => {
    return UnifiedDayEstimateService.getDailyProjectSummaries(
      dates,
      projects,
      milestonesMap,
      events,
      settings,
      holidays
    );
  }, [dates, projects, milestonesMap, events, settings, holidays]);

  // Handle popover open/close
  const handlePopoverChange = useCallback((dateKey: string, open: boolean) => {
    setOpenPopoverId(open ? dateKey : null);
  }, []);

  // Handle drag start for individual project
  const handleProjectDragStart = useCallback((e: React.DragEvent, projectId: string, date: Date, estimatedHours: number) => {
    e.stopPropagation();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    // Store drag data
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'project-estimate',
      projectId,
      date: date.toISOString(),
      estimatedHours,
      projectName: project.name,
      client: project.client
    }));

    // Create custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md shadow-lg';
    dragImage.textContent = `${project.name} (${DateCalculations.formatDuration(estimatedHours)})`;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);

    setDraggedProject({ projectId, date, estimatedHours });
    
    // Close popover when dragging starts
    setOpenPopoverId(null);
    
    if (onDragStart) {
      onDragStart(projectId, date, estimatedHours);
    }
  }, [projects, onDragStart]);

  // Handle drag end
  const handleProjectDragEnd = useCallback(() => {
    setDraggedProject(null);
    if (onDragEnd) {
      onDragEnd();
    }
  }, [onDragEnd]);

  // Render a single day column
  const renderDayColumn = (date: Date, index: number) => {
    const dateKey = getDateKey(date);
    const summaries = summariesByDate.get(dateKey) || [];

    if (summaries.length === 0) {
      return (
        <div key={dateKey} className="flex-1 flex items-center justify-center px-2 border-r border-gray-200 last:border-r-0">
          <span className="text-xs text-gray-400">—</span>
        </div>
      );
    }

    const totalHours = summaries.reduce((sum, s) => sum + s.estimatedHours, 0);
    const projectCount = summaries.length;
    const projectLabel = `${projectCount} project${projectCount !== 1 ? 's' : ''}`;
    const timeLabel = DateCalculations.formatDuration(totalHours);

    return (
      <div key={dateKey} className="flex-1 flex items-center px-2 border-r border-gray-200 last:border-r-0">
        <Popover 
          open={openPopoverId === dateKey}
          onOpenChange={(open) => handlePopoverChange(dateKey, open)}
        >
          <PopoverTrigger asChild>
            <button
              className="w-full px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 hover:border-gray-400 transition-colors cursor-pointer focus:outline-none flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                {/* Overlapping project color circles */}
                <div className="flex items-center" style={{ marginLeft: '0px' }}>
                  {summaries.slice(0, 5).map((summary, index) => (
                    <div
                      key={summary.projectId}
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{
                        backgroundColor: summary.color || '#9CA3AF',
                        marginLeft: index === 0 ? '0px' : '-8px',
                        zIndex: summaries.length - index
                      }}
                      title={summary.projectName}
                    />
                  ))}
                </div>
                <span>{projectLabel}</span>
              </div>
              <span>{timeLabel}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-80 p-0" 
            align="start"
            sideOffset={4}
          >
            <div className="max-h-96 overflow-y-auto">
              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700">
                  Projects for {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {summaries.map((summary) => (
                  <div
                    key={summary.projectId}
                    className="px-3 py-2.5 hover:bg-gray-50 transition-colors cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => handleProjectDragStart(e, summary.projectId, date, summary.estimatedHours)}
                    onDragEnd={handleProjectDragEnd}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {summary.projectName}
                        </p>
                        {summary.client && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {summary.client}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {DateCalculations.formatDuration(summary.estimatedHours)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  return (
    <div className="bg-gray-50">
      <div className="flex items-stretch h-12">
        {/* Left action column - dynamically matches FullCalendar's time axis width */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className="flex-shrink-0 border-r border-gray-200 bg-gray-50 flex items-center justify-center"
                style={{ width: `${timeAxisWidth}px` }}
              >
                <ClockArrowDown className="h-4 w-4 text-gray-600" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Estimated time</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Day columns */}
        {dates.map((date, index) => renderDayColumn(date, index))}
        
        {/* Scrollbar spacer - matches calendar scrollbar width */}
        <div className="flex-shrink-0 bg-gray-50" style={{ width: '17px' }} />
      </div>
    </div>
  );
}
