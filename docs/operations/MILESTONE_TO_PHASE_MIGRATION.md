# Milestone → Phase Migration Plan

**Created:** December 27, 2025  
**Status:** 🚀 Ready to Execute  
**Estimated Duration:** 3-4 weeks  

---

## 📋 Executive Summary

This document outlines the comprehensive migration plan to rename "Milestone" to "Phase" throughout the codebase, aligning with the updated App Logic and Business Logic documentation.

### Why This Matters:
- ✅ **Terminology alignment** - App Logic & Business Logic already use "Phase"
- ✅ **Code clarity** - Eliminates confusion between milestone/phase references
- ✅ **Single source of truth** - Code matches documentation
- ✅ **Foundation for growth** - Clean terminology enables future features

### Migration Scope:
- **~100+ files** across all layers
- **Database table rename** (milestones → phases)
- **Type definitions** update
- **All calculations** using phase terminology
- **Complete UI/UX** update

---

## 🎯 Priority Assessment: Start with Calculations!

**YES - Start with calculations layer first!** Here's why:

1. **Calculations are the foundation** - They don't depend on UI/database terminology but are used everywhere
2. **High impact, low risk** - Pure functions are easy to rename/test without breaking anything
3. **Sets correct terminology precedent** - Forces correct usage downstream
4. **Aligns with docs** - App Logic & Business Logic already use "Phase"
5. **Types follow calculations** - Once calculations use Phase types, everything else follows naturally

---

## 🏗️ Migration Strategy: Bottom-Up Approach

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 0: Types (First - Foundation for Everything)         │ ← START HERE
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Calculations (Pure Math Functions)                │ ← THEN THIS
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Domain Rules (Business Logic)                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Unified Services (Business Calculations)          │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Orchestrators (Workflows)                         │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Hooks (Data Access)                               │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: Components (UI)                                   │
├─────────────────────────────────────────────────────────────┤
│ Layer 7: Performance & Infrastructure                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 8: Database Migration (LAST - After All Code)        │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Start at the foundation (types + calculations) and work upward. Each layer depends on the layers below it.

---

## 🎯 **LAYER 0: Types** (START HERE - Day 1)

### Why First?
- ✅ Types are imported everywhere - change once, cascade everywhere
- ✅ TypeScript compiler will find ALL usages for us
- ✅ Immediate feedback on what breaks
- ✅ Forces us to touch every file systematically

### Files to Update:

**1. Core Type Definitions**
```typescript
// src/types/core.ts (or database.types.ts)

// BEFORE:
export interface Milestone {
  id: string;
  projectId: string;
  timeAllocationHours: number;
  // ... other properties
}

// AFTER:
export interface Phase {
  id: string;
  projectId: string;
  timeAllocationHours: number;
  // ... other properties
}

// Add deprecated alias for backward compatibility during migration
/** @deprecated Use Phase instead. Will be removed after migration. */
export type Milestone = Phase;
```

**2. Database Type Definitions**
```typescript
// src/types/database.types.ts (if separate from core.ts)

// Update Table definitions
Tables: {
  phases: {  // Renamed from milestones
    Row: Phase;
    Insert: PhaseInsert;
    Update: PhaseUpdate;
  }
  // Keep deprecated alias temporarily
  /** @deprecated Use 'phases' instead */
  milestones: Tables['phases'];
}
```

**3. Type Exports**
```typescript
// src/types/index.ts
export type { Phase, PhaseInsert, PhaseUpdate } from './core';
// Deprecated exports
/** @deprecated Use Phase instead */
export type { Milestone } from './core';
```

