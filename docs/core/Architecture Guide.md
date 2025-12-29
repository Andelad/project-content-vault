# 🏗️ AI-Optimized Services Architecture Guide

> **SINGLE SOURCE OF TRUTH** for AI development in this codebase. This guide reflects the actual services architecture and intended logic flow.

**Last Updated:** December 27, 2025  
**Repository Transition:** ✅ **COMPLETE** - All 34 build errors resolved, clean compilation achieved
**Terminology Update:** ✅ **IN PROGRESS** - Milestone → Phase migration (codebase partially updated)

## 🤖 AI Development Constraints

### NEVER Create These Patterns:
- ❌ File paths containing `/validators/` (layer eliminated)
- ❌ File paths containing `/repositories/` (layer eliminated, except timeTrackingRepository)
- ❌ Wrapper entities that just delegate to domain rules (no added value)
- ❌ Anemic domain models (data only, no behavior - use rich entities instead)
- ❌ Functions named `calculate*` in `/src/components/`
- ❌ Multiple files with same function names
- ❌ Business logic in components or hooks
- ❌ New validator wrapper files
- ❌ New repository wrappers (use Supabase directly or hooks)
- ❌ References to `MilestoneRules` (use `PhaseRules` instead)
- ❌ References to `UnifiedMilestoneService` (use `UnifiedPhaseService` instead)

### ALWAYS Follow These Patterns:
- ✅ Import from `@/services` only (barrel imports)
- ✅ Use rich domain entities from `/domain/entities/` that encapsulate business logic
- ✅ Put pure math in `calculations/`, business calculations in `unified/UnifiedXService.ts`
- ✅ Put complex workflows in `orchestrators/XOrchestrator.ts`
- ✅ Call domain rules or entity methods from orchestrators
- ✅ Call Supabase directly from orchestrators (no repository layer)
- ✅ Check existing functionality before creating new
- ✅ Use exact naming patterns: `UnifiedProjectService`, `ProjectOrchestrator`
- ✅ Follow the simplified flow: Components → Orchestrators (workflows) OR Unified Services (calculations) → Domain Entities/Rules → Direct Supabase

## 🗺️ Quick Reference Map

**Where does my code go?**
- **Business rules/validation** → `domain/rules/ProjectRules.ts` (shared logic)
- **Domain entities** → `domain/entities/Project.ts` (rich objects with behavior)
- **Workflows (CREATE/UPDATE/DELETE)** → `services/orchestrators/XOrchestrator.ts`
- **Business calculations** → `services/unified/UnifiedXService.ts`
- **Pure math (no business context)** → `services/calculations/general/`
- **UI positioning/pixels** → `services/ui/positioning/`
- **Type definitions** → `types/core.ts`
- **Display formatting** → `utils/dateFormatUtils.ts`
- **React data fetching** → `hooks/useX.ts`

## 🏛️ Architecture Philosophy: Hybrid DDD Approach

### Why Hybrid DDD?

This codebase follows a **Hybrid Domain-Driven Design (DDD)** approach—a pragmatic middle ground between:
- **Strict DDD**: Full layer separation, repository pattern, complete domain isolation (8-12 weeks to implement)
- **Pragmatic Mixing**: Application logic + UI concerns mixed freely (fast but maintenance heavy)

**Our Choice:** Hybrid DDD prioritizes **clear separation of concerns in documentation** while allowing **pragmatic mixing in code** for velocity.

---

### Three-Layer Documentation Model

**1. App Logic** (`App Logic.md`) - **WHAT** (Domain Truth)
- Defines core business concepts in plain English
- **100% UI-agnostic** - never references specific views or displays
- Defines entities, relationships, and universal rules
- Source of truth for "what exists" and "what can happen"

**2. Business Logic** (`Business Logic.md`) - **HOW** (Domain Calculations)
- Specifies calculation formulas and domain rules
- **UI-agnostic** - defines rules that apply universally
- Maps to domain code (`domain/rules/`, `services/calculations/`)
- Source of truth for "how things are calculated"

**3. View Specifications** (`View Specifications.md`) - **WHERE** (UI Constraints)
- Documents view-specific display rules and constraints
- **UI-specific** - explains why Timeline, Calendar, etc. behave differently
- Maps to UI code (`components/`, presentation logic in orchestrators)
- Source of truth for "how views display domain data"

**Example of Separation:**

