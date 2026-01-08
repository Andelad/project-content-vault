# Testing Strategy for Project Content Vault

## Current State

### Existing Tests (58 passing)
```
✓ domain/rules/__tests__/
  - PhaseCalculations.test.ts     (36 tests) - Budget calculations
  - PhaseRules.test.ts            (some tests) - Phase type guards  
  - MilestoneRules.test.ts        (some tests) - Milestone validation

✓ services/orchestrators/__tests__/
  - timeTrackingOrchestrator.test.ts (22 tests) - Cross-window sync

✗ test/domain/entities/
  - Project.test.ts               (48 failing) - Entity tests broken
```

### Coverage Analysis
- **Domain/Rules**: ~15% covered (3 of ~20 files)
- **Services**: ~5% covered (1 of ~20 files)  
- **Components**: 0% covered (0 of ~100 files)
- **Hooks**: 0% covered
- **Contexts**: 0% covered

## Testing Philosophy: Pragmatic ROI

### ✅ High Value Tests (Write These)
**ROI: Prevent expensive bugs, enable confident refactoring**

#### 1. Business Logic (domain/rules) 
**Why**: Core calculations that affect billing, scheduling, data integrity
**AI Benefit**: ⭐⭐⭐⭐⭐ AI can safely refactor with tests as guardrails

**Priority Files**:
```typescript
// HIGH PRIORITY (money/data at stake)
✅ PhaseCalculations.ts      - Budget math (DONE)
⬜ EventCalculations.ts      - Duration calculations
⬜ RecurringPatterns.ts      - Recurring event generation
⬜ DateHelpers.ts            - Date arithmetic (critical!)
⬜ HolidayCalculations.ts    - Work hours calculations

// MEDIUM PRIORITY (user-facing correctness)
⬜ PhaseValidation.ts        - Business rules
⬜ ProjectValidation.ts      - Project constraints
⬜ EventValidation.ts        - Event rules
```

**Example Test**:
```typescript
// EventCalculations.test.ts
describe('calculateEventDurationOnDate', () => {
  it('should handle multi-day event at midnight boundary', () => {
    const event = {
      startTime: new Date('2026-01-08T23:00:00Z'),
      endTime: new Date('2026-01-09T02:00:00Z')
    };
    const targetDate = new Date('2026-01-09');
    
    const duration = calculateEventDurationOnDate(event, targetDate);
    
    expect(duration).toBe(2 * 60 * 60 * 1000); // 2 hours on Jan 9
  });
});
```

#### 2. Critical Services (services/)
**Why**: Data persistence, API calls, complex coordination
**AI Benefit**: ⭐⭐⭐⭐ AI can refactor orchestration logic safely

**Priority Files**:
```typescript
// HIGH PRIORITY
✅ timeTrackingOrchestrator.ts - Cross-window sync (DONE)
⬜ RecurringEventOrchestrator.ts - Recurring event management
⬜ ProjectAggregate.ts          - Multi-table data fetching

// MEDIUM PRIORITY  
⬜ eventOrchestrator.ts         - Event CRUD coordination
⬜ phaseOrchestrator.ts         - Phase lifecycle
```

#### 3. State Management (contexts/)
**Why**: Global state bugs are hard to debug manually
**AI Benefit**: ⭐⭐⭐ AI can modify context logic with confidence

**Priority Files**:
```typescript
⬜ PlannerContext.tsx      - Event state management
⬜ ProjectContext.tsx      - Project/phase state  
⬜ SettingsContext.tsx     - User preferences (partially tested via orchestrator)
```

### ⚠️ Medium Value Tests (Write Selectively)

#### 4. Complex Hooks (hooks/)
**Why**: Reusable logic that's tricky to get right
**AI Benefit**: ⭐⭐⭐ Helps AI understand hook contracts

**Priority Files**:
```typescript
⬜ useRecurringEvents.ts    - Recurring event display logic
⬜ useWorkHours.ts          - Work hours calculations
⬜ useTimelineLayout.ts     - Complex layout calculations
```

### ❌ Low Value Tests (Skip for Now)

#### 5. UI Components (components/)
**Why**: High maintenance cost, low bug prevention
**AI Benefit**: ⭐ AI rarely breaks UI in ways tests catch
**Alternative**: Manual testing, visual regression tests (expensive)

