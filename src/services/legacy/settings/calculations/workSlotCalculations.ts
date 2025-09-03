/**
 * Work Slot Calculations for Settings
 * Work slot creation, updates, and calculations for settings functionality
 */

import { WorkSlot } from '@/types/core';

/**
 * Result type for work slot creation operations
 */
export interface WorkSlotCreationResult {
  success: boolean;
  slot?: WorkSlot;
  error?: string;
}

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

  // Default to 9 AM - 5 PM if no existing slots
  const defaultStartTime = existingSlots.length === 0 ? '09:00' : '09:00';
  const defaultEndTime = existingSlots.length === 0 ? '17:00' : '17:00';

  // Calculate duration
  const duration = calculateWorkSlotDuration(defaultStartTime, defaultEndTime);

  // Check for overlaps with existing slots
  const newSlot = {
    id,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    duration
  };

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
 * Helper function to convert time string to minutes
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Helper function to check if two time slots overlap
 */
function hasTimeOverlap(slot1: WorkSlot, slots: WorkSlot[]): boolean {
  return slots.some(slot2 => {
    return !(slot1.endTime <= slot2.startTime || slot1.startTime >= slot2.endTime);
  });
}