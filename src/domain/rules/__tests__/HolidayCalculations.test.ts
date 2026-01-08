/**
 * Holiday Calculations Tests
 * 
 * Tests for holiday-related business logic including:
 * - Holiday detection within date ranges
 * - Working day calculations (excluding holidays)
 * - Holiday validation
 * - Holiday overlap detection
 * 
 * @see src/domain/rules/holidays/HolidayCalculations.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getHolidayForDate,
  getHolidaysInRangeDetailed,
  countHolidayDaysInRange,
  calculateWorkingDays,
  isWeekend,
  isWorkingDay,
  validateHolidayPlacement,
  type Holiday,
} from '@/domain/rules/holidays/HolidayCalculations';

describe('HolidayCalculations', () => {
  
  // Test data factory
  const createHoliday = (overrides: Partial<Holiday> = {}): Holiday => ({
    id: 'holiday-1',
    name: 'Test Holiday',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-01-15'),
    ...overrides,
  });
  
  describe('getHolidayForDate', () => {
    it('should find holiday on exact date', () => {
      const holidays = [
        createHoliday({
          name: 'New Year',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-01'),
        }),
      ];
      
      const result = getHolidayForDate(new Date('2026-01-01'), holidays);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe('New Year');
    });
    
    it('should find holiday within multi-day range', () => {
      const holidays = [
        createHoliday({
          name: 'Christmas Break',
          startDate: new Date('2026-12-24'),
          endDate: new Date('2026-12-26'),
        }),
      ];
      
      const result = getHolidayForDate(new Date('2026-12-25'), holidays);
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Christmas Break');
    });
    
    it('should return null for non-holiday date', () => {
      const holidays = [
        createHoliday({
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-01'),
        }),
      ];
      
      const result = getHolidayForDate(new Date('2026-01-15'), holidays);
      
      expect(result).toBeNull();
    });
    
    it('should handle empty holidays array', () => {
      const result = getHolidayForDate(new Date('2026-01-15'), []);
      
      expect(result).toBeNull();
    });
  });
  
  describe('getHolidaysInRangeDetailed', () => {
    it('should find all holidays in range', () => {
      const holidays = [
        createHoliday({
          id: 'h1',
          name: 'New Year',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-01'),
        }),
        createHoliday({
          id: 'h2',
          name: 'Mid-month',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-15'),
        }),
        createHoliday({
          id: 'h3',
          name: 'End of month',
          startDate: new Date('2026-01-31'),
          endDate: new Date('2026-01-31'),
        }),
      ];
      
      const result = getHolidaysInRangeDetailed(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        holidays
      );
      
      expect(result).toHaveLength(3);
    });
    
    it('should exclude holidays outside range', () => {
      const holidays = [
        createHoliday({
          name: 'Before range',
          startDate: new Date('2025-12-25'),
          endDate: new Date('2025-12-25'),
        }),
        createHoliday({
          name: 'In range',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-15'),
        }),
        createHoliday({
          name: 'After range',
          startDate: new Date('2026-02-15'),
          endDate: new Date('2026-02-15'),
        }),
      ];
      
      const result = getHolidaysInRangeDetailed(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        holidays
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('In range');
    });
    
    it('should handle multi-day holidays spanning range boundary', () => {
      const holidays = [
        createHoliday({
          name: 'Spanning holiday',
          startDate: new Date('2026-01-29'),
          endDate: new Date('2026-02-02'),
        }),
      ];
      
      const result = getHolidaysInRangeDetailed(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        holidays
      );
      
      expect(result.length).toBeGreaterThan(0);
    });
  });
  
  describe('countHolidayDaysInRange', () => {
    it('should count single-day holiday', () => {
      const holidays = [
        createHoliday({
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-15'),
        }),
      ];
      
      const count = countHolidayDaysInRange(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        holidays
      );
      
      expect(count).toBe(1);
    });
    
    it('should count multi-day holiday', () => {
      const holidays = [
        createHoliday({
          name: 'Christmas Break',
          startDate: new Date('2026-12-24'),
          endDate: new Date('2026-12-26'),
        }),
      ];
      
      const count = countHolidayDaysInRange(
        new Date('2026-12-01'),
        new Date('2026-12-31'),
        holidays
      );
      
      expect(count).toBe(3); // Dec 24, 25, 26
    });
    
    it('should count multiple holidays', () => {
      const holidays = [
        createHoliday({
          id: 'h1',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-01'),
        }),
        createHoliday({
          id: 'h2',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-16'),
        }),
      ];
      
      const count = countHolidayDaysInRange(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        holidays
      );
      
      expect(count).toBe(3); // Jan 1, 15, 16
    });
    
    it('should return 0 for range with no holidays', () => {
      const holidays = [
        createHoliday({
          startDate: new Date('2026-02-15'),
          endDate: new Date('2026-02-15'),
        }),
      ];
      
      const count = countHolidayDaysInRange(
        new Date('2026-01-01'),
        new Date('2026-01-31'),
        holidays
      );
      
      expect(count).toBe(0);
    });
  });
  
  describe('calculateWorkingDays', () => {
    it('should count weekdays excluding holidays', () => {
      const holidays = [
        createHoliday({
          startDate: new Date('2026-01-15'), // Thursday
          endDate: new Date('2026-01-15'),
        }),
      ];
      
      // Jan 12 (Mon) to Jan 16 (Fri) = 5 weekdays - 1 holiday = 4 working days
      const count = calculateWorkingDays(
        new Date('2026-01-12'),
        new Date('2026-01-16'),
        holidays
      );
      
      expect(count).toBe(4);
    });
    
    it('should exclude weekends automatically', () => {
      const holidays: Holiday[] = [];
      
      // Jan 12 (Mon) to Jan 18 (Sun) = 5 weekdays (excludes Sat 17, Sun 18)
      const count = calculateWorkingDays(
        new Date('2026-01-12'),
        new Date('2026-01-18'),
        holidays
      );
      
      expect(count).toBe(5);
    });
    
    it('should handle month spanning range', () => {
      const holidays: Holiday[] = [];
      
      // Jan 26 (Mon) to Feb 6 (Fri) = 10 weekdays
      const count = calculateWorkingDays(
        new Date('2026-01-26'),
        new Date('2026-02-06'),
        holidays
      );
      
      expect(count).toBe(10);
    });
    
    it('should return 0 for all-holiday range', () => {
      const holidays = [
        createHoliday({
          startDate: new Date('2026-01-12'),
          endDate: new Date('2026-01-16'),
        }),
      ];
      
      const count = calculateWorkingDays(
        new Date('2026-01-12'),
        new Date('2026-01-16'),
        holidays
      );
      
      expect(count).toBe(0);
    });
  });
  
  describe('isWeekend', () => {
    it('should return true for Saturday', () => {
      const saturday = new Date('2026-01-10'); // Saturday
      expect(isWeekend(saturday)).toBe(true);
    });
    
    it('should return true for Sunday', () => {
      const sunday = new Date('2026-01-11'); // Sunday
      expect(isWeekend(sunday)).toBe(true);
    });
    
    it('should return false for weekdays', () => {
      const monday = new Date('2026-01-12');
      const wednesday = new Date('2026-01-14');
      const friday = new Date('2026-01-16');
      
      expect(isWeekend(monday)).toBe(false);
      expect(isWeekend(wednesday)).toBe(false);
      expect(isWeekend(friday)).toBe(false);
    });
  });
  
  describe('isWorkingDay', () => {
    it('should return true for weekday non-holiday', () => {
      const monday = new Date('2026-01-12');
      const holidays: Holiday[] = [];
      
      expect(isWorkingDay(monday, holidays)).toBe(true);
    });
    
    it('should return false for weekend', () => {
      const saturday = new Date('2026-01-10');
      const holidays: Holiday[] = [];
      
      expect(isWorkingDay(saturday, holidays)).toBe(false);
    });
    
    it('should return false for weekday holiday', () => {
      const thursday = new Date('2026-01-15');
      const holidays = [
        createHoliday({
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-15'),
        }),
      ];
      
      expect(isWorkingDay(thursday, holidays)).toBe(false);
    });
  });
  
  describe('validateHolidayPlacement', () => {
    it('should accept valid holiday', () => {
      const holiday = {
        name: 'Valid Holiday',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-01-15'),
      };
      
      const result = validateHolidayPlacement(holiday);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject holiday with missing name', () => {
      const holiday = {
        name: '',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-01-15'),
      };
      
      const result = validateHolidayPlacement(holiday);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Holiday name is required');
    });
    
    it('should reject holiday with end before start', () => {
      const holiday = {
        name: 'Invalid Holiday',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-01-15'),
      };
      
      const result = validateHolidayPlacement(holiday);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before or equal to end date');
    });
    
    it('should warn about unreasonably long holiday', () => {
      const holiday = {
        name: 'Long Holiday',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-06-01'), // 17 months
      };
      
      const result = validateHolidayPlacement(holiday);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('exceeds 1 year');
    });
    
    it('should detect overlapping holidays', () => {
      const holiday = {
        name: 'New Holiday',
        startDate: new Date('2026-01-14'),
        endDate: new Date('2026-01-16'),
      };
      
      const existing = [
        createHoliday({
          name: 'Existing Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-17'),
        }),
      ];
      
      const result = validateHolidayPlacement(holiday, existing);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('overlaps');
    });
    
    it('should allow adjacent holidays (not overlapping)', () => {
      const holiday = {
        name: 'New Holiday',
        startDate: new Date('2026-01-13'),
        endDate: new Date('2026-01-14'),
      };
      
      const existing = [
        createHoliday({
          name: 'Existing Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-16'),
        }),
      ];
      
      const result = validateHolidayPlacement(holiday, existing);
      
      expect(result.isValid).toBe(true);
      const overlapWarnings = result.warnings.filter(w => w.includes('overlaps'));
      expect(overlapWarnings).toHaveLength(0);
    });
  });
});
