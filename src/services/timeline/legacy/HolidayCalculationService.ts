/**
 * Holiday Calculation Service
 * Handles holiday-related calculations and utilities for timeline components
 */

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
 */
export class HolidayCalculationService {
  /**
   * Expands holiday date ranges into individual Date objects for fast lookup
   * @param holidays Array of holiday objects with date ranges
   * @returns Array of individual holiday dates with names
   */
  static expandHolidayDates(holidays: Holiday[]): HolidayDate[] {
    const holidayDates: HolidayDate[] = [];

    holidays.forEach(holiday => {
      const startDate = new Date(holiday.startDate);
      const endDate = new Date(holiday.endDate);
      const holidayName = holiday.title || holiday.name || 'Holiday';

      // Iterate through each day in the holiday range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        holidayDates.push({
          date: new Date(currentDate),
          name: holidayName,
          holidayId: holiday.id
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    return holidayDates;
  }

  /**
   * Checks if a given date falls within any holiday period
   * @param date Date to check
   * @param holidays Array of holiday objects
   * @returns Holiday information if date is a holiday, null otherwise
   */
  static getHolidayForDate(date: Date, holidays: Holiday[]): HolidayDate | null {
    const holidayDates = this.expandHolidayDates(holidays);

    const holidayDate = holidayDates.find(holidayDate =>
      holidayDate.date.toDateString() === date.toDateString()
    );

    return holidayDate || null;
  }

  /**
   * Gets all holidays within a date range
   * @param startDate Start of the range
   * @param endDate End of the range
   * @param holidays Array of holiday objects
   * @returns Array of holidays within the range
   */
  static getHolidaysInRange(
    startDate: Date,
    endDate: Date,
    holidays: Holiday[]
  ): HolidayDate[] {
    const holidayDates = this.expandHolidayDates(holidays);

    return holidayDates.filter(holidayDate =>
      holidayDate.date >= startDate && holidayDate.date <= endDate
    );
  }

  /**
   * Calculates the number of holiday days within a date range
   * @param startDate Start of the range
   * @param endDate End of the range
   * @param holidays Array of holiday objects
   * @returns Number of holiday days in the range
   */
  static countHolidayDaysInRange(
    startDate: Date,
    endDate: Date,
    holidays: Holiday[]
  ): number {
    return this.getHolidaysInRange(startDate, endDate, holidays).length;
  }
}
