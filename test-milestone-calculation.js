// Test script to verify milestone segment calculation
const { calculateMilestoneSegments } = require('./dist/assets/milestoneSegmentUtils.js');

// Mock data based on the user's example
const projectId = 'test-project';
const projectStartDate = new Date('2025-01-01');
const projectEndDate = new Date('2025-01-31');
const projectTotalBudget = 24; // 24 hours total

const milestones = [
  {
    id: 'milestone-1',
    projectId: 'test-project',
    dueDate: new Date('2025-01-10'),
    timeAllocation: 10 // 10 hours
  },
  {
    id: 'milestone-2', 
    projectId: 'test-project',
    dueDate: new Date('2025-01-20'),
    timeAllocation: 4 // 4 hours
  }
];

// Mock settings (assuming Monday-Friday work days)
const settings = {
  weeklyWorkHours: {
    monday: [{ duration: 8 }],
    tuesday: [{ duration: 8 }],
    wednesday: [{ duration: 8 }],
    thursday: [{ duration: 8 }],
    friday: [{ duration: 8 }],
    saturday: [],
    sunday: []
  }
};

const holidays = [];
const events = [];

// Mock isWorkingDay function
const isWorkingDay = (date) => {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
};

console.log('Testing milestone segment calculation...');
console.log('Project: 24hrs total, Milestone 1: 10hrs, Milestone 2: 4hrs');
console.log('Expected remaining: 10hrs between milestone 2 and project end');

try {
  const segments = calculateMilestoneSegments(
    projectId,
    projectStartDate,
    projectEndDate,
    milestones,
    settings,
    holidays,
    isWorkingDay,
    events,
    projectTotalBudget
  );

  console.log('\nCalculated segments:');
  segments.forEach((segment, index) => {
    console.log(`Segment ${index + 1}:`);
    console.log(`  ID: ${segment.id}`);
    console.log(`  Start: ${segment.startDate.toDateString()}`);
    console.log(`  End: ${segment.endDate.toDateString()}`);
    console.log(`  Allocated Hours: ${segment.allocatedHours}`);
    console.log(`  Working Days: ${segment.workingDays}`);
    console.log(`  Hours per Day: ${segment.hoursPerDay.toFixed(2)}`);
    console.log(`  Milestone: ${segment.milestone ? segment.milestone.id : 'Remaining budget'}`);
    console.log('');
  });

} catch (error) {
  console.error('Error testing milestone calculation:', error);
}
