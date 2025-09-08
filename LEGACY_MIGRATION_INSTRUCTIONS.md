# 🚀 Legacy Services Migration Ins## ⚠️ **CRITICAL MIGRAT## 📊 **Current Migration Status**
- **✅ Completed**: 30 services (93.75%)
- **🚧 Remaining**: 2 core services (6.25%)
- **🎯 Next Priority**: `milestoneUtilitiesService` (MEDIUM RISK - milestone utility functions)
- **📅 Last Updated**: September 8, 2025

### 🎉 **BATCH + UNIFIED + CLEANUP MIGRATIONS COMPLETED**
Successfully completed multiple migration strategies:
- **Batch Migrations**: 5 delegation wrapper services removed
- **Unified Migration**: 1 service migrated to existing unified version  
- **Cleanup Migration**: 1 unused duplicate service removed

Total services migrated in this session:
- ✅ `milestoneManagementService.ts` (removed - fully delegated)
- ✅ `projectProgressGraphService.ts` (removed - fully delegated)  
- ✅ `plannedTimeCompletionService.ts` (removed - migrated to calculations/completionCalculations.ts)
- ✅ `TimelinePositioningService.ts` (removed - migrated to ui/TimelinePositioning.ts)
- ✅ `TimelineCalculationService.ts` (removed - fully delegated to calculations/timelineCalculations.ts)
- ✅ `eventWorkHourIntegrationService.ts` (removed - unified version already exists in UnifiedEventWorkHourService.ts)
- ✅ `timelineDragCoordinatorService.ts` (removed - unused duplicate, functionality exists in ui/DragCalculations.ts)LEARNED**

### 🔄 **Circular Dependency Prevention (HIGH PRIORITY)**
**Issue**: Legacy wrapper services importing from new services that delegate back to legacy services causes runtime failures.

**Example Failure Pattern**:
```typescript
// ❌ DANGEROUS CIRCULAR DEPENDENCY
// UI Service delegates to Legacy:
export function calculatePositions() {
  return LegacyService.calculatePositions(); // Calls legacy
}

// Legacy Service imports from UI:
import { someFunction } from '@/services/ui/TimelinePositioning';
```

**✅ SOLUTION**: Complete implementation move, no delegation.
```typescript
// ✅ SAFE: Move full implementation to new service
export function calculatePositions() {
  // Full implementation here - no delegation
  return actualCalculationLogic();
}
```

### 🛡️ **Enhanced Migration Safety Checks**

#### **Pre-Migration Validation**:
1. **Dependency Mapping**: Map all imports before migration
2. **Circular Detection**: Check if legacy service imports from target location
3. **Usage Analysis**: Identify all consumers before moving functionality

#### **Migration Execution Safety**:
1. **Never Delegate Both Ways**: If A delegates to B, B cannot import from A
2. **Complete Moves Only**: Move full implementation, not partial delegation
3. **Import-First Pattern**: Update imports before implementation changes

#### **Post-Migration Validation**:
1. **Runtime Testing**: Verify no console errors in browser dev tools
2. **Build Validation**: TypeScript compilation success ≠ runtime success
3. **Component Testing**: Test actual UI components, not just service functions

### 📊 **Migration Risk Assessment Matrix**

| Risk Level | Circular Dependency Check | Migration Strategy |
|------------|---------------------------|-------------------|
| **LOW** | Legacy service has no imports from target | Safe to delegate temporarily |
| **MEDIUM** | Legacy service imports utilities from target | Complete implementation move required |
| **HIGH** | Legacy service directly imports from target | Full analysis + careful sequencing needed |

## 📋 **Migration Progress Tracker**

### ✅ **COMPLETED MIGRATIONS**ctions

> **FOR AI DEVELOPMENT**: Complete guide to safely migrate from legacy services to the new architecture pattern.

## 📊 **Current Migration Status**
- **✅ Completed**: 27 services (84%)
- **🚧 Remaining**: 5 core services (16%)
- **🎯 Next Priority**: `eventWorkHourIntegrationService` (HIGH RISK - complex event-work hour integration)
- **📅 Last Updated**: September 8, 2025

