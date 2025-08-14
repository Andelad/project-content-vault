import React, { memo, useMemo } from 'react';
import { ProjectIconIndicator } from './ProjectIconIndicator';

interface StickyRightProjectIndicatorProps {
  rowId: string;
  projects: any[];
  viewportStart: Date;
  viewportEnd: Date;
  collapsed: boolean;
}

export const StickyRightProjectIndicator = memo(function StickyRightProjectIndicator({
  rowId,
  projects,
  viewportStart,
  viewportEnd,
  collapsed
}: StickyRightProjectIndicatorProps) {
  // Get projects in this specific row, sorted by start date
  const rowProjects = useMemo(() => 
    projects
      .filter(project => project.rowId === rowId)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  , [projects, rowId]);

  // Find the current visible project that should have a sticky indicator
  const currentVisibleProject = useMemo(() => {
    const normalizedViewportStart = new Date(viewportStart);
    normalizedViewportStart.setHours(0, 0, 0, 0);
    const normalizedViewportEnd = new Date(viewportEnd);
    normalizedViewportEnd.setHours(23, 59, 59, 999);

    // Find projects that are currently visible in the viewport
    const visibleProjects = rowProjects.filter(project => {
      const projectStart = new Date(project.startDate);
      const projectEnd = new Date(project.endDate);
      
      projectStart.setHours(0, 0, 0, 0);
      projectEnd.setHours(23, 59, 59, 999);
      
      // Project is visible if it overlaps with the viewport
      return !(projectEnd < normalizedViewportStart || projectStart > normalizedViewportEnd);
    });

    // Return the first visible project (earliest start date)
    return visibleProjects.length > 0 ? visibleProjects[0] : null;
  }, [rowProjects, viewportStart, viewportEnd]);

  // Don't render if no project is visible in this row
  if (!currentVisibleProject) {
    return null;
  }

  return (
    <div 
      className="absolute z-40 pointer-events-none"
      style={{
        left: `${collapsed ? 56 : 288}px`, // 48px/280px sidebar width + 8px gap
        top: '0px',
        height: '48px'
      }}
    >
      <div className="pointer-events-auto">
        <ProjectIconIndicator 
          project={currentVisibleProject}
        />
      </div>
    </div>
  );
});
