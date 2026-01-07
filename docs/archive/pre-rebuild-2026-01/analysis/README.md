# Phase & Project Dates - Complete Documentation Index

**Created:** January 6, 2026  
**Purpose:** Central hub for all phase/project date documentation  
**Status:** Living Document

---

## 📚 DOCUMENTATION SUITE

This suite of documents provides everything you need to understand, debug, and fix phase/project date issues systematically.

---

## 🎯 START HERE

### New to the codebase?
👉 **Read:** [Visual Guide](./PHASE_PROJECT_DATE_FLOW_VISUAL_GUIDE.md)  
- Diagrams showing the correct flow
- Simple explanations of each layer
- Quick reference tables

### Experiencing a bug?
👉 **Use:** [Debugging Checklist](./PHASE_PROJECT_DATE_DEBUGGING_CHECKLIST.md)  
- Step-by-step diagnostic process
- Common patterns and fixes
- Code examples

### Need to implement a fix?
👉 **Reference:** [Date Sync Contract](/src/domain/rules/DATE_SYNC_CONTRACT.md)  
- Business rules and invariants
- Auto-correction policies
- Test scenarios

### Planning architecture improvements?
👉 **Study:** [Architecture Analysis](./PHASE_PROJECT_DATE_FLOW_ANALYSIS.md)  
- Current problems identified
- Detailed recommendations
- Implementation plan

---

## 📖 DOCUMENT SUMMARIES

### 1. Visual Guide (Beginners)
**File:** `PHASE_PROJECT_DATE_FLOW_VISUAL_GUIDE.md`

**What it covers:**
- ASCII diagrams of the correct architecture
- Step-by-step execution flow
- Examples of what's wrong now vs. what should happen
- Layer responsibility matrix

**Best for:**
- Understanding the big picture
- Onboarding new developers
- Explaining to non-technical stakeholders
- Quick reference during code review

**Key Sections:**
- The Correct Flow (diagram)
- What Happens When Phase Date Changes (step-by-step)
- What's Wrong Now (multiple paths problem)
- Quick Reference: Who Does What (table)

---

### 2. Date Sync Contract (Authoritative Rules)
**File:** `/src/domain/rules/DATE_SYNC_CONTRACT.md`

**What it covers:**
- 5 core invariants that MUST always be true
- Synchronization triggers and actions
- Auto-correction policies
- Test scenarios
- Failure modes and recovery

**Best for:**
- Writing domain rules code
- Validating business logic
- Writing tests
- Resolving ambiguity in requirements

**Key Sections:**
- Invariants (what must be true)
- Synchronization Triggers (when to sync)
- Auto-Correction Rules (how to fix violations)
- Design Decision: Why Auto-Extend (rationale)

**This is the SOURCE OF TRUTH for business rules.**

---

### 3. Architecture Analysis (Deep Dive)
**File:** `PHASE_PROJECT_DATE_FLOW_ANALYSIS.md`

**What it covers:**
- Current architecture flow (theory vs. reality)
- Specific flow for phase and project dates
- 5 identified problems with root causes
- 6 detailed recommendations
- 4-phase implementation plan
- Anti-patterns to avoid

**Best for:**
- Understanding why bugs exist
- Planning refactoring work
- Prioritizing fixes
- Directing AI/junior developers

**Key Sections:**
- The Specific Flow for Dates (detailed)
- Identified Problems (5 categories)
- Recommendations (6 actionable items)
- Implementation Plan (phased approach)

**This is the STRATEGIC ROADMAP.**

---

### 4. Debugging Checklist (Practical Troubleshooting)
**File:** `PHASE_PROJECT_DATE_DEBUGGING_CHECKLIST.md`

**What it covers:**
- 8-step debugging process
- Code search commands
- Invariant validation scripts
- Root cause categorization (5 categories)
- Fix patterns with before/after code
- Verification checklist

**Best for:**
- Actively debugging a specific bug
- Code review checklist
- QA testing scenarios
- Quick fixes without full refactor

**Key Sections:**
- Step 1: Identify Symptom (checklist)
- Step 2: Find Code Path (search commands)
- Step 3: Validate Invariants (validation scripts)
- Step 5: Identify Root Cause (5 categories)
- Step 6: Apply Fix (code examples)

