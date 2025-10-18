# Business Logic Reference
## Single Source of Truth for Domain Rules and Relationships

**Document Version**: 1.0.0  
**Last Updated**: October 18, 2025  
**Status**: Foundation Document  

---

## Purpose

This document serves as the **single source of truth** for all business logic, domain rules, entity relationships, and invariants in the Time Forecasting Application. When making changes, validating features, or debugging issues, **refer to this document first**.

---

## Table of Contents

1. [Domain Model Overview](#domain-model-overview)
2. [Core Entities](#core-entities)
3. [Entity Relationships](#entity-relationships)
4. [Business Rules](#business-rules)
5. [Invariants (Always True)](#invariants-always-true)
6. [Validation Rules](#validation-rules)
7. [Calculation Rules](#calculation-rules)
8. [State Transitions](#state-transitions)
9. [Edge Cases & Constraints](#edge-cases--constraints)

---

## Domain Model Overview

The application models a **time forecasting and project planning** system where:

- **Users** organize work into **Projects**
- **Projects** are organized within **Groups** and **Rows**
- **Projects** have **Milestones** that break down work into smaller deliverables
- Time is tracked through **Calendar Events** and **Work Hours**
- **Settings** define working schedules and system preferences

```
User
  └─ Groups
      └─ Rows
          └─ Projects (belongs to Client)
              ├─ Milestones
              ├─ Calendar Events
              └─ Time Entries
  └─ Settings (work hours, holidays)
  └─ Work Hours
  └─ Holidays
```

---

## Core Entities

### 1. User
**Purpose**: Application user account (managed by Supabase Auth)

**Properties**: Inherited from `auth.users`

**Business Rules**:
- Each user has isolated data (Row Level Security enforced)
- User deletion cascades to all owned entities

---

### 2. Group
**Purpose**: Top-level organization for projects (e.g., "Client Work", "Internal", "Personal")

**Properties**:
```typescript
{
  id: string
  name: string
  description: string
  color: string (hex code, e.g., "#FF5733")
  userId: string
  createdAt: Date
  updatedAt: Date
}
```

**Business Rules**:
- Group must have a unique name per user
- Group color must be a valid hex code
- Deleting a group cascades to all rows and projects within it

---

### 3. Row
**Purpose**: Sub-organization within groups (e.g., "Consulting", "Product Development")

**Properties**:
```typescript
{
  id: string
  groupId: string
  name: string
  order: number  // For display ordering
  userId: string
  createdAt: Date
  updatedAt: Date
}
```

**Business Rules**:
- Row must belong to a valid group
- Row order determines display sequence within a group
- Deleting a row cascades to all projects within it

**Relationships**:
- Belongs to: ONE Group
- Has many: Projects

---

### 4. Project
**Purpose**: A work initiative with defined timeline and resource allocation

**Properties**:
```typescript
{
  id: string
  name: string
  client: string  // Client name (note: not a foreign key, just a label)
  groupId: string
  rowId: string
  startDate: Date
  endDate: Date
  estimatedHours: number  // Total project budget in hours
  color: string (hex code)
  notes?: string
  icon?: string  // Lucide icon name, default: 'folder'
  continuous?: boolean  // True if project has no end date
  status?: 'current' | 'future' | 'archived'
  autoEstimateDays?: {  // Days to include in auto-estimation
    monday: boolean
    tuesday: boolean
    wednesday: boolean
    thursday: boolean
    friday: boolean
    saturday: boolean
    sunday: boolean
  }
  userId: string
  createdAt: Date
  updatedAt: Date
}
```

**Business Rules**:
- **Project must have a valid start date**
- **For time-limited projects: end date must be after start date**
- **Continuous projects have no end date** (continuous = true)
- **Estimated hours must be positive** (> 0)
- **Project must belong to a valid Row and Group**
- **Client is a text label** (not a foreign key relationship)
- Auto-estimate days default to all true if not specified

**Relationships**:
- Belongs to: ONE Row (which belongs to ONE Group)
- Has many: Milestones
- Has many: Calendar Events
- Associated with: Client (text label, not entity)

---

### 5. Milestone
**Purpose**: A specific deliverable or checkpoint within a project with its own time allocation

**Properties**:
```typescript
{
  id: string
  name: string
  projectId: string
  
  // NEW FIELDS (Phase 5 migration)
  startDate?: Date  // When milestone work begins
  endDate: Date  // Milestone deadline (replaces dueDate)
  timeAllocationHours: number  // Hours allocated (replaces timeAllocation)
  
  // DEPRECATED (backward compatibility)
  dueDate: Date  // Use endDate instead
  timeAllocation: number  // Use timeAllocationHours instead
  
  // Recurring milestones
  isRecurring?: boolean
  recurringConfig?: RecurringConfig
  
  order: number  // Display/execution order
  userId: string
  createdAt: Date
  updatedAt: Date
}
```

**Business Rules**:
- **Milestone must belong to a valid project**
- **Milestone endDate must fall within project's startDate and endDate**
- **Milestone timeAllocationHours must be positive** (> 0)
- **Sum of all milestone allocations ≤ project estimatedHours** (cannot exceed budget)
- **Milestone order determines execution sequence**
- If `startDate` is provided, it must be before `endDate`
- Recurring milestones follow the pattern in `recurringConfig`

**Relationships**:
- Belongs to: ONE Project
- Constrained by: Project dates and budget

---

### 6. Client (Conceptual Entity)
**Purpose**: Organization or individual that projects are delivered for

**Implementation**: Currently stored as a **text field** (`project.client`)

**Business Rules**:
- Client is a label, not a foreign key entity
- Multiple projects can have the same client name
- Client names are free-form text

**Future Consideration**: Could be normalized into a separate `clients` table with:
```typescript
{
  id: string
  name: string
  contactInfo?: string
  userId: string
}
```

**Relationships**:
- Has many: Projects (if normalized)

---

### 7. CalendarEvent
**Purpose**: Planned or actual work sessions

**Properties**:
```typescript
{
  id: string
  title: string
  startTime: Date
  endTime: Date
  projectId?: string
  color: string
  completed?: boolean
  description?: string
  duration: number  // Duration in hours
  type?: 'planned' | 'tracked' | 'completed'
  recurring?: RecurringPattern
  originalEventId?: string  // For split midnight-crossing events
  isSplitEvent?: boolean
}
```

**Business Rules**:
- Event endTime must be after startTime
- Duration is calculated from startTime to endTime
- Events crossing midnight are automatically split into separate events
- Recurring events follow pattern rules
- Completed events cannot be edited (only completion status can change)

---

### 8. WorkHour / WorkSlot
**Purpose**: Daily work availability slots

**Properties**:
```typescript
// WorkSlot (in Settings)
{
  id: string
  startTime: string  // "09:00" format
  endTime: string    // "17:00" format
  duration: number   // Calculated hours (supports 15min increments)
}

// WorkHour (standalone entity)
{
  id: string
  title: string
  startTime: Date
  endTime: Date
  duration: number
  type?: 'work' | 'meeting' | 'break'
}
```

**Business Rules**:
- Work slots cannot overlap within the same day
- Duration is automatically calculated from start/end times
- Minimum slot duration: 15 minutes (0.25 hours)
- Time must be in 24-hour format

---

### 9. Holiday
**Purpose**: Non-working days

**Properties**:
```typescript
{
  id: string
  title: string
  startDate: Date
  endDate: Date
  notes?: string
}
```

**Business Rules**:
- Holiday endDate must be ≥ startDate
- Holidays exclude days from working day calculations
- Can span multiple days

---

### 10. Settings
**Purpose**: User preferences and work schedule

**Properties**:
```typescript
{
  weeklyWorkHours: {
    monday: WorkSlot[]
    tuesday: WorkSlot[]
    // ... all days
  }
  defaultView?: string
}
```

**Business Rules**:
- Each day can have multiple work slots
- Work slots on same day cannot overlap
- Used for capacity calculations

---

## Entity Relationships

### Project → Milestone Relationship

**Type**: One-to-Many (1:N)

**Rules**:
1. **Project can have 0 to many milestones**
2. **Milestone must belong to exactly one project**
3. **Milestone dates are constrained by project dates**:
   ```
   project.startDate ≤ milestone.endDate ≤ project.endDate
   ```
4. **Milestone time allocations are constrained by project budget**:
   ```
   SUM(milestone.timeAllocationHours) ≤ project.estimatedHours
   ```

**Cascade Behavior**:
- Deleting a project → deletes all its milestones

---

### Project → Client Relationship

**Type**: Text Label (not a foreign key)

**Current Implementation**:
- Project has a `client` field (string)
- Multiple projects can reference the same client name

**Implications**:
- No referential integrity at database level
- Client filtering/grouping done by string matching
- Typos can create duplicate "clients"

**Query Pattern**:
```typescript
// Get all projects for a client
projects.filter(p => p.client === "Acme Corp")
```

---

### Group → Row → Project Hierarchy

**Type**: Tree Structure (1:N:N)

**Rules**:
1. **Group → Rows**: One-to-Many
   - Group can have multiple rows
   - Row belongs to exactly one group
2. **Row → Projects**: One-to-Many
   - Row can have multiple projects
   - Project belongs to exactly one row
3. **Transitive**: Project indirectly belongs to one group (via row)

**Cascade Behavior**:
- Deleting a group → deletes all rows → deletes all projects
- Deleting a row → deletes all projects in that row

---

### Project → CalendarEvent Relationship

**Type**: One-to-Many (1:N, optional)

**Rules**:
- Calendar events can be linked to a project (optional)
- Events without projectId are unassigned work
- Used for progress tracking and time tracking

---

## Business Rules

### Rule 1: Milestone Budget Constraint
**Statement**: The sum of all milestone time allocations for a project cannot exceed the project's estimated hours.

**Formula**:
```
SUM(milestone.timeAllocationHours FOR projectId) ≤ project.estimatedHours
```

**Enforcement**:
- Validated in `UnifiedProjectEntity.analyzeBudget()`
- Validated in `MilestoneValidator.validateMilestoneCreation()`
- Checked in `CrossEntityValidator`

**Violations**:
- **Severity**: High
- **Action**: Prevent milestone creation/update that would exceed budget
- **Message**: "Milestone allocation would exceed project budget by X hours"

---

### Rule 2: Milestone Date Constraint
**Statement**: All milestone dates must fall within the parent project's date range.

**Formula**:
```
project.startDate ≤ milestone.endDate ≤ project.endDate
```

**Special Cases**:
- If `milestone.startDate` exists: `project.startDate ≤ milestone.startDate ≤ milestone.endDate ≤ project.endDate`

**Enforcement**:
- Validated in `UnifiedMilestoneEntity.validateMilestoneDate()`
- Validated in `MilestoneValidator.validateMilestoneCreation()`

**Violations**:
- **Severity**: High
- **Action**: Prevent milestone creation/update
- **Message**: "Milestone date must fall within project timeline"

---

### Rule 3: Project Date Validity
**Statement**: For time-limited projects, the end date must be after the start date.

**Formula**:
```
IF project.continuous === false THEN
  project.endDate > project.startDate
```

**Enforcement**:
- Validated in `UnifiedProjectEntity.validateDateRange()`
- Validated in `ProjectValidator.validateProjectCreation()`

**Violations**:
- **Severity**: Critical
- **Action**: Prevent project creation/update
- **Message**: "Project end date must be after start date"

---

### Rule 4: Positive Time Allocations
**Statement**: All time allocations (project budget, milestone allocation) must be positive numbers.

**Formula**:
```
project.estimatedHours > 0
milestone.timeAllocationHours > 0
```

**Enforcement**:
- Validated in `UnifiedProjectEntity.validateEstimatedHours()`
- Validated at database level (CHECK constraint recommended)

**Violations**:
- **Severity**: Critical
- **Action**: Prevent creation/update
- **Message**: "Time allocation must be greater than zero"

---

### Rule 5: Milestone Order Consistency
**Statement**: Milestones within a project should have unique, sequential order values.

**Formula**:
```
For project P with milestones [m1, m2, m3]:
  m1.order < m2.order < m3.order
```

**Enforcement**:
- Normalized via `normalizeMilestoneOrders()` function
- Auto-corrected on fetch

**Violations**:
- **Severity**: Low (auto-corrected)
- **Action**: Reorder milestones on load

---

### Rule 6: Work Hour Slot Non-Overlap
**Statement**: Work slots within the same day cannot overlap.

**Formula**:
```
For any two slots s1, s2 on same day:
  s1.endTime ≤ s2.startTime OR s2.endTime ≤ s1.startTime
```

**Enforcement**:
- Validated in `WorkHourValidator`
- Checked before saving settings

**Violations**:
- **Severity**: Medium
- **Action**: Prevent overlapping slot creation
- **Message**: "Work slots cannot overlap"

---

### Rule 7: Calendar Event Duration
**Statement**: Event duration is calculated from start to end time and must be positive.

**Formula**:
```
event.duration = (event.endTime - event.startTime) in hours
event.duration > 0
```

**Enforcement**:
- Calculated automatically in event handlers
- Validated in `CalendarEventValidator`

---

### Rule 8: Continuous vs. Time-Limited Projects
**Statement**: Projects are either continuous (no end date) or time-limited (has end date).

**Rules**:
```
IF project.continuous === true THEN
  project.endDate is optional/ignored
ELSE
  project.endDate is required AND > project.startDate
```

**Enforcement**:
- Checked in `UnifiedProjectEntity.isContinuousProject()`
- Conditional validation in project validators

---

### Rule 9: Day Estimates Source Priority
**Statement**: Day estimates for timeline rendering follow a priority order:

**Priority**:
1. **Planned Events** (highest priority) - explicit work scheduled
2. **Milestone Allocations** - estimated work distribution
3. **Project Auto-Estimates** (lowest priority) - fallback distribution

**Enforcement**:
- Implemented in `UnifiedDayEstimateService`
- Higher priority sources override lower priority

---

### Rule 10: Recurring Pattern Validity
**Statement**: Recurring events/milestones must have valid pattern configurations.

**Rules**:
```
IF recurring.type === 'weekly' THEN
  recurring.weeklyDayOfWeek must be 0-6
IF recurring.type === 'monthly' AND recurring.monthlyPattern === 'date' THEN
  recurring.monthlyDate must be 1-31
IF recurring.type === 'monthly' AND recurring.monthlyPattern === 'dayOfWeek' THEN
  recurring.monthlyWeekOfMonth must be 1-5
  recurring.monthlyDayOfWeek must be 0-6
```

---

## Invariants (Always True)

Invariants are conditions that **must always be true** in the system. Violating these indicates a bug.

### Invariant 1: Entity Ownership
**Statement**: Every user-created entity must have a valid userId.

```typescript
∀ entity ∈ [projects, milestones, groups, rows, events]:
  entity.userId !== null AND entity.userId exists in auth.users
```

**Impact if violated**: Data corruption, security breach

---

### Invariant 2: Parent Entity Existence
**Statement**: Child entities must have valid parent references.

```typescript
∀ milestone: milestone.projectId exists in projects
∀ project: project.rowId exists in rows AND project.groupId exists in groups
∀ row: row.groupId exists in groups
```

**Impact if violated**: Orphaned data, display errors

---

### Invariant 3: Date Ordering
**Statement**: All date ranges must be properly ordered.

```typescript
∀ entity with date range:
  entity.startDate ≤ entity.endDate
```

**Impact if violated**: Calculation errors, negative durations

---

### Invariant 4: Budget Conservation
**Statement**: Total milestone allocation never exceeds project budget (enforced).

```typescript
∀ project:
  SUM(milestone.timeAllocationHours WHERE milestone.projectId = project.id) 
  ≤ project.estimatedHours
```

**Impact if violated**: Resource over-allocation, tracking errors

---

### Invariant 5: Non-Negative Time
**Statement**: All time values are non-negative.

```typescript
∀ time value: value ≥ 0
```

**Impact if violated**: Calculation errors, display bugs

---

## Validation Rules

### Project Validation

**Create Project**:
```typescript
✓ name is not empty
✓ estimatedHours > 0
✓ startDate is valid date
✓ endDate > startDate (if not continuous)
✓ groupId exists
✓ rowId exists and belongs to groupId
✓ color is valid hex code
✓ icon is valid Lucide icon name (or default)
```

**Update Project**:
```typescript
✓ All create rules apply
✓ If changing dates, check milestones still within range
✓ If reducing estimatedHours, check milestones don't exceed new budget
✓ Cannot change continuous flag if milestones depend on date range
```

---

### Milestone Validation

**Create Milestone**:
```typescript
✓ name is not empty
✓ projectId exists
✓ timeAllocationHours > 0
✓ endDate is within project date range
✓ startDate < endDate (if startDate provided)
✓ Adding milestone doesn't exceed project budget
✓ No duplicate order values (auto-corrected)
```

**Update Milestone**:
```typescript
✓ All create rules apply
✓ New allocation doesn't exceed project budget
✓ New dates still within project range
```

---

### Event Validation

**Create Event**:
```typescript
✓ title is not empty
✓ startTime < endTime
✓ duration > 0
✓ If projectId provided, project exists
✓ Color is valid hex code
✓ Recurring pattern is valid (if provided)
```

---

## Calculation Rules

### 1. Project Duration
**Formula**:
```typescript
duration = (endDate - startDate) in days
```

**Implementation**: `calculateDurationDays()`

---

### 2. Milestone Utilization
**Formula**:
```typescript
utilization = (SUM(milestone.timeAllocationHours) / project.estimatedHours) * 100
```

**Implementation**: `UnifiedProjectEntity.analyzeBudget()`

---

### 3. Working Days Calculation
**Logic**:
```typescript
1. Get all days in date range
2. Filter by autoEstimateDays settings (which days of week)
3. Exclude holidays
4. Exclude days with no work slots in settings
```

**Implementation**: `calculateAutoEstimateWorkingDays()`

---

### 4. Day Estimates Distribution
**For Project Auto-Estimate**:
```typescript
dailyHours = project.estimatedHours / COUNT(working days)
```

**For Milestone Allocation**:
```typescript
// Distribute milestone hours across working days until deadline
dailyHours = milestone.timeAllocationHours / COUNT(working days until endDate)
```

**Implementation**: `UnifiedDayEstimateService`

---

### 5. Budget Remaining
**Formula**:
```typescript
remaining = project.estimatedHours - SUM(milestone.timeAllocationHours)
```

---

### 6. Budget Overage
**Formula**:
```typescript
overage = MAX(0, SUM(milestone.timeAllocationHours) - project.estimatedHours)
```

---

## State Transitions

### Project Status Transitions

```
[future] → [current] → [archived]
   ↓          ↓            ↑
   └──────────┴────────────┘
      (can transition to any state)
```

**Rules**:
- Future: Project hasn't started yet
- Current: Project is active
- Archived: Project is completed or cancelled
- Can move between any states freely

---

### Milestone Completion

```
[active] → [completed]
           (one-way transition)
```

**Rules**:
- Once marked complete, cannot be uncompleted (in typical flow)
- Completion status tracked via related events

---

### Time Tracking States

```
[idle] → [tracking] → [paused] → [tracking] → [stopped]
                         ↓
                      [stopped]
```

---

## Edge Cases & Constraints

### Edge Case 1: Midnight-Crossing Events
**Scenario**: Event starts on one day and ends on the next.

**Handling**:
- Automatically split into two separate events
- First event: original startTime to 23:59:59
- Second event: 00:00:00 to original endTime
- Link via `originalEventId` and `isSplitEvent` flag

---

### Edge Case 2: Zero-Day Projects
**Scenario**: Project with startDate === endDate

**Handling**:
- Treated as a 1-day project
- Duration calculation returns 1 (minimum)

---

### Edge Case 3: Milestone Reordering
**Scenario**: Changing milestone dates causes order conflicts

**Handling**:
- Auto-normalize orders on save
- Orders are relative, not absolute
- `normalizeMilestoneOrders()` fixes gaps and duplicates

---

### Edge Case 4: Budget Exactly at Limit
**Scenario**: Milestone allocation exactly equals project budget

**Handling**:
- Allowed (utilization = 100%)
- Warning shown if trying to add more milestones

---

### Edge Case 5: Orphaned Milestones
**Scenario**: Project deleted but milestones remain (shouldn't happen with cascade)

**Handling**:
- Database cascade delete should prevent
- If detected: `CrossEntityValidator` flags as critical issue
- Can be cleaned up via data migration

---

### Edge Case 6: Overlapping Work Slots
**Scenario**: User tries to add overlapping slots on same day

**Handling**:
- Prevented by validation
- Error message shown
- Cannot save until resolved

---

### Edge Case 7: Continuous Project Milestone Dates
**Scenario**: How to handle milestones in continuous projects (no endDate)

**Handling**:
- Milestones still require endDate (absolute deadlines)
- No upper bound validation on milestone dates
- Validate only that milestone.endDate is after project.startDate

---

### Edge Case 8: Empty Project (No Milestones)
**Scenario**: Project with no milestones

**Handling**:
- Perfectly valid
- Timeline shows project bar only
- Auto-estimate distributes entire estimatedHours across working days

---

### Edge Case 9: Milestone Time Exceeds Project Budget
**Scenario**: Single milestone allocation > project estimatedHours

**Handling**:
- Prevented during creation
- If updating project budget: warn if reduction causes violation
- Must resolve before saving

---

### Edge Case 10: Date Boundaries (DST, Leap Years)
**Scenario**: Daylight saving time transitions, leap years

**Handling**:
- All dates stored as UTC in database
- Conversion to user timezone in UI layer only
- Date calculations use calendar days, not 24-hour periods

---

## Implementation Notes

### Where Rules Are Currently Enforced

1. **Type System** (`src/types/core.ts`)
   - Structure definitions
   - No rule enforcement (just types)

2. **Domain Entities** (`src/services/unified/UnifiedProjectService.ts`)
   - `UnifiedProjectEntity` - project-specific rules
   - `UnifiedMilestoneService` - milestone calculations

3. **Validators** (`src/services/validators/`)
   - `ProjectValidator` - comprehensive project validation
   - `MilestoneValidator` - comprehensive milestone validation
   - `CrossEntityValidator` - cross-domain validation
   - `WorkHourValidator` - work hour slot validation

4. **Contexts** (`src/contexts/`)
   - State management
   - Some business rules scattered in context logic

5. **Database** (`supabase/migrations/`)
   - Foreign key constraints
   - NOT NULL constraints
   - ON DELETE CASCADE rules

### Gaps Identified

- ❌ No centralized domain model classes
- ❌ Business rules duplicated across layers
- ❌ No single "reference" for developers to consult
- ❌ Validation inconsistently applied
- ❌ Client entity not normalized (text field only)

---

## Next Steps

1. ✅ **This document** - establish single source of truth
2. 🔄 **Create domain model layer** (`src/domain/`)
3. 🔄 **Consolidate validators** to reference domain models
4. 🔄 **Update Architecture Guide** to include domain layer
5. 🔄 **Refactor contexts** to use domain layer
6. 🔄 **Add comprehensive tests** based on these rules

---

## Document Maintenance

**When to Update This Document**:
- Adding new entities or relationships
- Changing business rules or constraints
- Discovering edge cases in production
- Refactoring validation logic

**Review Frequency**: After every major feature addition or architectural change

**Stakeholders**: All developers, product owners, QA team

---

## Glossary

- **Entity**: A domain object with identity (Project, Milestone, etc.)
- **Business Rule**: A constraint or calculation that enforces business requirements
- **Invariant**: A condition that must always be true
- **Validation Rule**: A check performed before persisting data
- **Domain Logic**: Core business logic independent of UI/database concerns

---

**End of Business Logic Reference v1.0.0**