**Recommendation**: Skip unless component has complex logic
```typescript
// DON'T test:
❌ Simple presentational components
❌ Styling/layout logic
❌ onClick handlers that just call props

// DO test (rare cases):
✓ Complex calculation components (e.g., timeline rendering math)
✓ Components with internal state machines
```

## AI Assistance & Testing

### How Tests Help AI Development

**Scenario 1: Refactoring Business Logic**
```
User: "Refactor PhaseCalculations to use a class instead of functions"

Without Tests: ❌ AI might break calculateBudgetUtilization edge cases
With Tests:    ✅ AI runs tests, catches bugs, fixes before committing
```

**Scenario 2: Adding Features**
```
User: "Add support for quarterly recurring events"

Without Tests: ❌ AI might break existing monthly/weekly patterns
With Tests:    ✅ AI sees RecurringPatterns.test.ts, preserves existing behavior
```

**Scenario 3: Bug Fixes**
```
User: "Fix cross-window sync issue"

Without Tests: ❌ AI guesses at fix, might introduce new bugs
With Tests:    ✅ AI writes failing test first, then fixes (TDD approach)
```

### Tests vs Manual Testing

**Manual Testing Wins**:
- ✓ Visual regressions
- ✓ UX flows
- ✓ Browser compatibility
- ✓ Responsive design
- ✓ Accessibility

**Automated Tests Win**:
- ✓ Math/calculation correctness
- ✓ Edge cases (null, undefined, empty arrays)
- ✓ Date boundary conditions
- ✓ State synchronization
- ✓ Data validation rules

## Recommended Testing Roadmap

### Phase 1: Foundation (2-4 hours)
**Goal**: Cover the money/data-critical logic

```bash
# Create these test files:
1. EventCalculations.test.ts      (30-45 min) - Duration math
2. DateHelpers.test.ts            (45-60 min) - Date arithmetic  
3. RecurringPatterns.test.ts      (60-90 min) - Recurring generation
4. HolidayCalculations.test.ts    (30-45 min) - Work hours

Total: ~3 hours, ~80 tests
Coverage: Domain/Rules ~50% → High-risk code protected
```

### Phase 2: Services (2-3 hours)
**Goal**: Test data orchestration and persistence

```bash
5. RecurringEventOrchestrator.test.ts (60 min)
6. ProjectAggregate.test.ts           (45 min)  
7. eventOrchestrator.test.ts          (45 min)

Total: ~2.5 hours, ~40 tests
Coverage: Services ~30% → API layer protected
```

### Phase 3: State Management (2-3 hours)
**Goal**: Test global state coordination

```bash
8. PlannerContext.test.tsx      (60 min)
9. ProjectContext.test.tsx      (60 min)

Total: ~2 hours, ~30 tests
Coverage: Contexts ~40% → State bugs caught
```

### Phase 4: Selected Hooks (1-2 hours)
**Goal**: Test complex derived state logic

```bash
10. useRecurringEvents.test.ts  (60 min)
11. useWorkHours.test.ts        (30 min)

Total: ~1.5 hours, ~20 tests
Coverage: Hooks ~20% → Tricky logic protected
```

**Grand Total**: ~9-12 hours for ~170 additional tests
**Result**: ~228 total tests, high-risk code well covered

## Testing Patterns for Your Codebase

### Pattern 1: Date Testing
```typescript
// Always use specific dates, not relative
❌ const today = new Date(); // Flaky!
✅ const testDate = new Date('2026-01-08T10:00:00Z'); // Stable

// Test boundary conditions
- Midnight crossings
- Month boundaries
- Year boundaries  
- Leap years
- Daylight saving time transitions
```

### Pattern 2: Supabase Mocking
```typescript
// Mock at the client level
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: mockData })
        }))
      }))
    }))
  }
}));
```

### Pattern 3: Context Testing
```typescript
// Use Testing Library's render with providers
import { renderHook } from '@testing-library/react';

const wrapper = ({ children }) => (
  <PlannerProvider>
    <ProjectProvider>
      {children}
    </ProjectProvider>
  </PlannerProvider>
);

const { result } = renderHook(() => usePlannerContext(), { wrapper });
```

