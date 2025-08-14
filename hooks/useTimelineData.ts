import { useMemo } from 'react';

export function useTimelineData(projects: any[], viewportStart: Date, viewportDays: number, mode: 'days' | 'weeks' = 'days') {
  return useMemo(() => {
    if (mode === 'weeks') {
      // For weeks mode, calculate the number of weeks to show
      const viewportWeeks = Math.ceil(viewportDays / 7);
      
      // Adjust viewportStart to start of week (Monday)
      const weekStart = new Date(viewportStart);
      const day = weekStart.getDay();
      const daysToSubtract = day === 0 ? 6 : day - 1; // Adjust for Monday start
      weekStart.setDate(weekStart.getDate() - daysToSubtract);
      
      // Calculate viewport end based on weeks
      const viewportEnd = new Date(weekStart);
      viewportEnd.setDate(weekStart.getDate() + (viewportWeeks * 7) - 1);
      
      // Generate array of week start dates
      const dates = [];
      for (let w = 0; w < viewportWeeks; w++) {
        const weekDate = new Date(weekStart);
        weekDate.setDate(weekStart.getDate() + (w * 7));
        dates.push(weekDate);
      }
      
      // Filter projects that intersect with the current viewport
      const filteredProjects = (projects || []).filter(project => {
        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);
        return !(projectEnd < weekStart || projectStart > viewportEnd);
      });
      
      return {
        dates,
        viewportEnd,
        filteredProjects,
        mode: 'weeks' as const,
        actualViewportStart: weekStart
      };
    } else {
      // Original days logic
      const viewportEnd = new Date(viewportStart);
      viewportEnd.setDate(viewportStart.getDate() + viewportDays - 1);
      
      // Generate array of dates for the current viewport
      const dates = [];
      for (let d = new Date(viewportStart); d <= viewportEnd; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
      
      // Filter projects that intersect with the current viewport
      const filteredProjects = (projects || []).filter(project => {
        const projectStart = new Date(project.startDate);
        const projectEnd = new Date(project.endDate);
        return !(projectEnd < viewportStart || projectStart > viewportEnd);
      });
      
      return {
        dates,
        viewportEnd,
        filteredProjects,
        mode: 'days' as const,
        actualViewportStart: viewportStart
      };
    }
  }, [projects, viewportStart, viewportDays, mode]);
}