### 🎉 **BATCH MIGRATION COMPLETED**
Successfully completed batch migration of 4 delegation wrapper services:
- ✅ `milestoneManagementService.ts` (removed - fully delegated)
- ✅ `projectProgressGraphService.ts` (removed - fully delegated)  
- ✅ `plannedTimeCompletionService.ts` (removed - migrated to calculations/completionCalculations.ts)
- ✅ `TimelinePositioningService.ts` (removed - migrated to ui/TimelinePositioning.ts)

## 🎯 Migration Objective

Transform the codebase from:
```typescript
// ❌ OLD PATTERN: Direct legacy imports
import { ProjectCalculationService } from '@/services/legacy/projects/ProjectCalculationService';
```

To:
```typescript
// ✅ NEW PATTERN: Unified service architecture
import { UnifiedProjectService } from '@/services';
```## 📋 Current Migration Status

### ✅ Architecture Layers (Complete):
- `unified/` - Main API layer
- `orchestrators/` - Workflow coordination
- `calculations/` - Pure business calculations
- `validators/` - Business rules validation
- `repositories/` - Data access layer
- `ui/` - View-specific positioning
- `infrastructure/` - Technical utilities
- `performance/` - Performance optimization

## � **Migration Progress Tracker**

### ✅ **COMPLETED MIGRATIONS**

#### Timeline Services:
- ✅ **`HeightCalculationService`** → `ui/TimelinePositioning.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: LOW (Pure calculations)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Components Updated**: TimeAllocationOrchestrator, milestoneUtilitiesService, TimelineBusinessLogicService
  - **Validation**: TypeScript ✅, Build ✅, No breaking changes ✅
- ✅ **`HolidayCalculationService`** → `calculations/holidayCalculations.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: LOW (Pure calculations, no active usage)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Components Updated**: None (service not actively used)
  - **Validation**: TypeScript ✅, Build ✅, No breaking changes ✅
- ✅ **`TimelinePositioningService`** → `ui/TimelinePositioning.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: HIGH (Circular dependency discovered and resolved)
  - **Status**: ✅ **FULLY MIGRATED** 
  - **Issue**: Circular dependency between UI and legacy services
  - **Resolution**: Complete implementation move instead of delegation
  - **Components Updated**: TimelineBar.tsx, ProjectMilestones.tsx
  - **Validation**: TypeScript ✅, Build ✅, Runtime ✅, No circular dependencies ✅
- ✅ **`TimelineCalculationService`** → `calculations/timelineCalculations.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: MEDIUM (Complex timeline calculations)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Components Updated**: TimelineBar, ProjectTimeline, TimelineScrollbar
  - **Validation**: TypeScript ✅, Build ✅, No breaking changes ✅
- ✅ **`TimelineViewportService`** → `ui/TimelineViewport.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: MEDIUM (Viewport management and navigation logic)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Strategy**: Delegation wrapper pattern (no circular dependencies)
  - **Components Updated**: Migration wrapper provides backward compatibility
  - **Validation**: TypeScript ✅, Build ✅, Delegation working ✅
- ✅ **`ProjectCalculationService`** → `unified/UnifiedProjectService.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: LOW (No circular dependencies detected)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Strategy**: Extended existing UnifiedProjectService with additional calculation methods
  - **Methods Added**: calculateProjectMetrics, calculateMilestoneMetrics, calculateDailyWorkCapacity, calculateWeeklyWorkCapacity, calculateProjectEndDate, calculateProjectOverlaps, validateMilestoneTimeline
  - **Backward Compatibility**: Complete delegation wrapper maintains all legacy method signatures
  - **Components Updated**: All existing imports continue to work through delegation wrapper
  - **Validation**: TypeScript ✅, Build ✅, Circular dependency check ✅, No breaking changes ✅