| Concern | Layer | Example |
|---------|-------|---------|
| Time types coexist in domain | App Logic + Business Logic | "Projects have auto-estimated, planned, and completed time simultaneously" |
| Timeline can't show overlaps | View Specifications | "Timeline View displays only ONE time type per day (mutual exclusivity constraint)" |
| Auto-estimate calculation | Business Logic | "Auto-estimate = (Remaining Hours) ÷ (Days without events)" |
| Timeline bar visual style | View Specifications | "Auto-estimates shown with light color, no border" |

---

### Intentional Code Pragmatism

**Where We Mix Layers (By Design):**

**Orchestrators** (`services/orchestrators/`) intentionally mix:
- ✅ Application logic (workflows, coordination)
- ✅ Presentation concerns (preparing data for UI)
- ✅ Infrastructure calls (direct Supabase)

**Why:** Orchestrators are the "glue layer" between pure domain logic and UI needs. Forcing strict separation here creates:
- Extra abstraction layers with no value
- Repository wrappers that just delegate
- Anemic domain models (data-only)
- Development slowdown

**Trade-off:** Faster development, less boilerplate, BUT requires clear documentation to maintain architectural clarity.

**Where We Stay Pure:**

**Domain Rules** (`domain/rules/`) stay pure:
- ❌ NO UI references (no "timeline", "calendar", "view")
- ❌ NO presentation logic (no styling, no display decisions)
- ✅ ONLY universal business rules

**Domain Entities** (`domain/entities/`) stay rich:
- ✅ Encapsulate business logic (not just data)
- ✅ Validate on construction
- ❌ NO UI concerns

---

### Orchestrator Scope (Intentionally Mixed)

**What Orchestrators Can Do:**

```typescript
// ✅ ALLOWED - Application Logic
async createProject(data: ProjectInput): Promise<Project> {
  // 1. Call domain validation
  const validation = ProjectRules.validate(data);
  
  // 2. Call Supabase directly (no repository)
  const result = await supabase.from('projects').insert(data);
  
  // 3. Prepare data for UI (presentation concern)
  const enriched = this.enrichProjectForDisplay(result);
  
  // 4. Handle side effects (workflow logic)
  await this.notifyProjectCreated(enriched);
  
  return enriched;
}
```

**What Orchestrators Cannot Do:**

```typescript
// ❌ FORBIDDEN - Business Rule Logic
// This belongs in domain/rules/ProjectRules.ts
calculateRemainingHours(project: Project): number {
  return project.estimatedHours - project.completedHours; // NO!
}
```

**Rule of Thumb:**

- **Domain rules** = universal truths (same in all views, same for all users)
- **Orchestrators** = workflows + view prep (coordination, enrichment, side effects)

---

### Migration Path (When Needed)

If the codebase grows and mixing becomes painful:

**Phase 1** (Current): Hybrid DDD with clear docs
- Domain logic in rules/entities ✅
- Orchestrators mix freely (documented) ✅
- No repository layer ✅

**Phase 2** (Future): Strict DDD
- Add repository layer
- Extract presentation logic from orchestrators
- Create application services layer
- Estimated effort: 8-12 weeks

**Current Decision:** Stay in Phase 1 until pain points emerge.

---

## 📚 DOCUMENTATION UPDATE FLOW

When business requirements or logic changes, update documentation in this order:

### 1. App Logic (WHAT - Plain English)
**File:** `docs/core/App Logic.md`

**Update when:**
- Business rules change
- Entities or relationships change
- Validation requirements change
- Resolving [CLARIFY] decisions

**What to update:**
- Plain-English description of the rule
- Entity definitions if changed
- Business rules section
- Edge cases if discovered
- Version number in changelog

**Example:**
```markdown
### Rule 5: Phase Continuity
**Decision:** Gaps between phases ARE allowed (Option B)
**Reasoning:** Provides flexibility for planning uncertainty
**Decided:** December 26, 2025
```

---

### 2. Business Logic (WHAT - Detailed)
**File:** `docs/core/Business Logic.md`

**Update when:**
- Adding new business rule methods
- Changing existing rule behavior
- Documenting calculation details

**What to update:**
- Method signatures
- Detailed rule specifications
- Cross-references to App Logic
- Usage examples

**Example:**
```markdown
### Phase Validation Rules

validatePhases(phases: Phase[]): ValidationResult
- Checks for overlaps (not allowed)
- Does NOT check for gaps (allowed per App Logic Edge Case 2)
- Returns detailed validation errors
```

