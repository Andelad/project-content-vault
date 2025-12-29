# Type Alignment Analysis: core.ts vs App Logic/Business Logic

**Created:** December 27, 2025  
**Purpose:** Assess how well current TypeScript types align with documented business logic  
**Status:** 🔍 Analysis Complete

---

## 📊 Overall Assessment

**Alignment Score: 65/100** ⚠️ **Moderate Misalignment**

### Summary:
- ✅ **Good:** Core entity structures exist
- ⚠️ **Issues:** Terminology mismatches, missing properties, deprecated fields not cleaned up
- ❌ **Critical:** Row entity exists in types but removed from documentation
- ❌ **Critical:** Using "Milestone" instead of "Phase" throughout

---

## 🔍 Entity-by-Entity Analysis

### 1. User ✅ **ALIGNED** (95/100)

**App Logic Definition:**
- ID (unique identifier)
- Email (authentication)
- Managed by Supabase Auth

**Type Implementation:**
```typescript
// NOT EXPLICITLY DEFINED - Managed by Supabase Auth
```

**Status:** ✅ Correct approach - User managed by Supabase Auth, not in core.ts

**Issues:** None

**Recommendations:** None needed

---

### 2. Client ✅ **WELL ALIGNED** (90/100)

**App Logic Definition:**
```
Properties:
- Name (required, unique per user, case-insensitive)
- Status (active, inactive, archived)
- Contact email (optional, basic validation)
- Contact phone (optional)
- Billing address (optional)
- Notes (optional)
```

**Type Implementation:**
```typescript
export type ClientStatus = 'active' | 'inactive' | 'archived'; // ✅ CORRECT

export interface Client {
  id: string;                    // ✅ Implicit in App Logic
  name: string;                  // ✅ CORRECT
  status: ClientStatus;          // ✅ CORRECT
  contactEmail?: string;         // ✅ CORRECT
  contactPhone?: string;         // ✅ CORRECT
  billingAddress?: string;       // ✅ CORRECT
  notes?: string;                // ✅ CORRECT
  userId: string;                // ✅ CORRECT (implicit in App Logic)
  createdAt: Date;               // ✅ CORRECT (implicit)
  updatedAt: Date;               // ✅ CORRECT (implicit)
}
```

**Status:** ✅ Excellent alignment

**Issues:** 
- None - type accurately reflects App Logic

**Recommendations:**
- Add JSDoc comments referencing App Logic.md sections

---

### 3. Project ⚠️ **PARTIALLY ALIGNED** (70/100)

**App Logic Definition:**
```
Essential:
- Name
- Client (clientId - required foreign key)
- Start date
- Estimated hours (>= 0)

Conditional:
- End date (REQUIRED for time-limited, NULL for continuous)

Organizational:
- Group (currently required, 1 per project)
- Labels (0, 1, or many)
- Working day overrides

Types:
- Time-Limited: has end date, auto-estimates distributed
- Continuous: NULL end date, no auto-estimates
```

**Type Implementation:**
```typescript
export interface Project {
  id: string;                    // ✅ CORRECT
  name: string;                  // ✅ CORRECT
  client: string;                // ❌ DEPRECATED - should remove after migration
  clientId: string;              // ✅ CORRECT - NEW proper foreign key
  startDate: Date;               // ✅ CORRECT
  endDate: Date;                 // ⚠️ MISLEADING - should be Date | null
  estimatedHours: number;        // ✅ CORRECT
  color: string;                 // ✅ CORRECT (implicit in App Logic)
  groupId: string;               // ✅ CORRECT - required
  rowId?: string;                // ❌ DEPRECATED - Row entity removed
  notes?: string;                // ✅ CORRECT (implicit)
  icon?: string;                 // ✅ CORRECT (implicit)
  milestones?: Milestone[];      // ❌ WRONG TERM - should be phases?: Phase[]
  continuous?: boolean;          // ✅ CORRECT - distinguishes project types
  status?: ProjectStatus;        // ✅ CORRECT
  autoEstimateDays?: {           // ❌ MISSING FROM APP LOGIC - needs documentation
    monday: boolean;
    tuesday: boolean;
    // ... etc
  };
  userId: string;                // ✅ CORRECT
  createdAt: Date;               // ✅ CORRECT
  updatedAt: Date;               // ✅ CORRECT
  
  // Populated by joins
  clientData?: Client;           // ✅ CORRECT
  labels?: Label[];              // ✅ CORRECT
}
```

