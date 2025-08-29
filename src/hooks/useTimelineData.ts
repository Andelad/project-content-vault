import { useMemo } from 'react';
import { TimelineViewportService } from '@/services';

export function useTimelineData(projects: any[], viewportStart: Date, viewportDays: number, mode: 'days' | 'weeks' = 'days', collapsed: boolean = false) {
  return useMemo(() => {
    const timelineData = TimelineViewportService.generateTimelineData({
      projects,
      viewportStart,
      viewportDays,
      mode,
      sidebarCollapsed: collapsed
    });

    return timelineData;
  }, [projects, viewportStart, viewportDays, mode, collapsed]);
}