---

### 3. Domain Rules (HOW - Implementation)
**File:** `src/domain/rules/*.ts`

**Update when:**
- Implementing logic changes from specs above
- Adding new validation methods
- Changing calculation logic

**What to update:**
- Implementation code
- JSDoc with `@see` reference to App Logic
- Type definitions if needed

**Example:**
```typescript
/**
 * Validates phases for a project.
 * 
 * @see docs/core/App Logic.md - Part 4, Rules 5 & 6
 * 
 * Checks:
 * - No overlaps (Rule 6 - enforced)
 * - Gaps allowed (Rule 5 - Edge Case 2 resolved)
 * 
 * @param phases - All phases to validate
 * @returns Validation result with any errors
 */
export function validatePhases(phases: Phase[]): ValidationResult {
  // Implementation
}
```

---

### 4. Orchestrators (WHEN - Workflow Enforcement)
**File:** `src/services/orchestrators/*.ts`

**Update when:**
- Workflows need to use updated rules
- Error handling changes
- Validation sequence changes

**What to update:**
- Calls to updated domain rules
- Error messages
- Workflow logic

---

### 5. Tests
**Files:** Test files corresponding to changes

**Update when:**
- Any of the above changes
- New behavior needs coverage
- Edge cases discovered

**What to update:**
- Add tests for new behavior
- Update tests for changed behavior
- Ensure edge cases covered

---

### 📊 Documentation Hierarchy

```
App Logic.md (WHAT - Plain English)
    ↓ defines requirements
Business Logic.md (WHAT - Detailed)
    ↓ specifies implementation
Domain Rules (HOW - Code)
    ↓ implements logic
Orchestrators (WHEN - Workflows)
    ↓ enforces rules
UI Components (WHERE - Display)
    ↓ shows results
```

All changes flow top-down. App Logic is the source of truth.

---

## �️ Domain Layer Architecture (Updated December 2025)

### Domain Entities (`/domain/entities/`)

**Purpose:** Rich domain models that encapsulate business logic and enforce invariants.

**Characteristics:**
- Cannot be created in invalid state (factory methods validate)
- Encapsulate business behavior (not just data)
- Map directly to App Logic entity definitions
- Provide discoverable API for operations

**When to use:**
- Creating or modifying core business objects (Project, Client, Phase, etc.)
- Need to enforce business rules at construction
- Want to prevent invalid states
- Business logic naturally belongs to a single entity

**Pattern:**
```typescript
// Factory method - enforces validation
const result = Project.create({
  name: "Website Redesign",
  clientId: client.id,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-03-31'),
  estimatedHours: 120,
  groupId: group.id,
  color: '#FF5733',
  userId: user.id
});

if (!result.success) {
  // result.errors contains validation errors
  console.error(result.errors);
  return;
}

const project = result.data;

// Business operations with built-in validation
const updateResult = project.updateDates(newStart, newEnd);
if (updateResult.success) {
  project.convertToContinuous();
}

// Query methods
const isActive = project.isActiveOnDate(today);
const duration = project.getDurationDays();
const allocation = project.getDailyAllocationHours();

// Convert for database persistence
const projectData = project.toData();
```

**Available Entities:**
- ✅ `Project` - Complete with validation and business methods
- 🚧 `Client` - Planned (Phase 1)
- 🚧 `Phase` - Planned (Phase 1)
- 🚧 `Group` - Planned (Phase 2)
- 🚧 `Label` - Planned (Phase 2)
- 🚧 `CalendarEvent` - Planned (Phase 2)

### Domain Rules (`/domain/rules/`)

**Purpose:** Shared business rules and complex validation logic used by multiple entities.

**Characteristics:**
- Static methods (no state)
- Pure validation and calculation functions
- Used internally by entities
- Used by orchestrators for cross-entity validation

**When to use:**
- Validation logic spans multiple entities
- Complex calculations needed by multiple parts of the system
- Shared business constraints
- Cross-entity relationship validation

**Pattern:**
```typescript
// Used by entities internally
class Project {
  getBudgetAnalysis() {
    return ProjectRules.analyzeBudget(this.toData(), this.phases);
  }
}

// Used by orchestrators for cross-entity validation
const relationshipCheck = RelationshipRules.validateProjectPhases(project, phases);
if (!relationshipCheck.isValid) {
  return { success: false, errors: relationshipCheck.errors };
}
```

