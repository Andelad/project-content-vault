# 🏗️ Development Architecture Rules

## 🚨 **Essential Rules - Always Follow**

### **📊 Calculation Logic**
- ✅ **ALL calculations MUST use services from `/src/services/`**
- ❌ **NEVER add math logic to components or hooks**
- ✅ **Use memoized functions for performance**

```typescript
// ✅ CORRECT
import { calculateMilestoneMetrics } from '@/services';
const metrics = calculateMilestoneMetrics(milestones, projectBudget);

// ❌ WRONG
const totalHours = milestones.reduce((sum, m) => sum + m.hours, 0);
```

### **🏢 Services Organization Pattern**
**Clean, domain-driven structure for service files:**

```
src/services/
├── core/                        # Cross-cutting technical concerns
│   ├── domain/                  # Pure business rules (no dependencies)
│   ├── calculations/            # Pure mathematical functions  
│   ├── infrastructure/          # Caching, performance, optimization  
│   └── performance/             # Performance monitoring & optimization
├── {feature}/                   # Business feature domains  
│   ├── {Feature}Orchestrator.ts  # Business workflow (1 file = flat)
│   ├── orchestrators/           # Multiple orchestrators (2+ files = folder)
│   ├── {Feature}Validator.ts    # Validation logic (1 file = flat)  
│   ├── validators/              # Multiple validators (2+ files = folder)
│   ├── calculations.ts          # Feature calculations (1 file = flat)
│   ├── calculations/            # Multiple calculations (2+ files = folder)
│   └── legacy/                  # DELETE AFTER MIGRATION
└── index.ts            # Clean exports organized by layer
```

**Logic behind this structure:**
- **Core**: Cross-cutting technical concerns (domain rules, calculations, infrastructure)
- **Domain**: Universal business rules that never change
- **Calculations**: Pure math functions (easily testable, cacheable)
- **Infrastructure**: Performance optimization, caching, metrics (wraps pure functions)
- **Feature folders**: Business domains that users interact with
- **Legacy folders**: Safe migration path (maintain backward compatibility)

**Folder Structure Rules:**
- ✅ **Feature-specific logic** - Keep in feature folder, classify by type (calculations, workflows, etc.)
- ✅ **Cross-cutting logic** - Move to `core/` (domain, calculations, infrastructure, performance)
- ✅ **Single file per type** - Use flat files (`milestones/calculations.ts`, `events/orchestrator.ts`)
- ✅ **Multiple files per type** - Create subfolders (`events/calculations/`, `timeline/orchestrators/`)
- ❌ **Never create single-file folders** - No `{feature}/orchestrators/SomeOrchestrator.ts` for just one file
- ✅ **Legacy folder always exists** - All existing services go in `/legacy/` during migration
- ❌ **No deeply nested folders** - Keep structure navigable (max 2-3 levels deep)

**Subfolder Decision Logic:**
1. **Classify the concern**: Is it feature-specific or cross-cutting?
2. **Count files by type**: How many calculations/orchestrators/validators?
3. **Apply structure rule**: 1 file = flat, 2+ files = subfolder
4. **Name consistently**: Use standard patterns (`calculations/`, `orchestrators/`, `workflows/`)

**Core vs Feature Distinction:**
- **Core concerns**: Technical, cross-cutting functionality (domain rules, calculations, infrastructure)
- **Feature domains**: Business functionality that users directly interact with
- **Performance/caching**: Always belongs in `core/infrastructure/`, never as separate feature
- **Validation rules**: Universal rules go in `core/domain/`, feature-specific in `{feature}/Validator.ts`

### **� Feature Folder Organization Rules**

#### **✅ Simple Feature Structure (Single Files)**
```
src/services/milestones/
├── 📄 MilestoneOrchestrator.ts    # One orchestrator = flat file
├── 📄 MilestoneValidator.ts       # One validator = flat file
├── 📄 MilestoneRepository.ts      # One repository = flat file
└── 📁 legacy/                     # Migration safety
    └── 📄 milestoneManagementService.ts
```

#### **✅ Mixed Feature Structure (Some Single, Some Multiple)**  
```
src/services/projects/
├── 📄 ProjectOrchestrator.ts      # One orchestrator = flat file
├── 📄 ProjectValidator.ts         # One validator = flat file  
├── 📄 ProjectRepository.ts        # One repository = flat file
├── 📄 calculations.ts             # One calculation file = flat file
└── 📁 legacy/                     # Migration safety
    ├── 📄 ProjectCalculationService.ts
    └── 📄 projectProgressService.ts
```

