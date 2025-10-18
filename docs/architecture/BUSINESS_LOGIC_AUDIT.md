# Business Logic Audit
## Current State Analysis - Where Business Logic Lives

**Date**: October 18, 2025  
**Purpose**: Map existing business logic locations to plan consolidation  
**Status**: Analysis Complete - Foundation for Refactoring  

---

## Executive Summary

Business logic is currently **fragmented across 5 layers**:
1. Type definitions (structural only)
2. Service layer (partial consolidation)
3. Validator layer (comprehensive but scattered)
4. Context layer (mixed with state management)
5. Database constraints (basic referential integrity)

**Key Finding**: No single source of truth. Rules are duplicated, creating maintenance burden and inconsistency risks.

---

## Detailed Location Analysis

### 1. Type Definitions Layer

**Location**: `src/types/core.ts`

**What's Here**:
- ✅ Entity structure definitions (Project, Milestone, etc.)
- ✅ Interface contracts
- ✅ Documentation of fields

**What's Missing**:
- ❌ No validation logic
- ❌ No business rules
- ❌ No relationship enforcement
- ❌ No calculated properties

**Example**:
```typescript
// Defines WHAT a project is, not HOW it behaves
export interface Project {
  id: string;
  name: string;
  estimatedHours: number;
  // ... but no validation that estimatedHours > 0
}
```

**Issues**:
- Types are "dumb" - just data containers
- Developers must remember rules externally
- Easy to create invalid entities

---

### 2. Unified Service Layer

**Location**: `src/services/unified/`

**Files**:
- `UnifiedProjectService.ts` - Project calculations and domain rules
- `UnifiedMilestoneService.ts` - Milestone calculations
- `UnifiedDayEstimateService.ts` - Timeline estimates
- `UnifiedProjectProgressService.ts` - Progress tracking
- Others...

**What's Here**:
- ✅ **Domain entities embedded** (`UnifiedProjectEntity`, line 330-550)
- ✅ Pure calculation functions
- ✅ Business rule documentation (comments)
- ✅ Some validation (basic)

**Example** (`UnifiedProjectService.ts`, lines 340-362):
```typescript
export class UnifiedProjectEntity {
  /**
   * Domain Rule: Project estimated hours must be positive
   */
  static validateEstimatedHours(hours: number): boolean {
    return hours > 0;
  }

  /**
   * Domain Rule: Project start date must be before end date
   */
  static validateDateRange(startDate: Date, endDate: Date): boolean {
    return startDate < endDate;
  }
  
  /**
   * Domain Rule: Calculate total milestone allocation
   */
  static calculateTotalMilestoneAllocation(milestones: Milestone[]): number {
    return milestones.reduce((sum, m) => sum + (m.timeAllocationHours ?? m.timeAllocation ?? 0), 0);
  }
}
```

**Strengths**:
- Good documentation with "Domain Rule:" labels
- Consolidates calculations
- Static methods (no instantiation needed)

**Issues**:
- Domain entity is **nested inside service file** (not discoverable)
- Not all rules are here (some in validators)
- Doesn't enforce rules automatically
- No central registry of all rules

---

### 3. Validator Layer

**Location**: `src/services/validators/`

**Files**:
- `ProjectValidator.ts` - Project validation orchestration
- `MilestoneValidator.ts` - Milestone validation orchestration
- `CrossEntityValidator.ts` - Multi-entity validation
- `WorkHourValidator.ts` - Work hour validation
- `CalendarEventValidator.ts` - Event validation
- `TimelineValidator.ts` - Timeline validation
- Others...

**What's Here**:
- ✅ **Comprehensive validation logic**
- ✅ Cross-entity relationship checks
- ✅ Detailed error messages
- ✅ Warnings and suggestions
- ✅ Context-aware validation