### Pattern 4: Factory Functions
```typescript
// Create reusable test data builders
const createPhase = (overrides?: Partial<Phase>): Phase => ({
  id: 'phase-1',
  name: 'Test Phase',
  projectId: 'project-1',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  timeAllocationHours: 40,
  ...overrides
});

// Use in tests
it('should calculate budget', () => {
  const phase = createPhase({ timeAllocationHours: 80 });
  // ...
});
```

## When NOT to Write Tests

### Skip These:
1. **Simple Components**: `<Button>`, `<Card>`, etc.
2. **Styling Logic**: Tailwind classes, CSS-in-JS
3. **Type Definitions**: TypeScript already validates
4. **Trivial Functions**: One-line getters/setters
5. **Integration Tests**: Too slow, too brittle for your needs
6. **E2E Tests**: Manual testing faster for your app size

### Write Tests When:
1. **Logic has edge cases**: Null, undefined, empty, large values
2. **Math is involved**: Calculations, percentages, dates
3. **State synchronization**: Cross-window, optimistic updates
4. **Data validation**: Business rules, constraints
5. **Bug was found**: Regression test prevents recurrence

## Measuring Success

### Good Coverage Targets (for your app):
- Domain/Rules: **60-80%** ← Most important
- Services: **40-60%** ← Data layer critical
- Contexts: **30-50%** ← State bugs are expensive
- Hooks: **20-40%** ← Only complex ones
- Components: **5-15%** ← Only logic-heavy ones

### Quality Over Quantity:
**Better**: 50 focused tests covering critical paths
**Worse**: 500 brittle tests testing implementation details

## Staged Implementation Plan

### Overview: Post-Architecture Testing Build-Out

Your architectural rebuild cleaned up duplicates and organized code. Now we add tests to **lock in that architecture** and enable confident future changes.

**Total Effort**: ~13-16 hours over 4-5 sessions
**Result**: ~230+ total tests, critical paths protected, clean baseline
**Benefit**: Safe refactoring, reduced manual testing, AI-friendly codebase

---

### 🎯 Stage 0: Cleanup - Prepare Clean Baseline (50-60 min)

**Goal**: Archive old migration scripts, delete tutorial tests, fix broken tests

**Why Start Here**: 
- 18 obsolete migration scripts cluttering /scripts folder
- 1 tutorial test file (example.test.ts) not testing real code
- 48 failing tests in Project.test.ts (broken after Phase 4 refactor)
- Need clean baseline before adding 150+ new tests

**Session 0A: Archive Completed Scripts** (5 min)
```bash
Goal: Move completed migration/setup scripts to archive

1. Create archive folders
   mkdir -p scripts/archive/2025-12-phase-migration
   mkdir -p scripts/archive/2025-12-refactoring  
   mkdir -p scripts/archive/setup-migrations

2. Archive phase migration scripts (6 files)
   - fix-phase-migration-errors.sh
   - fix-phase-migration-errors-v2.sh
   - comprehensive-phase-fixes.sh
   - final-phase-migration-fixes.sh
   - rollback-and-fix-phase-migration.sh
   - targeted-phase-fixes.sh

3. Archive refactoring scripts (9 files)
   - fix-date-math.sh, fix-date-math-batch.js
   - fix-remaining-date-math.js, fix-services-index.sh
   - adopt-error-handling-service.js
   - adopt-error-handling-service-batch2.js
   - audit-useeffect-deps.sh
   - detailed-useeffect-audit.sh
   - remove-console-logs.sh

4. Archive one-time setup scripts (3 files)
   - migrate-recurring-to-rrule.js
   - setup-work-hours-recurrence.sh
   - fix-unallocated-event-colors.js

Deliverable: 18 scripts archived, 4 active utilities remain
Active: debug-time-tracker-sync.js, health-check-core-services.js,
        check-circular-dependencies.sh, setup-tests.sh
```

**Session 0B: Clean Test Files** (5 min)
```bash
Goal: Remove tutorial test that doesn't test actual code

1. Delete example.test.ts
   rm src/test/example.test.ts
   
   Why: TESTING_STRATEGY.md has better examples
   Why: Doesn't test actual business logic
   Why: Adds noise to test suite (21 meaningless tests)

Deliverable: -21 tutorial tests, cleaner test output
```