#### **✅ Complex Feature Structure (Multiple Files by Type)**  
```
src/services/events/
├── 📄 EventOrchestrator.ts        # One main orchestrator = flat file
├── 📄 EventValidator.ts           # One main validator = flat file
├── 📄 EventRepository.ts          # One main repository = flat file
├── 📁 calculations/               # Multiple calculations = subfolder
│   ├── 📄 dragCalculations.ts     # Drag interaction logic
│   ├── 📄 overlapCalculations.ts  # Event overlap logic
│   ├── 📄 durationCalculations.ts # Event duration logic
│   └── 📄 splitCalculations.ts    # Event splitting logic
└── 📁 legacy/                     # Migration safety
    ├── 📄 eventDurationService.ts
    └── 📄 dragCalculationService.ts
```

#### **❌ Incorrect Nested Structure**
```
src/services/work-hours/
├── 📁 orchestrators/              # ❌ NEVER - Single file in folder
│   └── 📄 WorkHourOrchestrator.ts
├── 📁 validators/                 # ❌ NEVER - Unnecessary nesting
│   └── 📄 WorkHourValidator.ts
└── 📁 repositories/               # ❌ NEVER - Overengineered
    └── 📄 WorkHourRepository.ts
```

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

### **�📦 Import/Export Patterns**
**MANDATORY patterns for optimal performance and maintainability:**

#### **✅ Use Barrel Exports For:**

**1. Services (Pure Functions)**
```typescript
// ✅ CORRECT - Tree-shakable, pure functions
import { calculateProjectMetrics, formatDuration, PROJECT_CONSTANTS } from '@/services';
```
- **Why:** Pure functions, tree-shakable, minimal runtime overhead
- **Performance:** Only imports what you use, highly optimized

**2. Types & Interfaces**
```typescript
// ✅ CORRECT - Zero runtime cost
import { Project, CalendarEvent, WorkHour } from '@/types';
```
- **Why:** TypeScript strips these at build time
- **Performance:** None - compile-time only

**3. Constants & Utils**
```typescript
// ✅ CORRECT - Static values, pure utilities
import { COLORS, LAYOUT_CONSTANTS } from '@/constants';
import { cn, formatDate } from '@/utils';
```

#### **❌ Use Direct Imports For:**

**1. React Components**
```typescript
// ❌ AVOID - Can import unnecessary component code
import { EventModal, ProjectModal } from '@/components';

// ✅ CORRECT - Direct imports for components
import { EventModal } from '@/components/modals/EventModal';
import { Button } from '@/components/ui/button';
```
- **Why:** Components include JSX, styles, heavy dependencies
- **Performance:** Prevents bundle bloat from unused components

**2. Hooks (Stateful Logic)**
```typescript
// ❌ AVOID - Hooks have heavy dependencies
import { useProjects, useTimeline } from '@/hooks';

// ✅ CORRECT - Direct imports
import { useProjects } from '@/hooks/useProjects';
import { useTimelineContext } from '@/contexts/TimelineContext';
```
- **Why:** Hooks import contexts, services, and state management
- **Performance:** Avoids unnecessary state management code

#### **🎯 Complete Import Pattern:**
```typescript
// ✅ BARREL EXPORTS - Lightweight, functional code
import { calculateProjectMetrics, PROJECT_CONSTANTS } from '@/services';
import { Project, CalendarEvent } from '@/types';
import { COLORS } from '@/constants';
import { cn, formatDate } from '@/utils';

// ✅ DIRECT IMPORTS - Heavy, stateful code
import { EventModal } from '@/components/modals/EventModal';
import { useProjects } from '@/hooks/useProjects';
import { ProjectContext } from '@/contexts/ProjectContext';
```

#### **📋 Services Consolidation Rule:**
- ✅ **ALL services MUST use `@/services` barrel export**
- ❌ **NEVER use sub-barrels like `@/services/constants`**
- ✅ **Move service constants into main services barrel**

```typescript
// ✅ CORRECT - Everything from main services barrel
import { calculateDuration, WORK_HOUR_CONSTANTS } from '@/services';

// ❌ WRONG - Sub-barrel patterns
import { WORK_HOUR_CONSTANTS } from '@/services/constants';
```

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