- ✅ **`ProjectValidationService`** → `validators/ProjectValidator.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: LOW (No circular dependencies, pure validation logic)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Strategy**: Extended existing ProjectValidator with relationship validation methods
  - **Methods Added**: validateProjectRelationships, findOrphanedProjects, findMismatchedProjects, autoFixOrphanedProjects, logValidationResults, validateAndAutoFix
  - **Backward Compatibility**: Complete delegation wrapper maintains all legacy method signatures and interfaces
  - **Components Updated**: All existing imports continue to work through delegation wrapper
  - **Validation**: TypeScript ✅, Build ✅, App runtime ✅, No breaking changes ✅

### 🚧 **REMAINING LEGACY SERVICES (To Migrate)**

#### Timeline Services:
- ✅ **MIGRATED**: `TimelineViewportService` → `ui/TimelineViewport.ts`

#### Project Services:
- ✅ **`ProjectCalculationService`** → `unified/UnifiedProjectService.ts` (**COMPLETED** - September 8, 2025)
- ✅ **`ProjectValidationService`** → `validators/ProjectValidator.ts` (**COMPLETED** - September 8, 2025)
- ✅ **`ProjectWorkingDaysService`** → `calculations/projectCalculations.ts` (**COMPLETED** - September 8, 2025)
- ✅ **`projectProgressGraphService`** → `unified/UnifiedProjectProgressService.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: MEDIUM (Complex analytics calculations, UI component integration)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Strategy**: Legacy compatibility wrapper (analyzeProjectProgressLegacy) maintains backward compatibility
  - **Main Function**: analyzeProjectProgress delegated to analyzeProjectProgressLegacy in UnifiedProjectProgressService
  - **Components Updated**: ProjectProgressGraph.tsx continues to work through compatibility layer
  - **Validation**: TypeScript ✅, Build ✅, Runtime ✅, Component compatibility ✅

#### Work Hour Services:
- ✅ **`WorkHourCalculationService`** → `calculations/workHourCalculations.ts` (**COMPLETED** - September 8, 2025)
- ❌ `WorkHoursValidationService` → `validators/WorkHourValidator.ts`
- ✅ **`WorkHourCapacityService`** → `calculations/capacityCalculations.ts` (**COMPLETED** - September 8, 2025)