**Issues:**
1. ❌ **`client: string`** - Deprecated field still present (should remove)
2. ❌ **`rowId?: string`** - Row entity removed from App Logic but still in types
3. ❌ **`milestones?: Milestone[]`** - Wrong terminology, should be `phases`
4. ⚠️ **`endDate: Date`** - Should be `Date | null` to allow continuous projects
5. ❌ **`autoEstimateDays`** - Not documented in App Logic (needs doc update or removal)

**Recommendations:**
1. **HIGH PRIORITY:** Change `endDate: Date` → `endDate: Date | null`
2. **HIGH PRIORITY:** Change `milestones?: Milestone[]` → `phases?: Phase[]`
3. **MEDIUM:** Remove deprecated `client: string` field
4. **MEDIUM:** Remove deprecated `rowId?: string` field
5. **LOW:** Document `autoEstimateDays` in App Logic or remove if unused

---

### 4. Phase/Milestone ❌ **CRITICAL MISALIGNMENT** (40/100)

**App Logic Definition:**
```
Name: "Phase" (NOT Milestone)

Essential:
- Project (projectId)
- Type (explicit, recurring)
- Date range (start/end for explicit, pattern for recurring)

Type-Specific:
Explicit Phase:
  - Start date
  - End date
  - Time allocation hours

Recurring Phase:
  - Pattern (daily, weekly, monthly)
  - Hours per occurrence
  - Specific days

Rules:
- Project has EITHER explicit phases OR recurring phase, NEVER both
- Explicit: no overlaps, gaps allowed, last phase = project end
- Recurring: continues until project end
```

**Type Implementation:**
```typescript
export interface Milestone {  // ❌ WRONG NAME - should be Phase
  id: string;
  name: string;
  projectId: string;           // ✅ CORRECT
  
  // PRIMARY FIELDS
  endDate: Date;               // ✅ CORRECT for explicit phases
  timeAllocationHours: number; // ✅ CORRECT
  startDate?: Date;            // ✅ CORRECT (optional)
  
  // BACKWARD COMPATIBILITY
  dueDate: Date;               // ❌ DEPRECATED - remove
  timeAllocation: number;      // ❌ DEPRECATED - remove
  
  // RECURRING PATTERNS
  isRecurring?: boolean;       // ✅ CORRECT concept
  recurringConfig?: RecurringConfig; // ✅ CORRECT
  
  // METADATA
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringConfig {
  type: 'daily' | 'weekly' | 'monthly';     // ✅ CORRECT
  interval: number;                          // ✅ CORRECT
  weeklyDayOfWeek?: number;                  // ✅ CORRECT
  monthlyPattern?: 'date' | 'dayOfWeek';     // ✅ CORRECT
  monthlyDate?: number;                      // ✅ CORRECT
  monthlyWeekOfMonth?: number;               // ✅ CORRECT
  monthlyDayOfWeek?: number;                 // ✅ CORRECT
}
```

**Issues:**
1. ❌ **CRITICAL:** Named `Milestone` instead of `Phase`
2. ❌ **`dueDate: Date`** - Deprecated field still required (should remove)
3. ❌ **`timeAllocation: number`** - Deprecated field still required (should remove)
4. ⚠️ Missing clear type discrimination between explicit and recurring phases
5. ⚠️ `RecurringConfig` doesn't capture "hours per occurrence" clearly

**Recommendations:**
1. **CRITICAL:** Rename `Milestone` → `Phase` (see MILESTONE_TO_PHASE_MIGRATION.md)
2. **HIGH:** Remove deprecated `dueDate` and `timeAllocation` fields
3. **MEDIUM:** Add discriminated union for explicit vs recurring:
   ```typescript
   export type Phase = ExplicitPhase | RecurringPhase;
   
   interface BasePhase {
     id: string;
     name?: string;
     projectId: string;
     userId: string;
     createdAt: Date;
     updatedAt: Date;
   }
   
   interface ExplicitPhase extends BasePhase {
     type: 'explicit';
     startDate: Date;
     endDate: Date;
     timeAllocationHours: number;
   }
   
   interface RecurringPhase extends BasePhase {
     type: 'recurring';
     recurringConfig: RecurringConfig & {
       hoursPerOccurrence: number;  // Make this explicit
     };
   }
   ```

---

### 5. Group ⚠️ **MOSTLY ALIGNED** (85/100)

**App Logic Definition:**
```
Essential:
- Name (unique per user, case-insensitive)

Optional:
- Icon
- Color
- Order

Rules:
- Projects MUST belong to exactly 1 group (currently)
- Groups represent major life areas
```

