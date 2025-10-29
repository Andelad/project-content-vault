import React, { memo, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';

interface RowScrollIndicatorProps {
  rowId: string;
  projects: any[];
  viewportStart: Date;
  viewportEnd: Date;
  onScrollToProject: (project: any) => void;
}

export const RowScrollIndicator = memo(function RowScrollIndicator({
  rowId,
  projects,
  viewportStart,
  viewportEnd,
  onScrollToProject
}: RowScrollIndicatorProps) {
  // Get projects in this specific row
  const rowProjects = useMemo(() => 
    projects.filter(project => project.rowId === rowId)
  , [projects, rowId]);

  // Check if any projects are currently visible in the viewport
  const visibleProjects = useMemo(() => 
    rowProjects.filter(project => {
      const projectStart = new Date(project.startDate);
      
      // Normalize dates for comparison
      projectStart.setHours(0, 0, 0, 0);
      
      const normalizedViewportStart = new Date(viewportStart);
      normalizedViewportStart.setHours(0, 0, 0, 0);
      const normalizedViewportEnd = new Date(viewportEnd);
      normalizedViewportEnd.setHours(23, 59, 59, 999);
      
      // For continuous projects, they're visible as long as they've started
      if (project.continuous) {
        return projectStart <= normalizedViewportEnd;
      }
      
      // For non-continuous projects, check both start and end dates
      const projectEnd = new Date(project.endDate);
      projectEnd.setHours(23, 59, 59, 999);
      
      // Project is visible if it overlaps with the viewport
      return !(projectEnd < normalizedViewportStart || projectStart > normalizedViewportEnd);
    })
  , [rowProjects, viewportStart, viewportEnd]);

  // Find the next project that is completely to the right (future) and not visible
  const nextProject = useMemo(() => {
    const futureProjects = rowProjects.filter(project => {
      const projectStart = new Date(project.startDate);
      projectStart.setHours(0, 0, 0, 0);
      
      const normalizedViewportEnd = new Date(viewportEnd);
      normalizedViewportEnd.setHours(23, 59, 59, 999);
      
      // Project is in the future if it starts after the viewport ends
      return projectStart > normalizedViewportEnd;
    });
    
    // Sort by start date and return the earliest one
    return futureProjects.sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )[0];
  }, [rowProjects, viewportEnd]);

  // Show indicator only if:
  // 1. Row has no visible projects AND
  // 2. There is a future project to scroll to
  const shouldShowIndicator = visibleProjects.length === 0 && nextProject;

  if (!shouldShowIndicator) {
    return null;
  }

  const handleScrollToNext = () => {
    if (nextProject) {
      onScrollToProject(nextProject);
    }
  };

  return (
    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-30">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
        onClick={handleScrollToNext}
        title={`Scroll to ${nextProject.name}`}
      >
        <ChevronRight className="w-3 h-3 text-gray-600" />
      </Button>
    </div>
  );
});
