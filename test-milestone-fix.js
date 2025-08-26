// Test the off-by-one bug fix for milestone calculations

// Test case 1: 10 hours over 6 working days (should be 1.67h per day, not 2h)
console.log('=== TEST CASE 1: 10 hours milestone ===');
console.log('Project: Monday 1/6 to Monday 1/13');
console.log('Milestone: Monday 1/13, 10 hours');
console.log('Expected working days: Mon-Fri (5 days) in first week + Mon (1 day) = 6 days');
console.log('Expected hours per day: 10h ÷ 6 days = 1.67h');

const testDates1 = [];
const start1 = new Date('2025-01-06'); // Monday
const milestone1 = new Date('2025-01-13'); // Monday next week

// Count working days manually (up to day BEFORE milestone)
const current1 = new Date(start1);
const endDate1 = new Date(milestone1);
endDate1.setDate(milestone1.getDate() - 1); // Day before milestone

while (current1 <= endDate1) {
  const dayOfWeek = current1.getDay();
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
  const isWorking = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  testDates1.push({
    date: new Date(current1),
    dayName,
    isWorking
  });
  
  current1.setDate(current1.getDate() + 1);
}

console.log('\nDays in segment (up to day BEFORE milestone):');
let workingDays1 = 0;
testDates1.forEach(day => {
  if (day.isWorking) {
    workingDays1++;
    console.log(`  ${day.dayName} ${day.date.toDateString()} - WORKING DAY (${workingDays1})`);
  } else {
    console.log(`  ${day.dayName} ${day.date.toDateString()} - weekend`);
  }
});

console.log(`\nResult: ${workingDays1} working days`);
console.log(`Calculation: 10h ÷ ${workingDays1} = ${(10 / workingDays1).toFixed(2)}h per day`);

// Test case 2: 20 hours over 4 working days (should be 5h per day, not 6h 40m)
console.log('\n=== TEST CASE 2: 20 hours milestone ===');
console.log('Project: Monday to Friday (5 days)');
console.log('Milestone: Friday, 20 hours');
console.log('Expected working days: Mon-Thu (4 days, excluding milestone day)');
console.log('Expected hours per day: 20h ÷ 4 days = 5h');

const start2 = new Date('2025-01-06'); // Monday
const milestone2 = new Date('2025-01-10'); // Friday same week

const testDates2 = [];
const current2 = new Date(start2);
const endDate2 = new Date(milestone2);
endDate2.setDate(milestone2.getDate() - 1); // Day before milestone (Thursday)

while (current2 <= endDate2) {
  const dayOfWeek = current2.getDay();
  const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek];
  const isWorking = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  testDates2.push({
    date: new Date(current2),
    dayName,
    isWorking
  });
  
  current2.setDate(current2.getDate() + 1);
}

console.log('\nDays in segment (up to day BEFORE milestone):');
let workingDays2 = 0;
testDates2.forEach(day => {
  if (day.isWorking) {
    workingDays2++;
    console.log(`  ${day.dayName} ${day.date.toDateString()} - WORKING DAY (${workingDays2})`);
  } else {
    console.log(`  ${day.dayName} ${day.date.toDateString()} - weekend`);
  }
});

console.log(`\nResult: ${workingDays2} working days`);
console.log(`Calculation: 20h ÷ ${workingDays2} = ${(20 / workingDays2).toFixed(2)}h per day`);

console.log('\n=== ANALYSIS ===');
console.log('The bug was including the milestone date in working days calculation.');
console.log('Work happens UP TO the milestone, not including the milestone day itself.');
console.log('Fix: Subtract 1 day from milestone date before calculating working days.');
