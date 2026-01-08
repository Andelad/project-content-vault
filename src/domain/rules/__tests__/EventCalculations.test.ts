/**
 * Event Calculations Tests
 * 
 * Tests for pure business logic around event duration calculations,
 * multi-day events, midnight crossing, and date-specific calculations.
 * 
 * @see src/domain/rules/events/EventCalculations.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEventDurationOnDate,
  calculateEventTotalDuration,
  isMultiDayEvent,
  getEventDateSpan,
  calculateDayDifference,
} from '@/domain/rules/events/EventCalculations';

describe('EventCalculations', () => {
  
  describe('calculateEventDurationOnDate', () => {
    
    describe('Single-day events', () => {
      it('should calculate duration for event entirely within one day', () => {
        const event = {
          startTime: new Date('2026-01-15T09:00:00'),
          endTime: new Date('2026-01-15T17:00:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
        });
        
        expect(duration).toBe(8); // 8 hours
      });
      
      it('should return 0 for date before event', () => {
        const event = {
          startTime: new Date('2026-01-15T09:00:00'),
          endTime: new Date('2026-01-15T17:00:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-14'),
        });
        
        expect(duration).toBe(0);
      });
      
      it('should return 0 for date after event', () => {
        const event = {
          startTime: new Date('2026-01-15T09:00:00'),
          endTime: new Date('2026-01-15T17:00:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-16'),
        });
        
        expect(duration).toBe(0);
      });
      
      it('should handle event with no endTime as ongoing', () => {
        const event = {
          startTime: new Date('2026-01-15T09:00:00'),
        };
        
        const currentTime = new Date('2026-01-15T12:00:00');
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
          currentTime,
        });
        
        expect(duration).toBe(3); // 3 hours from 9am to noon
      });
    });
    
    describe('Multi-day events - midnight crossing', () => {
      it('should calculate partial duration for first day of multi-day event', () => {
        const event = {
          startTime: new Date('2026-01-15T14:00:00'), // 2pm on Jan 15
          endTime: new Date('2026-01-16T10:00:00'),   // 10am on Jan 16
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
        });
        
        // From 2pm to midnight = 10 hours
        expect(duration).toBeCloseTo(10, 1);
      });
      
      it('should calculate partial duration for last day of multi-day event', () => {
        const event = {
          startTime: new Date('2026-01-15T14:00:00'), // 2pm on Jan 15
          endTime: new Date('2026-01-16T10:00:00'),   // 10am on Jan 16
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-16'),
        });
        
        // From midnight to 10am = 10 hours
        expect(duration).toBe(10);
      });
      
      it('should calculate full 24 hours for middle day of 3-day event', () => {
        const event = {
          startTime: new Date('2026-01-15T14:00:00'), // 2pm on Jan 15
          endTime: new Date('2026-01-17T10:00:00'),   // 10am on Jan 17
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-16'), // Middle day
        });
        
        // Full day = 24 hours
        expect(duration).toBeCloseTo(24, 1);
      });
      
      it('should handle event spanning exactly midnight to midnight', () => {
        const event = {
          startTime: new Date('2026-01-15T00:00:00'),
          endTime: new Date('2026-01-16T00:00:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
        });
        
        expect(duration).toBeCloseTo(24, 1);
      });
    });
    
    describe('Boundary conditions', () => {
      it('should handle event starting at midnight', () => {
        const event = {
          startTime: new Date('2026-01-15T00:00:00'),
          endTime: new Date('2026-01-15T08:00:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
        });
        
        expect(duration).toBe(8);
      });
      
      it('should handle event ending at 11:59:59 PM', () => {
        const event = {
          startTime: new Date('2026-01-15T20:00:00'),
          endTime: new Date('2026-01-15T23:59:59'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
        });
        
        expect(duration).toBeCloseTo(3.9997, 2); // Almost 4 hours
      });
      
      it('should handle month boundary crossing', () => {
        const event = {
          startTime: new Date('2026-01-31T20:00:00'), // Jan 31 at 8pm
          endTime: new Date('2026-02-01T04:00:00'),   // Feb 1 at 4am
        };
        
        const durationJan31 = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-31'),
        });
        
        const durationFeb1 = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-02-01'),
        });
        
        expect(durationJan31).toBeCloseTo(4, 1); // 8pm to midnight
        expect(durationFeb1).toBe(4);  // midnight to 4am
      });
      
      it('should handle year boundary crossing', () => {
        const event = {
          startTime: new Date('2025-12-31T20:00:00'),
          endTime: new Date('2026-01-01T04:00:00'),
        };
        
        const duration2025 = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2025-12-31'),
        });
        
        const duration2026 = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-01'),
        });
        
        expect(duration2025).toBeCloseTo(4, 1);
        expect(duration2026).toBe(4);
      });
      
      it('should handle leap year February 29th', () => {
        const event = {
          startTime: new Date('2024-02-29T10:00:00'), // Leap year
          endTime: new Date('2024-02-29T14:00:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2024-02-29'),
        });
        
        expect(duration).toBe(4);
      });
    });
    
    describe('Edge cases', () => {
      it('should return 0 for event with no startTime', () => {
        const event = {
          startTime: null as any,
          endTime: new Date('2026-01-15T17:00:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
        });
        
        expect(duration).toBe(0);
      });
      
      it('should handle zero-duration event (start = end)', () => {
        const event = {
          startTime: new Date('2026-01-15T12:00:00'),
          endTime: new Date('2026-01-15T12:00:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
        });
        
        expect(duration).toBe(0);
      });
      
      it('should handle very short duration (1 minute)', () => {
        const event = {
          startTime: new Date('2026-01-15T12:00:00'),
          endTime: new Date('2026-01-15T12:01:00'),
        };
        
        const duration = calculateEventDurationOnDate({
          event,
          targetDate: new Date('2026-01-15'),
        });
        
        expect(duration).toBeCloseTo(1 / 60, 4); // 1/60 of an hour
      });
    });
  });
  
  describe('calculateEventTotalDuration', () => {
    it('should sum duration across multiple days', () => {
      const event = {
        startTime: new Date('2026-01-15T14:00:00'),
        endTime: new Date('2026-01-17T10:00:00'),
      };
      
      const dates = [
        new Date('2026-01-15'),
        new Date('2026-01-16'),
        new Date('2026-01-17'),
      ];
      
      const total = calculateEventTotalDuration(event, dates);
      
      // Jan 15: 10 hours (2pm to midnight)
      // Jan 16: 24 hours (full day)
      // Jan 17: 10 hours (midnight to 10am)
      // Total: 44 hours
      expect(total).toBeCloseTo(44, 1);
    });
    
    it('should return 0 for empty dates array', () => {
      const event = {
        startTime: new Date('2026-01-15T09:00:00'),
        endTime: new Date('2026-01-15T17:00:00'),
      };
      
      const total = calculateEventTotalDuration(event, []);
      
      expect(total).toBe(0);
    });
    
    it('should only count days where event overlaps', () => {
      const event = {
        startTime: new Date('2026-01-15T09:00:00'),
        endTime: new Date('2026-01-15T17:00:00'),
      };
      
      const dates = [
        new Date('2026-01-14'), // Before event
        new Date('2026-01-15'), // During event
        new Date('2026-01-16'), // After event
      ];
      
      const total = calculateEventTotalDuration(event, dates);
      
      expect(total).toBe(8); // Only the 8 hours on Jan 15
    });
  });
  
  describe('isMultiDayEvent', () => {
    it('should return false for single-day event', () => {
      const event = {
        startTime: new Date('2026-01-15T09:00:00'),
        endTime: new Date('2026-01-15T17:00:00'),
      };
      
      expect(isMultiDayEvent(event)).toBe(false);
    });
    
    it('should return true for event crossing midnight', () => {
      const event = {
        startTime: new Date('2026-01-15T23:00:00'),
        endTime: new Date('2026-01-16T01:00:00'),
      };
      
      expect(isMultiDayEvent(event)).toBe(true);
    });
    
    it('should return true for event spanning multiple days', () => {
      const event = {
        startTime: new Date('2026-01-15T09:00:00'),
        endTime: new Date('2026-01-17T17:00:00'),
      };
      
      expect(isMultiDayEvent(event)).toBe(true);
    });
    
    it('should return false when event has no endTime', () => {
      const event = {
        startTime: new Date('2026-01-15T09:00:00'),
      };
      
      expect(isMultiDayEvent(event)).toBe(false);
    });
    
    it('should return false when event has no startTime', () => {
      const event = {
        startTime: null as any,
        endTime: new Date('2026-01-15T17:00:00'),
      };
      
      expect(isMultiDayEvent(event)).toBe(false);
    });
  });
  
  describe('getEventDateSpan', () => {
    it('should return all dates spanned by single-day event', () => {
      const event = {
        startTime: new Date('2026-01-15T09:00:00'),
        endTime: new Date('2026-01-15T17:00:00'),
      };
      
      const span = getEventDateSpan(event);
      
      expect(span).toHaveLength(1);
      expect(span[0]).toEqual(new Date('2026-01-15T00:00:00'));
    });
    
    it('should return all dates spanned by multi-day event', () => {
      const event = {
        startTime: new Date('2026-01-15T14:00:00'),
        endTime: new Date('2026-01-17T10:00:00'),
      };
      
      const span = getEventDateSpan(event);
      
      expect(span).toHaveLength(3);
      expect(span[0]).toEqual(new Date('2026-01-15T00:00:00'));
      expect(span[1]).toEqual(new Date('2026-01-16T00:00:00'));
      expect(span[2]).toEqual(new Date('2026-01-17T00:00:00'));
    });
    
    it('should handle event with no endTime using current time', () => {
      // Use current date (Jan 8, 2026) so event is ongoing
      const event = {
        startTime: new Date('2026-01-08T09:00:00'),
      };
      
      const span = getEventDateSpan(event);
      
      expect(span.length).toBeGreaterThan(0);
      expect(span[0]).toEqual(new Date('2026-01-08T00:00:00'));
    });
    
    it('should return empty array for event with no startTime', () => {
      const event = {
        startTime: null as any,
      };
      
      const span = getEventDateSpan(event);
      
      expect(span).toEqual([]);
    });
    
    it('should handle month boundary crossing', () => {
      const event = {
        startTime: new Date('2026-01-30T12:00:00'),
        endTime: new Date('2026-02-02T12:00:00'),
      };
      
      const span = getEventDateSpan(event);
      
      expect(span).toHaveLength(4);
      expect(span[0]).toEqual(new Date('2026-01-30T00:00:00'));
      expect(span[1]).toEqual(new Date('2026-01-31T00:00:00'));
      expect(span[2]).toEqual(new Date('2026-02-01T00:00:00'));
      expect(span[3]).toEqual(new Date('2026-02-02T00:00:00'));
    });
  });
  
  describe('calculateDayDifference', () => {
    it('should calculate difference between same day', () => {
      const date1 = new Date('2026-01-15T09:00:00');
      const date2 = new Date('2026-01-15T17:00:00');
      
      expect(calculateDayDifference(date1, date2)).toBe(0);
    });
    
    it('should calculate difference between consecutive days', () => {
      const date1 = new Date('2026-01-15');
      const date2 = new Date('2026-01-16');
      
      expect(calculateDayDifference(date1, date2)).toBe(1);
    });
    
    it('should calculate difference across multiple days', () => {
      const date1 = new Date('2026-01-15');
      const date2 = new Date('2026-01-20');
      
      expect(calculateDayDifference(date1, date2)).toBe(5);
    });
    
    it('should handle reversed dates (absolute difference)', () => {
      const date1 = new Date('2026-01-20');
      const date2 = new Date('2026-01-15');
      
      expect(calculateDayDifference(date1, date2)).toBe(5);
    });
    
    it('should calculate difference across month boundary', () => {
      const date1 = new Date('2026-01-28');
      const date2 = new Date('2026-02-03');
      
      expect(calculateDayDifference(date1, date2)).toBe(6);
    });
    
    it('should calculate difference across year boundary', () => {
      const date1 = new Date('2025-12-28');
      const date2 = new Date('2026-01-03');
      
      expect(calculateDayDifference(date1, date2)).toBe(6);
    });
    
    it('should handle leap year correctly', () => {
      const date1 = new Date('2024-02-28');
      const date2 = new Date('2024-03-01');
      
      expect(calculateDayDifference(date1, date2)).toBe(2); // Includes Feb 29
    });
  });
});
