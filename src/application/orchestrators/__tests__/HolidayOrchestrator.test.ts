/**
 * Holiday Orchestrator Tests
 * 
 * Tests for holiday creation and editing workflows including:
 * - Holiday validation
 * - Overlap detection
 * - Auto-adjustment of dates
 * - Multi-step creation workflows
 * 
 * @see src/services/orchestrators/HolidayOrchestrator.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HolidayOrchestrator } from '../HolidayOrchestrator';
import type { Holiday } from '@/shared/types/core';

describe('HolidayOrchestrator', () => {
  
  // Test data factory
  const createHoliday = (overrides: Partial<Holiday> = {}): Holiday => ({
    id: 'holiday-1',
    title: 'Test Holiday',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-01-15'),
    notes: '',
    ...overrides,
  });
  
  describe('validateHolidayData', () => {
    it('should validate valid holiday data', () => {
      const orchestrator = new HolidayOrchestrator([], undefined);
      
      const result = orchestrator.validateHolidayData({
        title: 'New Year',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-01'),
        notes: '',
      });
      
      expect(result.isValid).toBe(true);
      expect(result.hasOverlaps).toBe(false);
    });
    
    it('should reject holiday with missing title', () => {
      const orchestrator = new HolidayOrchestrator([], undefined);
      
      const result = orchestrator.validateHolidayData({
        title: '',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-01'),
        notes: '',
      });
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });
    
    it('should reject holiday with end before start', () => {
      const orchestrator = new HolidayOrchestrator([], undefined);
      
      const result = orchestrator.validateHolidayData({
        title: 'Invalid Holiday',
        startDate: new Date('2026-01-20'),
        endDate: new Date('2026-01-15'),
        notes: '',
      });
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });
    
    it('should detect overlapping holidays', () => {
      const existingHolidays = [
        createHoliday({
          id: 'existing-1',
          title: 'Existing Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-17'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, undefined);
      
      const result = orchestrator.validateHolidayData({
        title: 'New Holiday',
        startDate: new Date('2026-01-16'),
        endDate: new Date('2026-01-18'),
        notes: '',
      });
      
      expect(result.isValid).toBe(false);
      expect(result.hasOverlaps).toBe(true);
      expect(result.overlappingHolidays).toHaveLength(1);
    });
    
    it('should provide adjusted dates for overlapping holidays', () => {
      const existingHolidays = [
        createHoliday({
          id: 'existing-1',
          title: 'Existing Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-17'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, undefined);
      
      const result = orchestrator.validateHolidayData({
        title: 'New Holiday',
        startDate: new Date('2026-01-16'),
        endDate: new Date('2026-01-18'),
        notes: '',
      });
      
      expect(result.adjustedDates).toBeDefined();
      expect(result.adjustedDates?.startDate).toBeDefined();
      expect(result.adjustedDates?.endDate).toBeDefined();
    });
    
    it('should allow adjacent holidays without overlap', () => {
      const existingHolidays = [
        createHoliday({
          id: 'existing-1',
          title: 'Existing Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-17'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, undefined);
      
      const result = orchestrator.validateHolidayData({
        title: 'Adjacent Holiday',
        startDate: new Date('2026-01-18'),
        endDate: new Date('2026-01-20'),
        notes: '',
      });
      
      expect(result.isValid).toBe(true);
      expect(result.hasOverlaps).toBe(false);
    });
    
    it('should exclude current holiday from overlap detection when editing', () => {
      const existingHolidays = [
        createHoliday({
          id: 'holiday-1',
          title: 'My Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-17'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, 'holiday-1');
      
      const result = orchestrator.validateHolidayData({
        title: 'My Holiday (Updated)',
        startDate: new Date('2026-01-15'),
        endDate: new Date('2026-01-18'), // Extended by 1 day
        notes: '',
      });
      
      // Should be valid since we're editing the same holiday
      expect(result.isValid).toBe(true);
      expect(result.hasOverlaps).toBe(false);
    });
  });
  
  describe('createHolidayWorkflow', () => {
    it('should successfully create valid holiday', async () => {
      const orchestrator = new HolidayOrchestrator([], undefined);
      const mockAddHoliday = vi.fn();
      
      const result = await orchestrator.createHolidayWorkflow(
        {
          title: 'New Year',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-01'),
          notes: 'Public holiday',
        },
        mockAddHoliday
      );
      
      expect(result.success).toBe(true);
      expect(mockAddHoliday).toHaveBeenCalledOnce();
    });
    
    it('should fail to create holiday with invalid data', async () => {
      const orchestrator = new HolidayOrchestrator([], undefined);
      const mockAddHoliday = vi.fn();
      
      const result = await orchestrator.createHolidayWorkflow(
        {
          title: '', // Invalid: empty title
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-01'),
          notes: '',
        },
        mockAddHoliday
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(mockAddHoliday).not.toHaveBeenCalled();
    });
    
    it('should request user confirmation for overlapping holiday', async () => {
      const existingHolidays = [
        createHoliday({
          id: 'existing-1',
          title: 'Existing Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-17'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, undefined);
      const mockAddHoliday = vi.fn();
      
      const result = await orchestrator.createHolidayWorkflow(
        {
          title: 'Overlapping Holiday',
          startDate: new Date('2026-01-16'),
          endDate: new Date('2026-01-18'),
          notes: '',
        },
        mockAddHoliday
      );
      
      expect(result.success).toBe(false);
      expect(result.needsUserConfirmation).toBe(true);
      expect(result.adjustedDates).toBeDefined();
      expect(mockAddHoliday).not.toHaveBeenCalled();
    });
    
    it('should create holiday with adjusted dates after confirmation', async () => {
      const existingHolidays = [
        createHoliday({
          id: 'existing-1',
          title: 'Existing Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-17'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, undefined);
      const mockAddHoliday = vi.fn();
      
      // First attempt - get adjusted dates
      const firstResult = await orchestrator.createHolidayWorkflow(
        {
          title: 'New Holiday',
          startDate: new Date('2026-01-16'),
          endDate: new Date('2026-01-18'),
          notes: '',
        },
        mockAddHoliday
      );
      
      expect(firstResult.needsUserConfirmation).toBe(true);
      expect(firstResult.adjustedDates).toBeDefined();
      
      // Second attempt with adjusted dates
      const secondResult = await orchestrator.createHolidayWorkflow(
        {
          title: 'New Holiday',
          startDate: firstResult.adjustedDates!.startDate,
          endDate: firstResult.adjustedDates!.endDate,
          notes: '',
        },
        mockAddHoliday
      );
      
      expect(secondResult.success).toBe(true);
      expect(mockAddHoliday).toHaveBeenCalledOnce();
    });
  });
  
  describe('updateHolidayWorkflow', () => {
    it('should successfully update holiday', async () => {
      const existingHolidays = [
        createHoliday({
          id: 'holiday-1',
          title: 'Original Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-15'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, 'holiday-1');
      const mockUpdateHoliday = vi.fn();
      
      const result = await orchestrator.updateHolidayWorkflow(
        {
          title: 'Updated Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-16'), // Extended by 1 day
          notes: 'Updated notes',
        },
        'holiday-1',
        mockUpdateHoliday
      );
      
      expect(result.success).toBe(true);
      expect(mockUpdateHoliday).toHaveBeenCalledOnce();
    });
    
    it('should fail to update with invalid data', async () => {
      const existingHolidays = [
        createHoliday({
          id: 'holiday-1',
          title: 'Original Holiday',
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, 'holiday-1');
      const mockUpdateHoliday = vi.fn();
      
      const result = await orchestrator.updateHolidayWorkflow(
        {
          title: '', // Invalid
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-15'),
          notes: '',
        },
        'holiday-1',
        mockUpdateHoliday
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(mockUpdateHoliday).not.toHaveBeenCalled();
    });
    
    it('should detect overlap with other holidays when updating', async () => {
      const existingHolidays = [
        createHoliday({
          id: 'holiday-1',
          title: 'My Holiday',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-15'),
        }),
        createHoliday({
          id: 'holiday-2',
          title: 'Other Holiday',
          startDate: new Date('2026-01-18'),
          endDate: new Date('2026-01-20'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, 'holiday-1');
      const mockUpdateHoliday = vi.fn();
      
      const result = await orchestrator.updateHolidayWorkflow(
        {
          title: 'My Holiday',
          startDate: new Date('2026-01-17'),
          endDate: new Date('2026-01-19'), // Now overlaps with holiday-2
          notes: '',
        },
        'holiday-1',
        mockUpdateHoliday
      );
      
      expect(result.success).toBe(false);
      expect(result.needsUserConfirmation).toBe(true);
      expect(mockUpdateHoliday).not.toHaveBeenCalled();
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle multi-day holidays', () => {
      const orchestrator = new HolidayOrchestrator([], undefined);
      
      const result = orchestrator.validateHolidayData({
        title: 'Christmas Break',
        startDate: new Date('2026-12-24'),
        endDate: new Date('2026-12-26'),
        notes: '',
      });
      
      expect(result.isValid).toBe(true);
    });
    
    it('should handle multiple overlapping holidays', () => {
      const existingHolidays = [
        createHoliday({
          id: 'holiday-1',
          title: 'Holiday 1',
          startDate: new Date('2026-01-10'),
          endDate: new Date('2026-01-12'),
        }),
        createHoliday({
          id: 'holiday-2',
          title: 'Holiday 2',
          startDate: new Date('2026-01-15'),
          endDate: new Date('2026-01-17'),
        }),
      ];
      
      const orchestrator = new HolidayOrchestrator(existingHolidays, undefined);
      
      const result = orchestrator.validateHolidayData({
        title: 'Spanning Holiday',
        startDate: new Date('2026-01-11'),
        endDate: new Date('2026-01-16'), // Overlaps both
        notes: '',
      });
      
      expect(result.isValid).toBe(false);
      expect(result.hasOverlaps).toBe(true);
      expect(result.overlappingHolidays?.length).toBeGreaterThanOrEqual(1);
    });
    
    it('should handle year boundary holidays', () => {
      const orchestrator = new HolidayOrchestrator([], undefined);
      
      const result = orchestrator.validateHolidayData({
        title: 'New Year Break',
        startDate: new Date('2025-12-31'),
        endDate: new Date('2026-01-02'),
        notes: '',
      });
      
      expect(result.isValid).toBe(true);
    });
  });
});
