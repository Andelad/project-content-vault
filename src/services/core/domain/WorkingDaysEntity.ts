/**
 * Working Days Domain Entity
 * 
 * Contains pure business rules about working days - the fundamental "laws of physics"
 * for working day behavior that are always true regardless of implementation.
 * 
 * ✅ Pure functions only - no side effects, no external dependencies
 * ✅ Testable without mocks
 * ✅ Universal business rules
 * 
 * SINGLE SOURCE OF TRUTH for working days calculations across:
 * - Project timelines (weeks/days view)
 * - Milestone scheduling
 * - Event scheduling
 * - Work hour capacity planning
 */

export interface WorkingDaySettings {
  weeklyWorkHours: {
    monday: WorkSlot[];
    tuesday: WorkSlot[];
    wednesday: WorkSlot[];
    thursday: WorkSlot[];
    friday: WorkSlot[];
    saturday: WorkSlot[];
    sunday: WorkSlot[];
  };
}

export interface WorkSlot {
  startTime: string;
  endTime: string;
  duration: number;
}

export interface Holiday {
  id: string;
  startDate: Date;
  endDate: Date;
  title: string;
}

export interface WorkingDayResult {
  workingDays: Date[];
  totalDays: number;
  workingDayCount: number;
  holidayCount: number;
}

export class WorkingDaysEntity {
  private static readonly DAY_NAMES = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ] as const;

  /**
   * Domain Rule: Calculate all working days between two dates
   * This is THE authoritative working days calculation used by all UI components
   */
  static calculateWorkingDays(
    startDate: Date,
    endDate: Date,
    settings: WorkingDaySettings,
    holidays: Holiday[] = []
  ): WorkingDayResult {
    const workingDays: Date[] = [];
    let totalDays = 0;
    let holidayCount = 0;

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      totalDays++;
      const checkDate = new Date(current);
      
      if (this.isWorkingDay(checkDate, settings, holidays)) {
        workingDays.push(new Date(checkDate));
      } else if (this.isHoliday(checkDate, holidays)) {
        holidayCount++;
      }

      current.setDate(current.getDate() + 1);
    }

    return {
      workingDays,
      totalDays,
      workingDayCount: workingDays.length,
      holidayCount
    };
  }

  /**
   * Domain Rule: Check if a specific date is a working day
   * Considers both work hour settings and holidays
   */
  static isWorkingDay(
    date: Date,
    settings: WorkingDaySettings,
    holidays: Holiday[] = []
  ): boolean {
    // Check if it's a holiday first
    if (this.isHoliday(date, holidays)) {
      return false;
    }

    // Check if there are work hours configured for this day
    const dayIndex = date.getDay();
    const dayName = this.DAY_NAMES[dayIndex];
    const workSlots = settings.weeklyWorkHours?.[dayName] || [];

    // A day is considered working if it has work slots with total duration > 0
    const totalDuration = Array.isArray(workSlots) 
      ? workSlots.reduce((sum, slot) => sum + (slot.duration || 0), 0)
      : 0;

    return totalDuration > 0;
  }

  /**
   * Domain Rule: Check if a date falls on a holiday
   */
  static isHoliday(date: Date, holidays: Holiday[]): boolean {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      holidayStart.setHours(0, 0, 0, 0);
      
      const holidayEnd = new Date(holiday.endDate);
      holidayEnd.setHours(0, 0, 0, 0);

      return checkDate >= holidayStart && checkDate <= holidayEnd;
    });
  }

  /**
   * Domain Rule: Calculate total work hours for a specific day
   */
  static calculateDayWorkHours(
    date: Date,
    settings: WorkingDaySettings
  ): number {
    if (!this.isWorkingDay(date, settings)) {
      return 0;
    }

    const dayIndex = date.getDay();
    const dayName = this.DAY_NAMES[dayIndex];
    const workSlots = settings.weeklyWorkHours?.[dayName] || [];

    return Array.isArray(workSlots) 
      ? workSlots.reduce((sum, slot) => sum + (slot.duration || 0), 0)
      : 0;
  }

  /**
   * Domain Rule: Count working days remaining until end date
   */
  static calculateWorkingDaysRemaining(
    endDate: Date,
    settings: WorkingDaySettings,
    holidays: Holiday[] = []
  ): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetEndDate = new Date(endDate);
    targetEndDate.setHours(0, 0, 0, 0);
    
    // If end date is in the past or today, return 0
    if (targetEndDate <= today) {
      return 0;
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const result = this.calculateWorkingDays(tomorrow, targetEndDate, settings, holidays);
    return result.workingDayCount;
  }

  /**
   * Domain Rule: Format working day display
   */
  static formatWorkingDayCount(count: number): string {
    if (count === 0) return '0 working days';
    if (count === 1) return '1 working day';
    return `${count} working days`;
  }
}
