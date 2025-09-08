/**
 * Migration Test: HeightCalculationService → TimelinePositioning
 * Verifies that migrated height calculations maintain identical behavior
 */

import {
  calculateRectangleHeight,
  calculateProjectHeight,
  calculateDayHeight,
  calculateSegmentHeight
} from '../ui/TimelinePositioning';

import { HeightCalculationService } from '../legacy/timeline/HeightCalculationService';

describe('Height Calculation Migration', () => {
  describe('calculateRectangleHeight', () => {
    it('should maintain identical behavior', () => {
      const testCases = [
        { input: 0, maxHeight: 28, expected: 0 },
        { input: 1, maxHeight: 28, expected: 4 },
        { input: 2, maxHeight: 28, expected: 8 },
        { input: 8, maxHeight: 28, expected: 28 }, // capped at maxHeight
        { input: 5, maxHeight: 40, expected: 20 }
      ];

      testCases.forEach(({ input, maxHeight, expected }) => {
        const legacyResult = HeightCalculationService.calculateRectangleHeight(input, maxHeight);
        const newResult = calculateRectangleHeight(input, maxHeight);

        expect(newResult).toBe(expected);
        expect(newResult).toBe(legacyResult);
      });
    });
  });

  describe('calculateProjectHeight', () => {
    it('should maintain identical behavior', () => {
      const testCases = [0, 1, 2, 5, 10];

      testCases.forEach(hours => {
        const legacyResult = HeightCalculationService.calculateProjectHeight(hours);
        const newResult = calculateProjectHeight(hours);

        expect(newResult).toBe(legacyResult);
      });
    });
  });

  describe('calculateDayHeight', () => {
    it('should maintain identical behavior', () => {
      const testCases = [0, 1, 2, 5, 10];

      testCases.forEach(hours => {
        const legacyResult = HeightCalculationService.calculateDayHeight(hours);
        const newResult = calculateDayHeight(hours);

        expect(newResult).toBe(legacyResult);
      });
    });
  });

  describe('calculateSegmentHeight', () => {
    it('should maintain identical behavior', () => {
      const testCases = [0, 1, 2, 5, 10];

      testCases.forEach(hours => {
        const legacyResult = HeightCalculationService.calculateSegmentHeight(hours);
        const newResult = calculateSegmentHeight(hours);

        expect(newResult).toBe(legacyResult);
      });
    });
  });
});
