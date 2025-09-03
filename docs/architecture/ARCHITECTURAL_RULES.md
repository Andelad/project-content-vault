# 🏗️ Development Architecture Rules

## **🤖 AI Development Guard Rails**

> **CRITICAL**: These constraints MUST be followed by all AI assistants. Violations break architectural integrity.

### **🚫 Forbidden Patterns (DO NOT CREATE)**

| Pattern | Why Forbidden | Detection |
|---------|----   grep -r "calculateDuration\|formatDuration\|calculateHours" src/services/
   
   # Search for specific calculation patterns
   grep -r "getTime.*getTime\|reduce.*sum\|Math\." src/services/
   ```-------|
| **`utils/` folders** | Creates loose coupling, unclear ownership | Any folder named `utils` |
| **`helpers/` folders** | Same as utils - use proper domain services | Any folder named `helpers` |
| **Direct service imports** | Bypasses barrel exports, breaks modularity | `import from '@/services/domain/ServiceName'` |
| **Duplicate functions** | Code duplication, maintenance burden | Same function name in multiple files |
| **Mixed responsibility files** | Violates SRP, creates tight coupling | File doing > 1 domain concern |
| **Orphaned legacy files** | Technical debt accumulation | Files not imported anywhere |

### **✅ Mandatory AI Workflows**

#### **Before Creating New Code**
1. **Check existing services**: Use `semantic_search` for similar functionality
2. **Verify domain boundaries**: Ensure feature fits existing structure  
3. **Plan barrel exports**: All services MUST export through `@/services`
4. **Legacy migration**: Move old files to `legacy/` folders

#### **When Adding Features**
1. **Use domain-driven structure**: `{domain}/{Orchestrator|Repository|Validator}.ts`
2. **Single responsibility files**: One class/function per file
3. **Proper imports**: Always use main `@/services` barrel import
4. **Update index.ts**: Add all new exports to main services barrel

### **📋 Quick Reference Tables**

#### **Where Does This Code Go?**
| Code Type | Location | Example |
|-----------|----------|---------|
| **Business Rules** | `core/domain/` | `ProjectEntity.validateBudget()`, `MilestoneEntity.wouldExceedBudget()` |
| **Pure Math** | `core/calculations/` | `calculateDuration()`, `computeOverlap()`, `calculateBudgetUtilization()` |
| **Business Logic** | `unified/` | `UnifiedProjectService.createWithValidation()` |
| **Workflow Coordination** | `orchestrators/` | `ProjectWorkflowOrchestrator.createWithMilestones()` |
| **Complex Validation** | `validators/` (when needed) | `CrossDomainValidator.validateConsistency()` |
| **Complex Data Access** | `repositories/` (when needed) | `ProjectRepository.getWithOptimizedMilestones()` |
| **Legacy Code** | `legacy/` | `oldMilestoneService.ts` (temporary) |

#### **Import Patterns Checklist**
```typescript
// ✅ CORRECT - Use main services barrel
import { ProjectOrchestrator, CacheService } from '@/services';

// ❌ WRONG - Direct service imports
import { ProjectOrchestrator } from '@/services/projects/ProjectOrchestrator';
import { CacheService } from '@/services/core/infrastructure/CacheService';

