/**
 * Tests for Phase Type Guards and Helpers
 * 
 * These tests document the distinction between phases and milestones
 * and validate the helper functions work correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  isPhase,
  isMilestone,
  getPhases,
  getMilestones,
  sortPhasesByEndDate,
  sortPhasesByStartDate,
  getPhasesSortedByEndDate,
  type Phase
} from '@/domain/rules/PhaseRules';
import type { Milestone } from '@/types/core';

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

  const phase: Milestone = {
    ...baseProps,
    id: 'phase-1',
    name: 'Design Phase',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-15')
  };

  const milestone: Milestone = {
    ...baseProps,
    id: 'milestone-1',
    name: 'Launch Deadline',
    startDate: undefined, // No start date = pure milestone
    endDate: new Date('2025-01-20')
  };

  const phase2: Milestone = {
    ...baseProps,
    id: 'phase-2',
    name: 'Development Phase',
    startDate: new Date('2025-01-16'),
    endDate: new Date('2025-01-31')
  };

  describe('isPhase', () => {
    it('returns true when milestone has startDate', () => {
      expect(isPhase(phase)).toBe(true);
    });

    it('returns false when milestone has no startDate', () => {
      expect(isPhase(milestone)).toBe(false);
    });

    it('provides type narrowing', () => {
      const item: Milestone = phase;
      
      if (isPhase(item)) {
        // TypeScript should know item.startDate exists
        const start: Date = item.startDate;
        expect(start).toBeInstanceOf(Date);
      }
    });
  });

  describe('isMilestone', () => {
    it('returns false when milestone has startDate (is a phase)', () => {
      expect(isMilestone(phase)).toBe(false);
    });

    it('returns true when milestone has no startDate (pure milestone)', () => {
      expect(isMilestone(milestone)).toBe(true);
    });
  });

  describe('getPhases', () => {
    it('extracts only phases from mixed array', () => {
      const mixed = [phase, milestone, phase2];
      const result = getPhases(mixed);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('phase-1');
      expect(result[1].id).toBe('phase-2');
    });

    it('returns empty array when no phases', () => {
      const milestones = [milestone];
      const result = getPhases(milestones);
      
      expect(result).toHaveLength(0);
    });

    it('returns all items when all are phases', () => {
      const phases = [phase, phase2];
      const result = getPhases(phases);
      
      expect(result).toHaveLength(2);
    });

    it('returns type-safe Phase array', () => {
      const mixed = [phase, milestone];
      const result: Phase[] = getPhases(mixed);
      
      // TypeScript should know these have startDate
      result.forEach(p => {
        expect(p.startDate).toBeInstanceOf(Date);
      });
    });
  });

  describe('getMilestones', () => {
    it('extracts only pure milestones from mixed array', () => {
      const mixed = [phase, milestone, phase2];
      const result = getMilestones(mixed);
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('milestone-1');
    });

    it('returns empty array when all are phases', () => {
      const phases = [phase, phase2];
      const result = getMilestones(phases);
      
      expect(result).toHaveLength(0);
    });

    it('returns all items when none are phases', () => {
      const milestones = [milestone];
      const result = getMilestones(milestones);
      
      expect(result).toHaveLength(1);
    });
  });

  describe('sortPhasesByEndDate', () => {
    it('sorts phases by end date ascending', () => {
      const unsorted: Phase[] = [phase as Phase, phase2 as Phase]; // phase2 ends later
      const result = sortPhasesByEndDate(unsorted);
      
      expect(result[0].id).toBe('phase-1'); // Ends Jan 15
      expect(result[1].id).toBe('phase-2'); // Ends Jan 31
    });

    it('does not mutate original array', () => {
      const original: Phase[] = [phase2 as Phase, phase as Phase];
      const originalOrder = [original[0].id, original[1].id];
      
      sortPhasesByEndDate(original);
      
      expect([original[0].id, original[1].id]).toEqual(originalOrder);
    });
  });

  describe('sortPhasesByStartDate', () => {
    it('sorts phases by start date ascending', () => {
      const unsorted: Phase[] = [phase2 as Phase, phase as Phase]; // phase2 starts later
      const result = sortPhasesByStartDate(unsorted);
      
      expect(result[0].id).toBe('phase-1'); // Starts Jan 1
      expect(result[1].id).toBe('phase-2'); // Starts Jan 16
    });

    it('does not mutate original array', () => {
      const original: Phase[] = [phase2 as Phase, phase as Phase];
      const originalOrder = [original[0].id, original[1].id];
      
      sortPhasesByStartDate(original);
      
      expect([original[0].id, original[1].id]).toEqual(originalOrder);
    });
  });

  describe('getPhasesSortedByEndDate', () => {
    it('filters and sorts in one operation', () => {
      const mixed = [phase2, milestone, phase];
      const result = getPhasesSortedByEndDate(mixed);
      
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('phase-1'); // First by end date
      expect(result[1].id).toBe('phase-2'); // Second by end date
    });

    it('handles empty array', () => {
      const result = getPhasesSortedByEndDate([]);
      expect(result).toHaveLength(0);
    });

    it('handles array with only milestones', () => {
      const result = getPhasesSortedByEndDate([milestone]);
      expect(result).toHaveLength(0);
    });

    it('returns type-safe sorted Phase array', () => {
      const mixed = [phase2, milestone, phase];
      const result: Phase[] = getPhasesSortedByEndDate(mixed);
      
      result.forEach(p => {
        expect(p.startDate).toBeInstanceOf(Date);
        expect(p.endDate).toBeInstanceOf(Date);
      });
    });
  });

  describe('Real-world scenario: ProjectBar filtering', () => {
    it('replaces inline filter + sort from ProjectBar.tsx', () => {
      // This simulates the old code from ProjectBar.tsx line 755
      const filteredProjectMilestones = [phase, milestone, phase2];
      
      // OLD WAY (inline in component) - incorrectly checked endDate
      // This would include milestones too since they also have endDate!
      const oldWayIncorrect = filteredProjectMilestones.filter(m => {
        return m.endDate !== undefined;
      }).sort((a, b) => {
        const aDate = new Date(a.endDate!).getTime();
        const bDate = new Date(b.endDate!).getTime();
        return aDate - bDate;
      });
      
      // NEW WAY (using helper) - correctly checks startDate
      const newWay = getPhasesSortedByEndDate(filteredProjectMilestones);
      
      // New way correctly filters to only phases (items with startDate)
      expect(newWay).toHaveLength(2); // Only phases
      expect(oldWayIncorrect).toHaveLength(3); // Incorrectly included milestone
      
      // The phases are correctly sorted by end date
      expect(newWay[0].id).toBe('phase-1'); // Jan 15
      expect(newWay[1].id).toBe('phase-2'); // Jan 31
      
      // All results have startDate (type-safe)
      newWay.forEach(p => {
        expect(p.startDate).toBeInstanceOf(Date);
      });
    });
  });
});
