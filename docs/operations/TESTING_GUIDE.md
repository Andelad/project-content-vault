# 🧪 Testing Guide for Project Content Vault

## Table of Contents
1. [Overview](#overview)
2. [Current Test Coverage](#current-test-coverage)
3. [Why Testing Matters](#why-testing-matters)
4. [Testing Stack](#testing-stack)
5. [Setup Instructions](#setup-instructions)
6. [Testing Patterns](#testing-patterns)
7. [Examples by Layer](#examples-by-layer)
8. [Running Tests](#running-tests)
9. [Coverage Goals](#coverage-goals)

---

## Overview

This project has **547 automated tests** covering domain rules, service orchestrators, and utility functions. Tests are organized using Vitest with co-located `__tests__/` directories.

### Current Status (January 2026)
- ✅ **Stage 0**: Test infrastructure setup (Vitest v3.2.4)
- ✅ **Stage 1A**: Date & Time Calculations (87 tests)
- ✅ **Stage 1B**: Budget & Recurring Patterns (66 tests)
- ✅ **Stage 2**: Service Layer Orchestrators (60 tests)
- ✅ **Stage 3**: Utility Functions (137 tests)
- ⏸️ **Stage 4**: React Hooks/Contexts (deferred - implementation details)
- 🔄 **Stage 5**: Bug-driven testing (ongoing practice)

---

## Current Test Coverage

### Test Files (17 total)
1. **Domain Entities** (1 file, 69 tests)
   - `Project.test.ts` - Project entity validation

2. **Domain Rules** (5 files, 165 tests)
   - `dateCalculations.test.ts` (51 tests) - Core date math
   - `EventCalculations.test.ts` (36 tests) - Event validation & calculations
   - `PhaseCalculations.test.ts` (43 tests) - Budget calculations & multi-phase scenarios
   - `HolidayCalculations.test.ts` (27 tests) - Holiday detection & working days
   - `PhaseRecurrence.test.ts` (32 tests) - RRule generation & recurring patterns
   - `MilestoneRules.test.ts` (6 tests) - Milestone validation
   - `PhaseRules.test.ts` (21 tests) - Phase validation

3. **Service Orchestrators** (5 files, 82 tests)
   - `HolidayOrchestrator.test.ts` (17 tests) - Holiday workflows & overlap detection
   - `CalendarEventOrchestrator.test.ts` (16 tests) - Event form validation
   - `ClientOrchestrator.test.ts` (12 tests) - Client CRUD workflows
   - `SettingsOrchestrator.test.ts` (15 tests) - Settings management
   - `timeTrackingOrchestrator.test.ts` (22 tests) - Time tracking coordination

4. **Utilities** (4 files, 186 tests)
   - `dateCalculations.test.ts` (51 tests) - Already counted above
   - `normalizeProjectColor.test.ts` (43 tests) - OKLCH color normalization
   - `dateFormatUtils.test.ts` (48 tests) - Date formatting & localization
   - `timeCalculations.test.ts` (44 tests) - Time math & timezone handling
   - `settingsCalculations.test.ts` (45 tests) - Work schedule calculations

### Total: **547 tests passing** ✅

---

## Testing Philosophy (Updated)


- **Unit Tests First**: Test pure functions and business logic (high value, low maintenance)
- **Integration Tests Strategically**: Test workflows and coordination between layers
- **Avoid Over-Testing**: Don't test implementation details, focus on behavior
- **Bug-Driven Testing**: Write tests when bugs are found (regression prevention)
- **Defer UI Testing**: React components/hooks tested only when stable

### What We Test
✅ **Pure Functions**: Date math, calculations, formatting (deterministic, high ROI)  
✅ **Business Rules**: Validation, budget logic, recurrence patterns (stable contracts)  
✅ **Workflows**: Orchestrator coordination, CRUD operations (critical paths)  
✅ **Edge Cases**: Boundary conditions, midnight crossing, year boundaries  

### What We Don't Test (Yet)
❌ **React Hooks**: Too coupled to implementation details during active development  
❌ **React Contexts**: Complex setup, high maintenance burden  
❌ **UI Components**: Visual changes too frequent during design iteration  
❌ **E2E Flows**: Deferred until post-launch stabilization  

---

## Why Testing Matters

### Current Risks Without Tests
1. **Business Logic Changes**: 50+ documented business rules with no automated verification
2. **Orchestrator Workflows**: Complex CREATE/UPDATE/DELETE operations could fail silently
3. **Calculation Accuracy**: Date calculations, budget validations, timeline math could be wrong
4. **Regression**: Changes to one part could break another with no warning
5. **Refactoring Fear**: Can't confidently refactor without tests

### Real-World Example
```typescript
// domain/rules/ProjectRules.ts
static validateProjectDates(startDate: Date, endDate: Date): ValidationResult {
  if (endDate < startDate) {
    return { isValid: false, errors: ['End date must be after start date'] };
  }
  return { isValid: true };
}
```

**Without tests**: Someone changes `<` to `<=` and breaks projects starting/ending same day  
**With tests**: CI fails immediately, change is caught before production

---

## Testing Stack

### Current Setup (January 2026)

```json
{
  "devDependencies": {
    "vitest": "^3.2.4",              // ✅ Installed - Test runner
    "@vitest/ui": "^3.2.4",          // ✅ Installed - Visual test UI
    "@testing-library/react": "^14.0.0",  // ⏸️ Available but not used yet
    "@testing-library/jest-dom": "^6.0.0",  // ⏸️ Available but not used yet
    "@testing-library/user-event": "^14.0.0",  // ⏸️ Available but not used yet
  }
}
```

### Current Configuration

```typescript
// vitest.config.ts (active)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // No setup file - tests are self-contained
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Test Organization
- **Co-located tests**: Each module has `__tests__/` directory next to source
- **Naming**: `*.test.ts` or `*.test.tsx`
- **Run mode**: `npm test -- --run` for CI, `npm test` for watch mode

---

## Setup Instructions

### Already Complete ✅
1. ✅ Vitest installed and configured
2. ✅ Test scripts added to package.json
3. ✅ Path aliases configured
4. ✅ 547 tests written and passing

### Test Scripts Available

```json
{
  "scripts": {
    "test": "vitest",           // Watch mode for development
    "test:ui": "vitest --ui"    // Visual UI (not commonly used)
  }
}
```

### Running Tests

```bash
# Run all tests in watch mode (development)
npm test

# Run all tests once (CI mode)
npm test -- --run

# Run specific test file
npm test -- --run dateCalculations

# Run tests matching pattern
npm test -- --run "Phase*"
```

---

## Testing Patterns

### Pattern 1: Pure Function Testing (Domain Rules & Utilities)

**Best for**: Date calculations, validation rules, formatting functions

```typescript
// Example: src/utils/__tests__/dateCalculations.test.ts
import { describe, it, expect } from 'vitest';
import { addDays, isSameDay } from '../dateCalculations';

describe('dateCalculations', () => {
  it('should add days correctly', () => {
    const date = new Date(2024, 0, 15);
    const result = addDays(date, 5);
    expect(result.getDate()).toBe(20);
  });

  it('should handle month boundaries', () => {
    const date = new Date(2024, 0, 30);
    const result = addDays(date, 5);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(4);
  });
});
// src/services/calculations/general/__tests__/dateCalculations.test.ts
import { describe, it, expect } from 'vitest';
import { calculateDurationHours, normalizeToMidnight } from '../dateCalculations';

describe('dateCalculations', () => {
  describe('calculateDurationHours', () => {
    it('should calculate hours between two dates', () => {
      const start = new Date('2025-01-01T09:00:00');
      const end = new Date('2025-01-01T17:00:00');
      
      const hours = calculateDurationHours(start, end);
      
      expect(hours).toBe(8);
    });

    it('should handle midnight boundary correctly', () => {
      const start = new Date('2025-01-01T23:00:00');
      const end = new Date('2025-01-02T01:00:00');
      
      const hours = calculateDurationHours(start, end);
      
      expect(hours).toBe(2);
    });
  });

  describe('normalizeToMidnight', () => {
    it('should set time to 00:00:00.000', () => {
      const date = new Date('2025-01-15T14:30:45.123');
      
      const normalized = normalizeToMidnight(date);
      
      expect(normalized.getHours()).toBe(0);
      expect(normalized.getMinutes()).toBe(0);
      expect(normalized.getSeconds()).toBe(0);
      expect(normalized.getMilliseconds()).toBe(0);
    });
  });
});
```

---

### Pattern 3: Integration Testing Orchestrators

Orchestrators are harder - they call Supabase. Use **MSW** (Mock Service Worker) to mock API calls.

```typescript
// src/services/orchestrators/__tests__/ProjectOrchestrator.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectOrchestrator } from '../ProjectOrchestrator';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client');

describe('ProjectOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeProjectCreationWorkflow', () => {
    it('should create project successfully with valid data', async () => {
      // Arrange: Mock Supabase response
      const mockProject = {
        id: '123',
        name: 'Test Project',
        start_date: '2025-01-01',
        end_date: '2025-01-31',
        estimated_hours: 40
      };

      (supabase.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProject, error: null })
          })
        })
      });

      const request = {
        name: 'Test Project',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        estimatedHours: 40
      };

      // Act
      const result = await ProjectOrchestrator.executeProjectCreationWorkflow(
        request,
        { userId: 'user-123' }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('123');
      expect(supabase.from).toHaveBeenCalledWith('projects');
    });

    it('should fail with validation error when dates are invalid', async () => {
      const request = {
        name: 'Test Project',
        startDate: new Date('2025-01-31'), // After end date
        endDate: new Date('2025-01-01'),
        estimatedHours: 40
      };

      const result = await ProjectOrchestrator.executeProjectCreationWorkflow(
        request,
        { userId: 'user-123' }
      );

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(supabase.from).not.toHaveBeenCalled(); // Shouldn't hit DB
    });
  });
});
```

---

### Pattern 4: Testing React Components

```typescript
// src/components/projects/__tests__/ProjectCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectCard } from '../ProjectCard';

describe('ProjectCard', () => {
  const mockProject = {
    id: '1',
    name: 'Test Project',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-01-31'),
    estimatedHours: 40,
    color: '#3b82f6',
    status: 'current' as const
  };

  it('should render project name', () => {
    render(<ProjectCard project={mockProject} />);
    
    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('should call onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    render(<ProjectCard project={mockProject} onEdit={onEdit} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    expect(onEdit).toHaveBeenCalledWith(mockProject);
  });

  it('should display estimated hours', () => {
    render(<ProjectCard project={mockProject} />);
    
    expect(screen.getByText(/40 hours/i)).toBeInTheDocument();
  });
});
```

---

### Pattern 5: Testing Custom Hooks

```typescript
// src/hooks/__tests__/useProjects.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjects } from '../useProjects';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client');

describe('useProjects', () => {
  it('should fetch projects on mount', async () => {
    const mockProjects = [
      { id: '1', name: 'Project 1', /* ... */ },
      { id: '2', name: 'Project 2', /* ... */ }
    ];

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockProjects, error: null })
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.projects).toHaveLength(2);
    });

    expect(result.current.projects[0].name).toBe('Project 1');
  });
});
```

---

## Examples by Layer

### Priority 1: Domain Rules (Start Here!)

```bash
src/domain/rules/
├── __tests__/
│   ├── ProjectRules.test.ts          # ⭐ START HERE (easiest wins)
│   ├── MilestoneRules.test.ts
│   ├── TimelineRules.test.ts
│   └── RelationshipRules.test.ts
```

**Test Coverage Goal**: 100% for domain rules (they're pure functions, no excuse!)

### Priority 2: Calculations Layer

```bash
src/services/calculations/
├── general/__tests__/
│   └── dateCalculations.test.ts      # Pure math, easy to test
├── projects/__tests__/
│   └── projectCalculations.test.ts
└── availability/__tests__/
    └── capacityCalculations.test.ts
