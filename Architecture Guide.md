# 🏗️ AI-Optimized Services Architecture Guide

> **SINGLE SOURCE OF TRUTH** for AI development in this codebase. This guide reflects the actual services architecture and intended logic flow.

## 🤖 AI Development Constraints

### NEVER Create These Patterns:
- File paths containing `/utils/` or `/helpers/`
- Import statements like `from '@/services/core/domain/ProjectEntity'`
- Functions named `calculate*` in `/src/components/`
- Multiple files with same function names
- Business logic in components or hooks

### ALWAYS Follow These Patterns:
- Import from `@/services` only (barrel imports)
- Put calculations in `unified/UnifiedXService.ts`
- Check existing functionality before creating new
- Use exact naming patterns: `UnifiedProjectService`, `ProjectOrchestrator`
- Follow the logic flow: Components → Unified Services → Orchestrators → Validators/Calculations/Repositories

## 🎯 Services Architecture Pattern

### Core Logic Flow:
```
Components/Hooks → Unified Services → Orchestrators → Validators + Calculations + Repositories
```

### Directory Structure:
```
src/services/
├── unified/                     # Main API - Components import from here
│   ├── UnifiedProjectService.ts
│   ├── UnifiedTimeTrackingService.ts
│   └── UnifiedMilestoneService.ts
├── orchestrators/               # Workflow coordination
│   ├── ProjectOrchestrator.ts
│   └── TimeTrackingOrchestrator.ts
├── calculations/                # Pure business calculations
│   ├── ProjectCalculations.ts
│   ├── TimeCalculations.ts
│   └── timeTrackingCalculations.ts
├── validators/                  # Business rules validation
│   ├── ProjectValidator.ts
│   └── TimeTrackingValidator.ts
├── repositories/                # Data access layer
│   ├── ProjectRepository.ts
│   └── TimeTrackingRepository.ts
├── ui/                         # View-specific positioning
│   ├── TimelinePositioning.ts
│   └── CalendarLayout.ts
├── infrastructure/             # Technical utilities
│   ├── calculationCache.ts
│   ├── colorCalculations.ts
│   └── dateCalculationService.ts
├── performance/               # Performance optimization
│   ├── cachePerformanceService.ts
│   ├── dragPerformanceService.ts
│   └── performanceMetricsService.ts
├── legacy/                    # Migration safety (temporary)
└── index.ts                   # Barrel exports
```

## 📋 AI Decision Matrix

| User Request | Code Type | Exact Location | Pattern |
|--------------|-----------|----------------|---------|
| "calculate project duration" | Business logic | `unified/UnifiedProjectService.ts` | `static calculateDuration()` |
| "validate milestone budget" | Business logic | `unified/UnifiedMilestoneService.ts` | `static validateBudget()` |
| "position timeline bar" | UI logic | `ui/TimelinePositioning.ts` | `static calculateBarPosition()` |
| "coordinate project creation" | Workflow | `orchestrators/ProjectOrchestrator.ts` | `async createProject()` |
| "save project data" | Data access | `repositories/ProjectRepository.ts` | `async saveProject()` |

## 🚫 Utils/Lib Rules

### ✅ Allowed Utils/Lib:
- Framework utilities (shadcn className merging)
- Pure formatting (currency, date display)
- Generic algorithms (debounce, throttle)
- Validation helpers (email, phone format)

### ❌ Forbidden Utils/Lib:
- Business calculations
- Domain-specific logic
- Application workflows  
- Project/milestone/work-hour logic

### Examples:
```typescript
// ✅ ALLOWED in utils/
export function cn(...classes: string[]): string // Framework utility
export function formatCurrency(amount: number): string // Pure formatting
export function debounce<T>(fn: T, delay: number): T // Generic algorithm

// ❌ FORBIDDEN in utils/ - Must go in services/
export function calculateProjectDuration() // Business calculation
export function validateMilestone() // Domain logic
export function createProject() // Application workflow
```

## 🔀 Import Detection Rules:

### ✅ ALLOWED Imports:
```typescript
import { UnifiedProjectService, ProjectOrchestrator } from '@/services';
import { formatDate, cn } from '@/utils';
import { PROJECT_STATUS } from '@/constants';
```

### ❌ FORBIDDEN Imports:
```typescript
import { ProjectEntity } from '@/services/core/domain/ProjectEntity'; // Direct service import
import { calculateDuration } from '@/services/legacy/calculations'; // Legacy import
import { projectHelper } from '@/services/helpers/projectHelper'; // Helpers pattern
```

## 🏢 Service Layer Responsibilities

### Unified Services (Main API):
- **Purpose**: Primary interface for components
- **Contains**: Business logic, high-level operations
- **Example**: `UnifiedProjectService.createProject()`

### Orchestrators:
- **Purpose**: Coordinate complex workflows
- **Contains**: Multi-step processes, cross-service coordination
- **Example**: `ProjectOrchestrator.createWithMilestones()`

