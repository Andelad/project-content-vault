// Test the exact scenario: start date 19th, milestone 22nd
// Should be 4 working days: 19, 20, 21, 22

console.log('=== TESTING SPECIFIC DATE RANGE ===');
console.log('Start date: 19th');
console.log('Milestone date: 22nd');
console.log('Expected working days: 19, 20, 21, 22 = 4 days');

// Let's test with January 2025 dates (assuming weekdays)
const startDate = new Date('2025-01-19'); // Sunday
const milestoneDate = new Date('2025-01-22'); // Wednesday

console.log(`\nActual dates:`);
console.log(`Start: ${startDate.toDateString()} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startDate.getDay()]})`);
console.log(`Milestone: ${milestoneDate.toDateString()} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][milestoneDate.getDay()]})`);

// Mock isWorkingDay function (Monday to Friday)
function isWorkingDay(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
}

// Manual calculation
console.log('\n=== MANUAL WORKING DAYS CALCULATION ===');
let manualCount = 0;
const current = new Date(startDate);

console.log('Days in range:');
while (current <= milestoneDate) {
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][current.getDay()];
  const isWorking = isWorkingDay(current);
  
  if (isWorking) {
    manualCount++;
    console.log(`  ${current.getDate()} - ${dayName} ${current.toDateString()} - WORKING DAY (${manualCount})`);
  } else {
    console.log(`  ${current.getDate()} - ${dayName} ${current.toDateString()} - weekend`);
  }
  
  current.setDate(current.getDate() + 1);
}

console.log(`\nManual count result: ${manualCount} working days`);

// Test with different scenarios
console.log('\n=== TESTING DIFFERENT SCENARIOS ===');

// Scenario 1: Monday to Thursday (should be 4 working days)
console.log('\nScenario 1: Monday 20th to Thursday 23rd');
testDateRange(new Date('2025-01-20'), new Date('2025-01-23'), 'Mon-Thu should be 4 working days');

// Scenario 2: Tuesday to Friday (should be 4 working days)
console.log('\nScenario 2: Tuesday 21st to Friday 24th');
testDateRange(new Date('2025-01-21'), new Date('2025-01-24'), 'Tue-Fri should be 4 working days');

// Scenario 3: Your original 6-day scenario
console.log('\nScenario 3: Monday to next Monday (should be 6 working days)');
testDateRange(new Date('2025-01-20'), new Date('2025-01-27'), 'Mon to next Mon should be 6 working days');

function testDateRange(start, end, description) {
  console.log(`  ${description}`);
  console.log(`  Start: ${start.toDateString()}`);
  console.log(`  End: ${end.toDateString()}`);
  
  let count = 0;
  const testCurrent = new Date(start);
  
  while (testCurrent <= end) {
    if (isWorkingDay(testCurrent)) {
      count++;
    }
    testCurrent.setDate(testCurrent.getDate() + 1);
  }
  
  console.log(`  Result: ${count} working days`);
}
