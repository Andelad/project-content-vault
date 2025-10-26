# 🏗️ AI-Optimized Services Architecture Guide

> **SINGLE SOURCE OF TRUTH** for AI development in this codebase. This guide reflects the actual services architecture and intended logic flow.

**Last Updated:** October 20, 2025  
**Repository Transition:** ✅ **COMPLETE** - All 34 build errors resolved, clean compilation achieved

## 🤖 AI Development Constraints

### NEVER Create These Patterns:
- ❌ File paths containing `/validators/` (layer eliminated)
- ❌ File paths containing `/repositories/` (layer eliminated, except timeTrackingRepository)
- ❌ Import statements like `from '@/services/core/domain/ProjectEntity'`
- ❌ Functions named `calculate*` in `/src/components/`
- ❌ Multiple files with same function names
- ❌ Business logic in components or hooks
- ❌ New validator files (use domain rules directly in orchestrators)
- ❌ New repository wrappers (use Supabase directly or hooks)

### ALWAYS Follow These Patterns:
- ✅ Import from `@/services` only (barrel imports)
- ✅ Put calculations in `unified/UnifiedXService.ts`
- ✅ Put complex workflows in `orchestrators/XOrchestrator.ts`
- ✅ Call domain rules directly from orchestrators (no validator layer)
- ✅ Call Supabase directly from orchestrators (no repository layer)
- ✅ Check existing functionality before creating new
- ✅ Use exact naming patterns: `UnifiedProjectService`, `ProjectOrchestrator`
- ✅ Follow the simplified flow: Components → Orchestrators (workflows) OR Unified Services (calculations) → Domain Rules → Direct Supabase

## 🎯 Services Architecture Pattern (Simplified - October 2025)

### Core Logic Flow (Current):
```
Components/Hooks → Orchestrators (complex workflows) → Domain Rules + Direct Supabase
                → Unified Services (calculations) → Domain Rules
                → Hooks (simple queries) → Direct Supabase
```

**Key Simplifications:**
- ❌ No validators layer (orchestrators call domain rules directly)
- ❌ No repository layer (orchestrators call Supabase directly, except 1 special case)
- ✅ Domain rules remain single source of truth
- ✅ Clear separation: Orchestrators (workflows) vs Unified Services (calculations)

