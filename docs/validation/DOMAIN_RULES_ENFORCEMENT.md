# Domain Rules Enforcement Strategy

**Created**: November 12, 2025  
**Status**: Implementation Plan

## Problem Statement

Domain rules exist in `/src/domain/rules/PhaseRules.ts` but are **not actively enforced** in the application. They serve only as documentation, providing no functional strength or build-time validation.

### Current State
- ✅ `PhaseRules.ts` exists with well-defined validation functions
- ✅ Domain logic is documented in `PHASE_DOMAIN_LOGIC.md`
- ❌ Rules are not called during create/update operations
- ❌ No validation at database layer
- ❌ No TypeScript compile-time checks
- ❌ Users can violate rules without warnings

## Why This Matters

**Domain-Driven Design Principle**: Domain rules should be:
1. **Enforced at runtime** - Prevent invalid states
2. **Type-safe** - Leverage TypeScript for compile-time checks
3. **Centralized** - Single source of truth
4. **Tested** - Unit tests validate business logic

Without enforcement, rules are just comments that drift from reality.

## Enforcement Layers

### Layer 1: UI Validation (Immediate Feedback)
**Where**: React components  
**When**: Before user action completes  
**Example**: Disable "Create Phases" button if recurring template exists

```typescript
// In ProjectMilestoneSection.tsx
const canCreatePhases = !PhaseRules.checkPhaseRecurringExclusivity(milestones).hasRecurringTemplate;

<Button disabled={!canCreatePhases} onClick={handleCreatePhases}>
  Create Phases
</Button>
```

**Status**: ✅ Partially implemented (mutual exclusivity checks added)

### Layer 2: Service Layer Validation (Business Logic)
**Where**: Orchestrators and Services  
**When**: Before database operations  
**Example**: Validate phase continuity before saving

```typescript
// In ProjectMilestoneOrchestrator.ts
export async function updatePhaseDate(phaseId, date, allPhases) {
  // DOMAIN RULE: Check for overlaps
  const validation = PhaseRules.validatePhasesContinuity(allPhases, projectStart, projectEnd);
  
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }
  
  // DOMAIN RULE: Check budget constraints
  const budgetCheck = PhaseRules.validatePhaseBudgets(allPhases, projectBudget);
  
  if (!budgetCheck.isValid) {
    return { success: false, errors: budgetCheck.errors };
  }
  
  // Proceed with update
  await supabase.from('milestones').update(...);
}
```

**Status**: ❌ Not implemented

### Layer 3: Database Constraints (Last Line of Defense)
**Where**: Supabase/PostgreSQL  
**When**: On INSERT/UPDATE  
**Example**: Check constraint preventing overlapping phases

```sql
-- Add database constraint
ALTER TABLE milestones
ADD CONSTRAINT no_overlapping_phases
CHECK (
  NOT EXISTS (
    SELECT 1 FROM milestones m2
    WHERE m2.project_id = milestones.project_id
    AND m2.id != milestones.id
    AND m2.start_date < milestones.end_date
    AND m2.end_date > milestones.start_date
  )
);

-- Add constraint for mutual exclusivity
ALTER TABLE projects
ADD CONSTRAINT phase_recurring_exclusivity
CHECK (
  (SELECT COUNT(*) FROM milestones WHERE project_id = projects.id AND start_date IS NOT NULL) = 0
  OR
  (SELECT COUNT(*) FROM milestones WHERE project_id = projects.id AND is_recurring = true) = 0
);
```

**Status**: ❌ Not implemented

### Layer 4: TypeScript Type System (Compile-Time)
**Where**: Type definitions  
**When**: At build time  
**Example**: Discriminated unions for phase types

```typescript
// Use discriminated unions to enforce mutual exclusivity at type level
type ProjectMilestoneState = 
  | { type: 'implicit'; phases: []; recurring: null }
  | { type: 'split'; phases: Phase[]; recurring: null }
  | { type: 'recurring'; phases: []; recurring: RecurringTemplate };

// TypeScript prevents: phases.length > 0 && recurring !== null
```

**Status**: ❌ Not implemented

## Implementation Plan

### Phase 1: Service Layer Validation (High Priority)
**Goal**: Enforce rules before database operations

**Files to Update**:
1. `ProjectMilestoneOrchestrator.ts`
   - Import `PhaseRules`
   - Add validation in `updateMilestoneProperty()`
   - Add validation in `createRecurringMilestones()`
   - Add validation in phase CRUD operations

