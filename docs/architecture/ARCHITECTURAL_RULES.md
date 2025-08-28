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

2. **📁 Add to Existing Files Efficiently**
   - ✅ **Add to existing service files in the same domain**
   - ✅ **Keep related calculations together (e.g., all duration functions in work-hours)**
   - ✅ **Only create new files when domain doesn't exist**
   - ✅ **Consider file size: split when >500 lines**
   - ❌ **Don't create single-function files**
   - ❌ **Don't duplicate across multiple services**

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
- [ ] Searched existing services for similar functionality
- [ ] Confirmed no duplicates exist
- [ ] Added to correct feature folder
- [ ] Updated service index.ts exports
- [ ] Tested build passes
- [ ] No linting errors introduced

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

**Is this a calculation?** → Use `/src/services/`  
**Is this UI state?** → Use appropriate context  
**Is this rendering?** → Component only  
**Is this business logic?** → Services, not components  

---

*Follow these rules to maintain clean, performant, and maintainable architecture.*
5. **Does this need state?** → Which specialized context?

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

Before any code change:
- [ ] Am I adding calculation logic? → Use services
- [ ] Am I duplicating existing functionality? → Check services first
- [ ] Am I putting business logic in components? → Move to services
- [ ] Am I creating new contexts? → Do specialized ones exist?
- [ ] Am I ignoring existing architecture? → Follow the patterns

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