### Directory Structure (Current - October 26, 2025):
```
src/
├── domain/                      # ⭐ Business Logic Layer (Single Source of Truth)
│   ├── entities/                # TODO: Domain entities with business rules
│   ├── rules/                   # ✅ Centralized business rules (50+ methods)
│   │   ├── ProjectRules.ts      # Project validation and constraints
│   │   ├── MilestoneRules.ts    # Milestone validation and budget rules
│   │   ├── TimelineRules.ts     # Timeline and scheduling rules
│   │   └── RelationshipRules.ts # Cross-entity relationship rules
│   ├── value-objects/           # TODO: Immutable value types
│   └── index.ts
├── services/
│   ├── unified/                 # ✅ Main API - Calculations & transformations
│   │   ├── UnifiedProjectService.ts
│   │   ├── UnifiedTimelineService.ts
│   │   ├── UnifiedMilestoneService.ts
│   │   └── ... (other unified services)
│   ├── orchestrators/           # ✅ Workflow coordination (9 files)
│   │   ├── ProjectOrchestrator.ts         # Project workflows
│   │   ├── ProjectMilestoneOrchestrator.ts # Milestone workflows
│   │   ├── EventModalOrchestrator.ts      # Event modal workflows
│   │   ├── GroupOrchestrator.ts           # Group workflows
│   │   ├── HolidayModalOrchestrator.ts    # Holiday workflows
│   │   ├── SettingsOrchestrator.ts        # Settings workflows
│   │   ├── PlannerViewOrchestrator.ts     # Planner workflows
│   │   ├── timeTrackingOrchestrator.ts    # Time tracking workflows
│   │   ├── recurringEventsOrchestrator.ts # Recurring events
│   │   └── index.ts
│   ├── calculations/            # ✅ Pure data mathematics (NO UI/pixels)
│   │   ├── general/             # Date/time arithmetic
│   │   ├── projects/            # Project calculations
│   │   ├── events/              # Event calculations
│   │   ├── availability/        # Work hour capacity
│   │   └── insights/            # Analytics calculations
│   ├── repositories/            # ⚠️ Mostly eliminated (1 file remains)
│   │   ├── timeTrackingRepository.ts # Complex state management only
│   │   └── index.ts
│   ├── utilities/               # ✅ Lightweight utilities (1 file)
│   │   └── projectDataIntegrity.ts # Project validation utility
│   ├── ui/                      # ✅ UI positioning & visual mathematics
│   │   ├── positioning/         # Pixel calculations, viewport, drag
│   │   │   ├── TimelinePositioning.ts   # Bar positioning
│   │   │   ├── DragPositioning.ts       # Mouse→pixel→date
│   │   │   ├── ViewportPositioning.ts   # Scroll, zoom, visible range
│   │   │   └── TimelineCalculations.ts  # Timeline math
│   │   ├── CalendarLayout.ts
│   │   └── FullCalendarConfig.ts
│   ├── infrastructure/          # ✅ Technical utilities
│   │   ├── calculationCache.ts
│   │   ├── colorCalculations.ts
│   │   └── dateCalculationService.ts
│   ├── performance/             # ✅ Performance optimization
│   │   ├── cachePerformanceService.ts
│   │   ├── dragPerformanceService.ts
│   │   └── performanceMetricsService.ts
│   └── index.ts                 # ✅ Barrel exports (single import point)
├── utils/                       # ✅ Framework & format utilities (2 files)
│   ├── dateFormatUtils.ts       # Date display formatting
│   ├── normalizeProjectColor.ts # Color format migrations (pure transformation)
│   └── index.ts
└── types/
    └── core.ts                  # ✅ Type definitions (single source of truth)
```

**Key Changes from Original Design:**
- ❌ `validators/` - **ELIMINATED** (logic moved inline to orchestrators)
- ❌ `repositories/` - **99% ELIMINATED** (only timeTrackingRepository remains)
- ✅ `utilities/` - **NEW** (lightweight utilities, not business logic)
- ✅ `utils/` - **CLARIFIED** (framework utilities + pure transformations only)
- ✅ Orchestrators now handle validation + data access directly

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

## 📋 AI Decision Matrix (Updated October 2025)

| User Request | Code Type | Exact Location | Pattern |
|--------------|-----------|----------------|---------|
| ⭐ "define business rule" | **Business rule** | `domain/rules/ProjectRules.ts` | `static validateX()` |
| ⭐ "check if valid" | **Business rule** | `domain/rules/` | Reference business rules |
| "calculate project duration" | Pure data math | `calculations/general/dateCalculations.ts` | Pure function (date math) |
| "validate milestone budget" | **Inline validation** | `orchestrators/ProjectOrchestrator.ts` | Call `MilestoneRules.checkBudget()` directly |
| "position timeline bar" | UI positioning | `ui/positioning/TimelinePositioning.ts` | `static calculateBarPosition()` |
| "handle drag operation" | UI math | `ui/positioning/DragPositioning.ts` | Mouse→pixel→date conversion |
| "coordinate project creation" | Workflow | `orchestrators/ProjectOrchestrator.ts` | `async executeProjectCreationWorkflow()` |
| "save project data" | **Direct DB access** | **Inline in orchestrator** | `supabase.from('projects').insert()` |
| "transform database data" | **Inline helper** | **Inline in orchestrator** | Private `transformFromDatabase()` method |
| "define project type" | Type definition | `types/core.ts` | `export interface Project` |
| "extend project for component" | Component type | Component file | `interface LocalProject extends Project` |
| "create project subset" | Service type | Service file | `Pick<Project, 'id' \| 'name'>` |
| "calculate & transform data" | Calculation service | `unified/UnifiedProjectService.ts` | Pure calculation functions |

