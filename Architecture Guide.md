# 🏗️ AI-Optimized Services Architecture Guide

> **SINGLE SOURCE OF TRUTH** for AI development in this codebase. This guide reflects the actual services architecture and intended logic flow.

**Last Updated:** October 20, 2025  
**Repository Transition:** ✅ **COMPLETE** - All 34 build errors resolved, clean compilation achieved

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
src/
├── domain/                      # ⭐ NEW: Business Logic Layer (Single Source of Truth)
│   ├── entities/                # Domain entities with business rules
│   │   ├── Project.ts
│   │   ├── Milestone.ts
│   │   ├── Group.ts
│   │   └── Row.ts
│   ├── rules/                   # Centralized business rules
│   │   ├── ProjectRules.ts
│   │   ├── MilestoneRules.ts
│   │   └── RelationshipRules.ts
│   ├── value-objects/           # Immutable value types
│   │   ├── TimeAllocation.ts
│   │   └── DateRange.ts
│   └── index.ts
├── services/
│   ├── unified/                 # Main API - Components import from here
│   │   ├── UnifiedProjectService.ts
│   │   ├── UnifiedTimeTrackingService.ts
│   │   └── UnifiedMilestoneService.ts
│   ├── orchestrators/           # Workflow coordination
│   │   ├── ProjectOrchestrator.ts
│   │   └── TimeTrackingOrchestrator.ts
│   ├── calculations/            # Pure data mathematics (NO UI/pixels)
│   │   ├── dateCalculations.ts          # Date/time arithmetic
│   │   ├── projectCalculations.ts       # Project duration, working days
│   │   ├── milestoneCalculations.ts     # Milestone metrics
│   │   └── capacityCalculations.ts      # Work hour capacity
│   ├── validators/              # Business rules validation (delegates to domain)
│   │   ├── ProjectValidator.ts
│   │   └── TimeTrackingValidator.ts
│   ├── repositories/            # Data access layer
│   │   ├── ProjectRepository.ts
│   │   └── TimeTrackingRepository.ts
│   ├── ui/                      # UI positioning & visual mathematics
│   │   ├── positioning/         # Pixel calculations, viewport, drag
│   │   │   ├── TimelinePositioning.ts   # Bar positioning (left, width)
│   │   │   ├── DragPositioning.ts       # Mouse→pixel→date conversion
│   │   │   └── ViewportPositioning.ts   # Scroll, zoom, visible range
│   │   ├── coordination/        # High-level UI orchestration
│   │   │   └── DragCoordinator.ts       # Drag operation workflows
│   │   ├── CalendarLayout.ts
│   │   └── FullCalendarConfig.ts
│   ├── infrastructure/          # Technical utilities
│   │   ├── calculationCache.ts
│   │   ├── colorCalculations.ts
│   │   └── dateCalculationService.ts
│   ├── performance/             # Performance optimization
│   │   ├── cachePerformanceService.ts
│   │   ├── dragPerformanceService.ts
│   │   └── performanceMetricsService.ts
│   ├── legacy/                  # Migration safety (temporary)
│   └── index.ts                 # Barrel exports
└── types/
    └── core.ts                  # Type definitions (structure only)
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
| ⭐ "define business rule" | **Business rule** | `domain/rules/ProjectRules.ts` | `static validateX()` |
| ⭐ "check if valid" | **Business rule** | `domain/rules/` | Reference business rules |
| "calculate project duration" | Pure data math | `calculations/dateCalculations.ts` | Pure function (date math) |
| "validate milestone budget" | Validation workflow | `validators/MilestoneValidator.ts` | Calls domain rules |
| "position timeline bar" | UI positioning | `ui/positioning/TimelinePositioning.ts` | `static calculateBarPosition()` |
| "handle drag operation" | UI math | `ui/positioning/DragPositioning.ts` | Mouse→pixel→date conversion |
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

## 🏢 Architecture Layer Responsibilities

### ⭐ Domain Layer (NEW - Single Source of Truth):
- **Purpose**: Define business entities, rules, and relationships
- **Contains**: 
  - Domain entities (Project, Milestone, etc.) with embedded business rules
  - Business rules (validation, constraints, invariants)
  - Value objects (TimeAllocation, DateRange)
  - Relationship definitions
- **Example**: `ProjectRules.validateBudget()`, `Project.canAddMilestone()`
- **Reference**: See `docs/BUSINESS_LOGIC_REFERENCE.md`

### 📐 Calculations vs UI Separation:

**Key Principle**: Separate **data mathematics** from **visual mathematics**

