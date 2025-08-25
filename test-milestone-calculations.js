// Test to debug milestone calculation issues

// Mock data representing the scenario described by the user
const project = {
  id: 'test-project',
  startDate: new Date('2025-01-01'), // 40 hours, 1 day
  endDate: new Date('2025-01-05'),   // 5 days total
  estimatedHours: 40,
  continuous: false
};

const milestones = [
  { id: 'milestone-1', projectId: 'test-project', name: 'Milestone 1', dueDate: new Date('2025-01-02'), timeAllocation: 10 },
  { id: 'milestone-2', projectId: 'test-project', name: 'Milestone 2', dueDate: new Date('2025-01-03'), timeAllocation: 10 },
  { id: 'milestone-3', projectId: 'test-project', name: 'Milestone 3', dueDate: new Date('2025-01-04'), timeAllocation: 10 }
];

// Mock settings for 8 hours work days
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
const events = []; // No planned events initially

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

// Mock the milestone segment calculation logic
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

  console.log('\n=== MILESTONE SEGMENT CALCULATION DEBUG ===');
  console.log(`Project: ${projectId}`);
  console.log(`Project period: ${projectStartDate.toDateString()} to ${projectEndDate.toDateString()}`);
  console.log(`Total budget: ${projectTotalBudget}h`);
  console.log(`Milestones: ${projectMilestones.length}`);

  // Calculate segments for each milestone
  for (let i = 0; i < projectMilestones.length; i++) {
    const milestone = projectMilestones[i];
    const milestoneDate = new Date(milestone.dueDate);
    milestoneDate.setHours(0, 0, 0, 0);

    // Segment end date is the milestone date itself (work happens up TO the milestone)
    const segmentEndDate = new Date(milestoneDate);

    console.log(`\n--- Milestone ${i+1}: ${milestone.name} ---`);
    console.log(`Milestone date: ${milestoneDate.toDateString()}`);
    console.log(`Current start date: ${currentStartDate.toDateString()}`);
    console.log(`Segment: ${currentStartDate.toDateString()} to ${segmentEndDate.toDateString()}`);
    console.log(`Milestone allocation: ${milestone.timeAllocation}h`);

    // Count working days in this segment
    let workingDays = 0;
    for (let d = new Date(currentStartDate); d <= segmentEndDate; d.setDate(d.getDate() + 1)) {
      const checkDate = new Date(d);
      if (isWorkingDay(checkDate)) {
        workingDays++;
        console.log(`  Working day: ${checkDate.toDateString()}`);
      } else {
        console.log(`  Non-working day: ${checkDate.toDateString()}`);
      }
    }

    // Calculate planned time in this segment (none for this test)
    const plannedTimeInSegment = 0; // No events for this test

    // Calculate remaining budget after planned time
    const remainingBudget = Math.max(0, milestone.timeAllocation - plannedTimeInSegment);
    
    // Calculate hours per day
    const hoursPerDay = workingDays > 0 ? remainingBudget / workingDays : 0;

    console.log(`Working days in segment: ${workingDays}`);
    console.log(`Planned time in segment: ${plannedTimeInSegment}h`);
    console.log(`Remaining budget: ${remainingBudget}h`);
    console.log(`Hours per day: ${hoursPerDay.toFixed(2)}h`);

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
    
    // Start from the day after the last milestone
    const remainingStartDate = new Date(lastMilestoneDate);
    remainingStartDate.setDate(lastMilestoneDate.getDate() + 1);
    
    const projectEnd = new Date(projectEndDate);
    projectEnd.setHours(0, 0, 0, 0);
    
    console.log(`\n--- Remaining Segment ---`);
    console.log(`Remaining period: ${remainingStartDate.toDateString()} to ${projectEnd.toDateString()}`);
    
    // Only create remaining segment if there are days between last milestone and project end
    if (remainingStartDate <= projectEnd) {
      // Calculate total milestone allocations
      const totalMilestoneAllocations = projectMilestones.reduce(
        (sum, m) => sum + m.timeAllocation, 0
      );
      
      // Calculate remaining budget
      const remainingBudget = Math.max(0, projectTotalBudget - totalMilestoneAllocations);
      
      console.log(`Total milestone allocations: ${totalMilestoneAllocations}h`);
      console.log(`Remaining budget: ${remainingBudget}h`);
      
      if (remainingBudget > 0) {
        // Count working days in remaining period
        let remainingWorkingDays = 0;
        for (let d = new Date(remainingStartDate); d <= projectEnd; d.setDate(d.getDate() + 1)) {
          const checkDate = new Date(d);
          if (isWorkingDay(checkDate)) {
            remainingWorkingDays++;
            console.log(`  Working day: ${checkDate.toDateString()}`);
          } else {
            console.log(`  Non-working day: ${checkDate.toDateString()}`);
          }
        }

        const remainingPlannedTime = 0; // No events for this test
        const remainingAutoEstimateBudget = Math.max(0, remainingBudget - remainingPlannedTime);
        const remainingHoursPerDay = remainingWorkingDays > 0 ? remainingAutoEstimateBudget / remainingWorkingDays : 0;

        console.log(`Remaining working days: ${remainingWorkingDays}`);
        console.log(`Remaining hours per day: ${remainingHoursPerDay.toFixed(2)}h`);

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

// Run the test
console.log('Testing milestone calculation with 40h project, 3 milestones at 10h each...\n');

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

console.log('\n=== FINAL RESULTS ===');
segments.forEach((segment, index) => {
  console.log(`\nSegment ${index + 1}:`);
  console.log(`  Period: ${segment.startDate.toDateString()} to ${segment.endDate.toDateString()}`);
  console.log(`  Milestone: ${segment.milestone ? segment.milestone.name : 'Remaining time'}`);
  console.log(`  Allocated hours: ${segment.allocatedHours}h`);
  console.log(`  Working days: ${segment.workingDays}`);
  console.log(`  Hours per day: ${segment.hoursPerDay.toFixed(2)}h`);
});

console.log('\n=== USER REPORTED ISSUE ANALYSIS ===');
console.log('User says:');
console.log('- Project is 40 hours total');
console.log('- 3 milestones at 10 hours each = 30 hours');
console.log('- Should leave 10 hours for a fourth segment');
console.log('- Second segment is over 3 days but suggests 5 hours each');
console.log('- First segment is over 1 day and recommends nothing');

const firstSegment = segments[0];
const secondSegment = segments[1];

console.log(`\nActual calculations:`);
console.log(`First segment (${firstSegment.startDate.toDateString()} to ${firstSegment.endDate.toDateString()}):`);
console.log(`  - Duration: ${firstSegment.workingDays} working day(s)`);
console.log(`  - Hours per day: ${firstSegment.hoursPerDay.toFixed(2)}h`);
console.log(`  - Expected by user: should recommend time for this project`);

if (secondSegment) {
  console.log(`\nSecond segment (${secondSegment.startDate.toDateString()} to ${secondSegment.endDate.toDateString()}):`);
  console.log(`  - Duration: ${secondSegment.workingDays} working day(s)`);
  console.log(`  - Hours per day: ${secondSegment.hoursPerDay.toFixed(2)}h`);
  console.log(`  - User reports: over 3 days, suggests 5 hours each`);
}

console.log('\n=== ISSUE IDENTIFIED ===');
console.log('The problem appears to be in the segment date calculation:');
console.log('- Segment end date is calculated as "one day BEFORE the milestone date"');
console.log('- This creates gaps or overlaps in the timeline');
console.log('- Working day calculation may not align with actual project days');
