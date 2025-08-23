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
