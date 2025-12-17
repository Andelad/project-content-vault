import { describe, it, expect } from 'vitest';
import { MilestoneRules } from '@/domain/rules/MilestoneRules';

describe('MilestoneRules.validateTimeAllocation', () => {
  it('allows zero hours as a valid placeholder', () => {
    expect(MilestoneRules.validateTimeAllocation(0)).toBe(true);
  });

  it('rejects negative hours', () => {
    expect(MilestoneRules.validateTimeAllocation(-1)).toBe(false);
  });

  it('allows positive hours', () => {
    expect(MilestoneRules.validateTimeAllocation(7.5)).toBe(true);
  });
});

describe('MilestoneRules.validateMilestoneTime', () => {
  it('warns but does not error when allocation is zero', () => {
    const result = MilestoneRules.validateMilestoneTime(0, 10);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toContain(
      'Milestone has 0h allocated — work will not be distributed until hours are set'
    );
  });

  it('fails when allocation is negative', () => {
    const result = MilestoneRules.validateMilestoneTime(-2, 10);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Milestone time allocation cannot be negative');
  });

  it('passes when allocation is within budget', () => {
    const result = MilestoneRules.validateMilestoneTime(5, 10);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
