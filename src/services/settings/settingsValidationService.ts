/**
 * Settings Validation and Calculation Service
 * 
 * This service handles work hour calculations, time slot validation, and settings
 * management logic extracted from the SettingsView component. It provides
 * comprehensive validation, calculation, and utility functions for managing
 * work schedules and time-related settings.
 * 
 * Key Features:
 * - Work slot duration calculations with validation
 * - Time format generation and validation
 * - Daily and weekly work hour totals
 * - Work slot management (add, update, remove)
 * - Time overlap detection and validation
 * - Settings validation and sanitization
 * - Work schedule optimization and analysis
 * 
 * @module SettingsValidationService
 */

import type { WorkSlot, Settings } from '@/types';

/**
 * Interface for work slot validation results
 */
export interface WorkSlotValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  calculatedDuration: number;
}

/**
 * Interface for work schedule analysis
 */
export interface WorkScheduleAnalysis {
  dailyTotals: Record<string, number>;
  weeklyTotal: number;
  averageDailyHours: number;
  workingDays: number;
  maxDailyHours: number;
  minDailyHours: number;
  recommendations: string[];
}

/**
 * Interface for time slot overlap detection
 */
export interface TimeSlotOverlap {
  hasOverlap: boolean;
  overlappingSlots: Array<{
    slot1: WorkSlot;
    slot2: WorkSlot;
    overlapMinutes: number;
  }>;
}

/**
 * Configuration constants for work schedule validation
 */
export const WORK_SCHEDULE_LIMITS = {
  MAX_SLOTS_PER_DAY: 6,
  MAX_DAILY_HOURS: 16,
  MIN_SLOT_DURATION: 0.25, // 15 minutes
  MAX_SLOT_DURATION: 12,
  TIME_SLOT_INCREMENT: 15, // minutes
  RECOMMENDED_MAX_DAILY: 10,
  RECOMMENDED_MIN_BREAK: 0.5 // 30 minutes between slots
} as const;

/**
 * Days of the week for work schedule configuration
 */
export const WORK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/**
 * Calculate duration between start and end time in hours
 * 
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 * @returns Duration in hours (decimal)
 */
export function calculateWorkSlotDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Handle overnight slots (end time next day)
  const duration = endMinutes >= startMinutes 
    ? endMinutes - startMinutes 
    : (24 * 60) - startMinutes + endMinutes;
  
  return Math.max(0, duration / 60);
}

/**
 * Generate array of time options for dropdowns (15-minute increments)
 * 
 * @param use24Hour - Whether to use 24-hour format
 * @returns Array of time strings
 */
export function generateTimeOptions(use24Hour: boolean = true): string[] {
  const options = [];
  
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += WORK_SCHEDULE_LIMITS.TIME_SLOT_INCREMENT) {
      if (use24Hour) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeString);
      } else {
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        const timeString = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
        options.push(timeString);
      }
    }
  }
  
  return options;
}

/**
 * Calculate total hours for a specific day
 * 
 * @param slots - Array of work slots for the day
 * @returns Total hours for the day
 */
export function calculateDayTotalHours(slots: WorkSlot[]): number {
  return slots.reduce((total, slot) => total + slot.duration, 0);
}

/**
 * Calculate total weekly work hours
 * 
 * @param weeklyWorkHours - Weekly work schedule
 * @returns Total weekly hours
 */
export function calculateWeekTotalHours(weeklyWorkHours: Settings['weeklyWorkHours']): number {
  return Object.values(weeklyWorkHours).reduce((total, daySlots) => {
    return total + calculateDayTotalHours(daySlots);
  }, 0);
}

/**
 * Validate a work slot for time format, duration, and logical consistency
 * 
 * @param slot - Work slot to validate
 * @returns Validation results with errors and warnings
 */