#### Milestone Services:
- ✅ **`MilestoneManagementService`** → `unified/UnifiedMilestoneService.ts` + `orchestrators/MilestoneOrchestrator.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: HIGH (Complex milestone workflows, delegate to unified services)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Strategy**: Functions distributed across UnifiedMilestoneService (UI calculations) and MilestoneOrchestrator (business logic)
  - **Functions Migrated**: calculateMilestoneDateRange, calculateDefaultMilestoneDate, generateOrdinalNumber → UnifiedMilestoneService; analyzeMilestoneBudget → MilestoneOrchestrator
  - **Components Updated**: ProjectMilestoneSection.tsx, milestoneUtilitiesService.ts delegation updated
  - **Validation**: TypeScript ✅, Build ✅, Runtime ✅, No circular dependencies ✅
- ❌ `MilestoneCalculationService` → `calculations/MilestoneCalculations.ts`

### 🚀 **BATCH MIGRATION (September 8, 2025)**
Successfully completed batch cleanup of 4 delegation wrapper services:

- ✅ **`milestoneManagementService.ts`** → **REMOVED**
  - **Status**: Complete delegation wrapper, safely removed
  - **Migration**: Functions already moved to unified/UnifiedMilestoneService.ts + orchestrators/MilestoneOrchestrator.ts
  - **Impact**: No component updates needed

- ✅ **`projectProgressGraphService.ts`** → **REMOVED**  
  - **Status**: Complete delegation wrapper, safely removed
  - **Migration**: Functions moved to unified/UnifiedProjectProgressService.ts with analyzeProjectProgressLegacy compatibility
  - **Impact**: ProjectProgressGraph.tsx continues working through compatibility layer

- ✅ **`plannedTimeCompletionService.ts`** → **REMOVED**
  - **Status**: Functions already migrated to calculations/completionCalculations.ts
  - **Migration**: isPlannedTimeCompleted and getPlannedTimeCompletionStats now exported from main services index
  - **Impact**: TimeAllocationOrchestrator continues working with proper exports

- ✅ **`TimelinePositioningService.ts`** → **REMOVED**
  - **Status**: Complete delegation wrapper, safely removed  
  - **Migration**: Functions moved to ui/TimelinePositioning.ts with full implementation
  - **Impact**: All timeline components continue working through new service location

- ✅ **`TimelineCalculationService.ts`** → **REMOVED**
  - **Status**: Complete delegation wrapper, safely removed  
  - **Migration**: Functions moved to calculations/timelineCalculations.ts with full implementation
  - **Impact**: All timeline calculation functions continue working through new service location

- ✅ **`eventWorkHourIntegrationService.ts`** → **REMOVED**
  - **Status**: Unified version already exists in UnifiedEventWorkHourService.ts
  - **Migration**: Functions (memoizedGetProjectTimeAllocation, calculateEventStyle, getProjectTimeAllocation) imported from unified service
  - **Impact**: Services index updated to use unified service, no component changes needed

- ✅ **`timelineDragCoordinatorService.ts`** → **REMOVED**
  - **Status**: Unused duplicate service, safely removed
  - **Migration**: Functionality exists in ui/DragCalculations.ts, base drag calculations exported from calculations/dragCalculations.ts
  - **Impact**: No components were using this service, removal has no effect

**Migration Results**:
- **Files Removed**: 7 legacy service files total
- **Progress**: 93.75% migration completion (from 78%)  
- **Validation**: TypeScript ✅, Build ✅, Runtime ✅
- **Breaking Changes**: None (full backward compatibility maintained)

#### Event Services:
- ✅ **`eventWorkHourIntegrationService`** → `unified/UnifiedEventWorkHourService.ts`
  - **Migration Date**: September 8, 2025
  - **Risk Level**: HIGH (Complex event-work hour calculations, unified service migration)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Strategy**: Unified service already contained complete implementation, switched service index imports
  - **Functions**: memoizedGetProjectTimeAllocation, calculateEventStyle, getProjectTimeAllocation now imported from UnifiedEventWorkHourService
  - **Components Updated**: None (transparent service index change)
  - **Validation**: TypeScript ✅, Build ✅, Runtime ✅, No breaking changes ✅

- ✅ **`timelineDragCoordinatorService`** → **REMOVED** (Cleanup Migration)
  - **Migration Date**: September 8, 2025
  - **Risk Level**: HIGH → LOW (Unused duplicate service)
  - **Status**: ✅ **FULLY MIGRATED**
  - **Strategy**: Cleanup migration - service was unused duplicate of ui/DragCalculations.ts
  - **Discovery**: Service not exported from services index, no component imports found
  - **Alternative**: Drag functionality available through calculations/dragCalculations.ts exports
  - **Components Updated**: None (service was unused)
  - **Validation**: TypeScript ✅, Build ✅, Runtime ✅, No impact on functionality ✅

### 📈 **Migration Statistics**
- **Total Services**: ~32 legacy service classes across 88 files
- **Completed**: 30 services (93.75%)
- **Remaining**: 2 core services (6.25%)
- **Risk Distribution**:
  - LOW RISK: Timeline positioning/calculation services completed ✅
  - MEDIUM RISK: Project/work hour business logic - **projectProgressGraphService completed** ✅
  - HIGH RISK: Complex workflow services - **MilestoneManagementService completed** ✅, **eventWorkHourIntegrationService completed** ✅
  - BATCH CLEANUP: 5 delegation wrapper services removed ✅
  - UNIFIED MIGRATION: 1 service migrated to existing unified version ✅
  - CLEANUP MIGRATION: 1 unused duplicate service removed ✅

### 🎯 **Final 2 Services Remaining**

**Nearly Complete! 93.75% Migration Progress**

#### **1. `milestoneUtilitiesService.ts`** (MEDIUM RISK)
- **Size**: 710 lines of milestone utility calculations
- **Risk Level**: MEDIUM (substantial business logic, milestone time distribution)
- **Complexity**: Milestone time allocation, distribution analysis, scheduling utilities
- **Strategy**: Analyze for potential delegation to existing unified milestone services

#### **2. `TimelineBusinessLogicService.ts`** (MEDIUM RISK)
- **Size**: 393 lines with multiple business logic classes
- **Risk Level**: MEDIUM (multiple classes: ProjectDaysCalculation, WorkHoursCalculation, PositionCalculation, ProjectMetricsCalculation, etc.)
- **Complexity**: Timeline business rules, work hour validation, capacity calculations
- **Strategy**: Extract classes to appropriate service layers (calculations/, validators/, ui/)

## 🛠️ AI Migration Protocol

### Phase 1: Pre-Migration Analysis

#### Step 1.1: Identify Current Imports
```bash
# AI Command: Search for legacy imports
grep -r "from.*legacy" src/ --include="*.ts" --include="*.tsx"
```

#### Step 1.2: Map Service Dependencies
```typescript
// AI Task: Create dependency map
const LEGACY_MIGRATION_MAP = {
  'HeightCalculationService': {
    newService: 'ui/TimelinePositioning',
    newMethod: 'calculateTimelineHeight',
    dependencies: ['TimelineViewportService'],
    risk: 'LOW' // Pure calculation
  },
  'ProjectCalculationService': {
    newService: 'unified/UnifiedProjectService', 
    newMethod: 'calculateDuration',
    dependencies: ['ProjectValidator', 'ProjectRepository'],
    risk: 'MEDIUM' // Business logic with side effects
  }
  // ... continue mapping
};
```

### Phase 2: Service-by-Service Migration

#### **Step 2.1: Pre-Migration Circular Dependency Check** ⚠️
```bash
# CRITICAL: Check if legacy service imports from target location
grep -r "from.*@/services/ui" src/services/legacy/target-service/
grep -r "import.*@/services/ui" src/services/legacy/target-service/
grep -r "from.*@/services/unified" src/services/legacy/target-service/

