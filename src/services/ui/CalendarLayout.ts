/**
 * Calendar positioning and grid calculations
 * Handles UI-specific calendar positioning logic
 * Uses single source of truth for all calculations
 */

import { 
  calculateDurationHours as coreCalculateDurationHours,
  normalizeToMidnight
} from '@/services/calculations/general/dateCalculations';
import { 
  snapToTimeSlot as coreSnapToTimeSlot
} from '@/services/calculations/general/timeCalculations';

export interface TimeSlotConfig {
  slotHeight: number;
  slotsPerHour: number;
  minutesPerSlot: number;
}

export interface TimePosition {
  hour: number;
  minute: number;
}

export interface CalendarGridRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export class CalendarPositioningService {
  // Standard 15-minute time slot configuration
  private static readonly DEFAULT_SLOT_CONFIG: TimeSlotConfig = {
    slotHeight: 15,
    slotsPerHour: 4,
    minutesPerSlot: 15
  };

  /**
   * Calculate time from vertical position in calendar grid
   */
  static calculateTimeFromPosition(
    clientY: number,
    gridRect: CalendarGridRect,
    baseDate: Date,
    config: TimeSlotConfig = this.DEFAULT_SLOT_CONFIG
  ): Date {
    const relativeY = clientY - gridRect.top;
    const slotIndex = Math.max(0, Math.floor(relativeY / config.slotHeight));
    const hour = Math.floor(slotIndex / config.slotsPerHour);
    const minute = (slotIndex % config.slotsPerHour) * config.minutesPerSlot;
    
    const newTime = new Date(baseDate);
    newTime.setHours(
      Math.min(23, Math.max(0, hour)), 
      minute, 
      0, 
      0
    );
    
    return this.snapToTimeSlot(newTime, config);
  }

  /**
   * Snap a date to the nearest time slot
   */
  static snapToTimeSlot(
    date: Date, 
    config: TimeSlotConfig = this.DEFAULT_SLOT_CONFIG
  ): Date {
    const snapped = new Date(date);
    const minutes = snapped.getMinutes();
    const roundedMinutes = Math.round(minutes / config.minutesPerSlot) * config.minutesPerSlot;
    snapped.setMinutes(roundedMinutes, 0, 0);
    return snapped;
  }

  /**
   * Calculate vertical position from time
   */
  static calculatePositionFromTime(
    time: Date,
    config: TimeSlotConfig = this.DEFAULT_SLOT_CONFIG
  ): number {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const totalSlots = hours * config.slotsPerHour + Math.floor(minutes / config.minutesPerSlot);
    return totalSlots * config.slotHeight;
  }

  /**
   * Calculate duration between two times in hours
   * DELEGATES to single source of truth
   */
  static calculateDurationHours(startTime: Date, endTime: Date): number {
    return coreCalculateDurationHours(startTime, endTime);
  }

  /**
   * Calculate duration between two times in minutes
   */
  static calculateDurationMinutes(startTime: Date, endTime: Date): number {
    return (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  }

  /**
   * Get time position breakdown (hour and minute)
   */
  static getTimePosition(date: Date): TimePosition {
    return {
      hour: date.getHours(),
      minute: date.getMinutes()
    };
  }

  /**
   * Validate time slot boundaries
   */
  static isValidTimeSlot(time: Date): boolean {
    const hour = time.getHours();
    const minute = time.getMinutes();
    return hour >= 0 && hour <= 23 && minute >= 0 && minute < 60;
  }

  /**
   * Get the nearest valid time slot
   */
  static getNearestValidTimeSlot(
    time: Date, 
    config: TimeSlotConfig = this.DEFAULT_SLOT_CONFIG
  ): Date {
    let snapped = this.snapToTimeSlot(time, config);
    
    // Ensure within valid bounds
    if (snapped.getHours() < 0) {
      snapped = normalizeToMidnight(snapped);
    } else if (snapped.getHours() > 23) {
      snapped.setHours(23, 59, 0, 0);
    }
    
    return snapped;
  }

  /**
   * Calculate height for a work hour block based on duration
   */
  static calculateBlockHeight(
    durationHours: number,
    config: TimeSlotConfig = this.DEFAULT_SLOT_CONFIG
  ): number {
    const totalMinutes = durationHours * 60;
    const slots = totalMinutes / config.minutesPerSlot;
    return slots * config.slotHeight;
  }

  /**
   * Get calendar grid boundaries for an element
   */
  static getCalendarGridRect(element: Element): CalendarGridRect | null {
    const calendarGrid = element.closest('[data-calendar-grid]');
    if (!calendarGrid) return null;
    
    const rect = calendarGrid.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    };
  }
}
