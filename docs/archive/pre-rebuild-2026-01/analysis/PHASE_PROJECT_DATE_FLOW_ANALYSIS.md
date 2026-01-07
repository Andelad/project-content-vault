# Phase & Project Date Flow - Architecture Analysis

**Created:** January 6, 2026  
**Status:** Analysis & Recommendations  
**Purpose:** Document the current flow and provide systematic fix recommendations

---

## 📊 CURRENT ARCHITECTURE FLOW

### The Intended Flow (Theory)

```
USER INPUT (UI Component)
    ↓
ORCHESTRATOR LAYER (Validation & Coordination)
    ↓
DOMAIN RULES (Business Logic)
    ↓
DOMAIN ENTITIES (State Management)
    ↓
SERVICES (Calculation & Persistence)
    ↓
DATABASE (Supabase)
```

### The Reality (What's Actually Happening)

**Multiple competing paths exist**, which is causing bugs:

```
Path 1: UI → ProjectOrchestrator → ProjectRules → Database
Path 2: UI → UnifiedProjectService → ProjectRules → Database  
Path 3: UI → PhaseOrchestrator → PhaseRules → Database
Path 4: UI → Direct Domain Entity → Database
Path 5: UI → Legacy Service → Database (bypassing rules!)
```

---

## 🎯 THE SPECIFIC FLOW FOR DATES

### Phase Start/End Date Flow

**Current locations where phase dates are handled:**

1. **Domain Rules** (`/src/domain/rules/PhaseRules.ts`)
   - ✅ `validateMilestoneDateRange()` - Validates start < end
   - ✅ `validatePhaseDate()` - Validates within project range
   - ✅ `validatePhaseEndDateNotInPast()` - Prevents past dates with estimated time
   - ✅ `calculateMinimumPhaseEndDate()` - Auto-adjust logic
   - ✅ `calculateNewPhaseDates()` - When adding new phases
   - ⚠️ **ISSUE**: Some methods use `endDate`, others use `dueDate` - inconsistent field naming

2. **Domain Entity** (`/src/domain/entities/Phase.ts`)
   - ✅ Phase.create() - Validates dates on creation
   - ✅ updateDates() - Validates date changes
   - ⚠️ **ISSUE**: Entity validation may differ from rules validation

3. **Orchestrator** (`/src/services/orchestrators/PhaseOrchestrator.ts`)
   - ✅ validateProjectTimeframe() - Project + phase validation
   - ⚠️ **ISSUE**: Duplicates some domain rule logic

4. **UI Components** (`/src/components/features/project/ProjectPhaseSection.tsx`)
   - ⚠️ **ISSUE**: Some date calculations happen here (line 417)
   - ⚠️ **ISSUE**: Local state management can drift from rules

### Project Start/End Date Flow

**Current locations where project dates are handled:**

1. **Domain Rules** (`/src/domain/rules/ProjectRules.ts`)
   - ✅ `validateDateRange()` - Basic start < end
   - ✅ `validateProjectNotFullyInPast()` - Prevents fully past projects
   - ✅ `calculateMinimumProjectEndDate()` - Based on phases
   - ⚠️ **ISSUE**: Doesn't auto-sync project.endDate to last phase.endDate

2. **Domain Entity** (`/src/domain/entities/Project.ts`)
   - ✅ Project.create() - Validates dates
   - ✅ updateDates() - Validates and syncs with phases
   - ⚠️ **ISSUE**: Comments say "validates against phases if they exist" but implementation unclear

3. **Services** (`/src/services/unified/UnifiedProjectService.ts`)
   - ✅ validateDates() - Checks project dates vs phases
   - ⚠️ **ISSUE**: Separate validation from domain entity - can diverge

4. **Orchestrator** (`/src/services/orchestrators/ProjectOrchestrator.ts`)
   - ✅ validateProjectCreation() - Full workflow validation
   - ⚠️ **ISSUE**: Complex orchestration can bypass domain rules

---

## 🐛 IDENTIFIED PROBLEMS

### Problem 1: Multiple Sources of Truth

**Symptom:** Phase/project dates can be validated differently depending on entry point

**Root Cause:**
- Domain Rules define the logic
- Domain Entities have their own validation
- Services add additional validation
- Orchestrators coordinate but may duplicate logic
- UI components sometimes do calculations directly