// ❌ WRONG - Sub-barrel imports  
import { ProjectOrchestrator } from '@/services/projects';
import { CacheService } from '@/services/core';
```

### **🎯 AI Constraint Enforcement**

**Before ANY code changes:**
- [ ] Searched for existing similar functionality
- [ ] Verified proper domain placement  
- [ ] Planned barrel export structure
- [ ] Identified legacy migration needs

**Red flags requiring human review:**
- Creating new folder structures
- Adding duplicate-looking functionality  
- Modifying core service exports
- Large refactoring operations

---

## **🏢 AI-Optimized Unified Services Architecture**
**Single source of truth pattern - optimized for AI development collaboration:**

```
src/services/
├── core/                        # Foundation layers (always required)
│   ├── calculations/            # Pure mathematical functions (no dependencies)
│   │   ├── budgetCalculations.ts
│   │   ├── timeCalculations.ts
│   │   └── dateCalculations.ts
│   └── domain/                  # Domain entities - business rules (SINGLE SOURCE OF TRUTH)
│       ├── ProjectEntity.ts     # All project business rules HERE
│       ├── MilestoneEntity.ts   # All milestone business rules HERE
│       ├── WorkHourEntity.ts    # All work hour business rules HERE
│       └── EventEntity.ts       # All event business rules HERE
├── unified/                     # Business logic consolidation (always required)
│   ├── UnifiedProjectService.ts
│   ├── UnifiedMilestoneService.ts
│   ├── UnifiedWorkHourService.ts
│   └── UnifiedEventService.ts
├── orchestrators/               # Workflow coordination (always required)
│   ├── ProjectWorkflowOrchestrator.ts
│   ├── MilestoneWorkflowOrchestrator.ts
│   └── TimelineWorkflowOrchestrator.ts
├── validators/                  # Complex validation (add when needed)
│   ├── ProjectValidator.ts
│   ├── MilestoneValidator.ts
│   └── CrossDomainValidator.ts
├── repositories/                # Data access patterns (add when needed)
│   ├── ProjectRepository.ts
│   ├── MilestoneRepository.ts
│   └── TimelineRepository.ts
├── legacy/                      # Migration safety (temporary)
│   └── {existing services - DELETE AFTER MIGRATION}
└── index.ts                     # Clean exports organized by layer
```

**Logic behind this structure:**
- **Core**: Foundation layers that all other services depend on
- **Domain Entities**: Single source of truth for business rules (prevents AI confusion)
- **Calculations**: Pure mathematical functions (easily testable, cacheable, reusable)
- **Unified**: Business logic consolidation (orchestrates domain entities + calculations)
- **Orchestrators**: Workflow coordination across domains (uses unified services)
- **Validators**: Complex validation logic (add when domain rules aren't sufficient)
- **Repositories**: Data access patterns (add when simple data access isn't sufficient)
- **Legacy**: Safe migration path (maintain backward compatibility)

### **🤖 AI Development Optimization**

**Why "Single Source of Truth" is Critical for AI:**
- ✅ **Prevents AI confusion** - Clear, unambiguous places for each concern
- ✅ **Reduces duplication errors** - AI knows exactly where existing functions live
- ✅ **Consistent patterns** - AI can reliably follow the same organizational rules  
- ✅ **Easy validation** - AI can easily check if functionality already exists
- ✅ **Clear import paths** - AI knows exactly what to import from where

**AI Anti-Patterns to Avoid:**
- ❌ **Scattered similar functions** - AI can't tell which one to use
- ❌ **Inconsistent naming patterns** - AI mixes up similar-sounding services
- ❌ **Deep nested structures** - AI loses context navigating folders
- ❌ **Unclear responsibilities** - AI doesn't know which layer handles what

### **📊 When to Add Each Layer**

| Layer | Required | Add When... | Example Use Case |
|-------|----------|-------------|------------------|
| **Core/Domain** | ✅ Always | - | `ProjectEntity.validateBudget()`, `MilestoneEntity.wouldExceedBudget()` |
| **Core/Calculations** | ✅ Always | - | `calculateDuration()`, `computeOverlap()`, `calculateBudgetUtilization()` |
| **Unified Services** | ✅ Always | - | `UnifiedProjectService.createWithValidation()` |
| **Orchestrators** | ✅ Always | - | `ProjectWorkflowOrchestrator.createWithMilestones()` |
| **Validators** | ⚠️ When needed | Complex business rules | Cross-domain validation, intricate rule sets |
| **Repositories** | ⚠️ When needed | Complex data access | Multiple data sources, sophisticated caching |

### **🎯 Layer Hierarchy & Dependencies**

```
┌─────────────────┐
│  Orchestrators  │  ← Coordinates workflows, uses unified services
└─────────────────┘
         ↓
┌─────────────────┐
│ Unified Services│  ← Business logic consolidation, uses domain + calculations  
└─────────────────┘
         ↓
┌─────────────────┐
│ Domain Entities │  ← Business rules, may use calculations for complex logic
└─────────────────┘
         ↓