**Verification Steps:**
- [ ] **Scope Analysis**: Is this global or feature-specific calculation?
- [ ] **Folder Selection**: `core/` for global, `{feature}/` for specific
- [ ] **File Placement**: Searched existing files for best fit?
- [ ] **Organization Check**: Does placement improve ease of access and performance?
- [ ] **Size Consideration**: Is existing file too large (>500 lines)?
- [ ] **No Duplicates**: Confirmed no similar functionality exists
- [ ] **Updated Exports**: Added to service index.ts if needed
- [ ] **Build Verification**: TypeScript compilation passes
- [ ] **No Linting Errors**: Code follows established patterns

### **🔄 State Management**
- ✅ **Use specialized contexts**: ProjectContext, TimelineContext, SettingsContext
- ❌ **NEVER create god objects or bloated contexts**
- ✅ **Keep contexts focused on their domain**

### **📁 File Organization**
- **Services** (`/src/services/`) → All calculations and business logic
- **Components** → Rendering only, import from services
- **Hooks** → State management, delegate calculations to services

### **⚡ Performance**
- ✅ **Use memoized calculation functions from services**
- ❌ **NEVER do expensive calculations in render**
- ✅ **Let CalculationCacheService handle caching automatically**

## 🎯 **Quick Decision Guide**

**Adding a new calculation to services?**

1. **📊 Analyze Scope**
   - Multiple features use it? → `services/core/`
   - Specific feature only? → `services/{feature}/`

2. **🔍 Check Existing Files**
   - Search for similar functions: `grep -r "calculate.*" src/services/`
   - Review related services in target folder
   - Consider file size and organization

3. **📁 Choose File Strategy**
   - **Add to existing** if related and file size < 500 lines
   - **Create new file** if improves organization and discoverability
   - **Split existing** if file is too large or unfocused

4. **✅ Verify Placement**
   - Easy to find and import?
   - Improves performance/caching?
   - Clear separation of concerns?
   - Follows naming conventions?

**Example Decision Flow:**
```typescript
// New timeline calculation function
// 1. Scope: Feature-specific (timeline only) → services/timeline/
// 2. Search: Found timelinePositionService.ts with related functions
// 3. Decision: Add to existing (file size OK, related functionality)
// 4. Result: services/timeline/timelinePositionService.ts
```

**Need to calculate something?**
```typescript
import { 
  calculateProjectMetrics,
  calculateMilestoneMetrics,
  calculateProjectPosition,
  getBusinessDaysBetween 
} from '@/services';
```

## 🚨 **VIOLATIONS TO WATCH FOR:**

### **❌ Component Calculation Violations**
```typescript
// DON'T ADD THESE TO COMPONENTS:
const total = items.reduce(...);
const dailyHours = hours / days;
const isOverBudget = allocated > budget;
const position = { left: offset * width, width: duration * width };
```

### **❌ Context Pollution Violations**
```typescript
// DON'T ADD THESE TO WRONG CONTEXTS:
// Timeline stuff in ProjectContext
// Project stuff in PlannerContext  
// Calculations in any Context (use services)
```

### **❌ Duplication Violations**
```typescript
// DON'T DUPLICATE EXISTING SERVICES:
// Date calculations → DateCalculationService exists
// Project metrics → ProjectCalculationService exists
// Timeline positioning → TimelineCalculationService exists
```

## ✅ **ENFORCEMENT CHECKLIST**

Before adding any calculation to services:
- [ ] **Scope Analysis**: Global calculation (core) or feature-specific?
- [ ] **Existing Search**: Thoroughly searched existing services for similar functionality?
- [ ] **File Strategy**: Add to existing file or create new based on organization factors?
- [ ] **Placement Decision**: Does placement improve ease of access and performance?
- [ ] **Size Check**: Is target file size appropriate (< 500 lines preferred)?
- [ ] **No Duplication**: Confirmed no similar functionality exists elsewhere?
- [ ] **Domain Fit**: Does calculation belong in chosen service domain?
- [ ] **Export Updates**: Added to service index.ts exports if needed
- [ ] **Build Verification**: TypeScript compilation passes without errors
- [ ] **Pattern Compliance**: Follows established naming and organization patterns

## 🎯 **QUICK REFERENCE**

