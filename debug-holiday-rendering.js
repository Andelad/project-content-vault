// Debug script to understand holiday rendering in weeks mode

const normalizeToMidnight = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const normalizeToEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const addDaysToDate = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Simulate week mode calculation
function calculateHolidaySegmentsForWeek(holidays, weekStartDate) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDaysToDate(weekStartDate, i));
  }
  
  console.log('\n=== Week Dates ===');
  dates.forEach((d, i) => {
    console.log(`${i}: ${d.toDateString()}`);
  });
  
  console.log('\n=== Processing Holidays ===');
  
  holidays.forEach((holiday, idx) => {
    console.log(`\nHoliday ${idx + 1}: "${holiday.title}"`);
    console.log(`  Start: ${holiday.startDate}`);
    console.log(`  End: ${holiday.endDate}`);
    
    const holidayStart = normalizeToMidnight(new Date(holiday.startDate));
    const holidayEnd = normalizeToMidnight(new Date(holiday.endDate));
    
    console.log(`  Normalized Start: ${holidayStart.toISOString()}`);
    console.log(`  Normalized End: ${holidayEnd.toISOString()}`);
    
    let startWeekIndex = -1;
    let endWeekIndex = -1;
    
    dates.forEach((weekStart, weekIndex) => {
      const weekStartMidnight = normalizeToMidnight(new Date(weekStart));
      const weekEnd = normalizeToEndOfDay(addDaysToDate(weekStartMidnight, 6));
      
      // Check if holiday overlaps with this week
      const overlaps = !(holidayEnd < weekStartMidnight || holidayStart > weekEnd);
      
      console.log(`  Week ${weekIndex}: ${weekStart.toDateString()} - overlaps: ${overlaps}`);
      
      if (overlaps) {
        if (startWeekIndex === -1) {
          startWeekIndex = weekIndex;
        }
        endWeekIndex = weekIndex;
      }
    });
    
    console.log(`  startWeekIndex: ${startWeekIndex}`);
    console.log(`  endWeekIndex: ${endWeekIndex}`);
    
    if (startWeekIndex === -1) {
      console.log('  ❌ HOLIDAY NOT VISIBLE - outside week range');
      return;
    }
    
    const firstWeekStart = dates[startWeekIndex];
    const msPerDay = 24 * 60 * 60 * 1000;
    
    const daysFromFirstWeekToHolidayStart = Math.floor((holidayStart.getTime() - firstWeekStart.getTime()) / msPerDay);
    const startDayIndex = startWeekIndex * 7 + daysFromFirstWeekToHolidayStart;
    
    const daysFromFirstWeekToHolidayEnd = Math.floor((holidayEnd.getTime() - firstWeekStart.getTime()) / msPerDay);
    const endDayIndex = startWeekIndex * 7 + daysFromFirstWeekToHolidayEnd;
    
    const dayCount = endDayIndex - startDayIndex + 1;
    
    console.log(`  startDayIndex: ${startDayIndex} (week ${Math.floor(startDayIndex / 7)}, day ${startDayIndex % 7})`);
    console.log(`  endDayIndex: ${endDayIndex}`);
    console.log(`  dayCount: ${dayCount}`);
    console.log(`  ✅ Would render in week column ${startWeekIndex}`);
  });
}

// Test with your scenario
const holidays = [
  {
    title: 'Holiday 1',
    startDate: '2024-12-30',
    endDate: '2024-12-31'
  },
  {
    title: 'Holiday 2', 
    startDate: '2025-01-01',
    endDate: '2025-01-04'
  }
];

// Week starting Monday Dec 30, 2024
const weekStart = new Date('2024-12-30');
calculateHolidaySegmentsForWeek(holidays, weekStart);

