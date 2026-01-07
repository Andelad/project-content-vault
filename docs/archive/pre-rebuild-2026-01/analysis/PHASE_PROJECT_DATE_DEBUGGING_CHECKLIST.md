# Phase & Project Date Bugs - Debugging Checklist

**Purpose:** Quick diagnostic checklist when phase/project date bugs occur  
**Last Updated:** January 6, 2026

---

## 🔍 STEP 1: Identify the Bug Symptom

Check which symptom matches:

- [ ] **Phase end date changes, but project end date doesn't update**
- [ ] **Project end date changes, but phases become invalid**
- [ ] **Can create phases that overlap**
- [ ] **Can create phases outside project date range**
- [ ] **Phase dates show differently in different UI views**
- [ ] **Auto-estimates don't update when dates change**
- [ ] **Recurring phases generate incorrect dates**
- [ ] **Deleting phase doesn't adjust project dates**
- [ ] **Date validation shows in one place, not in another**

---

## 🔎 STEP 2: Find the Code Path

### Quick Search Commands

```bash
# Find where the update is triggered (UI)
grep -r "updatePhase\|updateProject\|setEndDate\|setStartDate" src/components/

# Find the service being called
grep -r "PhaseOrchestrator\|ProjectOrchestrator\|UnifiedProjectService" src/components/

# Find direct database calls (BAD - should use orchestrator)
grep -r "supabase.*milestone\|supabase.*project" src/components/

# Find domain rule usage
grep -r "PhaseRules\|ProjectRules" src/
```

### Questions to Answer

1. **Where is the update triggered?**
   - File: `_______________________`
   - Line: `_______`
   - Component: `_______________________`

2. **What service/orchestrator is called?**
   - [ ] PhaseOrchestrator
   - [ ] ProjectOrchestrator
   - [ ] UnifiedProjectService
   - [ ] Direct domain entity
   - [ ] Direct database call (⚠️ RED FLAG!)
   - [ ] Legacy service (⚠️ RED FLAG!)

3. **Does it go through the proper flow?**
   ```
   UI → Orchestrator → DateSyncService → Domain Entity → Domain Rules → DB
   ```
   - YES: Bug is in business logic ✓
   - NO: Bug is architectural (bypass) ✗

---

## 🧪 STEP 3: Validate Business Rules

### Check Invariants

Run these checks manually or via debugger:

```typescript
// Invariant 1: Phase within project
console.log('Phase start:', phase.startDate);
console.log('Phase end:', phase.endDate);
console.log('Project start:', project.startDate);
console.log('Project end:', project.endDate);

// Should be true:
assert(project.startDate <= phase.startDate);
assert(phase.startDate < phase.endDate);
assert(phase.endDate <= project.endDate);
```

```typescript
// Invariant 2: Project spans all phases
const firstPhase = phases[0];
const lastPhase = phases[phases.length - 1];

console.log('First phase start:', firstPhase.startDate);
console.log('Project start:', project.startDate);
console.log('Last phase end:', lastPhase.endDate);
console.log('Project end:', project.endDate);

// Should be true:
assert(project.startDate === firstPhase.startDate);
assert(project.endDate === lastPhase.endDate);
```

```typescript
// Invariant 3: No overlapping phases
for (let i = 0; i < phases.length - 1; i++) {
  const current = phases[i];
  const next = phases[i + 1];
  
  const gap = (next.startDate - current.endDate) / (24 * 60 * 60 * 1000);
  
  console.log(`Gap between phase ${i} and ${i+1}:`, gap, 'days');
  
  // Should be true:
  assert(gap >= 1, 'Phases must have 1-day gap');
}
```

### Results