### Key Distinction

| Aspect | Domain Entities | Domain Rules |
|--------|----------------|--------------|
| **What** | Rich objects with state + behavior | Static validation functions |
| **Scope** | Single entity (Project, Client) | Cross-entity or shared logic |
| **State** | Has mutable state | Stateless (pure functions) |
| **Usage** | `const p = Project.create(...)` | `ProjectRules.validate(...)` |
| **Example** | `project.updateDates()` | `RelationshipRules.validateProjectPhases()` |

### Integration with Existing Patterns

**Orchestrators use entities:**
```typescript
// Before (functional approach)
const validation = ProjectRules.validateProjectDates(startDate, endDate);
if (!validation.isValid) return { success: false };
const { data } = await supabase.from('projects').insert(projectData);

// After (entity approach)
const projectResult = Project.create({ name, clientId, ... });
if (!projectResult.success) return projectResult;
const { data } = await supabase.from('projects').insert(projectResult.data.toData());
```

**Unified Services can use entities:**
```typescript
// Approach 1: Keep functional
static calculateDuration(startDate: Date, endDate: Date): number {
  return calculateDurationDays(startDate, endDate);
}

// Approach 2: Accept entity or data
static calculateDuration(projectOrData: Project | ProjectData): number {
  const project = projectOrData instanceof Project 
    ? projectOrData 
    : Project.fromDatabase(projectOrData);
  return project.getDurationDays() ?? 0;
}
```

**Hooks can return entities:**
```typescript
const { data: projects } = useQuery({
  queryKey: ['projects'],
  queryFn: async () => {
    const { data } = await supabase.from('projects').select('*');
    return data?.map(p => Project.fromDatabase(p)) ?? [];
  }
});

// Components use entity methods
projects.forEach(project => {
  if (project.isActiveOnDate(today)) {
    console.log(project.getDurationDays());
  }
});
```

---

## 🎯 Services Architecture Pattern (Simplified - October 2025, Updated December 2025)

### Core Logic Flow (Current):
```
Components/Hooks → Orchestrators (workflows) → Domain Rules + Direct Supabase
                → Unified Services (business calcs) → calculations/ (pure math) + Domain Rules  
                → Hooks (simple queries) → Direct Supabase
```

