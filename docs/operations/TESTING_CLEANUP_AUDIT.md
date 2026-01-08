# Test & Script Cleanup Audit
*Date: January 8, 2026*
*Purpose: Identify redundant files before Stage 1 testing implementation*

## Current State Summary

### Test Files (6 unique files)
```
✅ KEEP - Active & Valuable
├─ domain/rules/__tests__/PhaseCalculations.test.ts (36 tests passing)
├─ domain/rules/__tests__/PhaseRules.test.ts (some tests passing)
├─ domain/rules/__tests__/MilestoneRules.test.ts (some tests passing)
└─ services/orchestrators/__tests__/timeTrackingOrchestrator.test.ts (22 tests passing)

❓ EVALUATE
├─ test/example.test.ts (21 tests passing) - Tutorial/learning file
└─ test/domain/entities/Project.test.ts (48 tests FAILING) - Needs fixing

Total: 58 passing, 48 failing
```

### Script Files (22 files, ~2,236 lines)
```
⚠️ MIGRATION SCRIPTS (completed, can archive)
├─ fix-phase-migration-errors.sh (236 lines, Dec 2025)
├─ fix-phase-migration-errors-v2.sh (Dec 2025)
├─ comprehensive-phase-fixes.sh (90 lines)
├─ final-phase-migration-fixes.sh
├─ rollback-and-fix-phase-migration.sh (71 lines)
├─ targeted-phase-fixes.sh (91 lines)
├─ fix-date-math.sh
├─ fix-date-math-batch.js
├─ fix-remaining-date-math.js
├─ fix-services-index.sh
└─ adopt-error-handling-service.js (151 lines)
└─ adopt-error-handling-service-batch2.js

⚠️ ONE-TIME SETUP (completed, can archive)
├─ migrate-recurring-to-rrule.js
├─ setup-work-hours-recurrence.sh (126 lines)
└─ fix-unallocated-event-colors.js

⚠️ AUDIT/DEBUG (one-time use, can archive)
├─ audit-useeffect-deps.sh
├─ detailed-useeffect-audit.sh
└─ remove-console-logs.sh

✅ KEEP - Utility Scripts (ongoing value)
├─ debug-time-tracker-sync.js (NEW - for debugging)
├─ health-check-core-services.js (validation)
├─ check-circular-dependencies.sh (architecture check)
└─ setup-tests.sh (test infrastructure)
```

---

## Cleanup Recommendations

### Stage 0A: Archive Completed Migration Scripts (5 min)

**Create Archive Folder**:
```bash
mkdir -p scripts/archive/2025-12-phase-migration
mkdir -p scripts/archive/2025-12-refactoring
mkdir -p scripts/archive/setup-migrations
```

**Move Migration Scripts** (12 files):
```bash
# Phase migration scripts (December 2025)
mv scripts/fix-phase-migration-errors.sh scripts/archive/2025-12-phase-migration/
mv scripts/fix-phase-migration-errors-v2.sh scripts/archive/2025-12-phase-migration/
mv scripts/comprehensive-phase-fixes.sh scripts/archive/2025-12-phase-migration/
mv scripts/final-phase-migration-fixes.sh scripts/archive/2025-12-phase-migration/
mv scripts/rollback-and-fix-phase-migration.sh scripts/archive/2025-12-phase-migration/
mv scripts/targeted-phase-fixes.sh scripts/archive/2025-12-phase-migration/

# Date math fixes
mv scripts/fix-date-math.sh scripts/archive/2025-12-refactoring/
mv scripts/fix-date-math-batch.js scripts/archive/2025-12-refactoring/
mv scripts/fix-remaining-date-math.js scripts/archive/2025-12-refactoring/
mv scripts/fix-services-index.sh scripts/archive/2025-12-refactoring/

# Error handling adoption
mv scripts/adopt-error-handling-service.js scripts/archive/2025-12-refactoring/
mv scripts/adopt-error-handling-service-batch2.js scripts/archive/2025-12-refactoring/
```

**Move One-Time Setup Scripts** (3 files):
```bash
mv scripts/migrate-recurring-to-rrule.js scripts/archive/setup-migrations/
mv scripts/setup-work-hours-recurrence.sh scripts/archive/setup-migrations/
mv scripts/fix-unallocated-event-colors.js scripts/archive/setup-migrations/
```