```

**Test Coverage Goal**: 90%+ (pure functions, should be fully tested)

### Priority 3: Orchestrators

```bash
src/services/orchestrators/
├── __tests__/
│   ├── ProjectOrchestrator.test.ts   # Critical workflows
│   ├── EventModalOrchestrator.test.ts
│   └── timeTrackingOrchestrator.test.ts
```

**Test Coverage Goal**: 70%+ (focus on happy path + error cases)

### Priority 4: Components

```bash
src/components/
├── projects/__tests__/
│   └── ProjectCard.test.tsx
├── timeline/__tests__/
│   └── TimelineBar.test.tsx
└── modals/__tests__/
    └── ProjectModal.test.tsx
```

**Test Coverage Goal**: 60%+ (focus on critical user-facing components)

---

## Running Tests

### Basic Commands

```bash
# Run all tests (watch mode)
npm test

# Run tests once (CI mode)
npm run test:run

# Run with UI (visual interface)
npm run test:ui

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test ProjectRules

# Run in watch mode for specific file
npm test -- --watch ProjectRules
```

### Test Output

```bash
✓ src/domain/rules/__tests__/ProjectRules.test.ts (4)
  ✓ validateProjectDates
    ✓ should validate when end date is after start date
    ✓ should fail when end date is before start date
    ✓ should validate same-day projects

