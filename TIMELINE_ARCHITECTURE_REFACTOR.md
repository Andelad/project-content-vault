# Timeline Architecture Refactor Plan

## 🎯 Executive Summary

**Problem**: Timeline rendering is broken because multiple services calculate day-level time estimates differently, causing:
- Milestones not appearing correctly
- Weeks view showing different rectangles than Days view
- Database schema storing percentages but code expecting hours

**Solution**: Establish a single source of truth for time calculations with clear separation of concerns.

---

## 📊 Current Problems

### 1. Database Schema Mismatch
```sql
-- CURRENT (WRONG):
time_allocation numeric CHECK (time_allocation >= 0 AND time_allocation <= 100)
-- Schema says "percentage" but code treats it as "hours"
```

### 2. Multiple Sources of Truth
- **Weeks view** uses `TimeAllocationService.generateTimeAllocation()`
- **Days view** uses `memoizedGetProjectTimeAllocation()`
- **Comment in code**: _"Don't use TimeAllocationService.generateTimeAllocation - it returns wrong values!"_

### 3. Recurring Milestones Stored in Wrong Place
- Pattern configuration stored in **localStorage** (client-only, not synced)
- Should be in database for multi-device support and data integrity

---

## 🏗️ Proposed Architecture

### Conceptual Layers

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: PROJECT (Identity + Time Boundaries)                  │
├─────────────────────────────────────────────────────────────────┤
│ DOMAIN: What is the project and when does it happen?           │
│                                                                 │
│ • id, name, client, notes, icon, color (IDENTITY)              │
│ • estimatedHours (TOTAL TIME BUDGET)                            │
│ • startDate, endDate, continuous (TIME BOUNDARIES)              │
│ • autoEstimateDays (WHICH DAYS TO USE)                          │
│                                                                 │
│ FILE: ProjectRepository.ts → projects table                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: MILESTONES (Split the Budget)                         │
├─────────────────────────────────────────────────────────────────┤
│ DOMAIN: How is the project's time budget divided?              │
│                                                                 │
│ • name (MILESTONE IDENTITY)                                     │
│ • timeAllocationHours (HOURS from project budget)               │
│ • startDate (auto-calculated or explicit)                       │
│ • endDate (user-defined "due date")                             │
│ • isRecurring, recurringConfig (PATTERN if applicable)          │
│                                                                 │
│ VALIDATION: Sum of milestone hours ≤ project.estimatedHours    │
│                                                                 │
│ FILE: MilestoneRepository.ts → milestones table                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: DAY ESTIMATES (Daily Distribution)                    │
├─────────────────────────────────────────────────────────────────┤
│ DOMAIN: How many hours on each specific day?                   │
│                                                                 │
│ CALCULATION PRIORITY:                                           │
│ 1. Planned events (calendar) → shows planned hours              │
│ 2. Milestone allocation → hours ÷ working days in milestone    │
│ 3. Project auto-estimate → hours ÷ working days in project     │
│                                                                 │
│ NOT STORED: Always calculated on-demand                         │
│                                                                 │
│ FILE: dayEstimateCalculations.ts (pure functions)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 4: TIMELINE RENDERING (Display)                          │
├─────────────────────────────────────────────────────────────────┤
│ DOMAIN: Show rectangles, handle interactions                   │
│                                                                 │
│ • Get day estimates from TimelineOrchestrator                   │
│ • Render rectangles (height = hours × scale)                    │
│ • Show milestone markers                                        │
│ • Handle drag, tooltips, interactions                           │
│                                                                 │
│ FILE: TimelineBar.tsx, WeeksView.tsx (use SAME orchestrator)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Migration

### Migration SQL