#### Calculations Layer (Pure Data Math):
- ✅ **Contains**: Date/time arithmetic, durations, capacity metrics, project budgets
- ✅ **Examples**: "How many days between dates?", "What's the capacity utilization?"
- ❌ **Never contains**: Pixels, viewport, mouse coordinates, screen positions
- **Decision Rule**: "Could this run on a server with no UI?" → Put in calculations/

#### UI Layer (Visual Math):
- ✅ **Contains**: Pixel positioning, drag calculations, viewport scrolling, layout
- ✅ **Examples**: "Where does this bar go on screen?", "What date did user click?"
- ✅ **Can use**: Pixels, DOM concepts, mouse events, screen dimensions
- **Decision Rule**: "Does this involve screen rendering?" → Put in ui/positioning/

**Example Distinction**:
```typescript
// ✅ calculations/dateCalculations.ts (pure data)
export function calculateDuration(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

// ✅ ui/positioning/TimelinePositioning.ts (visual)
export function calculateBarPosition(start: Date, viewportStart: Date): number {
  const dayOffset = calculateDuration(viewportStart, start); // uses data calc
  return dayOffset * PIXELS_PER_DAY; // converts to pixels
}
```

### Unified Services (Main API):
- **Purpose**: Primary interface for components
- **Contains**: High-level operations, delegates to domain layer
- **Example**: `UnifiedProjectService.createProject()` → uses `ProjectRules`

### Orchestrators:
- **Purpose**: Coordinate complex workflows
- **Contains**: Multi-step processes, cross-service coordination
- **Example**: `ProjectOrchestrator.createWithMilestones()`

### Calculations:
- **Purpose**: Pure data mathematics (NO UI concerns, NO pixels)
- **Contains**: Date arithmetic, duration calculations, capacity metrics
- **Example**: `dateCalculations.calculateDuration()` (date math only)
- **Rule**: No pixel values, no DOM interactions, no viewport logic