export function validateWorkSlot(slot: WorkSlot): WorkSlotValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate time format
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(slot.startTime)) {
    errors.push('Invalid start time format. Use HH:MM format.');
  }
  if (!timeRegex.test(slot.endTime)) {
    errors.push('Invalid end time format. Use HH:MM format.');
  }
  
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      calculatedDuration: 0
    };
  }
  
  // Calculate and validate duration
  const calculatedDuration = calculateWorkSlotDuration(slot.startTime, slot.endTime);
  
  if (calculatedDuration < WORK_SCHEDULE_LIMITS.MIN_SLOT_DURATION) {
    errors.push(`Work slot must be at least ${WORK_SCHEDULE_LIMITS.MIN_SLOT_DURATION * 60} minutes.`);
  }
  
  if (calculatedDuration > WORK_SCHEDULE_LIMITS.MAX_SLOT_DURATION) {
    errors.push(`Work slot cannot exceed ${WORK_SCHEDULE_LIMITS.MAX_SLOT_DURATION} hours.`);
  }
  
  // Check if duration matches calculated value
  if (Math.abs(slot.duration - calculatedDuration) > 0.01) {
    warnings.push('Slot duration will be recalculated based on start and end times.');
  }
  
  // Performance warnings
  if (calculatedDuration > WORK_SCHEDULE_LIMITS.RECOMMENDED_MAX_DAILY) {
    warnings.push(`Long work slot (${calculatedDuration.toFixed(1)}h). Consider splitting for better work-life balance.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    calculatedDuration
  };
}

/**
 * Detect overlapping time slots within a day
 * 
 * @param slots - Array of work slots for a day
 * @returns Overlap detection results
 */
export function detectTimeSlotOverlaps(slots: WorkSlot[]): TimeSlotOverlap {
  const overlappingSlots = [];
  
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const slot1 = slots[i];
      const slot2 = slots[j];
      
      const overlap = calculateSlotOverlapMinutes(slot1, slot2);
      if (overlap > 0) {
        overlappingSlots.push({
          slot1,
          slot2,
          overlapMinutes: overlap
        });
      }
    }
  }
  
  return {
    hasOverlap: overlappingSlots.length > 0,
    overlappingSlots
  };
}

/**
 * Calculate overlap between two time slots in minutes
 * 
 * @param slot1 - First work slot
 * @param slot2 - Second work slot
 * @returns Overlap in minutes
 */
export function calculateSlotOverlapMinutes(slot1: WorkSlot, slot2: WorkSlot): number {
  const start1 = timeStringToMinutes(slot1.startTime);
  const end1 = timeStringToMinutes(slot1.endTime);
  const start2 = timeStringToMinutes(slot2.startTime);
  const end2 = timeStringToMinutes(slot2.endTime);
  
  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);
  
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Convert time string to minutes since midnight
 * 
 * @param timeString - Time in HH:MM format
 * @returns Minutes since midnight
 */
export function timeStringToMinutes(timeString: string): number {
  const [hour, minute] = timeString.split(':').map(Number);
  return hour * 60 + minute;
}

/**
 * Convert minutes since midnight to time string
 * 
 * @param minutes - Minutes since midnight
 * @returns Time string in HH:MM format
 */
export function minutesToTimeString(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Create a new work slot with validation
 * 
 * @param day - Day of the week
 * @param existingSlots - Existing slots for the day
 * @param startTime - Optional start time (defaults to 09:00)
 * @param endTime - Optional end time (defaults to 10:00)
 * @returns New work slot or error
 */
export function createNewWorkSlot(
  day: string,
  existingSlots: WorkSlot[],
  startTime: string = '09:00',
  endTime: string = '10:00'
): { success: boolean; slot?: WorkSlot; error?: string } {
  // Check slot limit
  if (existingSlots.length >= WORK_SCHEDULE_LIMITS.MAX_SLOTS_PER_DAY) {
    return {
      success: false,
      error: `Maximum ${WORK_SCHEDULE_LIMITS.MAX_SLOTS_PER_DAY} slots per day allowed.`
    };
  }
  
  // Find available time slot if default conflicts
  let adjustedStartTime = startTime;
  let adjustedEndTime = endTime;
  
  // Simple conflict resolution: find next available hour
  const testSlot: WorkSlot = {
    id: 'temp',
    startTime: adjustedStartTime,
    endTime: adjustedEndTime,
    duration: calculateWorkSlotDuration(adjustedStartTime, adjustedEndTime)
  };
  
  const overlap = detectTimeSlotOverlaps([...existingSlots, testSlot]);
  if (overlap.hasOverlap) {
    // Find next available time slot
    for (let hour = 9; hour < 18; hour++) {
      adjustedStartTime = `${hour.toString().padStart(2, '0')}:00`;
      adjustedEndTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
      
      testSlot.startTime = adjustedStartTime;
      testSlot.endTime = adjustedEndTime;
      testSlot.duration = 1;
      
      const testOverlap = detectTimeSlotOverlaps([...existingSlots, testSlot]);
      if (!testOverlap.hasOverlap) {
        break;
      }
    }
  }
  
  const newSlot: WorkSlot = {
    id: Date.now().toString(),
    startTime: adjustedStartTime,
    endTime: adjustedEndTime,
    duration: calculateWorkSlotDuration(adjustedStartTime, adjustedEndTime)
  };
  
  const validation = validateWorkSlot(newSlot);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.errors.join('; ')
    };
  }
  
  return {
    success: true,
    slot: newSlot
  };
}

/**
 * Update a work slot with automatic recalculation
 * 
 * @param slot - Original work slot
 * @param updates - Partial updates to apply
 * @returns Updated work slot with recalculated duration
 */
export function updateWorkSlot(slot: WorkSlot, updates: Partial<WorkSlot>): WorkSlot {
  const updatedSlot = { ...slot, ...updates };
  
  // Recalculate duration if start or end time changed
  if (updates.startTime || updates.endTime) {
    updatedSlot.duration = calculateWorkSlotDuration(updatedSlot.startTime, updatedSlot.endTime);
  }
  
  return updatedSlot;
}

/**
 * Analyze work schedule and provide insights
 * 
 * @param weeklyWorkHours - Weekly work schedule
 * @returns Comprehensive work schedule analysis
 */
export function analyzeWorkSchedule(weeklyWorkHours: Settings['weeklyWorkHours']): WorkScheduleAnalysis {
  const dailyTotals: Record<string, number> = {};
  let weeklyTotal = 0;
  let workingDays = 0;
  let maxDailyHours = 0;
  let minDailyHours = Infinity;
  
  // Calculate daily totals
  WORK_DAYS.forEach(day => {
    const daySlots = weeklyWorkHours[day] || [];
    const dayTotal = calculateDayTotalHours(daySlots);
    dailyTotals[day] = dayTotal;
    weeklyTotal += dayTotal;
    
    if (dayTotal > 0) {
      workingDays++;
      maxDailyHours = Math.max(maxDailyHours, dayTotal);
      minDailyHours = Math.min(minDailyHours, dayTotal);
    }
  });
  
  if (workingDays === 0) {
    minDailyHours = 0;
  }
  
  const averageDailyHours = workingDays > 0 ? weeklyTotal / workingDays : 0;
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (weeklyTotal < 20) {
    recommendations.push('Consider increasing weekly work hours for better productivity.');
  } else if (weeklyTotal > 60) {
    recommendations.push('High weekly hours detected. Consider work-life balance.');
  }
  
  if (maxDailyHours > WORK_SCHEDULE_LIMITS.RECOMMENDED_MAX_DAILY) {
    recommendations.push('Some days exceed recommended maximum. Consider redistributing hours.');
  }
  
  if (workingDays < 3) {
    recommendations.push('Consider spreading work across more days for consistency.');
  }
  
  // Check for optimal work pattern
  const hasWeekendWork = dailyTotals.saturday > 0 || dailyTotals.sunday > 0;
  if (hasWeekendWork && weeklyTotal > 40) {
    recommendations.push('Weekend work detected with high weekly total. Consider rest days.');
  }
  
  return {
    dailyTotals,
    weeklyTotal,
    averageDailyHours,
    workingDays,
    maxDailyHours,
    minDailyHours,
    recommendations
  };
}

/**
 * Validate entire work schedule for consistency and optimization
 * 
 * @param weeklyWorkHours - Weekly work schedule
 * @returns Validation results with errors and suggestions
 */
export function validateWorkSchedule(weeklyWorkHours: Settings['weeklyWorkHours']): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  analysis: WorkScheduleAnalysis;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate each day
  WORK_DAYS.forEach(day => {
    const daySlots = weeklyWorkHours[day] || [];
    
    // Check for overlaps
    const overlap = detectTimeSlotOverlaps(daySlots);
    if (overlap.hasOverlap) {
      errors.push(`${day}: Overlapping time slots detected.`);
    }
    
    // Validate individual slots
    daySlots.forEach((slot, index) => {
      const validation = validateWorkSlot(slot);
      if (!validation.isValid) {
        errors.push(`${day} slot ${index + 1}: ${validation.errors.join('; ')}`);
      }
      if (validation.warnings.length > 0) {
        warnings.push(`${day} slot ${index + 1}: ${validation.warnings.join('; ')}`);
      }
    });
    
    // Check daily limits
    const dayTotal = calculateDayTotalHours(daySlots);
    if (dayTotal > WORK_SCHEDULE_LIMITS.MAX_DAILY_HOURS) {
      errors.push(`${day}: Exceeds maximum daily hours (${WORK_SCHEDULE_LIMITS.MAX_DAILY_HOURS}h).`);
    }
  });
  
  const analysis = analyzeWorkSchedule(weeklyWorkHours);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    analysis
  };
}

/**
 * Generate default work schedule template
 * 
 * @param type - Type of schedule template
 * @returns Default work schedule
 */
export function generateDefaultWorkSchedule(
  type: 'standard' | 'flexible' | 'minimal' | 'intensive' = 'standard'
): Settings['weeklyWorkHours'] {
  switch (type) {
    case 'standard':
      return {
        monday: [{ id: '1', startTime: '09:00', endTime: '17:00', duration: 8 }],
        tuesday: [{ id: '2', startTime: '09:00', endTime: '17:00', duration: 8 }],
        wednesday: [{ id: '3', startTime: '09:00', endTime: '17:00', duration: 8 }],
        thursday: [{ id: '4', startTime: '09:00', endTime: '17:00', duration: 8 }],
        friday: [{ id: '5', startTime: '09:00', endTime: '17:00', duration: 8 }],
        saturday: [],
        sunday: []
      };
    
    case 'flexible':
      return {
        monday: [{ id: '1', startTime: '09:00', endTime: '17:00', duration: 8 }],
        tuesday: [{ id: '2', startTime: '09:00', endTime: '17:00', duration: 8 }],
        wednesday: [
          { id: '3a', startTime: '09:00', endTime: '13:00', duration: 4 },
          { id: '3b', startTime: '14:00', endTime: '18:00', duration: 4 }
        ],
        thursday: [{ id: '4', startTime: '09:00', endTime: '17:00', duration: 8 }],
        friday: [{ id: '5', startTime: '09:00', endTime: '17:00', duration: 8 }],
        saturday: [],
        sunday: []
      };
    
    case 'minimal':
      return {
        monday: [{ id: '1', startTime: '10:00', endTime: '14:00', duration: 4 }],
        tuesday: [{ id: '2', startTime: '10:00', endTime: '14:00', duration: 4 }],
        wednesday: [{ id: '3', startTime: '10:00', endTime: '14:00', duration: 4 }],
        thursday: [{ id: '4', startTime: '10:00', endTime: '14:00', duration: 4 }],
        friday: [{ id: '5', startTime: '10:00', endTime: '14:00', duration: 4 }],
        saturday: [],
        sunday: []
      };
    
    case 'intensive':
      return {
        monday: [{ id: '1', startTime: '08:00', endTime: '18:00', duration: 10 }],
        tuesday: [{ id: '2', startTime: '08:00', endTime: '18:00', duration: 10 }],
        wednesday: [{ id: '3', startTime: '08:00', endTime: '18:00', duration: 10 }],
        thursday: [{ id: '4', startTime: '08:00', endTime: '18:00', duration: 10 }],
        friday: [{ id: '5', startTime: '08:00', endTime: '16:00', duration: 8 }],
        saturday: [{ id: '6', startTime: '09:00', endTime: '13:00', duration: 4 }],
        sunday: []
      };
    
    default:
      return generateDefaultWorkSchedule('standard');
  }
}