┌─────────────────┐
│  Calculations   │  ← Pure math functions, no dependencies
└─────────────────┘
```

**Key Principle:** Higher layers depend on lower layers, never the reverse.

### **🚦 Two-Stage Migration Strategy**

#### **Stage 1: Consolidate Duplicates (Single Source of Truth)**
**Goal:** Eliminate duplication using domain entities as authoritative source
**Approach:** Delegation pattern for safe migration

```
CURRENT PROBLEMS:                  STAGE 1 SOLUTION:
├── calculateTotalAllocation       ├── All delegate to ProjectEntity.calculateTotalMilestoneAllocation()
│   ├── milestoneCalculations.ts   │   ├── milestoneCalculations.ts → delegation wrapper
│   ├── legacyService1.ts          │   ├── legacyService1.ts → delegation wrapper  
│   └── legacyService2.ts          │   └── legacyService2.ts → delegation wrapper
├── analyzeBudget                  ├── All delegate to ProjectEntity.analyzeBudget()
│   ├── managementService.ts       │   ├── managementService.ts → delegation wrapper
│   └── legacyService.ts           │   └── legacyService.ts → delegation wrapper
```

**Benefits:**
- ✅ **Zero breaking changes** - All existing imports continue working
- ✅ **Domain entities become single source of truth**
- ✅ **Easy rollback** - Remove delegation wrappers if issues
- ✅ **AI can reliably find functions** - Only one real implementation

#### **Stage 2: Architectural Refinement (Optional)**
**Goal:** Extract pure math, create unified services that orchestrate domain entities  
**Timing:** Only after Stage 1 is complete and stable

```
STAGE 1 RESULT:                    STAGE 2 REFINEMENT:
├── Domain entities do everything  ├── Pure math extracted to calculations/
├── Other services delegate        ├── Domain entities keep business rules
├── No duplication                 ├── Unified services orchestrate both
```

**Decision Point:** Evaluate if Stage 2 is needed based on complexity growth

### **🎯 AI Development Guidelines**

#### **For AI Development:**
- **Always check domain entities first** - Business rules live there, don't recreate them
- **Use single source of truth** - If functionality exists, delegate to it rather than duplicating
- **Follow layer hierarchy** - Lower layers never import from higher layers
- **Consistent naming** - Follow established patterns (UnifiedXService, XOrchestrator, XEntity)

#### **AI Decision Framework:**

| When AI Needs To... | First Check... | Then Place In... |
|---------------------|----------------|------------------|
| **Add business rule** | `core/domain/XEntity` | Same entity if rule exists, extend if new |
| **Add calculation** | `core/calculations/` | Extract to calculations if reusable math |
| **Add business logic** | `unified/UnifiedXService` | Extend existing or create new unified service |
| **Add workflow** | `orchestrators/` | Create or extend appropriate orchestrator |
| **Add validation** | Domain entity first | Create validator only if domain rules insufficient |

#### **AI Red Flags (Avoid These):**
- ❌ **Creating duplicate functions** - Always check if functionality already exists
- ❌ **Putting business logic in calculations** - Keep calculations pure math only
- ❌ **Creating parallel services** - Use existing unified services, don't create alternatives
- ❌ **Bypassing domain entities** - Always use domain entities for business rules

---

## 🎯 **Summary: AI-Optimized Unified Services Migration**

**Current Status:** Moving from scattered services to unified architecture with single source of truth
**Approach:** Two-stage consolidation with domain entities as authoritative foundation
**Optimization:** Structure designed to prevent AI confusion and duplication errors

**✅ Stage 1 Actions (Immediate):**
- Consolidate duplicate calculations using delegation to domain entities
- Establish domain entities as single source of truth for business rules
- Use delegation wrappers for safe migration without breaking changes
- Remove legacy services after delegation is verified working

**⚠️ Stage 2 Considerations (Future):**
- Extract pure math to `core/calculations/` if domain entities become too complex
- Create unified services that orchestrate domain entities + calculations
- Add `validators/` and `repositories/` layers only when simple approaches become insufficient

**🤖 AI Development Principles:**
- **Single source of truth** - Prevents AI from creating duplicate functions
- **Consistent patterns** - AI can reliably follow organizational rules
- **Clear layer hierarchy** - AI knows exactly where functionality belongs
- **Delegation over duplication** - AI reuses existing functionality rather than recreating

**🚦 Key Success Metrics:**
- Zero duplicate function implementations
- All business rules centralized in domain entities
- Clear, unambiguous import paths
- Easy for AI to validate if functionality already exists

#### **✅ Core vs Feature Examples**

**Core Infrastructure (Technical Concerns):**
```
src/services/core/infrastructure/
├── 📄 performanceMetrics.ts      # ✅ Performance monitoring
├── 📄 dragPerformanceCache.ts    # ✅ UI performance optimization
├── 📄 cachePerformanceService.ts # ✅ Caching strategies
└── 📄 calculationCache.ts        # ✅ General calculation caching
```

**Feature Domains (Business Concerns):**
```
src/services/milestones/           # ✅ User manages milestones
src/services/projects/             # ✅ User manages projects  
src/services/work-hours/           # ✅ User schedules work hours
src/services/events/               # ✅ User manages calendar events
```

**❌ Wrong Categorization:**
```
src/services/performance/          # ❌ Performance is infrastructure, not feature
src/services/caching/              # ❌ Caching is infrastructure, not feature
src/services/validation/           # ❌ Validation is cross-cutting, belongs in core/domain
```

#### **✅ Legacy Folder Rules**
- **Purpose**: Maintain backward compatibility during migration
- **Contents**: All existing services that haven't been migrated yet
- **Naming**: Keep original service names exactly as they are
- **Imports**: Components should import from legacy until migration is complete
- **Lifecycle**: Delete entire `/legacy/` folder once migration is finished

**Example Legacy Migration:**
```typescript
// ✅ PHASE 1: Create new domain-driven service
// src/services/work-hours/WorkHourOrchestrator.ts
export class WorkHourOrchestrator { ... }

