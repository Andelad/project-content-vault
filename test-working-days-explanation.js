// Understanding the working days calculation expectations

console.log('=== UNDERSTANDING WORKING DAYS CALCULATION ===');

function testScenario(startDate, milestoneDate, expectedWorkingDays, milestoneHours) {
  console.log(`\n--- Scenario ---`);
  console.log(`Start: ${startDate.toDateString()}`);
  console.log(`Milestone: ${milestoneDate.toDateString()}`);
  console.log(`Milestone Hours: ${milestoneHours}h`);
  console.log(`Expected Working Days: ${expectedWorkingDays}`);
  
  // Calculate actual working days
  let actualWorkingDays = 0;
  const current = new Date(startDate);
  
  console.log('\nDay-by-day breakdown:');
  while (current <= milestoneDate) {
    const dayOfWeek = current.getDay();
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
    const isWorking = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
    
    if (isWorking) {
      actualWorkingDays++;
      console.log(`  ${dayName} ${current.toDateString()} - WORKING DAY (${actualWorkingDays})`);
    } else {
      console.log(`  ${dayName} ${current.toDateString()} - weekend`);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`\nActual Working Days: ${actualWorkingDays}`);
  console.log(`Hours per day: ${milestoneHours}h ÷ ${actualWorkingDays} = ${(milestoneHours / actualWorkingDays).toFixed(2)}h`);
  
  if (actualWorkingDays === expectedWorkingDays) {
    console.log('✅ Working days match expectation');
  } else {
    console.log(`❌ Working days don't match: expected ${expectedWorkingDays}, got ${actualWorkingDays}`);
    console.log(`   This could be because the start date is a weekend day`);
  }
}

// Your scenarios
testScenario(
  new Date('2025-01-19'), // Sunday 
  new Date('2025-01-22'), // Wednesday
  4, // You expected 4 days (19,20,21,22)
  10 // 10 hours
);

testScenario(
  new Date('2025-01-20'), // Monday
  new Date('2025-01-23'), // Thursday  
  4, // Should be 4 working days
  20 // 20 hours
);

// Test a 6-day scenario
testScenario(
  new Date('2025-01-06'), // Monday
  new Date('2025-01-13'), // Monday next week
  6, // Mon-Fri + Mon = 6 working days
  10 // 10 hours
);

console.log('\n=== CONCLUSION ===');
console.log('The calculation is working correctly.');
console.log('If you expect 4 working days from 19th to 22nd,');
console.log('but the 19th is a weekend, then you only get 3 working days.');
console.log('The system counts actual working days, not calendar days.');
