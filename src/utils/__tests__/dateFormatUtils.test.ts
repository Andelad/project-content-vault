/**
 * Date Formatting Utility Tests
 * 
 * Tests for centralized date formatting functions
 * 
 * @see src/utils/dateFormatUtils.ts
 */

import { describe, it, expect } from 'vitest';
import {
  APP_LOCALE,
  formatDate,
  formatDateForInput,
  formatDateShort,
  formatDateLong,
  formatDateWithYear,
  formatMonthYear,
  formatMonthLongYear,
  formatWeekdayDate,
  formatMonth,
  formatMonthLong,
  formatDay,
  formatDateRange,
  formatProjectDateRange,
  formatChartDate,
  formatTooltipDate,
  isSameDate,
  getDateKey,
  formatTimeRange,
  formatWeekRange,
  getDayName,
  getOrdinalNumber,
  getWeekOfMonthName,
} from '../dateFormatUtils';

describe('dateFormatUtils', () => {
  
  describe('Locale setting', () => {
    it('should use en-GB locale', () => {
      expect(APP_LOCALE).toBe('en-GB');
    });
  });

  describe('Basic date formatting', () => {
    it('should format date as short month and day', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024
      expect(formatDate(date)).toBe('15 Jan');
    });

    it('should format date for input (YYYY-MM-DD)', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024
      expect(formatDateForInput(date)).toBe('2024-01-15');
    });

    it('should pad single-digit months and days in input format', () => {
      const date = new Date(2024, 0, 5); // Jan 5, 2024
      expect(formatDateForInput(date)).toBe('2024-01-05');
    });

    it('should format date short (same as formatDate)', () => {
      const date = new Date(2024, 0, 15);
      expect(formatDateShort(date)).toBe('15 Jan');
    });

    it('should format date long with weekday', () => {
      const date = new Date(2024, 0, 15); // Monday, Jan 15, 2024
      expect(formatDateLong(date)).toBe('Monday, 15 January 2024');
    });

    it('should format date with year', () => {
      const date = new Date(2024, 0, 15);
      expect(formatDateWithYear(date)).toBe('15 Jan 2024');
    });
  });

  describe('Month formatting', () => {
    it('should format month and year short', () => {
      const date = new Date(2024, 0, 15);
      expect(formatMonthYear(date)).toBe('Jan 2024');
    });

    it('should format month and year long', () => {
      const date = new Date(2024, 0, 15);
      expect(formatMonthLongYear(date)).toBe('January 2024');
    });

    it('should format month short', () => {
      const date = new Date(2024, 0, 15);
      expect(formatMonth(date)).toBe('Jan');
    });

    it('should format month long', () => {
      const date = new Date(2024, 0, 15);
      expect(formatMonthLong(date)).toBe('January');
    });

    it('should format different months correctly', () => {
      const months = [
        { date: new Date(2024, 0, 1), short: 'Jan', long: 'January' },
        { date: new Date(2024, 5, 1), short: 'Jun', long: 'June' },
        { date: new Date(2024, 11, 1), short: 'Dec', long: 'December' },
      ];

      months.forEach(({ date, short, long }) => {
        expect(formatMonth(date)).toBe(short);
        expect(formatMonthLong(date)).toBe(long);
      });
    });
  });

  describe('Day and weekday formatting', () => {
    it('should format day only', () => {
      const date = new Date(2024, 0, 15);
      expect(formatDay(date)).toBe('15');
    });

    it('should format single-digit days correctly', () => {
      const date = new Date(2024, 0, 5);
      expect(formatDay(date)).toBe('5');
    });

    it('should format weekday with date', () => {
      const date = new Date(2024, 0, 15); // Monday
      expect(formatWeekdayDate(date)).toBe('Mon 15 Jan');
    });
  });

  describe('Date range formatting', () => {
    it('should format date range', () => {
      const start = new Date(2024, 0, 15);
      const end = new Date(2024, 0, 20);
      expect(formatDateRange(start, end)).toBe('15 Jan - 20 Jan 2024');
    });

    it('should format date range across months', () => {
      const start = new Date(2024, 0, 28);
      const end = new Date(2024, 1, 3);
      expect(formatDateRange(start, end)).toBe('28 Jan - 3 Feb 2024');
    });

    it('should format date range across years', () => {
      const start = new Date(2023, 11, 28);
      const end = new Date(2024, 0, 5);
      expect(formatDateRange(start, end)).toBe('28 Dec - 5 Jan 2024');
    });
  });

  describe('Project date range formatting', () => {
    it('should format project date range in same month', () => {
      const start = new Date(2024, 0, 15);
      const end = new Date(2024, 0, 20);
      expect(formatProjectDateRange(start, end)).toBe('15 Jan - 20 Jan');
    });

    it('should format project date range across months in same year', () => {
      const start = new Date(2024, 0, 28);
      const end = new Date(2024, 1, 3);
      expect(formatProjectDateRange(start, end)).toBe('28 Jan - 3 Feb');
    });

    it('should format project date range across years', () => {
      const start = new Date(2023, 11, 28);
      const end = new Date(2024, 0, 5);
      expect(formatProjectDateRange(start, end)).toBe('28 Dec - 5 Jan 2024');
    });

    it('should format continuous project as ongoing', () => {
      const start = new Date(2024, 0, 15);
      const end = new Date(2024, 11, 31);
      expect(formatProjectDateRange(start, end, true)).toBe('15 Jan - ongoing');
    });
  });

  describe('Chart and tooltip formatting', () => {
    it('should format chart date with short year', () => {
      const date = new Date(2024, 0, 15);
      expect(formatChartDate(date)).toBe('Jan 24');
    });

    it('should format tooltip date with weekday', () => {
      const date = new Date(2024, 0, 15); // Monday
      expect(formatTooltipDate(date)).toBe('Mon 15 Jan');
    });
  });

  describe('Date comparison', () => {
    it('should detect same dates', () => {
      const date1 = new Date(2024, 0, 15, 10, 30);
      const date2 = new Date(2024, 0, 15, 14, 45);
      expect(isSameDate(date1, date2)).toBe(true);
    });

    it('should detect different dates', () => {
      const date1 = new Date(2024, 0, 15);
      const date2 = new Date(2024, 0, 16);
      expect(isSameDate(date1, date2)).toBe(false);
    });

    it('should detect different dates across months', () => {
      const date1 = new Date(2024, 0, 31);
      const date2 = new Date(2024, 1, 1);
      expect(isSameDate(date1, date2)).toBe(false);
    });
  });

  describe('Date key utilities (timezone-safe)', () => {
    it('should create date key in YYYY-MM-DD format', () => {
      const date = new Date(2024, 0, 15);
      expect(getDateKey(date)).toBe('2024-01-15');
    });

    it('should pad single-digit months', () => {
      const date = new Date(2024, 0, 5);
      expect(getDateKey(date)).toBe('2024-01-05');
    });

    it('should pad single-digit days', () => {
      const date = new Date(2024, 9, 5);
      expect(getDateKey(date)).toBe('2024-10-05');
    });

    it('should be timezone-safe (not shift dates)', () => {
      // Test at different times of day
      const morning = new Date(2024, 0, 15, 2, 0);
      const evening = new Date(2024, 0, 15, 23, 0);
      expect(getDateKey(morning)).toBe('2024-01-15');
      expect(getDateKey(evening)).toBe('2024-01-15');
    });

    it('should handle year boundaries correctly', () => {
      const newYearsEve = new Date(2023, 11, 31, 23, 59);
      const newYearsDay = new Date(2024, 0, 1, 0, 1);
      expect(getDateKey(newYearsEve)).toBe('2023-12-31');
      expect(getDateKey(newYearsDay)).toBe('2024-01-01');
    });
  });

  describe('Time range formatting', () => {
    it('should format time range', () => {
      const start = new Date(2024, 0, 15);
      const end = new Date(2024, 0, 20);
      expect(formatTimeRange(start, end)).toBe('15 Jan - 20 Jan');
    });

    it('should format time range across months', () => {
      const start = new Date(2024, 0, 28);
      const end = new Date(2024, 1, 3);
      expect(formatTimeRange(start, end)).toBe('28 Jan - 3 Feb');
    });
  });

  describe('Week range formatting', () => {
    it('should format week range within same month', () => {
      const weekStart = new Date(2024, 0, 8); // Monday, Jan 8
      expect(formatWeekRange(weekStart)).toBe('8 - 14 Jan');
    });

    it('should format week range across months', () => {
      const weekStart = new Date(2024, 0, 29); // Monday, Jan 29
      // Week ends on Feb 4
      expect(formatWeekRange(weekStart)).toBe('29 Jan - 4 Feb');
    });

    it('should format week range across years', () => {
      const weekStart = new Date(2023, 11, 28); // Thursday, Dec 28
      // Week ends on Jan 3
      expect(formatWeekRange(weekStart)).toBe('28 Dec - 3 Jan');
    });

    it('should handle week starting on 1st', () => {
      const weekStart = new Date(2024, 1, 1); // Thursday, Feb 1
      expect(formatWeekRange(weekStart)).toBe('1 - 7 Feb');
    });
  });

  describe('Day name utilities', () => {
    it('should convert day numbers to names', () => {
      expect(getDayName(0)).toBe('Sunday');
      expect(getDayName(1)).toBe('Monday');
      expect(getDayName(2)).toBe('Tuesday');
      expect(getDayName(3)).toBe('Wednesday');
      expect(getDayName(4)).toBe('Thursday');
      expect(getDayName(5)).toBe('Friday');
      expect(getDayName(6)).toBe('Saturday');
    });

    it('should default to Sunday for invalid day numbers', () => {
      expect(getDayName(-1)).toBe('Sunday');
      expect(getDayName(7)).toBe('Sunday');
      expect(getDayName(100)).toBe('Sunday');
    });
  });

  describe('Ordinal number formatting', () => {
    it('should format ordinal numbers correctly', () => {
      expect(getOrdinalNumber(1)).toBe('1st');
      expect(getOrdinalNumber(2)).toBe('2nd');
      expect(getOrdinalNumber(3)).toBe('3rd');
      expect(getOrdinalNumber(4)).toBe('4th');
      expect(getOrdinalNumber(5)).toBe('5th');
    });

    it('should handle teen numbers correctly', () => {
      expect(getOrdinalNumber(11)).toBe('11th');
      expect(getOrdinalNumber(12)).toBe('12th');
      expect(getOrdinalNumber(13)).toBe('13th');
    });

    it('should handle 20s correctly', () => {
      expect(getOrdinalNumber(21)).toBe('21st');
      expect(getOrdinalNumber(22)).toBe('22nd');
      expect(getOrdinalNumber(23)).toBe('23rd');
      expect(getOrdinalNumber(24)).toBe('24th');
    });

    it('should handle 30s correctly', () => {
      expect(getOrdinalNumber(31)).toBe('31st');
      expect(getOrdinalNumber(32)).toBe('32nd');
      expect(getOrdinalNumber(33)).toBe('33rd');
    });

    it('should handle 100s correctly', () => {
      expect(getOrdinalNumber(101)).toBe('101st');
      expect(getOrdinalNumber(111)).toBe('111th');
      expect(getOrdinalNumber(121)).toBe('121st');
    });
  });

  describe('Week of month name formatting', () => {
    it('should format week of month names', () => {
      expect(getWeekOfMonthName(1)).toBe('1st');
      expect(getWeekOfMonthName(2)).toBe('2nd');
      expect(getWeekOfMonthName(3)).toBe('3rd');
      expect(getWeekOfMonthName(4)).toBe('4th');
    });

    it('should handle special week names', () => {
      expect(getWeekOfMonthName(5)).toBe('2nd last');
      expect(getWeekOfMonthName(6)).toBe('last');
    });

    it('should default to last for invalid week numbers', () => {
      expect(getWeekOfMonthName(0)).toBe('last');
      expect(getWeekOfMonthName(7)).toBe('last');
      expect(getWeekOfMonthName(100)).toBe('last');
    });
  });
});
