// Test first milestone vs subsequent milestones calculation

// Simulate a project with multiple milestones to see if there's a pattern
console.log('=== TESTING FIRST MILESTONE VS SUBSEQUENT MILESTONES ===\n');

// Mock the milestone segment calculation
function calculateWorkingDaysInRange(startDate, endDate, isWorkingDay) {
  let workingDays = 0;
  const current = new Date(startDate);
  
  console.log(`  Calculating working days from ${startDate.toDateString()} to ${endDate.toDateString()}`);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
    const isWorking = isWorkingDay(current);
    
    if (isWorking) {
      workingDays++;
      console.log(`    ${dayName} ${current.toDateString()} - WORKING DAY (${workingDays})`);
    } else {
      console.log(`    ${dayName} ${current.toDateString()} - weekend`);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`  Total working days: ${workingDays}\n`);
  return workingDays;
}

function isWorkingDay(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
}

// Test scenario: Project starts Monday, multiple milestones
const projectStartDate = new Date('2025-01-06'); // Monday
const milestones = [
  { id: 'milestone-1', dueDate: new Date('2025-01-10'), timeAllocation: 20 }, // Friday same week
  { id: 'milestone-2', dueDate: new Date('2025-01-17'), timeAllocation: 15 }, // Friday next week
  { id: 'milestone-3', dueDate: new Date('2025-01-24'), timeAllocation: 10 }  // Friday week after
];

console.log(`Project start: ${projectStartDate.toDateString()}`);
console.log('Milestones:');
milestones.forEach((m, i) => {
  console.log(`  ${i+1}. ${m.dueDate.toDateString()} - ${m.timeAllocation} hours`);
});
console.log('');

// Simulate the segment calculation logic
let currentStartDate = new Date(projectStartDate);
currentStartDate.setHours(0, 0, 0, 0);

milestones.forEach((milestone, index) => {
  const milestoneDate = new Date(milestone.dueDate);
  milestoneDate.setHours(0, 0, 0, 0);
  
  const segmentEndDate = new Date(milestoneDate);
  
  console.log(`--- MILESTONE ${index + 1} ---`);
  console.log(`Segment: ${currentStartDate.toDateString()} to ${segmentEndDate.toDateString()}`);
  console.log(`Milestone allocation: ${milestone.timeAllocation} hours`);
  
  const workingDays = calculateWorkingDaysInRange(
    currentStartDate,
    segmentEndDate,
    isWorkingDay
  );
  
  const hoursPerDay = workingDays > 0 ? milestone.timeAllocation / workingDays : 0;
  
  console.log(`Hours per day: ${milestone.timeAllocation}h ÷ ${workingDays} days = ${hoursPerDay.toFixed(2)}h`);
  
  // Check if this is problematic
  if (index === 0 && Math.abs(hoursPerDay - (milestone.timeAllocation / 4)) < 0.1) {
    console.log('🚨 POTENTIAL ISSUE: First milestone might be off by 1 day');
  }
  
  console.log('');
  
  // Move to next segment start (day after milestone date)
  currentStartDate = new Date(milestoneDate);
  currentStartDate.setDate(milestoneDate.getDate() + 1);
});

console.log('=== ANALYSIS ===');
console.log('Look for patterns:');
console.log('1. Does the first milestone include the project start date correctly?');
console.log('2. Are subsequent milestones calculated differently?');
console.log('3. Is there an off-by-one error in segment boundaries?');
