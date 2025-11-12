# Current Validation Mechanisms

**Created**: November 12, 2025  
**Purpose**: Document what ACTUALLY enforces constraints in the codebase today

## Summary

You asked: **"If domain rules don't provide functional strength currently, what does?"**

The answer: **A patchwork of ad-hoc validations scattered across services, with some database constraints.**

## Current Enforcement Layers

### 1. Database Constraints (PostgreSQL/Supabase)
**Location**: `supabase/migrations/*.sql`  
**Coverage**: Minimal, basic data integrity only

#### Existing Constraints:

**Milestones Table** (`20250820000000_add_milestones_table.sql`):
```sql
CHECK (time_allocation >= 0 AND time_allocation <= 100)
```
- ✅ Prevents negative time allocations
- ✅ Limits old percentage-based allocations to 100%
- ❌ But this constraint is outdated (we now use hours, not percentages)

**Milestones Table Update** (`20251018135332_f3716e35-ae6f-4c04-8376-5eb299ee7337.sql`):
```sql
ADD CONSTRAINT milestones_time_allocation_hours_check CHECK (time_allocation_hours > 0);
```
- ✅ Ensures time allocation is positive
- ❌ Doesn't check against project budget
- ❌ Doesn't prevent overlap between phases
- ❌ Doesn't enforce mutual exclusivity

**RLS Policies**:
```sql
CREATE POLICY "Users can only see their own milestones" 
  ON public.milestones FOR SELECT USING (auth.uid() = user_id);
```
- ✅ Security: Users can only see their own data
- ❌ Not business logic validation

**What's Missing at Database Layer**:
- ❌ No constraint preventing phase overlaps
- ❌ No constraint for mutual exclusivity (phases vs recurring)
- ❌ No constraint checking total budget allocation
- ❌ No constraint ensuring phase continuity

### 2. Service Layer Validation (TypeScript)
**Location**: `src/services/unified/UnifiedMilestoneService.ts`, `src/services/orchestrators/ProjectMilestoneOrchestrator.ts`  
**Coverage**: Budget validation only, inconsistently applied

#### Budget Validation (UnifiedMilestoneService)

```typescript
// Line 63-100: validateBudgetAllocation
static validateBudgetAllocation(
  milestones: Milestone[], 
  projectBudget: number,
  excludeMilestoneId?: string
): MilestoneValidationResult
```

**What it checks**:
- ✅ Total allocation ≤ project budget
- ✅ Returns isValid boolean
- ✅ Provides recommendations (>90% utilization, <50% utilization)
- ✅ Detects very small/large allocations

**Where it's used**:
1. `ProjectMilestoneOrchestrator.saveNewMilestone()` - Line 586
2. `ProjectOrchestrator.updateProject()` - Line 233  
3. `ProjectOrchestrator.deleteProject()` - Line 255
4. `RelationshipRules.validateMilestoneInContext()` - Line 116

**What it doesn't check**:
- ❌ Phase overlap/continuity
- ❌ Mutual exclusivity
- ❌ Date constraints
- ❌ Recurring template validity

#### Date Validation (MilestoneRules)

```typescript
// Used in ProjectOrchestrator.updateProject() - Line 220
MilestoneRules.validateMilestoneDateWithinProject(
  milestone.dueDate,
  updatedProject.startDate,
  updatedProject.endDate
)
```

**What it checks**:
- ✅ Milestone due date is within project bounds
- ❌ Doesn't check phase start dates
- ❌ Doesn't check for overlaps between phases

### 3. UI Layer Validation (React Components)
**Location**: React components, hooks  
**Coverage**: User feedback, but easily bypassed

#### Recently Added (November 12, 2025):

**Mutual Exclusivity Check** (`ProjectMilestoneSection.tsx` - Lines 284, 448):
```typescript
// Before creating phases
const validation = PhaseRules.checkPhaseRecurringExclusivity(projectMilestones);
if (!validation.isValid && validation.hasRecurringTemplate) {
  toast({ title: "Cannot create phases", description: validation.error });
  return;
}

// Before creating recurring template
const validation = PhaseRules.checkPhaseRecurringExclusivity(projectMilestones);
if (!validation.isValid && validation.hasSplitPhases) {
  toast({ title: "Cannot create recurring template", description: validation.error });
  return;
}
```

**What it does**:
- ✅ Prevents creating phases if recurring template exists
- ✅ Prevents creating recurring template if phases exist
- ✅ Shows error toast to user
- ❌ Only in UI - can be bypassed with API calls
- ❌ Only checks mutual exclusivity, nothing else

#### Existing UI Validations:
- Calendar date pickers disable invalid dates (PhaseCard.tsx)
- Budget warnings shown when allocation exceeds project budget
- Phase continuity dialogs ask for confirmation before deletion

**Problem**: All UI validation is advisory only and can be bypassed.

### 4. Domain Rules (PhaseRules.ts)
**Location**: `src/domain/rules/PhaseRules.ts`  
**Coverage**: Comprehensive validation functions exist but are **rarely called**

#### Available Functions:

```typescript
// Mutual exclusivity check
PhaseRules.checkPhaseRecurringExclusivity(milestones)
// Returns: { isValid, hasSplitPhases, hasRecurringTemplate, error }

// Phase continuity check (gaps/overlaps)
PhaseRules.validatePhasesContinuity(phases, projectStart, projectEnd)
// Returns: { isValid, errors[], warnings[] }

// Budget validation
PhaseRules.validatePhaseBudgets(milestones, projectBudget)
// Returns: { isValid, errors[] }
```