**Example** (`MilestoneValidator.ts`, lines 68-95):
```typescript
static async validateMilestoneCreation(
  request: CreateMilestoneValidationRequest,
  context: ValidationContext
): Promise<DetailedValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Domain-level validations
  const timeValidation = UnifiedMilestoneEntity.validateMilestoneTime(
    request.timeAllocation,
    context.project.estimatedHours
  );
  errors.push(...timeValidation.errors);
  
  const dateValidation = UnifiedMilestoneEntity.validateMilestoneDate(
    request.dueDate,
    context.project.startDate,
    context.project.endDate,
    context.existingMilestones
  );
  errors.push(...dateValidation.errors);
  
  // Budget impact analysis
  const budgetValidation = UnifiedMilestoneEntity.wouldExceedBudget(
    context.existingMilestones,
    request.timeAllocation,
    context.project.estimatedHours
  );
  
  return { isValid, errors, warnings, suggestions, context };
}
```

**Strengths**:
- Very thorough validation
- Good separation of concerns
- Returns actionable feedback

**Issues**:
- **Calls UnifiedMilestoneEntity** (which doesn't exist as separate file!)
- Validation logic is separate from domain logic
- Must remember to call validators (not automatic)
- Duplicates some rules from Unified services

---

### 4. Context Layer

**Location**: `src/contexts/`

**Files**:
- `ProjectContext.tsx` - Project state and operations
- `PlannerContext.tsx` - Planner view state
- `TimelineContext.tsx` - Timeline state
- Others...

**What's Here**:
- ✅ State management (React hooks)
- ⚠️ Some business logic mixed in
- ⚠️ Operation orchestration
- ❌ Duplicate validations

**Example** (`ProjectContext.tsx`, lines 107-127):
```typescript
const processedMilestones = useMemo(() => (dbMilestones?.map(m => ({
  id: m.id,
  name: m.name,
  projectId: m.project_id,
  
  // OLD fields (for backward compatibility)
  dueDate: new Date(m.due_date),
  timeAllocation: m.time_allocation,
  
  // NEW fields (Phase 5)
  endDate: new Date(m.due_date),
  timeAllocationHours: m.time_allocation_hours ?? m.time_allocation,
  startDate: m.start_date ? new Date(m.start_date) : undefined,
  isRecurring: m.is_recurring ?? false,
  recurringConfig: m.recurring_config as any,
  
  // METADATA
  order: m.order_index,
  userId: m.user_id || '',
  createdAt: m.created_at ? new Date(m.created_at) : new Date(),
  updatedAt: m.updated_at ? new Date(m.updated_at) : new Date()
})) || []).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()), [dbMilestones]);
```

**Issues**:
- **Data transformation logic in context** (should be in repository/service)
- Business rules scattered (sorting, defaults)
- Mixing concerns: state management + business logic
- Hard to test business logic separately

---

### 5. Database Layer

**Location**: `supabase/migrations/`

**What's Here**:
- ✅ Foreign key constraints
- ✅ NOT NULL constraints
- ✅ ON DELETE CASCADE rules
- ✅ Basic data type validation

**What's Missing**:
- ❌ CHECK constraints (e.g., `estimatedHours > 0`)
- ❌ Complex business rule constraints
- ❌ Cross-table validation triggers

**Example** (from SUPABASE_REQUIREMENTS.md):
```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimated_hours DECIMAL(10,2) NOT NULL,
  -- Missing: CHECK (estimated_hours > 0)
  -- Missing: CHECK (start_date < end_date) for non-continuous
);
```

**Issues**:
- Minimal business rule enforcement
- Most validation happens in application layer
- Could add more database-level constraints for safety

---

### 6. Calculation Functions Layer

**Location**: `src/services/calculations/`

**Files**:
- `dateCalculations.ts` - Pure date math
- `milestoneCalculations.ts` - Milestone calculations
- `projectCalculations.ts` - Project calculations
- `timeCalculations.ts` - Time calculations
- `capacityCalculations.ts` - Capacity analysis
- Many others...

**What's Here**:
- ✅ Pure functions (no side effects)
- ✅ Well-documented
- ✅ Reusable calculations

**Example** (`milestoneCalculations.ts`):
```typescript
export function calculateTotalAllocation(milestones: Milestone[]): number {
  return milestones.reduce((sum, m) => sum + (m.timeAllocationHours ?? m.timeAllocation ?? 0), 0);
}

export function calculateBudgetUtilization(allocated: number, budget: number): number {
  return budget > 0 ? (allocated / budget) * 100 : 0;
}
```

**Strengths**:
- Clean, testable functions
- No dependencies
- Easy to reason about

**Issues**:
- Separated from business rules/validation
- No context on WHY calculations exist
- Missing relationship to domain model

---

## Rule Duplication Analysis

### Example: "Milestone dates must be within project range"

**Found in**:
1. ❌ **Not in types** (just interfaces)
2. ✅ `UnifiedProjectEntity.validateMilestoneDate()` (comment only, no code)
3. ✅ `MilestoneValidator.validateMilestoneCreation()`
4. ⚠️ `CrossEntityValidator.validateProjectMilestoneRelationship()`
5. ❌ **Not enforced in database** (no CHECK constraint)

**Result**: Rule documented in 3+ places, actual validation in 2-3 places.

---

### Example: "Milestone allocation ≤ project budget"

**Found in**:
1. ❌ **Not in types**
2. ✅ `UnifiedProjectEntity.analyzeBudget()` - calculates overage
3. ✅ `UnifiedProjectEntity.wouldExceedBudget()` - boolean check
4. ✅ `MilestoneValidator.validateMilestoneCreation()` - validation
5. ✅ `UnifiedMilestoneService.validateBudgetAllocation()` - validation
6. ⚠️ Checks in various components
7. ❌ **Not enforced in database**

**Result**: Same rule in 5+ places!

---

### Example: "Project estimated hours must be > 0"

**Found in**:
1. ❌ **Not in types** (just `number`, no constraint)
2. ✅ `UnifiedProjectEntity.validateEstimatedHours()` - returns boolean
3. ⚠️ `ProjectValidator.validateProjectCreation()` - checks it
4. ⚠️ UI forms validate it
5. ❌ **Not in database** (should be `CHECK (estimated_hours > 0)`)

**Result**: Rule in 3+ places, not at database level.

---

## Relationship Documentation

### Where Relationships Are Defined

**Project → Milestone**:
- ✅ Type: `Milestone.projectId` (foreign key)
- ✅ Database: Foreign key constraint
- ⚠️ Business rules: Scattered (date constraint in validator, budget in entity)
- ❌ Not in single place

**Project → Row → Group**:
- ✅ Type: `Project.rowId`, `Project.groupId`
- ✅ Database: Foreign key constraints
- ⚠️ Hierarchy rules: Implied, not explicit
- ❌ No helper methods for "get group from project"

**Project → Client**:
- ⚠️ Type: `Project.client` (string, not FK)
- ❌ Database: No table for clients
- ❌ No business rules (just text field)
- **Gap identified**: Client should be an entity

---

## Gaps & Issues Summary

### Critical Gaps

1. **No Central Domain Model**
   - Business logic scattered
   - No single "Project" class with all rules
   - Developers must hunt for rules

2. **Rule Duplication**
   - Same rule in 3-5 places
   - Risk of inconsistency when updating

3. **No Discoverability**
   - `UnifiedProjectEntity` hidden in service file
   - No clear entry point for "what are the rules?"

4. **Validation Not Automatic**
   - Must remember to call validators
   - Easy to bypass validation
   - No enforcement at entity creation

5. **Mixed Concerns**
   - Contexts have business logic
   - Components have validation
   - Blurred boundaries

6. **Client Not an Entity**
   - Should be normalized
   - No referential integrity
   - String matching only

### Medium Issues

7. **Database Constraints Weak**
   - Missing CHECK constraints
   - Could enforce more at DB level

8. **No Domain Events**
   - Changes don't notify
   - Hard to audit changes

9. **Limited Business Rule Testing**
   - Rules tested indirectly
   - No dedicated domain test suite

10. **Documentation Scattered**
    - Comments in multiple files
    - No single reference (until now)

---

## Recommendations

### Immediate (Phase 1) ✅ DONE
- [x] Create Business Logic Reference document
- [x] Create this audit document

### Short-term (Phase 2)
- [ ] Create `src/domain/` folder structure
- [ ] Extract domain entities from Unified services
- [ ] Create entity factory functions
- [ ] Add domain-level tests

### Medium-term (Phase 3)
- [ ] Refactor validators to use domain layer
- [ ] Remove duplication
- [ ] Update contexts to delegate to domain
- [ ] Add database CHECK constraints

### Long-term (Phase 4)
- [ ] Normalize Client entity
- [ ] Add domain events
- [ ] Create aggregate roots
- [ ] Full domain-driven design

---

## Proposed Domain Layer Structure

```
src/domain/
├── entities/
│   ├── Project.ts          # Project domain entity with all rules
│   ├── Milestone.ts         # Milestone domain entity
│   ├── Group.ts            # Group domain entity
│   ├── Row.ts              # Row domain entity
│   ├── CalendarEvent.ts    # Event domain entity
│   └── index.ts
├── value-objects/
│   ├── TimeAllocation.ts   # Time allocation value object
│   ├── DateRange.ts        # Date range value object
│   └── index.ts
├── services/
│   ├── ProjectBudgetService.ts     # Domain service for budget logic
│   ├── MilestoneDistributionService.ts
│   └── index.ts
├── rules/
│   ├── ProjectRules.ts     # All project business rules
│   ├── MilestoneRules.ts   # All milestone business rules
│   └── index.ts
└── index.ts
```

### Example: Domain Entity

```typescript
// src/domain/entities/Project.ts
import { ProjectRules } from '../rules/ProjectRules';
import { Milestone } from './Milestone';

export class Project {
  constructor(
    public id: string,
    public name: string,
    public estimatedHours: number,
    public startDate: Date,
    public endDate: Date,
    // ... other properties
  ) {
    // Validate on construction
    this.validate();
  }
  
  private validate(): void {
    const validation = ProjectRules.validate(this);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
  }
  
  // Domain methods
  canAddMilestone(milestone: Milestone): boolean {
    return ProjectRules.canAccommodateMilestone(this, milestone);
  }
  
  getDuration(): number {
    return ProjectRules.calculateDuration(this.startDate, this.endDate);
  }
  
  getBudgetAnalysis(milestones: Milestone[]): ProjectBudgetAnalysis {
    return ProjectRules.analyzeBudget(this, milestones);
  }
}
```

### Benefits of Proposed Structure

1. **Single Source of Truth**: All project rules in `ProjectRules.ts`
2. **Discoverable**: Clear folder structure
3. **Enforceable**: Validation happens at construction
4. **Testable**: Domain logic separate from infrastructure
5. **Maintainable**: One place to update rules
6. **Documented**: Rules are code, not scattered comments

---

## Migration Strategy

### Incremental Approach (Recommended)

**Week 1-2**:
- Create domain folder structure
- Move `UnifiedProjectEntity` → `src/domain/entities/Project.ts`
- Move `UnifiedMilestoneEntity` → `src/domain/entities/Milestone.ts`
- Keep old code working (don't break anything)

**Week 3-4**:
- Update validators to import from domain layer
- Consolidate duplicate rules
- Add domain tests

**Week 5-6**:
- Update contexts to use domain entities
- Remove duplication from contexts
- Update components gradually

**Week 7-8**:
- Add database CHECK constraints
- Final cleanup
- Remove deprecated code

### Risk Mitigation
- Keep old code until new code is proven
- Feature flag new domain layer
- Comprehensive testing at each step
- Rollback plan if issues found

---

## Success Metrics

After migration, we should see:

1. **Reduced Code**: 30-40% less code due to deduplication
2. **Improved Testability**: Domain layer has 90%+ test coverage
3. **Faster Debugging**: Single place to check for bugs
4. **Fewer Bugs**: Validation always applied, no bypassing
5. **Better Onboarding**: New devs have reference document
6. **Easier Changes**: Update rule in one place, not 5

---

## Conclusion

Current state is **fragmented but functional**. Business logic exists but is scattered. The proposed domain layer will:

✅ Centralize business logic  
✅ Eliminate duplication  
✅ Improve maintainability  
✅ Serve as single source of truth  
✅ Make relationships explicit  

**Next Action**: Review this audit with team, then proceed with Phase 2 implementation.

---

**Document Version**: 1.0  
**Last Updated**: October 18, 2025  
**Status**: Complete - Ready for Phase 2