**Key Distinctions:**
- **Orchestrators**: CREATE/UPDATE/DELETE workflows with side effects
- **Unified Services**: Business calculations (READ-only, calls `calculations/` + domain rules)
- **calculations/**: Pure math functions (no business context, no side effects)
- **Hooks**: Simple data fetching (thin Supabase wrappers)

### Directory Structure (Current - October 26, 2025):

**Core Directories:**
```
src/
├── domain/rules/                # ⭐ Business rules (validation, constraints)
├── services/
│   ├── orchestrators/          # Workflows (CREATE/UPDATE/DELETE)
│   ├── unified/                # Business calculations (READ/TRANSFORM)
│   ├── calculations/           # Pure math (no business context)
│   └── ui/positioning/         # UI positioning (pixels, viewport)
├── types/core.ts               # All domain type definitions
└── utils/                      # Framework utilities (formatting only)
```

<details>
<summary>Full Directory Structure (click to expand)</summary>

```
src/
├── domain/                      # ⭐ Business Logic Layer (Single Source of Truth)
│   ├── entities/                # TODO: Domain entities with business rules
│   ├── rules/                   # ✅ Centralized business rules (50+ methods)
│   │   ├── ProjectRules.ts      # Project validation and constraints
│   │   ├── PhaseRules.ts      # Phase validation and budget rules
│   │   ├── MilestoneRules.ts  # ⚠️ LEGACY - To be migrated to PhaseRules
│   │   ├── TimelineRules.ts     # Timeline and scheduling rules
│   │   └── RelationshipRules.ts # Cross-entity relationship rules
│   ├── value-objects/           # TODO: Immutable value types
│   └── index.ts
├── services/
│   ├── unified/                 # ✅ Main API - Calculations & transformations
│   │   ├── UnifiedProjectService.ts
│   │   ├── UnifiedTimelineService.ts
│   │   ├── UnifiedPhaseService.ts
│   │   ├── UnifiedMilestoneService.ts # ⚠️ LEGACY - To be migrated to UnifiedPhaseService
│   │   └── ... (other unified services)
│   ├── orchestrators/           # ✅ Workflow coordination (9 files)
│   │   ├── ProjectOrchestrator.ts         # Project workflows
│   │   ├── ProjectPhaseOrchestrator.ts # Phase workflows
│   │   ├── ProjectMilestoneOrchestrator.ts # ⚠️ LEGACY - To be migrated to ProjectPhaseOrchestrator
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
</details>

**Current State:**
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
import type { Project, Phase, CalendarEvent } from '@/types/core';

// ✅ CORRECT - Extend core types for specific use cases
interface ProjectEvent extends Pick<CalendarEvent, 'id' | 'startTime' | 'endTime'> {
  projectId: string; // Add required field for domain use
}

// ✅ CORRECT - Flexible backward compatibility
export type FlexiblePhase = Phase & {
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
- **Project**: Main project entity with status, phases, scheduling
- **Phase**: Project phase with time allocation and ordering
- **CalendarEvent**: Events with recurring patterns and completion tracking
- **Group/Row**: Project organization and layout structure
- **Holiday**: Calendar holidays with regional support
- **WorkHour**: Time tracking and work session management

### Component-Specific Types:
Components may define **Props**, **Config**, and **Local** interfaces that extend core types:
```typescript
// ✅ ALLOWED - Component-specific extensions
interface LocalPhase extends Omit<Phase, 'id'> {
  id?: string;
  isNew?: boolean;
}

interface ProjectModalProps {
  project?: Project; // References core type
  onSave: (project: Project) => void; // References core type
}
```

**When to extend types in components:**
- ✅ Component needs temporary fields (isNew, isEditing, isSelected)
- ✅ Component props that aren't persisted to database
- ✅ UI state that doesn't belong in domain model
- ❌ Don't extend to add business logic or calculations
- ❌ Don't extend to add database fields (add to core.ts instead)

## 📋 AI Decision Matrix (Updated October 2025)

| User Request | Code Type | Exact Location | Pattern |
|--------------|-----------|----------------|---------|
| ⭐ "define business rule" | **Business rule** | `domain/rules/ProjectRules.ts` | `static validateX()` |
| ⭐ "check if valid" | **Business rule** | `domain/rules/` | Reference business rules |
| "calculate project duration" | Pure data math | `calculations/general/dateCalculations.ts` | Pure function (date math) |
| "validate phase budget" | **Inline validation** | `orchestrators/ProjectOrchestrator.ts` | Call `PhaseRules.checkBudget()` directly |
| "position timeline bar" | UI positioning | `ui/positioning/TimelinePositioning.ts` | `static calculateBarPosition()` |
| "handle drag operation" | UI math | `ui/positioning/DragPositioning.ts` | Mouse→pixel→date conversion |
| "coordinate project creation" | Workflow | `orchestrators/ProjectOrchestrator.ts` | `async executeProjectCreationWorkflow()` |
| "save project data" | **Direct DB access** | **Inline in orchestrator** | `supabase.from('projects').insert()` |
| "transform database data" | **Inline helper** | **Inline in orchestrator** | Private `transformFromDatabase()` method |
| "define project type" | Type definition | `types/core.ts` | `export interface Project` |
| "extend project for component" | Component type | Component file | `interface LocalProject extends Project` |
| "create project subset" | Service type | Service file | `Pick<Project, 'id' \| 'name'>` |
| "calculate & transform data" | Calculation service | `unified/UnifiedProjectService.ts` | Pure calculation functions |

### Calculation Layer Decision Rule:
**When adding calculation logic, ask: "Does this need business context?"**

- **Pure math** (date arithmetic, number operations, NO business rules) → `calculations/`
  - Example: `calculateDaysBetween(start, end)` → Just date math
  - Example: `calculatePercentage(value, total)` → Just math
  - Rule: Could run on server with zero business knowledge
  
- **Business calculations** (uses domain rules, multiple calculations, transformations) → `unified/`
  - Example: `calculateProjectBudgetStatus(project, phases)` → Uses PhaseRules + pure math
  - Example: `calculateWorkingDays(dates, holidays, settings)` → Combines data + business rules
  - Rule: Requires understanding of your business domain

**Flow**: `unified/` services CALL `calculations/` functions + apply domain rules

**Key Changes:**
- ❌ No more validators layer - call domain rules directly
- ❌ No more repositories layer - call Supabase directly or use hooks
- ✅ Orchestrators handle validation + data access inline
- ✅ Transformation helpers inline in orchestrators (private methods)

---

## 🎭 Orchestrator Patterns & Best Practices

### Orchestrator Responsibilities (Hybrid DDD)

**What Orchestrators SHOULD Do:**
```typescript
class ProjectOrchestrator {
  // ✅ Coordinate workflows (application logic)
  async createProject(data: CreateProjectInput): Promise<Result<Project>> {
    // ✅ Call domain validation
    const validation = ProjectRules.validateCreate(data);
    if (!validation.isValid) return failure(validation.errors);
    
    // ✅ Transform for database (presentation concern - allowed in hybrid)
    const dbData = this.transformForDatabase(data);
    
    // ✅ Direct database access (no repository layer)
    const { data: project, error } = await supabase
      .from('projects')
      .insert(dbData)
      .select()
      .single();
    
    if (error) return failure([error.message]);
    
    // ✅ Enrich for UI (presentation concern - allowed in hybrid)
    const enriched = this.enrichProjectForDisplay(project);
    
    // ✅ Trigger side effects (workflow coordination)
    await this.notifyProjectCreated(enriched);
    await this.updateRelatedEntities(enriched);
    
    return success(enriched);
  }
  
  // ✅ Private helpers for presentation (allowed in hybrid)
  private transformForDatabase(input: CreateProjectInput) {
    return {
      ...input,
      created_at: new Date().toISOString(),
      color: normalizeProjectColor(input.color), // UI concern
    };
  }
  
  // ✅ Enrich data for display (allowed in hybrid)
  private enrichProjectForDisplay(project: DbProject): Project {
    return {
      ...project,
      displayColor: this.getDisplayColor(project.color), // UI concern
      formattedDates: this.formatDatesForUI(project), // UI concern
    };
  }
}
```

**What Orchestrators MUST NOT Do:**
```typescript
class ProjectOrchestrator {
  // ❌ FORBIDDEN - Business rule logic (belongs in domain/rules/)
  private calculateRemainingHours(project: Project): number {
    return project.estimatedHours - project.completedHours; // NO!
  }
  
  // ❌ FORBIDDEN - Domain validation logic (belongs in ProjectRules)
  private validateProjectDates(start: Date, end: Date): boolean {
    return end > start; // NO! Call ProjectRules.validateDates()
  }
  
  // ❌ FORBIDDEN - Complex calculation (belongs in UnifiedProjectService)
  private calculateProjectMetrics(project: Project): Metrics {
    // Multi-step calculations belong in unified services
    const budget = ...; // NO!
    const progress = ...; // NO!
    return { budget, progress };
  }
}
```

### JSDoc Examples for Orchestrators

**Template for Orchestrator Methods:**
```typescript
/**
 * Creates a new project with validation and side effects.
 * 
 * HYBRID DDD SCOPE:
 * - Validates via ProjectRules (domain)
 * - Transforms data for database (presentation - allowed)
 * - Calls Supabase directly (no repository layer)
 * - Enriches for UI display (presentation - allowed)
 * - Coordinates side effects (workflow logic)
 * 
 * @param data - Project creation input
 * @returns Result with created project or validation errors
 * 
 * @example
 * const result = await ProjectOrchestrator.createProject({
 *   name: "Website Redesign",
 *   clientId: "client-123",
 *   startDate: new Date(),
 *   endDate: addMonths(new Date(), 3)
 * });
 * 
 * if (result.success) {
 *   console.log('Project created:', result.data);
 * }
 */