Test Files  1 passed (1)
     Tests  4 passed (4)
```

### Coverage Report

```bash
npm run test:coverage

File                  | % Stmts | % Branch | % Funcs | % Lines
----------------------|---------|----------|---------|--------
All files             |   72.5  |   68.3   |   75.2  |   71.8
 domain/rules/        |   95.0  |   90.0   |  100.0  |   95.0
  ProjectRules.ts     |   95.0  |   90.0   |  100.0  |   95.0
 services/orchestr.../|   60.5  |   55.0   |   65.0  |   60.0
  ProjectOrch...ts    |   60.5  |   55.0   |   65.0  |   60.0
```

---

## Coverage Goals

### Phase 1: Foundation (Week 1-2)
- **Domain Rules**: 100% coverage
- **Calculations**: 90% coverage
- **Setup**: CI/CD pipeline configured
- **Goal**: 40% overall coverage

### Phase 2: Core Workflows (Week 3-4)
- **Orchestrators**: 70% coverage (critical paths)
- **Hooks**: 60% coverage (data fetching)
- **Goal**: 60% overall coverage

### Phase 3: UI & E2E (Month 2)
- **Components**: 60% coverage (critical components)
- **E2E**: 5-10 critical user flows
- **Goal**: 70% overall coverage

### Phase 4: Maintenance (Ongoing)
- **New code**: Require tests for all new features
- **PR checks**: Block merge if coverage drops
- **Goal**: Maintain 70%+ coverage

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
      
      - name: Check coverage threshold
        run: |
          coverage=$(jq '.total.lines.pct' coverage/coverage-summary.json)
          if (( $(echo "$coverage < 70" | bc -l) )); then
            echo "Coverage $coverage% is below threshold 70%"
            exit 1
          fi
      
      - name: Build
        run: npm run build
```

