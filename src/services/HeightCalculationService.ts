/**
 * Height Calculation Service
 * Centralized service for all project rectangle height calculations
 */

export class HeightCalculationService {
  /**
   * Calculate rectangle height based on hours per day
   * Uses consistent formula: minimum 3px, scale by hours (2px per hour)
   */
  static calculateRectangleHeight(hoursPerDay: number, maxHeight: number = 28): number {
    if (hoursPerDay === 0) return 0;
    
    // Base formula: minimum 3px, scale by hours (2px per hour)
    const heightInPixels = Math.max(3, Math.round(hoursPerDay * 2));
    
    // Apply maximum height constraint
    return Math.min(heightInPixels, maxHeight);
  }

  /**
   * Calculate project-level rectangle height (higher max for overview)
   */
  static calculateProjectHeight(hoursPerDay: number): number {
    return this.calculateRectangleHeight(hoursPerDay, 40);
  }

  /**
   * Calculate day-level rectangle height (lower max for detailed view)
   */
  static calculateDayHeight(hoursPerDay: number): number {
    return this.calculateRectangleHeight(hoursPerDay, 28);
  }

  /**
   * Calculate milestone segment height (same as project level)
   */
  static calculateSegmentHeight(hoursPerDay: number): number {
    return this.calculateRectangleHeight(hoursPerDay, 40);
  }
}