- [ ] ✅ All invariants valid (bug is elsewhere)
- [ ] ❌ Invariant 1 violated (phase outside project)
- [ ] ❌ Invariant 2 violated (project doesn't span phases)
- [ ] ❌ Invariant 3 violated (phases overlap)

---

## 🔧 STEP 4: Check Sync Service Usage

### Is DateSyncService being used?

```bash
# Search for DateSyncService usage
grep -r "DateSyncService" src/services/orchestrators/
```

**If NOT found:**
- ⚠️ **Problem:** Date sync logic is missing or duplicated elsewhere
- **Fix:** Refactor to use DateSyncService

**If found:**
- Check which method is called:
  - [ ] `syncProjectToPhases()` - After phase changes
  - [ ] `calculateRequiredProjectDates()` - Before phase changes
  - [ ] `validateAndSuggestFixes()` - Validation only

### Check sync result handling

```typescript
// Look for this pattern in orchestrator:
const syncResult = DateSyncService.syncProjectToPhases(project, phases);

if (syncResult.changed) {
  // ✓ Good - persists the changes
  await db.updateProject(syncResult.updatedProject);
  notify(`Project dates updated: ${syncResult.reason}`);
} else {
  // ✗ Bad - ignores sync result
}
```

**Is the result being used?**
- [ ] ✅ Yes - Changes persisted and user notified
- [ ] ❌ No - Sync calculated but not applied (BUG!)
- [ ] ❌ No - Sync not called at all (BUG!)

---

## 🎯 STEP 5: Identify Root Cause Category

Based on above checks, categorize the bug:

### Category A: Architectural Bypass
**Symptoms:**
- Direct database calls from UI
- Legacy service being used
- No orchestrator in call stack

**Root Cause:** Code bypasses the proper flow

**Fix Priority:** HIGH - Refactor to use orchestrator

**Fix Steps:**
1. Create/use orchestrator method
2. Remove direct database calls
3. Add proper validation
4. Add sync service call
5. Update tests

---

### Category B: Missing Sync Logic
**Symptoms:**
- Invariant 2 violated (project doesn't match phases)
- DateSyncService not called
- Changes save but don't propagate

**Root Cause:** Orchestrator exists but doesn't sync

**Fix Priority:** HIGH - Add DateSyncService

**Fix Steps:**
1. Import DateSyncService
2. Call appropriate sync method
3. Apply returned changes
4. Notify user of auto-corrections
5. Add test for sync

---

### Category C: Incorrect Business Logic
**Symptoms:**
- DateSyncService is called
- Invariants violated despite validation
- Wrong dates calculated

**Root Cause:** Bug in domain rules or sync service

**Fix Priority:** MEDIUM - Fix business logic

**Fix Steps:**
1. Write failing test for correct behavior
2. Fix domain rule or sync service
3. Verify all tests pass
4. Update documentation

---

### Category D: Validation Not Enforced
**Symptoms:**
- Rules exist but aren't called
- Can save invalid state
- Database contains invalid data

**Root Cause:** Validation is optional or skipped

**Fix Priority:** HIGH - Enforce validation

**Fix Steps:**
1. Make validation mandatory in orchestrator
2. Reject invalid changes with clear error
3. Add database constraints as backup
4. Add validation tests

---

### Category E: UI State Inconsistency
**Symptoms:**
- Different dates in different UI views
- Local state out of sync with database
- Optimistic updates not reverted on error

**Root Cause:** UI state management issue

**Fix Priority:** MEDIUM - Fix state management

**Fix Steps:**
1. Ensure single source of truth
2. Refresh data after mutations
3. Handle loading/error states
4. Revert optimistic updates on failure

---

## 🛠️ STEP 6: Apply the Fix

### For Architectural Bypass (Category A)

**Before:**
```typescript
// ❌ BAD - Direct database update
const handleUpdatePhase = async (id, changes) => {
  await supabase.from('milestones')
    .update({ end_date: changes.endDate })
    .eq('id', id);
};
```

**After:**
```typescript
// ✅ GOOD - Use orchestrator
const handleUpdatePhase = async (id, changes) => {
  const result = await PhaseOrchestrator.updatePhase(id, changes);
  if (!result.success) {
    showError(result.errors);
  }
};
```

---

### For Missing Sync Logic (Category B)

**Before:**
```typescript
// ❌ BAD - No sync
static async updatePhase(id, changes) {
  const phase = await db.getPhase(id);
  phase.updateDates(changes.startDate, changes.endDate);
  await db.save(phase);
}
```

**After:**
```typescript
// ✅ GOOD - With sync
static async updatePhase(id, changes) {
  const phase = await db.getPhase(id);
  const project = await db.getProject(phase.projectId);
  const allPhases = await db.getPhases(project.id);
  
  // Calculate sync requirements
  const updatedPhases = allPhases.map(p => 
    p.id === id ? { ...p, ...changes } : p
  );
  const syncResult = DateSyncService.syncProjectToPhases(
    project, 
    updatedPhases
  );
  
  // Apply changes in transaction
  await db.transaction(async () => {
    await db.updatePhase(id, changes);
    if (syncResult.changed) {
      await db.updateProject(project.id, {
        startDate: syncResult.updatedProject.startDate,
        endDate: syncResult.updatedProject.endDate,
      });
    }
  });
  
  // Notify user
  if (syncResult.changed) {
    notify(`Project dates updated: ${syncResult.reason}`);
  }
}
```

---

### For Incorrect Business Logic (Category C)

**Before:**
```typescript
// ❌ BAD - Wrong calculation
static calculateMinimumProjectEndDate(phases) {
  // Bug: Uses startDate instead of endDate
  return Math.max(...phases.map(p => p.startDate));
}
```

**After:**
```typescript
// ✅ GOOD - Correct calculation
static calculateMinimumProjectEndDate(phases) {
  if (phases.length === 0) return new Date();
  return Math.max(...phases.map(p => new Date(p.endDate)));
}
```

---

## ✅ STEP 7: Verify the Fix

### Checklist

- [ ] **Unit test passes** for the specific fix
- [ ] **Integration test passes** for the full flow
- [ ] **Manual QA** in UI confirms bug is fixed
- [ ] **Related flows still work** (regression check)
- [ ] **Database constraints** don't prevent valid operations
- [ ] **User notifications** show for auto-corrections
- [ ] **Documentation updated** if behavior changed
- [ ] **Logs added** for debugging future issues

### Test Cases to Run

```typescript
// 1. Create phase → project dates should sync
test('Creating phase syncs project dates', async () => {
  const result = await PhaseOrchestrator.createPhase({...});
  expect(project.endDate).toBe(phase.endDate);
});

// 2. Update phase → project dates should sync
test('Updating phase end date extends project', async () => {
  await PhaseOrchestrator.updatePhase(id, { endDate: newDate });
  expect(project.endDate).toBe(newDate);
});

// 3. Delete phase → project dates should sync
test('Deleting last phase shortens project', async () => {
  await PhaseOrchestrator.deletePhase(lastPhaseId);
  expect(project.endDate).toBe(newLastPhase.endDate);
});

// 4. Validation prevents invalid state
test('Cannot create overlapping phases', async () => {
  const result = await PhaseOrchestrator.createPhase({
    startDate: existingPhase.startDate,
    endDate: existingPhase.endDate,
  });
  expect(result.success).toBe(false);
  expect(result.errors).toContain('overlap');
});
```

---

## 📊 STEP 8: Document & Prevent Recurrence

### Update Documentation

- [ ] Add fix to bug tracking system
- [ ] Update architecture docs if pattern changed
- [ ] Add code comments explaining why fix was needed
- [ ] Update this checklist if new symptom discovered

### Prevent Future Bugs

**Add guardrails:**

```typescript
// Example: Prevent direct database updates
export class PhaseRepository {
  // Make constructor private
  private constructor() {}
  
  // Force use through orchestrator
  static async save(phase: Phase, context: OrchestrationContext) {
    if (!context.fromOrchestrator) {
      throw new Error(
        'Phases must be saved through PhaseOrchestrator to ensure date sync'
      );
    }
    // ... actual save logic
  }
}
```

**Add monitoring:**

```typescript
// Log sync operations for debugging
DateSyncService.syncProjectToPhases = (project, phases) => {
  const result = actualSyncLogic(project, phases);
  
  if (result.changed) {
    logger.info('Date sync performed', {
      projectId: project.id,
      reason: result.reason,
      oldEndDate: project.endDate,
      newEndDate: result.updatedProject.endDate,
    });
  }
  
  return result;
};
```

---

## 🎓 COMMON PATTERNS TO LOOK FOR

### Pattern 1: "Ghost" updates
**Symptom:** UI shows change, but database doesn't persist  
**Cause:** Optimistic update without error handling  
**Fix:** Revert optimistic update on save failure

### Pattern 2: "Cascade" failures
**Symptom:** Phase update succeeds but project update fails  
**Cause:** Not using database transaction  
**Fix:** Wrap in transaction, all-or-nothing

### Pattern 3: "Silent" auto-corrections
**Symptom:** Dates change but user doesn't know why  
**Cause:** Auto-sync without notification  
**Fix:** Always notify user of auto-corrections

### Pattern 4: "Stale" data
**Symptom:** UI shows old dates after update  
**Cause:** Not refreshing after mutation  
**Fix:** Invalidate cache/refetch after updates

### Pattern 5: "Split" validation
**Symptom:** Some validations pass, others fail inconsistently  
**Cause:** Multiple validation code paths  
**Fix:** Consolidate to single validation source

---

## 🚀 Quick Reference: File Locations

```
Domain Rules:
  /src/domain/rules/PhaseRules.ts
  /src/domain/rules/ProjectRules.ts
  /src/domain/rules/RelationshipRules.ts

Domain Entities:
  /src/domain/entities/Phase.ts
  /src/domain/entities/Project.ts

Orchestrators:
  /src/services/orchestrators/PhaseOrchestrator.ts
  /src/services/orchestrators/ProjectOrchestrator.ts

Sync Service (TO BE CREATED):
  /src/domain/domain-services/DateSyncService.ts

Tests (TO BE CREATED):
  /src/test/integration/phase-project-dates.test.ts

Documentation:
  /docs/analysis/PHASE_PROJECT_DATE_FLOW_ANALYSIS.md
  /src/domain/rules/DATE_SYNC_CONTRACT.md
```

---

**Remember:** When in doubt, check the invariants first. If invariants are violated, you've found the bug location.
