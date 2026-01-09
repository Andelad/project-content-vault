/**
 * Tests for Phase Sorting Helpers
 */

import { describe, it, expect } from 'vitest';
import {
  sortPhasesByEndDate,
  sortPhasesByStartDate,
  getPhasesSortedByEndDate,
  PhaseRules,
  type Phase
} from '@/domain/rules/phases/PhaseRules';
import type { PhaseDTO } from '@/shared/types/core';

describe('Phase Helpers', () => {
  // Test data
  const baseProps = {
    id: '1',
    name: 'Test',
    projectId: 'p1',
    endDate: new Date('2025-01-15'),
    dueDate: new Date('2025-01-15'),
    timeAllocationHours: 40,
    timeAllocation: 40,
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const phase: Phase = {
    ...baseProps,
    id: 'phase-1',
    name: 'Design Phase',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-15')
  };

  const phase2: Phase = {
    ...baseProps,
    id: 'phase-2',
    name: 'Development Phase',
    startDate: new Date('2025-01-16'),
    endDate: new Date('2025-01-31')
  };


  describe('sortPhasesByEndDate', () => {
    it('sorts phases by end date ascending', () => {
      const unsorted: PhaseDTO[] = [phase as Phase, phase2 as Phase]; // phase2 ends later
      const result = sortPhasesByEndDate(unsorted);
      
      expect(result[0].id).toBe('phase-1'); // Ends Jan 15
      expect(result[1].id).toBe('phase-2'); // Ends Jan 31
    });

    it('does not mutate original array', () => {
      const original: PhaseDTO[] = [phase2 as Phase, phase as Phase];
      const originalOrder = [original[0].id, original[1].id];
      
      sortPhasesByEndDate(original);
      
      expect([original[0].id, original[1].id]).toEqual(originalOrder);
    });
  });

  describe('sortPhasesByStartDate', () => {
    it('sorts phases by start date ascending', () => {
      const unsorted: PhaseDTO[] = [phase2 as Phase, phase as Phase]; // phase2 starts later
      const result = sortPhasesByStartDate(unsorted);
      
      expect(result[0].id).toBe('phase-1'); // Starts Jan 1
      expect(result[1].id).toBe('phase-2'); // Starts Jan 16
    });

    it('does not mutate original array', () => {
      const original: PhaseDTO[] = [phase2 as Phase, phase as Phase];
      const originalOrder = [original[0].id, original[1].id];
      
      sortPhasesByStartDate(original);
      
      expect([original[0].id, original[1].id]).toEqual(originalOrder);
    });
  });

  describe('getPhasesSortedByEndDate', () => {
    it('sorts phases by end date', () => {
      const mixed = [phase2, phase];
      const result = getPhasesSortedByEndDate(mixed);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('phase-1'); // First by end date
      expect(result[1].id).toBe('phase-2'); // Second by end date
    });

    it('handles empty array', () => {
      const result = getPhasesSortedByEndDate([]);
      expect(result).toHaveLength(0);
    });

    it('returns sorted Phase array', () => {
      const mixed = [phase2, phase];
      const result: PhaseDTO[] = getPhasesSortedByEndDate(mixed);
      
      result.forEach(p => {
        expect(p.startDate).toBeInstanceOf(Date);
        expect(p.endDate).toBeInstanceOf(Date);
      });
    });
  });

  describe('Real-world scenario: ProjectBar sorting', () => {
    it('sorts phases by end date', () => {
      const projectPhases = [phase, phase2];
      
      // Sort phases by end date
      // All phases now have both startDate and endDate
      const result = getPhasesSortedByEndDate(projectPhases);
      
      // Phases are correctly sorted by end date
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('phase-1'); // Jan 15
      expect(result[1].id).toBe('phase-2'); // Jan 31
      
      // All results have startDate and endDate
      result.forEach(p => {
        expect(p.startDate).toBeInstanceOf(Date);
        expect(p.endDate).toBeInstanceOf(Date);
      });
    });
  });

  describe('PhaseRules.validateTimeAllocation', () => {
    it('allows zero hours as a valid placeholder', () => {
      expect(PhaseRules.validateTimeAllocation(0)).toBe(true);
    });

    it('rejects negative hours', () => {
      expect(PhaseRules.validateTimeAllocation(-1)).toBe(false);
    });

    it('allows positive hours', () => {
      expect(PhaseRules.validateTimeAllocation(7.5)).toBe(true);
    });
  });

  describe('PhaseRules.validatePhaseTime', () => {
    it('warns but does not error when allocation is zero', () => {
      const result = PhaseRules.validatePhaseTime(0, 10);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toContain(
        'Phase has 0h allocated — work will not be distributed until hours are set'
      );
    });

    it('fails when allocation is negative', () => {
      const result = PhaseRules.validatePhaseTime(-2, 10);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Phase time allocation cannot be negative');
    });

    it('passes when allocation is within budget', () => {
      const result = PhaseRules.validatePhaseTime(5, 10);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});
