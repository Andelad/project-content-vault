// Example: Pre-computed week segments approach
const useWeekSegments = (project, dates, mode, settings, holidays) => {
  return useMemo(() => {
    if (mode !== 'weeks') return null;
    
    // Pre-compute all week segments for this project
    return dates.map(weekStart => {
      const weekSegments = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const currentDay = new Date(weekStart);
        currentDay.setDate(weekStart.getDate() + dayOfWeek);
        
        // Do all expensive calculations once and cache
        const segment = {
          day: currentDay,
          isWorkingDay: isWorkingDay(currentDay),
          timeAllocation: memoizedGetProjectTimeAllocation(...),
          milestoneSegment: getMilestoneSegmentForDate(...),
          // Cache all calculated values
        };
        weekSegments.push(segment);
      }
      return weekSegments;
    });
  }, [project.id, project.startDate, project.endDate, dates, settings, holidays]);
};
