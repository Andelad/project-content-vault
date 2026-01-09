/**
 * Tests for Phase Calculations
 * 
 * Tests the consolidated budget calculation functions that were previously
 * duplicated across PhaseBudget.ts, BudgetSync.ts, and PhaseRules.ts.
 * 
 * These tests ensure the consolidation in Phase 1 didn't break functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTotalAllocation,
  calculateBudgetUtilization,
  calculateRemainingBudget,
  calculateOverageAmount,
  validatePhaseScheduling
} from '@/domain/rules/phases/PhaseCalculations';
import type { PhaseDTO } from '@/shared/types/core';

describe('PhaseCalculations', () => {
  // Test data factory
  const createPhase = (overrides: Partial<PhaseDTO> = {}): PhaseDTO => ({
    id: 'test-phase',
    name: 'Test Phase',
    projectId: 'test-project',
    dueDate: new Date('2026-01-15'),
    endDate: new Date('2026-01-15'),
    timeAllocationHours: 10,
    timeAllocation: 10,
    userId: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  });

  describe('calculateTotalAllocation', () => {
    it('should return 0 for empty array', () => {
      const result = calculateTotalAllocation([]);
      expect(result).toBe(0);
    });

    it('should return 0 for array with no phases', () => {
      const result = calculateTotalAllocation([]);
      expect(result).toBe(0);
    });

    it('should calculate total for single phase', () => {
      const phases = [createPhase({ timeAllocationHours: 20 })];
      const result = calculateTotalAllocation(phases);
      expect(result).toBe(20);
    });

    it('should sum multiple phases correctly', () => {
      const phases = [
        createPhase({ id: '1', timeAllocationHours: 10 }),
        createPhase({ id: '2', timeAllocationHours: 20 }),
        createPhase({ id: '3', timeAllocationHours: 15 })
      ];
      const result = calculateTotalAllocation(phases);
      expect(result).toBe(45);
    });

    it('should handle phases with decimal hours', () => {
      const phases = [
        createPhase({ id: '1', timeAllocationHours: 7.5 }),
        createPhase({ id: '2', timeAllocationHours: 12.25 }),
        createPhase({ id: '3', timeAllocationHours: 5.75 })
      ];
      const result = calculateTotalAllocation(phases);
      expect(result).toBe(25.5);
    });

    it('should handle phases with zero hours', () => {
      const phases = [
        createPhase({ id: '1', timeAllocationHours: 10 }),
        createPhase({ id: '2', timeAllocationHours: 0 }),
        createPhase({ id: '3', timeAllocationHours: 5 })
      ];
      const result = calculateTotalAllocation(phases);
      expect(result).toBe(15);
    });

    it('should handle phases with null timeAllocationHours', () => {
      const phases = [
        createPhase({ id: '1', timeAllocationHours: 10 }),
        createPhase({ id: '2', timeAllocationHours: null as any }),
        createPhase({ id: '3', timeAllocationHours: 5 })
      ];
      const result = calculateTotalAllocation(phases);
      // Null falls back to timeAllocation (which defaults to 10 in createPhase)
      expect(result).toBe(25); // 10 + 10 + 5
    });

    it('should handle phases with undefined timeAllocationHours', () => {
      const phases = [
        createPhase({ id: '1', timeAllocationHours: 10 }),
        createPhase({ id: '2', timeAllocationHours: undefined as any }),
        createPhase({ id: '3', timeAllocationHours: 5 })
      ];
      const result = calculateTotalAllocation(phases);
      // Undefined falls back to timeAllocation (which defaults to 10 in createPhase)
      expect(result).toBe(25); // 10 + 10 + 5
    });

    it('should fallback to timeAllocation when timeAllocationHours is missing', () => {
      const phases = [
        createPhase({ id: '1', timeAllocationHours: undefined as any, timeAllocation: 8 }),
        createPhase({ id: '2', timeAllocationHours: 12 })
      ];
      const result = calculateTotalAllocation(phases);
      expect(result).toBe(20);
    });

    it('should handle large numbers of phases', () => {
      const phases = Array.from({ length: 100 }, (_, i) => 
        createPhase({ id: `phase-${i}`, timeAllocationHours: 1 })
      );
      const result = calculateTotalAllocation(phases);
      expect(result).toBe(100);
    });
  });

  describe('calculateBudgetUtilization', () => {
    it('should return 0 when project budget is 0', () => {
      const result = calculateBudgetUtilization(50, 0);
      expect(result).toBe(0);
    });

    it('should calculate 100% utilization', () => {
      const result = calculateBudgetUtilization(100, 100);
      expect(result).toBe(100);
    });

    it('should calculate 50% utilization', () => {
      const result = calculateBudgetUtilization(50, 100);
      expect(result).toBe(50);
    });

    it('should calculate over 100% utilization', () => {
      const result = calculateBudgetUtilization(150, 100);
      expect(result).toBe(150);
    });

    it('should handle decimal percentages', () => {
      const result = calculateBudgetUtilization(33, 100);
      expect(result).toBe(33);
    });

    it('should calculate utilization with decimal hours', () => {
      const result = calculateBudgetUtilization(25.5, 100);
      expect(result).toBe(25.5);
    });

    it('should handle zero allocated hours', () => {
      const result = calculateBudgetUtilization(0, 100);
      expect(result).toBe(0);
    });
  });

  describe('calculateRemainingBudget', () => {
    it('should calculate remaining budget correctly', () => {
      const result = calculateRemainingBudget(60, 100);
      expect(result).toBe(40);
    });

    it('should return 0 when over budget', () => {
      const result = calculateRemainingBudget(120, 100);
      expect(result).toBe(0);
    });

    it('should return 0 when exactly at budget', () => {
      const result = calculateRemainingBudget(100, 100);
      expect(result).toBe(0);
    });

    it('should handle decimal hours', () => {
      const result = calculateRemainingBudget(47.5, 100);
      expect(result).toBe(52.5);
    });

    it('should return full budget when nothing allocated', () => {
      const result = calculateRemainingBudget(0, 100);
      expect(result).toBe(100);
    });
  });

  describe('calculateOverageAmount', () => {
    it('should return 0 when under budget', () => {
      const result = calculateOverageAmount(60, 100);
      expect(result).toBe(0);
    });

    it('should return 0 when exactly at budget', () => {
      const result = calculateOverageAmount(100, 100);
      expect(result).toBe(0);
    });

    it('should calculate overage correctly', () => {
      const result = calculateOverageAmount(120, 100);
      expect(result).toBe(20);
    });

    it('should handle decimal overage', () => {
      const result = calculateOverageAmount(107.5, 100);
      expect(result).toBe(7.5);
    });

    it('should handle large overage', () => {
      const result = calculateOverageAmount(250, 100);
      expect(result).toBe(150);
    });
  });

  describe('validatePhaseScheduling', () => {
    const phases = [
      createPhase({ id: '1', timeAllocationHours: 30 }),
      createPhase({ id: '2', timeAllocationHours: 20 })
    ];

    it('should pass when budget allows new phase', () => {
      const newMilestone = { timeAllocationHours: 10 };
      const result = validatePhaseScheduling(
        phases, // Existing: 50 hours
        newMilestone, // New: 10 hours
        100 // Project budget: 100 hours
      );
      
      expect(result.canSchedule).toBe(true);
      expect(result.budgetConflicts).toHaveLength(0);
      expect(result.currentAllocation).toBe(50);
      expect(result.newAllocation).toBe(60);
    });

    it('should fail when adding phase would exceed budget', () => {
      const newMilestone = { timeAllocationHours: 60 };
      const result = validatePhaseScheduling(
        phases, // Existing: 50 hours
        newMilestone, // New: 60 hours (total: 110)
        100 // Project budget: 100 hours
      );
      
      expect(result.canSchedule).toBe(false);
      expect(result.budgetConflicts.length).toBeGreaterThan(0);
      expect(result.budgetConflicts[0]).toContain('exceed');
      expect(result.currentAllocation).toBe(50);
      expect(result.newAllocation).toBe(110);
    });

    it('should allow exactly at budget limit', () => {
      const newMilestone = { timeAllocationHours: 50 };
      const result = validatePhaseScheduling(
        phases, // Existing: 50 hours
        newMilestone, // New: 50 hours (total: 100)
        100 // Project budget: 100 hours
      );
      
      // Function allows exactly at budget (not over)
      expect(result.canSchedule).toBe(true);
      expect(result.newAllocation).toBe(100);
    });

    it('should pass when budget has room', () => {
      const newMilestone = { timeAllocationHours: 49 };
      const result = validatePhaseScheduling(
        phases, // Existing: 50 hours
        newMilestone, // New: 49 hours (total: 99)
        100 // Project budget: 100 hours
      );
      
      expect(result.canSchedule).toBe(true);
      expect(result.newAllocation).toBe(99);
    });

    it('should handle empty existing phases', () => {
      const newMilestone = { timeAllocationHours: 50 };
      const result = validatePhaseScheduling(
        [],
        newMilestone,
        100
      );
      
      expect(result.canSchedule).toBe(true);
      expect(result.currentAllocation).toBe(0);
      expect(result.newAllocation).toBe(50);
    });

    it('should handle zero-hour phase', () => {
      const newMilestone = { timeAllocationHours: 0 };
      const result = validatePhaseScheduling(
        phases,
        newMilestone,
        100
      );
      
      expect(result.canSchedule).toBe(true);
      expect(result.newAllocation).toBe(50);
    });

    it('should handle phase with no hours specified', () => {
      const newMilestone = {}; // No hours
      const result = validatePhaseScheduling(
        phases,
        newMilestone,
        100
      );
      
      expect(result.canSchedule).toBe(true);
      expect(result.newAllocation).toBe(50); // Only existing hours
    });
  });

  describe('Integration: Budget Calculations Together', () => {
    it('should correctly analyze full budget scenario', () => {
      const phases = [
        createPhase({ id: '1', timeAllocationHours: 30 }),
        createPhase({ id: '2', timeAllocationHours: 25 }),
        createPhase({ id: '3', timeAllocationHours: 20 })
      ];
      const projectBudget = 100;

      const totalAllocated = calculateTotalAllocation(phases);
      const utilization = calculateBudgetUtilization(totalAllocated, projectBudget);
      const remaining = calculateRemainingBudget(totalAllocated, projectBudget);
      const overage = calculateOverageAmount(totalAllocated, projectBudget);

      expect(totalAllocated).toBe(75);
      expect(utilization).toBe(75);
      expect(remaining).toBe(25);
      expect(overage).toBe(0);
    });

    it('should correctly analyze over-budget scenario', () => {
      const phases = [
        createPhase({ id: '1', timeAllocationHours: 60 }),
        createPhase({ id: '2', timeAllocationHours: 50 })
      ];
      const projectBudget = 100;

      const totalAllocated = calculateTotalAllocation(phases);
      const utilization = calculateBudgetUtilization(totalAllocated, projectBudget);
      const remaining = calculateRemainingBudget(totalAllocated, projectBudget);
      const overage = calculateOverageAmount(totalAllocated, projectBudget);

      expect(totalAllocated).toBe(110);
      expect(utilization).toBeCloseTo(110, 1); // Allow floating point imprecision
      expect(remaining).toBe(0);
      expect(overage).toBe(10);
    });
  });
  
  describe('Multi-phase integration scenarios', () => {
    it('should handle complex project with multiple overlapping phases', () => {
      const phases = [
        createPhase({ id: 'phase-1', timeAllocationHours: 30 }),
        createPhase({ id: 'phase-2', timeAllocationHours: 25 }),
        createPhase({ id: 'phase-3', timeAllocationHours: 20 }),
        createPhase({ id: 'phase-4', timeAllocationHours: 15 }),
      ];
      
      const projectBudget = 100;
      const total = calculateTotalAllocation(phases);
      const utilization = calculateBudgetUtilization(total, projectBudget);
      const remaining = calculateRemainingBudget(total, projectBudget);
      const overage = calculateOverageAmount(total, projectBudget);
      
      expect(total).toBe(90);
      expect(utilization).toBe(90);
      expect(remaining).toBe(10);
      expect(overage).toBe(0);
    });
    
    it('should detect when adding new phase would exceed budget', () => {
      const existingPhases = [
        createPhase({ id: 'phase-1', timeAllocationHours: 40 }),
        createPhase({ id: 'phase-2', timeAllocationHours: 35 }),
      ];
      
      const newPhase = { timeAllocationHours: 30 };
      const projectBudget = 100;
      
      const validation = validatePhaseScheduling(
        existingPhases,
        newPhase,
        projectBudget
      );
      
      expect(validation.canSchedule).toBe(false);
      expect(validation.budgetConflicts).toContain(
        'Would exceed project budget by 5 hours'
      );
    });
    
    it('should allow adding phase that fits within remaining budget', () => {
      const existingPhases = [
        createPhase({ id: 'phase-1', timeAllocationHours: 40 }),
        createPhase({ id: 'phase-2', timeAllocationHours: 35 }),
      ];
      
      const newPhase = { timeAllocationHours: 20 };
      const projectBudget = 100;
      
      const validation = validatePhaseScheduling(
        existingPhases,
        newPhase,
        projectBudget
      );
      
      expect(validation.canSchedule).toBe(true);
      expect(validation.budgetConflicts).toHaveLength(0);
    });
    
    it('should handle project with no budget (zero budget edge case)', () => {
      const phases = [createPhase({ timeAllocationHours: 10 })];
      const projectBudget = 0;
      
      const total = calculateTotalAllocation(phases);
      const utilization = calculateBudgetUtilization(total, projectBudget);
      const overage = calculateOverageAmount(total, projectBudget);
      
      expect(total).toBe(10);
      expect(utilization).toBe(0); // Avoid division by zero
      expect(overage).toBe(10);
    });
    
    it('should handle all phases with zero allocation', () => {
      const phases = [
        createPhase({ timeAllocationHours: 0 }),
        createPhase({ timeAllocationHours: 0 }),
        createPhase({ timeAllocationHours: 0 }),
      ];
      
      const projectBudget = 100;
      const total = calculateTotalAllocation(phases);
      const remaining = calculateRemainingBudget(total, projectBudget);
      
      expect(total).toBe(0);
      expect(remaining).toBe(100);
    });
    
    it('should calculate utilization for project at exactly 100% budget', () => {
      const phases = [
        createPhase({ timeAllocationHours: 50 }),
        createPhase({ timeAllocationHours: 50 }),
      ];
      
      const projectBudget = 100;
      const total = calculateTotalAllocation(phases);
      const utilization = calculateBudgetUtilization(total, projectBudget);
      const remaining = calculateRemainingBudget(total, projectBudget);
      const overage = calculateOverageAmount(total, projectBudget);
      
      expect(total).toBe(100);
      expect(utilization).toBe(100);
      expect(remaining).toBe(0);
      expect(overage).toBe(0);
    });
    
    it('should handle fractional hours across multiple phases', () => {
      const phases = [
        createPhase({ timeAllocationHours: 12.5 }),
        createPhase({ timeAllocationHours: 7.25 }),
        createPhase({ timeAllocationHours: 3.75 }),
      ];
      
      const total = calculateTotalAllocation(phases);
      
      expect(total).toBeCloseTo(23.5, 2);
    });
  });
});