**Key Changes:**
- ❌ No more validators layer - call domain rules directly
- ❌ No more repositories layer - call Supabase directly or use hooks
- ✅ Orchestrators handle validation + data access inline
- ✅ Transformation helpers inline in orchestrators (private methods)

## 🚫 Utils/Lib Rules

### ✅ Allowed Utils/Lib:
- Framework utilities (shadcn className merging)
- Pure formatting (currency, date display)
- Generic algorithms (debounce, throttle)
- Validation helpers (email, phone format)
- **Legacy format migrations** (pure transformations with no side effects)

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
export function normalizeProjectColor(color: string): string // Legacy format migration

// ❌ FORBIDDEN in utils/ - Must go in services/
export function calculateProjectDuration() // Business calculation
export function validateMilestone() // Domain logic
export function createProject() // Application workflow
```
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

## 🏢 Architecture Layer Responsibilities (Current - October 2025)

### ⭐ Domain Layer (Single Source of Truth):
- **Purpose**: Define business rules and relationships
- **Status**: ✅ **COMPLETE** - 50+ business rule methods across 4 modules
- **Contains**: 
  - ✅ Business rules (validation, constraints, invariants) - `ProjectRules`, `MilestoneRules`, `TimelineRules`, `RelationshipRules`
  - ⏳ Domain entities (TODO - placeholder structure exists)
  - ⏳ Value objects (TODO - placeholder structure exists)
- **Example**: `ProjectRules.validateBudget()`, `MilestoneRules.checkBudgetConstraint()`
- **Reference**: See `docs/BUSINESS_LOGIC_REFERENCE.md`
- **Called by**: Orchestrators and Unified Services

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

### Orchestrators (Enhanced - Handles Workflows + Validation + Data Access):
- **Purpose**: Coordinate complex CREATE/UPDATE/DELETE workflows
- **Status**: ✅ **ENHANCED** - Now handle validation and data access inline
- **Contains**: 
  - Multi-step workflow coordination
  - Inline validation (calls domain rules directly, no validator layer)
  - Inline data access (calls Supabase directly, no repository layer)
  - Inline transformation helpers (private methods)
- **Example**: 
  ```typescript
  // ProjectOrchestrator.ts
  static async executeProjectCreationWorkflow(request, context) {
    // 1. Validate with domain rules
    const validation = ProjectRules.validateProjectDates(...);
    if (!validation.isValid) return { success: false, errors: [...] };
    
    // 2. Transform data inline
    const prepared = this.transformToDatabase(request);
    
    // 3. Call Supabase directly
    const { data, error } = await supabase.from('projects').insert(prepared);
    
    // 4. Coordinate related operations
    await this.createProjectMilestones(...);
  }
  ```
- **9 Active Files**: ProjectOrchestrator, GroupOrchestrator, EventModalOrchestrator, HolidayModalOrchestrator, SettingsOrchestrator, ProjectMilestoneOrchestrator, PlannerViewOrchestrator, timeTrackingOrchestrator, recurringEventsOrchestrator

### Unified Services (Calculations & Transformations):
- **Purpose**: Pure READ/TRANSFORM operations, calculations
- **Status**: ✅ **COMPLETE** - Main calculation layer
- **Contains**: 
  - Data calculations and transformations
  - Memoized performance-critical calculations
  - Pure functions (no side effects)
- **Example**: `UnifiedProjectService.calculateDuration()`, `UnifiedTimelineService.calculateDailyProjectHours()`
- **Rule**: READ and TRANSFORM only, no CREATE/UPDATE/DELETE

### Calculations (Pure Data Mathematics):
- **Purpose**: Pure data mathematics (NO UI concerns, NO pixels)
- **Status**: ✅ **COMPLETE** - Organized by domain
- **Contains**: Date arithmetic, duration calculations, capacity metrics
- **Folders**: `general/`, `projects/`, `events/`, `availability/`, `insights/`
- **Example**: `dateCalculations.calculateDuration()` (date math only)
- **Rule**: No pixel values, no DOM interactions, no viewport logic

### UI Services (Visual Mathematics):
- **Purpose**: View-specific positioning, layout, and visual mathematics
- **Status**: ✅ **COMPLETE** - UI-specific calculations
- **Contains**: 
  - **positioning/**: Pixel calculations, drag math, viewport positioning
  - Canvas positioning, mouse-to-date conversions
- **Example**: `TimelinePositioning.calculateBarPosition()` (returns pixels)
- **Rule**: Can use pixels, DOM concepts, viewport dimensions

### Utilities (Lightweight Helpers):
- **Purpose**: Small, focused utility functions
- **Status**: ✅ **NEW** - Created in Phase 1
- **Contains**: Lightweight utilities that don't fit other layers
- **Example**: `projectDataIntegrity.ts` (175 lines) - Project relationship validation
- **Rule**: Keep small and focused, not a dumping ground

### Infrastructure (Technical Utilities):
- **Purpose**: Technical utilities and framework helpers
- **Status**: ✅ **COMPLETE**
- **Contains**: Caching, date utilities, color calculations
- **Example**: `calculationCache.memoize()`, `colorCalculations.generatePalette()`

### Performance (Optimization):
- **Purpose**: Performance optimization and monitoring
- **Status**: ✅ **COMPLETE**
- **Contains**: Performance metrics, caching strategies, optimization
- **Example**: `performanceMetricsService.trackRender()`, `dragPerformanceService.optimize()`

### ❌ Validators Layer - **ELIMINATED**:
- **Status**: ❌ **DELETED** in Phase 1
- **Reason**: Thin wrappers around domain rules (redundant)
- **Replaced by**: Orchestrators call domain rules directly

### ❌ Repositories Layer - **EFFECTIVELY ELIMINATED**:
- **Status**: ❌ **99% DELETED** in Phase 2
- **Reason**: Thin wrappers around Supabase (hooks already exist)
- **Replaced by**: Orchestrators call Supabase directly
- **Exception**: `timeTrackingRepository.ts` kept for complex state management (localStorage caching, serialization, realtime sync)

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

## 🏆 Current Architecture Status (Updated October 21, 2025)

### ✅ **COMPLETED PHASES:**
- **Phase 1 - Type & Calculation Consolidation**: 100% Complete, Single source of truth established
- **Phase 2 - Repository & Service Architecture**: 100% Complete, Full infrastructure implemented
- **Domain Rules Extraction**: 100% Complete, Business rules centralized in domain layer
- **Phase 1 Simplification - Validator Cleanup**: ✅ **COMPLETE** - 1,164 lines removed (87% reduction)
- **Phase 2 Simplification - Repository Cleanup**: ✅ **COMPLETE** - 498 lines removed (99% of layer eliminated)
- **Client-Group-Label Migration**: ✅ **BACKEND COMPLETE** - Database tables created, data migrated, hooks implemented

### 🎯 **CURRENT STATUS (October 21, 2025):**
- **Architecture Simplification:** ✅ **COMPLETE** - Bold cleanup executed successfully
- **Client-Group-Label System:** ✅ **BACKEND COMPLETE** | ⏳ **UI IN PROGRESS** (see `docs/CLIENT_GROUP_LABEL_IMPLEMENTATION.md`)
- **Domain Rules:** ✅ **COMPLETE** - 50+ business rule methods across 4 modules (single source of truth)
- **Orchestrators:** ✅ **ENHANCED** - Now handle workflows, validation, AND direct data access
- **Unified Services:** ✅ **COMPLETE** - Calculations and transformations preserved
- **Validators Layer:** ❌ **ELIMINATED** - Entire layer removed, logic moved to orchestrators
- **Repository Layer:** ❌ **EFFECTIVELY ELIMINATED** - Only 1 specialized repository remains
- **Build Health:** ✅ **CLEAN** - TypeScript compilation successful, 0 errors
- **Domain Entities:** TODO - Placeholder structure exists, implementation pending
- **Value Objects:** TODO - Placeholder structure exists, implementation pending

### 🎯 **FUTURE DEVELOPMENT:**
- **Domain Entities**: Implement Project, Milestone, Group, Row entities with business methods
- **Value Objects**: Implement TimeAllocation, DateRange immutable types
- **Advanced Features**: Real-time updates, webhooks, notifications
- **Performance Monitoring**: Application metrics and analytics

### 🎉 **Key Achievements (October 21, 2025):**
- **Zero Breaking Changes**: Maintained throughout all architectural improvements
- **Production Stability**: All improvements verified through production builds (9.05s build time)
- **Single Source of Truth**: Achieved for types (core.ts) and business rules (domain/rules/)
- **Bold Simplification**: ~1,662 lines of wrapper code eliminated (validators + repositories)
- **Domain Rules**: 50+ business rule methods implemented across 4 rule modules (ProjectRules, MilestoneRules, TimelineRules, RelationshipRules)
- **Code Consolidation**: 18 duplicate type interfaces eliminated, 13 duplicate calculation functions eliminated
- **Architecture Clarity**: Validators layer eliminated, repository layer effectively eliminated
- **AI-Friendly Codebase**: Clear, direct data flow with no unnecessary wrapper layers
- **Architecture Guide**: Comprehensive documentation updated to reflect simplified state### ✅ **COMPLETED PHASES:**
- **Phase 1 - Type & Calculation Consolidation**: 100% Complete, Single source of truth established
- **Phase 2 - Repository & Service Architecture**: 100% Complete, Full infrastructure implemented
- **Domain Rules Extraction**: 100% Complete, Business rules centralized in domain layer
- **Phase 1 Simplification - Validator Cleanup**: ✅ **COMPLETE** - 1,164 lines removed (87% reduction)
- **Phase 2 Simplification - Repository Cleanup**: ✅ **COMPLETE** - 498 lines removed (99% of layer eliminated)

### 🎯 **CURRENT STATUS (October 21, 2025):**
- **Architecture Simplification:** ✅ **COMPLETE** - Bold cleanup executed successfully
- **Domain Rules:** ✅ **COMPLETE** - 50+ business rule methods across 4 modules (single source of truth)
- **Orchestrators:** ✅ **ENHANCED** - Now handle workflows, validation, AND direct data access
- **Unified Services:** ✅ **COMPLETE** - Calculations and transformations preserved
- **Validators Layer:** ❌ **ELIMINATED** - Entire layer removed, logic moved to orchestrators
- **Repository Layer:** ❌ **EFFECTIVELY ELIMINATED** - Only 1 specialized repository remains
- **Build Health:** ✅ **CLEAN** - TypeScript compilation successful, 0 errors
- **Domain Entities:** TODO - Placeholder structure exists, implementation pending
- **Value Objects:** TODO - Placeholder structure exists, implementation pending

### 🎯 **FUTURE DEVELOPMENT:**
- **Domain Entities**: Implement Project, Milestone, Group, Row entities with business methods
- **Value Objects**: Implement TimeAllocation, DateRange immutable types
- **Advanced Features**: Real-time updates, webhooks, notifications
- **Performance Monitoring**: Application metrics and analytics

### 🎉 **Key Achievements (October 21, 2025):**
- **Zero Breaking Changes**: Maintained throughout all architectural improvements
- **Production Stability**: All improvements verified through production builds (9.05s build time)
- **Single Source of Truth**: Achieved for types (core.ts) and business rules (domain/rules/)
- **Bold Simplification**: ~1,662 lines of wrapper code eliminated (validators + repositories)
- **Domain Rules**: 50+ business rule methods implemented across 4 rule modules (ProjectRules, MilestoneRules, TimelineRules, RelationshipRules)
- **Code Consolidation**: 18 duplicate type interfaces eliminated, 13 duplicate calculation functions eliminated
- **Architecture Clarity**: Validators layer eliminated, repository layer effectively eliminated
- **AI-Friendly Codebase**: Clear, direct data flow with no unnecessary wrapper layers
- **Architecture Guide**: Comprehensive documentation updated to reflect simplified state

## ️ Architectural Guardrails (Updated October 2025)

### Anti-Patterns to Avoid:
- ❌ **Creating validator files**: Layer eliminated, call domain rules directly
- ❌ **Creating repository wrappers**: Layer eliminated, call Supabase directly
- ❌ **Scattered calculations**: Same logic in multiple places
- ❌ **Component business logic**: Calculations in UI components
- ❌ **Deep import paths**: Direct service imports bypassing barrel
- ❌ **Inconsistent naming**: Not following `UnifiedXService` / `XOrchestrator` patterns
- ❌ **Mixed responsibilities**: Services doing multiple unrelated things
- ❌ **Validation bypass**: Hooks calling database without domain rule validation
- ❌ **Duplicate transformations**: Same transformation logic in multiple orchestrators

### Success Patterns:
- ✅ **Single source of truth**: Domain rules for business logic, types in core.ts
- ✅ **Clear layer separation**: Orchestrators (workflows) vs Unified Services (calculations)
- ✅ **Consistent imports**: All imports via `@/services` barrel
- ✅ **Predictable naming**: AI can find services following patterns
- ✅ **Inline validation**: Orchestrators call domain rules directly
- ✅ **Inline data access**: Orchestrators call Supabase directly
- ✅ **Inline transformations**: Private helper methods in orchestrators
- ✅ **Workflow coordination**: Complex operations properly orchestrated
- ✅ **Zero wrapper layers**: Direct, clear path from orchestrator to database

## 🚀 AI Implementation Guidelines (Updated October 2025)

### For Business Rules:
1. ✅ Add to existing domain rules module (`ProjectRules`, `MilestoneRules`, etc.)
2. ✅ Create new rule module if needed (new domain area)
3. ✅ Keep domain rules as single source of truth
4. ❌ Never duplicate business logic in components/hooks

### For Complex Workflows (CREATE/UPDATE/DELETE):
1. ✅ Use orchestrators (`ProjectOrchestrator`, `GroupOrchestrator`, etc.)
2. ✅ Call domain rules directly for validation (no validator layer)
3. ✅ Call Supabase directly for data access (no repository layer)
4. ✅ Add transformation helpers inline as private methods
5. ✅ Coordinate multi-step workflows in orchestrator methods
6. ❌ Don't create new validator files (eliminated layer)
7. ❌ Don't create new repository wrappers (eliminated layer)

### For Calculations & Queries (READ/TRANSFORM):
1. ✅ Use unified services (`UnifiedProjectService`, `UnifiedTimelineService`, etc.)
2. ✅ Add method to existing service or create new unified service
3. ✅ Extract pure calculations to `calculations/` layer
4. ✅ Keep calculations pure (no side effects)
5. ❌ Don't put calculations in orchestrators (orchestrators are for workflows)

### For UI Positioning & Layout:
1. ✅ Check existing UI services (`TimelinePositioning`, `CalendarLayout`)
2. ✅ Add to appropriate UI service or create new one
3. ✅ Keep UI logic separate from business logic
4. ✅ Ensure consistent positioning across views

### For Data Operations:
1. ✅ Call Supabase directly from orchestrators (inline)
2. ✅ Use hooks for React component data fetching
3. ✅ Add transformation helpers inline in orchestrators
4. ❌ Don't create new repository wrappers (layer eliminated)
5. ⚠️ Exception: Complex state management (like timeTrackingRepository) can remain

### Quick Decision Tree:
```
Need to CREATE/UPDATE/DELETE with validation?
  → Use Orchestrator (calls domain rules + Supabase directly)