**Impact:** Inconsistent behavior, bugs slip through gaps

### Problem 2: Unclear Date Sync Responsibility

**Symptom:** Project end dates don't always match last phase end date

**Root Cause:**
- **App Logic says:** "If has phases: end date IS the last phase's end date (auto-synced)"
- **Implementation:** Multiple places TRY to enforce this, but coordination is unclear
- No single "source of truth" for the sync operation

**Locations attempting sync:**
- `ProjectRules.calculateMinimumProjectEndDate()` - calculates minimum
- `Project.updateDates()` - mentions phase validation
- `UnifiedProjectService.validateDates()` - checks but doesn't fix
- `PhaseOrchestrator.validateProjectTimeframe()` - validates relationship

**Missing:** A clear "sync project dates to phases" operation

### Problem 3: Field Naming Inconsistency

**Symptom:** Some code uses `phase.endDate`, others use `phase.dueDate`

**Root Cause:** Migration from milestone → phase left legacy field names

**Examples:**
```typescript
// In PhaseRules.ts line 741:
const phaseEnd = normalizeToMidnight(new Date(phase.endDate || phase.dueDate));

// In PhaseRules.ts line 782:
const phaseDate = phase.endDate || phase.dueDate;
```

**Impact:** Conditional logic is error-prone, easy to miss cases

### Problem 4: Validation Without Enforcement

**Symptom:** Rules validate but don't fix invalid states

**Example:**
```typescript
// ProjectRules.validateProjectNotFullyInPast() 
// Returns: { isValid: false, errors: [...] }
// But doesn't provide: suggestedEndDate or auto-fix
```

**Missing:** Auto-correction suggestions alongside validation

### Problem 5: UI Component Date Calculations

**Symptom:** Date math in React components instead of domain layer

**Example from ProjectPhaseSection.tsx line 417:**
```typescript
// DOMAIN RULE: Calculate dates for new phase (shrinks last phase)
const { newPhaseStart, newPhaseEnd, lastPhaseNewEnd } = PhaseRules.calculateNewPhaseDates(
  existingPhases as PhaseDTO[],
  projectEndDate
);
```

**Good:** Calls domain rule  
**Bad:** UI component orchestrating the domain logic

---

## ✅ RECOMMENDATIONS

### Recommendation 1: Establish Single Flow (Critical)

**Implement strict architectural layers:**

```
UI Component
    ↓ (calls only)
Orchestrator (workflow coordination)
    ↓ (delegates to)
Domain Entity (state + validation)
    ↓ (uses)
Domain Rules (pure business logic)
    ↓ (calls)
Services (calculations only)
```

**Rules:**
1. ❌ UI never calls Domain Rules directly
2. ❌ UI never calls Services directly (except read-only queries)
3. ✅ UI only calls Orchestrators
4. ✅ Orchestrators coordinate Entity operations
5. ✅ Entities enforce rules via Domain Rules
6. ✅ Domain Rules are pure functions (no side effects)

### Recommendation 2: Create DateSyncService (High Priority)

**Purpose:** Single source of truth for project-phase date synchronization

**Location:** `/src/domain/domain-services/DateSyncService.ts`

**Methods needed:**
```typescript
class DateSyncService {
  /**
   * Sync project end date to last phase end date
   * This is THE authoritative sync operation
   */
  static syncProjectToPhases(
    project: Project,
    phases: PhaseDTO[]
  ): { 
    updatedProject: Project; 
    changed: boolean; 
    reason?: string;
  }
  
  /**
   * When phase dates change, determine if project needs updating
   */
  static calculateRequiredProjectDates(
    currentProject: Project,
    phases: PhaseDTO[]
  ): {
    mustUpdateStartDate: boolean;
    mustUpdateEndDate: boolean;
    suggestedStartDate: Date;
    suggestedEndDate: Date;
    reasons: string[];
  }
  
  /**
   * Validate entire project-phase date relationship
   * Returns validation + auto-fix suggestions
   */
  static validateAndSuggestFixes(
    project: Project,
    phases: PhaseDTO[]
  ): {
    isValid: boolean;
    errors: string[];
    suggestions: Array<{
      field: 'projectStartDate' | 'projectEndDate' | 'phaseStartDate' | 'phaseEndDate';
      currentValue: Date;
      suggestedValue: Date;
      reason: string;
    }>;
  }
}
```

