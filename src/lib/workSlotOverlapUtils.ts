import { WorkSlot } from '@/types/core';

export interface TimeRange {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  duration: number;
}

export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

export function timeToMinutes(timeStr: string): number {
  const { hours, minutes } = parseTime(timeStr);
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function checkTimeRangeOverlap(range1: TimeRange, range2: TimeRange): boolean {
  const start1 = timeToMinutes(range1.startTime);
  const end1 = timeToMinutes(range1.endTime);
  const start2 = timeToMinutes(range2.startTime);
  const end2 = timeToMinutes(range2.endTime);
  
  // Two ranges overlap if one starts before the other ends
  return start1 < end2 && start2 < end1;
}

export function findOverlappingSlots(
  newSlot: TimeRange, 
  existingSlots: WorkSlot[], 
  excludeSlotId?: string
): WorkSlot[] {
  return existingSlots.filter(slot => {
    // Don't check against the slot being modified
    if (excludeSlotId && (slot.id === excludeSlotId || 
        // Also handle numeric string IDs for compatibility
        slot.id === excludeSlotId.toString() ||
        // Handle array index matching for generated work hour IDs
        existingSlots.findIndex(s => s.id === slot.id).toString() === excludeSlotId)) {
      return false;
    }
    
    return checkTimeRangeOverlap(newSlot, {
      startTime: slot.startTime,
      endTime: slot.endTime,
      duration: slot.duration
    });
  });
}

export function validateWorkSlotTimes(
  startTime: string,
  endTime: string,
  existingSlots: WorkSlot[],
  excludeSlotId?: string
): {
  isValid: boolean;
  overlaps: WorkSlot[];
  duration: number;
} {
  // Calculate duration
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const duration = (endMinutes - startMinutes) / 60;
  
  // Check for minimum duration (15 minutes)
  if (duration < 0.25) {
    return {
      isValid: false,
      overlaps: [],
      duration
    };
  }
  
  const newSlot: TimeRange = {
    startTime,
    endTime,
    duration
  };
  
  const overlaps = findOverlappingSlots(newSlot, existingSlots, excludeSlotId);
  
  return {
    isValid: overlaps.length === 0 && duration >= 0.25,
    overlaps,
    duration
  };
}

export function suggestNonOverlappingTime(
  desiredStart: string,
  desiredDuration: number,
  existingSlots: WorkSlot[],
  dayStartHour: number = 6,
  dayEndHour: number = 22
): { startTime: string; endTime: string } | null {
  const desiredStartMinutes = timeToMinutes(desiredStart);
  const durationMinutes = desiredDuration * 60;
  
  // Try the desired time first
  const desiredEndMinutes = desiredStartMinutes + durationMinutes;
  const desiredEnd = minutesToTime(desiredEndMinutes);
  
  const validation = validateWorkSlotTimes(desiredStart, desiredEnd, existingSlots);
  if (validation.isValid) {
    return { startTime: desiredStart, endTime: desiredEnd };
  }
  
  // If desired time conflicts, try to find next available slot
  const dayStart = dayStartHour * 60;
  const dayEnd = dayEndHour * 60;
  
  // Create sorted list of occupied time ranges
  const occupiedRanges = existingSlots
    .map(slot => ({
      start: timeToMinutes(slot.startTime),
      end: timeToMinutes(slot.endTime)
    }))
    .sort((a, b) => a.start - b.start);
  
  // Find gaps between occupied ranges
  let searchStart = dayStart;
  
  for (const range of occupiedRanges) {
    // Check if there's enough space before this occupied range
    if (searchStart + durationMinutes <= range.start) {
      const suggestedStart = minutesToTime(searchStart);
      const suggestedEnd = minutesToTime(searchStart + durationMinutes);
      return { startTime: suggestedStart, endTime: suggestedEnd };
    }
    
    // Move search start to after this occupied range
    searchStart = Math.max(searchStart, range.end);
  }
  
  // Check if there's space after all occupied ranges
  if (searchStart + durationMinutes <= dayEnd) {
    const suggestedStart = minutesToTime(searchStart);
    const suggestedEnd = minutesToTime(searchStart + durationMinutes);
    return { startTime: suggestedStart, endTime: suggestedEnd };
  }
  
  return null; // No available time slot found
}