Need to CALCULATE or TRANSFORM data?
  → Use Unified Service (pure functions)

Need to POSITION UI elements?
  → Use UI Service (pixel calculations)

Need to VALIDATE business rule?
  → Add to Domain Rules (single source of truth)

Need to FETCH data for React component?
  → Use Hook (thin Supabase wrapper)
```

---

## 🧹 Architecture Simplification Journey (October 2025)

### The Problem: Over-Engineered Wrapper Layers

**Before Simplification:**
- **Validators**: Thin wrappers around domain rules (redundant layer)
- **Repositories**: Thin wrappers around Supabase (hooks already existed for data access)
- **Result**: Multiple paths to database, validation inconsistently applied, AI confusion

**The Bold Decision:**
Eliminate wrapper layers entirely and move logic inline where it's actually used.

### Phase 1: Validator Cleanup ✅ (October 21, 2025)

**Files Deleted:**
- `CalendarEventValidator.ts` (442 lines) - Dead code, never called
- `timeTrackingValidator.ts` (227 lines) - Inlined into timeTrackingOrchestrator
- `ProjectValidator.ts` (670 lines) - Extracted to projectDataIntegrity.ts utility (175 lines)
- Entire `validators/` directory removed

**Files Modified:**
- `timeTrackingOrchestrator.ts` - Added 6 inline validation methods
- `TimelineView.tsx` - Updated import to use new utility

**Results:**
- ✅ 1,164 lines removed (87% reduction)
- ✅ Build successful (9.06s)
- ✅ TypeScript check clean
- ✅ Only actively-used logic preserved (175-line utility)

### Phase 2: Repository Cleanup ✅ (October 21, 2025)

**Files Deleted:**
- `GroupRepository.ts` (221 lines) - Pure Supabase wrapper
- `CalendarEventRepository.ts` (277 lines) - Pure Supabase wrapper

**Files Preserved:**
- `timeTrackingRepository.ts` (254 lines) - **KEPT** for complex state management (localStorage caching, date serialization, realtime subscriptions, cross-window sync)

**Files Modified:**
- `GroupOrchestrator.ts` - Added inline database helpers, replaced 8 repository calls with direct Supabase queries
- `timeTrackingOrchestrator.ts` - Added calendar event transformation helpers, replaced 7 repository calls with direct Supabase queries
- `src/services/repositories/index.ts` - Removed deleted exports, updated documentation

**Results:**
- ✅ 498 lines removed (99% of repository layer eliminated)
- ✅ Build successful (9.05s)
- ✅ TypeScript check clean
- ✅ Repository layer effectively eliminated (only 1 specialized repository remains)

### Total Impact: Phases 1 & 2

**Lines Removed:** ~1,662 lines of wrapper code  
**Layers Eliminated:** Validators (100%), Repositories (99%)  
**Architecture Change:**

```
BEFORE (Convoluted):
Component → Orchestrator → Validator → Domain Rules
                        → Repository → Supabase