**Move Audit Scripts** (3 files):
```bash
mv scripts/audit-useeffect-deps.sh scripts/archive/2025-12-refactoring/
mv scripts/detailed-useeffect-audit.sh scripts/archive/2025-12-refactoring/
mv scripts/remove-console-logs.sh scripts/archive/2025-12-refactoring/
```

**Result**: 18 files archived, 4 active scripts remaining

---

### Stage 0B: Evaluate Test Files (15 min)

#### 1. example.test.ts - Tutorial File (DELETE or MOVE)

**Current Status**: 21 tests passing ✓
**Purpose**: Shows test patterns and examples
**Issue**: Not testing actual business logic

**Options**:
```bash
# Option A: Delete (recommended - patterns are documented elsewhere)
rm src/test/example.test.ts

# Option B: Move to docs (keep as reference)
mkdir -p docs/testing/examples
mv src/test/example.test.ts docs/testing/examples/
```

**Recommendation**: **DELETE** - TESTING_STRATEGY.md now has better examples

---

#### 2. Project.test.ts - Entity Tests (FIX in Stage 0C)

**Current Status**: 48 tests FAILING ❌
**Purpose**: Tests Project entity business logic
**Issue**: Broken after Phase 4 reorganization

**Why It's Failing**: 
- Entity structure changed during architecture rebuild
- Tests reference old patterns
- Worth fixing - validates entity behavior

**Action**: Keep, fix in Stage 0C

---

### Stage 0C: Fix Broken Project Tests (30-45 min)

**Fix Project.test.ts** - High value, needs updating

The entity tests are checking important business logic:
- Project validation rules
- Date range calculations
- Budget constraints
- Phase relationships

**Estimated Fixes Needed**:
1. Update factory functions for new entity structure (~10 min)
2. Fix snapshot/getSnapshot references (~10 min)
3. Update validation assertions (~10 min)
4. Run and debug remaining failures (~15 min)

**Value**: Validates entity layer, prevents regression

---

## Final Cleanup Plan

### Stage 0: Pre-Testing Cleanup (50-60 min total)

**Stage 0A: Archive Scripts** (5 min)
```bash
# Create archive structure
mkdir -p scripts/archive/{2025-12-phase-migration,2025-12-refactoring,setup-migrations}

# Move 18 completed migration/setup scripts
# (See detailed commands above)
```

**Stage 0B: Clean Test Files** (5 min)
```bash
# Delete tutorial test file
rm src/test/example.test.ts

# Result: One less test file to maintain
```

**Stage 0C: Fix Broken Tests** (40-50 min)
```bash
# Fix Project.test.ts (48 failing → 0 failing)
npm test -- Project.test.ts

# Update entity factory functions
# Fix broken assertions
# Verify all tests pass
```

**Stage 0 Deliverables**:
- ✓ 18 obsolete scripts archived
- ✓ 1 tutorial test file deleted
- ✓ 48 broken tests fixed
- ✓ Clean baseline: 79+ tests passing, 0 failing
- ✓ Ready for Stage 1 testing implementation

---

## Active Scripts After Cleanup (4 files)

```bash
scripts/
├── debug-time-tracker-sync.js       # NEW - Cross-window sync debugger
├── health-check-core-services.js    # Validation utility
├── check-circular-dependencies.sh   # Architecture health check
└── setup-tests.sh                   # Test infrastructure setup

scripts/archive/
├── 2025-12-phase-migration/        # 6 phase migration scripts
├── 2025-12-refactoring/            # 9 refactoring scripts  
└── setup-migrations/               # 3 one-time setup scripts
```

---

## Benefits of Cleanup

### Before Cleanup
```
Tests: 58 passing, 48 failing (confusion!)
Scripts: 22 files (~2,236 lines) - hard to find useful ones
Status: Cluttered, unclear what's active
```

### After Cleanup
```
Tests: 79+ passing, 0 failing (clean baseline!)
Scripts: 4 active utilities, 18 archived (organized)
Status: Clean, focused, ready for expansion
```

### Enables Stage 1
- ✓ No broken tests to confuse new test development
- ✓ Clear script folder (only active utilities)
- ✓ Confidence that test suite is healthy
- ✓ Better foundation for adding 150+ new tests

---

## Next Steps

**After Stage 0 Cleanup**:
1. Run full test suite: `npm test -- --run`
2. Verify: All tests passing ✓
3. Commit cleanup: "Stage 0: Archive migration scripts, fix broken tests"
4. Proceed to Stage 1A: EventCalculations.test.ts

**Ready to execute Stage 0?**