// ✅ PHASE 2: Move existing service to legacy  
// src/services/work-hours/legacy/WorkHourCalculationService.ts
// (Existing service, unchanged)

// ✅ PHASE 3: Update legacy service to delegate
export class WorkHourCalculationService {
  static calculateWeekHours(week: Date): number {
    // Delegate to new domain-driven approach
    return WorkHourOrchestrator.calculateWeekHours(week);
  }
}

// ✅ PHASE 4: Components gradually migrate imports
// Before: import { WorkHourCalculationService } from '@/services/work-hours/legacy/WorkHourCalculationService';
// After:  import { WorkHourOrchestrator } from '@/services';

// ✅ PHASE 5: Delete legacy folder when migration complete
```

## **📦 Import/Export Patterns**

### **✅ Use Barrel Exports For Lightweight Code:**
```typescript
// ✅ Services, Types, Constants, Utils - Tree-shakable, minimal overhead
import { calculateProjectMetrics, PROJECT_CONSTANTS } from '@/services';
import { Project, CalendarEvent } from '@/types';
import { COLORS } from '@/constants';
import { cn, formatDate } from '@/utils';
```

### **✅ Use Direct Imports For Heavy/Stateful Code:**
```typescript
// ✅ Components, Hooks, Contexts - Prevents bundle bloat
import { EventModal } from '@/components/modals/EventModal';
import { useProjects } from '@/hooks/useProjects';
import { ProjectContext } from '@/contexts/ProjectContext';
```

### **📋 Services Import Rules:**
- ✅ **ALL services from main `@/services` barrel only**
- ❌ **NEVER use sub-barrels like `@/services/constants`**

```typescript
// ✅ CORRECT
import { calculateDuration, WORK_HOUR_CONSTANTS } from '@/services';

// ❌ WRONG  
import { WORK_HOUR_CONSTANTS } from '@/services/constants';
```

## **🔍 Service Development Workflow**

### **Before Creating New Services:**
1. **Search for duplicates**: `grep -r "functionName\|pattern" src/services/`
2. **Determine scope**: Global (core) vs Feature-specific
3. **Check file placement**: Add to existing vs create new file
4. **Verify domain fit**: Correct feature folder assignment

### **File Organization Decision Tree:**
- **Global calculation** → `services/core/`
- **Feature-specific** → `services/{feature}/`
- **Single file per type** → Flat structure (`calculations.ts`)
- **Multiple files per type** → Subfolder (`calculations/`)
- **File size >500 lines** → Consider splitting

### **Domain Assignment Guide:**
| Domain | Purpose | Examples |
|--------|---------|----------|
| `calendar/` | Date positioning, time slots | Calendar grid, date ranges |
| `work-hours/` | Duration, scheduling | Hours calculation, time formatting |
| `projects/` | Project logic, metrics | Progress, overlaps, validation |
| `timeline/` | UI positioning, viewport | Timeline rendering, drag operations |
| `milestones/` | Milestone logic | Validation, budgeting |
| `events/` | Event management | Conflicts, scheduling |

### **🔍 Calculation Extraction Process**
**MANDATORY workflow before extracting calculations to services:**

1. **🔍 Check for Duplicates First**
   ```bash
   # Search for similar function names across all services
   grep -r "calculateDuration\|formatDuration\|calculateHours" src/services/
   
   # Search for specific calculation patterns