Component → Hook → Supabase (bypassing validation!)

AFTER (Clear):
Component → Orchestrator (validates with domain rules) → Direct Supabase
Component → Hook → Supabase (simple queries only)
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

**Orchestrators** call domain rules directly:
```typescript
// orchestrators/ProjectOrchestrator.ts
import { ProjectRules } from '@/domain/rules/ProjectRules';

export class ProjectOrchestrator {
  static async executeProjectCreationWorkflow(request, context) {
    // Call domain rules directly (no validator layer)
    const validation = ProjectRules.validateProjectDates(request.startDate, request.endDate);
    if (!validation.isValid) return { success: false, errors: validation.errors };
    
    // Continue with workflow...
  }
}
```

### Benefits of Domain Layer

1. **Single Source of Truth** - All business rules in one place
2. **Consistency** - Rules applied uniformly across the app
3. **Maintainability** - Update rule in one place, changes propagate automatically
4. **Testability** - Domain logic isolated and easy to unit test
5. **Discoverability** - Clear folder structure, predictable naming
6. **Reliability** - Validation always applied, cannot bypass rules

### AI Development with Domain Layer

**When making changes:**
1. Check `docs/BUSINESS_LOGIC_REFERENCE.md` first
2. Understand the business rule being affected
3. Update domain rules in `src/domain/rules/` (✅ IMPLEMENTED)
4. For new business logic, add to appropriate rule module
5. Test at domain layer (unit tests can be added later)

**When debugging:**
1. Verify rule in Business Logic Reference
2. Check domain rules implementation (✅ AVAILABLE)
3. Trace through validation flow
4. Fix at domain rules level (single point of truth)

---

**This guide ensures AI develops consistent, maintainable code that follows the established architecture patterns and eliminates duplication.**
