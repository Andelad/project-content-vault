# Domain Layer Implementation Roadmap

**Project**: Centralize Business Logic - Domain Layer  
**Status**: Planning Phase Complete  
**Timeline**: 6-8 weeks for full implementation  
**Risk Level**: Low (incremental, non-breaking)  

---

## Executive Summary

This roadmap outlines the implementation of a **Domain Layer** that will serve as the single source of truth for all business logic. This addresses the current fragmentation where business rules are duplicated across 5+ layers.

**Key Documents**:
- 📘 **Business Logic Reference**: `docs/BUSINESS_LOGIC_REFERENCE.md`
- 📊 **Business Logic Audit**: `docs/architecture/BUSINESS_LOGIC_AUDIT.md`
- 🏗️ **Architecture Guide**: `Architecture Guide.md` (updated)

---

## Problem Statement

### Current Issues
1. Business rules scattered across types, services, validators, contexts, components
2. Same rule duplicated in 3-5 places
3. No reference document for "how should this work?"
4. Validation inconsistently applied
5. Relationships between entities not explicitly defined
6. Changes break features because relationships not understood

### Impact
- 🐛 Bugs from inconsistent rule application
- ⏱️ Slow development (hunting for existing rules)
- 🔄 High maintenance burden (update in multiple places)
- 🧪 Difficult to test (logic mixed with UI/state)
- 📚 Poor documentation (rules in comments, not code)

---

## Solution Overview

Create a **Domain Layer** (`src/domain/`) that:
- Centralizes all business rules in `domain/rules/`
- Provides domain entities with business methods
- Defines value objects for complex types
- Serves as single source of truth
- Is referenced by all other layers

**Architecture Change**:
```
BEFORE: Components → Services → scattered business logic
AFTER:  Components → Services → Domain Layer (centralized) → Calculations/Repositories
```

---

## Phase 1: Foundation & Documentation ✅ COMPLETE

**Timeline**: Week 1 (October 18, 2025)  
**Status**: ✅ Complete  

### Deliverables
- [x] **Business Logic Reference** document created
  - Complete specification of all entities
  - All business rules documented
  - Relationships defined
  - Invariants listed
  - Edge cases covered
  
- [x] **Business Logic Audit** document created
  - Current state mapped
  - Duplication identified
  - Gaps documented
  - Migration strategy proposed
  
- [x] **Architecture Guide** updated
  - Domain layer section added
  - Logic flow diagram updated
  - AI decision matrix updated
  - Integration patterns documented

### Outcomes
✅ Single source of truth for business rules (documented)  
✅ Team understands current architecture gaps  
✅ Clear roadmap for implementation  
✅ No code changes (zero risk)  

---

## Phase 2: Domain Layer Structure

**Timeline**: Week 2-3  
**Status**: 🔄 Next Phase  
**Risk**: Low (setup only, no breaking changes)

### Tasks

#### 2.1 Create Folder Structure
```bash
mkdir -p src/domain/entities
mkdir -p src/domain/rules
mkdir -p src/domain/value-objects
touch src/domain/index.ts
touch src/domain/entities/index.ts
touch src/domain/rules/index.ts
touch src/domain/value-objects/index.ts
```

**Files to create**:
- `src/domain/entities/Project.ts`
- `src/domain/entities/Milestone.ts`
- `src/domain/entities/Group.ts`
- `src/domain/entities/Row.ts`
- `src/domain/rules/ProjectRules.ts`
- `src/domain/rules/MilestoneRules.ts`
- `src/domain/rules/RelationshipRules.ts`
- `src/domain/value-objects/TimeAllocation.ts`
- `src/domain/value-objects/DateRange.ts`

#### 2.2 Extract Project Rules

**From**: `src/services/unified/UnifiedProjectService.ts` (lines 330-550)  
**To**: `src/domain/rules/ProjectRules.ts`

**Code to extract**:
```typescript
// Current location: UnifiedProjectService.ts, line 338-420
export class UnifiedProjectEntity {
  static validateEstimatedHours(hours: number): boolean { ... }
  static validateDateRange(startDate: Date, endDate: Date): boolean { ... }
  static calculateTotalMilestoneAllocation(milestones: Milestone[]): number { ... }
  static analyzeBudget(project: Project, milestones: Milestone[]): ProjectBudgetAnalysis { ... }
  // ... all project rules
}
```

**Action**:
1. Copy entire `UnifiedProjectEntity` class
2. Rename to `ProjectRules`
3. Move to `src/domain/rules/ProjectRules.ts`
4. Add comprehensive JSDoc documentation
5. Export from `src/domain/index.ts`