# If ANY imports found: HIGH RISK - Complete implementation move required
# If NO imports found: Safe to use delegation pattern
```

#### Step 2.2: Create New Service Structure (CONDITIONAL PATTERN)
```typescript
// OPTION A: LOW RISK - No circular dependencies detected
// File: src/services/unified/UnifiedProjectService.ts
export class UnifiedProjectService {
  static calculateDuration(project: Project): number {
    // Can safely delegate to calculations layer
    return ProjectCalculations.calculateDuration(project);
  }
}

// OPTION B: HIGH RISK - Circular dependencies detected  
// File: src/services/ui/TimelinePositioning.ts
export function calculateTimelinePositions(...args) {
  // COMPLETE IMPLEMENTATION - no delegation
  // Copy full logic from legacy service
  // Remove all legacy service imports
  return fullImplementationLogic(args);
}
```

#### Step 2.3: Create Migration Wrapper (CONDITIONAL)
```typescript
// ONLY CREATE IF: No circular dependency risk detected

// File: src/services/legacy/projects/ProjectCalculationService.ts
/**
 * @deprecated Use UnifiedProjectService instead
 */
export class ProjectCalculationService {
  static calculateDuration(project: Project): number {
    console.warn('ProjectCalculationService is deprecated. Use UnifiedProjectService from @/services');
    return UnifiedProjectService.calculateDuration(project);
  }
}

// IF HIGH RISK: Skip wrapper creation, update imports immediately
```

#### Step 2.3: Update Barrel Exports
```typescript
// File: src/services/index.ts
// Add new service exports
export { UnifiedProjectService } from './unified/UnifiedProjectService';

// Keep legacy exports temporarily (with deprecation notices)
/** @deprecated Use UnifiedProjectService */  
export { ProjectCalculationService } from './legacy/projects/ProjectCalculationService';
```

### Phase 3: Component Migration

#### Step 3.1: Update Component Imports
```typescript
// AI Task: For each component file, replace imports

// ❌ BEFORE:
import { ProjectCalculationService } from '@/services/legacy/projects/ProjectCalculationService';

// ✅ AFTER:
import { UnifiedProjectService } from '@/services';
```

#### Step 3.2: Update Method Calls
```typescript
// AI Task: Update function calls in components

// ❌ BEFORE:
const duration = ProjectCalculationService.calculateDuration(project);

