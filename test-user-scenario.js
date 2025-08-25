// Test to simulate the user's scenario exactly

// Simulate the actual project and milestone setup the user described
const project = {
  id: 'real-project',
  startDate: new Date('2025-01-01'), // Wednesday
  endDate: new Date('2025-01-07'),   // Tuesday (7 days, 5 working days)
  estimatedHours: 40,
  continuous: false,
  color: 'oklch(0.8 0.12 180)'
};

// User says: "one project is 40 hours, with 3 milestones at 10 hours each"
const milestones = [
  { id: 'milestone-1', projectId: 'real-project', name: 'Milestone 1', dueDate: new Date('2025-01-02'), timeAllocation: 10 },
  { id: 'milestone-2', projectId: 'real-project', name: 'Milestone 2', dueDate: new Date('2025-01-05'), timeAllocation: 10 }, // Over weekend gap
  { id: 'milestone-3', projectId: 'real-project', name: 'Milestone 3', dueDate: new Date('2025-01-06'), timeAllocation: 10 }
];

// Standard work schedule - Mon-Fri, 8 hours/day
const settings = {
  weeklyWorkHours: {
    sunday: [],
    monday: [{ startTime: '09:00', endTime: '17:00', duration: 8 }],
    tuesday: [{ startTime: '09:00', endTime: '17:00', duration: 8 }],
    wednesday: [{ startTime: '09:00', endTime: '17:00', duration: 8 }],
    thursday: [{ startTime: '09:00', endTime: '17:00', duration: 8 }],
    friday: [{ startTime: '09:00', endTime: '17:00', duration: 8 }],
    saturday: []
  }
};

const holidays = [];

// Some planned events for the first day (to test the "planned time" vs "auto-estimate" logic)
const events = [
  {
    id: 'event-1',
    projectId: 'real-project',
    title: 'Planned work',
    startTime: new Date('2025-01-01T09:00:00'),
    endTime: new Date('2025-01-01T12:00:00'), // 3 hours planned on Jan 1
  }
];

// Mock working day checker
function isWorkingDay(date) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  const workSlots = settings.weeklyWorkHours[dayName] || [];
  const totalHours = Array.isArray(workSlots) 
    ? workSlots.reduce((sum, slot) => sum + slot.duration, 0)
    : 0;
  return totalHours > 0;
}

// Simulate the getProjectTimeAllocation function
function getProjectTimeAllocation(projectId, date, events, project, settings, holidays) {
  // Check if it's a working day
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  const workSlots = settings.weeklyWorkHours[dayName] || [];
  
  const isWorkingDay = Array.isArray(workSlots) && 
    workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;

  if (!isWorkingDay) {
    return { type: 'none', hours: 0, isWorkingDay: false };
  }

  // Check for planned time (events connected to this project)
  const plannedHours = events
    .filter(event => 
      event.projectId === projectId && 
      event.startTime.toDateString() === date.toDateString()
    )
    .reduce((total, event) => {
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      return total + durationHours;
    }, 0);
  
  if (plannedHours > 0) {
    return { type: 'planned', hours: plannedHours, isWorkingDay: true };
  }

  // Check if this date is within the project timeframe
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);
  
  const projectStart = new Date(project.startDate);
  projectStart.setHours(0, 0, 0, 0);
  const projectEnd = new Date(project.endDate);
  projectEnd.setHours(0, 0, 0, 0);
  
  if (normalizedDate < projectStart || normalizedDate > projectEnd) {
    return { type: 'none', hours: 0, isWorkingDay: true };
  }

  // Calculate working days for the entire project
  const projectWorkingDays = [];
  for (let d = new Date(projectStart); d <= projectEnd; d.setDate(d.getDate() + 1)) {
    const checkDate = new Date(d);
    const checkDayName = dayNames[checkDate.getDay()];
    const checkWorkSlots = settings.weeklyWorkHours[checkDayName] || [];
    const checkTotalHours = Array.isArray(checkWorkSlots) 
      ? checkWorkSlots.reduce((sum, slot) => sum + slot.duration, 0)
      : 0;
    
    if (checkTotalHours > 0) {
      projectWorkingDays.push(new Date(checkDate));
    }
  }

  if (projectWorkingDays.length === 0) {
    return { type: 'none', hours: 0, isWorkingDay: true };
  }

  const autoEstimateHours = project.estimatedHours / projectWorkingDays.length;
  
  return { type: 'auto-estimate', hours: autoEstimateHours, isWorkingDay: true };
}