2. `UnifiedMilestoneService.ts`
   - Import `PhaseRules`
   - Validate budget constraints on update
   - Validate date changes don't create overlaps

**Implementation**:
```typescript
// Example: Add to ProjectMilestoneOrchestrator
import { PhaseRules } from '@/domain/rules/PhaseRules';

export async function updateMilestoneProperty(id, property, value, context) {
  const { projectMilestones, projectStartDate, projectEndDate, projectEstimatedHours } = context;
  
  // Create updated milestone array for validation
  const updatedMilestones = projectMilestones.map(m => 
    m.id === id ? { ...m, [property]: value } : m
  );
  
  // DOMAIN RULE: Validate phases have no overlaps
  const phases = updatedMilestones.filter(m => m.startDate);
  if (phases.length > 0) {
    const validation = PhaseRules.validatePhasesContinuity(
      phases,
      projectStartDate,
      projectEndDate
    );
    
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors[0],
        errors: validation.errors
      };
    }
    
    // Show warnings for gaps
    if (validation.warnings.length > 0) {
      // Toast or return warnings to UI
    }
  }
  
  // DOMAIN RULE: Validate budget allocation
  if (property === 'timeAllocationHours' || property === 'timeAllocation') {
    const budgetValidation = PhaseRules.validatePhaseBudgets(
      updatedMilestones,
      projectEstimatedHours
    );
    
    if (!budgetValidation.isValid) {
      return {
        success: false,
        error: budgetValidation.errors[0],
        errors: budgetValidation.errors
      };
    }
  }
  
  // Proceed with update...
}
```

### Phase 2: UI Validation (Medium Priority)
**Goal**: Provide immediate feedback

**Status**: ✅ Partially done
- Added mutual exclusivity checks in Create Phases button
- Added mutual exclusivity checks in Recurring Estimate button

**Remaining**:
- Show phase overlap warnings in real-time
- Show budget allocation warnings as user edits
- Disable invalid date selections in calendar picker

### Phase 3: Database Constraints (Low Priority)
**Goal**: Prevent invalid data at storage level

**Why Low Priority**: 
- Harder to implement (complex SQL checks)
- Less user-friendly error messages
- Should be caught by layers 1 & 2 anyway
- Acts as safety net only

### Phase 4: Type System Refinement (Future)
**Goal**: Make invalid states unrepresentable

**Approach**: Use discriminated unions to enforce mutual exclusivity at compile time.

## Testing Strategy

### Unit Tests for Domain Rules
**File**: `src/domain/rules/__tests__/PhaseRules.test.ts`

Already exists! Validates:
- Phase continuity checking
- Budget validation
- Mutual exclusivity
- Overlap detection

### Integration Tests
**File**: `src/services/__tests__/ProjectMilestoneOrchestrator.test.ts`

Should test:
- Creating phases with invalid dates fails
- Creating recurring template when phases exist fails
- Updating phase budget beyond project budget fails
- Creating overlapping phases fails

### E2E Tests
Test full user workflows with validation:
- Try to create phases when recurring exists → should show error
- Try to create phases with overlap → should prevent
- Try to allocate > 100% budget → should warn

## Benefits of Enforcement

1. **Data Integrity**: Invalid states cannot exist in database
2. **Better UX**: Clear error messages explain why action failed
3. **Maintainability**: Rules in one place, enforced everywhere
4. **Confidence**: Changes to rules automatically affect all validation
5. **Documentation**: Code shows what is and isn't allowed

## Metrics

**Current Coverage**: ~10%
- ✅ `MilestoneRules` used in 5+ places
- ⚠️ `PhaseRules` used in 2 places (just for filtering)
- ❌ No validation in services layer
- ❌ No database constraints

**Target Coverage**: ~80%
- ✅ All service layer operations validate
- ✅ All UI components check rules before actions
- ✅ Tests cover all validation scenarios
- ⚠️ Database constraints optional (safety net)

## Next Steps

1. **Immediate**: Complete service layer validation (Phase 1)
2. **This Sprint**: Complete UI validation (Phase 2)
3. **Next Sprint**: Add comprehensive integration tests
4. **Future**: Database constraints (Phase 3)
5. **Future**: Type system refinement (Phase 4)

## Related Documentation

- `docs/PHASE_DOMAIN_LOGIC.md` - Domain model definition
- `src/domain/rules/PhaseRules.ts` - Rule implementations
- `.cursorrules` - Architecture guidelines
