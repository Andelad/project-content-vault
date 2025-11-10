# Component-First, Domain-Later Workflow
**For:** Developers who prototype in components and refactor to domain logic  
**Goal:** Build fast, refactor systematically, maintain clean architecture  
**Date:** 10 November 2025

---

## The Core Principle

> **Build in the component → Extract to domain → Replace component code with domain calls**

This is NOT "sloppy then clean." It's **exploratory then structured**. You're using components as a laboratory to discover what the domain actually is.

---

## The 3-Phase Cycle

### Phase 1: SPIKE in Component (Fast & Dirty) ⚡
**Time:** 1-3 hours  
**Goal:** Validate the feature works and looks right  
**Quality Bar:** Good enough to show stakeholders

```tsx
// src/components/features/project/ProjectPhaseManager.tsx

export function ProjectPhaseManager({ project, phases }: Props) {
  // SPIKE CODE: Logic inline, hardcoded assumptions
  const [localPhases, setLocalPhases] = useState(phases);
  
  const handleAddPhase = () => {
    const today = new Date();
    const lastPhase = localPhases[localPhases.length - 1];
    
    // TODO-DOMAIN: Phase start date calculation logic
    const startDate = lastPhase 
      ? new Date(lastPhase.endDate.getTime() + 24 * 60 * 60 * 1000)
      : project.startDate;
    
    // TODO-DOMAIN: Phase spacing validation
    // Make sure at least 1 day gap between phases
    
    const newPhase = {
      id: `temp-${Date.now()}`,
      name: `Phase ${localPhases.length + 1}`,
      startDate,
      endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      timeAllocationHours: 40,
      projectId: project.id
    };
    
    // TODO-DOMAIN: Validate phase doesn't exceed project end date
    if (newPhase.endDate > project.endDate) {
      toast.error('Phase would extend beyond project end date');
      return;
    }
    
    setLocalPhases([...localPhases, newPhase]);
  };
  
  const handleMovePhase = (phaseId: string, newEndDate: Date) => {
    // TODO-DOMAIN: Cascade phase adjustments
    const phaseIndex = localPhases.findIndex(p => p.id === phaseId);
    const phase = localPhases[phaseIndex];
    
    // If moving forward and comes within 1 day of next phase, cascade
    const nextPhase = localPhases[phaseIndex + 1];
    if (nextPhase) {
      const dayAfterPhase = new Date(newEndDate.getTime() + 24 * 60 * 60 * 1000);
      if (dayAfterPhase >= nextPhase.startDate) {
        toast.warning('Moving phase would require cascading changes');
        // TODO-DOMAIN: Implement cascade logic
      }
    }
    
    // Update this phase
    const updated = localPhases.map(p => 
      p.id === phaseId ? { ...p, endDate: newEndDate } : p
    );
    setLocalPhases(updated);
  };
  
  return (
    <div>
      {/* UI implementation */}
      <Button onClick={handleAddPhase}>Add Phase</Button>
      {localPhases.map(phase => (
        <PhaseRow 
          key={phase.id}
          phase={phase}
          onMove={handleMovePhase}
        />
      ))}
    </div>
  );
}
```

**Mark your SPIKE code with TODO-DOMAIN comments** - This is your extraction guide later.

---

### Phase 2: EXTRACT to Domain (Systematic Refactor) 🔧
**Time:** 2-4 hours (do within 24-48 hours of spike)  
**Goal:** Move logic to domain layer while component still works  
**Quality Bar:** All tests pass, component behavior unchanged

#### Step 2.1: Create Domain Rules (in parallel to component)