**Type Implementation:**
```typescript
export interface Group {
  id: string;
  name: string;              // ✅ CORRECT
  userId: string;            // ✅ CORRECT
  createdAt: Date;
  updatedAt: Date;
  // REMOVED (Phase 5B): color and description fields removed from database
}
```

**Issues:**
1. ⚠️ Missing `order` property (mentioned in App Logic as "currently required")
2. ⚠️ Missing optional `icon` property (mentioned in App Logic)
3. ⚠️ Missing optional `color` property (comment says removed, but App Logic says optional)

**Recommendations:**
1. **MEDIUM:** Clarify in App Logic whether color/icon are truly removed or optional
2. **LOW:** Add `order?: number` if used for display sequencing

---

### 6. Label ✅ **WELL ALIGNED** (95/100)

**App Logic Definition:**
```
Essential:
- Name (unique per user, case-insensitive)

Optional:
- Color
```

**Type Implementation:**
```typescript
export interface Label {
  id: string;
  name: string;              // ✅ CORRECT
  color?: string;            // ✅ CORRECT
  userId: string;            // ✅ CORRECT
  createdAt: Date;
  updatedAt: Date;
}
```

**Status:** ✅ Perfect alignment

**Issues:** None

**Recommendations:** None needed

---

### 7. Calendar Event ⚠️ **COMPLEX ALIGNMENT** (75/100)

**App Logic Definition:**
```
Essential:
- Start time (specific time of day)
- End time (specific time of day)
- Type (normal, tracked, completed, habit, task)

Optional:
- Project (projectId)
- Title
- Description
- Category (habit, task, meeting)
- Completed (boolean)

Rules:
- Events linked to project count toward project time
- Habits NEVER count toward project time
- Tasks NEVER count toward project time
- Event on a day removes that day from auto-estimate
- Single-day events only (UI doesn't support multi-day)
```

**Type Implementation:**
```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;           // ✅ CORRECT
  endTime: Date;             // ✅ CORRECT
  projectId?: string;        // ✅ CORRECT
  color: string;
  completed?: boolean;       // ✅ CORRECT
  description?: string;      // ✅ CORRECT
  duration?: number;         // ✅ CORRECT (calculated)
  type?: 'planned' | 'tracked' | 'completed'; // ⚠️ PARTIAL - missing 'habit', 'task'
  category?: 'event' | 'habit' | 'task';      // ✅ CORRECT
  rrule?: string;            // ✅ CORRECT (NEW recurring system)
  recurring?: {              // ⚠️ LEGACY - marked for deprecation
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Date;
    count?: number;
    monthlyPattern?: 'date' | 'dayOfWeek';
    monthlyDate?: number;
    monthlyWeekOfMonth?: number;
    monthlyDayOfWeek?: number;
  };
  recurringGroupId?: string;
  // Midnight-crossing properties
  originalEventId?: string;
  isSplitEvent?: boolean;
}
```

**Issues:**
1. ⚠️ **`type`** property incomplete - should include 'habit' and 'task' types
2. ⚠️ Dual recurring system (`rrule` vs legacy `recurring`) - needs migration plan
3. ⚠️ `isSplitEvent` contradicts App Logic: "UI does not provide tools for creating multi-day events"

**Recommendations:**
1. **MEDIUM:** Expand `type` union: `'planned' | 'tracked' | 'completed' | 'habit' | 'task'`
2. **LOW:** Document migration plan for legacy `recurring` → `rrule`
3. **LOW:** Clarify midnight-crossing event handling in App Logic

---

### 8. Work Slot ✅ **WELL ALIGNED** (90/100)

**App Logic Definition:**
```
Essential:
- Start time (e.g., 9:00 AM)
- End time (e.g., 5:00 PM)
- Day of week

Calculated:
- Duration (from start/end)

Rules:
- Cannot cross midnight
- Multiple slots per day allowed
- Recurs weekly
```

**Type Implementation:**
```typescript
export interface WorkSlot {
  id: string;
  startTime: string;         // ✅ CORRECT - HH:MM format
  endTime: string;           // ✅ CORRECT - HH:MM format
  duration: number;          // ✅ CORRECT - calculated
}
```

**Issues:**
1. ⚠️ Missing `dayOfWeek` property (mentioned in App Logic as essential)

**Recommendations:**
1. **MEDIUM:** Add `dayOfWeek?: string` or link to Settings structure