```

## **� Service Development Workflow**

### **🔍 Calculation Extraction Process**
**MANDATORY workflow before extracting calculations to services:**

1. **🔍 Check for Duplicates First**
   ```bash
   # Search for similar function names across all services
   grep -r "calculateDuration\|formatDuration\|calculateHours" src/services/
   
   # Search for specific calculation patterns
   grep -r "getTime.*getTime\|reduce.*sum\|Math\." src/services/
   ```
   - ✅ **ALWAYS search existing services first**
   - ✅ **Check function names, patterns, and logic similarity**
   - ✅ **Review related domain services (e.g., work-hours for time calculations)**
   - ❌ **NEVER create duplicate functionality**

2. **📁 Service File Organization Strategy**
   
   **Decision Framework for Service Files:**
   
   **Step 1: Determine Calculation Scope**
   - **Global Calculation** → Used across multiple features/pages, core business logic
   - **Feature-Specific Calculation** → Used by specific page/feature for quick access
   
   **Step 2: Choose Appropriate Folder**
   - **Global** → `services/core/` (shared utilities, common calculations)
   - **Feature-Specific** → `services/{feature}/` (timeline, projects, events, etc.)
   
   **Step 3: File Placement Decision**
   Consider these factors when deciding whether to add to existing file or create new:
   - **Ease of Access**: Can developers easily find and import this function?
   - **Performance**: Does grouping improve caching/memoization opportunities?
   - **Separation of Concerns**: Does this fit the existing file's purpose?
   - **File Size**: Is the existing file becoming too large (>500 lines)?
   - **Related Functionality**: Are there other similar functions in the same file?
   
   **Step 4: Create New File When Best**
   - ✅ **Create new file** when it improves organization and discoverability
   - ✅ **Create new file** when existing files are too large or unfocused
   - ✅ **Create new file** for distinct calculation domains within a feature
   - ❌ **Don't create** single-function files unless highly specialized
   - ❌ **Don't create** files that duplicate existing functionality

   **Examples:**
   ```typescript
   // ✅ GOOD - Global calculation in core
   // services/core/dateCalculationService.ts
   export function calculateBusinessDays(start: Date, end: Date): number
   
   // ✅ GOOD - Feature-specific in appropriate folder
   // services/timeline/timelinePositionService.ts  
   export function calculateViewportPosition(dates: Date[], width: number): Position
   
   // ✅ GOOD - New file for distinct domain
   // services/projects/projectProgressService.ts
   export function calculateProjectCompletion(project: Project): number
   
   // ❌ AVOID - Single function file
   // services/singleCalculation.ts (unless highly specialized)
   ```

   **File Naming Convention:**
   - `{Domain}{Purpose}Service.ts` (e.g., `ProjectProgressService.ts`)
   - `{Feature}{Calculation}Service.ts` (e.g., `TimelineViewportService.ts`)
   - Use descriptive names that clearly indicate the calculation domain

### **📋 When to Create New Service Files**

**✅ CREATE NEW FILE when:**
- **New Calculation Domain**: Distinct functionality not covered by existing files
- **File Size Management**: Existing file > 500 lines and new function is unrelated
- **Better Organization**: Grouping improves discoverability and reduces cognitive load
- **Performance Isolation**: Function needs separate caching/memoization strategy
- **Team Collaboration**: Multiple developers working on different aspects

**✅ ADD TO EXISTING FILE when:**
- **Related Functionality**: Function fits existing file's purpose and domain
- **File Size OK**: Current file < 500 lines with room for growth
- **Shared Dependencies**: Uses same utilities/types as existing functions
- **Performance Benefits**: Grouping enables better caching opportunities
- **Simple Addition**: Straightforward function that doesn't complicate the file

**❌ AVOID creating:**
- Single-function files (unless highly specialized and performance-critical)
- Files that duplicate existing functionality
- Files that ignore established domain boundaries
- Files created for organizational reasons that hurt discoverability

3. **🏗️ Use Correct Feature Folders**
   - `services/calendar/` → Calendar positioning, date calculations, time slots
   - `services/milestones/` → Milestone calculations, validation, budgeting
   - `services/projects/` → Project metrics, overlap detection, progress
   - `services/timeline/` → Timeline positioning, viewport calculations, drag operations
   - `services/work-hours/` → Work hour calculations, duration formatting, scheduling
   - `services/events/` → Event calculations, conflict detection, time aggregations

   **Decision Guide:**
   - **Calendar-related** → `calendar/` (dates, positioning, slots)
   - **Time/duration** → `work-hours/` (hours, minutes, formatting)
   - **Project logic** → `projects/` (overlaps, progress, metrics)
   - **Timeline UI** → `timeline/` (positioning, viewport, drag)
   - **Milestone logic** → `milestones/` (validation, calculations)
   - **Event conflicts** → `events/` (drag, overlaps, scheduling)

```typescript
// ✅ CORRECT - Added to existing work-hours service
// services/work-hours/workHourCreationService.ts
export function formatWorkSlotDurationDisplay(hours: number): string {
  // Implementation
}

