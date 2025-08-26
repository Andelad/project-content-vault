// Mock the calculateMilestoneSegments function since we can't import TS directly
function calculateMilestoneSegments(
  projectId,
  projectStartDate,
  projectEndDate,
  milestones,
  settings,
  holidays,
  isWorkingDay,
  events
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

  for (let i = 0; i < projectMilestones.length; i++) {
    const milestone = projectMilestones[i];
    const milestoneDate = new Date(milestone.dueDate);
    milestoneDate.setHours(0, 0, 0, 0);

    // Segment end date is the milestone date itself (work happens up TO the milestone)
    const segmentEndDate = new Date(milestoneDate);

    // Calculate working days in this segment (INCLUSIVE of milestone date)
    let workingDays = 0;
    const current = new Date(currentStartDate);
    
    console.log(`\n--- Calculating working days for segment ---`);
    console.log(`Start: ${currentStartDate.toDateString()}`);
    console.log(`End: ${segmentEndDate.toDateString()}`);
    
    while (current <= segmentEndDate) {
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][current.getDay()];
      const isWorking = isWorkingDay(current);
      
      if (isWorking) {
        workingDays++;
        console.log(`  ${dayName} ${current.toDateString()} - WORKING DAY (${workingDays})`);
      } else {
        console.log(`  ${dayName} ${current.toDateString()} - weekend`);
      }
      
      current.setDate(current.getDate() + 1);
    }

    // Calculate total planned time in this segment (none for this test)
    const plannedTimeInSegment = 0;

    // Subtract planned time from milestone budget for auto-estimate
    const remainingBudget = Math.max(0, milestone.timeAllocation - plannedTimeInSegment);

    // Calculate hours per day
    const hoursPerDay = workingDays > 0 ? remainingBudget / workingDays : 0;

    console.log(`\nSegment calculation:`);
    console.log(`  Working days: ${workingDays}`);
    console.log(`  Remaining budget: ${remainingBudget}h`);
    console.log(`  Hours per day: ${hoursPerDay.toFixed(2)}h`);

    segments.push({
      id: `segment-${milestone.id}`,
      startDate: new Date(currentStartDate),
      endDate: new Date(segmentEndDate),
      milestone,
      allocatedHours: milestone.timeAllocation,
      workingDays,
      hoursPerDay
    });

    // Move to next segment start (day after milestone)
    currentStartDate = new Date(milestoneDate);
    currentStartDate.setDate(milestoneDate.getDate() + 1);
  }

  return segments;
}

// Simulate the user's scenario:
// - New project with a milestone set as 10 hours
// - 6 work days between start and milestone date
// - No planned time
// - Should be 10h ÷ 6 days = 1.67h per day, but showing 2h

const projectId = 'test-project';
const projectStartDate = new Date('2025-01-06'); // Monday
const milestoneDate = new Date('2025-01-13'); // Monday (next week)

const milestone = {
  id: 'milestone-1',
  projectId: projectId,
  name: 'Test Milestone',
  dueDate: milestoneDate,
  timeAllocation: 10 // 10 hours
};

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

function isWorkingDay(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
}

const holidays = [];
const events = []; // No planned events

console.log('=== USER SCENARIO DEBUG ===');
console.log(`Project start: ${projectStartDate.toDateString()}`);
console.log(`Milestone due: ${milestoneDate.toDateString()}`);
console.log(`Milestone allocation: ${milestone.timeAllocation} hours`);
console.log(`Expected: 10h ÷ 6 working days = 1.67h per day`);
console.log(`User reports: showing 2h per day instead\n`);

// Count the working days between start and milestone manually
console.log('Manual working day count:');
let manualWorkingDays = 0;
const current = new Date(projectStartDate);
while (current <= milestoneDate) {
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][current.getDay()];
  const isWorking = isWorkingDay(current);
  
  if (isWorking) {
    manualWorkingDays++;
    console.log(`  ${dayName} ${current.toDateString()} - WORKING DAY`);
  } else {
    console.log(`  ${dayName} ${current.toDateString()} - weekend`);
  }
  
  current.setDate(current.getDate() + 1);
}

console.log(`\nManual count: ${manualWorkingDays} working days`);
console.log(`Manual calculation: ${milestone.timeAllocation} ÷ ${manualWorkingDays} = ${(milestone.timeAllocation / manualWorkingDays).toFixed(2)}h per day\n`);

// Now test the actual function
try {
  const segments = calculateMilestoneSegments(
    projectId,
    projectStartDate,
    milestoneDate, // Using milestone date as project end for simplicity
    [milestone],
    settings,
    holidays,
    isWorkingDay,
    events
  );

  console.log('=== ACTUAL CALCULATION RESULT ===');
  if (segments.length > 0) {
    const segment = segments[0];
    console.log(`Segment period: ${segment.startDate.toDateString()} to ${segment.endDate.toDateString()}`);
    console.log(`Calculated working days: ${segment.workingDays}`);
    console.log(`Hours per day: ${segment.hoursPerDay.toFixed(2)}h`);
    console.log(`Allocated hours: ${segment.allocatedHours}h`);
    
    if (Math.abs(segment.hoursPerDay - 2.0) < 0.1) {
      console.log('\n🚨 CONFIRMED: Bug reproduces - showing 2h instead of 1.67h');
    } else if (Math.abs(segment.hoursPerDay - 1.67) < 0.1) {
      console.log('\n✅ Calculation is correct');
    } else {
      console.log(`\n❓ Unexpected result: ${segment.hoursPerDay.toFixed(2)}h per day`);
    }
  } else {
    console.log('No segments calculated');
  }

} catch (error) {
  console.error('Error running calculation:', error.message);
}
