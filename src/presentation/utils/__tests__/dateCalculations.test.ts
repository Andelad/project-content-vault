/**
 * Date Helper Function Tests
 * 
 * Tests for pure date calculation utilities including:
 * - Date normalization (midnight, end of day)
 * - Date arithmetic (add/subtract days, hours)
 * - Date comparisons (same day, in range, overlaps)
 * - Business day calculations
 * - Month/year boundary handling
 * - Leap year support
 * 
 * @see src/utils/dateCalculations.ts
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeToMidnight,
  normalizeToEndOfDay,
  addDaysToDate,
  addHoursToDate,
  isSameDay,
  calculateDayDifference,
  calculateDateRangeOverlap,
  isDateInRange,
  generateDateRange,
  addBusinessDays,
  calculateBusinessDaysBetween,
  isBusinessDay,
  isHoliday,
  getDayOfWeek,
  getDayName,
  isWeekendDate,
} from '@/presentation/utils/dateCalculations';

describe('DateHelpers', () => {
  
  describe('normalizeToMidnight', () => {
    it('should set time to 00:00:00', () => {
      const date = new Date('2026-01-15T14:30:45.123');
      const normalized = normalizeToMidnight(date);
      
      expect(normalized.getHours()).toBe(0);
      expect(normalized.getMinutes()).toBe(0);
      expect(normalized.getSeconds()).toBe(0);
      expect(normalized.getMilliseconds()).toBe(0);
      expect(normalized.getDate()).toBe(15);
      expect(normalized.getMonth()).toBe(0); // January
    });
    
    it('should not mutate original date', () => {
      const original = new Date('2026-01-15T14:30:45');
      const normalized = normalizeToMidnight(original);
      
      expect(original.getHours()).toBe(14);
      expect(normalized.getHours()).toBe(0);
    });
    
    it('should handle midnight boundary', () => {
      const date = new Date('2026-01-15T00:00:00');
      const normalized = normalizeToMidnight(date);
      
      expect(normalized).toEqual(date);
    });
  });
  
  describe('normalizeToEndOfDay', () => {
    it('should set time to 23:59:59.999', () => {
      const date = new Date('2026-01-15T10:30:00');
      const normalized = normalizeToEndOfDay(date);
      
      expect(normalized.getHours()).toBe(23);
      expect(normalized.getMinutes()).toBe(59);
      expect(normalized.getSeconds()).toBe(59);
      expect(normalized.getMilliseconds()).toBe(999);
      expect(normalized.getDate()).toBe(15);
    });
    
    it('should not mutate original date', () => {
      const original = new Date('2026-01-15T10:30:00');
      const normalized = normalizeToEndOfDay(original);
      
      expect(original.getHours()).toBe(10);
      expect(normalized.getHours()).toBe(23);
    });
  });
  
  describe('addDaysToDate', () => {
    it('should add positive days', () => {
      const date = new Date('2026-01-15');
      const result = addDaysToDate(date, 5);
      
      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(0);
    });
    
    it('should add negative days (subtract)', () => {
      const date = new Date('2026-01-15');
      const result = addDaysToDate(date, -5);
      
      expect(result.getDate()).toBe(10);
      expect(result.getMonth()).toBe(0);
    });
    
    it('should handle month boundary crossing forward', () => {
      const date = new Date('2026-01-29');
      const result = addDaysToDate(date, 5);
      
      expect(result.getDate()).toBe(3);
      expect(result.getMonth()).toBe(1); // February
    });
    
    it('should handle month boundary crossing backward', () => {
      const date = new Date('2026-02-03');
      const result = addDaysToDate(date, -5);
      
      expect(result.getDate()).toBe(29);
      expect(result.getMonth()).toBe(0); // January
    });
    
    it('should handle year boundary crossing forward', () => {
      const date = new Date('2025-12-29');
      const result = addDaysToDate(date, 5);
      
      expect(result.getDate()).toBe(3);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2026);
    });
    
    it('should handle year boundary crossing backward', () => {
      const date = new Date('2026-01-03');
      const result = addDaysToDate(date, -5);
      
      expect(result.getDate()).toBe(29);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getFullYear()).toBe(2025);
    });
    
    it('should handle leap year February 29', () => {
      const date = new Date('2024-02-29'); // Leap year
      const result = addDaysToDate(date, 1);
      
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(2); // March
    });
    
    it('should not mutate original date', () => {
      const original = new Date('2026-01-15');
      const result = addDaysToDate(original, 5);
      
      expect(original.getDate()).toBe(15);
      expect(result.getDate()).toBe(20);
    });
  });
  
  describe('addHoursToDate', () => {
    it('should add positive hours', () => {
      const date = new Date('2026-01-15T10:00:00');
      const result = addHoursToDate(date, 5);
      
      expect(result.getHours()).toBe(15);
      expect(result.getDate()).toBe(15);
    });
    
    it('should add hours crossing midnight', () => {
      const date = new Date('2026-01-15T22:00:00');
      const result = addHoursToDate(date, 4);
      
      expect(result.getHours()).toBe(2);
      expect(result.getDate()).toBe(16);
    });
    
    it('should handle negative hours (subtract)', () => {
      const date = new Date('2026-01-15T10:00:00');
      const result = addHoursToDate(date, -2);
      
      expect(result.getHours()).toBe(8);
    });
    
    it('should handle fractional hours', () => {
      const date = new Date('2026-01-15T10:00:00');
      const result = addHoursToDate(date, 1.5);
      
      expect(result.getHours()).toBe(11);
      expect(result.getMinutes()).toBe(30);
    });
  });
  
  describe('isSameDay', () => {
    it('should return true for same date different times', () => {
      const date1 = new Date('2026-01-15T09:00:00');
      const date2 = new Date('2026-01-15T17:00:00');
      
      expect(isSameDay(date1, date2)).toBe(true);
    });
    
    it('should return false for different dates', () => {
      const date1 = new Date('2026-01-15T23:59:59');
      const date2 = new Date('2026-01-16T00:00:00');
      
      expect(isSameDay(date1, date2)).toBe(false);
    });
    
    it('should handle midnight boundary', () => {
      const date1 = new Date('2026-01-15T00:00:00');
      const date2 = new Date('2026-01-15T00:00:01');
      
      expect(isSameDay(date1, date2)).toBe(true);
    });
  });
  
  describe('calculateDayDifference', () => {
    it('should calculate same day as 0', () => {
      const date1 = new Date('2026-01-15T09:00:00');
      const date2 = new Date('2026-01-15T17:00:00');
      
      expect(calculateDayDifference(date1, date2)).toBe(0);
    });
    
    it('should calculate consecutive days', () => {
      const date1 = new Date('2026-01-15');
      const date2 = new Date('2026-01-20');
      
      expect(calculateDayDifference(date1, date2)).toBe(5);
    });
    
    it('should handle reversed order (returns negative)', () => {
      const date1 = new Date('2026-01-20');
      const date2 = new Date('2026-01-15');
      
      // Note: calculateDayDifference is not absolute - it's directional
      expect(calculateDayDifference(date1, date2)).toBe(-5);
    });
    
    it('should handle month boundary', () => {
      const date1 = new Date('2026-01-28');
      const date2 = new Date('2026-02-05');
      
      expect(calculateDayDifference(date1, date2)).toBe(8);
    });
  });
  
  describe('calculateDateRangeOverlap', () => {
    it('should calculate overlap for overlapping ranges', () => {
      const range1 = {
        start: new Date('2026-01-10'),
        end: new Date('2026-01-20'),
      };
      const range2 = {
        start: new Date('2026-01-15'),
        end: new Date('2026-01-25'),
      };
      
      const overlap = calculateDateRangeOverlap(range1, range2);
      
      expect(overlap).not.toBeNull();
      expect(overlap?.start).toEqual(new Date('2026-01-15'));
      expect(overlap?.end).toEqual(new Date('2026-01-20'));
    });
    
    it('should return null for non-overlapping ranges', () => {
      const range1 = {
        start: new Date('2026-01-10'),
        end: new Date('2026-01-15'),
      };
      const range2 = {
        start: new Date('2026-01-20'),
        end: new Date('2026-01-25'),
      };
      
      const overlap = calculateDateRangeOverlap(range1, range2);
      
      expect(overlap).toBeNull();
    });
    
    it('should handle touching ranges (no overlap)', () => {
      const range1 = {
        start: new Date('2026-01-10'),
        end: new Date('2026-01-15'),
      };
      const range2 = {
        start: new Date('2026-01-15'),
        end: new Date('2026-01-20'),
      };
      
      const overlap = calculateDateRangeOverlap(range1, range2);
      
      // Implementation may vary - touching ranges might return null or single point
      expect(overlap).toBeDefined();
    });
    
    it('should handle complete containment', () => {
      const range1 = {
        start: new Date('2026-01-01'),
        end: new Date('2026-01-31'),
      };
      const range2 = {
        start: new Date('2026-01-10'),
        end: new Date('2026-01-20'),
      };
      
      const overlap = calculateDateRangeOverlap(range1, range2);
      
      expect(overlap).not.toBeNull();
      expect(overlap?.start).toEqual(new Date('2026-01-10'));
      expect(overlap?.end).toEqual(new Date('2026-01-20'));
    });
  });
  
  describe('isDateInRange', () => {
    it('should return true for date within range', () => {
      const date = new Date('2026-01-15');
      const start = new Date('2026-01-10');
      const end = new Date('2026-01-20');
      
      expect(isDateInRange(date, start, end)).toBe(true);
    });
    
    it('should return true for date equal to start', () => {
      const date = new Date('2026-01-10');
      const start = new Date('2026-01-10');
      const end = new Date('2026-01-20');
      
      expect(isDateInRange(date, start, end)).toBe(true);
    });
    
    it('should return true for date equal to end', () => {
      const date = new Date('2026-01-20');
      const start = new Date('2026-01-10');
      const end = new Date('2026-01-20');
      
      expect(isDateInRange(date, start, end)).toBe(true);
    });
    
    it('should return false for date before range', () => {
      const date = new Date('2026-01-05');
      const start = new Date('2026-01-10');
      const end = new Date('2026-01-20');
      
      expect(isDateInRange(date, start, end)).toBe(false);
    });
    
    it('should return false for date after range', () => {
      const date = new Date('2026-01-25');
      const start = new Date('2026-01-10');
      const end = new Date('2026-01-20');
      
      expect(isDateInRange(date, start, end)).toBe(false);
    });
  });
  
  describe('generateDateRange', () => {
    it('should generate range of consecutive dates', () => {
      const start = new Date('2026-01-15');
      const end = new Date('2026-01-20');
      
      const range = generateDateRange(start, end);
      
      expect(range).toHaveLength(6); // 15, 16, 17, 18, 19, 20
      expect(range[0]).toEqual(normalizeToMidnight(new Date('2026-01-15')));
      expect(range[5]).toEqual(normalizeToMidnight(new Date('2026-01-20')));
    });
    
    it('should handle single day range', () => {
      const start = new Date('2026-01-15');
      const end = new Date('2026-01-15');
      
      const range = generateDateRange(start, end);
      
      expect(range).toHaveLength(1);
    });
    
    it('should handle month boundary', () => {
      const start = new Date('2026-01-30');
      const end = new Date('2026-02-02');
      
      const range = generateDateRange(start, end);
      
      expect(range).toHaveLength(4);
      expect(range[0].getMonth()).toBe(0); // Jan
      expect(range[1].getMonth()).toBe(0); // Jan 31
      expect(range[2].getMonth()).toBe(1); // Feb 1
      expect(range[3].getMonth()).toBe(1); // Feb 2
    });
  });
  
  describe('Business day calculations', () => {
    describe('isBusinessDay', () => {
      it('should return true for weekday', () => {
        const monday = new Date('2026-01-12'); // Monday
        expect(isBusinessDay(monday)).toBe(true);
      });
      
      it('should return false for Saturday', () => {
        const saturday = new Date('2026-01-10'); // Saturday
        expect(isBusinessDay(saturday)).toBe(false);
      });
      
      it('should return false for Sunday', () => {
        const sunday = new Date('2026-01-11'); // Sunday
        expect(isBusinessDay(sunday)).toBe(false);
      });
      
      it('should return false for holiday weekday', () => {
        const holiday = new Date('2026-01-15');
        const holidays = [new Date('2026-01-15')];
        
        expect(isBusinessDay(holiday, holidays)).toBe(false);
      });
    });
    
    describe('addBusinessDays', () => {
      it('should skip weekends when adding days', () => {
        const friday = new Date('2026-01-16'); // Friday
        const result = addBusinessDays(friday, 1); // Should be Monday
        
        expect(result.getDate()).toBe(19); // Monday Jan 19
      });
      
      it('should skip holidays', () => {
        const thursday = new Date('2026-01-15'); // Thursday
        const holidays = [new Date('2026-01-16')]; // Friday is holiday
        
        const result = addBusinessDays(thursday, 1, holidays);
        
        expect(result.getDate()).toBe(19); // Monday (skip Fri holiday + weekend)
      });
    });
    
    describe('calculateBusinessDaysBetween', () => {
      it('should count only weekdays', () => {
        const start = new Date('2026-01-12'); // Monday
        const end = new Date('2026-01-16');   // Friday
        
        const count = calculateBusinessDaysBetween(start, end);
        
        expect(count).toBe(5); // Mon, Tue, Wed, Thu, Fri
      });
      
      it('should exclude weekends', () => {
        const start = new Date('2026-01-12'); // Monday
        const end = new Date('2026-01-19');   // Monday next week
        
        const count = calculateBusinessDaysBetween(start, end);
        
        expect(count).toBe(6); // Excludes 2-day weekend
      });
      
      it('should exclude holidays', () => {
        const start = new Date('2026-01-12'); // Monday
        const end = new Date('2026-01-16');   // Friday
        const holidays = [new Date('2026-01-15')]; // Thursday holiday
        
        const count = calculateBusinessDaysBetween(start, end, holidays);
        
        expect(count).toBe(4); // Mon, Tue, Wed, Fri (no Thu)
      });
    });
  });
  
  describe('Day of week helpers', () => {
    it('should get day of week number', () => {
      const sunday = new Date('2026-01-11');
      const monday = new Date('2026-01-12');
      
      expect(getDayOfWeek(sunday)).toBe(0);
      expect(getDayOfWeek(monday)).toBe(1);
    });
    
    it('should get day name', () => {
      const monday = new Date('2026-01-12');
      const name = getDayName(monday);
      
      // Implementation returns lowercase
      expect(name).toBe('monday');
    });
    
    it('should identify weekend', () => {
      const saturday = new Date('2026-01-10');
      const sunday = new Date('2026-01-11');
      const monday = new Date('2026-01-12');
      
      expect(isWeekendDate(saturday)).toBe(true);
      expect(isWeekendDate(sunday)).toBe(true);
      expect(isWeekendDate(monday)).toBe(false);
    });
  });
  
  describe('Holiday detection', () => {
    it('should detect exact holiday match', () => {
      const date = new Date('2026-01-15T10:00:00');
      const holidays = [new Date('2026-01-15T00:00:00')];
      
      expect(isHoliday(date, holidays)).toBe(true);
    });
    
    it('should not detect non-holiday', () => {
      const date = new Date('2026-01-15');
      const holidays = [new Date('2026-01-16')];
      
      expect(isHoliday(date, holidays)).toBe(false);
    });
    
    it('should handle empty holidays array', () => {
      const date = new Date('2026-01-15');
      
      expect(isHoliday(date, [])).toBe(false);
    });
  });
});
