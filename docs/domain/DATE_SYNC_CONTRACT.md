# Project-Phase Date Synchronization Contract

**Version:** 1.0  
**Created:** January 6, 2026  
**Status:** AUTHORITATIVE - Single source of truth for date sync behavior

---

## 🎯 PURPOSE

This document defines the **invariant rules** for how project and phase dates must relate to each other. These are non-negotiable business rules that the system MUST enforce at all times.

---

## 📋 INVARIANTS (MUST be true at all times)

### Invariant 1: Phase Dates Within Project Dates

**Rule:** Every phase must exist entirely within its project's date range.

**Formula:**
```
For EVERY phase:
  project.startDate ≤ phase.startDate < phase.endDate ≤ project.endDate
```

**Enforcement:**
- Validated on phase creation
- Validated on phase update
- Validated on project date update

**Violation Handling:**
- **Option A:** Auto-extend project dates to accommodate phase (PREFERRED)
- **Option B:** Reject phase change and show error
- **Decision:** Use Option A for better UX

---

### Invariant 2: Project Spans All Phases

**Rule:** Project start/end dates must exactly match the first/last phase dates.

**Formula:**
```
If phases exist:
  project.startDate === firstPhase.startDate
  project.endDate === lastPhase.endDate
```

**Special Cases:**
- If project has NO phases: dates are independent
- If project has ONE phase: project dates match that single phase
- If project is CONTINUOUS: endDate is NULL (phases can have individual deadlines)

**Enforcement:**
- Auto-sync on phase creation
- Auto-sync on phase deletion
- Auto-sync on phase date update

---

### Invariant 3: No Overlapping Phases

**Rule:** Phases must be sequential with mandatory 1-day gaps between them.

**Formula:**
```
For phases sorted by startDate:
  phase[i].endDate + 1 day === phase[i+1].startDate
  
Example:
  Phase 1: Jan 1 - Jan 10
  Gap: Jan 11 (1 day gap)
  Phase 2: Jan 12 - Jan 20
```

**Enforcement:**
- Validated on phase creation
- Validated on phase date update
- Auto-calculation when adding new phases

**Violation Handling:**
- Show error with suggested dates
- Offer auto-adjust option

---

### Invariant 4: Time-Limited Projects Have End Dates

**Rule:** Non-continuous projects MUST have a defined end date.

**Formula:**
```
If project.continuous === false:
  project.endDate !== null
  project.endDate > project.startDate
```

**Enforcement:**
- Validated on project creation
- Validated on project update
- Cannot remove end date from time-limited project

---

### Invariant 5: Phases with Estimated Time Cannot End in Past

**Rule:** If a phase has estimated hours, it must end today or in the future.

**Formula:**
```
If phase.timeAllocationHours > 0:
  phase.endDate >= today (midnight)
```

**Rationale:** Cannot allocate future work to past dates.

**Enforcement:**
- Validated on phase creation
- Validated on phase update
- Auto-adjust phase end date if needed

---

## 🔄 SYNCHRONIZATION TRIGGERS

### When Phases are Added/Deleted

**Trigger Events:**
- New phase created
- Phase deleted
- Phase converted to/from recurring

**Required Actions:**
1. Recalculate project.startDate (earliest phase start)
2. Recalculate project.endDate (latest phase end)
3. Update project dates in database
4. Validate no gaps/overlaps remain

**Responsible Service:** `DateSyncService.syncProjectToPhases()`

---

### When Phase Dates Change

**Trigger Events:**
- Phase startDate updated
- Phase endDate updated
- Recurring phase pattern changed

**Required Actions:**
1. Validate phase still within project range
2. If phase extends beyond project:
   - Auto-extend project.endDate (Option A)
   - Log the change for user visibility
3. If phase starts before project:
   - Auto-move project.startDate (Option A)
   - Log the change
4. Re-validate phase spacing (no overlaps)

**Responsible Service:** `DateSyncService.calculateRequiredProjectDates()`

---

### When Project Dates Change