```typescript
// src/domain/rules/PhaseRules.ts

/**
 * Phase Business Rules
 * 
 * Extracted from: ProjectPhaseManager.tsx (2025-11-10)
 * TODO: Remove inline logic from component after extraction
 */
export class PhaseRules {
  
  /**
   * Calculate start date for a new phase
   * 
   * Rule: New phase starts 1 day after previous phase ends
   * Exception: If no phases, starts at project start date
   * 
   * @extracted-from ProjectPhaseManager.handleAddPhase
   */
  static calculateNewPhaseStartDate(
    existingPhases: Phase[],
    project: Project
  ): Date {
    if (existingPhases.length === 0) {
      return new Date(project.startDate);
    }
    
    const lastPhase = existingPhases[existingPhases.length - 1];
    const oneDayMs = 24 * 60 * 60 * 1000;
    return new Date(lastPhase.endDate.getTime() + oneDayMs);
  }
  
  /**
   * Validate phase doesn't exceed project boundaries
   * 
   * Rule: Phase end date must be <= project end date
   * 
   * @extracted-from ProjectPhaseManager.handleAddPhase
   */
  static validatePhaseWithinProjectBounds(
    phase: { endDate: Date },
    project: { endDate: Date }
  ): { isValid: boolean; error?: string } {
    if (phase.endDate > project.endDate) {
      return {
        isValid: false,
        error: 'Phase would extend beyond project end date'
      };
    }
    return { isValid: true };
  }
  
  /**
   * Check if moving a phase requires cascading
   * 
   * Rule: If phase end comes within 1 day of next phase start, cascade needed
   * 
   * @extracted-from ProjectPhaseManager.handleMovePhase
   */
  static requiresCascade(
    movedPhase: { endDate: Date },
    nextPhase: { startDate: Date } | undefined
  ): boolean {
    if (!nextPhase) return false;
    
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dayAfterMoved = new Date(movedPhase.endDate.getTime() + oneDayMs);
    
    return dayAfterMoved >= nextPhase.startDate;
  }
  
  /**
   * Cascade phase adjustments forward
   * 
   * Rule: Each subsequent phase shifts to maintain 1-day gap
   * 
   * @extracted-from ProjectPhaseManager.handleMovePhase (TODO)
   */
  static cascadePhaseAdjustments(
    phases: Phase[],
    movedPhaseIndex: number,
    newEndDate: Date
  ): Phase[] {
    const result = [...phases];
    result[movedPhaseIndex] = { ...result[movedPhaseIndex], endDate: newEndDate };
    
    // Cascade forward
    for (let i = movedPhaseIndex + 1; i < result.length; i++) {
      const prevPhase = result[i - 1];
      const currentPhase = result[i];
      
      const oneDayMs = 24 * 60 * 60 * 1000;
      const requiredStart = new Date(prevPhase.endDate.getTime() + oneDayMs);
      
      if (currentPhase.startDate < requiredStart) {
        // Shift this phase forward
        const duration = currentPhase.endDate.getTime() - currentPhase.startDate.getTime();
        result[i] = {
          ...currentPhase,
          startDate: requiredStart,
          endDate: new Date(requiredStart.getTime() + duration)
        };
      } else {
        // No more cascading needed
        break;
      }
    }
    
    return result;
  }
}
```

**Key: Add `@extracted-from` comments** - This creates a paper trail from spike to domain.

#### Step 2.2: Add Tests for Domain Rules

```typescript
// src/domain/rules/__tests__/PhaseRules.test.ts

import { describe, it, expect } from 'vitest';
import { PhaseRules } from '../PhaseRules';

describe('PhaseRules', () => {
  describe('calculateNewPhaseStartDate', () => {
    it('returns project start when no existing phases', () => {
      const project = { startDate: new Date('2025-01-01') };
      const result = PhaseRules.calculateNewPhaseStartDate([], project);
      
      expect(result).toEqual(new Date('2025-01-01'));
    });
    
    it('returns day after last phase when phases exist', () => {
      const phases = [
        { endDate: new Date('2025-01-15') }
      ];
      const project = { startDate: new Date('2025-01-01') };
      const result = PhaseRules.calculateNewPhaseStartDate(phases, project);
      
      expect(result).toEqual(new Date('2025-01-16'));
    });
  });
  
  describe('validatePhaseWithinProjectBounds', () => {
    it('returns valid when phase within bounds', () => {
      const phase = { endDate: new Date('2025-01-15') };
      const project = { endDate: new Date('2025-01-31') };
      
      const result = PhaseRules.validatePhaseWithinProjectBounds(phase, project);
      
      expect(result.isValid).toBe(true);
    });
    
    it('returns invalid when phase exceeds bounds', () => {
      const phase = { endDate: new Date('2025-02-15') };
      const project = { endDate: new Date('2025-01-31') };
      
      const result = PhaseRules.validatePhaseWithinProjectBounds(phase, project);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('beyond project end date');
    });
  });
  
  describe('cascadePhaseAdjustments', () => {
    it('shifts subsequent phases when needed', () => {
      const phases = [
        { id: '1', startDate: new Date('2025-01-01'), endDate: new Date('2025-01-10') },
        { id: '2', startDate: new Date('2025-01-11'), endDate: new Date('2025-01-20') },
        { id: '3', startDate: new Date('2025-01-21'), endDate: new Date('2025-01-31') }
      ];
      
      // Move phase 1's end date forward by 5 days
      const result = PhaseRules.cascadePhaseAdjustments(phases, 0, new Date('2025-01-15'));
      
      expect(result[0].endDate).toEqual(new Date('2025-01-15'));
      expect(result[1].startDate).toEqual(new Date('2025-01-16')); // Shifted
      expect(result[1].endDate).toEqual(new Date('2025-01-25')); // Duration maintained
      expect(result[2].startDate).toEqual(new Date('2025-01-26')); // Cascaded
    });
  });
});
```

