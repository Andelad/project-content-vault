# 🧪 Testing Guide for Project Content Vault

## Table of Contents
1. [Overview](#overview)
2. [Why Testing Matters](#why-testing-matters)
3. [Testing Stack](#testing-stack)
4. [Setup Instructions](#setup-instructions)
5. [Testing Patterns](#testing-patterns)
6. [Examples by Layer](#examples-by-layer)
7. [Running Tests](#running-tests)
8. [Coverage Goals](#coverage-goals)

---

## Overview

This project currently has **0% test coverage**. This guide provides a comprehensive roadmap for implementing tests across all architectural layers.

### Testing Philosophy
- **Unit Tests**: Test individual functions/methods in isolation (domain rules, calculations)
- **Integration Tests**: Test how multiple components work together (orchestrators, hooks)
- **E2E Tests**: Test complete user workflows (sign up, create project, track time)

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

### Recommended Tools

```json
{
  "devDependencies": {
    "vitest": "^1.0.0",              // Test runner (faster than Jest, Vite-native)
    "@vitest/ui": "^1.0.0",          // Visual test UI
    "@testing-library/react": "^14.0.0",  // React component testing
    "@testing-library/jest-dom": "^6.0.0",  // DOM matchers
    "@testing-library/user-event": "^14.0.0",  // User interaction simulation
    "msw": "^2.0.0",                 // Mock Supabase API calls
    "@vitest/coverage-v8": "^1.0.0", // Code coverage reports
    "playwright": "^1.40.0"          // E2E testing (optional, later phase)
  }
}
```

### Why Vitest?
- **Native Vite integration**: Uses same config as your app
- **Fast**: Runs tests in parallel, smart caching
- **Jest-compatible**: Same API if you know Jest
- **TypeScript**: Full TypeScript support out of the box

---

## Setup Instructions

### Step 1: Install Dependencies

```bash
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event msw @vitest/coverage-v8
```

### Step 2: Create Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Step 3: Create Test Setup File

```typescript
// src/test/setup.ts
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest matchers with jest-dom
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    }
  },
  isSupabaseConfigured: true,
  supabaseConfigError: null
}));
```

### Step 4: Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch"
  }
}
```

---

## Testing Patterns

### Pattern 1: Unit Testing Domain Rules (Easiest, Highest Value)

Domain rules are **pure functions** - perfect for testing!

```typescript
// src/domain/rules/__tests__/ProjectRules.test.ts
import { describe, it, expect } from 'vitest';
import { ProjectRules } from '../ProjectRules';

describe('ProjectRules', () => {
  describe('validateProjectDates', () => {
    it('should validate when end date is after start date', () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      
      const result = ProjectRules.validateProjectDates(startDate, endDate);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail when end date is before start date', () => {
      const startDate = new Date('2025-01-31');
      const endDate = new Date('2025-01-01');
      
      const result = ProjectRules.validateProjectDates(startDate, endDate);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End date must be after start date');
    });

    it('should validate when dates are the same (single-day project)', () => {
      const date = new Date('2025-01-01');
      
      const result = ProjectRules.validateProjectDates(date, date);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateMilestoneBudget', () => {
    it('should fail when total milestone hours exceed project budget', () => {
      const project = {
        id: '1',
        estimatedHours: 40,
        // ... other required fields
      };
      const milestones = [
        { allocatedHours: 20 },
        { allocatedHours: 25 } // Total: 45 > 40
      ];
      
      const result = ProjectRules.validateMilestoneBudget(project, milestones);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Milestone hours exceed project budget');
    });
  });
});
```

**Benefits**:
- Fast to write (pure functions, no mocking)
- Fast to run (no dependencies)
- High confidence (business logic is correct)

---

### Pattern 2: Unit Testing Calculations (Pure Math)

```typescript
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

## Quick Start Checklist

- [ ] Install testing dependencies
- [ ] Create `vitest.config.ts`
- [ ] Create `src/test/setup.ts`
- [ ] Add test scripts to `package.json`
- [ ] Write first test for `ProjectRules.validateProjectDates`
- [ ] Run `npm test` and see it pass ✅
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
