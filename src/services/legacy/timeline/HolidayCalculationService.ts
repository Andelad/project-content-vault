/**
 * Holiday Calculation Service
 * Handles holiday-related calculations and utilities for timeline components
 *
 * @deprecated This service has been migrated to calculations/holidayCalculations.ts
 * Use the new functions directly from @/services:
 * - expandHolidayDatesDetailed
 * - getHolidayForDate
 * - getHolidaysInRangeDetailed
 * - countHolidayDaysInRange
 */

import {
  expandHolidayDatesDetailed,
  getHolidayForDate as getHolidayForDateNew,
  getHolidaysInRangeDetailed,
  countHolidayDaysInRange as countHolidayDaysInRangeNew
} from '../../calculations/holidayCalculations';

export interface Holiday {
  id: string;
  title?: string;
  name?: string;
  startDate: string | Date;
  endDate: string | Date;
  [key: string]: any;
}

export interface HolidayDate {
  date: Date;
  name: string;
  holidayId: string;
}

/**
 * Service for holiday-related calculations and utilities
 * @deprecated Use functions from calculations/holidayCalculations instead
 */
export class HolidayCalculationService {
  /**
   * Expands holiday date ranges into individual Date objects for fast lookup
   * @deprecated Use expandHolidayDatesDetailed from @/services instead
   */
  static expandHolidayDates(holidays: Holiday[]): HolidayDate[] {
    console.warn('HolidayCalculationService.expandHolidayDates is deprecated. Use expandHolidayDatesDetailed from @/services');
    // Convert legacy Holiday format to new format
    const convertedHolidays = holidays.map(h => ({
      startDate: new Date(h.startDate),
      endDate: new Date(h.endDate),
      name: h.title || h.name || 'Holiday',
      id: h.id
    }));
    return expandHolidayDatesDetailed(convertedHolidays);
  }

  /**
   * Checks if a given date falls within any holiday period
   * @deprecated Use getHolidayForDate from @/services instead
   */
  static getHolidayForDate(date: Date, holidays: Holiday[]): HolidayDate | null {
    console.warn('HolidayCalculationService.getHolidayForDate is deprecated. Use getHolidayForDate from @/services');
    // Convert legacy Holiday format to new format
    const convertedHolidays = holidays.map(h => ({
      startDate: new Date(h.startDate),
      endDate: new Date(h.endDate),
      name: h.title || h.name || 'Holiday',
      id: h.id
    }));
    return getHolidayForDateNew(date, convertedHolidays);
  }

  /**
   * Gets all holidays within a date range
   * @deprecated Use getHolidaysInRangeDetailed from @/services instead
   */
  static getHolidaysInRange(
    startDate: Date,
    endDate: Date,
    holidays: Holiday[]
  ): HolidayDate[] {
    console.warn('HolidayCalculationService.getHolidaysInRange is deprecated. Use getHolidaysInRangeDetailed from @/services');
    // Convert legacy Holiday format to new format
    const convertedHolidays = holidays.map(h => ({
      startDate: new Date(h.startDate),
      endDate: new Date(h.endDate),
      name: h.title || h.name || 'Holiday',
      id: h.id
    }));
    return getHolidaysInRangeDetailed(startDate, endDate, convertedHolidays);
  }

  /**
   * Calculates the number of holiday days within a date range
   * @deprecated Use countHolidayDaysInRange from @/services instead
   */
  static countHolidayDaysInRange(
    startDate: Date,
    endDate: Date,
    holidays: Holiday[]
  ): number {
    console.warn('HolidayCalculationService.countHolidayDaysInRange is deprecated. Use countHolidayDaysInRange from @/services');
    // Convert legacy Holiday format to new format
    const convertedHolidays = holidays.map(h => ({
      startDate: new Date(h.startDate),
      endDate: new Date(h.endDate),
      name: h.title || h.name || 'Holiday',
      id: h.id
    }));
    return countHolidayDaysInRangeNew(startDate, endDate, convertedHolidays);
  }
}
