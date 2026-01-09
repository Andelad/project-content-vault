import { useMemo } from 'react';
import { TimelineViewportService } from '@/services';
import type { Project } from '@/types/core';

export function useTimelineData(
  projects: Project[], 
  viewportStart: Date, 
  viewportDays: number, 
  mode: 'days' | 'weeks' = 'days', 
  timelineSidebarCollapsed: boolean = false,
  mainSidebarCollapsed: boolean = false
) {
  return useMemo(() => {
    const timelineData = TimelineViewportService.generateTimelineData({
      projects,
      viewportStart,
      viewportDays,
      mode,
      timelineSidebarCollapsed,
      mainSidebarCollapsed
    });

    return timelineData;
  }, [projects, viewportStart, viewportDays, mode, timelineSidebarCollapsed, mainSidebarCollapsed]);
}