// Import the milestone segment calculation from the test (updated version)
function calculateMilestoneSegments(
  projectId,
  projectStartDate,
  projectEndDate,
  milestones,
  settings,
  holidays,
  isWorkingDay,
  events,
  projectTotalBudget
) {
  const projectMilestones = milestones
    .filter(m => m.projectId === projectId)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (projectMilestones.length === 0) {
    return [];
  }

  const segments = [];
  let currentStartDate = new Date(projectStartDate);
  currentStartDate.setHours(0, 0, 0, 0);

  // Calculate segments for each milestone
  for (let i = 0; i < projectMilestones.length; i++) {
    const milestone = projectMilestones[i];
    const milestoneDate = new Date(milestone.dueDate);
    milestoneDate.setHours(0, 0, 0, 0);

    // Segment end date is the milestone date itself (work happens up TO the milestone)
    const segmentEndDate = new Date(milestoneDate);

    // Count working days in this segment
    let workingDays = 0;
    for (let d = new Date(currentStartDate); d <= segmentEndDate; d.setDate(d.getDate() + 1)) {
      const checkDate = new Date(d);
      if (isWorkingDay(checkDate)) {
        workingDays++;
      }
    }

    // Calculate planned time in this segment
    let plannedTimeInSegment = 0;
    for (let d = new Date(currentStartDate); d <= segmentEndDate; d.setDate(d.getDate() + 1)) {
      const dayEvents = events.filter(event => {
        return event.projectId === projectId && 
               event.startTime.toDateString() === d.toDateString();
      });

      for (const event of dayEvents) {
        const durationMs = event.endTime.getTime() - event.startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        plannedTimeInSegment += durationHours;
      }
    }

    // Calculate remaining budget after planned time
    const remainingBudget = Math.max(0, milestone.timeAllocation - plannedTimeInSegment);
    
    // Calculate hours per day
    const hoursPerDay = workingDays > 0 ? remainingBudget / workingDays : 0;

    segments.push({
      id: `segment-${milestone.id}`,
      startDate: new Date(currentStartDate),
      endDate: new Date(segmentEndDate),
      milestone,
      allocatedHours: milestone.timeAllocation,
      workingDays,
      hoursPerDay,
      plannedTime: plannedTimeInSegment,
      remainingBudget
    });

    // Move to next segment start (day after milestone)
    currentStartDate = new Date(milestoneDate);
    currentStartDate.setDate(milestoneDate.getDate() + 1);
  }

  // Calculate remaining time after last milestone
  if (projectTotalBudget !== undefined && projectMilestones.length > 0) {
    const lastMilestone = projectMilestones[projectMilestones.length - 1];
    const lastMilestoneDate = new Date(lastMilestone.dueDate);
    lastMilestoneDate.setHours(0, 0, 0, 0);
    
    const remainingStartDate = new Date(lastMilestoneDate);
    remainingStartDate.setDate(lastMilestoneDate.getDate() + 1);
    
    const projectEnd = new Date(projectEndDate);
    projectEnd.setHours(0, 0, 0, 0);
    
    if (remainingStartDate <= projectEnd) {
      const totalMilestoneAllocations = projectMilestones.reduce(
        (sum, m) => sum + m.timeAllocation, 0
      );
      
      const remainingBudget = Math.max(0, projectTotalBudget - totalMilestoneAllocations);
      
      if (remainingBudget > 0) {
        let remainingWorkingDays = 0;
        for (let d = new Date(remainingStartDate); d <= projectEnd; d.setDate(d.getDate() + 1)) {
          const checkDate = new Date(d);
          if (isWorkingDay(checkDate)) {
            remainingWorkingDays++;
          }
        }

        const remainingPlannedTime = 0; // Simplified for this test
        const remainingAutoEstimateBudget = Math.max(0, remainingBudget - remainingPlannedTime);
        const remainingHoursPerDay = remainingWorkingDays > 0 ? remainingAutoEstimateBudget / remainingWorkingDays : 0;

        segments.push({
          id: `segment-remaining-${projectId}`,
          startDate: new Date(remainingStartDate),
          endDate: new Date(projectEnd),
          milestone: undefined,
          allocatedHours: remainingBudget,
          workingDays: remainingWorkingDays,
          hoursPerDay: remainingHoursPerDay,
          plannedTime: remainingPlannedTime,
          remainingBudget: remainingAutoEstimateBudget
        });
      }
    }
  }

  return segments;
}