**Note:** WorkSlot is embedded in Settings.weeklyWorkHours, which implicitly provides day context. Type may be correct as-is, but App Logic could clarify this.

---

### 9. Holiday ✅ **WELL ALIGNED** (95/100)

**App Logic Definition:**
```
Essential:
- Start date
- End date (can be same as start for single day)

Optional:
- Name
- Recurs annually (boolean)
```

**Type Implementation:**
```typescript
export interface Holiday {
  id: string;
  title: string;             // ✅ CORRECT (called "name" in App Logic)
  startDate: Date;           // ✅ CORRECT
  endDate: Date;             // ✅ CORRECT
  notes?: string;            // ✅ CORRECT (implicit in App Logic)
}
```

**Issues:**
1. ⚠️ Missing `recursAnnually?: boolean` property (mentioned in App Logic)

**Recommendations:**
1. **LOW:** Add `recursAnnually?: boolean` if feature exists
2. **LOW:** Clarify in App Logic if this is planned or implemented

---

### 10. Row ❌ **SHOULD NOT EXIST** (0/100)

**App Logic Definition:**
```
NOT DEFINED - This entity was removed from App Logic
```

**Type Implementation:**
```typescript
export interface Row {
  id: string;
  groupId: string;
  name: string;
  order: number;
}
```

**Issues:**
1. ❌ **CRITICAL:** Row entity exists in types but was removed from App Logic
2. ❌ Project has deprecated `rowId?: string` field

**Recommendations:**
1. **HIGH PRIORITY:** Remove `Row` interface entirely
2. **HIGH PRIORITY:** Remove `rowId` from `Project` interface
3. **MEDIUM:** Search codebase for Row usage and eliminate

---

### 11. Settings ✅ **ALIGNED** (90/100)

**App Logic Definition:**
```
Weekly work hours configuration
Default view
Compact view option
```

**Type Implementation:**
```typescript
export interface Settings {
  weeklyWorkHours: {
    monday: WorkSlot[];      // ✅ CORRECT
    tuesday: WorkSlot[];
    wednesday: WorkSlot[];
    thursday: WorkSlot[];
    friday: WorkSlot[];
    saturday: WorkSlot[];
    sunday: WorkSlot[];
  };
  defaultView?: string;      // ✅ CORRECT
  isCompactView?: boolean;   // ✅ CORRECT
}
```

**Status:** ✅ Good alignment

**Issues:** None major

**Recommendations:** None needed

---

### 12. DayEstimate ⚠️ **NEEDS REVIEW** (70/100)

**App Logic Definition:**
```
Derived concept - calculated time for a day
Sources:
- Event time (planned or completed)
- Phase allocation (calculated estimate)
- Project auto-estimate (calculated estimate)

Rules:
- Events and estimates are mutually exclusive per day
- A day shows EITHER events OR estimates, never both
```

**Type Implementation:**
```typescript
export interface DayEstimate {
  date: Date;
  projectId: string;
  hours: number;
  source: 'event' | 'milestone-allocation' | 'project-auto-estimate'; // ❌ Uses "milestone"
  milestoneId?: string;      // ❌ Should be phaseId
  isWorkingDay: boolean;
  isPlannedEvent?: boolean;
  isCompletedEvent?: boolean;
}
```

**Issues:**
1. ❌ **`source`** uses "milestone-allocation" instead of "phase-allocation"
2. ❌ **`milestoneId`** should be `phaseId`
3. ⚠️ Type doesn't enforce mutual exclusivity of event vs estimate sources

**Recommendations:**
1. **HIGH:** Change `'milestone-allocation'` → `'phase-allocation'`
2. **HIGH:** Rename `milestoneId` → `phaseId`
3. **MEDIUM:** Consider discriminated union to enforce source types:
   ```typescript
   type DayEstimate = 
     | { source: 'event'; isPlannedEvent: boolean; isCompletedEvent: boolean }
     | { source: 'phase-allocation'; phaseId: string }
     | { source: 'project-auto-estimate' };
   ```

---

## 📋 Critical Issues Summary

### 🔴 **CRITICAL (Must Fix Soon):**

1. **Terminology Mismatch: Milestone → Phase**
   - `Milestone` interface should be `Phase`
   - All "milestone" references should be "phase"
   - Affects: Milestone type, DayEstimate.source, all related code
   - **Action:** Execute MILESTONE_TO_PHASE_MIGRATION.md plan

2. **Row Entity Exists in Types but Removed from App Logic**
   - `Row` interface should be deleted
   - `Project.rowId` should be removed
   - **Action:** Remove Row-related code