**Current Usage**:
- ✅ `checkPhaseRecurringExclusivity` - Called in 2 places (UI layer only)
- ❌ `validatePhasesContinuity` - **NEVER CALLED**
- ❌ `validatePhaseBudgets` - **NEVER CALLED**

## The Real Enforcement Mechanism

**Truth**: There is NO comprehensive enforcement. Instead:

1. **Database** - Only enforces basic constraints (positive numbers, user ownership)
2. **Services** - Only checks budget (inconsistently)  
3. **UI** - Shows warnings but can't prevent bad data
4. **Domain Rules** - Exist but aren't wired up

## How Invalid States Can Occur

### Scenario 1: Overlapping Phases
```typescript
// User creates two phases manually
Phase 1: Jan 1 - Feb 15
Phase 2: Feb 1 - Mar 1  // OVERLAPS with Phase 1 by 2 weeks

// What stops this?
// ❌ Database: No constraint
// ❌ Service layer: Not checked
// ❌ UI: Calendar allows selection
// ❌ Domain rules: Function exists but not called

// Result: Invalid data in database
```

### Scenario 2: Over-allocated Budget
```typescript
// Project has 100 hours budget
// User creates phases:
Phase 1: 60 hours
Phase 2: 50 hours
// Total = 110 hours (10 hours over budget)

// What stops this?
// ❌ Database: No constraint
// ⚠️ Service layer: Checked in saveNewMilestone only
// ⚠️ UI: Shows warning but allows save
// ❌ Domain rules: Function exists but not called

// Result: Over-allocation allowed if user ignores warning
```

### Scenario 3: Both Phases AND Recurring Template
```typescript
// User creates phases through UI
// Then creates recurring template via direct API call

// What stops this?
// ❌ Database: No constraint
// ❌ Service layer: Not checked
// ✅ UI: Blocked (as of Nov 12, 2025)
// ✅ Domain rules: Can check, but only if called

// Result: UI prevents, but API allows invalid state
```

## Comparison Table

| Validation Type | Database | Service Layer | UI Layer | Domain Rules |
|----------------|----------|---------------|----------|--------------|
| **Positive time allocation** | ✅ | ✅ | N/A | ❌ |
| **Budget limit** | ❌ | ✅ (partial) | ⚠️ (warning) | ❌ Not called |
| **Phase overlaps** | ❌ | ❌ | ❌ | ❌ Not called |
| **Phase continuity** | ❌ | ❌ | ❌ | ❌ Not called |
| **Mutual exclusivity** | ❌ | ❌ | ✅ (Nov 12) | ✅ (called 2x) |
| **Date within project bounds** | ❌ | ✅ (partial) | ⚠️ (soft) | ❌ |
| **User data isolation** | ✅ (RLS) | N/A | N/A | N/A |

**Legend**:
- ✅ Fully enforced
- ⚠️ Partially enforced (warnings but not blocking)
- ❌ Not enforced

## Why This is Problematic

### 1. **Drift Between Rules and Reality**
Domain rules document what *should* be true, but code doesn't enforce it. Over time:
- Rules become outdated
- Code implements different behavior
- Documentation becomes misleading

### 2. **Inconsistent Validation**
Some validations happen in some places but not others:
- Budget checked in `saveNewMilestone` but not in `updateMilestoneProperty`
- Date validation in some orchestrators but not services
- UI shows warnings that can be ignored

### 3. **No Defense in Depth**
Best practice is multiple layers:
- UI prevents obvious mistakes (UX)
- Services enforce business rules (reliability)
- Database prevents corruption (integrity)

**Current state**: Only UI layer for some rules, only service layer for budget, nothing comprehensive.

### 4. **Difficult to Test**
Without clear enforcement points:
- Can't write reliable integration tests
- Edge cases slip through
- Bugs hard to reproduce

### 5. **Technical Debt**
Each new feature adds more ad-hoc validation:
- Duplicated logic across files
- Hard to maintain
- Easy to miss edge cases

## What Should Enforce Rules?

**Ideal State**: Defense in depth

```
User Action
    ↓
┌─────────────────────────┐
│ UI Layer (React)        │ ← Immediate feedback, disable invalid actions
│ - Disable invalid dates │
│ - Show budget warnings  │
│ - Block obvious errors  │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ Service Layer (TS)      │ ← Business logic enforcement
│ - Validate ALL rules    │ ← **This is missing**
│ - Return clear errors   │
│ - Call PhaseRules.*     │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ Database (PostgreSQL)   │ ← Last line of defense
│ - Check constraints     │ ← **This is minimal**
│ - Foreign keys          │
│ - Data integrity        │
└─────────────────────────┘
```

**Current State**: Mostly just UI with some service-layer budget checks.

## Path Forward

See `DOMAIN_RULES_ENFORCEMENT.md` for implementation plan to:
1. Wire up PhaseRules validation in service layer
2. Add comprehensive database constraints
3. Make domain rules the single source of truth

## Key Takeaway

**Your question was spot-on**: Domain rules currently provide **documentation value only**, not functional strength. The actual enforcement comes from:

1. **Database constraints** (minimal - just positive numbers)
2. **Service layer budget checks** (inconsistent - only in some places)
3. **UI warnings** (advisory - can be ignored)
4. **Recently added UI blocking** (mutual exclusivity only, as of Nov 12)

The domain rules are **defined but disconnected** from the enforcement mechanisms. They exist but aren't systematically called at the critical enforcement points (service layer, database).

This creates a **maintenance burden** (rules drift from reality) and **reliability risk** (invalid states can exist in database).