### Success Criteria:
- [ ] `Phase` type defined in core.ts
- [ ] `Milestone` type is alias to `Phase` (backward compatibility)
- [ ] All type exports updated
- [ ] TypeScript compiler runs (may have errors - that's OK, they guide us)

### Migration Strategy:
1. Add new `Phase` type
2. Make `Milestone` an alias: `type Milestone = Phase`
3. Don't remove `Milestone` yet - it provides backward compatibility
4. Each subsequent layer will switch from `Milestone` to `Phase`
5. Remove `Milestone` alias in Layer 8 (final cleanup)

---

## 🎯 **LAYER 1: Calculations Layer** (Days 2-3)

### Why Second?
- ✅ Now that types are defined, calculations can use `Phase` type
- ✅ Pure functions - no side effects, safe to change
- ✅ Sets terminology standard for all dependent code
- ✅ Currently using outdated `Milestone` types
- ✅ Not aligned with App Logic/Business Logic docs

### Files to Update:

**High Priority:**

**1. Rename Main Calculation File**
```bash
# File rename
src/services/calculations/projects/milestoneCalculations.ts 
  → phaseCalculations.ts
```

**2. Update All Function Names & Types**
```typescript
// BEFORE (milestoneCalculations.ts):
import { Milestone } from '@/types/core';

export function calculateMilestoneDensity(
  milestones: Milestone[],
  startDate: Date,
  endDate: Date
): number { ... }

export function calculateTotalAllocation(milestones: Milestone[]): number { ... }

// AFTER (phaseCalculations.ts):
import { Phase } from '@/types/core';

export function calculatePhaseDensity(
  phases: Phase[],
  startDate: Date,
  endDate: Date
): number { ... }

export function calculateTotalAllocation(phases: Phase[]): number { ... }
```

**3. Update Function Names Throughout File (~40+ functions)**
- `calculateMilestoneDensity` → `calculatePhaseDensity`
- `calculateAverageMilestoneAllocation` → `calculateAveragePhaseAllocation`
- `calculateOptimalMilestoneSpacing` → `calculateOptimalPhaseSpacing`
- `calculateMilestoneVelocity` → `calculatePhaseVelocity`
- `calculateSuggestedMilestoneBudget` → `calculateSuggestedPhaseBudget`
- `sortMilestonesByDate` → `sortPhasesByDate`
- `findMilestoneGap` → `findPhaseGap`
- `calculateRecurringMilestoneCount` → `calculateRecurringPhaseCount`
- `generateRecurringMilestoneDates` → `generateRecurringPhaseDates`
- `getMilestoneSegmentForDate` → `getPhaseSegmentForDate`
- `calculateMilestoneSegments` → `calculatePhaseSegments`
- Type: `MilestoneSegment` → `PhaseSegment`

**4. Update Other Calculation Files**
```typescript
// src/services/calculations/availability/dailyMetrics.ts

// BEFORE:
import type { Milestone } from '@/types/core';

function calculateDailyPlanned(
  milestones: Milestone[] = [],
  ...
) { ... }

// AFTER:
import type { Phase } from '@/types/core';

function calculateDailyPlanned(
  phases: Phase[] = [],
  ...
) { ... }
```

**5. Update Barrel Exports**
```typescript
// src/services/calculations/index.ts

// BEFORE:
export {
  calculateMilestoneDensity,
  calculateAverageMilestoneAllocation,
  // ... other milestone functions
} from './projects/milestoneCalculations';

// AFTER:
export {
  calculatePhaseDensity,
  calculateAveragePhaseAllocation,
  // ... other phase functions
} from './projects/phaseCalculations';
```

**6. Update Internal Documentation**
```typescript
// Update JSDoc comments
/**
 * Phase Calculations
 * 
 * Pure mathematical functions for phase-related calculations.
 * No side effects, no external dependencies, fully testable.
 * 
 * @see docs/core/Business Logic.md - Calculation Rules section
 */
```

### Files List:
1. `src/services/calculations/projects/milestoneCalculations.ts` → **rename** `phaseCalculations.ts` (~831 lines)
2. `src/services/calculations/availability/dailyMetrics.ts` (update parameters)
3. `src/services/calculations/index.ts` (update exports)

### Success Criteria:
- [ ] No files in `calculations/` reference "milestone" in code
- [ ] All pure math functions use `Phase` type
- [ ] All function names use "phase" terminology
- [ ] Barrel exports updated
- [ ] Functions align with Business Logic.md formulas
- [ ] JSDoc comments reference Business Logic.md

---

## 🎯 **LAYER 2: Domain Rules** (Days 4-6)

### Current State:
- ✅ `PhaseRules.ts` already exists (196 lines)
- ⚠️ `MilestoneRules.ts` still exists and actively used
- ❌ Code imports both, causing confusion

### Action Plan:

**1. Audit & Compare**
```bash
# Compare the two files
diff src/domain/rules/MilestoneRules.ts src/domain/rules/PhaseRules.ts
```

**2. Consolidate Logic**
```typescript
// src/domain/rules/PhaseRules.ts

// Ensure all methods from MilestoneRules are present
export class PhaseRules {
  /**
   * Validate phase time allocation
   * @see docs/core/Business Logic.md - Rule 4: Non-Negative Time Allocations
   */
  static validateTimeAllocation(hours: number): boolean {
    return hours > 0;
  }

  /**
   * Validate phase dates within project
   * @see docs/core/Business Logic.md - Rule 2: Phase Date Constraint
   */
  static validatePhaseDateWithinProject(
    phaseEndDate: Date,
    projectStartDate: Date,
    projectEndDate: Date | null
  ): ValidationResult {
    // Implementation
  }

  /**
   * Check budget constraint
   * @see docs/core/Business Logic.md - Rule 1: Phase Budget Constraint
   */
  static checkBudgetConstraint(
    phases: Phase[],
    projectBudget: number
  ): BudgetCheckResult {
    const totalAllocated = phases.reduce((sum, p) => sum + p.timeAllocationHours, 0);
    return {
      isValid: totalAllocated <= projectBudget,
      totalAllocated,
      projectBudget,
      overage: Math.max(0, totalAllocated - projectBudget)
    };
  }

  // ... all other methods
}
```

**3. Mark MilestoneRules as Deprecated**
```typescript
// src/domain/rules/MilestoneRules.ts

/**
 * @deprecated Use PhaseRules instead. This file will be removed after migration.
 * All new code should import from PhaseRules.
 */
export class MilestoneRules {
  /** @deprecated Use PhaseRules.validateTimeAllocation */
  static validateTimeAllocation(hours: number): boolean {
    return PhaseRules.validateTimeAllocation(hours);
  }
  
  // Delegate all methods to PhaseRules
}
```

**4. Update Exports**
```typescript
// src/domain/rules/index.ts

export * from './PhaseRules';
// Keep for backward compatibility during migration
/** @deprecated Use PhaseRules instead */
export * from './MilestoneRules';
```

**5. Update Tests**
```bash
# Rename test files
src/domain/rules/__tests__/MilestoneRules.test.ts 
  → PhaseRules.test.ts
```

```typescript
// Update test imports and assertions
import { PhaseRules } from '@/domain/rules/PhaseRules';

describe('PhaseRules.validateTimeAllocation', () => {
  it('should validate positive allocation', () => {
    expect(PhaseRules.validateTimeAllocation(10)).toBe(true);
  });
});
```

### Success Criteria:
- [ ] PhaseRules.ts has all validation logic
- [ ] MilestoneRules.ts delegates to PhaseRules (deprecated)
- [ ] All business rules reference App Logic.md with `@see` tags
- [ ] Tests renamed and updated
- [ ] No new code imports MilestoneRules

---

## 🎯 **LAYER 3: Unified Services** (Days 7-10)

### Files to Update:

**1. Create UnifiedPhaseService.ts (or rename UnifiedMilestoneService.ts)**

```typescript
// src/services/unified/UnifiedPhaseService.ts

import { Phase } from '@/types/core';
import { PhaseRules } from '@/domain/rules/PhaseRules';
import * as PhaseCalculations from '@/services/calculations/projects/phaseCalculations';

export class UnifiedPhaseService {
  /**
   * Analyze phase budget for a project
   * @see docs/core/Business Logic.md - Calculation Rules section
   */
  static analyzeProjectPhases(
    project: Project,
    phases: Phase[]
  ): PhaseAnalysis {
    const totalAllocated = PhaseCalculations.calculateTotalAllocation(phases);
    const budgetCheck = PhaseRules.checkBudgetConstraint(phases, project.estimatedHours);
    
    return {
      totalAllocated,
      remaining: project.estimatedHours - totalAllocated,
      utilization: PhaseCalculations.calculateBudgetUtilization(
        totalAllocated, 
        project.estimatedHours
      ),
      isOverBudget: !budgetCheck.isValid,
      overage: budgetCheck.overage
    };
  }

  // ... other methods
}
```

**2. Update UnifiedProjectService.ts**
```typescript
// Replace all milestone references

// BEFORE:
import { UnifiedMilestoneService } from './UnifiedMilestoneService';

analyzeProjectMilestones(project: Project, milestones: Milestone[]) {
  return UnifiedMilestoneService.analyze(project, milestones);
}

// AFTER:
import { UnifiedPhaseService } from './UnifiedPhaseService';

analyzeProjectPhases(project: Project, phases: Phase[]) {
  return UnifiedPhaseService.analyze(project, phases);
}

// Add deprecated alias method
/** @deprecated Use analyzeProjectPhases instead */
analyzeProjectMilestones(project: Project, phases: Phase[]) {
  return this.analyzeProjectPhases(project, phases);
}
```

**3. Update UnifiedDayEstimateService.ts**
```typescript
// Update to use Phase type and phaseCalculations

import { Phase } from '@/types/core';
import * as PhaseCalculations from '@/services/calculations/projects/phaseCalculations';

calculateAutoEstimate(
  project: Project,
  phases: Phase[],
  date: Date
): number {
  // Use PhaseCalculations functions
  const segments = PhaseCalculations.calculatePhaseSegments(phases, project);
  // ... rest of logic
}
```

**4. Update Other Unified Services**
- UnifiedTimelineService.ts
- UnifiedProjectProgressService.ts
- Any other services referencing milestones

**5. Update Service Exports**
```typescript
// src/services/unified/index.ts

export * from './UnifiedPhaseService';
// Deprecated
/** @deprecated Use UnifiedPhaseService */
export * from './UnifiedMilestoneService';
```

### Success Criteria:
- [ ] All unified services use `Phase` type
- [ ] Services call `PhaseRules` (not MilestoneRules)
- [ ] Services call `phaseCalculations` (not milestoneCalculations)
- [ ] Deprecated methods provide backward compatibility
- [ ] Business calculations align with Business Logic.md

---

## 🎯 **LAYER 4: Orchestrators** (Days 11-13)

### Files to Update:

**1. ProjectOrchestrator.ts**
```typescript
// BEFORE:
import { MilestoneRules } from '@/domain/rules/MilestoneRules';
import { UnifiedMilestoneService } from '@/services/unified/UnifiedMilestoneService';

async analyzeProjectMilestones(projectId: string) {
  const milestones = await this.getMilestones(projectId);
  const validation = MilestoneRules.checkBudgetConstraint(milestones, project.estimatedHours);
  // ...
}

// AFTER:
import { PhaseRules } from '@/domain/rules/PhaseRules';
import { UnifiedPhaseService } from '@/services/unified/UnifiedPhaseService';

async analyzeProjectPhases(projectId: string) {
  const phases = await this.getPhases(projectId);
  const validation = PhaseRules.checkBudgetConstraint(phases, project.estimatedHours);
  // ...
}

// Deprecated alias
/** @deprecated Use analyzeProjectPhases */
async analyzeProjectMilestones(projectId: string) {
  return this.analyzeProjectPhases(projectId);
}
```

**2. Create/Update ProjectPhaseOrchestrator.ts**

If separate orchestrator exists for phase operations:
```typescript
// src/services/orchestrators/ProjectPhaseOrchestrator.ts

import { Phase } from '@/types/core';
import { PhaseRules } from '@/domain/rules/PhaseRules';
import { UnifiedPhaseService } from '@/services/unified/UnifiedPhaseService';

export class ProjectPhaseOrchestrator {
  static async createPhase(
    projectId: string,
    phaseData: PhaseInsert
  ): Promise<OperationResult<Phase>> {
    // Validate
    const validation = PhaseRules.validatePhaseDateWithinProject(/* ... */);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    // Check budget
    const phases = await this.getProjectPhases(projectId);
    const budgetCheck = PhaseRules.checkBudgetConstraint([...phases, phaseData], project.estimatedHours);
    if (!budgetCheck.isValid) {
      return { success: false, error: 'Budget exceeded' };
    }

    // Save to database
    const { data, error } = await supabase
      .from('phases')  // Note: still 'milestones' until DB migration
      .insert(phaseData);

    return { success: !error, data };
  }

  // ... other workflow methods
}
```

**3. Update Other Orchestrators**
- Search all orchestrators for milestone references
- Update variable names, method names, imports

### Success Criteria:
- [ ] No orchestrator imports MilestoneRules
- [ ] All validation uses PhaseRules
- [ ] Workflow methods use "phase" terminology
- [ ] Clear separation of concerns
- [ ] Deprecated methods provide compatibility

---

## 🎯 **LAYER 5: Hooks** (Days 14-17)

### Directory Restructure:

**1. Rename Hook Directory**
```bash
src/hooks/milestone/ → src/hooks/phase/
```

**2. Rename Hook Files**
```bash
src/hooks/milestone/useMilestoneOperations.ts → src/hooks/phase/usePhaseOperations.ts
src/hooks/milestone/useMilestoneBudget.ts → src/hooks/phase/usePhaseBudget.ts
src/hooks/milestone/useRecurringMilestones.ts → src/hooks/phase/useRecurringPhases.ts
src/hooks/useMilestones.ts → src/hooks/usePhases.ts
```

**3. Update Hook Implementation**
```typescript
// src/hooks/phase/usePhaseOperations.ts

import { Phase, PhaseInsert, PhaseUpdate } from '@/types/core';
import { ProjectPhaseOrchestrator } from '@/services/orchestrators/ProjectPhaseOrchestrator';

export interface LocalPhase extends Omit<Phase, 'id'> {
  id?: string;
  isNew?: boolean;
}

export function usePhaseOperations() {
  const createPhase = async (projectId: string, phaseData: PhaseInsert) => {
    return ProjectPhaseOrchestrator.createPhase(projectId, phaseData);
  };

  const updatePhase = async (phaseId: string, updates: PhaseUpdate) => {
    return ProjectPhaseOrchestrator.updatePhase(phaseId, updates);
  };

  const deletePhase = async (phaseId: string) => {
    return ProjectPhaseOrchestrator.deletePhase(phaseId);
  };

  return { createPhase, updatePhase, deletePhase };
}
```

**4. Update usePhaseBudget.ts**
```typescript
// src/hooks/phase/usePhaseBudget.ts

import { Phase, Project } from '@/types/core';
import { UnifiedPhaseService } from '@/services/unified/UnifiedPhaseService';

interface UsePhaseBudgetConfig {
  projectPhases: Phase[];
  projectEstimatedHours: number;
  // ... other config
}

export function usePhaseBudget(config: UsePhaseBudgetConfig) {
  const { projectPhases, projectEstimatedHours } = config;

  const budgetAnalysis = useMemo(() => {
    return UnifiedPhaseService.analyzeProjectPhases(project, projectPhases);
  }, [projectPhases, projectEstimatedHours]);

  return {
    totalAllocated: budgetAnalysis.totalAllocated,
    remaining: budgetAnalysis.remaining,
    // ... other return values
  };
}
```

**5. Update usePhases.ts (Database Hook)**
```typescript
// src/hooks/usePhases.ts

import { Database } from '@/types/database.types';

// Note: Database table is still 'milestones' until Layer 8
type PhaseRow = Database['public']['Tables']['milestones']['Row'];
type PhaseInsert = Database['public']['Tables']['milestones']['Insert'];
type PhaseUpdate = Database['public']['Tables']['milestones']['Update'];

export function usePhases() {
  const { data: phases, error } = useQuery({
    queryKey: ['phases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('milestones')  // Still using old table name
        .select('*');
      
      return data as Phase[];
    }
  });

  return { phases, error };
}
```

**6. Update usePhaseResize.ts**
```typescript
// Already partially updated, complete the migration

import { Phase, Project } from '@/types/core';
import { getPhases } from '@/domain/rules/PhaseRules';

interface UsePhaseResizeProps {
  phases: Phase[];
  project: Project;
  updatePhase: (phaseId: string, updates: Partial<Phase>) => Promise<void>;
}

export function usePhaseResize({ phases, project, updatePhase }: UsePhaseResizeProps) {
  // Update all internal variable names
  const projectPhases = phases.filter(p => p.projectId === project.id);
  
  // ... rest of hook using 'phase' terminology
}
```

**7. Update Hook Exports**
```typescript
// src/hooks/index.ts

export * from './usePhases';
export * from './phase/usePhaseOperations';
export * from './phase/usePhaseBudget';
export * from './phase/useRecurringPhases';

// Deprecated
/** @deprecated Use usePhases */
export * from './useMilestones';
```

### Success Criteria:
- [ ] All hook files renamed
- [ ] All hook methods use `Phase` type
- [ ] Database queries still use 'milestones' table (temporary)
- [ ] Hook documentation updated
- [ ] Exports updated

---

## 🎯 **LAYER 6: Components** (Days 18-21)

### Files to Update:

**1. Rename Component Files**
```bash
src/components/features/project/ProjectMilestoneSection.tsx 
  → ProjectPhaseSection.tsx

src/components/debug/OrphanedMilestonesCleaner.tsx 
  → OrphanedPhasesCleaner.tsx
```

**2. Update Component Props & State**
```typescript
// ProjectPhaseSection.tsx

// BEFORE:
interface ProjectMilestoneSectionProps {
  project: Project;
  milestones: Milestone[];
  onMilestoneUpdate: (id: string, updates: Partial<Milestone>) => void;
}

export function ProjectMilestoneSection({ 
  project, 
  milestones, 
  onMilestoneUpdate 
}: ProjectMilestoneSectionProps) {
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  // ...
}

// AFTER:
interface ProjectPhaseSectionProps {
  project: Project;
  phases: Phase[];
  onPhaseUpdate: (id: string, updates: Partial<Phase>) => void;
}

export function ProjectPhaseSection({ 
  project, 
  phases, 
  onPhaseUpdate 
}: ProjectPhaseSectionProps) {
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  // ...
}
```

**3. Update Component Hooks Usage**
```typescript
// Inside component

// BEFORE:
const { milestones } = useMilestones();
const { createMilestone, updateMilestone } = useMilestoneOperations();
const budgetAnalysis = useMilestoneBudget({ projectMilestones: milestones });

// AFTER:
const { phases } = usePhases();
const { createPhase, updatePhase } = usePhaseOperations();
const budgetAnalysis = usePhaseBudget({ projectPhases: phases });
```

**4. Update JSX/UI Text**
```tsx
// Update user-facing text

// BEFORE:
<h2>Project Milestones</h2>
<button>Add Milestone</button>
<p>No milestones yet</p>

// AFTER:
<h2>Project Phases</h2>
<button>Add Phase</button>
<p>No phases yet</p>
```

**5. Update Component Exports**
```typescript
// src/components/features/project/index.ts

export { ProjectPhaseSection } from './ProjectPhaseSection';

// src/components/debug/index.ts
export { OrphanedPhasesCleaner } from './OrphanedPhasesCleaner';
```

**6. Search All Components**
```bash
# Find all remaining references
grep -r "milestone" src/components/ --include="*.tsx" --include="*.ts"
grep -r "Milestone" src/components/ --include="*.tsx" --include="*.ts"
```

### Success Criteria:
- [ ] All component files renamed
- [ ] All props use `Phase` types
- [ ] All hooks use phase terminology
- [ ] UI text uses "Phase" (user-facing)
- [ ] No visual regressions
- [ ] All component exports updated

---

## 🎯 **LAYER 7: Performance & Infrastructure** (Days 22-23)

### Files to Update:

**1. calculationCache.ts**
```typescript
// src/services/performance/calculationCache.ts

import type { Phase } from '@/types/core';

type PhaseHashInput = Partial<Phase> & {
  projectId?: string;
};

class CalculationCache {
  // ... existing code

  initialize() {
    // Phase calculations cache (renamed from milestone)
    this.initializeCache('phaseCalculations', {
      maxSize: 500,
      ttl: 5 * 60 * 1000,
      name: 'Phase Calculations'
    });
  }

  /**
   * Generate cache key for phase calculations
   */
  static generatePhaseCacheKey(
    phaseId: string,
    projectId: string,
    additionalParams: string = ''
  ): string {
    return `phase-${phaseId}-${projectId}-${additionalParams}`;
  }

  /**
   * Create hash from phase-relevant parameters
   */
  static hashPhaseParams(
    phase: PhaseHashInput | null,
    project: Partial<Project> | null,
    // ... other params
  ): string {
    const phaseHash = phase 
      ? `${phase.id ?? 'unknown'}-${phase.targetDate ?? 'null'}-${phase.estimatedHours ?? 'null'}`
      : 'null';
    
    // ... rest of hash calculation
    return `${phaseHash}|${projectHash}|${settingsHash}|...`;
  }

  /**
   * Get phase cache statistics
   */
  static getPhaseStats(): CacheStats {
    const cache = this.caches.get('phaseCalculations');
    return cache?.getStats() || this.emptyStats;
  }
}
```

**2. ErrorHandlingService.ts**
```typescript
// Update error messages

// BEFORE:
'Project has no milestones'

// AFTER:
'Project has no phases'
```

**3. Performance Monitoring**
```typescript
// Update any performance metric names
performanceMetrics.track('phase-calculation-time', duration);
performanceMetrics.track('phase-validation-time', duration);
```

### Success Criteria:
- [ ] Cache keys use "phase" terminology
- [ ] Error messages reference "phases"
- [ ] Performance monitoring updated
- [ ] No "milestone" references in infrastructure

---

## 🎯 **LAYER 8: Database Migration** (Days 24-25 - FINAL STEP)

**⚠️ DO THIS LAST - After ALL code is updated to use Phase terminology**

### Pre-Migration Checklist:
- [ ] All code layers (0-7) completed
- [ ] All TypeScript compilation succeeds
- [ ] All tests pass
- [ ] Manual testing completed
- [ ] Backup plan documented

### Migration Steps:

**1. Create Supabase Migration**
```sql
-- Migration: 20250127000000_rename_milestones_to_phases.sql

-- Step 1: Rename the table
ALTER TABLE milestones RENAME TO phases;

-- Step 2: Update any foreign key constraint names (if needed)
ALTER TABLE phases RENAME CONSTRAINT milestones_project_id_fkey TO phases_project_id_fkey;
ALTER TABLE phases RENAME CONSTRAINT milestones_user_id_fkey TO phases_user_id_fkey;

-- Step 3: Update indexes
ALTER INDEX milestones_pkey RENAME TO phases_pkey;
ALTER INDEX idx_milestones_project_id RENAME TO idx_phases_project_id;
ALTER INDEX idx_milestones_user_id RENAME TO idx_phases_user_id;

-- Step 4: Update any RLS policies
-- (List and rename policies as needed)

-- Step 5: Create view for backward compatibility (temporary)
CREATE VIEW milestones AS SELECT * FROM phases;

-- Note: Drop this view after migration is complete and verified
```

**2. Regenerate Supabase Types**
```bash
# Generate new types from updated schema
npx supabase gen types typescript --local > src/types/database.types.ts

# Or if using remote
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

**3. Update All Database Queries**
```typescript
// src/hooks/usePhases.ts

// BEFORE (during transition):
const { data } = await supabase.from('milestones').select('*');

// AFTER (post-migration):
const { data } = await supabase.from('phases').select('*');
```

**4. Remove Backward Compatibility**

```typescript
// src/types/core.ts
// Remove the deprecated Milestone alias
// export type Milestone = Phase;  // DELETE THIS LINE

// src/domain/rules/MilestoneRules.ts
// DELETE ENTIRE FILE (or archive)

// src/services/unified/UnifiedMilestoneService.ts
// DELETE ENTIRE FILE (or archive)
```

**5. Cleanup Deprecated Exports**
```typescript
// Remove all @deprecated exports from:
// - src/types/index.ts
// - src/domain/rules/index.ts
// - src/services/unified/index.ts
// - src/services/orchestrators/index.ts
// - src/hooks/index.ts
```

**6. Drop Compatibility View**
```sql
-- After verification, remove backward compatibility
DROP VIEW milestones;
```

### Post-Migration Verification:
```bash
# Should return 0 (except in archived/deleted files)
grep -r "milestone" src/ --include="*.ts" --include="*.tsx" | wc -l

# Should return 0
grep -r "MilestoneRules" src/ --include="*.ts" | wc -l

# Should return 0
grep -r "from 'milestones'" src/ --include="*.ts" | wc -l
```

### Success Criteria:
- [ ] Database table renamed to 'phases'
- [ ] All foreign keys updated
- [ ] All indexes renamed
- [ ] Types regenerated
- [ ] All queries use 'phases' table
- [ ] Deprecated code removed
- [ ] All tests pass
- [ ] Production deployment successful

---

## 🚀 Recommended Execution Timeline

### **Week 1: Foundation (Types + Calculations + Domain)**
- **Day 1:** Layer 0 - Types (add Phase, alias Milestone)
- **Day 2-3:** Layer 1 - Calculations layer
- **Day 4-6:** Layer 2 - Domain rules consolidation
- **Day 7:** Buffer/testing

### **Week 2: Services (Unified + Orchestrators)**
- **Day 8-10:** Layer 3 - Unified services
- **Day 11-13:** Layer 4 - Orchestrators
- **Day 14:** Buffer/testing

### **Week 3: User-Facing (Hooks + Components)**
- **Day 15-17:** Layer 5 - Hooks
- **Day 18-21:** Layer 6 - Components

### **Week 4: Cleanup (Infrastructure + Database + Final)**
- **Day 22-23:** Layer 7 - Performance/infrastructure
- **Day 24-25:** Layer 8 - Database migration
- **Day 26-27:** Final testing, documentation, cleanup
- **Day 28:** Production deployment & monitoring

---

## ✅ Success Metrics

### During Migration:
```bash
# Track progress - should decrease to 0
grep -r "milestone" src/ --include="*.ts" --include="*.tsx" | wc -l
grep -r "Milestone" src/ --include="*.ts" --include="*.tsx" | wc -l

# Should decrease to 0
grep -r "MilestoneRules" src/ --include="*.ts" | wc -l
grep -r "milestoneCalculations" src/ --include="*.ts" | wc -l
```

### After Complete Migration:
```bash
# Should return 0 results (except in archived files)
grep -r "milestone" src/ --include="*.ts" --include="*.tsx" | grep -v "deprecated" | wc -l
grep -r "MilestoneRules" src/ --include="*.ts" | grep -v "deprecated" | wc -l

# Documentation should be fully aligned
grep -r "milestone" docs/core/*.md | wc -l  # Should be 0
```

### Quality Gates:
- [ ] All TypeScript compilation succeeds (no errors)
- [ ] All tests pass (unit, integration)
- [ ] No console errors in development
- [ ] No console errors in production
- [ ] All documentation updated
- [ ] Architecture Guide reflects new structure
- [ ] User Guide updated (if user-facing changes)

---

## 🎯 Migration Principles

### The Golden Rules:
1. **Types First, Always** - Start with type definitions, let compiler guide you
2. **Bottom-Up Migration** - Foundation layers before dependent layers
3. **Maintain Backward Compatibility** - Use aliases and deprecated tags during transition
4. **One Layer at a Time** - Complete each layer before moving to next
5. **Test Continuously** - Run tests after each layer completion
6. **Documentation Alignment** - Code must match App Logic & Business Logic docs
7. **Database Last** - Update all code before touching database

### Backward Compatibility Strategy:
```typescript
// During migration (Layers 0-7):
export type Milestone = Phase;  // Alias for compatibility

// After database migration (Layer 8):
// Remove alias, force adoption of Phase
```

### Rollback Plan:
- Each layer is independently committable
- Git tags at each layer completion
- Can rollback to any completed layer
- Database migration is separate PR (easy to revert)

---

## 📋 Pre-Flight Checklist

Before starting Layer 0:
- [ ] Backup database
- [ ] Create feature branch: `feature/milestone-to-phase-migration`
- [ ] Notify team of migration timeline
- [ ] Review App Logic.md for Phase definitions
- [ ] Review Business Logic.md for Phase rules
- [ ] Set up testing environment

---

## 🔄 Migration Commands Reference

### Useful Search Commands:
```bash
# Find all milestone references
grep -r "milestone" src/ --include="*.ts" --include="*.tsx"

# Find all Milestone type usage
grep -r "Milestone" src/ --include="*.ts" --include="*.tsx"

# Find all MilestoneRules imports
grep -r "from.*MilestoneRules" src/ --include="*.ts"

# Count remaining references
grep -r "milestone" src/ --include="*.ts" --include="*.tsx" | wc -l
```

### Useful Rename Commands:
```bash
# Rename file
git mv src/path/oldFile.ts src/path/newFile.ts

# Rename directory
git mv src/hooks/milestone src/hooks/phase
```

---

## 📞 Questions & Decisions Needed

### Open Questions:
1. Should we keep UnifiedMilestoneService as deprecated alias, or force all code to use UnifiedPhaseService immediately?
2. Should database migration happen in production during off-hours?
3. Should we create a feature flag to toggle old/new terminology in UI during transition?

### Decisions Log:
- **Dec 27, 2025:** Decided to use bottom-up migration approach starting with types
- **Dec 27, 2025:** Decided to maintain backward compatibility during code migration
- **Dec 27, 2025:** Decided database migration is final step after all code updated

---

## 📚 Reference Documentation

### Primary References:
- **App Logic.md** - Source of truth for Phase concept definition
- **Business Logic.md** - Detailed Phase business rules and calculations
- **Architecture Guide.md** - Updated to reflect Phase terminology

### Related Documents:
- **User Guide.md** - Migration troubleshooting guide
- **Testing Guide.md** - Testing strategy for migration

---

**Last Updated:** December 27, 2025  
**Next Review:** After Layer 0 completion  
**Status:** 🚀 Ready to Execute - Layer 0 (Types) is first step