async createProject(data: CreateProjectInput): Promise<Result<Project>>
```

### Orchestrator Organization Patterns

**File Structure:**
```typescript
// src/services/orchestrators/ProjectOrchestrator.ts
import { supabase } from '@/integrations/supabase';
import { ProjectRules } from '@/domain/rules/ProjectRules';
import { UnifiedProjectService } from '@/services/unified/UnifiedProjectService';
import type { Project, CreateProjectInput } from '@/types/core';

export class ProjectOrchestrator {
  // Public workflow methods (CREATE/UPDATE/DELETE)
  static async createProject(...) { }
  static async updateProject(...) { }
  static async deleteProject(...) { }
  
  // Private transformation helpers (presentation layer - allowed)
  private static transformForDatabase(...) { }
  private static enrichForDisplay(...) { }
  
  // Private coordination helpers (workflow logic)
  private static notifyCreated(...) { }
  private static updateRelatedEntities(...) { }
}
```

### Common Orchestrator Anti-Patterns

**Anti-Pattern 1: Business Logic in Orchestrator**
```typescript
// ❌ BAD - Validation logic in orchestrator
async createProject(data: CreateProjectInput) {
  if (!data.name || data.name.length < 3) { // Domain rule!
    return failure(['Name must be at least 3 characters']);
  }
  // ...
}