```sql
-- ============================================================================
-- MIGRATION: Fix Milestone Schema
-- ============================================================================

-- Step 1: Add new columns to milestones table
ALTER TABLE public.milestones
  ADD COLUMN time_allocation_hours numeric,
  ADD COLUMN start_date timestamp with time zone,
  ADD COLUMN is_recurring boolean DEFAULT false,
  ADD COLUMN recurring_config jsonb;

-- Step 2: Migrate existing data
-- ASSUMPTION: Current time_allocation is stored as HOURS (not percentage)
-- If it's actually percentage, we'd need: UPDATE milestones SET time_allocation_hours = (time_allocation / 100) * p.estimated_hours FROM projects p WHERE p.id = project_id
UPDATE public.milestones
  SET time_allocation_hours = time_allocation,
      start_date = due_date - INTERVAL '7 days', -- Default: 1 week before due date
      is_recurring = false,
      recurring_config = NULL;

-- Step 3: Make new column NOT NULL (after data migration)
ALTER TABLE public.milestones
  ALTER COLUMN time_allocation_hours SET NOT NULL,
  ADD CONSTRAINT milestones_time_allocation_hours_check 
    CHECK (time_allocation_hours >= 0);

-- Step 4: Drop old column (after app is updated)
-- WAIT FOR CODE DEPLOYMENT FIRST!
-- ALTER TABLE public.milestones DROP COLUMN time_allocation;

-- Step 5: Add index for recurring milestone queries
CREATE INDEX idx_milestones_is_recurring ON public.milestones(is_recurring) WHERE is_recurring = true;

-- ============================================================================
-- RECURRING CONFIG JSON STRUCTURE
-- ============================================================================
-- {
--   "type": "daily" | "weekly" | "monthly",
--   "interval": 1,
--   "weeklyDayOfWeek": 1,              // 0-6 for weekly
--   "monthlyPattern": "date",           // "date" or "dayOfWeek"
--   "monthlyDate": 15,                  // 1-31 for date pattern
--   "monthlyWeekOfMonth": 2,            // 1-4 for week-of-month pattern
--   "monthlyDayOfWeek": 2               // 0-6 for day-of-week pattern
-- }
```

### Data Migration Strategy

**Option A: Zero-Downtime Migration (Recommended)**

```
Phase 1: Add new columns (keep old column)
  ↓
Phase 2: Dual-write (write to both old and new columns)
  ↓
Phase 3: Backfill data (copy old → new for existing rows)
  ↓
Phase 4: Switch reads to new column
  ↓
Phase 5: Drop old column (after confirming no issues)
```

**Option B: Maintenance Window (Simpler)**

```
1. Announce 5-minute maintenance window
2. Run migration script
3. Deploy new code
4. Verify timeline rendering works
5. Monitor for 24 hours
6. Drop old column
```

### Will This Break Existing Data?

**NO** - if migrated correctly:

1. **Existing milestones**: `time_allocation` → `time_allocation_hours` (direct copy)
2. **Existing projects**: No changes needed
3. **localStorage recurring configs**: 
   - App will read from localStorage during transition
   - User action (edit milestone) will migrate to database
   - After 30 days, can remove localStorage fallback code

**User Experience During Migration:**
- ✅ Existing projects/milestones continue working
- ✅ Timeline continues rendering (may be wrong, but not broken)
- ✅ After code deployment, timeline uses new calculation
- ⚠️ Recurring milestones in localStorage need re-creation (one-time user action)

---

## 📁 File Structure

### New Architecture

```
src/
├── types/
│   └── core.ts                        # Updated type definitions
│
├── services/
│   ├── calculations/
│   │   ├── projectCalculations.ts     # Project-level time calculations
│   │   ├── milestoneCalculations.ts   # Milestone segmentation
│   │   └── dayEstimateCalculations.ts # ← NEW: Day-level distribution
│   │
│   ├── unified/
│   │   ├── UnifiedProjectService.ts   # Project business logic
│   │   ├── UnifiedMilestoneService.ts # Milestone business logic
│   │   └── UnifiedDayEstimateService.ts # ← NEW: Day estimate logic
│   │
│   ├── orchestrators/
│   │   ├── ProjectOrchestrator.ts     # Project workflows (merge TimelineOrchestrator into this)
│   │   ├── MilestoneOrchestrator.ts   # ← RENAMED: All milestone workflows
│   │   └── TimelineOrchestrator.ts    # ← NEW: Timeline data preparation
│   │
│   └── repositories/
│       ├── ProjectRepository.ts       # projects table CRUD
│       └── MilestoneRepository.ts     # milestones table CRUD (updated)
│
└── components/
    └── timeline/
        ├── TimelineBar.tsx            # ← UPDATED: Use TimelineOrchestrator
        └── WeeksView.tsx              # ← UPDATED: Use TimelineOrchestrator
```

---

## 🔧 Implementation Plan

### Phase 0: Documentation & Database (THIS PHASE)

