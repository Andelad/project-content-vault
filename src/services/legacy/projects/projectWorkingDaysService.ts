/**
 * @deprecated This service has been migrated to /src/services/calculations/projectCalculations.ts
 * Working days calculation functions are now available as standalone functions.
 * 
 * Migration path:
 * - ProjectWorkingDaysService.calculateWorkingDaysRemaining() → calculateWorkingDaysRemaining()
 * - ProjectWorkingDaysService.calculateTotalWorkingDays() → calculateTotalWorkingDays()
 * - ProjectWorkingDaysService.calculateValidDaysInPeriod() → calculateValidDaysInPeriod()
 * - ProjectWorkingDaysService.calculateDayWorkHours() → calculateDayWorkHours()
 * - ProjectWorkingDaysService.getWorkingDaysBetween() → getWorkingDaysBetween()
 * 
 * Please update imports to use the new location:
 * import { 
 *   calculateWorkingDaysRemaining,
 *   calculateTotalWorkingDays,
 *   calculateValidDaysInPeriod,
 *   calculateDayWorkHours,
 *   getWorkingDaysBetween,
 *   type ProjectWorkSlot,
 *   type ProjectWeeklyWorkHours,
 *   type ProjectHoliday,
 *   type ProjectWorkingDaysSettings
 * } from '@/services/calculations/projectCalculations';
 */

import {
  calculateWorkingDaysRemaining,
  calculateTotalWorkingDays,
  calculateValidDaysInPeriod,
  calculateDayWorkHours,
  getWorkingDaysBetween,
  type ProjectWorkSlot,
  type ProjectWeeklyWorkHours,
  type ProjectHoliday,
  type ProjectWorkingDaysSettings
} from '@/services/calculations/projectCalculations';

// Re-export types for backwards compatibility
export type { ProjectWorkSlot, ProjectWeeklyWorkHours, ProjectHoliday, ProjectWorkingDaysSettings };

/**
 * @deprecated Use standalone functions from @/services/calculations/projectCalculations instead
 */
export class ProjectWorkingDaysService {
  private static readonly DAY_NAMES: (keyof ProjectWeeklyWorkHours)[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];

  /**
   * @deprecated Use calculateWorkingDaysRemaining() from @/services/calculations/projectCalculations
   */
  static calculateWorkingDaysRemaining(
    endDate: Date, 
    settings: ProjectWorkingDaysSettings, 
    holidays: ProjectHoliday[] = []
  ): number {
    console.warn('[DEPRECATED] ProjectWorkingDaysService.calculateWorkingDaysRemaining is deprecated. Use calculateWorkingDaysRemaining from @/services/calculations/projectCalculations instead.');
    return calculateWorkingDaysRemaining(endDate, settings, holidays);
  }

  /**
   * @deprecated Use calculateTotalWorkingDays() from @/services/calculations/projectCalculations
   */
  static calculateTotalWorkingDays(
    startDate: Date, 
    endDate: Date, 
    settings: ProjectWorkingDaysSettings, 
    holidays: ProjectHoliday[] = []
  ): number {
    console.warn('[DEPRECATED] ProjectWorkingDaysService.calculateTotalWorkingDays is deprecated. Use calculateTotalWorkingDays from @/services/calculations/projectCalculations instead.');
    return calculateTotalWorkingDays(startDate, endDate, settings, holidays);
  }

  /**
   * @deprecated Use calculateValidDaysInPeriod() from @/services/calculations/projectCalculations
   */
  static calculateValidDaysInPeriod(
    startDate: Date,
    endDate: Date,
    includedDays: Record<keyof ProjectWeeklyWorkHours, boolean>
  ): number {
    console.warn('[DEPRECATED] ProjectWorkingDaysService.calculateValidDaysInPeriod is deprecated. Use calculateValidDaysInPeriod from @/services/calculations/projectCalculations instead.');
    return calculateValidDaysInPeriod(startDate, endDate, includedDays);
  }

  /**
   * @deprecated Use calculateDayWorkHours() from @/services/calculations/projectCalculations
   */
  static calculateDayWorkHours(
    date: Date,
    settings: ProjectWorkingDaysSettings
  ): number {
    console.warn('[DEPRECATED] ProjectWorkingDaysService.calculateDayWorkHours is deprecated. Use calculateDayWorkHours from @/services/calculations/projectCalculations instead.');
    return calculateDayWorkHours(date, settings);
  }

  /**
   * @deprecated Use getWorkingDaysBetween() from @/services/calculations/projectCalculations
   */
  static getWorkingDaysBetween(
    startDate: Date,
    endDate: Date,
    settings: ProjectWorkingDaysSettings,
    holidays: ProjectHoliday[] = []
  ): Date[] {
    console.warn('[DEPRECATED] ProjectWorkingDaysService.getWorkingDaysBetween is deprecated. Use getWorkingDaysBetween from @/services/calculations/projectCalculations instead.');
    return getWorkingDaysBetween(startDate, endDate, settings, holidays);
  }

  /**
   * @deprecated Internal method, no direct replacement needed
   */
  private static isWorkingDay(
    date: Date, 
    settings: ProjectWorkingDaysSettings, 
    holidays: ProjectHoliday[] = []
  ): boolean {
    // This was private, so delegate to public function that uses it internally
    const workingDays = getWorkingDaysBetween(date, date, settings, holidays);
    return workingDays.length > 0;
  }
}