#### 2.3 Extract Milestone Rules

**From**: Scattered across validators and services  
**To**: `src/domain/rules/MilestoneRules.ts`

**Sources**:
- `src/services/validators/MilestoneValidator.ts` (validation logic)
- `src/services/unified/UnifiedMilestoneService.ts` (calculations)
- Scattered logic in contexts

**Action**:
1. Consolidate all milestone validation rules
2. Create `MilestoneRules` class
3. Document all rules with RULE numbers (matching Business Logic Reference)
4. Remove duplication

#### 2.4 Create Relationship Rules

**New file**: `src/domain/rules/RelationshipRules.ts`

**Purpose**: Centralize cross-entity relationship rules
- Project → Milestone relationships
- Project → Row → Group hierarchy
- Milestone date constraints relative to project
- Budget allocation constraints

**Content**:
```typescript
export class RelationshipRules {
  /**
   * RULE: Milestone dates must be within project range
   */
  static validateMilestoneDateWithinProject(
    milestone: Milestone, 
    project: Project
  ): ValidationResult { ... }
  
  /**
   * RULE: Milestone allocation cannot exceed project budget
   */
  static validateMilestoneAllocationWithinBudget(
    milestones: Milestone[], 
    project: Project
  ): ValidationResult { ... }
  
  /**
   * RULE: Project must belong to valid Row and Group
   */
  static validateProjectHierarchy(
    project: Project, 
    row: Row, 
    group: Group
  ): ValidationResult { ... }
}
```

#### 2.5 Create Barrel Exports

**File**: `src/domain/index.ts`

```typescript
// Domain Layer - Single Source of Truth for Business Logic

// Business Rules
export * from './rules/ProjectRules';
export * from './rules/MilestoneRules';
export * from './rules/RelationshipRules';

// Domain Entities (Phase 3)
// export * from './entities/Project';
// export * from './entities/Milestone';

// Value Objects (Phase 3)
// export * from './value-objects/TimeAllocation';
// export * from './value-objects/DateRange';
```

#### 2.6 Update Imports in Unified Services

**File**: `src/services/unified/UnifiedProjectService.ts`

**Before**:
```typescript
export class UnifiedProjectEntity {
  static validateEstimatedHours(hours: number): boolean { ... }
}
```

**After**:
```typescript
import { ProjectRules } from '@/domain/rules/ProjectRules';

// Delegate to domain layer
export class UnifiedProjectEntity {
  static validateEstimatedHours(hours: number): boolean {
    return ProjectRules.validateEstimatedHours(hours).isValid;
  }
}
```

**Approach**: Create delegation wrappers first (backward compatibility)

### Deliverables
- [ ] Domain folder structure created
- [ ] ProjectRules extracted and documented
- [ ] MilestoneRules extracted and documented
- [ ] RelationshipRules created
- [ ] Barrel exports configured
- [ ] Backward compatibility maintained (old code still works)

### Testing
- [ ] All existing tests still pass
- [ ] New domain layer unit tests created
- [ ] Build succeeds without errors
- [ ] No breaking changes introduced

### Success Criteria
✅ Domain layer exists and is importable  
✅ Rules are centralized in domain/rules/  
✅ Old code continues to work via delegation  
✅ Documentation references domain layer  
✅ 0 breaking changes  

---

## Phase 3: Validator Migration

**Timeline**: Week 4-5  
**Status**: 🔜 Planned  
**Risk**: Medium (refactoring validation logic)

### Tasks

#### 3.1 Update ProjectValidator

**File**: `src/services/validators/ProjectValidator.ts`

**Change**: Delegate to domain rules instead of duplicating

**Before**:
```typescript
export class ProjectValidator {
  static validateProjectCreation(request: CreateProjectRequest): ValidationResult {
    const errors: string[] = [];
    
    // Duplicate validation logic here
    if (request.estimatedHours <= 0) {
      errors.push('Estimated hours must be positive');
    }
    // ... more duplicate rules
  }
}
```

**After**:
```typescript
import { ProjectRules } from '@/domain/rules/ProjectRules';

export class ProjectValidator {
  static validateProjectCreation(request: CreateProjectRequest): ValidationResult {
    // Delegate to domain layer (single source of truth)
    return ProjectRules.validateCreation(request);
  }
}
```

#### 3.2 Update MilestoneValidator

**File**: `src/services/validators/MilestoneValidator.ts`

**Action**: Remove duplicate validation, delegate to `MilestoneRules`

#### 3.3 Update CrossEntityValidator

**File**: `src/services/validators/CrossEntityValidator.ts`