**Import Patterns:**
```typescript
// ✅ BARREL EXPORTS - Lightweight code
import { calculateProjectMetrics, PROJECT_CONSTANTS } from '@/services';
import { Project, CalendarEvent } from '@/types';
import { COLORS } from '@/constants';
import { cn, formatDate } from '@/utils';

// ✅ DIRECT IMPORTS - Heavy/stateful code
import { EventModal } from '@/components/modals/EventModal';
import { useProjects } from '@/hooks/useProjects';
import { ProjectContext } from '@/contexts/ProjectContext';
```

**Need state management?**
- Projects/Milestones → `useProjectContext()`
- Timeline/Navigation → `useTimelineContext()`
- Events/Holidays → `usePlannerContext()`
- Settings/Work Hours → `useSettingsContext()`

**Performance Guidelines:**
- ✅ Barrel exports for: Services, Types, Constants, Utils
- ❌ Direct imports for: Components, Hooks, Contexts
- ✅ All services from `@/services` (no sub-barrels)

**This file must be consulted before every change!**

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

#### **Find Legacy Usage Script**
```bash
#!/bin/bash
# Check if legacy folder is safe to delete

feature=$1  # e.g., "projects", "milestones"

echo "🔍 Checking legacy usage for: $feature"
echo "📊 Legacy imports found:"
grep -r "services/$feature/legacy" src/ || echo "✅ No legacy imports found"

echo "📁 Legacy files remaining:"
find src/services/$feature/legacy/ -name "*.ts" 2>/dev/null || echo "✅ No legacy files found"

echo "📈 Legacy exports in barrel:"
grep -r "legacy/" src/services/$feature/index.ts || echo "✅ No legacy exports found"
```

#### **Migration Analysis Script** 🆕
```bash
# Run comprehensive legacy analysis
# Usage: ./scripts/analyze-legacy-usage.sh
# 
# Provides:
# - Total files needing import updates
# - Reference count per legacy service  
# - Legacy file count and locations
# - Migration effort assessment
# - Recommended approach based on scope
```

#### **Migration Progress Tracker**
```typescript
// Add to each feature's index.ts during migration
/*
🚧 MIGRATION STATUS:
✅ Domain entities created (ProjectEntity, etc.)
✅ Orchestrators implemented (ProjectOrchestrator)
✅ Calculations extracted (projectMetrics, progressTracking)
⚠️  PENDING: Component imports still use legacy
⚠️  PENDING: Legacy files contain unique functions
❌ NOT READY: Legacy folder deletion blocked
*/
```

#### **🔍 Pre-Migration Analysis Commands** 🆕

**Quick Legacy Check:**
```bash
# Count total files importing legacy services
grep -rl "from '@/services/projects/legacy" src/ | wc -l

# Find most used legacy services
grep -r "ProjectCalculationService\|projectProgressService" src/ | wc -l

# Check legacy exports still in barrel
grep -c "legacy/" src/services/projects/index.ts
```

**Current Projects Legacy Status (Based on index.ts analysis):**
```typescript
// 🔍 DETECTED: 8 Legacy Services in projects/index.ts
// 🟡 MIGRATION EFFORT: MEDIUM-HIGH (estimated 15-30+ files to update)
//
// Legacy Services Found:
// 1. ProjectCalculationService
// 2. projectProgressCalculationService  
// 3. projectProgressGraphService
// 4. projectProgressService
// 5. projectStatusService
// 6. projectWorkingDaysService
// 7. projectOverlapService
// 8. ProjectValidationService
//
// Recommended Approach: Phased migration with delegation layer
```

**Detailed Function Analysis:**
```bash
# Find all exported functions in legacy files
grep -r "export.*function\|export.*=" src/services/projects/legacy/

# Check if functions exist in new domain structure  
grep -r "calculateProjectMetrics\|analyzeProjectProgress" src/services/projects/
grep -r "calculateProjectMetrics\|analyzeProjectProgress" src/services/core/
```

**Import Impact Assessment:**
```bash
# Files that will need import updates
grep -rl "ProjectCalculationService\|projectProgressService\|projectStatusService" src/components/
grep -rl "ProjectCalculationService\|projectProgressService\|projectStatusService" src/hooks/

# Specific legacy import patterns
grep -r "from '@/services/projects/legacy" src/
```

**Migration Readiness Check:**
```bash
# Verify new domain structure exists
ls -la src/services/projects/
ls -la src/services/core/domain/

# Check barrel exports
grep -c "Orchestrator\|Entity" src/services/projects/index.ts
```

**This migration analysis helps determine the exact scope before starting legacy cleanup.**
