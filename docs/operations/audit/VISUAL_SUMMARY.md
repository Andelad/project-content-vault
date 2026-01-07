# Domain Rules Adoption Status - Visual Summary

## Current State: 0-40% Adoption ⚠️

```
Domain Rule                Status    Service Usage    Migration Priority
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CalendarEventRules         ⛔ 0%     0 imports        🔴 HIGH (Week 3-4)
EventClassificationRules   ⛔ 0%     0 imports        🔴 CRITICAL (Week 1)
PhaseRules                 🟡 40%    2 imports        🟠 HIGH (Week 1-2)
ProjectRules               🟡 40%    2 imports        🟠 HIGH (Week 1-2)
ClientRules                ❓ TBD    Not audited      🟢 LOW (Week 5+)
WorkSlotRules              ❓ TBD    Not audited      🟢 LOW (Week 5+)
RelationshipRules          ❓ TBD    Not audited      🟢 LOW (Week 5+)
TimelineRules              ✅ 100%   Domain-only      ℹ️ SUPPORT LAYER
LabelRules                 ❓ TBD    Not audited      🟢 LOW (Week 5+)
```

---

## Duplication Hotspots 🔥

### Event Classification Logic (56 occurrences)
```
Service                           Duplication Type                  Lines
────────────────────────────────────────────────────────────────────────────
UnifiedEventWorkHourService       event.completed || type check     519
UnifiedTimeTrackerService         event.type === 'tracked' check    180
analyticsCalculations             isCompleted logic (2x)            151, 172
UnifiedTimelineService            Custom classification logic       371-394
dayEstimateCalculations           isPlannedEvent/isCompletedEvent   355-356
ProjectBarResizeService           isPlannedEvent/isCompletedEvent   55
```

**Impact:** Timeline bugs, date sync issues, inconsistent event classification  
**Solution:** EventClassificationService (wraps EventClassificationRules)

---

### Validation Logic Duplication

```
Domain Rule              Bypassed By                    Occurrences
────────────────────────────────────────────────────────────────────
CalendarEventRules       CalendarEventOrchestrator      100% (all rules)
PhaseRules               PhaseOrchestrator              60% (partial)
ProjectRules             ProjectOrchestrator            60% (partial)
                         UnifiedProjectService          
```

**Impact:** Inconsistent validation, form errors, business rule drift  
**Solution:** Refactor orchestrators to use domain rules exclusively

---

## Service-by-Service Conflict Analysis

### 🔴 CRITICAL: CalendarEventOrchestrator (372 lines)
```typescript
Current State:
  ❌ validateEventForm()          → Should use CalendarEventRules.validateEventTitle()
  ❌ parseDateTime()               → Should use CalendarEventRules.validateEventTimeRange()
  ❌ transformFormToEventData()    → Should use CalendarEventRules.normalizeEventData()
  ❌ Recurring validation          → Should use CalendarEventRules.validateRecurringEvent()

Migration Path:
  1. Extract CalendarEventRules methods (Week 3)
  2. Replace orchestrator validation with domain rule calls
  3. Keep orchestrator as thin coordinator only
  4. Move form transformation to separate mapper
```

---

### 🔴 CRITICAL: UnifiedEventWorkHourService
```typescript
Line 519: (event.completed || event.type === 'completed' || event.type === 'tracked')
          ❌ Duplicates EventClassificationRules.isCompletedTime()

Migration Path:
  1. Create EventClassificationService wrapper (Week 1)
  2. Replace inline checks with service calls
  3. Remove custom classification logic
```

---

### 🟠 HIGH: UnifiedTimelineService
```typescript
Lines 371-394: Custom isPlannedTime/isCompletedTime logic
               ❌ Duplicates EventClassificationRules.classifyEvent()

Migration Path:
  1. Use EventClassificationService (after Week 1 creation)
  2. Remove custom classification state management
  3. Simplify to pure domain rule delegation
```

---

### 🟠 HIGH: PhaseOrchestrator
```typescript
Current State:
  ✅ Imports PhaseRules (partially used)
  ❌ Still has custom validation logic
  ❌ Phase distribution logic not using PhaseDistribution domain service

Migration Path:
  1. Create DateSyncService (Week 1-2)
  2. Replace custom date logic with DateSyncService
  3. Move phase distribution to PhaseDistribution service calls
  4. Keep orchestrator as thin coordinator
```

---

### 🟠 HIGH: ProjectOrchestrator
```typescript
Current State:
  ✅ Imports ProjectRules (partially used)
  ❌ Still has custom validation logic
  ❌ Budget calculations not using ProjectBudget domain service

Migration Path:
  1. Use DateSyncService (Week 1-2)
  2. Replace custom budget logic with ProjectBudget service
  3. Complete ProjectRules adoption
```

---

### 🟡 MEDIUM: analyticsCalculations
```typescript
Lines 151, 172: const isCompleted = event.completed || event.type === 'tracked';
                ❌ Duplicated in TWO places in same file

Migration Path:
  1. Use EventClassificationService (Week 1)
  2. Remove both duplication instances
  3. Consolidate to single domain rule call
```

---

## Migration Dependency Graph

