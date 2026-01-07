import { describe, it, expect } from 'vitest';
import { PhaseRules } from '@/domain/rules/phases/PhaseRules';

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

describe('PhaseRules.validateMilestoneTime', () => {
  it('warns but does not error when allocation is zero', () => {
    const result = PhaseRules.validateMilestoneTime(0, 10);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain(
      'Milestone has 0h allocated — work will not be distributed until hours are set'
    );
  });

  it('fails when allocation is negative', () => {
    const result = PhaseRules.validateMilestoneTime(-2, 10);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Milestone time allocation cannot be negative');
  });

  it('passes when allocation is within budget', () => {
    const result = PhaseRules.validateMilestoneTime(5, 10);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
