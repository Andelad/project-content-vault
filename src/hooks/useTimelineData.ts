import { useMemo } from 'react';

export function useTimelineData(projects: any[], viewportStart: Date, viewportDays: number, mode: 'days' | 'weeks' = 'days', collapsed: boolean = false) {
  return useMemo(() => {
    // Calculate visible columns using the EXACT same logic as useDynamicViewportDays
    const calculateVisibleColumns = () => {
      const viewportWidth = window.innerWidth;
      const sidebarWidth = collapsed ? 48 : 280;
      const margins = 100;
      const availableWidth = Math.max(600, viewportWidth - sidebarWidth - margins);
      
      if (mode === 'weeks') {
        const theoreticalColumns = Math.floor(availableWidth / 72);
        return Math.max(1, theoreticalColumns - 2); // Subtract 2 weeks to match actual display
      } else {
        const theoreticalColumns = Math.floor(availableWidth / 40);
        return Math.max(1, theoreticalColumns - 5); // Subtract 5 days to match actual display
      }
    };
    
    const visibleColumns = calculateVisibleColumns();
    
    if (mode === 'weeks') {
      // For weeks mode, show only the visible week columns
      const actualWeeks = visibleColumns;
      
      // Adjust viewportStart to start of week (Monday)
      const weekStart = new Date(viewportStart);
      const day = weekStart.getDay();
      const daysToSubtract = day === 0 ? 6 : day - 1;
      weekStart.setDate(weekStart.getDate() - daysToSubtract);
      
      // Generate array of week start dates for visible weeks only
      const dates = [];
      for (let w = 0; w < actualWeeks; w++) {
        const weekDate = new Date(weekStart);
        weekDate.setDate(weekStart.getDate() + (w * 7));
        weekDate.setHours(0, 0, 0, 0);
        dates.push(weekDate);
      }
      
      // Calculate viewport end based on the last visible week
      const lastWeekStart = dates[dates.length - 1];
      const viewportEnd = new Date(lastWeekStart);
      viewportEnd.setDate(lastWeekStart.getDate() + 6); // End of the last week (Sunday)
      
      console.log(`🗓️ WEEKS VIEW DEBUG:`, {
        availableWidth: Math.max(600, window.innerWidth - (collapsed ? 48 : 280) - 100),
        visibleColumns,
        actualWeeks,
        datesGenerated: dates.length,
        firstDate: dates[0]?.toDateString(),
        lastDate: dates[dates.length - 1]?.toDateString(),
        calculatedEnd: viewportEnd.toDateString()
      });
      
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
      // For days mode, show only the visible day columns
      const actualDays = visibleColumns;
      
      // Generate array of dates for visible days only
      const dates = [];
      for (let d = 0; d < actualDays; d++) {
        const normalizedDate = new Date(viewportStart);
        normalizedDate.setDate(viewportStart.getDate() + d);
        normalizedDate.setHours(0, 0, 0, 0);
        dates.push(normalizedDate);
      }
      
      // Calculate viewport end based on the last visible day
      const viewportEnd = new Date(dates[dates.length - 1]);
      
      console.log(`📅 DAYS VIEW DEBUG:`, {
        availableWidth: Math.max(600, window.innerWidth - (collapsed ? 48 : 280) - 100),
        visibleColumns,
        actualDays,
        datesGenerated: dates.length,
        firstDate: dates[0]?.toDateString(),
        lastDate: dates[dates.length - 1]?.toDateString(),
        calculatedEnd: viewportEnd.toDateString()
      });
      
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
  }, [projects, viewportStart, viewportDays, mode, collapsed]);
}