**For Lovable AI:**
```
1. Review this migration plan
2. Execute database migration SQL (see "Database Migration" section)
3. Verify:
   - New columns exist
   - Existing data migrated to time_allocation_hours
   - No data loss
4. Report back: row count before/after, any errors
```

### Phase 1: Core Type Definitions (1 hour)

**Files to update:**
- `src/types/core.ts`

**Changes:**
```typescript
export interface Milestone {
  // ... existing fields ...
  
  // UPDATED: Time allocation
  timeAllocationHours: number; // Changed from timeAllocation
  
  // NEW: Date boundaries
  startDate?: Date;
  endDate: Date; // Renamed from dueDate for clarity
  
  // NEW: Recurring pattern
  isRecurring: boolean;
  recurringConfig?: RecurringConfig;
}

export interface RecurringConfig {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number;
  weeklyDayOfWeek?: number;
  monthlyPattern?: 'date' | 'dayOfWeek';
  monthlyDate?: number;
  monthlyWeekOfMonth?: number;
  monthlyDayOfWeek?: number;
}

export interface DayEstimate {
  date: Date;
  projectId: string;
  hours: number;
  source: 'planned-event' | 'milestone-allocation' | 'project-auto-estimate';
  milestoneId?: string;
  isWorkingDay: boolean;
}
```

### Phase 2: Day Estimate Calculations (3 hours)

**Create:** `src/services/calculations/dayEstimateCalculations.ts`

**Key Functions:**
```typescript
// SINGLE SOURCE OF TRUTH for day-level time
export function calculateProjectDayEstimates(
  project: Project,
  milestones: Milestone[],
  events: CalendarEvent[],
  settings: Settings,
  holidays: Holiday[]
): DayEstimate[]

// Helper: Find which milestone covers a date
function findMilestoneForDate(
  date: Date, 
  milestones: Milestone[]
): Milestone | null

// Helper: Calculate hours for a day within milestone
function calculateMilestoneSegmentHours(
  milestone: Milestone,
  date: Date,
  settings: Settings,
  holidays: Holiday[]
): number
```

### Phase 3: Unified Service Layer (2 hours)

**Create:** `src/services/unified/UnifiedDayEstimateService.ts`

**Key Methods:**
```typescript
export class UnifiedDayEstimateService {
  // Get day estimates (delegates to calculations)
  static getDayEstimates(...)
  
  // Validate milestones don't exceed project budget
  static validateMilestoneAllocations(...)
  
  // Get estimates for date range (with caching)
  static getDayEstimatesForRange(...)
}
```

### Phase 4: Timeline Orchestrator (2 hours)

**Create:** `src/services/orchestrators/TimelineOrchestrator.ts`

**Key Methods:**
```typescript
export class TimelineOrchestrator {
  // SINGLE METHOD for timeline rendering
  static async getTimelineData(
    projects: Project[],
    dateRange: { start: Date; end: Date },
    events: CalendarEvent[],
    settings: Settings,
    holidays: Holiday[]
  ): Promise<TimelineData>
}
```

### Phase 5: Repository Updates (1 hour)

**Update:** `src/services/repositories/MilestoneRepository.ts`

