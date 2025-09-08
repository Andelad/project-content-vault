/**
 * Height Calculation Service
 * Centralized service for all project rectangle height calculations
 *
 * @deprecated This service has been migrated to ui/TimelinePositioning.ts
 * Use the new functions directly from @/services:
 * - calculateRectangleHeight
 * - calculateProjectHeight
 * - calculateDayHeight
 * - calculateSegmentHeight
 */

import {
  calculateRectangleHeight,
  calculateProjectHeight,
  calculateDayHeight,
  calculateSegmentHeight
} from '../../ui/TimelinePositioning';

export class HeightCalculationService {
  /**
   * Calculate rectangle height based on hours per day
   * Uses consistent formula: minimum 3px, scale by hours (4px per hour)
   *
   * @deprecated Use calculateRectangleHeight from @/services instead
   */
  static calculateRectangleHeight(hoursPerDay: number, maxHeight: number = 28): number {
    console.warn('HeightCalculationService.calculateRectangleHeight is deprecated. Use calculateRectangleHeight from @/services');
    return calculateRectangleHeight(hoursPerDay, maxHeight);
  }

  /**
   * Calculate project-level rectangle height (higher max for overview)
   *
   * @deprecated Use calculateProjectHeight from @/services instead
   */
  static calculateProjectHeight(hoursPerDay: number): number {
    console.warn('HeightCalculationService.calculateProjectHeight is deprecated. Use calculateProjectHeight from @/services');
    return calculateProjectHeight(hoursPerDay);
  }

  /**
   * Calculate day-level rectangle height (lower max for detailed view)
   *
   * @deprecated Use calculateDayHeight from @/services instead
   */
  static calculateDayHeight(hoursPerDay: number): number {
    console.warn('HeightCalculationService.calculateDayHeight is deprecated. Use calculateDayHeight from @/services');
    return calculateDayHeight(hoursPerDay);
  }

  /**
   * Calculate milestone segment height (same as project level)
   *
   * @deprecated Use calculateSegmentHeight from @/services instead
   */
  static calculateSegmentHeight(hoursPerDay: number): number {
    console.warn('HeightCalculationService.calculateSegmentHeight is deprecated. Use calculateSegmentHeight from @/services');
    return calculateSegmentHeight(hoursPerDay);
  }
}
