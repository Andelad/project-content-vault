// timeline-calculations.worker.js
// Import the centralized height calculation service
// Note: In a real implementation, you'd need to set up proper module imports for web workers
// For now, we'll inline the calculation function

function calculateRectangleHeight(hoursPerDay, maxHeight = 28) {
  if (hoursPerDay === 0) return 0;
  const heightInPixels = Math.max(3, Math.round(hoursPerDay * 2));
  return Math.min(heightInPixels, maxHeight);
}

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
            height: calculateRectangleHeight(timeAllocation.hours, 28)
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