function getMilestoneSegmentForDate(date, segments) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  return segments.find(segment => {
    const segmentStart = new Date(segment.startDate);
    const segmentEnd = new Date(segment.endDate);
    segmentStart.setHours(0, 0, 0, 0);
    segmentEnd.setHours(0, 0, 0, 0);
    
    return targetDate >= segmentStart && targetDate <= segmentEnd;
  }) || null;
}

// Run the test
console.log('=== TESTING USER SCENARIO ===');
console.log('Project: 40 hours, Jan 1-7');
console.log('Milestones: 3 milestones at 10h each on Jan 2, 5, 6');
console.log('Planned events: 3h on Jan 1');
console.log('');

const segments = calculateMilestoneSegments(
  project.id,
  project.startDate,
  project.endDate,
  milestones,
  settings,
  holidays,
  isWorkingDay,
  events,
  project.estimatedHours
);

console.log('=== MILESTONE SEGMENTS ===');
segments.forEach((segment, index) => {
  console.log(`Segment ${index + 1}: ${segment.startDate.toDateString()} to ${segment.endDate.toDateString()}`);
  console.log(`  Milestone: ${segment.milestone ? segment.milestone.name : 'Remaining time'}`);
  console.log(`  Allocated: ${segment.allocatedHours}h, Planned: ${segment.plannedTime}h, Remaining: ${segment.remainingBudget}h`);
  console.log(`  Working days: ${segment.workingDays}, Hours/day: ${segment.hoursPerDay.toFixed(2)}h`);
  console.log('');
});

console.log('=== DAY-BY-DAY TOOLTIP SIMULATION ===');

// Test each day of the project to simulate what tooltips would show
const testDates = [
  new Date('2025-01-01'), // Wed - should show planned time (3h)
  new Date('2025-01-02'), // Thu - milestone 1 day
  new Date('2025-01-03'), // Fri - weekend gap
  new Date('2025-01-04'), // Sat - weekend  
  new Date('2025-01-05'), // Sun - milestone 2 day
  new Date('2025-01-06'), // Mon - milestone 3 day
  new Date('2025-01-07'), // Tue - remaining time
];

testDates.forEach(date => {
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  console.log(`${dayName} ${date.toDateString()}:`);
  
  // Simulate the tooltip calculation logic
  const timeAllocation = getProjectTimeAllocation(
    project.id,
    date,
    events,
    project,
    settings,
    holidays
  );
  
  const milestoneSegmentForTooltip = getMilestoneSegmentForDate(date, segments);
  const isPlanned = timeAllocation.type === 'planned';
  const tooltipType = isPlanned ? 'Planned time' : 'Auto-estimate';
  const tooltipHours = isPlanned
    ? timeAllocation.hours
    : (milestoneSegmentForTooltip ? milestoneSegmentForTooltip.hoursPerDay : timeAllocation.hours);
  
  console.log(`  Time allocation: ${timeAllocation.type}, ${timeAllocation.hours.toFixed(2)}h`);
  console.log(`  Milestone segment: ${milestoneSegmentForTooltip ? `${milestoneSegmentForTooltip.hoursPerDay.toFixed(2)}h/day` : 'none'}`);
  console.log(`  Tooltip: ${tooltipType} - ${tooltipHours.toFixed(2)}h/day`);
  console.log('');
});

console.log('=== ANALYSIS ===');
console.log('User complaints:');
console.log('1. "First segment is over 1 day and recommends nothing"');
console.log('   - Jan 1 should show PLANNED time (3h), not auto-estimate');
console.log('   - If showing 0h, there might be a calculation bug');
console.log('');
console.log('2. "Second segment is over 3 days and suggests 5 hours for each"');
console.log('   - This should be the Jan 3-5 period leading to milestone 2');
console.log('   - But Jan 3-4 are weekend days (no work)');
console.log('   - Only Jan 5 is a working day in that segment');
console.log('');
console.log('3. "Should only be planned time attributed to that project"');
console.log('   - Events need to have projectId matching the project');
console.log('   - Tooltip logic should prioritize planned time over auto-estimate');