**Trigger Events:**
- Project startDate updated
- Project endDate updated
- Project converted to/from continuous

**Required Actions:**
1. Validate all phases still fit within new project range
2. If phases extend beyond new project range:
   - **Option A:** Extend project back (reject the change)
   - **Option B:** Auto-adjust phase dates to fit
   - **Decision:** Option A (protect phase dates)
3. Show user which phases are affected
4. Require user confirmation if phases would be affected

**Responsible Service:** `DateSyncService.validateAndSuggestFixes()`

---

## 🛠️ AUTO-CORRECTION RULES

### When Phase Extends Beyond Project End

**Scenario:** User sets phase.endDate > project.endDate

**Action:**
```typescript
// Auto-extend project to accommodate phase
project.endDate = phase.endDate;
logChange('Project end date auto-extended to match phase');
```

**UI Feedback:**
- Show notification: "Project end date extended to [date] to accommodate phase"
- Update project detail view immediately
- Highlight the change

---

### When Phase Starts Before Project Start

**Scenario:** User sets phase.startDate < project.startDate

**Action:**
```typescript
// Auto-move project start to accommodate phase
project.startDate = phase.startDate;
logChange('Project start date auto-moved to match phase');
```

**UI Feedback:**
- Show notification: "Project start date moved to [date] to accommodate phase"
- Update project detail view immediately

---

### When Last Phase is Deleted

**Scenario:** User deletes the phase with the latest end date

**Action:**
```typescript
// Find new last phase
const remainingPhases = phases.filter(p => p.id !== deletedPhaseId);
if (remainingPhases.length > 0) {
  const newLastPhase = findLatestPhase(remainingPhases);
  project.endDate = newLastPhase.endDate;
  logChange('Project end date adjusted after phase deletion');
} else {
  // No phases left - project dates become independent
  // Keep current project dates
}
```

---

### When First Phase is Deleted

**Scenario:** User deletes the phase with the earliest start date

**Action:**
```typescript
const remainingPhases = phases.filter(p => p.id !== deletedPhaseId);
if (remainingPhases.length > 0) {
  const newFirstPhase = findEarliestPhase(remainingPhases);
  project.startDate = newFirstPhase.startDate;
  logChange('Project start date adjusted after phase deletion');
}
```

---

## 🎨 DESIGN DECISION: Why Auto-Extend (Option A)?

**Question:** When phase dates conflict with project dates, should we:
- A) Auto-extend project dates to fit phases?
- B) Reject phase changes that exceed project bounds?

**Decision:** **Option A - Auto-extend project dates**

**Rationale:**
1. **Phases are primary work units** - They represent actual work to be done
2. **Project dates are derived** - Project is the container for phases
3. **Better UX** - Less error messages, more helpful auto-corrections
4. **Matches user mental model** - "I need to extend this phase" shouldn't require "also extend the project"
5. **Prevents frustration** - Multi-step corrections are annoying

**Trade-offs:**
- ❌ Could make unintended project date changes
- ✅ But changes are logged and shown to user
- ✅ Can be undone easily
- ✅ Prevents workflow interruption

---

## 📊 VALIDATION LEVELS

### Level 1: Type Safety (Compile Time)
```typescript
// TypeScript ensures dates are Date objects
interface Phase {
  startDate: Date;  // Not nullable, not optional
  endDate: Date;    // Not nullable, not optional
}
```

### Level 2: Domain Rules (Runtime)
```typescript
// PhaseRules.validateMilestoneDateRange()
// ProjectRules.validateDateRange()
// These MUST be called before any date changes
```

### Level 3: Cross-Entity Validation (Orchestration)
```typescript
// DateSyncService.validateAndSuggestFixes()
// Checks project-phase relationship
```

### Level 4: Database Constraints (Last Resort)
```sql
-- Database CHECK constraints
-- Backup validation if application logic fails
```

---

## 🧪 TEST SCENARIOS

Every sync operation MUST have tests for these scenarios:

