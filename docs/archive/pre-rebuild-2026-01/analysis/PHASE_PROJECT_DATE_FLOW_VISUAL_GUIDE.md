# Phase & Project Date Flow - Visual Guide

## 📊 THE CORRECT FLOW

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTION                              │
│  "Update phase end date to Jan 31"                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    UI COMPONENT LAYER                            │
│  • ProjectPhaseSection.tsx                                       │
│  • Only handles: Display, Input, Local State                    │
│  • Calls Orchestrator methods                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR LAYER                             │
│  PhaseOrchestrator.updatePhase(phaseId, { endDate })            │
│                                                                  │
│  Responsibilities:                                               │
│  • Coordinate workflow                                           │
│  • Load project and phases                                       │
│  • Call DateSyncService                                          │
│  • Handle database transactions                                  │
│  • Error handling & rollback                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  DATE SYNC SERVICE                               │
│  DateSyncService.calculateRequiredProjectDates()                │
│                                                                  │
│  Responsibilities:                                               │
│  • Determine what dates need to change                           │
│  • Apply invariant rules                                         │
│  • Generate auto-fix suggestions                                 │
│  • Return sync result with reasons                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DOMAIN ENTITIES                               │
│  phase.updateDates(startDate, endDate)                          │
│  project.updateDates(startDate, endDate)                        │
│                                                                  │
│  Responsibilities:                                               │
│  • Validate changes                                              │
│  • Enforce business invariants                                   │
│  • Update internal state                                         │
│  • Return validation results                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                     DOMAIN RULES                                 │
│  PhaseRules.validateMilestoneDateRange()                        │
│  ProjectRules.validateDateRange()                               │
│  RelationshipRules.validateMilestoneBelongsToProject()         │
│                                                                  │
│  Responsibilities:                                               │
│  • Pure validation functions                                     │
│  • No side effects                                               │
│  • Reusable across layers                                        │
│  • Single source of business logic truth                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                  CALCULATION SERVICES                            │
│  dateCalculations.normalizeToMidnight()                         │
│  dateCalculations.addDaysToDate()                               │
│                                                                  │
│  Responsibilities:                                               │
│  • Pure date math functions                                      │
│  • No business logic                                             │
│  • Utility helpers                                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE                                   │
│  Supabase: projects & milestones tables                         │
│                                                                  │
│  Responsibilities:                                               │
│  • Data persistence                                              │
│  • Row-level security                                            │
│  • Referential integrity                                         │
│  • Backup validation (CHECK constraints)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 WHAT HAPPENS WHEN PHASE DATE CHANGES

### Step-by-Step Execution

**1. User Action**
```
User changes phase end date from Jan 20 → Jan 31
```

**2. UI Component**
```typescript
// ProjectPhaseSection.tsx
const handlePhaseUpdate = async (phaseId, changes) => {
  await PhaseOrchestrator.updatePhase(phaseId, changes);
  // Refresh display
};
```

**3. Orchestrator Coordinates**
```typescript
// PhaseOrchestrator.ts
static async updatePhase(phaseId, changes) {
  // Load current data
  const phase = await db.getPhase(phaseId);
  const project = await db.getProject(phase.projectId);
  const allPhases = await db.getPhases(project.id);
  
  // Calculate what needs to sync
  const syncResult = DateSyncService.calculateRequiredProjectDates(
    project,
    allPhases.map(p => p.id === phaseId ? { ...p, ...changes } : p)
  );
  
  // Apply changes
  if (syncResult.mustUpdateEndDate) {
    await db.transaction(async () => {
      await db.updatePhase(phaseId, changes);
      await db.updateProject(project.id, { 
        endDate: syncResult.suggestedEndDate 
      });
    });
    
    // Notify user
    toast.info(`Project end date extended to ${syncResult.suggestedEndDate}`);
  }
}
```

**4. DateSyncService Determines Changes**
```typescript
// DateSyncService.ts
static calculateRequiredProjectDates(project, phases) {
  // Find latest phase end
  const latestPhaseEnd = Math.max(...phases.map(p => p.endDate));
  
  // Check if project needs extending
  const mustUpdate = latestPhaseEnd > project.endDate;
  
  return {
    mustUpdateEndDate: mustUpdate,
    suggestedEndDate: latestPhaseEnd,
    reasons: mustUpdate ? ['Phase extends beyond project end'] : []
  };
}
```

**5. Domain Entity Validates**
```typescript
// Phase.ts
updateDates(startDate, endDate) {
  // Validate via rules
  const validation = PhaseRules.validateMilestoneDateRange(startDate, endDate);
  
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }
  
  // Update state
  this.startDate = startDate;
  this.endDate = endDate;
  
  return { success: true };
}
```

**6. Domain Rules Check**
```typescript
// PhaseRules.ts
static validateMilestoneDateRange(startDate, endDate) {
  if (startDate >= endDate) {
    return { 
      isValid: false, 
      errors: ['End date must be after start date'] 
    };
  }
  return { isValid: true, errors: [] };
}
```