---

## Best Practices

### ✅ DO

1. **Test business logic thoroughly** - It's your core value
2. **Test edge cases** - Null, undefined, empty arrays, boundary values
3. **Keep tests simple** - One concept per test
4. **Use descriptive names** - Test name should explain what it tests
5. **Mock external dependencies** - Database, APIs, localStorage
6. **Run tests before committing** - Catch issues early

### ❌ DON'T

1. **Test implementation details** - Test behavior, not internals
2. **Write brittle tests** - Don't test exact HTML structure
3. **Skip error cases** - Always test failure paths
4. **Ignore flaky tests** - Fix them or remove them
5. **Test third-party libraries** - They have their own tests
6. **Over-mock** - Only mock what you need

---

## Common Testing Scenarios

### Scenario 1: Testing Date Validation

```typescript
it('should reject dates more than 5 years in future', () => {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 6);
  
  const result = ProjectRules.validateProjectDates(startDate, endDate);
  
  expect(result.isValid).toBe(false);
  expect(result.errors).toContain('Project cannot extend more than 5 years');
});
```

### Scenario 2: Testing Async Operations

```typescript
it('should handle database errors gracefully', async () => {
  (supabase.from as any).mockReturnValue({
    insert: vi.fn().mockRejectedValue(new Error('Network error'))
  });
  
  const result = await ProjectOrchestrator.executeProjectCreationWorkflow(
    validRequest,
    context
  );
  
  expect(result.success).toBe(false);
  expect(result.error).toContain('Network error');
});
```

### Scenario 3: Testing with Context

```typescript
it('should use userId from context', async () => {
  const insertSpy = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: mockProject, error: null })
    })
  });
  
  (supabase.from as any).mockReturnValue({ insert: insertSpy });
  
  await ProjectOrchestrator.executeProjectCreationWorkflow(
    request,
    { userId: 'user-456' }
  );
  
  expect(insertSpy).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'user-456' })
  );
});
```

---

## Coverage Goals