**Why this helps:**
- ✅ Single place to look for date sync logic
- ✅ Clear contracts (input/output)
- ✅ Testable in isolation
- ✅ Can be called from anywhere safely

### Recommendation 3: Standardize Field Names (Medium Priority)

**Create migration to clean up phase field naming:**

1. **In TypeScript types:**
```typescript
// PhaseDTO should have:
interface PhaseDTO {
  startDate: Date;
  endDate: Date;  // Remove dueDate entirely
  // ... other fields
}
```

2. **In database:**
- Keep database field as `due_date` (don't break existing data)
- Create clear mapping layer in repository

3. **In code:**
```typescript
// Repository layer does translation:
class PhaseRepository {
  static fromDatabase(row: DatabaseRow): PhaseDTO {
    return {
      ...row,
      endDate: new Date(row.due_date), // Convert here, once
      // No dueDate in DTO
    };
  }
  
  static toDatabase(phase: PhaseDTO): DatabaseRow {
    return {
      ...phase,
      due_date: phase.endDate.toISOString(), // Convert back
    };
  }
}
```

**Why this helps:**
- ✅ No more `phase.endDate || phase.dueDate` everywhere
- ✅ Type safety catches mistakes
- ✅ Clearer domain model

### Recommendation 4: Add Auto-Fix to Validation (High Priority)

**Pattern:** Validation should return suggestions, not just errors

**Before:**
```typescript
static validateProjectNotFullyInPast(
  project: Project,
  phases: PhaseDTO[],
  today: Date = new Date()
): { isValid: boolean; errors: string[] }
```

**After:**
```typescript
static validateProjectNotFullyInPast(
  project: Project,
  phases: PhaseDTO[],
  today: Date = new Date()
): { 
  isValid: boolean; 
  errors: string[];
  autoFix?: {
    suggestedEndDate: Date;
    reason: string;
    affectedPhases: string[]; // Phase IDs that would need updating
  }
}
```

**Why this helps:**
- ✅ UI can show "Auto-fix" button
- ✅ Orchestrator can apply fixes automatically
- ✅ User gets helpful guidance, not just error messages

### Recommendation 5: Create Integration Tests (Critical)

**Problem:** Complex flows with multiple layers need end-to-end validation

**Create:** `/src/test/integration/phase-project-dates.test.ts`

**Test scenarios:**
```typescript
describe('Phase-Project Date Integration', () => {
  test('Creating project with phases auto-syncs project end date', () => {
    // Create project with 3 phases
    // Assert: project.endDate === lastPhase.endDate
  });
  
  test('Updating last phase end date updates project end date', () => {
    // Update phase end date
    // Assert: project updated automatically
  });
  
  test('Adding phase beyond project end extends project', () => {
    // Add phase with endDate > project.endDate
    // Assert: project.endDate extended
  });
  
  test('Deleting last phase shortens project to new last phase', () => {
    // Delete last phase
    // Assert: project.endDate now equals new last phase
  });
  
  test('Moving phase start date before project start moves project start', () => {
    // Move phase.startDate before project.startDate
    // Assert: project.startDate moved OR phase rejected
  });
});
```

**Why this helps:**
- ✅ Catches integration bugs
- ✅ Documents expected behavior
- ✅ Prevents regressions
- ✅ Makes AI understand the requirements better

### Recommendation 6: Document the Contract (High Priority)

**Create:** `/src/domain/rules/DATE_SYNC_CONTRACT.md`

**Content:**
```markdown
# Project-Phase Date Synchronization Contract

## Invariants (MUST be true at all times)

1. **Phase dates within project dates**
   - For ALL phases: `project.startDate <= phase.startDate < phase.endDate <= project.endDate`

2. **Project spans all phases**
   - `project.startDate === firstPhase.startDate`
   - `project.endDate === lastPhase.endDate`

3. **No overlapping phases**
   - Phases are sequential with 1-day gaps
   - `phase[i].endDate + 1 day === phase[i+1].startDate`

## When to Sync

### Trigger: Phase added/deleted
- **Action:** Recalculate project.startDate and project.endDate
- **Responsible:** PhaseOrchestrator.createPhase()

### Trigger: Phase dates changed
- **Action:** Validate against project dates, extend if needed
- **Responsible:** PhaseOrchestrator.updatePhase()

### Trigger: Project dates changed
- **Action:** Validate all phases still fit, reject or auto-adjust phases
- **Responsible:** ProjectOrchestrator.updateProject()

## Auto-Correction Rules

### If phase extends beyond project end:
- **Option A:** Extend project.endDate to phase.endDate
- **Option B:** Reject phase change

### If phase starts before project start:
- **Option A:** Move project.startDate to phase.startDate
- **Option B:** Reject phase change

### Decision: ALWAYS extend project to accommodate phases (Option A)
- Rationale: Phases are primary work units, project dates are derived
```

**Why this helps:**
- ✅ Clear rules for AI to follow
- ✅ Developers know expected behavior
- ✅ Basis for validation logic
- ✅ Reduces ambiguity and bugs

---

## 🎯 IMPLEMENTATION PLAN

### Phase 1: Foundation (Do First)
1. ✅ Document current flow (this document)
2. ✅ Create DATE_SYNC_CONTRACT.md
3. ✅ Write integration tests (failing tests for desired behavior)
4. ✅ Create DateSyncService skeleton

### Phase 2: Core Fix (Critical Path)
1. Implement DateSyncService fully
2. Update ProjectOrchestrator to use DateSyncService
3. Update PhaseOrchestrator to use DateSyncService
4. Remove duplicate sync logic from other places
5. Make integration tests pass

### Phase 3: Cleanup (After Core Works)
1. Standardize field names (dueDate → endDate)
2. Add auto-fix suggestions to all validation methods
3. Remove date calculations from UI components
4. Audit and enforce single flow pattern

### Phase 4: Validation (Prove It Works)
1. Run full test suite
2. Manual QA of date flows
3. Update App Logic.md with implemented behavior
4. Archive old/duplicate code

---

## 🚨 ANTI-PATTERNS TO AVOID

### ❌ Don't do date math in UI components
```typescript
// BAD
const newEndDate = new Date(oldEndDate.getTime() + 7 * 24 * 60 * 60 * 1000);
```

### ❌ Don't duplicate validation logic
```typescript
// BAD - validation in multiple places
if (startDate >= endDate) { /* ... */ }  // In UI
if (startDate >= endDate) { /* ... */ }  // In Service
if (startDate >= endDate) { /* ... */ }  // In Rules
```

### ❌ Don't silently auto-correct without logging
```typescript
// BAD
project.endDate = lastPhase.endDate; // Silent change

// GOOD
const sync = DateSyncService.syncProjectToPhases(project, phases);
if (sync.changed) {
  console.log('Auto-synced project dates:', sync.reason);
  await auditLog.logAutoCorrection(sync);
}
```

### ❌ Don't skip layer validation
```typescript
// BAD
await supabase.from('projects').update({ end_date: newDate }); // Direct DB update

// GOOD
const result = await ProjectOrchestrator.updateProjectDates(projectId, { endDate: newDate });
// Orchestrator → Entity → Rules → Validation → DB
```

---

## 📚 RELATED DOCUMENTS

- `/src/domain/App Logic.md` - Business rules (what should happen)
- `/src/domain/Business Rules.md` - Technical rules (how to enforce)
- `/docs/operations/PHASE_MIGRATION_INSTRUCTIONS.md` - Migration context
- `/docs/features/phases/PHASE_TIME_DOMAIN_RULES.md` - Phase-specific rules

---

## 🔍 HOW TO USE THIS DOCUMENT

**For fixing a specific bug:**
1. Identify which flow is broken (Phase dates? Project dates? Sync?)
2. Check "Identified Problems" section
3. Follow relevant recommendation
4. Write a test first
5. Implement fix in the correct layer

**For adding new date functionality:**
1. Check DATE_SYNC_CONTRACT.md (create it first if needed)
2. Write integration test for new behavior
3. Implement in DateSyncService
4. Wire through Orchestrator
5. Update UI last

**For code review:**
1. Verify single flow pattern is followed
2. Check no date math in UI
3. Ensure DateSyncService is used for sync operations
4. Validate tests exist

---

**Questions?** Add them to this document and update as we learn more.