### Calculations:
- **Purpose**: Pure mathematical operations
- **Contains**: Business calculations, algorithms
- **Example**: `ProjectCalculations.calculateDuration()`

### Validators:
- **Purpose**: Business rules enforcement
- **Contains**: Validation logic, constraint checking
- **Example**: `ProjectValidator.validateBudget()`

### Repositories:
- **Purpose**: Data access and persistence
- **Contains**: Database operations, caching
- **Example**: `ProjectRepository.save()`

### UI Services:
- **Purpose**: View-specific positioning and layout
- **Contains**: Canvas positioning, viewport calculations
- **Example**: `TimelinePositioning.calculateBarDimensions()`

### Infrastructure:
- **Purpose**: Technical utilities and framework helpers
- **Contains**: Caching, date utilities, color calculations
- **Example**: `calculationCache.memoize()`, `colorCalculations.generatePalette()`

### Performance:
- **Purpose**: Performance optimization and monitoring
- **Contains**: Performance metrics, caching strategies, optimization
- **Example**: `performanceMetricsService.trackRender()`, `dragPerformanceService.optimize()`

## 🎯 Single Source of Truth Pattern

### Problem Solved:
Eliminates duplicate calculations across different views (e.g., project bars on weeks view vs days view using different calculations).

### Solution:
```typescript
// ✅ BEFORE: Inconsistent calculations
// WeeksView.tsx: const barWidth = project.duration * 40; // Magic number
// DaysView.tsx: const barWidth = (end - start) / dayScale; // Different formula

// ✅ AFTER: Consistent calculations
// Both views use: TimelinePositioning.calculateBarDimensions(project, viewport, viewType)
```

## 🔄 Development Workflow for AI

### Before Creating New Code:
1. **Search existing services**: Use semantic search for similar functionality
2. **Check barrel exports**: All services export through `@/services`
3. **Verify service layer**: Ensure correct layer for the functionality type
4. **Plan integration**: How does this fit into the logic flow?

### When Adding Features:
1. **Start with unified service**: Main API that components will use
2. **Add orchestrator if needed**: For complex multi-step workflows
3. **Extract calculations**: Pure math goes in calculations layer
4. **Add validation**: Business rules go in validators layer
5. **Update repositories**: Data access patterns if needed
6. **Update barrel exports**: Add to main `index.ts`

### AI Safety Checks:
- [ ] No duplicate functionality created
- [ ] Business logic not in components
- [ ] Imports use barrel pattern `@/services`
- [ ] Proper service layer selected
- [ ] UI positioning uses dedicated UI services

## 📦 Migration Strategy

### Legacy Handling:
- Move existing services to `legacy/` folder during migration
- Create delegation wrappers for backward compatibility
- Update imports gradually to use new unified services
- Delete legacy folder when migration complete

### Example Migration:
```typescript
// Phase 1: Create new unified service
// unified/UnifiedProjectService.ts
export class UnifiedProjectService {
  static calculateDuration(project: Project): number { ... }
}

// Phase 2: Update legacy to delegate
// legacy/ProjectCalculationService.ts  
export class ProjectCalculationService {
  static calculateDuration(project: Project): number {
    return UnifiedProjectService.calculateDuration(project);
  }
}

// Phase 3: Update component imports
// Before: import { ProjectCalculationService } from '@/services/legacy/...'
// After:  import { UnifiedProjectService } from '@/services'

// Phase 4: Delete legacy files
```

## 🛡️ Architectural Guardrails

### Anti-Patterns to Avoid:
- **Scattered calculations**: Same logic in multiple places
- **Component business logic**: Calculations in UI components
- **Deep import paths**: Direct service imports bypassing barrel
- **Inconsistent naming**: Not following `UnifiedXService` pattern
- **Mixed responsibilities**: Services doing multiple unrelated things

### Success Patterns:
- **Single source of truth**: All calculations centralized
- **Clear layer separation**: Each service type has distinct responsibility
- **Consistent imports**: All imports via `@/services` barrel
- **Predictable naming**: AI can find services following patterns
- **Workflow coordination**: Complex operations properly orchestrated

## 🚀 AI Implementation Guidelines

### For Business Logic:
1. Check if `UnifiedXService` exists for the domain
2. Add method to existing service or create new unified service
3. Use orchestrator for complex multi-step workflows
4. Extract pure calculations to calculations layer

### For UI Logic:
1. Check existing UI services (`TimelinePositioning`, `CalendarLayout`)
2. Add to appropriate UI service or create new one
3. Keep UI logic separate from business logic
4. Ensure consistent positioning across views

### For Data Operations:
1. Use existing repository or create new one
2. Keep data access logic in repositories
3. Use orchestrator to coordinate data operations
4. Maintain separation from business logic

---

**This guide ensures AI develops consistent, maintainable code that follows the established architecture patterns and eliminates duplication.**