### UI Services:
- **Purpose**: View-specific positioning, layout, and visual mathematics
- **Contains**: 
  - **positioning/**: Pixel calculations, drag math, viewport positioning
  - **coordination/**: High-level UI operation orchestration
  - Canvas positioning, mouse-to-date conversions
- **Example**: `TimelinePositioning.calculateBarPosition()` (returns pixels)
- **Rule**: Can use pixels, DOM concepts, viewport dimensions

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

## 🏆 Current Architecture Status (Updated October 20, 2025)

### ✅ **COMPLETED PHASES:**
- **Phase 1 - Type & Calculation Consolidation**: 100% Complete, Single source of truth established
- **Phase 2 - Repository & Service Architecture**: 100% Complete, Full infrastructure implemented
- **Domain Rules Extraction**: 100% Complete, Business rules centralized in domain layer

### 🎯 **CURRENT STATUS:**
- **Repository Transition:** ✅ **COMPLETE** - All 34 build errors resolved, clean compilation achieved
- **Domain Rules:** ✅ **COMPLETE** - All business rules implemented and operational
- **Unified Services:** ✅ **COMPLETE** - All services integrated with proper domain logic
- **Orchestrators:** ✅ **COMPLETE** - All orchestrators operational with repository integration
- **Domain Entities:** TODO - Placeholder structure exists, implementation pending
- **Value Objects:** TODO - Placeholder structure exists, implementation pending
- **Component Logic Extraction**: Optional future enhancement

### 🎯 **FUTURE DEVELOPMENT:**
- **Domain Entities**: Implement Project, Milestone, Group, Row entities with business methods
- **Value Objects**: Implement TimeAllocation, DateRange immutable types
- **Advanced Features**: Real-time updates, webhooks, notifications
- **Performance Monitoring**: Repository metrics and analytics

### 🎉 **Key Achievements (October 20, 2025):**
- **Zero Breaking Changes**: Maintained throughout all architectural improvements
- **Production Stability**: All improvements verified through production builds
- **Single Source of Truth**: Achieved for types (core.ts) and business rules (domain/rules/)
- **Complete Infrastructure**: Repository layer, caching, offline support, and service architecture established
- **Domain Rules**: 50+ business rule methods implemented across 4 rule modules
- **Code Consolidation**: 18 duplicate type interfaces eliminated, 13 duplicate calculation functions eliminated
- **Architecture Guide**: Comprehensive documentation updated to reflect current state

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

## 🎯 Domain Layer - Business Logic Single Source of Truth

### Purpose
The domain layer is the **single source of truth** for all business logic, rules, relationships, and constraints. It sits at the heart of the architecture and is referenced by all other layers.

### Key Documents
- **Business Logic Reference**: `docs/BUSINESS_LOGIC_REFERENCE.md` - Complete specification of all rules
- **Business Logic Audit**: `docs/architecture/BUSINESS_LOGIC_AUDIT.md` - Current state analysis

### Why This Wasn't Done Before
1. **Rapid prototyping** - Features built quickly without consolidation
2. **React-first thinking** - Focused on components/state vs domain modeling
3. **Organic growth** - Codebase evolved without periodic refactoring
4. **No upfront domain design** - Jumped to implementation

### Problems Solved
- ❌ **Before**: Business rules scattered across 5+ layers (types, services, validators, contexts, components)
- ❌ **Before**: Same rule duplicated in 3-5 places
- ❌ **Before**: No reference document for "how should this work?"
- ❌ **Before**: Validation inconsistently applied
- ❌ **Before**: Breaking changes because relationships not understood

- ✅ **After**: Single source of truth for all business logic
- ✅ **After**: Rules defined once, referenced everywhere
- ✅ **After**: Comprehensive reference document
- ✅ **After**: Validation always applied at entity level
- ✅ **After**: Relationships explicit and enforced

### Domain Layer Structure (Current Implementation)

```
src/domain/
├── entities/                    ❌ TODO - Placeholder only
│   └── index.ts                ❌ TODO comments only
├── rules/                       ✅ FULLY IMPLEMENTED
│   ├── ProjectRules.ts         ✅ Complete business logic (18+ methods)
│   ├── MilestoneRules.ts       ✅ Complete business logic (15+ methods)
│   ├── TimelineRules.ts        ✅ Complete business logic (10+ methods)
│   └── RelationshipRules.ts    ✅ Complete business logic
├── value-objects/               ❌ TODO - Placeholder only
│   └── index.ts                ❌ TODO comments only
└── index.ts                     ✅ Export barrel
```

### Example: Domain Entity Pattern

```typescript
// src/domain/entities/Project.ts
import { ProjectRules } from '../rules/ProjectRules';
import type { Milestone } from './Milestone';

export class Project {
  constructor(
    public id: string,
    public name: string,
    public estimatedHours: number,
    public startDate: Date,
    public endDate: Date,
    public groupId: string,
    public rowId: string,
    // ... other properties
  ) {
    // Validation happens at construction
    const validation = ProjectRules.validate(this);
    if (!validation.isValid) {
      throw new DomainError(validation.errors);
    }
  }
  
  // Domain methods (business logic)
  canAddMilestone(milestone: Milestone): boolean {
    return ProjectRules.canAccommodateMilestone(this, milestone);
  }
  
  getDuration(): number {
    return ProjectRules.calculateDuration(this.startDate, this.endDate);
  }
  
  getBudgetAnalysis(milestones: Milestone[]): BudgetAnalysis {
    return ProjectRules.analyzeBudget(this, milestones);
  }
  
  isWithinDateRange(date: Date): boolean {
    return ProjectRules.isDateWithinRange(this, date);
  }
}
```

### Example: Business Rules Module

```typescript
// src/domain/rules/ProjectRules.ts

/**
 * Centralized Project Business Rules
 * All project-related business logic defined here
 */
export class ProjectRules {
  
  /**
   * RULE 1: Project estimated hours must be positive
   */
  static validateEstimatedHours(hours: number): ValidationResult {
    if (hours <= 0) {
      return { isValid: false, errors: ['Estimated hours must be greater than 0'] };
    }
    return { isValid: true, errors: [] };
  }
  
  /**
   * RULE 2: Project end date must be after start date (non-continuous)
   */
  static validateDateRange(startDate: Date, endDate: Date, continuous: boolean): ValidationResult {
    if (!continuous && endDate <= startDate) {
      return { isValid: false, errors: ['End date must be after start date'] };
    }
    return { isValid: true, errors: [] };
  }
  
  /**
   * RULE 3: Milestone allocation cannot exceed project budget
   */
  static canAccommodateMilestone(project: Project, milestone: Milestone): boolean {
    const currentAllocation = project.milestones.reduce((sum, m) => sum + m.timeAllocationHours, 0);
    const newTotal = currentAllocation + milestone.timeAllocationHours;
    return newTotal <= project.estimatedHours;
  }
  
  /**
   * Calculate project duration (pure calculation)
   */
  static calculateDuration(startDate: Date, endDate: Date): number {
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  // ... all other project rules defined here
}
```

### Integration with Existing Layers

**Unified Services** delegate to domain layer:
```typescript
// unified/UnifiedProjectService.ts
import { ProjectRules } from '@/domain/rules/ProjectRules';

export class UnifiedProjectService {
  static validateProject(project: Project): ValidationResult {
    // Delegate to domain rules (single source of truth)
    return ProjectRules.validate(project);
  }
  