**Key: Tests document the domain rules you discovered** while building the component.

---

### Phase 3: REPLACE Component Code (Clean Integration) 🧹
**Time:** 30 min - 1 hour  
**Goal:** Component uses domain rules, no duplicate logic  
**Quality Bar:** Component is now a thin UI layer

```tsx
// src/components/features/project/ProjectPhaseManager.tsx (AFTER REFACTOR)

import { PhaseRules } from '@/domain/rules/PhaseRules';

export function ProjectPhaseManager({ project, phases }: Props) {
  const [localPhases, setLocalPhases] = useState(phases);
  
  const handleAddPhase = () => {
    // ✅ DOMAIN LOGIC: Extracted to PhaseRules
    const startDate = PhaseRules.calculateNewPhaseStartDate(localPhases, project);
    
    const newPhase = {
      id: `temp-${Date.now()}`,
      name: `Phase ${localPhases.length + 1}`,
      startDate,
      endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      timeAllocationHours: 40,
      projectId: project.id
    };
    
    // ✅ DOMAIN LOGIC: Extracted to PhaseRules
    const validation = PhaseRules.validatePhaseWithinProjectBounds(newPhase, project);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }
    
    setLocalPhases([...localPhases, newPhase]);
  };
  
  const handleMovePhase = (phaseId: string, newEndDate: Date) => {
    const phaseIndex = localPhases.findIndex(p => p.id === phaseId);
    const phase = localPhases[phaseIndex];
    const nextPhase = localPhases[phaseIndex + 1];
    
    // ✅ DOMAIN LOGIC: Extracted to PhaseRules
    if (PhaseRules.requiresCascade({ endDate: newEndDate }, nextPhase)) {
      toast.warning('Moving phase will cascade to subsequent phases');
      // ✅ DOMAIN LOGIC: Extracted to PhaseRules
      const cascaded = PhaseRules.cascadePhaseAdjustments(localPhases, phaseIndex, newEndDate);
      setLocalPhases(cascaded);
      return;
    }
    
    // Simple update without cascade
    const updated = localPhases.map(p => 
      p.id === phaseId ? { ...p, endDate: newEndDate } : p
    );
    setLocalPhases(updated);
  };
  
  return (
    <div>
      <Button onClick={handleAddPhase}>Add Phase</Button>
      {localPhases.map(phase => (
        <PhaseRow 
          key={phase.id}
          phase={phase}
          onMove={handleMovePhase}
        />
      ))}
    </div>
  );
}
```

**Result:** Component is now 60% smaller, domain logic is testable and reusable.

---

## Naming Convention During Spike Phase

To avoid naming confusion, use this convention during SPIKE:

### In Component (Spike Phase)
```tsx
// Prefix with underscores = "temporary, will be extracted"
const _calculatePhaseStart = (phases) => { /* spike logic */ };
const _validatePhaseDate = (phase) => { /* spike logic */ };
const _cascadePhases = (phases) => { /* spike logic */ };

// Or use TODO comments inline
const startDate = (() => {
  // TODO-DOMAIN: Extract to PhaseRules.calculateNewPhaseStartDate
  if (localPhases.length === 0) return project.startDate;
  const lastPhase = localPhases[localPhases.length - 1];
  return new Date(lastPhase.endDate.getTime() + 24 * 60 * 60 * 1000);
})();
```

