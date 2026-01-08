/**
 * Phase Recurrence Tests
 * 
 * Tests for recurring phase patterns using RRule (RFC 5545)
 * 
 * Covers:
 * - RRule generation from configs (daily, weekly, monthly patterns)
 * - Occurrence generation from RRule strings
 * - RRule validation
 * - Continuous vs bounded recurrence
 * - Edge cases (leap years, last day of month, etc.)
 * 
 * @see src/domain/rules/phases/PhaseRecurrence.ts
 */

import { describe, it, expect } from 'vitest';
import { PhaseRecurrenceService } from '@/domain/rules/phases/PhaseRecurrence';
import type { RecurringConfig } from '@/types/core';

describe('PhaseRecurrence', () => {
  
  describe('generateRRuleFromConfig', () => {
    it('should generate daily RRule', () => {
      const config: RecurringConfig = {
        type: 'daily',
        interval: 1,
      };
      
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      expect(rrule).toContain('FREQ=DAILY');
      expect(rrule).toContain('INTERVAL=1');
      expect(rrule).toContain('UNTIL');
    });
    
    it('should generate daily RRule with custom interval', () => {
      const config: RecurringConfig = {
        type: 'daily',
        interval: 3,
      };
      
      const startDate = new Date('2026-01-01');
      
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        undefined,
        true
      );
      
      expect(rrule).toContain('FREQ=DAILY');
      expect(rrule).toContain('INTERVAL=3');
      expect(rrule).not.toContain('UNTIL'); // Continuous project
    });
    
    it('should generate weekly RRule with day of week', () => {
      const config: RecurringConfig = {
        type: 'weekly',
        interval: 1,
        weeklyDayOfWeek: 1, // Monday
      };
      
      const startDate = new Date('2026-01-01');
      
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        undefined,
        true
      );
      
      expect(rrule).toContain('FREQ=WEEKLY');
      expect(rrule).toContain('BYDAY=MO');
    });
    
    it('should generate weekly RRule for Friday', () => {
      const config: RecurringConfig = {
        type: 'weekly',
        interval: 2,
        weeklyDayOfWeek: 5, // Friday
      };
      
      const startDate = new Date('2026-01-01');
      
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        undefined,
        true
      );
      
      expect(rrule).toContain('FREQ=WEEKLY');
      expect(rrule).toContain('INTERVAL=2');
      expect(rrule).toContain('BYDAY=FR');
    });
    
    it('should generate monthly RRule with date pattern', () => {
      const config: RecurringConfig = {
        type: 'monthly',
        interval: 1,
        monthlyPattern: 'date',
        monthlyDate: 15,
      };
      
      const startDate = new Date('2026-01-01');
      
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        undefined,
        true
      );
      
      expect(rrule).toContain('FREQ=MONTHLY');
      expect(rrule).toContain('BYMONTHDAY=15');
    });
    
    it('should generate monthly RRule with day-of-week pattern', () => {
      const config: RecurringConfig = {
        type: 'monthly',
        interval: 1,
        monthlyPattern: 'dayOfWeek',
        monthlyWeekOfMonth: 2, // Second week
        monthlyDayOfWeek: 1, // Monday
      };
      
      const startDate = new Date('2026-01-01');
      
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        undefined,
        true
      );
      
      expect(rrule).toContain('FREQ=MONTHLY');
      expect(rrule).toContain('BYDAY=+2MO');
    });
    
    it('should reuse existing valid RRule if provided', () => {
      const existingRRule = 'FREQ=DAILY;INTERVAL=5';
      const config: RecurringConfig = {
        type: 'daily',
        interval: 1,
        rrule: existingRRule,
      };
      
      const startDate = new Date('2026-01-01');
      
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        undefined,
        true
      );
      
      expect(rrule).toBe(existingRRule);
    });
  });
  
  describe('generateOccurrencesFromRRule', () => {
    it('should generate daily occurrences', () => {
      const config: RecurringConfig = {
        type: 'daily',
        interval: 1,
      };
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-05');
      
      // Generate RRule with proper DTSTART
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        endDate
      );
      
      expect(occurrences).toHaveLength(5);
      expect(occurrences[0].date.getDate()).toBe(1);
      expect(occurrences[4].date.getDate()).toBe(5);
    });
    
    it('should generate weekly occurrences', () => {
      const config: RecurringConfig = {
        type: 'weekly',
        interval: 1,
        weeklyDayOfWeek: 1, // Monday
      };
      const startDate = new Date('2026-01-05'); // Monday
      const endDate = new Date('2026-01-31');
      
      // Generate RRule with proper DTSTART
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        endDate
      );
      
      // Should get Mondays: Jan 5, 12, 19, 26 (at least 4)
      expect(occurrences.length).toBeGreaterThanOrEqual(4);
      
      // All should be Mondays
      occurrences.forEach(occ => {
        expect(occ.date.getDay()).toBe(1); // Monday
      });
    });
    
    it('should generate monthly occurrences', () => {
      const config: RecurringConfig = {
        type: 'monthly',
        interval: 1,
        monthlyPattern: 'date',
        monthlyDate: 15,
      };
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-06-30');
      
      // Generate RRule with proper DTSTART
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        endDate
      );
      
      // Should get: Jan 15, Feb 15, Mar 15, Apr 15, May 15, Jun 15
      expect(occurrences.length).toBe(6);
      
      // All should be on the 15th
      occurrences.forEach(occ => {
        expect(occ.date.getDate()).toBe(15);
      });
    });
    
    it('should respect maxOccurrences limit', () => {
      const config: RecurringConfig = {
        type: 'daily',
        interval: 1,
      };
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-12-31');
      const maxOccurrences = 10;
      
      // Generate RRule with proper DTSTART
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        endDate,
        maxOccurrences
      );
      
      expect(occurrences).toHaveLength(maxOccurrences);
    });
    
    it('should assign occurrence numbers correctly', () => {
      const config: RecurringConfig = {
        type: 'weekly',
        interval: 1,
        weeklyDayOfWeek: 1, // Monday
      };
      const startDate = new Date('2026-01-05'); // Monday
      const endDate = new Date('2026-01-31');
      
      // Generate RRule with proper DTSTART
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        endDate
      );
      
      // Check sequential numbering
      occurrences.forEach((occ, index) => {
        expect(occ.occurrenceNumber).toBe(index + 1);
      });
    });
    
    it('should handle continuous projects with no end date', () => {
      const config: RecurringConfig = {
        type: 'weekly',
        interval: 1,
        weeklyDayOfWeek: 1, // Monday
      };
      const startDate = new Date('2026-01-05'); // Monday
      
      // Generate RRule with no end date (continuous)
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        undefined,
        true
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        undefined,
        50
      );
      
      expect(occurrences.length).toBeLessThanOrEqual(50);
      expect(occurrences.length).toBeGreaterThan(0);
    });
    
    it('should return empty array for invalid RRule', () => {
      const invalidRRule = 'INVALID-RRULE-STRING';
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        invalidRRule,
        startDate,
        endDate
      );
      
      expect(occurrences).toEqual([]);
    });
  });
  
  describe('validateRRule', () => {
    it('should validate correct daily RRule', () => {
      const result = PhaseRecurrenceService.validateRRule('FREQ=DAILY;INTERVAL=1');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate correct weekly RRule', () => {
      const result = PhaseRecurrenceService.validateRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate correct monthly RRule', () => {
      const result = PhaseRecurrenceService.validateRRule('FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should invalidate malformed RRule', () => {
      const result = PhaseRecurrenceService.validateRRule('INVALID-RRULE');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid RRule format');
    });
    
    it('should invalidate empty RRule', () => {
      const result = PhaseRecurrenceService.validateRRule('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('validateRecurringConfig', () => {
    it('should validate daily config', () => {
      const config = {
        type: 'daily' as const,
        interval: 1,
      };
      
      const result = PhaseRecurrenceService.validateRecurringConfig(true, config, 8);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should validate weekly config', () => {
      const config = {
        type: 'weekly' as const,
        interval: 1,
        weeklyDayOfWeek: 1,
      };
      
      const result = PhaseRecurrenceService.validateRecurringConfig(true, config, 8);
      
      expect(result.isValid).toBe(true);
    });
    
    it('should invalidate weekly config without day of week', () => {
      const config = {
        type: 'weekly' as const,
        interval: 1,
      };
      
      const result = PhaseRecurrenceService.validateRecurringConfig(true, config, 8);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('day of week'));
    });
    
    it('should validate monthly config with date pattern', () => {
      const config = {
        type: 'monthly' as const,
        interval: 1,
        monthlyPattern: 'date' as const,
        monthlyDate: 15,
      };
      
      const result = PhaseRecurrenceService.validateRecurringConfig(true, config, 8);
      
      expect(result.isValid).toBe(true);
    });
    
    it('should validate monthly config with dayOfWeek pattern', () => {
      const config = {
        type: 'monthly' as const,
        interval: 1,
        monthlyPattern: 'dayOfWeek' as const,
        monthlyWeekOfMonth: 2,
        monthlyDayOfWeek: 1,
      };
      
      const result = PhaseRecurrenceService.validateRecurringConfig(true, config, 8);
      
      expect(result.isValid).toBe(true);
    });
    
    it('should invalidate monthly config without pattern', () => {
      const config = {
        type: 'monthly' as const,
        interval: 1,
      };
      
      const result = PhaseRecurrenceService.validateRecurringConfig(true, config, 8);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('pattern'));
    });
    
    it('should invalidate config with invalid interval', () => {
      const config = {
        type: 'daily' as const,
        interval: 0,
      };
      
      const result = PhaseRecurrenceService.validateRecurringConfig(true, config, 8);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('interval'));
    });
    
    it('should invalidate config with invalid type', () => {
      const config = {
        type: 'hourly' as any,
        interval: 1,
      };
      
      const result = PhaseRecurrenceService.validateRecurringConfig(true, config, 8);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('Invalid recurrence type'));
    });
    
    it('should pass validation for non-recurring phase', () => {
      const result = PhaseRecurrenceService.validateRecurringConfig(false, undefined, 8);
      
      expect(result.isValid).toBe(true);
    });
    
    it('should fail if recurring but no config provided', () => {
      const result = PhaseRecurrenceService.validateRecurringConfig(true, undefined, 8);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual(expect.stringContaining('configuration'));
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle leap year February 29', () => {
      // Note: RRULE may skip Feb 29 in non-leap years, so we just get one occurrence in 2024
      const config: RecurringConfig = {
        type: 'monthly',
        interval: 12, // Yearly
        monthlyPattern: 'date',
        monthlyDate: 29,
      };
      const startDate = new Date('2024-02-29'); // Leap year
      const endDate = new Date('2028-12-31');
      
      // Generate RRule with proper DTSTART
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        endDate
      );
      
      // Should get at least Feb 29, 2024
      expect(occurrences.length).toBeGreaterThanOrEqual(1);
      occurrences.forEach(occ => {
        expect(occ.date.getMonth()).toBe(1); // February
        expect(occ.date.getDate()).toBe(29);
      });
    });
    
    it('should handle last day of month', () => {
      const config: RecurringConfig = {
        type: 'monthly',
        interval: 1,
        monthlyPattern: 'date',
        monthlyDate: 31,
      };
      const startDate = new Date('2026-01-31');
      const endDate = new Date('2026-06-30');
      
      // Generate RRule with proper DTSTART
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        endDate
      );
      
      // Should only get months with 31 days: Jan, Mar, May
      expect(occurrences.length).toBe(3);
      occurrences.forEach(occ => {
        expect(occ.date.getDate()).toBe(31);
      });
    });
    
    it('should handle year boundary crossing', () => {
      const config: RecurringConfig = {
        type: 'weekly',
        interval: 1,
        weeklyDayOfWeek: 2, // Tuesday
      };
      const startDate = new Date('2025-12-16'); // Tuesday
      const endDate = new Date('2026-01-15');
      
      // Generate RRule with proper DTSTART
      const rrule = PhaseRecurrenceService.generateRRuleFromConfig(
        config,
        startDate,
        endDate,
        false
      );
      
      const occurrences = PhaseRecurrenceService.generateOccurrencesFromRRule(
        rrule,
        startDate,
        endDate
      );
      
      expect(occurrences.length).toBeGreaterThan(0);
      
      // Verify dates span year boundary
      const dates = occurrences.map(o => o.date);
      const has2025 = dates.some(d => d.getFullYear() === 2025);
      const has2026 = dates.some(d => d.getFullYear() === 2026);
      
      expect(has2025).toBe(true);
      expect(has2026).toBe(true);
    });
  });
});