**This is the TACTICAL PLAYBOOK.**

---

## 🔄 WORKFLOW BY TASK

### Task: Fix an Urgent Bug

```
1. Read: Debugging Checklist (Step 1: Identify symptom)
2. Reference: Date Sync Contract (Check which invariant is violated)
3. Follow: Debugging Checklist (Steps 2-8)
4. Update: This index (add learnings to "Common Bugs" section)
```

### Task: Implement Date Sync Service

```
1. Read: Architecture Analysis (Recommendation 2)
2. Reference: Date Sync Contract (Synchronization Triggers section)
3. Study: Visual Guide (Step-by-step execution flow)
4. Implement: Following the contract specifications
5. Test: Using scenarios from Date Sync Contract
```

### Task: Refactor Date Handling

```
1. Read: Architecture Analysis (full document)
2. Study: Visual Guide (What's Wrong Now section)
3. Reference: Date Sync Contract (all invariants)
4. Plan: Using Implementation Plan from Architecture Analysis
5. Execute: Phase by phase, with tests
```

### Task: Code Review

```
1. Use: Visual Guide (Quick Reference: Who Does What)
2. Check: Debugging Checklist (Common Patterns section)
3. Verify: Date Sync Contract (invariants are enforced)
4. Flag: Any violations of single-flow pattern
```

### Task: Write Tests

```
1. Reference: Date Sync Contract (Test Scenarios section)
2. Study: Debugging Checklist (Verify the Fix section)
3. Ensure: All 5 invariants are tested
4. Cover: All sync triggers are tested
```

---

## 🎓 KEY CONCEPTS TO UNDERSTAND

### Concept 1: Single Flow Pattern

**Definition:** All date updates must flow through the same architectural layers

**Why it matters:** Multiple code paths = inconsistent behavior = bugs

**Where to learn:**
- Visual Guide: "The Correct Flow" section
- Architecture Analysis: "Recommendation 1"

---

### Concept 2: Invariants

**Definition:** Conditions that MUST always be true

**The 5 invariants:**
1. Phase dates within project dates
2. Project spans all phases
3. No overlapping phases
4. Time-limited projects have end dates
5. Phases with estimated time cannot end in past

**Where to learn:**
- Date Sync Contract: "Invariants" section
- Debugging Checklist: "Step 3: Validate Business Rules"

---

### Concept 3: Auto-Correction

**Definition:** System automatically fixes violations when safe to do so

**Policy:** Always extend project to accommodate phases (not reject)

**Why:** Better UX, phases are primary work units

**Where to learn:**
- Date Sync Contract: "Auto-Correction Rules" section
- Architecture Analysis: "Recommendation 4"

---

### Concept 4: Date Sync Service

**Definition:** Single source of truth for project-phase date synchronization

**Status:** TO BE IMPLEMENTED (see recommendations)

**Purpose:** Consolidate all sync logic in one place

**Where to learn:**
- Architecture Analysis: "Recommendation 2"
- Date Sync Contract: "Synchronization Triggers" section

---

### Concept 5: Orchestrators

**Definition:** Layer that coordinates workflows across domain entities and services

**Responsibilities:**
- Load required data
- Coordinate domain operations
- Handle transactions
- Error handling
- User notifications

**Where to learn:**
- Visual Guide: "Orchestrator Layer" section
- Architecture Analysis: "The Intended Flow"

---

## 🐛 COMMON BUGS & SOLUTIONS

### Bug: Phase date changes but project doesn't update

**Symptom:** User extends phase end date, project end date stays the same

**Root Cause:** Missing DateSyncService call in orchestrator

**Solution:** Add sync logic to PhaseOrchestrator.updatePhase()

**Reference:**
- Debugging Checklist: Category B (Missing Sync Logic)
- Architecture Analysis: Problem 2 (Unclear Date Sync Responsibility)

---

### Bug: Can create overlapping phases

**Symptom:** Two phases have overlapping date ranges

**Root Cause:** Validation bypassed via direct database update

**Solution:** Enforce orchestrator usage, add database constraint

**Reference:**
- Debugging Checklist: Category A (Architectural Bypass)
- Date Sync Contract: Invariant 3

---

### Bug: Project end date doesn't match last phase