**Action**: Use `RelationshipRules` for cross-entity validation

#### 3.4 Remove Duplication

**Identify and remove**:
- Duplicate validation in contexts
- Duplicate validation in components
- Scattered business logic

**Document removed**:
- Lines of code removed
- Duplication percentage reduced

### Deliverables
- [ ] ProjectValidator refactored
- [ ] MilestoneValidator refactored
- [ ] CrossEntityValidator refactored
- [ ] Duplication removed (30-40% code reduction expected)
- [ ] All validators reference domain layer

### Testing
- [ ] All validation tests still pass
- [ ] Edge cases still handled
- [ ] Error messages consistent
- [ ] No validation bypassed

### Success Criteria
✅ Validators delegate to domain layer  
✅ No duplicate validation logic  
✅ All tests pass  
✅ 30-40% validation code removed  

---

## Phase 4: Service Layer Integration

**Timeline**: Week 6-7  
**Status**: 🔜 Planned  
**Risk**: Medium (updating service layer)

### Tasks

#### 4.1 Update UnifiedProjectService

**Remove**: `UnifiedProjectEntity` class (now in domain layer)

**Update**: All methods to use `ProjectRules`

**Before**:
```typescript
export class UnifiedProjectService {
  static calculateDuration(project: Project): number {
    return calculateDurationDays(project.startDate, project.endDate);
  }
}
```

**After**:
```typescript
import { ProjectRules } from '@/domain/rules/ProjectRules';

export class UnifiedProjectService {
  static calculateDuration(project: Project): number {
    // Delegate to domain layer
    return ProjectRules.calculateDuration(project.startDate, project.endDate);
  }
}
```

#### 4.2 Update UnifiedMilestoneService

**Action**: Delegate milestone business logic to `MilestoneRules`

#### 4.3 Update Calculation Services

**Ensure**: Pure calculations stay in `calculations/`, business rules move to `domain/`

**Separation**:
- Pure math → `calculations/dateCalculations.ts`
- Business rules → `domain/rules/`

### Deliverables
- [ ] Unified services updated to use domain layer
- [ ] Calculation services reviewed and properly separated
- [ ] No business logic duplication

### Testing
- [ ] All service tests pass
- [ ] Integration tests pass
- [ ] No regressions

### Success Criteria
✅ Services delegate to domain layer  
✅ Clear separation: calculations vs business rules  
✅ All tests pass  

---

## Phase 5: Context & Component Cleanup

**Timeline**: Week 8  
**Status**: 🔜 Planned  
**Risk**: Low (final cleanup)

### Tasks

#### 5.1 Update ProjectContext

**Remove**: Business logic from context

**Keep**: State management only

**Before**:
```typescript
// Context has validation logic
const addProject = (data) => {
  if (data.estimatedHours <= 0) {
    throw new Error('Invalid hours');
  }
  // ... more validation
}
```

**After**:
```typescript
import { Project } from '@/domain/entities/Project';

// Domain entity validates on construction
const addProject = (data) => {
  const project = new Project(data); // Throws if invalid
  await repository.save(project);
}
```

#### 5.2 Remove Validation from Components

**Action**: Components should not validate, domain layer does

**Pattern**:
```typescript
// Component just calls service/context
const handleSave = () => {
  try {
    await projectService.create(formData);
    // Success
  } catch (error) {
    // Display domain validation errors
    showError(error.message);
  }
}
```

#### 5.3 Add Database Constraints

**File**: New Supabase migration

**Add CHECK constraints**:
```sql
ALTER TABLE projects 
  ADD CONSTRAINT check_estimated_hours_positive 
  CHECK (estimated_hours > 0);

ALTER TABLE projects
  ADD CONSTRAINT check_date_range_valid
  CHECK (start_date < end_date OR continuous = true);

ALTER TABLE milestones
  ADD CONSTRAINT check_time_allocation_positive
  CHECK (time_allocation_hours > 0);
```

### Deliverables
- [ ] Contexts cleaned up
- [ ] Components cleaned up
- [ ] Database constraints added
- [ ] Final code review

### Testing
- [ ] Full regression testing
- [ ] Database constraints tested
- [ ] Edge cases verified

### Success Criteria
✅ No business logic in contexts/components  
✅ Database enforces critical constraints  
✅ All tests pass  
✅ Production deploy successful  

---

## Phase 6: Documentation & Training

**Timeline**: Ongoing  
**Status**: 🔜 Planned  

### Tasks

#### 6.1 Update Business Logic Reference

**Action**: Keep document synchronized with code

**Process**: Any change to domain layer must update the reference