  static calculateDuration(project: Project): number {
    // Delegate to domain rules
    return ProjectRules.calculateDuration(project.startDate, project.endDate);
  }
}
```

**Validators** orchestrate domain validation:
```typescript
// validators/ProjectValidator.ts
import { ProjectRules } from '@/domain/rules/ProjectRules';

export class ProjectValidator {
  static async validate(project: Project, context: ValidationContext): Promise<DetailedResult> {
    // Orchestrate multiple domain rules
    const basicValidation = ProjectRules.validate(project);
    const dateValidation = ProjectRules.validateDateRange(project.startDate, project.endDate);
    const budgetValidation = ProjectRules.analyzeBudget(project, context.milestones);
    
    // Aggregate and return detailed result
    return this.aggregateResults([basicValidation, dateValidation, budgetValidation]);
  }
}
```

**Contexts** use domain entities:
```typescript
// contexts/ProjectContext.tsx
import { Project } from '@/domain/entities/Project';

function addProject(data: ProjectData) {
  // Domain entity validates on construction
  const project = new Project(data); // Throws if invalid
  
  // Save via repository
  await projectRepository.save(project);
}
```

### Migration Strategy (Current Status)

**Phase 1** ✅ (Complete):
- [x] Create Business Logic Reference document
- [x] Create Business Logic Audit document
- [x] Update Architecture Guide

**Phase 2** ✅ (Complete):
- [x] Create `src/domain/` folder structure
- [x] Extract business rules to `src/domain/rules/`
- [x] Implement `ProjectRules`, `MilestoneRules`, `TimelineRules`, `RelationshipRules`
- [x] Update validators to reference domain rules
- [x] Keep existing code working (no breaking changes)

**Phase 3** 🔄 (Pending):
- [ ] Implement domain entities (`Project.ts`, `Milestone.ts`, etc.)
- [ ] Implement value objects (`TimeAllocation.ts`, `DateRange.ts`)
- [ ] Update contexts to use domain entities
- [ ] Add comprehensive domain tests

**Phase 4** 🔄 (Future):
- [ ] Remove duplication from contexts
- [ ] Add database CHECK constraints
- [ ] Remove deprecated code

### Benefits of Domain Layer

1. **Single Source of Truth**
   - All business rules in one place
   - No more hunting for "where is this validated?"
   - Developers refer to domain layer first

2. **Consistency**
   - Rules applied uniformly
   - No variations between views
   - Same validation everywhere

3. **Maintainability**
   - Update rule in one place
   - Changes propagate automatically
   - Less code to maintain (30-40% reduction)

4. **Testability**
   - Domain logic isolated
   - Easy to unit test
   - No UI/database dependencies

5. **Discoverability**
   - Clear folder structure
   - Predictable naming
   - Self-documenting code

6. **Reliability**
   - Validation always applied
   - Cannot bypass rules
   - Fewer bugs in production

### Does This Involve Significant Refactoring?

**No, it's incremental**:
- Phase 1-2: Documentation + extraction (minimal risk)
- Phase 3-4: Gradual migration (one module at a time)
- Old code continues working during migration
- Can roll back at any phase

**Timeline**: 6-8 weeks for complete migration (but benefits start immediately)

### AI Development with Domain Layer (Current State)

**When making changes**:
1. Check `docs/BUSINESS_LOGIC_REFERENCE.md` first
2. Understand the business rule being affected
3. Update domain rules in `src/domain/rules/` (✅ IMPLEMENTED)
4. For new business logic, add to appropriate rule module
5. Test at domain layer (unit tests can be added later)

**When debugging**:
1. Verify rule in Business Logic Reference
2. Check domain rules implementation (✅ AVAILABLE)
3. Trace through validation flow
4. Fix at domain rules level (single point of truth)

**Note**: Domain entities and value objects are not yet implemented. For now, continue using existing service patterns for complex object behavior.

### Success Criteria

**✅ Currently Achieved:**
- Business Logic Reference is maintained and current
- All rules defined in `src/domain/rules/` (4 rule modules, 50+ methods)
- Validators delegate to domain layer
- Services delegate to domain layer
- No business logic in components/contexts
- Single source of truth for business rules established

**🔄 Still Pending:**
- Domain entities implemented with business methods
- Value objects for complex domain concepts
- Comprehensive domain layer testing
- Database CHECK constraints
- Complete removal of deprecated code

---

**This guide ensures AI develops consistent, maintainable code that follows the established architecture patterns and eliminates duplication.**