**Symptom:** project.endDate !== lastPhase.endDate

**Root Cause:** Sync calculation exists but result not persisted

**Solution:** Apply sync result and save to database

**Reference:**
- Debugging Checklist: Step 4 (Check sync result handling)
- Date Sync Contract: Invariant 2

---

### Bug: Different dates in different UI views

**Symptom:** Same phase shows different dates in modal vs. list view

**Root Cause:** UI local state out of sync with database

**Solution:** Refresh data after mutations, single source of truth

**Reference:**
- Debugging Checklist: Category E (UI State Inconsistency)
- Visual Guide: "Who Does What" (UI Component row)

---

## 🚀 IMPLEMENTATION PRIORITIES

Based on Architecture Analysis Phase Plan:

### HIGH Priority (Do First)
1. ✅ Create documentation suite (DONE - this suite)
2. ⏳ Create DateSyncService
3. ⏳ Write integration tests
4. ⏳ Fix orchestrators to use DateSyncService
5. ⏳ Remove duplicate sync logic

### MEDIUM Priority (After Core Works)
6. ⏳ Standardize field names (dueDate → endDate)
7. ⏳ Add auto-fix suggestions to validation
8. ⏳ Remove date calculations from UI components

### LOW Priority (Nice to Have)
9. ⏳ Add monitoring/logging
10. ⏳ Create database constraints as backup
11. ⏳ Optimize performance

---

## 📝 MAINTENANCE

### When to Update This Documentation

**Add to "Common Bugs" section when:**
- New bug pattern discovered
- Root cause identified
- Solution implemented

**Update "Implementation Priorities" when:**
- Task completed (✅)
- Priority changes
- New task identified

**Update "Key Concepts" when:**
- Architecture changes
- New patterns introduced
- Terminology clarified

---

## 🔗 RELATED DOCUMENTATION

### Domain Documentation
- `/src/domain/App Logic.md` - Business rules (user-facing)
- `/src/domain/Business Rules.md` - Technical rules

### Operation Guides
- `/docs/operations/PHASE_MIGRATION_INSTRUCTIONS.md`
- `/docs/operations/ENTITY_ADOPTION_PLAN.md`

### Feature Documentation
- `/docs/features/phases/PHASE_TIME_DOMAIN_RULES.md`

---

## ❓ FAQ

### Q: Which document should I read first?
**A:** Depends on your goal:
- Bug fixing → Debugging Checklist
- Understanding system → Visual Guide
- Implementing features → Date Sync Contract
- Refactoring → Architecture Analysis

### Q: Where are the business rules defined?
**A:** Date Sync Contract is the authoritative source for date-related business rules.

### Q: How do I know if my fix is correct?
**A:** Use the verification checklist in Debugging Checklist Step 7, and ensure all 5 invariants pass.

### Q: Can I update project dates directly?
**A:** No. Always use ProjectOrchestrator. It coordinates sync with phases.

### Q: Can I update phase dates directly?
**A:** No. Always use PhaseOrchestrator. It coordinates sync with project.

### Q: What if the orchestrator doesn't have the method I need?
**A:** Add it to the orchestrator. Don't bypass the layer.

### Q: Where should date calculations happen?
**A:** In Services (pure date math) or Domain Rules (business logic). Never in UI components.

---

## 🎯 SUCCESS CRITERIA

You'll know the date system is working correctly when:

- ✅ All 5 invariants always true
- ✅ Single code path for all updates
- ✅ DateSyncService handles all sync operations
- ✅ No date math in UI components
- ✅ All integration tests pass
- ✅ No direct database updates from UI
- ✅ User notifications for auto-corrections
- ✅ Zero date-related bugs in production

---

## 📞 GETTING HELP

**If you're stuck:**

1. Check this index for relevant document
2. Follow debugging checklist step-by-step
3. Validate invariants to find violated rule
4. Reference contract for correct behavior
5. Add your findings to "Common Bugs" section

**If bug is not covered:**

1. Document symptoms
2. Identify root cause category
3. Add to "Common Bugs" section
4. Update relevant documents
5. Share learning with team

---

**Last Updated:** January 6, 2026  
**Maintainer:** Development Team  
**Status:** Active - Update as system evolves