**Session 0C: Fix Broken Entity Tests** (40-50 min)
```bash
Goal: Fix Project.test.ts (48 failing tests)

Problem: Entity tests broken after Phase 4 reorganization
Value: Tests important business logic (validation, dates, budgets)

Fix Steps:
1. Update factory functions for new entity structure (10 min)
   - CreateProjectParams interface changed
   - Phase relationship structure updated
   
2. Fix getSnapshot() references (10 min)
   - Entity API may have changed
   - Update assertion patterns
   
3. Update validation assertions (10 min)
   - Business rules may have shifted
   - Error message format changes
   
4. Debug and fix remaining failures (15 min)
   - Run tests iteratively
   - Fix one describe block at a time

Commands:
npm test -- Project.test.ts        # See failures
# Fix issues
npm test -- Project.test.ts --run  # Verify all pass

Deliverable: 48 broken tests → 48 passing tests ✓
Total: ~79 tests passing (58 current + 21 fixed from Project.test)
```

**Stage 0 Checkpoint**: 
```
✓ Scripts organized (4 active, 18 archived)
✓ Tutorial test removed (-21 noise)
✓ Entity tests fixed (+21 real tests working)
✓ Clean baseline: ~79 tests passing, 0 failing
✓ Ready for Stage 1 expansion
```

---

### 🎯 Stage 1: Foundation - Critical Business Logic (3-4 hours)

**Goal**: Protect the math and money. Lock in core calculation accuracy.

**Session 1A: Date & Time Calculations** (1.5-2 hours)
```bash
Priority: CRITICAL - Used everywhere, edge cases are expensive

1. EventCalculations.test.ts (45 min)
   - calculateEventDurationOnDate (multi-day events)
   - Midnight boundary crossing
   - Timezone handling
   - Before/after event date edge cases
   
2. DateHelpers.test.ts (60 min)
   - addDays, subtractDays (month boundaries)
   - isSameDay, isWithinRange
   - Date formatting/parsing
   - Leap year handling
   - First/last day of month/week

Deliverable: ~50 tests
Risk Reduced: Scheduling bugs, time calculation errors
AI Benefit: Can refactor date logic confidently
```

**Session 1B: Budget & Phase Calculations** (1.5-2 hours)
```bash
Priority: HIGH - Already started, extend coverage

3. Extend PhaseCalculations.test.ts (30 min)
   ✅ Already have 36 tests
   ➕ Add integration tests with real project scenarios
   ➕ Add tests for phase overlap detection
   
4. HolidayCalculations.test.ts (45 min)
   - Work hours on normal days
   - Work hours on holidays  
   - Work hours across date ranges
   - Custom work hour exceptions
   
5. RecurringPatterns.test.ts (60 min)
   - Daily/weekly/monthly generation
   - RRULE parsing correctness
   - Recurrence boundary conditions
   - Exception dates (holidays)

Deliverable: ~60 tests (86 total)
Risk Reduced: Budget overruns, scheduling conflicts, recurring bugs
AI Benefit: Can refactor recurring event logic safely
```

**Stage 1 Checkpoint**: ✓ Core calculations tested, foundation solid

---

### 🎯 Stage 2: Services - Data Orchestration (3-4 hours)

**Goal**: Protect data integrity and multi-layer coordination

**Session 2A: Event Orchestration** (1.5-2 hours)
```bash
Priority: HIGH - Event CRUD is core functionality

1. RecurringEventOrchestrator.test.ts (75 min)
   - Create recurring event series
   - Update series (this vs all)
   - Delete series (cascade handling)
   - Exception handling
   - State synchronization
   
2. eventOrchestrator.test.ts (45 min)
   - Event CRUD operations
   - Validation before persistence
   - Optimistic update rollback
   - Conflict detection

Deliverable: ~40 tests (126 total)
Risk Reduced: Data corruption, orphaned records
AI Benefit: Can refactor service layer architecture
```

**Session 2B: Project & Phase Orchestration** (1.5-2 hours)
```bash
Priority: MEDIUM-HIGH - Project lifecycle management

3. ProjectAggregate.test.ts (60 min)
   - fetchWithRelations (joins correct)
   - fetchAllWithPhases (nested data)
   - Data transformation accuracy
   - Missing relation handling
   
4. phaseOrchestrator.test.ts (45 min)
   - Phase creation with validation
   - Phase update cascade to project
   - Phase deletion impact analysis
   - Budget synchronization

Deliverable: ~35 tests (161 total)
Risk Reduced: Broken relationships, budget desync
AI Benefit: Can refactor data layer safely
```