**7. Database Persists**
```sql
BEGIN TRANSACTION;

UPDATE milestones 
SET end_date = '2026-01-31' 
WHERE id = 'phase-123';

UPDATE projects 
SET end_date = '2026-01-31' 
WHERE id = 'project-456';

COMMIT;
```

---

## ❌ WHAT'S WRONG NOW (Multiple Paths)

### Current Problem: 5 Different Code Paths

```
Path 1: UI → ProjectOrchestrator → ProjectRules → DB ✓
Path 2: UI → UnifiedProjectService → ProjectRules → DB (duplicate!)
Path 3: UI → PhaseRules directly → DB (skips orchestration!)
Path 4: UI → Phase.updateDates() → DB (skips sync!)
Path 5: UI → Legacy Service → DB (bypasses rules!)
```

**Result:** Different behaviors depending on which path is used!

### Example Bug: Phase date changes via different paths

**Path 1 (Correct):**
```typescript
// PhaseOrchestrator handles sync
await PhaseOrchestrator.updatePhase(id, { endDate });
// ✓ Phase updated
// ✓ Project end date auto-extended
// ✓ User notified
```

**Path 2 (Missing sync):**
```typescript
// Direct entity update
const phase = Phase.fromDatabase(data);
phase.updateDates(startDate, endDate);
await db.save(phase.toDTO());
// ✓ Phase updated
// ❌ Project end date NOT updated (orphaned!)
// ❌ User not notified
```

**Path 3 (No validation):**
```typescript
// Legacy service bypasses rules
await supabase.from('milestones').update({ 
  end_date: endDate 
}).eq('id', id);
// ✓ Database updated
// ❌ No validation
// ❌ No sync
// ❌ Could violate invariants!
```

---

## ✅ THE SOLUTION: Single Path Enforcement

### Rule: ALL updates must go through Orchestrator

```typescript
// ✅ CORRECT - Always use orchestrator
await PhaseOrchestrator.updatePhase(id, changes);

// ❌ WRONG - Don't bypass orchestrator
const phase = Phase.fromDatabase(data);
phase.updateDates(start, end);
await save(phase);

// ❌ WRONG - Don't call rules directly from UI
if (PhaseRules.validate(...)) {
  await db.update(...);
}

// ❌ WRONG - Don't update database directly
await supabase.from('milestones').update(...);
```

### Enforcement via TypeScript

```typescript
// Make database access private
class PhaseRepository {
  private constructor() {} // Can't instantiate
  
  // Only orchestrators can access
  static async save(phase: Phase, context: OrchestrationContext) {
    if (!context.isOrchestrated) {
      throw new Error('Must use PhaseOrchestrator for updates');
    }
    // ... save logic
  }
}
```

---

## 🎯 QUICK REFERENCE: Who Does What

| Layer | Can Do | Cannot Do |
|-------|--------|-----------|
| **UI Component** | Display data, Handle user input, Call orchestrators | Date calculations, Validation, Direct DB access |
| **Orchestrator** | Coordinate workflow, Call services, Handle transactions | Business logic, Date math |
| **DateSyncService** | Calculate sync requirements, Suggest fixes | Persist to DB, UI updates |
| **Domain Entity** | Validate state, Enforce invariants | Database access, Cross-entity sync |
| **Domain Rules** | Pure validation, Business logic | State changes, Side effects |
| **Services** | Date math, Utilities | Business decisions, Validation |
| **Database** | Persistence, Constraints | Business logic, Calculations |

---

## 🚀 STARTING POINT FOR FIXES

### When you encounter a bug:

1. **Identify the symptom**
   - "Phase date changes but project doesn't update"
   - "Can create overlapping phases"
   - "Dates show differently in different views"

2. **Find which path is being used**
   ```bash
   # Search for the update call
   grep -r "updatePhase\|update.*milestone" src/components/
   ```

3. **Check if it goes through orchestrator**
   - ✅ If yes → Bug is in orchestrator logic
   - ❌ If no → Bug is bypassing orchestrator (refactor needed)

4. **Fix in the correct layer**
   - If sync issue → Fix in DateSyncService
   - If validation issue → Fix in Domain Rules
   - If coordination issue → Fix in Orchestrator
   - If display issue → Fix in UI Component

5. **Add test to prevent regression**
   ```typescript
   test('Phase update extends project end date', async () => {
     // Test the full flow
   });
   ```

---

## 📖 NEXT STEPS

1. **Read:** `/docs/analysis/PHASE_PROJECT_DATE_FLOW_ANALYSIS.md` (detailed recommendations)
2. **Read:** `/src/domain/rules/DATE_SYNC_CONTRACT.md` (business rules)
3. **Create:** DateSyncService (implementation)
4. **Write:** Integration tests (prove it works)
5. **Refactor:** Remove duplicate paths (clean up)
6. **Document:** Update App Logic.md (finalize)

---

**Questions to ask when reviewing code:**

- ✓ Does this use the orchestrator?
- ✓ Is DateSyncService handling the sync?
- ✓ Are domain rules being validated?
- ✓ Is the change logged/notified?
- ✓ Is there a test for this flow?