// ❌ WRONG - Created redundant service
// services/durationCalculationService.ts (duplicate functionality)

// ✅ CORRECT - Used existing timeline service
// services/timeline/timelinePositionService.ts
export function calculateHolidayOverlayPosition(holiday: Holiday, viewport: Viewport): Position {
  // Implementation
}

// ❌ WRONG - Wrong folder for timeline calculations
// services/calendar/holidayPositionService.ts
```

## **🚨 Common Violations to Avoid**

### **❌ Component/Hook Violations:**
```typescript
// DON'T ADD CALCULATIONS IN COMPONENTS:
const total = items.reduce(...);
const position = { left: offset * width, width: duration * width };
```

### **❌ Context Violations:**
```typescript
// DON'T PUT WRONG LOGIC IN CONTEXTS:
// Timeline logic in ProjectContext ❌
// Calculations in any Context ❌ (use services)
```

### **❌ Service Duplication:**
```typescript
// DON'T DUPLICATE EXISTING SERVICES:
// Date calculations → Use existing DateCalculationService
// Project metrics → Use existing ProjectCalculationService  
// Timeline positioning → Use existing TimelineCalculationService
```

## **✅ Development Checklist**

**Before adding any service code:**
- [ ] **Duplicate check**: Searched existing services for similar functionality
- [ ] **Scope analysis**: Determined global (core) vs feature-specific placement
- [ ] **File strategy**: Decided add-to-existing vs create-new based on organization
- [ ] **Domain fit**: Verified calculation belongs in chosen service domain
- [ ] **Size check**: Confirmed target file size appropriate (<500 lines preferred)
- [ ] **Export updates**: Added to service index.ts if creating new functionality
- [ ] **Build verification**: TypeScript compilation passes without errors
- [ ] **Pattern compliance**: Follows established naming and organization patterns

## **🎯 Quick Import Reference**

```typescript
// ✅ Barrel exports for lightweight code
import { calculateProjectMetrics, PROJECT_CONSTANTS } from '@/services';
import { Project, CalendarEvent } from '@/types';
import { COLORS } from '@/constants';