**Changes:**
- Map `time_allocation_hours` ↔ `timeAllocationHours`
- Map `start_date` ↔ `startDate`
- Map `is_recurring` ↔ `isRecurring`
- Map `recurring_config` ↔ `recurringConfig` (JSON)
- Handle backward compatibility (read old `time_allocation` if new column doesn't exist)

### Phase 6: Update Timeline Components (3 hours)

**Update:** `src/components/timeline/TimelineBar.tsx`

**Before:**
```typescript
// Multiple calls, different sources
const timeAllocation = memoizedGetProjectTimeAllocation(...)
const allocation = TimeAllocationService.generateTimeAllocation(...)
// Comment: "Don't use TimeAllocationService - wrong values!"
```

**After:**
```typescript
// Single source of truth
const { projectData } = await TimelineOrchestrator.getTimelineData(...)
const estimate = projectData[0].dayEstimates.find(...)
```

**Update:** `src/components/timeline/WeeksView.tsx` (same pattern)

### Phase 7: Consolidate Orchestrators (2 hours)

**Actions:**
1. Merge `ProjectTimelineOrchestrator` → `ProjectOrchestrator`
2. Rename `ProjectMilestoneOrchestrator` → `MilestoneOrchestrator`
3. Delete `TimeAllocationOrchestrator` (replaced by UnifiedDayEstimateService)
4. Update all imports

### Phase 8: Testing & Validation (4 hours)

**Test Cases:**
1. Project without milestones → auto-estimate rectangles appear
2. Project with milestones → milestone-based rectangles appear
3. Planned events → override auto-estimate
4. Recurring milestone → generates correct day estimates
5. Weeks view = Days view (same data)
6. Budget validation → milestones can't exceed project hours

### Phase 9: Cleanup (1 hour)

**Remove:**
- `TimeAllocationService` (orchestrator)
- `memoizedGetProjectTimeAllocation` (if no longer needed)
- localStorage recurring milestone code (after migration period)
- Old debug comments

---

## 🤔 Addressing Your Questions

### Question 1: Is this the simplest structure?

**YES** - It follows the **natural domain hierarchy**:

1. **Project** = The container (what + when + how much time)
2. **Milestones** = Optional subdivisions (chunks of time)
3. **Day Estimates** = Granular distribution (actual timeline rectangles)

This mirrors how users think: "I have a project, it might have milestones, I want to see daily breakdown."

### Question 2: Where do projects find their names, tags, clients, notes?

**ANSWER: Projects own ALL their data - identity AND time**

```typescript
// Project is a SINGLE entity with multiple concerns:

export interface Project {
  // ============================================================================
  // IDENTITY CONCERN (labels, metadata)
  // ============================================================================
  id: string;
  name: string;
  client: string;
  notes?: string;
  icon?: string;
  color: string;
  status?: ProjectStatus;
  
  // ============================================================================
  // ORGANIZATION CONCERN (grouping)
  // ============================================================================
  groupId: string;
  rowId: string;
  
  // ============================================================================
  // TIME CONCERN (budget and boundaries)
  // ============================================================================
  estimatedHours: number;      // How much time
  startDate: Date;             // When it starts
  endDate: Date;               // When it ends
  continuous?: boolean;        // Or is it ongoing
  autoEstimateDays?: {         // Which days to use
    monday: boolean;
    // ... etc
  };
  
  // ============================================================================
  // AUDIT CONCERN (tracking)
  // ============================================================================
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Projects are NOT split** - they contain all concerns in one entity.

**The CALCULATIONS are split** into layers:
- `projectCalculations.ts` - Works with project time data
- `milestoneCalculations.ts` - Works with milestone time data
- `dayEstimateCalculations.ts` - Works with day-level time data

### Question 3: Should time be its separate thing?

**NO** - Time is **part of** the Project and Milestone entities.

**What IS separate:**
- **Calculations** (pure functions for time math)
- **Day Estimates** (not stored, calculated on-demand)

**Analogy:**
```
Project = Person
  ├─ name, age, email      (identity)
  ├─ job, company          (work concern)
  └─ height, weight        (physical concern)

You don't split Person into:
  - PersonIdentity
  - PersonWork
  - PersonPhysical

You keep Person unified, but have SERVICES that work with specific concerns:
  - IdentityService (validates emails)
  - WorkService (calculates salary)
  - HealthService (calculates BMI)
```

### Question 4: How do orchestrators mix labels, data, and time?

**ANSWER: Orchestrators coordinate WORKFLOWS, not storage**

```typescript
// ProjectOrchestrator handles WORKFLOWS that touch EVERYTHING:

export class ProjectOrchestrator {
  /**
   * Create project workflow
   * Touches: identity (name), time (dates), organization (groupId)
   */
  static async createProject(input: CreateProjectInput) {
    // 1. Validate name (identity concern)
    if (!input.name) throw new Error('Name required');
    
    // 2. Validate dates (time concern)
    if (input.endDate < input.startDate) throw new Error('Invalid dates');
    
    // 3. Validate budget (time concern)
    if (input.estimatedHours <= 0) throw new Error('Invalid hours');
    
    // 4. Save to database (ALL concerns together)
    return ProjectRepository.create({
      name: input.name,
      client: input.client,
      notes: input.notes,
      estimatedHours: input.estimatedHours,
      startDate: input.startDate,
      endDate: input.endDate,
      // ... all fields together
    });
  }
}
```

**The orchestrator doesn't separate concerns** - it validates and coordinates the ENTIRE entity.

**The separation happens in CALCULATIONS:**

```typescript
// Different calculation files work with different aspects:

// projectCalculations.ts - Time math only
export function calculateProjectDuration(start: Date, end: Date): number

// (hypothetical) projectValidations.ts - Identity validation
export function validateProjectName(name: string): ValidationResult

// (hypothetical) projectFormatters.ts - Display formatting
export function formatProjectLabel(project: Project): string
```

---

## 🎯 Why This Structure Works

### Single Responsibility at Each Layer

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Types** | Define data structure | `interface Project { ... }` |
| **Repository** | Database CRUD | `ProjectRepository.create()` |
| **Calculations** | Pure time math | `calculateProjectDuration()` |
| **Unified Services** | Business logic | `UnifiedProjectService.validateBudget()` |
| **Orchestrators** | Multi-step workflows | `ProjectOrchestrator.createProject()` |
| **Components** | UI rendering | `<TimelineBar />` |

### Data Ownership

| Entity | Owns | Doesn't Own |
|--------|------|-------------|
| **Project** | name, client, notes, hours, dates | Day estimates (calculated) |
| **Milestone** | name, hours, dates, pattern | Day estimates (calculated) |
| **CalendarEvent** | title, startTime, endTime | Project identity |

### Calculation Dependencies

```
projectCalculations.ts (no dependencies)
  ↓
milestoneCalculations.ts (uses projectCalculations)
  ↓
dayEstimateCalculations.ts (uses both)
```

---

## 📋 For Lovable: Database Migration Checklist

```sql
-- Execute these in order:

-- 1. Backup current data
CREATE TABLE milestones_backup AS SELECT * FROM milestones;

-- 2. Add new columns
ALTER TABLE public.milestones
  ADD COLUMN time_allocation_hours numeric,
  ADD COLUMN start_date timestamp with time zone,
  ADD COLUMN is_recurring boolean DEFAULT false,
  ADD COLUMN recurring_config jsonb;

-- 3. Migrate data (ADJUST IF time_allocation is percentage!)
UPDATE public.milestones
  SET time_allocation_hours = time_allocation,
      start_date = due_date - INTERVAL '7 days',
      is_recurring = false,
      recurring_config = NULL;

-- 4. Verify migration
SELECT 
  COUNT(*) as total_milestones,
  COUNT(time_allocation_hours) as migrated_hours,
  COUNT(start_date) as migrated_dates
FROM public.milestones;
-- Should show: total_milestones = migrated_hours = migrated_dates

-- 5. Make column NOT NULL
ALTER TABLE public.milestones
  ALTER COLUMN time_allocation_hours SET NOT NULL,
  ADD CONSTRAINT milestones_time_allocation_hours_check 
    CHECK (time_allocation_hours >= 0);

-- 6. Create index
CREATE INDEX idx_milestones_is_recurring ON public.milestones(is_recurring) 
  WHERE is_recurring = true;

-- 7. DON'T drop old column yet - wait for code deployment
-- We'll drop it in a follow-up migration after validating
```

**Questions for Lovable:**
1. What is the CURRENT value range of `time_allocation`? (0-100 = percentage, or actual hours?)
2. How many milestone rows exist in production?
3. Can you execute this migration in a transaction for rollback safety?

---

## 🚀 Next Steps

1. **You**: Review this plan, ask questions
2. **Lovable**: Execute database migration
3. **Me**: Implement Phase 1-2 (types + calculations)
4. **You**: Test locally
5. **Me**: Implement Phase 3-6 (services + components)
6. **You**: UAT testing
7. **Both**: Deploy to production
8. **Me**: Cleanup phase (remove old code)

---

## ⏱️ Estimated Timeline

- **Database Migration**: 30 minutes (Lovable)
- **Code Implementation**: 18 hours (phases 1-8)
- **Testing**: 4 hours
- **Deployment**: 1 hour
- **Monitoring**: 24 hours
- **Cleanup**: 1 hour

**Total**: ~3-4 days for complete refactor

---

## 🛡️ Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Backup table before ALTER |
| Breaking production | Keep old column during transition |
| Different views show different data | Both use same TimelineOrchestrator |
| Performance regression | Add indexes, cache day estimates |
| User confusion | No UI changes, just fixes bugs |

---

## 📞 Support

Questions? Issues? Observations?
- **Architecture**: Ask about layer responsibilities
- **Migration**: Ask Lovable about database state
- **Implementation**: I'll handle code changes