#### 6.2 Create Domain Layer Usage Guide

**Content**:
- How to add new business rules
- How to update existing rules
- Testing patterns for domain layer
- Common patterns and examples

#### 6.3 Team Training

**Topics**:
- Overview of domain layer
- How to use business logic reference
- How to add/modify rules
- Testing domain logic

### Deliverables
- [ ] Domain layer usage guide created
- [ ] Team training completed
- [ ] Business Logic Reference maintained

---

## Success Metrics

### Code Quality
- [ ] **30-40% code reduction** from deduplication
- [ ] **90%+ test coverage** on domain layer
- [ ] **Zero breaking changes** during migration
- [ ] **100% build success** rate

### Developer Experience
- [ ] **Single reference** for all business rules
- [ ] **Faster debugging** (one place to check)
- [ ] **Easier onboarding** (clear documentation)
- [ ] **Predictable changes** (update in one place)

### System Quality
- [ ] **Fewer bugs** (consistent validation)
- [ ] **Better reliability** (rules always applied)
- [ ] **Improved performance** (less duplicate code)
- [ ] **Easier maintenance** (centralized logic)

---

## Risk Management

### Identified Risks

**Risk 1: Breaking Existing Features**
- **Mitigation**: Incremental migration, keep old code working via delegation
- **Rollback**: Can revert to old code at any phase
- **Testing**: Comprehensive test coverage at each phase

**Risk 2: Performance Impact**
- **Mitigation**: Domain layer is pure functions (fast)
- **Monitoring**: Performance benchmarks before/after
- **Optimization**: Can cache domain rule results if needed

**Risk 3: Team Learning Curve**
- **Mitigation**: Clear documentation and training
- **Support**: Pair programming for first changes
- **Guidance**: Usage guide with examples

**Risk 4: Incomplete Migration**
- **Mitigation**: Each phase delivers value independently
- **Tracking**: Clear checklist for each phase
- **Review**: Regular progress checks

### Rollback Plan

Each phase can be rolled back independently:

**Phase 2**: Delete `src/domain/` folder (no dependencies yet)  
**Phase 3**: Revert validators to old implementation  
**Phase 4**: Revert services to old implementation  
**Phase 5**: Keep contexts/components as-is  

---

## Resource Requirements

### Development Time
- **Phase 1**: 1 week (✅ Complete)
- **Phase 2**: 2 weeks (domain structure)
- **Phase 3**: 2 weeks (validator migration)
- **Phase 4**: 2 weeks (service integration)
- **Phase 5**: 1 week (cleanup)
- **Phase 6**: Ongoing (documentation)

**Total**: 8 weeks for complete migration

### Team Involvement
- **Lead Developer**: Full time (architecture, migration)
- **Developers**: Part time (code reviews, testing)
- **QA**: Part time (testing at each phase)
- **Product**: Minimal (no feature changes)

---

## Next Steps

### Immediate (This Week)
1. ✅ Review Business Logic Reference with team
2. ✅ Review Business Logic Audit with team
3. ✅ Approve roadmap
4. 🔄 Schedule kickoff for Phase 2

### Next Week
1. Start Phase 2: Create domain folder structure
2. Extract ProjectRules from UnifiedProjectService
3. Set up basic domain layer tests
4. Verify backward compatibility

### Ongoing
- Weekly progress check-ins
- Update roadmap status
- Document lessons learned
- Maintain Business Logic Reference

---

## Approval & Sign-off

**Prepared By**: AI Assistant  
**Date**: October 18, 2025  
**Status**: Awaiting Approval  

**Stakeholders**:
- [ ] Development Team Lead
- [ ] Product Owner
- [ ] QA Lead

**Approved**: _________________  
**Date**: _________________  

---

## Appendix

### A. Related Documents
- `docs/BUSINESS_LOGIC_REFERENCE.md` - Complete business rules specification
- `docs/architecture/BUSINESS_LOGIC_AUDIT.md` - Current state analysis
- `Architecture Guide.md` - Updated architecture documentation

### B. Key Definitions
- **Domain Layer**: Single source of truth for business logic
- **Business Rule**: Constraint or calculation enforcing business requirements
- **Domain Entity**: Object with identity and business methods
- **Value Object**: Immutable type representing a domain concept
- **Invariant**: Condition that must always be true

### C. Contact
For questions about this roadmap:
- Technical questions: Refer to Business Logic Reference
- Implementation questions: Refer to Architecture Guide
- Process questions: Contact project lead

---

**Document Version**: 1.0  
**Last Updated**: October 18, 2025  
**Status**: Ready for Implementation