### Scenario 1: Creating Project with Multiple Phases
```typescript
test('Project dates match first and last phase', () => {
  const phases = [
    { startDate: '2026-01-01', endDate: '2026-01-10' },
    { startDate: '2026-01-11', endDate: '2026-01-20' },
  ];
  
  const result = DateSyncService.syncProjectToPhases(project, phases);
  
  expect(result.updatedProject.startDate).toBe('2026-01-01');
  expect(result.updatedProject.endDate).toBe('2026-01-20');
  expect(result.changed).toBe(true);
});
```

### Scenario 2: Extending Last Phase
```typescript
test('Project end date extends with last phase', () => {
  const phase = phases.find(p => p.isLast);
  phase.endDate = addDays(phase.endDate, 7);
  
  const result = DateSyncService.calculateRequiredProjectDates(project, phases);
  
  expect(result.mustUpdateEndDate).toBe(true);
  expect(result.suggestedEndDate).toBe(phase.endDate);
});
```

### Scenario 3: Deleting Last Phase
```typescript
test('Project end date shortens after deleting last phase', () => {
  const remainingPhases = phases.slice(0, -1);
  
  const result = DateSyncService.syncProjectToPhases(project, remainingPhases);
  
  const newLastPhase = remainingPhases[remainingPhases.length - 1];
  expect(result.updatedProject.endDate).toBe(newLastPhase.endDate);
});
```

### Scenario 4: Adding Phase Beyond Project End
```typescript
test('Project extends when new phase added beyond current end', () => {
  const newPhase = {
    startDate: addDays(project.endDate, 1),
    endDate: addDays(project.endDate, 8),
  };
  
  const allPhases = [...phases, newPhase];
  const result = DateSyncService.syncProjectToPhases(project, allPhases);
  
  expect(result.updatedProject.endDate).toBe(newPhase.endDate);
  expect(result.reason).toContain('extended to accommodate new phase');
});
```

---

## 🚨 FAILURE MODES & RECOVERY

### Failure Mode 1: Circular Dependency

**Problem:** Phase update triggers project update, which triggers phase re-validation, which triggers...

**Prevention:**
- Use `changed: boolean` flag in sync operations
- Only persist if actual changes occurred
- Add max recursion depth check

```typescript
static syncProjectToPhases(project, phases, depth = 0): SyncResult {
  if (depth > 3) {
    throw new Error('Circular sync detected');
  }
  // ... sync logic
}
```

---

### Failure Mode 2: Concurrent Updates

**Problem:** User updates project while phase update is in progress

**Prevention:**
- Use optimistic locking (version numbers)
- Refresh data before applying changes
- Show conflict resolution UI

---

### Failure Mode 3: Partial Failure

**Problem:** Project update succeeds but phase update fails

**Prevention:**
- Use database transactions
- All-or-nothing updates
- Rollback on any error

```typescript
const { error } = await supabase.rpc('update_project_and_phases', {
  project_data: projectData,
  phases_data: phasesData,
});
// Database function ensures transactional integrity
```

---

## 📚 IMPLEMENTATION CHECKLIST

When implementing date sync operations, verify:

- [ ] All 5 invariants are checked
- [ ] Auto-correction follows Option A rules
- [ ] Changes are logged for audit trail
- [ ] User notifications are shown
- [ ] Database transaction is used
- [ ] Optimistic locking prevents conflicts
- [ ] Tests cover all scenarios
- [ ] Documentation is updated

---

## 🔗 RELATED DOCUMENTS

- `/docs/analysis/PHASE_PROJECT_DATE_FLOW_ANALYSIS.md` - Architecture analysis
- `/src/domain/Domain Logic.md` - Business rules
- `/src/domain/Rules Logic.md` - Technical rules
- `/docs/features/phases/PHASE_TIME_DOMAIN_RULES.md` - Phase-specific rules

---

**This is a living document.** Update it when:
- New invariants are discovered
- Auto-correction rules change
- Edge cases are found
- User feedback requires rule changes