// ✅ Direct imports for heavy/stateful code
import { EventModal } from '@/components/modals/EventModal';
import { useProjects } from '@/hooks/useProjects';
import { ProjectContext } from '@/contexts/ProjectContext';
```

**State Management:**
- Projects/Milestones → `useProjectContext()`
- Timeline/Navigation → `useTimelineContext()`
- Events/Holidays → `usePlannerContext()`
- Settings/Work Hours → `useSettingsContext()`

## 🗑️ **Legacy File Cleanup Strategy**

### **🔍 Before Deleting Legacy Files - Audit Required**

**MANDATORY steps before removing any legacy folder:**

1. **📊 Calculation Extraction Audit**
   ```bash
   # Find all exported functions in legacy files
   grep -r "export.*function\|export.*=" src/services/{feature}/legacy/
   
   # Check if functions exist in new domain files
   grep -r "function_name" src/services/{feature}/
   grep -r "function_name" src/services/core/
   ```

2. **📈 Import Usage Analysis**
   ```bash
   # Find all components using legacy imports
   grep -r "services/{feature}/legacy" src/components/
   grep -r "services/{feature}/legacy" src/hooks/
   grep -r "services/{feature}/legacy" src/contexts/
   ```

3. **✅ Migration Verification Checklist**
   - [ ] **All calculations extracted** - Every exported function has equivalent in new structure
   - [ ] **No unique logic remaining** - Legacy files contain no business logic not found elsewhere
   - [ ] **All imports updated** - No components import from legacy folders
   - [ ] **Tests still pass** - Existing functionality works with new imports
   - [ ] **No circular dependencies** - New structure doesn't create import cycles

### **🚀 Recommended Migration Process**

#### **Phase 1: Extract Unique Calculations**
```typescript
// ✅ STEP 1: Identify unique functions in legacy files
// legacy/ProjectCalculationService.ts → projects/calculations/projectMetrics.ts
// legacy/projectProgressService.ts → projects/calculations/progressTracking.ts
// legacy/projectOverlapService.ts → projects/calculations/overlapDetection.ts

// ✅ STEP 2: Move functions to appropriate new files
// Pure calculations → core/calculations/ (if global) or {feature}/calculations/ (if specific)
// Workflow logic → {feature}/orchestrators/
// Validation rules → {feature}/validators/ or core/domain/
```

#### **Phase 2: Create Migration Layer**
```typescript
// ✅ STEP 3: Update legacy files to delegate (temporary backward compatibility)
// legacy/ProjectCalculationService.ts
export class ProjectCalculationService {
  static calculateMetrics(project: Project) {
    // Delegate to new domain-driven function
    return projectMetricsCalculations.calculateMetrics(project);
  }
}
```

#### **Phase 3: Update Imports Gradually**
```typescript
// ✅ STEP 4: Update component imports one-by-one (safe incremental changes)
// Before: import { ProjectCalculationService } from '@/services/projects/legacy/ProjectCalculationService';
// After:  import { calculateProjectMetrics } from '@/services';
```

#### **Phase 4: Delete Legacy Files**
```typescript
// ✅ STEP 5: Remove legacy folder when no imports remain
// 1. Verify no imports: grep -r "projects/legacy" src/
// 2. Remove from barrel exports: projects/index.ts
// 3. Delete entire legacy folder
// 4. Update documentation
```

### **⚠️ Legacy Deletion Safety Rules**

**❌ NEVER delete legacy files until:**
- [ ] **Complete function audit** - Every legacy function has equivalent in new structure
- [ ] **Zero import references** - No files import from legacy folders
- [ ] **Tests pass** - All existing functionality works with new imports
- [ ] **Documentation updated** - Architecture docs reflect new structure

**✅ SAFE to delete when:**
- [ ] **All calculations extracted** to appropriate domain files
- [ ] **All imports updated** to use new services barrel
- [ ] **Legacy files only contain** delegation code (if any)
- [ ] **Build passes** without any legacy imports
- [ ] **Team consensus** on migration completion

### **🛠️ Legacy Migration Tools**

#### **Legacy Usage Analysis Commands:**
```bash
# Check if legacy folder is safe to delete
feature="domain_name"  # e.g., "projects", "milestones", "events"

# Find legacy imports
grep -r "services/$feature/legacy" src/

# Count legacy files  
find src/services/$feature/legacy/ -name "*.ts" 2>/dev/null | wc -l

# Check barrel exports
grep -r "legacy/" src/services/$feature/index.ts
```

#### **Migration Readiness Checklist:**
```bash
# Verify all functions extracted
grep -r "export.*function\|export.*=" src/services/{feature}/legacy/

# Check new domain structure exists  
ls -la src/services/{feature}/
ls -la src/services/core/domain/

# Confirm no import dependencies
grep -rl "from '@/services/{feature}/legacy" src/
```

#### **Migration Progress Template:**
```typescript
// Add to feature's index.ts during migration
/*
🚧 MIGRATION STATUS for {FEATURE}:
✅ New domain structure created
✅ Functions extracted to appropriate services  
⚠️  PENDING: {X} files still importing legacy
⚠️  PENDING: Legacy validation in progress
❌ NOT READY: Migration blocked by {reason}
*/
```

---

**This architectural guide ensures consistent, maintainable code organization across all development work.**
