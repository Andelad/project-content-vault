// Quick test to verify working days calculation logic
const calculateWorkingDaysRemaining = (endDate, settings, holidays) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetEndDate = new Date(endDate);
  targetEndDate.setHours(0, 0, 0, 0);
  
  // If end date is in the past or today, return 0
  if (targetEndDate <= today) {
    return 0;
  }
  
  // If no settings, return 0
  if (!settings?.weeklyWorkHours) {
    return 0;
  }
  
  let workingDays = 0;
  const current = new Date(today);
  current.setDate(current.getDate() + 1); // Start from tomorrow
  
  while (current <= targetEndDate) {
    // Check if it's a holiday
    const isHoliday = holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(0, 0, 0, 0);
      return current >= holidayStart && current <= holidayEnd;
    });
    
    if (!isHoliday) {
      // Check if it's a day with work hours configured
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[current.getDay()];
      const workSlots = settings.weeklyWorkHours?.[dayName] || [];
      
      const hasWorkHours = Array.isArray(workSlots) && 
        workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;
      
      if (hasWorkHours) {
        workingDays++;
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
};

// Test with sample data
const sampleSettings = {
  weeklyWorkHours: {
    monday: [{ duration: 8, startTime: '09:00', endTime: '17:00' }],
    tuesday: [{ duration: 8, startTime: '09:00', endTime: '17:00' }],
    wednesday: [{ duration: 8, startTime: '09:00', endTime: '17:00' }],
    thursday: [{ duration: 8, startTime: '09:00', endTime: '17:00' }],
    friday: [{ duration: 8, startTime: '09:00', endTime: '17:00' }],
    saturday: [],
    sunday: []
  }
};

const sampleHolidays = [];

// Test 1: End date 7 days from now
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 7);
console.log('Test 1 - 7 days from now:', calculateWorkingDaysRemaining(futureDate, sampleSettings, sampleHolidays));

// Test 2: End date yesterday (should return 0)
const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 1);
console.log('Test 2 - Yesterday:', calculateWorkingDaysRemaining(pastDate, sampleSettings, sampleHolidays));

// Test 3: End date today (should return 0)
const today = new Date();
console.log('Test 3 - Today:', calculateWorkingDaysRemaining(today, sampleSettings, sampleHolidays));

console.log('Tests completed successfully!');
