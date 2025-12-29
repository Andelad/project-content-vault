// Debug script to understand TIMELINE holiday rendering in weeks mode
// In timeline weeks mode, dates[] contains week START dates (Mondays)

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

// Simulate TIMELINE week mode with multiple weeks visible
function calculateHolidaySegmentsForTimeline(holidays, visibleWeeks) {
  console.log('\n=== Timeline Weeks Mode Debug ===');
  console.log(`Visible weeks: ${visibleWeeks}`);
  console.log('\n=== Week Columns (dates array) ===');
  visibleWeeks.forEach((weekStart, i) => {
    const weekEnd = addDaysToDate(weekStart, 6);
    console.log(`Week ${i}: ${weekStart.toDateString()} to ${weekEnd.toDateString()}`);
  });
  
  console.log('\n=== Processing Holidays ===');
  
  holidays.forEach((holiday, idx) => {
    console.log(`\n--- Holiday ${idx + 1}: "${holiday.title}" ---`);
    console.log(`  Start: ${holiday.startDate}`);
    console.log(`  End: ${holiday.endDate}`);
    
    const holidayStart = normalizeToMidnight(new Date(holiday.startDate));
    const holidayEnd = normalizeToMidnight(new Date(holiday.endDate));
    
    let startWeekIndex = -1;
    let endWeekIndex = -1;
    
    // Check which week COLUMNS contain this holiday
    visibleWeeks.forEach((weekStart, weekIndex) => {
      const weekStartMidnight = normalizeToMidnight(new Date(weekStart));
      const weekEnd = normalizeToEndOfDay(addDaysToDate(weekStartMidnight, 6));
      
      // Check if holiday overlaps with this week
      const overlaps = !(holidayEnd < weekStartMidnight || holidayStart > weekEnd);
      
      console.log(`  Week column ${weekIndex} (${weekStart.toDateString()}): overlaps = ${overlaps}`);
      
      if (overlaps) {
        if (startWeekIndex === -1) {
          startWeekIndex = weekIndex;
        }
        endWeekIndex = weekIndex;
      }
    });
    
    console.log(`  => startWeekIndex: ${startWeekIndex}`);
    console.log(`  => endWeekIndex: ${endWeekIndex}`);
    
    if (startWeekIndex === -1) {
      console.log('  ❌ HOLIDAY NOT VISIBLE - outside viewport');
      return;
    }
    
    // Calculate day-level positioning
    const firstWeekStart = visibleWeeks[startWeekIndex];
    const msPerDay = 24 * 60 * 60 * 1000;
    
    const daysFromFirstWeekToHolidayStart = Math.floor((holidayStart.getTime() - firstWeekStart.getTime()) / msPerDay);
    const startDayIndex = startWeekIndex * 7 + daysFromFirstWeekToHolidayStart;
    
    const daysFromFirstWeekToHolidayEnd = Math.floor((holidayEnd.getTime() - firstWeekStart.getTime()) / msPerDay);
    const endDayIndex = startWeekIndex * 7 + daysFromFirstWeekToHolidayEnd;
    
    const dayCount = endDayIndex - startDayIndex + 1;
    
    console.log(`  => startDayIndex: ${startDayIndex} (week ${startWeekIndex}, day ${startDayIndex % 7})`);
    console.log(`  => dayCount: ${dayCount}`);
    console.log(`  => actualStartWeek: ${startWeekIndex}`);
    console.log(`  => actualEndWeek: ${endWeekIndex}`);
    
    // Rendering logic: only render in the FIRST week to avoid duplicates
    console.log(`\n  RENDERING DECISION:`);
    visibleWeeks.forEach((weekStart, weekIndex) => {
      if (weekIndex >= startWeekIndex && weekIndex <= endWeekIndex && weekIndex === startWeekIndex) {
        console.log(`    Week ${weekIndex}: ✅ RENDER (first week)`);
      } else if (weekIndex >= startWeekIndex && weekIndex <= endWeekIndex) {
        console.log(`    Week ${weekIndex}: ⚠️  SKIP (duplicate prevention - only render in first week)`);
      } else {
        console.log(`    Week ${weekIndex}: - (not in range)`);
      }
    });
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

// Timeline showing multiple weeks (each element is a Monday)
// Week 1: Dec 30 (Mon) - Jan 5 (Sun)
// Week 2: Jan 6 (Mon) - Jan 12 (Sun)
// Week 3: Jan 13 (Mon) - Jan 19 (Sun)
const visibleWeeks = [
  new Date('2024-12-30'), // Monday Dec 30
  new Date('2025-01-06'), // Monday Jan 6
  new Date('2025-01-13')  // Monday Jan 13
];

calculateHolidaySegmentsForTimeline(holidays, visibleWeeks);

