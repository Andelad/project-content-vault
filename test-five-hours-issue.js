// Test to investigate the "5 hours each" issue

// Create a scenario that might match what the user is seeing
const project = {
  id: 'test-project-2',
  startDate: new Date('2025-01-01'), // Wednesday
  endDate: new Date('2025-01-08'),   // Wednesday next week
  estimatedHours: 40,
  continuous: false
};

// Milestones that might create the "5 hours each" scenario
const milestones = [
  { id: 'milestone-1', projectId: 'test-project-2', name: 'Milestone 1', dueDate: new Date('2025-01-02'), timeAllocation: 10 },
  { id: 'milestone-2', projectId: 'test-project-2', name: 'Milestone 2', dueDate: new Date('2025-01-06'), timeAllocation: 10 }, // Monday
  { id: 'milestone-3', projectId: 'test-project-2', name: 'Milestone 3', dueDate: new Date('2025-01-07'), timeAllocation: 10 }
];

// Work schedule
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
const events = []; // No planned events

function isWorkingDay(date) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];
  const workSlots = settings.weeklyWorkHours[dayName] || [];
  const totalHours = Array.isArray(workSlots) 
    ? workSlots.reduce((sum, slot) => sum + slot.duration, 0)
    : 0;
  return totalHours > 0;
}

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

  console.log('\n=== INVESTIGATING 5h/day ISSUE ===');
  console.log(`Project: ${projectStartDate.toDateString()} to ${projectEndDate.toDateString()}`);

  for (let i = 0; i < projectMilestones.length; i++) {
    const milestone = projectMilestones[i];
    const milestoneDate = new Date(milestone.dueDate);
    milestoneDate.setHours(0, 0, 0, 0);

    const segmentEndDate = new Date(milestoneDate);

    console.log(`\n--- Milestone ${i+1}: ${milestone.name} ---`);
    console.log(`Milestone due: ${milestoneDate.toDateString()}`);
    console.log(`Segment: ${currentStartDate.toDateString()} to ${segmentEndDate.toDateString()}`);
    console.log(`Allocation: ${milestone.timeAllocation}h`);

    // Count working days and log each day
    let workingDays = 0;
    console.log('Days in segment:');
    for (let d = new Date(currentStartDate); d <= segmentEndDate; d.setDate(d.getDate() + 1)) {
      const checkDate = new Date(d);
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][checkDate.getDay()];
      const isWorking = isWorkingDay(checkDate);
      
      if (isWorking) {
        workingDays++;
        console.log(`  ${dayName} ${checkDate.toDateString()} - WORKING DAY`);
      } else {
        console.log(`  ${dayName} ${checkDate.toDateString()} - weekend/holiday`);
      }
    }

    const plannedTimeInSegment = 0; // No events for this test
    const remainingBudget = Math.max(0, milestone.timeAllocation - plannedTimeInSegment);
    const hoursPerDay = workingDays > 0 ? remainingBudget / workingDays : 0;

    console.log(`Working days: ${workingDays}`);
    console.log(`Hours per day: ${hoursPerDay.toFixed(2)}h`);

    // Check if this could produce "5 hours each"
    if (Math.abs(hoursPerDay - 5.0) < 0.1) {
      console.log('🎯 FOUND POTENTIAL "5 hours each" SCENARIO!');
    }

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

    currentStartDate = new Date(milestoneDate);
    currentStartDate.setDate(milestoneDate.getDate() + 1);
  }

  // Remaining segment
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
      
      console.log(`\n--- Remaining Segment ---`);
      console.log(`Period: ${remainingStartDate.toDateString()} to ${projectEnd.toDateString()}`);
      console.log(`Remaining budget: ${remainingBudget}h`);
      
      if (remainingBudget > 0) {
        let remainingWorkingDays = 0;
        console.log('Remaining days:');
        for (let d = new Date(remainingStartDate); d <= projectEnd; d.setDate(d.getDate() + 1)) {
          const checkDate = new Date(d);
          const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][checkDate.getDay()];
          const isWorking = isWorkingDay(checkDate);
          
          if (isWorking) {
            remainingWorkingDays++;
            console.log(`  ${dayName} ${checkDate.toDateString()} - WORKING DAY`);
          } else {
            console.log(`  ${dayName} ${checkDate.toDateString()} - weekend/holiday`);
          }
        }

        const remainingHoursPerDay = remainingWorkingDays > 0 ? remainingBudget / remainingWorkingDays : 0;
        console.log(`Remaining working days: ${remainingWorkingDays}`);
        console.log(`Remaining hours per day: ${remainingHoursPerDay.toFixed(2)}h`);

        if (Math.abs(remainingHoursPerDay - 5.0) < 0.1) {
          console.log('🎯 FOUND POTENTIAL "5 hours each" SCENARIO in remaining segment!');
        }

        segments.push({
          id: `segment-remaining-${projectId}`,
          startDate: new Date(remainingStartDate),
          endDate: new Date(projectEnd),
          milestone: undefined,
          allocatedHours: remainingBudget,
          workingDays: remainingWorkingDays,
          hoursPerDay: remainingHoursPerDay,
          plannedTime: 0,
          remainingBudget
        });
      }
    }
  }

  return segments;
}

console.log('Testing scenario that might produce "5 hours each"...');

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

console.log('\n=== SUMMARY ===');
segments.forEach((segment, index) => {
  const daysSpan = Math.ceil((segment.endDate - segment.startDate) / (1000 * 60 * 60 * 24)) + 1;
  console.log(`Segment ${index + 1} (${segment.milestone ? segment.milestone.name : 'Remaining'}):`);
  console.log(`  Spans ${daysSpan} calendar days, ${segment.workingDays} working days`);
  console.log(`  ${segment.hoursPerDay.toFixed(2)}h per working day`);
  
  if (Math.abs(segment.hoursPerDay - 5.0) < 0.1) {
    console.log('  ⭐ THIS COULD BE THE "5 hours each" SEGMENT!');
  }
});

console.log('\n=== HYPOTHESIS ===');
console.log('The user might be seeing a segment where:');
console.log('- 10 hours allocated to a milestone');
console.log('- 2 working days in the segment'); 
console.log('- 10h ÷ 2 days = 5h per day');
console.log('- User says "over 3 days" because they might be counting calendar days including weekends');