// ✅ GOOD - Call domain rules
async createProject(data: CreateProjectInput) {
  const validation = ProjectRules.validateCreate(data);
  if (!validation.isValid) return failure(validation.errors);
  // ...
}
```

**Anti-Pattern 2: Calculations in Orchestrator**
```typescript
// ❌ BAD - Complex calculation in orchestrator
async updateProject(id: string, updates: Partial<Project>) {
  const project = await this.getProject(id);
  const remainingHours = project.estimatedHours - project.completedHours; // NO!
  const progress = (project.completedHours / project.estimatedHours) * 100; // NO!
  // ...
}

// ✅ GOOD - Use unified services for calculations
async updateProject(id: string, updates: Partial<Project>) {
  const project = await this.getProject(id);
  const metrics = UnifiedProjectService.calculateMetrics(project); // YES!
  // ...
}
```

**Anti-Pattern 3: UI Logic in Orchestrator (Beyond Preparation)**
```typescript
// ❌ BAD - Timeline-specific display logic
async createProject(data: CreateProjectInput) {
  const project = await supabase.from('projects').insert(data);
  
  // Timeline mutual exclusivity logic - belongs in View Specifications!
  if (project.hasEvents) {
    project.hideAutoEstimates = true; // NO! UI constraint, not domain rule
  }
  return project;
}

// ✅ GOOD - Only prepare data, let views handle display
async createProject(data: CreateProjectInput) {
  const project = await supabase.from('projects').insert(data);
  
  // Just fetch related data for UI to use
  const events = await this.getProjectEvents(project.id);
  
  return { ...project, events }; // View decides what to show
}
```

---

## 🚫 Utils/Lib Rules
- ❌ No more repositories layer - call Supabase directly or use hooks
- ✅ Orchestrators handle validation + data access inline
- ✅ Transformation helpers inline in orchestrators (private methods)

## 🚫 Utils/Lib Rules

### ✅ Allowed Utils/Lib:
- Framework utilities (shadcn className merging)
- Pure formatting (currency, date display)
- Generic algorithms (debounce, throttle)
- **Legacy format migrations** (pure transformations with no side effects)

### ❌ Forbidden Utils/Lib:
- Business calculations
- Domain-specific logic
- Application workflows  
- Project/phase/work-hour logic

### Examples:
```typescript
// ✅ ALLOWED in utils/
export function cn(...classes: string[]): string // Framework utility
export function formatCurrency(amount: number): string // Pure formatting
export function debounce<T>(fn: T, delay: number): T // Generic algorithm
export function normalizeProjectColor(color: string): string // Legacy format migration

// ❌ FORBIDDEN in utils/ - Must go in services/
export function calculateProjectDuration() // Business calculation
export function validatePhase() // Domain logic
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

## 📐 Calculations vs UI Separation

**Key Principle**: Separate **data mathematics** from **visual mathematics**

**Calculations Layer (Pure Data Math)**:
- **Decision Rule**: "Could this run on a server with no UI?" → Put in `calculations/`
- ❌ **Never contains**: Pixels, viewport, mouse coordinates, screen positions

**UI Layer (Visual Math)**:
- **Decision Rule**: "Does this involve screen rendering?" → Put in `ui/positioning/`
- ✅ **Can use**: Pixels, DOM concepts, mouse events, screen dimensions

**Example**:
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

### AI Safety Checks:
- [ ] No duplicate functionality created
- [ ] Business logic not in components
- [ ] Imports use barrel pattern `@/services`
- [ ] Proper service layer selected
- [ ] UI positioning uses dedicated UI services
- [ ] Types reference `core.ts` single source of truth
- [ ] No duplicate type definitions outside of core.ts

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
1. ✅ Add to existing domain rules module (`ProjectRules`, `PhaseRules`, etc.)
2. ✅ Create new rule module if needed (new domain area)
3. ✅ Keep domain rules as single source of truth
4. ❌ Never duplicate business logic in components/hooks
5. ⚠️ **MIGRATION:** Replace `MilestoneRules` imports with `PhaseRules` (terminology update in progress)

