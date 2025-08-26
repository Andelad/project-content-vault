// Debug the specific date range from the user's console output
// Start: Tuesday Aug 19, 2025
// End: Friday Aug 22, 2025
// Expected: 4 working days (Tue, Wed, Thu, Fri)
// Actual: 3 working days

console.log('=== DEBUGGING SPECIFIC DATE RANGE ===');
console.log('Start: Tuesday Aug 19, 2025');
console.log('End: Friday Aug 22, 2025');
console.log('Expected: 4 working days (Tue, Wed, Thu, Fri)');
console.log('Actual from debug: 3 working days');

const startDate = new Date('2025-08-19'); // Tuesday
const endDate = new Date('2025-08-22');   // Friday

// Mock isWorkingDay function (Monday-Friday)
function isWorkingDay(date) {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

// Manual count to verify what should happen
console.log('\n--- Manual Count ---');
let manualCount = 0;
const current = new Date(startDate);

while (current <= endDate) {
  const dayOfWeek = current.getDay();
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
  const isWorking = isWorkingDay(current);
  
  if (isWorking) {
    manualCount++;
    console.log(`${dayName} ${current.toDateString()} - WORKING DAY (${manualCount})`);
  } else {
    console.log(`${dayName} ${current.toDateString()} - weekend`);
  }
  
  current.setDate(current.getDate() + 1);
}

console.log(`\nManual count result: ${manualCount} working days`);

// Now let's simulate the exact logic from calculateWorkingDaysInRange
console.log('\n--- Simulating calculateWorkingDaysInRange Logic ---');

let simulatedCount = 0;
const currentSim = new Date(startDate);
const holidays = []; // No holidays

while (currentSim <= endDate) {
  let hasWorkHours = false;
  
  // Since we don't have workHours parameter in this test, it should fall back to isWorkingDay
  hasWorkHours = isWorkingDay(currentSim);
  
  if (hasWorkHours) {
    // Check if this date is not a holiday (none in our case)
    const isHoliday = holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(0, 0, 0, 0);
      const currentDay = new Date(currentSim);
      currentDay.setHours(0, 0, 0, 0);
      return currentDay >= holidayStart && currentDay <= holidayEnd;
    });
    
    if (!isHoliday) {
      simulatedCount++;
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][currentSim.getDay()];
      console.log(`${dayName} ${currentSim.toDateString()} - COUNTED (${simulatedCount})`);
    }
  }
  
  currentSim.setDate(currentSim.getDate() + 1);
}

console.log(`\nSimulated count result: ${simulatedCount} working days`);

if (simulatedCount === 3) {
  console.log('\n🚨 REPRODUCED: The bug is confirmed in our simulation');
  console.log('Need to investigate why Friday Aug 22 is not being counted');
} else if (simulatedCount === 4) {
  console.log('\n✅ Cannot reproduce: Logic seems correct');
  console.log('The issue might be in the workHours parameter or date timezone handling');
} else {
  console.log(`\n❓ Unexpected result: ${simulatedCount} working days`);
}