### Current Status (January 2026)
- ✅ **Domain Rules & Calculations**: ~90% coverage (pure functions tested)
- ✅ **Service Orchestrators**: ~75% coverage (workflows tested)
- ✅ **Utilities**: ~85% coverage (formatting, time math tested)
- ⏸️ **React Hooks/Contexts**: 0% coverage (deferred)
- ⏸️ **UI Components**: 0% coverage (deferred)

### Overall Stats
- **Total Tests**: 547 passing
- **Test Files**: 17
- **Estimated Coverage**: ~40-50% of critical business logic
- **Status**: ✅ Solid foundation for core functionality

### Next Steps (Bug-Driven Approach)
1. ✅ Maintain existing tests as code evolves
2. 🔄 Write tests when bugs are discovered (regression prevention)
3. 🔄 Add tests for new features as they're developed
4. ⏸️ Consider hook/component tests post-launch if needed

---

## Best Practices

### ✅ DO

1. **Test business logic thoroughly** - Core calculations and validations
2. **Test edge cases** - Midnight crossing, year boundaries, null values
3. **Keep tests simple** - One concept per test
4. **Use descriptive names** - Test name explains what it verifies
5. **Mock Supabase carefully** - Only when testing orchestrators
6. **Run tests before pushing** - Ensure CI will pass

### ❌ DON'T

1. **Test implementation details** - Focus on behavior, not internals
2. **Over-test stable libraries** - Date-fns, RRule have their own tests
3. **Skip error cases** - Always test failure paths
4. **Ignore flaky tests** - Fix or remove them immediately
5. **Test React internals** - Defer UI testing during active development
6. **Create brittle tests** - Avoid exact string matching for UI text

---

## Quick Reference

### Running Tests
```bash
npm test              # Watch mode (development)
npm test -- --run     # CI mode (one-time run)
npm test -- --run PhaseCalculations  # Specific file
```

### Writing a New Test
```typescript
// 1. Create test file next to source
//    src/utils/myUtil.ts → src/utils/__tests__/myUtil.test.ts

// 2. Import functions and Vitest
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myUtil';

// 3. Organize with describe blocks
describe('myFunction', () => {
  it('should handle normal case', () => {
    expect(myFunction('input')).toBe('expected');
  });
  
  it('should handle edge case', () => {
    expect(myFunction(null)).toBe('default');
  });
});
```

### Mocking Supabase (for orchestrators)
```typescript
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: [{}], error: null })
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({ 
        data: { user: { id: 'test-user' } }, 
        error: null 
      })
    }
  }
}));
```

---

## Maintenance & Evolution

### When Rules Change
1. **Update tests first** (TDD approach)
2. Run tests to confirm they fail
3. Update implementation
4. Verify tests pass
5. Document the rule change

### When Bugs Are Found
1. **Write a failing test** that reproduces the bug
2. Fix the implementation
3. Verify test passes
4. Commit both test and fix together

### When Refactoring
1. Ensure all tests pass before starting
2. Refactor incrementally
3. Run tests after each change
4. Tests give confidence the behavior hasn't changed

---

## Summary

**Current Achievement**: 547 tests covering critical business logic (domain rules, calculations, orchestrators, utilities)

**Philosophy**: Test what matters (pure functions, business rules, workflows), defer what doesn't (UI implementation details during active development)

**Next Phase**: Bug-driven testing - add tests as bugs are discovered and features are built

**Success Metric**: Tests catch real bugs and give confidence to refactor, without slowing down development iteration

---

*Last Updated: January 8, 2026*  
*Test Count: 547 passing*  
*Coverage: Domain rules (~90%), Orchestrators (~75%), Utilities (~85%)*
- [ ] Add more tests for domain rules
- [ ] Set up CI/CD pipeline
- [ ] Add coverage badge to README
- [ ] Make tests mandatory for new PRs

---

## Resources

- **Vitest Docs**: https://vitest.dev/
- **Testing Library**: https://testing-library.com/
- **MSW (Mocking)**: https://mswjs.io/
- **Test-Driven Development**: https://martinfowler.com/bliki/TestDrivenDevelopment.html

---

## Next Steps

1. **Today**: Install dependencies, write first domain rule test
2. **This Week**: Test all domain rules (aim for 100% coverage)
3. **Next Week**: Test calculations layer
4. **Month 1**: Test orchestrators, set up CI/CD
5. **Month 2**: Component tests, E2E tests
6. **Ongoing**: Maintain coverage, tests for all new features

Remember: **Every test you write is insurance against future bugs!** 🛡️
