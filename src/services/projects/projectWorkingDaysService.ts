import { Settings, Holiday } from '@/types/core';

/**
 * Calculate working days remaining until project end date
 */
export const calculateWorkingDaysRemaining = (endDate: Date, settings: Settings, holidays: Holiday[]): number => {
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
      const dayName = dayNames[current.getDay()] as keyof typeof settings.weeklyWorkHours;
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

/**
 * Calculate total working days in a date range
 */
export const calculateTotalWorkingDays = (startDate: Date, endDate: Date, settings: Settings, holidays: Holiday[]): number => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  // If no settings, return 0
  if (!settings?.weeklyWorkHours) {
    return 0;
  }

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
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
      const dayName = dayNames[current.getDay()] as keyof typeof settings.weeklyWorkHours;
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

/**
 * Get working days in a date range (helper function)
 */
export const getWorkingDaysInRange = (startDate: Date, endDate: Date, holidays: Holiday[], settings: Settings): number => {
  return calculateTotalWorkingDays(startDate, endDate, settings, holidays);
};
