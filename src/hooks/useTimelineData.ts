import { useMemo } from 'react';
import { TimelineViewportService } from '@/services/timelineViewportService';

export function useTimelineData(projects: any[], viewportStart: Date, viewportDays: number, mode: 'days' | 'weeks' = 'days', collapsed: boolean = false) {
  return useMemo(() => {
    const timelineData = TimelineViewportService.generateTimelineData({
      projects,
      viewportStart,
      viewportDays,
      mode,
      sidebarCollapsed: collapsed
    });

    console.log(`🗓️ ${mode.toUpperCase()} VIEW DEBUG:`, {
      mode,
      datesGenerated: timelineData.dates.length,
      firstDate: timelineData.dates[0]?.toDateString(),
      lastDate: timelineData.dates[timelineData.dates.length - 1]?.toDateString(),
      calculatedEnd: timelineData.viewportEnd.toDateString(),
      filteredProjects: timelineData.filteredProjects.length
    });

    return timelineData;
  }, [projects, viewportStart, viewportDays, mode, collapsed]);
}