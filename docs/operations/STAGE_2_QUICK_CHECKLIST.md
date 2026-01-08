# Stage 2 Architecture Tightening - Quick Checklist

**Created:** January 7, 2026  
**Purpose:** Trackable checklist for Stage 2 completion

---

## Overview

**Goal:** Extract ALL business logic from orchestrators into domain rules  
**Time:** ~36 hours (5 days)  
**Status:** 🟡 Not Started

---

## Task Checklist

### Phase Orchestrator (6 hours)
- [ ] **Task 1:** Extract budget validation to `PhaseBudget` (3h)
- [ ] **Task 2:** Extract recurring calculations to `PhaseRecurrence` (2h)
- [ ] **Task 3:** Extract date conflict detection to `PhaseValidation` (1h)

### Event & Time Tracking (9 hours)
- [ ] **Task 4:** Create `EventRecurrence` domain rules (4h)
- [ ] **Task 5:** Extract time tracking calculations to domain rules (3h)
- [ ] **Task 6:** Create `FeedbackOrchestrator` + validation rules (2h)

### Validation Extraction (8 hours)
- [ ] **Task 7:** Extract `HolidayOrchestrator` validation (3h)
- [ ] **Task 8:** Extract `GroupOrchestrator` validation (2h)
- [ ] **Task 9:** Extract `CalendarEventOrchestrator` validation (3h)

### Analysis & Display (6 hours)
- [ ] **Task 10:** Extract project budget analysis to domain rules (2h)
- [ ] **Task 11:** Extract timeline classification to domain rules (2h)
- [ ] **Task 12:** Complete Phase validation TODOs (2h)

### Cleanup & Enforcement (5 hours)
- [ ] **Task 13:** Fix EventWorkHourIntegration imports (1h)
- [ ] **Task 14:** Add development-time enforcement (3h)
- [ ] **Task 15:** Documentation cleanup (1h)

---

## Files to Create

### New Domain Rule Files
- [ ] `domain/rules/events/EventRecurrence.ts`
- [ ] `domain/rules/time-tracking/TimeEntryCalculation.ts`
- [ ] `domain/rules/feedback/FeedbackValidation.ts`
- [ ] `domain/rules/holidays/HolidayValidation.ts`
- [ ] `domain/rules/groups/GroupValidation.ts`

### New Orchestrator Files
- [ ] `services/orchestrators/FeedbackOrchestrator.ts`

### Enhanced Domain Rule Files
- [ ] `domain/rules/phases/PhaseBudget.ts` - Add milestone scheduling validation
- [ ] `domain/rules/phases/PhaseRecurrence.ts` - Add occurrence estimation
- [ ] `domain/rules/phases/PhaseValidation.ts` - Add date conflict detection
- [ ] `domain/rules/events/EventValidation.ts` - Add form validation + duration calc
- [ ] `domain/rules/projects/ProjectBudget.ts` - Add phase analysis method
- [ ] `domain/rules/timeline/TimelineDisplay.ts` - Add allocation classification

### Enforcement Files
- [ ] `utils/architectureEnforcement.ts`
- [ ] `integrations/supabase/monitored-client.ts` (modify existing)

---

## Orchestrators to Refactor

- [ ] `PhaseOrchestrator.ts` - Extract 3 types of business logic
- [ ] `recurringEventsOrchestrator.ts` - Use `EventRecurrence` domain rules
- [ ] `timeTrackingOrchestrator.ts` - Use `TimeEntryCalculation` domain rules
- [ ] `HolidayOrchestrator.ts` - Use `HolidayValidation` domain rules
- [ ] `GroupOrchestrator.ts` - Use `GroupValidation` domain rules
- [ ] `CalendarEventOrchestrator.ts` - Use `EventValidation` domain rules
- [ ] `ProjectOrchestrator.ts` - Use `ProjectBudget.analyzeProjectPhases`
- [ ] `TimelineOrchestrator.ts` - Use `TimelineDisplay.classifyDayAllocationType`

---

## UI Components to Refactor

- [ ] `FeedbackModal.tsx` - Replace direct Supabase calls with `FeedbackOrchestrator`

---

## Verification Steps (After Each Task)

After completing each task, verify:

1. **Domain Rules Check**
   - [ ] Business logic exists in domain/rules/ only
   - [ ] No duplicate logic in orchestrators
   - [ ] Calculations co-located with validation

2. **Orchestrator Check**
   - [ ] Orchestrator delegates to domain rules
   - [ ] Orchestrator is thin (coordination only)
   - [ ] No inline Math.floor/ceil/round for business calculations

3. **Build Check**
   - [ ] `npm run build` succeeds
   - [ ] No TypeScript errors
   - [ ] All imports resolve

4. **Test Check**
   - [ ] Existing tests pass
   - [ ] New domain rule tests added (where applicable)

---

## Daily Progress Tracking

### Day 1 (6 hours) - Phase Orchestrator
- [ ] Morning: Task 1 (Budget validation)
- [ ] Afternoon: Tasks 2-3 (Recurring calcs + date conflicts)
- [ ] Status: ___% complete

### Day 2 (9 hours) - Events & Time Tracking
- [ ] Morning: Task 4 (EventRecurrence)
- [ ] Afternoon: Tasks 5-6 (Time tracking + Feedback)
- [ ] Status: ___% complete

### Day 3 (8 hours) - Validation Extraction
- [ ] Morning: Task 7 (Holiday validation)
- [ ] Afternoon: Tasks 8-9 (Group + Event validation)
- [ ] Status: ___% complete

### Day 4 (6 hours) - Analysis & Display
- [ ] Morning: Task 10 (Project analysis)
- [ ] Afternoon: Tasks 11-12 (Timeline + TODOs)
- [ ] Status: ___% complete

### Day 5 (5 hours) - Cleanup & Enforcement
- [ ] Morning: Tasks 13-14 (Imports + Enforcement)
- [ ] Afternoon: Task 15 (Documentation)
- [ ] Status: ___% complete

---

## Success Criteria

Stage 2 is complete when:

- [x] All 15 tasks completed
- [x] Zero business logic in orchestrators
- [x] All validation in domain/rules/
- [x] All calculations in domain/rules/
- [x] Development enforcement active
- [x] All tests passing
- [x] Zero compilation errors
- [x] Documentation updated

---

## Post-Completion

After Stage 2 is complete:

1. **Update `.ddd`** - Mark Stage 2 as complete
2. **Archive this checklist** - Move to `/docs/sessions/`
3. **Test bug fixing** - Verify clarity of bug locations
4. **Team announcement** - Share architecture improvements

---

**Reference:** See `ARCHITECTURE_STAGE_2_TIGHTENING.md` for detailed implementation instructions.
