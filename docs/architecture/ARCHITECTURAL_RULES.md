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

**Need to calculate something?**
```typescript
import { 
  calculateProjectMetrics,
  calculateMilestoneMetrics,
  calculateProjectPosition,
  getBusinessDaysBetween 
} from '@/services';
```

**Need state management?**
- Projects/Milestones → `useProjectContext()`
- Timeline/Navigation → `useTimelineContext()`
- Events/Holidays → `usePlannerContext()`
- Settings/Work Hours → `useSettingsContext()`

**This file must be consulted before every change!**
