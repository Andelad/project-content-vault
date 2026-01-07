# Phase 2: Calculations Migration - Execution Plan

**Date:** January 7, 2026  
**Status:** Ready to execute  
**Goal:** Eliminate services/calculations/ by moving ALL to domain/rules/

---

## 🎯 Core Principle

**Calculations ARE business logic** - they belong in `domain/rules/`, NOT in a separate utilities layer.

**"Math inline"** means:
- ✅ Calculations co-located WITH the business rules they support
- ✅ Functions live IN the domain/rules/ files
- ❌ NOT duplicating code everywhere
- ❌ NOT a separate calculations/ layer

---

## 📋 Migration Mapping

### Current State (WRONG):
```
src/services/calculations/
├── projects/phaseCalculations.ts       (825 lines - budget, allocation math)
├── projects/projectCalculations.ts     (project duration, metrics)
├── events/eventCalculations.ts         (event duration, recurrence)
├── events/holidayCalculations.ts       (holiday expansion, counting)
├── availability/capacityAnalysis.ts    (capacity, availability)
├── availability/workHourGeneration.ts  (work hour creation)
├── general/dateCalculations.ts         (date math - duration, overlap)
├── insights/analyticsCalculations.ts   (analytics metrics)
├── tracking/timeTrackingCalculations.ts (time tracking math)
└── ... more files
```

### Target State (CORRECT):
```
src/domain/rules/
├── phases/
│   ├── PhaseBudget.ts                  ← phaseCalculations functions move here
│   │   - calculateBudgetUtilization()
│   │   - calculateTotalAllocation()
│   │   - calculateRemainingBudget()
│   │   - (all 30+ functions co-located)
│
├── projects/
│   ├── ProjectBudget.ts                ← projectCalculations functions move here
│   │   - calculateProjectDuration()
│   │   - calculateProjectTimeMetrics()
│   │   - (all project math co-located)
│
├── events/
│   ├── EventDuration.ts                ← eventCalculations functions move here
│   │   - calculateEventDurationOnDate()
│   │   - aggregateEventDurationsByDate()
│
├── holidays/
│   ├── HolidayExpansion.ts             ← holidayCalculations functions move here
│   │   - expandHolidayDates()
│   │   - countHolidayDaysInRange()
│
├── availability/
│   ├── CapacityRules.ts                ← capacityAnalysis functions move here
│   ├── WorkHourGeneration.ts           ← workHourGeneration functions move here
│
├── shared/
│   ├── DateMath.ts                     ← dateCalculations (if truly cross-cutting)
│   │   - calculateDurationHours()
│   │   - calculateDurationMinutes()
│   │   - calculateTimeOverlapHours()
│
└── ... other domain modules
```

---

## 🔨 Execution Steps

### Step 1: Move Phase Calculations
```bash
# Move phaseCalculations.ts (825 lines) → PhaseBudget.ts
# All budget/allocation math co-located with budget rules
```

**Functions to move:**
- calculateTotalAllocation
- calculateBudgetUtilization
- calculateRemainingBudget
- calculateOverageAmount
- calculateMilestoneDensity
- calculateAverageMilestoneAllocation
- (30+ total functions)

### Step 2: Move Project Calculations
```bash
# Move projectCalculations.ts → ProjectBudget.ts
# All project time/budget math co-located with project rules
```

### Step 3: Move Event Calculations
```bash
# Move eventCalculations.ts → domain/rules/events/
# Split if needed: EventDuration.ts, EventRecurrence.ts
```

### Step 4: Move Holiday Calculations
```bash
# Move holidayCalculations.ts → domain/rules/holidays/
```

### Step 5: Move Availability Calculations
```bash
# Move capacityAnalysis.ts → domain/rules/availability/CapacityRules.ts
# Move workHourGeneration.ts → domain/rules/availability/WorkHourGeneration.ts
```

### Step 6: Handle Cross-Cutting Date Math
```bash
# Move dateCalculations.ts → domain/rules/shared/DateMath.ts
# OR inline in each module if not truly shared
```

### Step 7: Update All Imports
```bash
# Update ~21 files that import from services/calculations
# Change: from '@/services/calculations/...' 
# To: from '@/domain/rules/...'
```

### Step 8: Delete Calculations Folder
```bash
rm -rf src/services/calculations/
```

---

## ✅ Success Criteria

- [ ] All calculation functions moved to domain/rules/
- [ ] Calculations co-located with the business rules they support
- [ ] Zero imports from services/calculations/
- [ ] services/calculations/ folder deleted
- [ ] All builds passing (0 errors)
- [ ] All functionality preserved

---

## 📊 Impact

**Files to create/modify:** ~25+ domain/rules/ files  
**Files to delete:** ~20 calculation files  
**Imports to update:** ~21 files  
**Total lines to move:** ~7,828 lines  
**Estimated time:** 1-2 hours

---

## 🚨 Key Reminders

1. **Calculations ARE business logic** - not utilities
2. **Co-locate** calculations with the rules that use them
3. **Don't duplicate** - move functions to ONE place in domain/rules/
4. **Update imports** systematically
5. **Verify builds** after each major move

---

**Ready to execute?** This will align the codebase with the rebuild plan's vision of THREE layers only.
