/**
 * Project Working Days Calculation Service
 * 
 * Handles calculations related to working days for projects, including
 * remaining working days, total working days between dates, and validation
 * against holidays and work hour settings.
 */

export interface ProjectWorkSlot {
  startTime: string;
  endTime: string;
  duration: number;
}

export interface ProjectWeeklyWorkHours {
  sunday: ProjectWorkSlot[];
  monday: ProjectWorkSlot[];
  tuesday: ProjectWorkSlot[];
  wednesday: ProjectWorkSlot[];
  thursday: ProjectWorkSlot[];
  friday: ProjectWorkSlot[];
  saturday: ProjectWorkSlot[];
}

export interface ProjectHoliday {
  startDate: string | Date;
  endDate: string | Date;
  title: string;
}

export interface ProjectWorkingDaysSettings {
  weeklyWorkHours?: ProjectWeeklyWorkHours;
}

export class ProjectWorkingDaysService {
  private static readonly DAY_NAMES: (keyof ProjectWeeklyWorkHours)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  /**
   * Calculate working days remaining until end date
   */
  static calculateWorkingDaysRemaining(
    endDate: Date, 
    settings: ProjectWorkingDaysSettings, 
    holidays: ProjectHoliday[] = []
  ): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetEndDate = new Date(endDate);
    targetEndDate.setHours(0, 0, 0, 0);
    
    // If end date is in the past or today, return 0
    if (targetEndDate <= today) {
      return 0;
    }
    
    // If no settings, return 0
    if (!settings?.weeklyWorkHours) {
      return 0;
    }
    
    let workingDays = 0;
    const current = new Date(today);
    current.setDate(current.getDate() + 1); // Start from tomorrow
    
    while (current <= targetEndDate) {
      if (this.isWorkingDay(current, settings, holidays)) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  }

  /**
   * Calculate total working days between start and end dates
   */
  static calculateTotalWorkingDays(
    startDate: Date, 
    endDate: Date, 
    settings: ProjectWorkingDaysSettings, 
    holidays: ProjectHoliday[] = []
  ): number {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    // If no settings, return 0
    if (!settings?.weeklyWorkHours) {
      return 0;
    }
    
    let workingDays = 0;
    const current = new Date(start);
    
    while (current <= end) {
      if (this.isWorkingDay(current, settings, holidays)) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  }

  /**
   * Calculate valid days in a period based on included days filter
   */
  static calculateValidDaysInPeriod(
    startDate: Date,
    endDate: Date,
    includedDays: Record<keyof ProjectWeeklyWorkHours, boolean>
  ): number {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayName = this.DAY_NAMES[current.getDay()];
      
      if (includedDays[dayName]) {
        count++;
      }
      
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  /**
   * Check if a specific date is a working day
   */
  private static isWorkingDay(
    date: Date, 
    settings: ProjectWorkingDaysSettings, 
    holidays: ProjectHoliday[] = []
  ): boolean {
    // Check if it's a holiday
    const isHoliday = holidays.some(holiday => {
      const holidayStart = new Date(holiday.startDate);
      const holidayEnd = new Date(holiday.endDate);
      holidayStart.setHours(0, 0, 0, 0);
      holidayEnd.setHours(0, 0, 0, 0);
      return date >= holidayStart && date <= holidayEnd;
    });
    
    if (isHoliday) {
      return false;
    }
    
    // Check if it's a day with work hours configured
    const dayName = this.DAY_NAMES[date.getDay()];
    const workSlots = settings.weeklyWorkHours?.[dayName] || [];
    
    const hasWorkHours = Array.isArray(workSlots) && 
      workSlots.reduce((sum, slot) => sum + slot.duration, 0) > 0;
    
    return hasWorkHours;
  }

  /**
   * Calculate total work hours for a specific day
   */
  static calculateDayWorkHours(
    date: Date,
    settings: ProjectWorkingDaysSettings
  ): number {
    if (!settings?.weeklyWorkHours) {
      return 0;
    }

    const dayName = this.DAY_NAMES[date.getDay()];
    const workSlots = settings.weeklyWorkHours[dayName] || [];
    
    return workSlots.reduce((sum, slot) => sum + slot.duration, 0);
  }

  /**
   * Get all working days between two dates
   */
  static getWorkingDaysBetween(
    startDate: Date,
    endDate: Date,
    settings: ProjectWorkingDaysSettings,
    holidays: ProjectHoliday[] = []
  ): Date[] {
    const workingDays: Date[] = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    while (current <= end) {
      if (this.isWorkingDay(current, settings, holidays)) {
        workingDays.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    
    return workingDays;
  }
}