3. **Project.endDate Type Mismatch**
   - Currently: `endDate: Date` (always required)
   - Should be: `endDate: Date | null` (nullable for continuous projects)
   - **Action:** Update type definition and all usages

### 🟡 **HIGH PRIORITY (Fix Soon):**

4. **Deprecated Fields Not Removed**
   - `Project.client: string` (use `clientId`)
   - `Milestone.dueDate` (use `endDate`)
   - `Milestone.timeAllocation` (use `timeAllocationHours`)
   - **Action:** Remove deprecated fields after migration

5. **Missing Type Discrimination for Phase Types**
   - Explicit vs Recurring phases use same interface
   - Hard to enforce business rules at type level
   - **Action:** Consider discriminated union (see Phase recommendations)

### 🟢 **MEDIUM PRIORITY (Plan for Later):**

6. **Undocumented Features in Types**
   - `Project.autoEstimateDays` - not in App Logic
   - `CalendarEvent` dual recurring systems
   - **Action:** Update App Logic or remove from types

7. **Missing Properties**
   - `Group.order`, `Group.icon`, `Group.color` - mentioned in App Logic
   - `Holiday.recursAnnually` - mentioned in App Logic
   - `WorkSlot.dayOfWeek` - mentioned as essential in App Logic
   - **Action:** Add to types or clarify in App Logic

---

## ✅ Well-Aligned Entities

These entities have excellent alignment and need minimal changes:

1. ✅ **Client** (90/100) - Nearly perfect
2. ✅ **Label** (95/100) - Perfect alignment
3. ✅ **Settings** (90/100) - Good structure
4. ✅ **Work Slot** (90/100) - Clean, simple
5. ✅ **Holiday** (95/100) - Very close

---

## 📊 Alignment Metrics

| Entity | Alignment Score | Status | Priority |
|--------|----------------|--------|----------|
| User | 95/100 | ✅ Aligned | None |
| Client | 90/100 | ✅ Aligned | Low |
| Project | 70/100 | ⚠️ Issues | **HIGH** |
| Phase/Milestone | 40/100 | ❌ Critical | **CRITICAL** |
| Group | 85/100 | ⚠️ Minor | Medium |
| Label | 95/100 | ✅ Aligned | None |
| CalendarEvent | 75/100 | ⚠️ Issues | Medium |
| WorkSlot | 90/100 | ✅ Aligned | Low |
| Holiday | 95/100 | ✅ Aligned | Low |
| Row | 0/100 | ❌ Remove | **HIGH** |
| Settings | 90/100 | ✅ Aligned | None |
| DayEstimate | 70/100 | ⚠️ Issues | **HIGH** |

**Overall Average: 72/100** ⚠️

---

## 🎯 Recommended Action Plan

### **Phase 1: Critical Fixes (Week 1)**
1. Execute MILESTONE_TO_PHASE_MIGRATION.md (Layer 0: Types)
2. Remove Row entity and Project.rowId
3. Fix Project.endDate to be nullable

### **Phase 2: Cleanup (Week 2)**
4. Remove all deprecated fields
5. Add missing properties (Group.order, Holiday.recursAnnually, etc.)
6. Document or remove undocumented features

### **Phase 3: Enhancement (Week 3)**
7. Consider discriminated unions for Phase types
8. Improve type safety with stricter types
9. Add comprehensive JSDoc comments linking to App Logic.md

---

## 📝 Documentation Recommendations

### **App Logic.md Updates Needed:**
1. Clarify Group properties (color, icon, order - are they removed or optional?)
2. Document `Project.autoEstimateDays` or mark for removal
3. Add section on recurring event migration (legacy vs rrule)
4. Clarify midnight-crossing event handling

### **Business Logic.md Updates Needed:**
1. Update all "Milestone" references to "Phase"
2. Add validation rules for Phase type discrimination
3. Document continuous project endDate handling

### **Types Enhancement:**
1. Add JSDoc comments with `@see` references to App Logic.md sections
2. Mark deprecated fields with `@deprecated` tags and removal dates
3. Add inline comments explaining complex type relationships

---

**Next Steps:**
1. Review this analysis with team
2. Prioritize fixes (Critical → High → Medium)
3. Execute MILESTONE_TO_PHASE_MIGRATION.md starting with Layer 0 (Types)
4. Update documentation concurrently with type changes

**Last Updated:** December 27, 2025  
**Reviewed By:** [Pending]  
**Status:** 📋 Ready for Review