```
Week 1: Foundation Services
┌─────────────────────────────────┐
│ EventClassificationService      │ ← Wraps EventClassificationRules
└─────────┬───────────────────────┘
          │ Enables ↓
          ├─→ UnifiedEventWorkHourService (Week 1)
          ├─→ analyticsCalculations (Week 1)
          ├─→ UnifiedTimeTrackerService (Week 2)
          └─→ UnifiedTimelineService (Week 2)

┌─────────────────────────────────┐
│ DateSyncService                 │ ← Uses PhaseRules + ProjectRules
└─────────┬───────────────────────┘
          │ Enables ↓
          ├─→ PhaseOrchestrator (Week 2)
          ├─→ UnifiedPhaseService (Week 2)
          ├─→ ProjectOrchestrator (Week 2)
          └─→ UnifiedProjectService (Week 2)

Week 3-4: Orchestrator Refactoring
┌─────────────────────────────────┐
│ CalendarEventOrchestrator       │ ← Adopt CalendarEventRules
└─────────┬───────────────────────┘
          │ Requires ↓
          ├─→ CalendarEventRules (already exists)
          ├─→ Form validation mapper (new)
          └─→ Comprehensive tests (new)

Week 5+: Complete Remaining Rules
┌─────────────────────────────────┐
│ ClientRules, WorkSlotRules, etc.│
└─────────────────────────────────┘
```

---

## Success Metrics Dashboard

### Current Baseline (Pre-Migration):
```
✅ Domain rules files created:        9 files
⛔ Domain rules actually used:        20% (PhaseRules, ProjectRules partially)
❌ CalendarEventRules usage:          0%
❌ EventClassificationRules usage:    0% (services)
🔴 Inline event classification:       56 occurrences
🔴 Custom validation logic:           38+ project, 16+ phase, 11+ event
```

### Week 1 Targets:
```
🎯 EventClassificationService:       Created + tested
🎯 Services migrated:                 3-5 services using EventClassificationService
📉 Inline event classification:       56 → ~20 occurrences
📈 EventClassificationRules usage:    0% → 40%
🐛 User's date sync bugs:             Fixed (if DateSyncService prioritized)
```

### Week 4 Targets:
```
📈 CalendarEventRules usage:          0% → 80%
📈 PhaseRules usage:                  40% → 90%
📈 ProjectRules usage:                40% → 90%
📉 Inline validation:                 65+ → ~10 occurrences
✅ Orchestrators refactored:          3/3 core orchestrators
```

### Week 13 Targets (Final):
```
📈 Overall domain rules adoption:     20% → 95%
📉 Logic duplication:                 65+ → 0 occurrences
✅ All orchestrators:                 Pure coordinators (no business logic)
✅ All unified services:              Use domain rules exclusively
✅ Test coverage:                     Domain rules 100%, services 80%+
```

---

## Decision Point: Week 1 Priority

You have **two options** for Week 1 focus:

### Option A: Fix User's Bug First 🐛
```
Priority: DateSyncService
Days:     5 days
Impact:   ✅ Phase/project date synchronization bugs FIXED
          ✅ User's original issue resolved
          ⏳ Event classification bugs remain
Why:      User satisfaction, quick win, high visibility
```

### Option B: Fix Systemic Issue First 🏗️
```
Priority: EventClassificationService
Days:     5 days
Impact:   ✅ 56 duplication instances reduced to ~20
          ✅ Timeline bugs fixed
          ✅ Foundation for other services
          ⏳ User's date bugs remain
Why:      Higher ROI, unblocks 5+ services, reduces technical debt faster
```

### Recommended: **Hybrid Approach** (if possible)
```
Days 1-2: EventClassificationService (foundation)
Days 3-4: DateSyncService (user's bug)
Day 5:    Integration + testing both
```

---

## Quick Reference: File Locations

```
Domain Rules (Pure Business Logic):
  src/domain/rules/CalendarEventRules.ts       ← 0% used ⛔
  src/domain/rules/EventClassificationRules.ts ← 0% used ⛔
  src/domain/rules/PhaseRules.ts               ← 40% used 🟡
  src/domain/rules/ProjectRules.ts             ← 40% used 🟡

Domain Services (Business Logic Orchestration):
  src/domain/services/PhaseRecurrence.ts       ← Used ✅
  src/domain/services/PhaseDistribution.ts     ← Underutilized
  src/domain/services/ProjectBudget.ts         ← Underutilized

Service Orchestrators (Need Refactoring):
  src/services/orchestrators/CalendarEventOrchestrator.ts  ← 372 lines, 0% domain rules
  src/services/orchestrators/PhaseOrchestrator.ts          ← 40% domain rules
  src/services/orchestrators/ProjectOrchestrator.ts        ← 40% domain rules

Unified Services (Need Migration):
  src/services/unified/UnifiedEventWorkHourService.ts      ← Custom classification
  src/services/unified/UnifiedTimelineService.ts           ← Custom classification
  src/services/unified/UnifiedTimeTrackerService.ts        ← Custom classification
  src/services/unified/UnifiedPhaseService.ts              ← Bypasses PhaseRules
  src/services/unified/UnifiedProjectService.ts            ← Bypasses ProjectRules

Calculation Services (Need Migration):
  src/services/calculations/insights/analyticsCalculations.ts
  src/services/calculations/projects/dayEstimateCalculations.ts
  src/services/calculations/events/eventCalculations.ts

Audit Results:
  docs/operations/audit/CONFLICT_MAP.md         ← This audit (comprehensive)
  docs/operations/audit/calendar-events.txt     ← Raw grep results
  docs/operations/audit/phases.txt              ← Raw grep results
  docs/operations/audit/projects.txt            ← Raw grep results
  docs/operations/audit/event-classification.txt← Raw grep results
```

---

## Next Action

**You decide:**
1. **"Let's fix my date bug first"** → Start with DateSyncService (Option A)
2. **"Let's fix the systemic issue"** → Start with EventClassificationService (Option B)
3. **"Let's do both in Week 1"** → Hybrid approach (ambitious but possible)
4. **"I need more info on X"** → Ask specific questions about the audit findings

The audit is complete. The conflict map is clear. The migration path is validated.

**Ready to build?** 🚀
