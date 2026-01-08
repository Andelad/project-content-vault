/**
 * Settings Calculations Tests
 * 
 * Tests for work schedule calculations and time slot management
 * 
 * @see src/utils/settingsCalculations.ts
 */

import { describe, it, expect } from 'vitest';
import type { WorkSlot } from '@/types/core';
import {
  generateTimeOptions,
  calculateDayTotalHours,
  calculateWorkSlotDuration,
  calculateSlotOverlapMinutes,
  createNewWorkSlot,
  updateWorkSlot,
  calculateWeekTotalHours,
  generateDefaultWorkSchedule,
  validateWorkSchedule,
  type WeeklyWorkSchedule,
} from '../settingsCalculations';

describe('settingsCalculations', () => {
  
  describe('Time options generation', () => {
    it('should generate 15-minute increment time options', () => {
      const options = generateTimeOptions();
      expect(options).toHaveLength(96); // 24 hours * 4 (15-min increments)
    });

    it('should start at midnight', () => {
      const options = generateTimeOptions();
      expect(options[0].value).toBe('00:00');
    });

    it('should end at 23:45', () => {
      const options = generateTimeOptions();
      expect(options[options.length - 1].value).toBe('23:45');
    });

    it('should format in 12-hour by default', () => {
      const options = generateTimeOptions();
      expect(options[0].label).toBe('12:00 AM');
      expect(options[48].label).toBe('12:00 PM'); // Noon
    });

    it('should format in 24-hour when specified', () => {
      const options = generateTimeOptions(true);
      expect(options[0].label).toBe('00:00');
      expect(options[48].label).toBe('12:00');
    });

    it('should include common times', () => {
      const options = generateTimeOptions();
      const values = options.map(o => o.value);
      expect(values).toContain('09:00'); // 9 AM
      expect(values).toContain('12:00'); // Noon
      expect(values).toContain('17:00'); // 5 PM
    });
  });

  describe('Day total hours calculation', () => {
    it('should calculate total hours for single slot', () => {
      const slots: WorkSlot[] = [
        { id: '1', startTime: '09:00', endTime: '17:00', duration: 8 }
      ];
      expect(calculateDayTotalHours(slots)).toBe(8);
    });

    it('should calculate total hours for multiple slots', () => {
      const slots: WorkSlot[] = [
        { id: '1', startTime: '09:00', endTime: '12:00', duration: 3 },
        { id: '2', startTime: '13:00', endTime: '17:00', duration: 4 }
      ];
      expect(calculateDayTotalHours(slots)).toBe(7);
    });

    it('should return 0 for no slots', () => {
      expect(calculateDayTotalHours([])).toBe(0);
    });

    it('should handle fractional hours', () => {
      const slots: WorkSlot[] = [
        { id: '1', startTime: '09:00', endTime: '09:30', duration: 0.5 },
        { id: '2', startTime: '10:00', endTime: '10:45', duration: 0.75 }
      ];
      expect(calculateDayTotalHours(slots)).toBe(1.25);
    });
  });

  describe('Work slot duration calculation', () => {
    it('should calculate 8-hour workday', () => {
      expect(calculateWorkSlotDuration('09:00', '17:00')).toBe(8);
    });

    it('should calculate half-hour duration', () => {
      expect(calculateWorkSlotDuration('09:00', '09:30')).toBe(0.5);
    });

    it('should calculate 15-minute duration', () => {
      expect(calculateWorkSlotDuration('09:00', '09:15')).toBe(0.25);
    });

    it('should calculate duration across different hours', () => {
      expect(calculateWorkSlotDuration('10:30', '14:45')).toBe(4.25);
    });

    it('should handle midnight to morning', () => {
      expect(calculateWorkSlotDuration('00:00', '08:00')).toBe(8);
    });

    it('should handle evening hours', () => {
      expect(calculateWorkSlotDuration('18:00', '22:30')).toBe(4.5);
    });
  });

  describe('Slot overlap calculation', () => {
    it('should detect no overlap for separate slots', () => {
      const slot1: WorkSlot = { id: '1', startTime: '09:00', endTime: '12:00', duration: 3 };
      const slot2: WorkSlot = { id: '2', startTime: '13:00', endTime: '17:00', duration: 4 };
      expect(calculateSlotOverlapMinutes(slot1, slot2)).toBe(0);
    });

    it('should detect full overlap when slots are identical', () => {
      const slot1: WorkSlot = { id: '1', startTime: '09:00', endTime: '17:00', duration: 8 };
      const slot2: WorkSlot = { id: '2', startTime: '09:00', endTime: '17:00', duration: 8 };
      expect(calculateSlotOverlapMinutes(slot1, slot2)).toBe(480); // 8 hours = 480 minutes
    });

    it('should detect partial overlap', () => {
      const slot1: WorkSlot = { id: '1', startTime: '09:00', endTime: '13:00', duration: 4 };
      const slot2: WorkSlot = { id: '2', startTime: '12:00', endTime: '17:00', duration: 5 };
      expect(calculateSlotOverlapMinutes(slot1, slot2)).toBe(60); // 1 hour overlap
    });

    it('should detect one slot completely within another', () => {
      const slot1: WorkSlot = { id: '1', startTime: '09:00', endTime: '17:00', duration: 8 };
      const slot2: WorkSlot = { id: '2', startTime: '12:00', endTime: '13:00', duration: 1 };
      expect(calculateSlotOverlapMinutes(slot1, slot2)).toBe(60);
    });

    it('should return 0 for adjacent slots', () => {
      const slot1: WorkSlot = { id: '1', startTime: '09:00', endTime: '12:00', duration: 3 };
      const slot2: WorkSlot = { id: '2', startTime: '12:00', endTime: '17:00', duration: 5 };
      expect(calculateSlotOverlapMinutes(slot1, slot2)).toBe(0);
    });
  });

  describe('Work slot creation', () => {
    it('should create default 9-5 slot when no existing slots', () => {
      const result = createNewWorkSlot('monday', []);
      expect(result.success).toBe(true);
      expect(result.slot?.startTime).toBe('09:00');
      expect(result.slot?.endTime).toBe('17:00');
      expect(result.slot?.duration).toBe(8);
    });

    it('should create slot after existing slot with 1-hour gap', () => {
      const existingSlots: WorkSlot[] = [
        { id: '1', startTime: '09:00', endTime: '12:00', duration: 3 }
      ];
      const result = createNewWorkSlot('monday', existingSlots);
      expect(result.success).toBe(true);
      expect(result.slot?.startTime).toBe('13:00');
      expect(result.slot?.endTime).toBe('14:00');
    });

    it('should create slot after latest slot when multiple exist', () => {
      const existingSlots: WorkSlot[] = [
        { id: '1', startTime: '09:00', endTime: '12:00', duration: 3 },
        { id: '2', startTime: '13:00', endTime: '15:00', duration: 2 }
      ];
      const result = createNewWorkSlot('monday', existingSlots);
      expect(result.success).toBe(true);
      expect(result.slot?.startTime).toBe('16:00');
      expect(result.slot?.endTime).toBe('17:00');
    });

    it('should fail if day is full (would exceed 24:00)', () => {
      const existingSlots: WorkSlot[] = [
        { id: '1', startTime: '09:00', endTime: '23:00', duration: 14 }
      ];
      const result = createNewWorkSlot('monday', existingSlots);
      expect(result.success).toBe(false);
      expect(result.error).toContain('day is full');
    });

    it('should generate unique ID for each slot', () => {
      const result1 = createNewWorkSlot('monday', []);
      const result2 = createNewWorkSlot('monday', []);
      expect(result1.slot?.id).not.toBe(result2.slot?.id);
    });

    it('should cap end time at 23:59 if calculation exceeds midnight', () => {
      const existingSlots: WorkSlot[] = [
        { id: '1', startTime: '09:00', endTime: '22:30', duration: 13.5 }
      ];
      const result = createNewWorkSlot('monday', existingSlots);
      expect(result.success).toBe(true);
      expect(result.slot?.endTime).toBe('23:59');
    });
  });

  describe('Work slot update', () => {
    it('should update slot start time and recalculate duration', () => {
      const slot: WorkSlot = { id: '1', startTime: '09:00', endTime: '17:00', duration: 8 };
      const updated = updateWorkSlot(slot, { startTime: '10:00' });
      expect(updated.startTime).toBe('10:00');
      expect(updated.duration).toBe(7);
    });

    it('should update slot end time and recalculate duration', () => {
      const slot: WorkSlot = { id: '1', startTime: '09:00', endTime: '17:00', duration: 8 };
      const updated = updateWorkSlot(slot, { endTime: '18:00' });
      expect(updated.endTime).toBe('18:00');
      expect(updated.duration).toBe(9);
    });

    it('should update both times', () => {
      const slot: WorkSlot = { id: '1', startTime: '09:00', endTime: '17:00', duration: 8 };
      const updated = updateWorkSlot(slot, { startTime: '08:00', endTime: '16:00' });
      expect(updated.startTime).toBe('08:00');
      expect(updated.endTime).toBe('16:00');
      expect(updated.duration).toBe(8);
    });

    it('should preserve ID when updating', () => {
      const slot: WorkSlot = { id: 'abc123', startTime: '09:00', endTime: '17:00', duration: 8 };
      const updated = updateWorkSlot(slot, { startTime: '10:00' });
      expect(updated.id).toBe('abc123');
    });
  });

  describe('Week total hours calculation', () => {
    it('should calculate 40-hour work week', () => {
      const schedule: WeeklyWorkSchedule = {
        monday: [{ id: '1', startTime: '09:00', endTime: '17:00', duration: 8 }],
        tuesday: [{ id: '2', startTime: '09:00', endTime: '17:00', duration: 8 }],
        wednesday: [{ id: '3', startTime: '09:00', endTime: '17:00', duration: 8 }],
        thursday: [{ id: '4', startTime: '09:00', endTime: '17:00', duration: 8 }],
        friday: [{ id: '5', startTime: '09:00', endTime: '17:00', duration: 8 }],
        saturday: [],
        sunday: []
      };
      expect(calculateWeekTotalHours(schedule)).toBe(40);
    });

    it('should handle empty schedule', () => {
      const schedule: WeeklyWorkSchedule = {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      };
      expect(calculateWeekTotalHours(schedule)).toBe(0);
    });

    it('should handle weekend work', () => {
      const schedule: WeeklyWorkSchedule = {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [{ id: '1', startTime: '10:00', endTime: '14:00', duration: 4 }],
        sunday: [{ id: '2', startTime: '10:00', endTime: '14:00', duration: 4 }]
      };
      expect(calculateWeekTotalHours(schedule)).toBe(8);
    });

    it('should handle multiple slots per day', () => {
      const schedule: WeeklyWorkSchedule = {
        monday: [
          { id: '1', startTime: '09:00', endTime: '12:00', duration: 3 },
          { id: '2', startTime: '13:00', endTime: '17:00', duration: 4 }
        ],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      };
      expect(calculateWeekTotalHours(schedule)).toBe(7);
    });
  });

  describe('Default work schedule generation', () => {
    it('should generate standard 9-5 Monday-Friday schedule', () => {
      const schedule = generateDefaultWorkSchedule('standard');
      expect(schedule.monday).toHaveLength(1);
      expect(schedule.monday[0].startTime).toBe('09:00');
      expect(schedule.monday[0].endTime).toBe('17:00');
      expect(schedule.friday).toHaveLength(1);
      expect(schedule.saturday).toHaveLength(0);
      expect(schedule.sunday).toHaveLength(0);
    });

    it('should generate flexible 8-4 Monday-Friday schedule', () => {
      const schedule = generateDefaultWorkSchedule('flexible');
      expect(schedule.monday[0].startTime).toBe('08:00');
      expect(schedule.monday[0].endTime).toBe('16:00');
      expect(schedule.tuesday).toHaveLength(1);
    });

    it('should generate minimal Monday/Wednesday/Friday schedule', () => {
      const schedule = generateDefaultWorkSchedule('minimal');
      expect(schedule.monday).toHaveLength(1);
      expect(schedule.tuesday).toHaveLength(0);
      expect(schedule.wednesday).toHaveLength(1);
      expect(schedule.thursday).toHaveLength(0);
      expect(schedule.friday).toHaveLength(1);
    });

    it('should calculate 40 hours for standard schedule', () => {
      const schedule = generateDefaultWorkSchedule('standard');
      expect(calculateWeekTotalHours(schedule)).toBe(40);
    });

    it('should calculate 12 hours for minimal schedule', () => {
      const schedule = generateDefaultWorkSchedule('minimal');
      expect(calculateWeekTotalHours(schedule)).toBe(12);
    });
  });

  describe('Work schedule validation', () => {
    it('should validate clean schedule with no issues', () => {
      const schedule = generateDefaultWorkSchedule('standard');
      const result = validateWorkSchedule(schedule);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect overlapping slots', () => {
      const schedule: WeeklyWorkSchedule = {
        monday: [
          { id: '1', startTime: '09:00', endTime: '13:00', duration: 4 },
          { id: '2', startTime: '12:00', endTime: '17:00', duration: 5 }
        ],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      };
      const result = validateWorkSchedule(schedule);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('overlap'))).toBe(true);
    });

    it('should warn about excessive daily hours', () => {
      const schedule: WeeklyWorkSchedule = {
        monday: [{ id: '1', startTime: '08:00', endTime: '22:00', duration: 14 }],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      };
      const result = validateWorkSchedule(schedule);
      expect(result.warnings.some(w => w.includes('excessive'))).toBe(true);
    });

    it('should warn about excessive weekly hours', () => {
      const longDay = { id: '1', startTime: '08:00', endTime: '21:00', duration: 13 };
      const schedule: WeeklyWorkSchedule = {
        monday: [longDay],
        tuesday: [longDay],
        wednesday: [longDay],
        thursday: [longDay],
        friday: [longDay],
        saturday: [],
        sunday: []
      };
      const result = validateWorkSchedule(schedule);
      expect(result.warnings.some(w => w.includes('Weekly'))).toBe(true);
    });

    it('should allow adjacent slots without errors', () => {
      const schedule: WeeklyWorkSchedule = {
        monday: [
          { id: '1', startTime: '09:00', endTime: '12:00', duration: 3 },
          { id: '2', startTime: '12:00', endTime: '17:00', duration: 5 }
        ],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
      };
      const result = validateWorkSchedule(schedule);
      expect(result.isValid).toBe(true);
    });
  });
});