### In Domain (After Extraction)
```typescript
// Use proper domain names without prefixes
PhaseRules.calculateNewPhaseStartDate()
PhaseRules.validatePhaseWithinProjectBounds()
PhaseRules.cascadePhaseAdjustments()
```

**Key:** Underscore prefix in spike code signals "this is temporary, extract me."

---

## Checklist: When to Extract from Component

Extract when you see any of these patterns:

### 🚨 Immediate Extraction Triggers
- [ ] Same calculation appears in 2+ places
- [ ] Logic has multiple if/else branches (complex rules)
- [ ] Math beyond simple `a + b` (formulas, dates, percentages)
- [ ] Any validation with error messages
- [ ] Business rules (constraints, limits, boundaries)

### ⏰ Defer Extraction (Wait for 2nd Use)
- [ ] Simple state management (`useState`, `useEffect`)
- [ ] UI-specific logic (show/hide, active/inactive)
- [ ] Event handlers that just call other functions
- [ ] Display formatting (currency, dates for display only)

### ✅ Never Extract (Keep in Component)
- [ ] JSX rendering logic
- [ ] CSS/styling decisions
- [ ] Component composition (which components to render)
- [ ] React lifecycle management

---

## The Refactor Timing Question

> **When should I extract to domain?**

### Option A: Extract Immediately After Spike (RECOMMENDED)
**When:** Feature works, before adding more features  
**Pros:** Fresh in your mind, easy to document  
**Cons:** Feels like duplicate work

**Do this when:**
- Feature is complex (3+ business rules)
- You're about to build a related feature (will need same logic)
- Logic will be tested separately

### Option B: Extract After 2nd Use
**When:** You copy-paste the logic to another component  
**Pros:** Proven you actually need abstraction  
**Cons:** Now refactoring 2+ places

**Do this when:**
- Feature is simple (1-2 rules)
- Not sure if logic will be reused
- Time-constrained (ship fast, refactor later)

### Option C: Extract During Code Review
**When:** PR reviewer asks "should this be in domain?"  
**Pros:** External validation of need  
**Cons:** Blocks PR, adds back-and-forth

**Do this when:**
- Unsure if extraction is warranted
- Want team consensus on domain boundaries

---

## Practical Example: Your Current Codebase

Let's trace through a REAL example from your code:

### Current State: Mixed Logic in ProjectBar.tsx

```tsx
// src/components/features/timeline/ProjectBar.tsx (line 755)

// This is SPIKE CODE that should be extracted
const phases = filteredProjectMilestones.filter(m => {
  return m.endDate !== undefined; // ❌ Domain logic in UI
}).sort((a, b) => {
  const aDate = new Date(a.endDate!).getTime();
  const bDate = new Date(b.endDate!).getTime();
  return aDate - bDate;
});
```

### After Extraction to Domain

```typescript
// src/domain/rules/PhaseRules.ts (NEW)

export class PhaseRules {
  /**
   * Extract phases from milestones array
   * 
   * Rule: A phase is a milestone with both startDate and endDate
   * @extracted-from ProjectBar.tsx line 755
   */
  static extractPhases(milestones: Milestone[]): Phase[] {
    return milestones
      .filter(m => m.startDate !== undefined && m.endDate !== undefined)
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime()) as Phase[];
  }
}
```

```tsx
// src/components/features/timeline/ProjectBar.tsx (REFACTORED)

import { PhaseRules } from '@/domain/rules/PhaseRules';

// ✅ Clean, testable, reusable
const phases = PhaseRules.extractPhases(filteredProjectMilestones);
```

---

## Addressing Your Specific Concerns

### Concern 1: "Naming will be thrown"

**Strategy: Use Extraction Comments**

```typescript
// During Spike
const _tempCalculatePhaseTime = () => { /* ... */ };
// TODO-DOMAIN: Extract as PhaseRules.calculatePhaseTimeLoad()

// After Extraction
export class PhaseRules {
  /**
   * Calculate time load per working day
   * @extracted-from ProjectModal.tsx line 234 (_tempCalculatePhaseTime)
   */
  static calculatePhaseTimeLoad() { /* ... */ }
}
```

The `@extracted-from` comments create a breadcrumb trail. 6 months later, you'll know exactly where logic came from.

### Concern 2: "Logic coming from components feels backwards"

