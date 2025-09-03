/**
 * Schedule Calculations for Settings
 * Work schedule generation, validation, and analysis for settings functionality
 */

import { WorkSlot } from '@/types/core';
import { calculateDayTotalHours } from './workSlotCalculations';

/**
 * Calculates total hours for the entire week's work schedule
 */
export function calculateWeekTotalHours(weeklyWorkHours: {
  monday: WorkSlot[];
  tuesday: WorkSlot[];
  wednesday: WorkSlot[];
  thursday: WorkSlot[];
  friday: WorkSlot[];
  saturday: WorkSlot[];
  sunday: WorkSlot[];
}): number {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.reduce((total, day) => {
    const daySlots = weeklyWorkHours[day as keyof typeof weeklyWorkHours] || [];
    return total + calculateDayTotalHours(daySlots);
  }, 0);
}

/**
 * Generates default work schedules
 */
export function generateDefaultWorkSchedule(type: 'standard' | 'flexible' | 'minimal'): {
  monday: WorkSlot[];
  tuesday: WorkSlot[];
  wednesday: WorkSlot[];
  thursday: WorkSlot[];
  friday: WorkSlot[];
  saturday: WorkSlot[];
  sunday: WorkSlot[];
} {
  const emptySchedule = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  };

  switch (type) {
    case 'standard':
      // Standard 9-5 Monday-Friday
      const standardSlot: WorkSlot = {
        id: 'standard-9-5',
        startTime: '09:00',
        endTime: '17:00',
        duration: 8
      };
      return {
        ...emptySchedule,
        monday: [standardSlot],
        tuesday: [standardSlot],
        wednesday: [standardSlot],
        thursday: [standardSlot],
        friday: [standardSlot]
      };

    case 'flexible':
      // Split schedule: morning and afternoon
      const morningSlot: WorkSlot = {
        id: 'morning-9-12',
        startTime: '09:00',
        endTime: '12:00',
        duration: 3
      };
      const afternoonSlot: WorkSlot = {
        id: 'afternoon-1-5',
        startTime: '13:00',
        endTime: '17:00',
        duration: 4
      };
      return {
        ...emptySchedule,
        monday: [morningSlot, afternoonSlot],
        tuesday: [morningSlot, afternoonSlot],
        wednesday: [morningSlot, afternoonSlot],
        thursday: [morningSlot, afternoonSlot],
        friday: [morningSlot, afternoonSlot]
      };

    case 'minimal':
    default:
      return emptySchedule;
  }
}

/**
 * Generates schedule recommendations based on work patterns
 */
export function generateScheduleRecommendations(weeklyWorkHours: {
  monday: WorkSlot[];
  tuesday: WorkSlot[];
  wednesday: WorkSlot[];
  thursday: WorkSlot[];
  friday: WorkSlot[];
  saturday: WorkSlot[];
  sunday: WorkSlot[];
}): string[] {
  const recommendations: string[] = [];
  const analysis = analyzeWorkSchedule(weeklyWorkHours);

  if (analysis.totalWeeklyHours > 50) {
    recommendations.push('Consider reducing weekly hours to prevent burnout');
  }

  if (analysis.hasWeekendWork) {
    recommendations.push('Weekend work detected - ensure adequate rest days');
  }

  if (analysis.workDaysCount < 3) {
    recommendations.push('Very few work days - consider spreading work more evenly');
  }

  if (analysis.longestWorkDay.hours > 10) {
    recommendations.push(`Long workday on ${analysis.longestWorkDay.day} - consider splitting into multiple slots`);
  }

  return recommendations;
}

/**
 * Validates a work schedule configuration
 */
function validateWorkScheduleInternal(weeklyWorkHours: {
  monday: WorkSlot[];
  tuesday: WorkSlot[];
  wednesday: WorkSlot[];
  thursday: WorkSlot[];
  friday: WorkSlot[];
  saturday: WorkSlot[];
  sunday: WorkSlot[];
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  days.forEach(day => {
    const daySlots = weeklyWorkHours[day as keyof typeof weeklyWorkHours] || [];

    // Check for overlaps within the day
    for (let i = 0; i < daySlots.length; i++) {
      for (let j = i + 1; j < daySlots.length; j++) {
        if (hasTimeOverlap(daySlots[i], [daySlots[j]])) {
          errors.push(`${day}: Work slots overlap`);
          break;
        }
      }
    }

    // Check for invalid time ranges
    daySlots.forEach(slot => {
      if (slot.startTime >= slot.endTime) {
        errors.push(`${day}: Invalid time range for slot ${slot.startTime} - ${slot.endTime}`);
      }
      if (slot.duration <= 0) {
        errors.push(`${day}: Invalid duration for work slot`);
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Analyzes work schedule and provides insights
 */
export function analyzeWorkSchedule(weeklyWorkHours: {
  monday: WorkSlot[];
  tuesday: WorkSlot[];
  wednesday: WorkSlot[];
  thursday: WorkSlot[];
  friday: WorkSlot[];
  saturday: WorkSlot[];
  sunday: WorkSlot[];
}): {
  totalWeeklyHours: number;
  averageDailyHours: number;
  workDaysCount: number;
  longestWorkDay: { day: string; hours: number };
  shortestWorkDay: { day: string; hours: number };
  hasWeekendWork: boolean;
} {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayHours: Array<{ day: string; hours: number }> = [];

  let totalWeeklyHours = 0;
  let workDaysCount = 0;
  let hasWeekendWork = false;

  days.forEach(day => {
    const daySlots = weeklyWorkHours[day as keyof typeof weeklyWorkHours] || [];
    const dayTotal = calculateDayTotalHours(daySlots);
    dayHours.push({ day, hours: dayTotal });
    totalWeeklyHours += dayTotal;

    if (dayTotal > 0) {
      workDaysCount++;
      if (day === 'saturday' || day === 'sunday') {
        hasWeekendWork = true;
      }
    }
  });

  const averageDailyHours = workDaysCount > 0 ? totalWeeklyHours / workDaysCount : 0;
  const sortedByHours = dayHours.filter(d => d.hours > 0).sort((a, b) => b.hours - a.hours);

  const longestWorkDay = sortedByHours.length > 0 ? sortedByHours[0] : { day: 'none', hours: 0 };
  const shortestWorkDay = sortedByHours.length > 0 ? sortedByHours[sortedByHours.length - 1] : { day: 'none', hours: 0 };

  return {
    totalWeeklyHours,
    averageDailyHours,
    workDaysCount,
    longestWorkDay,
    shortestWorkDay,
    hasWeekendWork
  };
}

/**
 * Helper function to check if two time slots overlap
 */
function hasTimeOverlap(slot1: WorkSlot, slots: WorkSlot[]): boolean {
  return slots.some(slot2 => {
    return !(slot1.endTime <= slot2.startTime || slot1.startTime >= slot2.endTime);
  });
}