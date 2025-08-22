# 🏗️ ARCHITECTURAL RULES - MUST FOLLOW

## 🚨 **CRITICAL: READ BEFORE ANY CODE CHANGES**

### **📊 CALCULATION RULES**
- ❌ **NEVER add calculations to components**
- ❌ **NEVER add math logic to hooks** 
- ❌ **NEVER duplicate calculation logic**
- ✅ **ALL calculations MUST use services from `/src/services/`**
- ✅ **Use memoized functions from `/src/services/index.ts`**

```typescript
// ❌ WRONG - Don't do this anywhere
const totalHours = milestones.reduce((sum, m) => sum + m.hours, 0);

// ✅ CORRECT - Always use services
import { calculateMilestoneMetrics } from '@/services';
const metrics = calculateMilestoneMetrics(milestones, projectBudget);
```

### **🔄 CONTEXT RULES**
- ❌ **NEVER add unrelated state to existing contexts**
- ❌ **NEVER create god objects like old AppContext**
- ✅ **Use specialized contexts**: ProjectContext, PlannerContext, TimelineContext, SettingsContext
- ✅ **Milestones belong to ProjectContext** (not separate context)

### **📁 FILE ORGANIZATION RULES**
- ❌ **NEVER put business logic in components**
- ❌ **NEVER put UI calculations in utils**
- ✅ **Services** → `/src/services/` (calculations, business logic)
- ✅ **Components** → Rendering only, import from services
- ✅ **Hooks** → State management only, delegate calculations to services

### **⚡ PERFORMANCE RULES**
- ❌ **NEVER do expensive calculations in render**
- ❌ **NEVER duplicate caching logic**
- ✅ **Use memoized calculation functions from services**
- ✅ **Let CalculationCacheService handle all caching**

### **🧪 TESTING RULES**
- ✅ **Test calculations in isolation** (services)
- ✅ **Mock services in component tests**
- ❌ **Don't test business logic through UI**

## 🎯 **BEFORE MAKING ANY CHANGE, ASK:**

1. **Is this a calculation?** → Use `/src/services/`
2. **Is this UI positioning?** → Use `TimelineCalculationService`
3. **Is this date math?** → Use `DateCalculationService`
4. **Is this project/milestone logic?** → Use `ProjectCalculationService`
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