**Stage 2 Checkpoint**: ✓ Services tested, data integrity protected

---

### 🎯 Stage 3: State Management (2-3 hours)

**Goal**: Prevent state synchronization bugs

**Session 3A: Core Contexts** (2-3 hours)
```bash
Priority: MEDIUM - State bugs are hard to debug

1. PlannerContext.test.tsx (75 min)
   - Event add/update/delete
   - Optimistic updates
   - Rollback on error
   - State consistency
   - Event filtering/sorting
   
2. ProjectContext.test.tsx (60 min)
   - Project/phase CRUD
   - Relationship management
   - Budget calculations integration
   - Client/group synchronization
   
3. SettingsContext.test.tsx (45 min)
   ✅ Partially covered by timeTrackingOrchestrator tests
   ➕ Add work hours preference tests
   ➕ Add view preference tests
   ➕ Add persistence tests

Deliverable: ~45 tests (206 total)
Risk Reduced: State desynchronization, context bugs
AI Benefit: Can refactor context architecture
```

**Stage 3 Checkpoint**: ✓ State management tested, global state reliable

---

### 🎯 Stage 4: Complex Hooks (2 hours)

**Goal**: Test reusable logic with tricky edge cases

**Session 4: Critical Hooks** (2 hours)
```bash
Priority: MEDIUM - Complex derived state

1. useRecurringEvents.test.ts (60 min)
   - Recurring event expansion
   - Date range filtering
   - Exception handling
   - Performance with large series
   
2. useWorkHours.test.ts (30 min)
   - Work hours calculation
   - Holiday integration
   - Custom schedule handling
   
3. useTimelineLayout.test.ts (30 min)
   - Position calculations
   - Overlap detection
   - Viewport clipping
   - Responsive breakpoints

Deliverable: ~30 tests (236 total)
Risk Reduced: Layout bugs, performance issues
AI Benefit: Can refactor hook logic confidently
```

**Stage 4 Checkpoint**: ✓ Hooks tested, derived state reliable

---

### 🎯 Stage 5: Polish & Maintenance (ongoing)

**Goal**: Fix existing failures, add tests as bugs are found

**Session 5A: Fix Existing Tests** (1 hour)
```bash
Priority: MEDIUM - Clean up test suite

1. Fix Project.test.ts (48 failing tests)
   - Update for Phase 4 reorganization
   - Fix entity validation tests
   - Update snapshot tests
   
2. Fix any other broken tests
   - Update imports after refactoring
   - Fix mocks after API changes

Deliverable: 0 failing tests, all green
```

**Session 5B: Bug-Driven Testing** (ongoing)
```bash
Pattern: When a bug is found in production

1. Write failing test that reproduces bug
2. Fix the bug
3. Verify test now passes
4. Commit both test + fix

Example:
- Bug: "Recurring events don't respect holidays"
- Test: RecurringPatterns.test.ts - add holiday exception test
- Fix: Update recurring generation logic
- Result: Regression prevented
```

---

## Implementation Schedule

### Week 1: Cleanup + Foundation
```
Session 0: Mon Morning (1 hour)
└─ Stage 0: Cleanup & Baseline (1h)
   ├─ Archive 18 migration scripts (5 min)
   ├─ Delete tutorial test (5 min)
   └─ Fix Project.test.ts failures (50 min)

Session 1: Mon Afternoon + Tue (3-4 hours)
├─ Stage 1A: Date & Time Calculations (2h)
└─ Stage 1B: Budget & Phase Calculations (2h)

Deliverable: Clean baseline + 86 tests total
Next: Stage 2 (Services)
```

### Week 2: Services  
```
Session 2: Wed/Thu (3-4 hours)
├─ Stage 2A: Event Orchestration (2h)
└─ Stage 2B: Project Orchestration (2h)

Deliverable: 161 tests total
Next: Stage 3 (State)
```

### Week 3: State & Hooks
```
Session 3: Mon (2-3 hours)
└─ Stage 3A: Core Contexts (3h)

Session 4: Tue (2 hours)
└─ Stage 4: Complex Hooks (2h)

Deliverable: 236 tests total
Next: Stage 5 (Polish)
```

### Week 4: Polish
```
Session 5: Wed (ongoing)
└─ Bug-driven testing (as issues found)

Deliverable: All tests green ✓
Status: Testing foundation complete
```