**Reframe:** Components are your **domain discovery tool**.

You're not "doing it backwards." You're using the **scientific method**:
1. **Hypothesis:** Build component (what you think the domain is)
2. **Experiment:** Use the feature (discover what domain actually is)
3. **Theory:** Extract to domain (formalize what you learned)

Domain-first only works when you already deeply understand the problem. You don't have that luxury yet.

### Concern 3: "Will have to refactor repeatedly"

**Truth:** Yes, but that's good!

Each refactor cycle teaches you more about the domain. By iteration 3-4, your domain model will be excellent. The alternative (perfect domain upfront) leads to:
- Over-engineered abstractions
- Unused flexibility
- Wrong abstractions that are hard to change later

**Better:** Light abstractions that evolve with understanding.

---

## Red Flags: When Component-First Goes Wrong

Stop and extract immediately if you see:

### 🚩 Red Flag 1: Copy-Paste Between Components
```tsx
// Component A
const calculatePhaseTime = () => { /* 20 lines */ };

// Component B  
const calculatePhaseTime = () => { /* 20 lines, same code */ };
```
**Fix:** Extract to domain NOW, not later.

### 🚩 Red Flag 2: Component Logic Exceeds 200 Lines
```tsx
export function PhaseManager() {
  // 500 lines of logic
  // Only 50 lines of JSX
}
```
**Fix:** If logic > 4x JSX, extract to domain.

### 🚩 Red Flag 3: Testing Component Just to Test Logic
```tsx
describe('PhaseManager', () => {
  it('calculates phase time correctly', () => {
    // Rendering component just to test calculation
    render(<PhaseManager ... />);
    // ...
  });
});
```
**Fix:** Logic that needs testing should be in domain, not component.

### 🚩 Red Flag 4: Business Rules in Comments
```tsx
// User story 2.4: Phases must be at least 1 day apart
// and cannot end in the past if they have time allocated
const isValidPhase = () => { /* complex logic */ };
```
**Fix:** Business rules belong in domain with proper documentation.

---

## Quick Extraction Template

When ready to extract, use this template:

```typescript
// src/domain/rules/[FeatureName]Rules.ts

/**
 * [Feature] Business Rules
 * 
 * Extracted from: [ComponentName].tsx
 * Date: [Today's date]
 * 
 * Purpose: [1-2 sentence summary of what this domain does]
 * 
 * Related Components:
 * - [ComponentName].tsx
 * - [OtherComponent].tsx
 */
export class [FeatureName]Rules {
  
  /**
   * [Brief description of what this rule does]
   * 
   * Rule: [Plain English rule]
   * Formula: [If applicable]
   * 
   * @extracted-from [ComponentName].tsx line [X] ([originalFunctionName])
   * 
   * @param [param] - [Description]
   * @returns [Description]
   */
  static [methodName]([params]): [ReturnType] {
    // Implementation
  }
}
```

---

## Your Personal Workflow Checklist

1. **SPIKE:** Build feature in component, mark with `TODO-DOMAIN` comments
2. **VALIDATE:** Get feature working, show to users/stakeholders
3. **EXTRACT:** Within 48 hours, move logic to domain (while fresh)
4. **TEST:** Write domain tests to document rules
5. **REPLACE:** Update component to use domain functions
6. **COMMIT:** Two commits - "Add [feature]" then "Extract [feature] to domain"

---

## Success Metrics

You're doing this right when:

✅ Components are < 200 lines  
✅ Domain rules have `@extracted-from` comments  
✅ Tests cover domain, not components  
✅ Business logic works in Node.js (no React needed)  
✅ New features reuse existing domain rules  
✅ Code reviews focus on domain correctness, not implementation  

---

## Conclusion

**Your instinct is correct:** Build in components first, extract to domain second.

The key is **doing the extraction step systematically**, not skipping it.

- ✅ Spike in components: **1-3 hours**
- ✅ Extract to domain: **2-4 hours** 
- ✅ Total overhead: **~30-50% per feature**

But you get:
- ✅ Testable business logic
- ✅ Reusable across components
- ✅ Clear domain boundaries
- ✅ Easy to onboard new developers
- ✅ Confidence to refactor

**The workflow isn't "sloppy then clean" - it's "exploratory then formalized."**

Your components are laboratories. Your domain is the published research.
