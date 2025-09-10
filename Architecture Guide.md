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

## 🎨 Type Architecture - Single Source of Truth

### Core Type Principles:
```
src/types/core.ts = SINGLE SOURCE OF TRUTH for all domain types
```

**NEVER duplicate core types** - All domain interfaces must extend or reference `core.ts`

### Type Usage Patterns:
```typescript
// ✅ CORRECT - Reference core types
import type { Project, Milestone, CalendarEvent } from '@/types/core';

// ✅ CORRECT - Extend core types for specific use cases
interface ProjectEvent extends Pick<CalendarEvent, 'id' | 'startTime' | 'endTime'> {
  projectId: string; // Add required field for domain use
}

// ✅ CORRECT - Flexible backward compatibility
export type FlexibleMilestone = Milestone & {
  projectId?: string; // Optional for legacy compatibility
};

// ❌ FORBIDDEN - Duplicate core type definitions
interface Project { // This creates conflicts and inconsistency
  id: string;
  name: string;
  // ... duplicating core.ts
}
```

### Domain Types in core.ts:
- **Project**: Main project entity with status, milestones, scheduling
- **Milestone**: Project milestone with time allocation and ordering
- **CalendarEvent**: Events with recurring patterns and completion tracking
- **Group/Row**: Project organization and layout structure
- **Holiday**: Calendar holidays with regional support
- **WorkHour**: Time tracking and work session management

### Component-Specific Types:
Components may define **Props**, **Config**, and **Local** interfaces that extend core types:
```typescript
// ✅ ALLOWED - Component-specific extensions
interface LocalMilestone extends Omit<Milestone, 'id'> {
  id?: string;
  isNew?: boolean;
}

interface ProjectModalProps {
  project?: Project; // References core type
  onSave: (project: Project) => void; // References core type
}
```

### ✅ Type Consolidation Benefits:
- **Consistency**: Single definition prevents type mismatches
- **Maintainability**: Changes in one place propagate everywhere
- **Type Safety**: TypeScript catches interface conflicts early
- **Code Intelligence**: Better IDE autocomplete and refactoring
- **Documentation**: One place to understand domain model

### ❌ Type Duplication Problems:
- Interface conflicts between similar types
- Inconsistent field types across codebase  
- Difficult refactoring when types need changes
- Broken imports when duplicate types are removed
- Confusion about which type definition to use

## 📋 AI Decision Matrix

| User Request | Code Type | Exact Location | Pattern |
|--------------|-----------|----------------|---------|
| "calculate project duration" | Business logic | `unified/UnifiedProjectService.ts` | `static calculateDuration()` |
| "validate milestone budget" | Business logic | `unified/UnifiedMilestoneService.ts` | `static validateBudget()` |
| "position timeline bar" | UI logic | `ui/TimelinePositioning.ts` | `static calculateBarPosition()` |
| "coordinate project creation" | Workflow | `orchestrators/ProjectOrchestrator.ts` | `async createProject()` |
| "save project data" | Data access | `repositories/ProjectRepository.ts` | `async saveProject()` |
| "define project type" | Type definition | `types/core.ts` | `export interface Project` |
| "extend project for component" | Component type | Component file | `interface LocalProject extends Project` |
| "create project subset" | Service type | Service file | `Pick<Project, 'id' \| 'name'>` |

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
- [ ] Types reference `core.ts` single source of truth
- [ ] No duplicate type definitions outside of core.ts

## 🔧 Type Consolidation Methodology

### Phase 1: Type Consolidation Process
When consolidating duplicate types, follow this incremental approach:

#### 1. **Audit & Identify** 
```bash
# Find duplicate interfaces
grep -r "interface.*Project" src/ | grep -v core.ts
grep -r "interface.*Milestone" src/ | grep -v core.ts  
```

#### 2. **Create Backward-Compatible Aliases**
```typescript
// Instead of deleting duplicate interfaces, create aliases first
export type FlexibleMilestone = Milestone & {
  projectId?: string; // Add optional fields for compatibility
};

// Or create proper subset types
export interface ProjectEvent extends Pick<CalendarEvent, 'id' | 'startTime' | 'endTime'> {
  projectId: string; // Add required fields for domain use
}
```

#### 3. **Incremental Replacement**
- Replace one duplicate interface at a time
- Verify TypeScript compilation after each change
- Test production builds after each consolidation
- Keep backups until verification complete

#### 4. **Update Exports**
```typescript
// Update barrel exports in services/index.ts
export type { FlexibleMilestone, ProjectEvent } from './calculations/milestoneCalculations';
```

#### 5. **Verification & Cleanup**
- Run full TypeScript compilation: `npm run build`
- Verify all imports resolve correctly
- Remove backup files after successful verification
- Update documentation with new type patterns

### Type Consolidation Results:
✅ **18 Total Consolidations Completed** (December 9, 2025)
- 5 duplicate type interfaces eliminated  
- 13 duplicate calculation functions eliminated
- 0 breaking changes introduced
- 100% production build success rate

### Orchestrator Implementation Results:
✅ **2 Core Orchestrators Completed** (December 9, 2025)
- CalendarOrchestrator: Complete calendar workflow coordination
- WorkHourOrchestrator: Complete work hour management workflows
- Multi-step workflow orchestration spanning multiple services
- Production builds verified and working

## 🏆 Current Architecture Status (Updated December 9, 2025)

### ✅ **COMPLETED PHASES:**
- **Phase 1 - Type & Calculation Consolidation**: 100% Complete, Single source of truth established
- **Phase 2 - Repository & Service Architecture**: 100% Complete, Full infrastructure implemented

### 🎯 **FUTURE DEVELOPMENT:**
- **Component Logic Extraction**: Optional orchestrator implementations for complex UI logic
- **Advanced Features**: Real-time updates, webhooks, notifications
- **Performance Monitoring**: Repository metrics and analytics

### 🎉 **Key Achievements:**
- **Zero Breaking Changes**: Maintained throughout all architectural improvements
- **Production Stability**: All improvements verified through production builds
- **Single Source of Truth**: Achieved for types (core.ts) and calculations (core calculation modules)
- **Complete Infrastructure**: Repository layer, caching, offline support, and service architecture established
- **Architecture Guide**: Comprehensive documentation for systematic AI development

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