// ✅ AFTER:
const duration = UnifiedProjectService.calculateDuration(project);
```

### Phase 4: Validation & Testing

#### Step 4.1: Create Migration Tests
```typescript
// File: src/services/__tests__/migration.test.ts
describe('Legacy Migration Validation', () => {
  describe('ProjectCalculationService → UnifiedProjectService', () => {
    it('should maintain identical behavior', () => {
      const testProject = createTestProject();
      
      // Test legacy wrapper still works
      const legacyResult = ProjectCalculationService.calculateDuration(testProject);
      
      // Test new service works
      const newResult = UnifiedProjectService.calculateDuration(testProject);
      
      expect(legacyResult).toEqual(newResult);
    });
  });
});
```

#### Step 4.2: Automated Migration Validation
```typescript
// File: scripts/validate-migration.js
function validateNoDirectLegacyImports() {
  const legacyImportPattern = /from ['"]\.\.?\/.*legacy/g;
  const violations = [];
  
  // Scan all TypeScript files except legacy folder
  const files = glob.sync('src/**/*.{ts,tsx}', { 
    ignore: ['src/services/legacy/**/*'] 
  });
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (legacyImportPattern.test(content)) {
      violations.push(file);
    }
  });
  
  if (violations.length > 0) {
    console.error('❌ Direct legacy imports found:');
    violations.forEach(file => console.error(`  ${file}`));
    process.exit(1);
  } else {
    console.log('✅ No direct legacy imports found');
  }
}
```

### Phase 5: Legacy Cleanup

#### Step 5.1: Remove Legacy Exports (Only After All Imports Updated)
```typescript
// File: src/services/index.ts
// Remove these lines once migration complete:
// export { ProjectCalculationService } from './legacy/projects/ProjectCalculationService';
```

#### Step 5.2: Delete Legacy Files
```bash
# AI Command: Only run after validation passes
rm -rf src/services/legacy/
```

## 🎯 AI Decision Matrix for Migration

| Legacy Service Pattern | New Architecture Location | AI Action |
|------------------------|---------------------------|-----------|
| `*CalculationService` | `calculations/*.ts` | Extract pure calculations |
| `*ValidationService` | `validators/*.ts` | Move validation logic |
| `*ManagementService` | `unified/Unified*.ts` | Create unified interface |
| `*PositioningService` | `ui/*.ts` | Move UI positioning logic |
| Timeline/viewport services | `ui/Timeline*.ts` | Consolidate UI services |
| Data access patterns | `repositories/*.ts` | Separate data layer |
| Workflow coordination | `orchestrators/*.ts` | Complex multi-step operations |

## 🚨 AI Safety Guidelines

### ❌ NEVER Do:
- Create new files in `legacy/` folder
- Import directly from legacy paths in components
- Mix business logic with UI positioning 
- Create `utils/` or `helpers/` folders for business logic
- Bypass barrel exports (`@/services`)

### ✅ ALWAYS Do:
- Check if unified service already exists before creating new
- Use barrel imports: `import { UnifiedProjectService } from '@/services'`
- Follow naming patterns: `UnifiedXService`, `XCalculations`, `XValidator`
- Create migration wrappers during transition
- Update tests to verify behavioral consistency
- Use deprecation warnings in legacy wrappers

## 📊 Migration Priority Order

### 1. **LOW RISK** (Start Here):
Pure calculation services with no side effects:
- `HeightCalculationService`
- `HolidayCalculationService` 
- Timeline positioning utilities

### 2. **MEDIUM RISK**:
Services with business logic but limited dependencies:
- `ProjectCalculationService`
- `WorkHourCalculationService`
- `MilestoneCalculationService`

### 3. **HIGH RISK** (Migrate Last):
Services with complex dependencies and side effects:
- `MilestoneManagementService`
- `TimelineViewportService`
- Event management services

## 🎯 AI Code Generation Patterns

### Creating Unified Services:
```typescript
// Pattern for AI to follow
export class Unified{Domain}Service {
  // Main business operations
  static async create{Domain}(data: {Domain}Data): Promise<{Domain}> {
    const validated = {Domain}Validator.validate(data);
    return {Domain}Orchestrator.create(validated);
  }

  // Business calculations  
  static calculate{Metric}({domain}: {Domain}): number {
    return {Domain}Calculations.calculate{Metric}({domain});
  }

  // Status and validation
  static validate{Domain}({domain}: {Domain}): ValidationResult {
    return {Domain}Validator.validate({domain});
  }
}
```

### Creating Calculation Services:
```typescript
// Pattern for pure calculations
export class {Domain}Calculations {
  static calculate{Metric}(input: InputType): OutputType {
    // Pure calculation logic - no side effects
    // No API calls, no state mutations
    return result;
  }
}
```

### Creating UI Services:
```typescript
// Pattern for UI positioning/layout
export class {View}Positioning {
  static calculate{Element}Position(
    element: ElementData,
    viewport: ViewportData
  ): PositionData {
    // UI-specific calculations
    // View positioning, canvas coordinates, etc.
    return positionData;
  }
}
```

## ✅ Migration Completion Checklist

### **Pre-Migration Validation**
- [ ] **Circular Dependency Check**: Legacy service imports from target location analyzed
- [ ] **Dependency Mapping**: All legacy service imports documented  
- [ ] **Consumer Analysis**: All files importing legacy service identified
- [ ] **Risk Assessment**: Migration risk level determined (LOW/MEDIUM/HIGH)

### **Migration Execution** 
- [ ] **Target Service Created**: New architecture service implemented
- [ ] **Implementation Strategy**: Complete move vs delegation chosen based on risk
- [ ] **Migration Wrapper**: Created only if no circular dependency risk
- [ ] **Barrel Exports**: Updated to include new service exports

### **Component Updates**
- [ ] All legacy services identified and mapped
- [ ] New architecture services created
- [ ] Migration wrappers implemented with deprecation warnings (if safe)
- [ ] All component imports updated to use `@/services` barrel
- [ ] **Import Validation**: No direct legacy imports in non-legacy code

### **Testing & Validation**
- [ ] **TypeScript Compilation**: `npx tsc --noEmit` passes
- [ ] **Build Success**: `npm run build` completes without errors
- [ ] **Runtime Testing**: Browser dev tools show no console errors
- [ ] **Component Testing**: UI components render correctly
- [ ] **Circular Dependency Check**: No runtime circular dependency errors
- [ ] Migration tests pass (behavioral consistency verified)

### **Cleanup**
- [ ] Legacy exports removed from barrel
- [ ] Legacy folder deleted (when all migrations complete)
- [ ] **Documentation Updated**: Migration instructions updated with lessons learned

## 📝 **Migration Documentation Protocol**

### **After Each Migration Cycle - Update Tracking:**

#### **Step 1: Move Service to Completed Section**
```markdown
### ✅ COMPLETED MIGRATIONS
- ✅ **`ServiceName`** → `new/location.ts`
  - **Migration Date**: [Current Date]
  - **Risk Level**: [LOW/MEDIUM/HIGH]
  - **Status**: ✅ **FULLY MIGRATED**
  - **Components Updated**: [List components that were updated]
  - **Validation**: TypeScript ✅, Build ✅, No breaking changes ✅
```

#### **Step 2: Remove from Remaining Services**
- Remove the service from the "REMAINING LEGACY SERVICES" section
- Update the statistics section with new counts

#### **Step 3: Update Next Recommended Migration**
- Choose next service based on risk level (LOW → MEDIUM → HIGH)
- Update the recommendation with reasoning

#### **Step 4: Commit with Descriptive Message**
```bash
git add LEGACY_MIGRATION_INSTRUCTIONS.md
git commit -m "docs: Update migration tracker - completed ServiceName migration

- Moved ServiceName to completed migrations
- Updated progress statistics
- Set next recommended migration: NextServiceName
- Migration date: YYYY-MM-DD"
```

### **Migration Cycle Template:**

```markdown
## 📋 Migration Cycle: [ServiceName]

### Pre-Migration:
- **Risk Level**: [LOW/MEDIUM/HIGH]
- **Dependencies**: [List any dependent services]
- **Usage Analysis**: [How many components use this service]

### Migration Steps:
1. ✅ Create new service in [new/location.ts]
2. ✅ Update legacy wrapper with deprecation warnings
3. ✅ Update component imports
4. ✅ Validate with TypeScript + Build
5. ✅ Update migration tracker

### Post-Migration:
- **Breaking Changes**: [None/Yes - list them]
- **Performance Impact**: [None/Positive/Negative]
- **Next Steps**: [Next recommended service]
```

This ensures **complete traceability** and prevents losing track of migration progress! 🎯

## 🚀 Success Metrics

**Before Migration:**
- ~50+ legacy service files
- Direct imports from legacy paths
- Scattered calculation logic
- Inconsistent naming patterns

**After Migration:**
- Clean architecture layers
- Single barrel import pattern: `@/services`
- Consolidated business logic in unified services
- Consistent naming: `UnifiedXService`, `XCalculations`, `XValidator`
- Zero legacy dependencies

This migration transforms the codebase into a maintainable, AI-friendly architecture that follows the single source of truth principle from your Architecture Guide.