### For Complex Workflows (CREATE/UPDATE/DELETE):
1. ✅ Use orchestrators (`ProjectOrchestrator`, `GroupOrchestrator`, etc.)
2. ✅ Call domain rules directly for validation (no validator layer)
3. ✅ Call Supabase directly for data access (no repository layer)
4. ✅ Add transformation helpers inline as private methods
5. ✅ Coordinate multi-step workflows in orchestrator methods
6. ❌ Don't create new validator files (eliminated layer)
7. ❌ Don't create new repository wrappers (eliminated layer)

### For Calculations & Queries (READ/TRANSFORM):
1. ✅ Pure math goes in `calculations/` layer (date arithmetic, percentages, etc.)
2. ✅ Business calculations go in `unified/` services (combines pure math + domain rules)
3. ✅ Unified services should CALL `calculations/` functions, not duplicate math
4. ✅ Keep calculations pure (no side effects)
5. ❌ Don't put calculations in orchestrators (orchestrators are for workflows)
6. ❌ Don't duplicate math logic - pure calculations belong in `calculations/` only

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

Need PURE MATH (no business context)?
  → Use calculations/ layer (date math, percentages, pure functions)

Need BUSINESS CALCULATION (combines math + rules)?
  → Use Unified Service (calls calculations/ + domain rules)

Need to POSITION UI elements?
  → Use UI Service (pixel calculations)

Need to VALIDATE business rule?
  → Add to Domain Rules (single source of truth)

Need to FETCH data for React component?
  → Use Hook (thin Supabase wrapper)
```

---

## 🎯 Domain Layer - Business Logic Single Source of Truth

### Purpose
The domain layer is the **single source of truth** for all business logic, rules, relationships, and constraints. It sits at the heart of the architecture and is referenced by all other layers.

### Key Documents
- **Business Logic Reference**: `docs/core/Business Logic.md` - Complete specification of all rules
- **Business Logic Audit**: `docs/core/BUSINESS_LOGIC_AUDIT.md` - Current state analysis

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

### AI Development with Domain Layer

**When making changes:**
1. Check `docs/core/Business Logic.md` first
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

## 🆕 When to Create New Files vs Extend Existing

### Adding New Methods:
**Add to existing file when:**
- ✅ Logic relates to same entity (add to `ProjectOrchestrator` for project workflows)
- ✅ Uses same dependencies
- ✅ File is under 500 lines

**Create new file when:**
- ✅ File exceeds 500 lines (split by responsibility)
- ✅ New domain area (e.g., `InvoiceOrchestrator` for billing feature)
- ✅ Different dependencies/concerns

### Splitting Large Files:
```typescript
// ❌ BEFORE: ProjectOrchestrator.ts (800 lines)
class ProjectOrchestrator {
  static async createProject() { }
  static async updateProject() { }
  static async deleteProject() { }
  static async createPhase() { }
  static async updatePhase() { }
  static async deletePhase() { }
}

// ✅ AFTER: Split by entity
// ProjectOrchestrator.ts (400 lines)
class ProjectOrchestrator {
  static async createProject() { }
  static async updateProject() { }
  static async deleteProject() { }
}

// ProjectPhaseOrchestrator.ts (400 lines)
class ProjectPhaseOrchestrator {
  static async createPhase() { }
  static async updatePhase() { }
  static async deletePhase() { }
}
```

## ⚠️ Error Handling Patterns

### Validation Errors:
```typescript
// ✅ Domain rules return structured errors
const result = ProjectRules.validateProjectDates(startDate, endDate);
if (!result.isValid) {
  return { success: false, errors: result.errors }; // Return to caller
}
```

### Database Errors:
```typescript
// ✅ Orchestrators handle database errors
try {
  const { data, error } = await supabase.from('projects').insert(project);
  if (error) throw error;
  return { success: true, data };
} catch (error) {
  console.error('Project creation failed:', error);
  return { success: false, error: error.message };
}
```

### Where error handling goes:
- **Validation errors** → Domain rules (return structured ValidationResult)
- **Database errors** → Orchestrators (try/catch, return success/error object)
- **UI errors** → Components (display error messages from orchestrator response)
- ❌ **Never**: Silent failures or generic error messages

---

**This guide ensures AI develops consistent, maintainable code that follows the established architecture patterns and eliminates duplication.**