---

## Success Metrics

### After Stage 0 (Cleanup) ← START HERE
- ✓ ~79 tests passing, 0 failing (clean baseline)
- ✓ 18 obsolete scripts archived
- ✓ 4 active utility scripts (organized)
- ✓ Ready for test expansion

### After Stage 1 (Foundation)
- ✓ 165 tests passing (79 + 86 new)
- ✓ 0 critical calculation bugs
- ✓ Can refactor date/budget logic with confidence

### After Stage 2 (Services)
- ✓ 161 tests passing
- ✓ Data integrity protected
- ✓ Can refactor orchestration layer

### After Stage 3 (State)
- ✓ 206 tests passing
- ✓ State synchronization reliable
- ✓ Can refactor context architecture

### After Stage 4 (Hooks)
- ✓ 236 tests passing
- ✓ Complex derived state tested
- ✓ Can confidently ask AI to refactor hooks

### After Stage 5 (Polish)
- ✓ 236 tests passing, 0 failing
- ✓ Clean test suite
- ✓ Bug-driven testing established

---

## Quick Reference: Test Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- EventCalculations.test.ts

# Run tests in specific folder
npm test -- domain/rules

# Run tests in watch mode (during development)
npm test

# Run tests once (CI/verification)
npm test -- --run

# Run tests with coverage
npm test -- --coverage

# Run only tests matching pattern
npm test -- --grep "budget"
```

---

## Session Preparation Checklist

**Before Each Session**:
- [ ] All previous tests still passing
- [ ] No merge conflicts in test files
- [ ] Dependencies installed (`npm install`)
- [ ] Test runner working (`npm test -- --run`)

**During Each Session**:
- [ ] Write tests incrementally (don't wait until end)
- [ ] Run tests after each describe block
- [ ] Fix failures immediately
- [ ] Commit working tests frequently

**After Each Session**:
- [ ] All new tests passing
- [ ] No existing tests broken
- [ ] Commit with clear message (e.g., "Stage 1A: Add EventCalculations tests")
- [ ] Update this doc with completion status

---

## Next Actions

### Immediate Next Step: Stage 0A - Archive Scripts

**Action**: Move 18 completed migration scripts to archive

**Estimated Time**: 5 minutes

**Commands**:
```bash
# Create archive structure
mkdir -p scripts/archive/2025-12-phase-migration
mkdir -p scripts/archive/2025-12-refactoring
mkdir -p scripts/archive/setup-migrations

# Archive phase migration scripts (6 files)
cd scripts
mv fix-phase-migration-errors*.sh archive/2025-12-phase-migration/
mv comprehensive-phase-fixes.sh archive/2025-12-phase-migration/
mv final-phase-migration-fixes.sh archive/2025-12-phase-migration/
mv rollback-and-fix-phase-migration.sh archive/2025-12-phase-migration/
mv targeted-phase-fixes.sh archive/2025-12-phase-migration/

# Archive refactoring scripts (9 files)
mv fix-date-math* archive/2025-12-refactoring/
mv fix-remaining-date-math.js archive/2025-12-refactoring/
mv fix-services-index.sh archive/2025-12-refactoring/
mv adopt-error-handling-service*.js archive/2025-12-refactoring/
mv *useeffect*.sh archive/2025-12-refactoring/
mv remove-console-logs.sh archive/2025-12-refactoring/

# Archive one-time setup scripts (3 files)
mv migrate-recurring-to-rrule.js archive/setup-migrations/
mv setup-work-hours-recurrence.sh archive/setup-migrations/
mv fix-unallocated-event-colors.js archive/setup-migrations/

# Return to project root
cd ..
```

**Verification**:
```bash
# Should show only 4 files
ls scripts/*.{js,sh}

# Should show:
# - debug-time-tracker-sync.js
# - health-check-core-services.js  
# - check-circular-dependencies.sh
# - setup-tests.sh
```

**Value**: Clean scripts folder, easy to find active utilities

**Then**: Stage 0B - Delete tutorial test (5 min)
**Then**: Stage 0C - Fix Project.test.ts (40-50 min)
**Then**: Stage 1A - EventCalculations.test.ts (45 min)

Ready to execute Stage 0A? This cleanup sets up a solid foundation for your testing build-out.
