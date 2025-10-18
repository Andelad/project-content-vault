# Message Template for Lovable

---

## Copy this message to Lovable:

---

Hi Lovable,

I need your help implementing the timeline architecture refactor. The database migration is complete and I have detailed implementation instructions ready.

**Please read these files in order:**

1. **`LOVABLE_IMPLEMENTATION_INSTRUCTIONS.md`** ⭐ (START HERE - complete implementation guide)
2. **`IMPLEMENTATION_READY.md`** (phase-by-phase overview)
3. **`TIMELINE_ARCHITECTURE_REFACTOR.md`** (architecture context)

**What I need you to implement:**

**Phases 1-6** as documented in `LOVABLE_IMPLEMENTATION_INSTRUCTIONS.md`:

1. **Phase 1:** Update type definitions in `src/types/core.ts`
   - Update `Milestone` interface (add new fields)
   - Add `RecurringConfig` interface
   - Add `DayEstimate` interface

2. **Phase 2:** Create `src/services/calculations/dayEstimateCalculations.ts`
   - Main function: `calculateProjectDayEstimates()`
   - This becomes the single source of truth for timeline rectangles

3. **Phase 3:** Create `src/services/unified/UnifiedDayEstimateService.ts`
   - Wrap calculations with business logic
   - Add validation methods

4. **Phase 4:** Create `src/services/orchestrators/TimelineOrchestrator.ts`
   - One method: `getTimelineData()`
   - Both Days and Weeks views will call this

5. **Phase 5:** Update `src/services/repositories/MilestoneRepository.ts`
   - Map new database columns
   - Implement dual-write strategy (write to old and new columns)

6. **Phase 6:** Update timeline components
   - `src/components/timeline/TimelineBar.tsx`
   - Use `TimelineOrchestrator.getTimelineData()` instead of multiple sources

**Important:**
- Database migration is complete ✅
- New columns exist: `time_allocation_hours`, `start_date`, `is_recurring`, `recurring_config`
- Use dual-write strategy (write to both old and new columns for backward compatibility)
- All code examples and implementation details are in `LOVABLE_IMPLEMENTATION_INSTRUCTIONS.md`

**Testing:**
After implementation, verify:
- Timeline rectangles appear for projects
- Weeks view = Days view (same data)
- Tooltips show correct hours
- No console errors

**Estimated time:** 7-8 hours

Please let me know if you have any questions or need clarification on any phase.

Thank you!

---

## Alternative (Shorter) Message:

---

Hi Lovable,

Database migration complete ✅. Ready to implement timeline refactor.

**Please implement Phases 1-6 from `LOVABLE_IMPLEMENTATION_INSTRUCTIONS.md`**

This file contains:
- Complete code examples for each phase
- Files to create/modify
- Backward compatibility strategy
- Testing checklist

Key files to implement:
1. Update `src/types/core.ts` (add RecurringConfig, DayEstimate, update Milestone)
2. Create `src/services/calculations/dayEstimateCalculations.ts` (SINGLE SOURCE OF TRUTH)
3. Create `src/services/unified/UnifiedDayEstimateService.ts`
4. Create `src/services/orchestrators/TimelineOrchestrator.ts`
5. Update `src/services/repositories/MilestoneRepository.ts` (map new columns)
6. Update `src/components/timeline/TimelineBar.tsx` (use TimelineOrchestrator)

**Goal:** Fix timeline rendering bugs by establishing single source of truth for day estimates.

All details in `LOVABLE_IMPLEMENTATION_INSTRUCTIONS.md`. Questions welcome!

---

## What to Expect from Lovable:

Lovable will likely:
1. ✅ Read the implementation instructions
2. ✅ Ask clarifying questions if needed
3. ✅ Implement phases one by one
4. ✅ Report progress and any issues
5. ✅ May ask for testing/verification

If Lovable asks questions, refer them to:
- `LOVABLE_IMPLEMENTATION_INSTRUCTIONS.md` for HOW
- `IMPLEMENTATION_READY.md` for WHAT
- `TIMELINE_ARCHITECTURE_REFACTOR.md` for WHY

---

## Tips:

**If Lovable asks "Should I proceed?":**
Say: "Yes, please proceed with all 6 phases in order."

**If Lovable encounters errors:**
Ask: "Can you share the error message and which phase you're on?"

**If Lovable asks about testing:**
Say: "Please implement all phases first, then we'll test together."

**If Lovable asks about WeeksView:**
Say: "If WeeksView exists, apply the same pattern as TimelineBar. If it doesn't exist or looks different, let me know and we'll adjust."

---

## After Lovable Completes:

1. I'll review the implementation
2. We'll test the timeline rendering
3. We'll verify weeks view = days view
4. We'll monitor for any errors
5. After 48 hours of stable operation, we can clean up old code

---

Good luck! The instructions are comprehensive and Lovable should have everything needed. 🚀
