// timeline-calculations.worker.js
self.addEventListener('message', function(e) {
  const { projects, dates, settings, holidays, mode } = e.data;
  
  if (mode === 'weeks') {
    // Batch process all week calculations
    const results = [];
    
    projects.forEach(project => {
      dates.forEach((weekStart, weekIndex) => {
        const weekCalculations = [];
        
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
          const currentDay = new Date(weekStart);
          currentDay.setDate(weekStart.getDate() + dayOfWeek);
          
          // Do expensive calculations in worker thread
          const timeAllocation = calculateTimeAllocation(project, currentDay, settings);
          const isWorking = calculateIsWorkingDay(currentDay, settings, holidays);
          
          weekCalculations.push({
            day: currentDay.getTime(),
            timeAllocation,
            isWorking,
            height: Math.max(3, Math.round(timeAllocation.hours * 2))
          });
        }
        
        results.push({
          projectId: project.id,
          weekIndex,
          calculations: weekCalculations
        });
      });
    });
    
    // Send results back to main thread
    self.postMessage({ type: 'WEEK_CALCULATIONS_COMPLETE', results });
  }
});
