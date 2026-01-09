import { useMemo } from 'react';
import { TimelineViewport } from '@/presentation/services/TimelineViewportService';;
import type { Project } from '@/shared/types/core';

export function useTimelineData(
  projects: Project[], 
  viewportStart: Date, 
  viewportDays: number, 
  mode: 'days' | 'weeks' = 'days', 
  timelineSidebarCollapsed: boolean = false,
  mainSidebarCollapsed: boolean = false
) {
  return useMemo(() => {
    const timelineData = TimelineViewport.generateTimelineData({
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