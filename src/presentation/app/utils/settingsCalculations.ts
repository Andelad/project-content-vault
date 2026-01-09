import { WorkSlot } from '@/shared/types/core';

/**
 * Settings Calculations
 * Unified calculations for work schedules, time formatting, and slot management
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Result type for work slot creation operations
 */
export interface WorkSlotCreationResult {
  success: boolean;
  slot?: WorkSlot;
  error?: string;
}

export interface WeeklyWorkSchedule {
  monday: WorkSlot[];
  tuesday: WorkSlot[];
  wednesday: WorkSlot[];
  thursday: WorkSlot[];
  friday: WorkSlot[];
  saturday: WorkSlot[];
  sunday: WorkSlot[];
}

// ============================================================================
// TIME CALCULATIONS
// ============================================================================

/**
 * Generates time options for dropdowns in 15-minute increments
 */
export function generateTimeOptions(use24Hour: boolean = false): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];

  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      let label: string;
      if (use24Hour) {
        label = timeValue;
      } else {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        label = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
      }

      options.push({ value: timeValue, label });
    }
  }

  return options;
}

/**
 * Helper function to convert time string to minutes
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// ============================================================================
// WORK SLOT CALCULATIONS
// ============================================================================

/**
 * Calculates total hours for a single day's work slots
 */
export function calculateDayTotalHours(slots: WorkSlot[]): number {
  return slots.reduce((total, slot) => total + slot.duration, 0);
}

/**
 * Calculates the duration of a work slot in hours
 */
export function calculateWorkSlotDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
}

/**
 * Calculates overlap in minutes between two time slots
 */
export function calculateSlotOverlapMinutes(slot1: WorkSlot, slot2: WorkSlot): number {
  const start1 = timeToMinutes(slot1.startTime);
  const end1 = timeToMinutes(slot1.endTime);
  const start2 = timeToMinutes(slot2.startTime);
  const end2 = timeToMinutes(slot2.endTime);

  const overlapStart = Math.max(start1, start2);
  const overlapEnd = Math.min(end1, end2);

  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Creates a new work slot with validation
 */
export function createNewWorkSlot(day: string, existingSlots: WorkSlot[]): WorkSlotCreationResult {
  // Generate unique ID
  const id = `slot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  let defaultStartTime: string;
  let defaultEndTime: string;

  if (existingSlots.length === 0) {
    // No existing slots - default to 9 AM - 5 PM
    defaultStartTime = '09:00';
    defaultEndTime = '17:00';
  } else {
    // Find the latest end time among existing slots
    const latestEndTime = existingSlots.reduce((latest, slot) => {
      return slot.endTime > latest ? slot.endTime : latest;
    }, '00:00');

    // Parse the latest end time
    const [hours, minutes] = latestEndTime.split(':').map(Number);
    
    // Add 1 hour gap after the latest slot
    const startHours = hours + 1;
    const endHours = startHours + 1; // 1 hour duration by default

    // Check if we're going past midnight
    if (startHours >= 24) {
      return {
        success: false,
        error: 'Cannot add more work slots - day is full (would exceed 24:00)'
      };
    }

    // Format times
    defaultStartTime = `${String(startHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    defaultEndTime = endHours >= 24 
      ? '23:59' 
      : `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // Calculate duration
  const duration = calculateWorkSlotDuration(defaultStartTime, defaultEndTime);

  // Create new slot
  const newSlot = {
    id,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    duration
  };

  // Double-check for overlaps (shouldn't happen with our logic, but safety check)
  if (hasTimeOverlap(newSlot, existingSlots)) {
    return {
      success: false,
      error: 'New work slot overlaps with existing slots'
    };
  }

  return {
    success: true,
    slot: newSlot
  };
}

/**
 * Updates an existing work slot with validation
 */
export function updateWorkSlot(existingSlot: WorkSlot, updates: Partial<WorkSlot>): WorkSlot {
  const updatedSlot = { ...existingSlot, ...updates };

  // Recalculate duration if times changed
  if (updates.startTime || updates.endTime) {
    updatedSlot.duration = calculateWorkSlotDuration(updatedSlot.startTime, updatedSlot.endTime);
  }

  return updatedSlot;
}

/**
 * Helper function to check if two time slots overlap
 */
function hasTimeOverlap(slot1: WorkSlot, slots: WorkSlot[]): boolean {
  return slots.some(slot2 => {
    return !(slot1.endTime <= slot2.startTime || slot1.startTime >= slot2.endTime);
  });
}

// ============================================================================
// SCHEDULE CALCULATIONS
// ============================================================================

/**
 * Calculates total hours for the entire week's work schedule
 */
export function calculateWeekTotalHours(weeklyWorkHours: WeeklyWorkSchedule): number {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.reduce((total, day) => {
    const daySlots = weeklyWorkHours[day as keyof WeeklyWorkSchedule] || [];
    return total + calculateDayTotalHours(daySlots);
  }, 0);
}

/**
 * Generates default work schedules
 */
export function generateDefaultWorkSchedule(type: 'standard' | 'flexible' | 'minimal'): WeeklyWorkSchedule {
  const emptySchedule: WeeklyWorkSchedule = {
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
      {
        // Monday-Friday 9 AM - 5 PM
        const standardSlot = {
          id: 'default-work-slot',
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
      }

    case 'flexible':
      {
        // Monday-Friday 8 AM - 4 PM, flexible timing
        const flexibleSlot = {
          id: 'flexible-work-slot',
          startTime: '08:00',
          endTime: '16:00',
          duration: 8
        };
        return {
          ...emptySchedule,
          monday: [flexibleSlot],
          tuesday: [flexibleSlot],
          wednesday: [flexibleSlot],
          thursday: [flexibleSlot],
          friday: [flexibleSlot]
        };
      }

    case 'minimal':
      {
        // Monday, Wednesday, Friday 10 AM - 2 PM
        const minimalSlot = {
          id: 'minimal-work-slot',
          startTime: '10:00',
          endTime: '14:00',
          duration: 4
        };
        return {
          ...emptySchedule,
          monday: [minimalSlot],
          wednesday: [minimalSlot],
          friday: [minimalSlot]
        };
      }

    default:
      return emptySchedule;
  }
}

/**
 * Validates a work schedule for common issues
 */
export function validateWorkSchedule(schedule: WeeklyWorkSchedule): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const days = Object.keys(schedule) as (keyof WeeklyWorkSchedule)[];
  
  for (const day of days) {
    const slots = schedule[day];
    
    // Check for overlapping slots
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (calculateSlotOverlapMinutes(slots[i], slots[j]) > 0) {
          errors.push(`${day}: Work slots overlap`);
        }
      }
    }
    
    // Check for excessive daily hours
    const totalHours = calculateDayTotalHours(slots);
    if (totalHours > 12) {
      warnings.push(`${day}: ${totalHours} hours may be excessive`);
    }
  }

  // Check total weekly hours
  const weeklyTotal = calculateWeekTotalHours(schedule);
  if (weeklyTotal > 60) {
    warnings.push(`Weekly total of ${weeklyTotal} hours may be excessive`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
