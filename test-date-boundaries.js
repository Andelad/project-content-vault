// Test the exact date boundary handling in working days calculation

function isWorkingDay(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
}

function calculateWorkingDaysInRange(startDate, endDate, isWorkingDay) {
  let workingDays = 0;
  const current = new Date(startDate);
  
  console.log(`\nCalculating working days from ${startDate.toDateString()} to ${endDate.toDateString()}`);
  console.log('Days included in calculation:');
  
  while (current <= endDate) {
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
  
  console.log(`Total working days: ${workingDays}`);
  return workingDays;
}

// Test case: Your 10-hour milestone scenario
console.log('=== TESTING DATE BOUNDARIES ===');

// Test 1: Monday start, Monday milestone (next week) - should be 6 working days
const projectStart1 = new Date('2025-01-06'); // Monday
const milestone1 = new Date('2025-01-13'); // Monday next week
projectStart1.setHours(0, 0, 0, 0);
milestone1.setHours(0, 0, 0, 0);

console.log('\nTest 1: Monday to Monday (next week)');
console.log('Expected: 6 working days (Mon-Fri week 1 + Mon week 2)');
const result1 = calculateWorkingDaysInRange(projectStart1, milestone1, isWorkingDay);
console.log(`10 hours ÷ ${result1} days = ${(10 / result1).toFixed(2)} hours per day`);

// Test 2: Monday start, Friday milestone (same week) - should be 5 working days  
const projectStart2 = new Date('2025-01-06'); // Monday
const milestone2 = new Date('2025-01-10'); // Friday same week
projectStart2.setHours(0, 0, 0, 0);
milestone2.setHours(0, 0, 0, 0);

console.log('\nTest 2: Monday to Friday (same week)');
console.log('Expected: 5 working days (Mon-Fri)');
const result2 = calculateWorkingDaysInRange(projectStart2, milestone2, isWorkingDay);
console.log(`20 hours ÷ ${result2} days = ${(20 / result2).toFixed(2)} hours per day`);

// Test 3: Check if there's any time zone or hour-setting issue
const projectStart3 = new Date('2025-01-06'); // Monday - don't set hours
const milestone3 = new Date('2025-01-13'); // Monday next week - don't set hours

console.log('\nTest 3: Same dates but without setHours(0,0,0,0)');
console.log('Checking for time-of-day boundary issues...');
console.log(`Start date time: ${projectStart3.toISOString()}`);
console.log(`Milestone date time: ${milestone3.toISOString()}`);
const result3 = calculateWorkingDaysInRange(projectStart3, milestone3, isWorkingDay);
console.log(`Result: ${result3} working days`);

console.log('\n=== ANALYSIS ===');
console.log('If Test 1 shows 5 days instead of 6, the milestone date is not being counted.');
console.log('If Test 1 shows 6 days, then the issue might be elsewhere in the calculation chain.');
console.log('Check the exact dates you used in your project to see if they match this pattern.');
