# Rules Logic
## Detailed Rules, Calculations, and Edge Cases

**Document Version**: 2.0.0  
**Last Updated**: December 29, 2025  
**Status**: Foundation Document - Updated for Client-Group-Label System, Phase Terminology  

---

## Purpose

This document contains **detailed business rules, calculations, state transitions, and edge cases** for the Time Forecasting Application. 

**For entity definitions and what things ARE, see [Domain Logic.md](../Domain%20Logic.md) in this directory.**

This document focuses on:
- How entities **behave** and **interact**
- Complex **calculation formulas**
- **State transitions** and lifecycle rules
- **Edge cases** and boundary conditions
- **Invariants** that must always be true

---

## Table of Contents

1. [Entity Relationships (Detailed)](#entity-relationships-detailed)
2. [Business Rules](#business-rules)
3. [Invariants (Always True)](#invariants-always-true)
4. [Validation Rules (Detailed)](#validation-rules-detailed)
5. [Calculation Rules](#calculation-rules)
6. [State Transitions](#state-transitions)
7. [Edge Cases & Constraints](#edge-cases--constraints)

---

## Entity Relationships (Detailed)

> **Note:** For entity definitions (what each entity IS), see [Domain Logic.md](../Domain%20Logic.md#-part-1-core-entities-things-that-exist).

```
User
  ├─ Clients (required for projects)
  │     └─ Projects (every project belongs to exactly one client)
  ├─ Groups (required for projects - currently)
  │     └─ Projects (every project belongs to exactly one group)
  ├─ Labels (flexible tagging, many-to-many with projects)
  ├─ Projects
  │     ├─ Phases (time periods for budgeting - explicit or recurring)
  │     └─ Calendar Events (planned and completed work)
  ├─ Work Slots (weekly schedule defining capacity)
  ├─ Working Days (derived from work slots)
  └─ Holidays (capacity overrides - no work on these days)
```

> **Entity Definitions:** For what each entity IS (properties, examples), see [Domain Logic.md](../Domain%20Logic.md#-part-1-core-entities-things-that-exist).
> 
> This document focuses on HOW entities behave and interact.

---

## Entity Relationships

### Project → Phase Relationship

**Type**: One-to-Many (1:N)

**Rules**:
1. **Project can have 0 to many phases** (explicit phases OR one recurring phase pattern)
2. **Phase must belong to exactly one project**
3. **Phase dates are constrained by project dates** (for time-limited projects):
   ```
   project.startDate ≤ phase.endDate ≤ project.endDate
   ```
4. **Phase time allocations are constrained by project budget**:
   ```
   SUM(phase.timeAllocationHours) ≤ project.estimatedHours
   ```

**Cascade Behavior**:
- Deleting a project → deletes all its phases

---

### Project → Client Relationship

**Type**: Foreign Key (Many-to-One)

**Implementation**:
- Project has a `client_id` field (foreign key to clients table)
- Multiple projects can belong to the same client
- Client is a **required** relationship (every project MUST have a client)

**Referential Integrity**:
- ON DELETE RESTRICT: Cannot delete a client if projects exist
- Must delete or reassign all projects before deleting a client

**Query Pattern**:
```typescript
// Get all projects for a client
projects.filter(p => p.clientId === client.id)
```

---

### Project → Group Relationship

**Type**: Foreign Key (Many-to-One)

**Rules**:
1. **Project → Group**: Many-to-One (currently required)
   - Project belongs to exactly one group
   - Group can have many projects
2. **Direct relationship**: Projects belong directly to groups (no intermediate entity)

**Cascade Behavior**:
- Cannot delete group if projects exist (must reassign projects first)

---

### Project → Label Relationship

**Type**: Many-to-Many

**Rules**:
1. **Projects can have 0, 1, or many labels**
2. **Labels can be applied to many projects**
3. **Labels are optional** (no project requires labels)

**Cascade Behavior**:
- Deleting a label removes it from all projects (no blocking)

---

### Project → CalendarEvent Relationship

**Type**: One-to-Many (1:N, optional)

**Rules**:
- Calendar events can be linked to a project (optional)
- Events without projectId may be unassigned work, tasks, habits, or other non-project activities
- Used for progress tracking and time tracking

---

## Business Rules

### Rule 1: Phase Budget Constraint
**Statement**: The sum of all phase time allocations for a project cannot exceed the project's estimated hours.

**Formula**:
```
SUM(phase.timeAllocationHours FOR projectId) ≤ project.estimatedHours
```

**Enforcement**:
- Validated in `UnifiedProjectEntity.analyzeBudget()`
- Validated in `PhaseValidator.validatePhaseCreation()`
- Checked in `CrossEntityValidator`

**Violations**:
- **Severity**: High
- **Action**: Prevent phase creation/update that would exceed budget
- **Message**: "Phase allocation would exceed project budget by X hours"

---

### Rule 2: Phase Date Constraint
**Statement**: All phase dates must fall within the parent project's date range (for time-limited projects).

**Formula**:
```
project.startDate ≤ phase.endDate ≤ project.endDate
```

**Special Cases**:
- If `phase.startDate` exists: `project.startDate ≤ phase.startDate ≤ phase.endDate ≤ project.endDate`
- For **continuous projects**: Phases must have end dates (absolute deadlines), but no upper bound from project

**Enforcement**:
- Validated in `UnifiedPhaseEntity.validatePhaseDate()`
- Validated in `PhaseValidator.validatePhaseCreation()`

**Violations**:
- **Severity**: High
- **Action**: Prevent phase creation/update
- **Message**: "Phase date must fall within project timeline"

---

### Rule 3: Project Date Validity
**Statement**: For time-limited projects, the end date must be after the start date. Continuous projects have no end date.

**Formula**:
```
IF project.continuous === false THEN
  project.endDate > project.startDate
ELSE
  project.endDate is NULL
```

**Enforcement**:
- Validated in `UnifiedProjectEntity.validateDateRange()`
- Validated in `ProjectValidator.validateProjectCreation()`

**Violations**:
- **Severity**: Critical
- **Action**: Prevent project creation/update
- **Message**: "Project end date must be after start date"

---

### Rule 4: Non-Negative Time Allocations
**Statement**: All time allocations (project budget, phase allocation) must be non-negative numbers. Zero is allowed for projects with no estimate.

**Formula**:
```
project.estimatedHours >= 0
phase.timeAllocationHours > 0
```

**Note**: Project estimated hours can be 0 (no estimate set), but phase allocations must be positive (phases are only created when allocating time).

**Enforcement**:
- Validated in `UnifiedProjectEntity.validateEstimatedHours()`
- Validated at database level (CHECK constraint recommended)

**Violations**:
- **Severity**: Critical
- **Action**: Prevent creation/update
- **Message**: "Time allocation cannot be negative"

---

### Rule 5: Phase Order Consistency
**Statement**: Phases within a project should have unique, sequential order values.

**Formula**:
```
For project P with phases [p1, p2, p3]:
  p1.order < p2.order < p3.order
```

**Enforcement**:
- Normalized via `normalizePhaseOrders()` function
- Auto-corrected on fetch

**Violations**:
- **Severity**: Low (auto-corrected)
- **Action**: Reorder phases on load

---

### Rule 6: Work Slot Non-Overlap
**Statement**: Work slots within the same day cannot overlap.

**Formula**:
```
For any two slots s1, s2 on same day:
  s1.endTime ≤ s2.startTime OR s2.endTime ≤ s1.startTime
```

**Additional Rule**: Work slots cannot cross midnight (must be within a single day).

**Enforcement**:
- Validated in `WorkSlotValidator`
- Checked before saving settings

**Violations**:
- **Severity**: Medium
- **Action**: Prevent overlapping slot creation
- **Message**: "Work slots cannot overlap"

---

### Rule 7: Calendar Event Duration
**Statement**: Event duration is calculated from start to end time and must be positive. User-created events cannot cross midnight (UI validation), but tracked events can span midnight.

**Formula**:
```
event.duration = (event.endTime - event.startTime) in hours
event.duration > 0

// User-created events
IF event.type !== 'tracked' THEN
  event.startTime and event.endTime must be on the same day
END IF

// Tracked events (from time tracking)
IF event.type === 'tracked' THEN
  Can span midnight (no day boundary restriction)
END IF
```

**Enforcement**:
- Calculated automatically in event handlers
- Validated in `CalendarEventValidator`
- UI prevents midnight crossing for manual event creation
- Time tracking system can create events spanning midnight

**Formula**:
```
event.duration = (event.endTime - event.startTime) in hours
event.duration > 0
event.startTime and event.endTime must be on the same day
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
  project.endDate is NULL
  Auto-estimates are NOT calculated (no deadline to work toward)
  Phases can still have deadlines (absolute end dates)
ELSE
  project.endDate is required AND > project.startDate
  Auto-estimates distribute remaining hours across working days
```

**Enforcement**:
- Checked in `UnifiedProjectEntity.isContinuousProject()`
- Conditional validation in project validators

---

### Rule 9: Daily Time Allocation - Data Coexistence and Display

> **See Also:** 
> - Domain Logic Part 3 - Time Concepts (Capacity, Estimated, Auto-Estimated, Planned, Completed)
> - Display Logic (`/src/domain/Display Logic.md`) - Timeline View (how this data is displayed in different views)

**Statement**: For any given day and project, multiple types of time data coexist in the domain. How they are displayed depends on the view's capabilities.

**Domain Truth:**

All time types can exist simultaneously for a project on a given day:
- **Auto-Estimated Time**: Calculated distribution (`(Estimated - Completed) ÷ Remaining Days`)
- **Planned Time**: Calendar events scheduled for that day
- **Completed Time**: Tracked work done on that day

These are **different aspects of project time**, not mutually exclusive data:
- Auto-estimates represent the calculated daily allocation needed to finish on time
- Planned events represent specific scheduled work blocks
- Completed events represent actual work done

**Display Decision (View-Specific):**

Different views may display this data differently based on their UI capabilities:

**Timeline View** (see `/src/domain/Display Logic.md`):
```
FOR each day D and project P:
  IF ∃ calendar_event WHERE date = D AND projectId = P THEN
    Display: Event time (planned or completed styling)
    Hide: Auto-estimated time (UI constraint - can't render overlapping bars)
  ELSE IF project is time-limited THEN
    Display: Auto-estimated time
  END IF
```

**Calendar View** (future):
- May show both events AND auto-estimates (grid cells can contain multiple items)

**Reports View** (future):
- Shows all time types simultaneously (tables have no overlap constraint)

**Why This Separation Matters:**

The domain calculation (auto-estimates) happens **regardless of display**. Even when Timeline hides auto-estimates (because events exist), they are still calculated and available for:
- Reports showing total auto-estimated hours
- Capacity analysis
- Future days without events
- Other views that can display multiple types

---

### Rule 9.1: Auto-Estimate Calculation (Domain Rule)

**Formula**:
```
FOR each day D and project P:
  Calculate auto-estimate:
    Remaining Hours = Estimated Hours - Completed Hours (for whole project)
    Remaining Days = Working Days from today to end, excluding days with ANY events
    Auto-Estimate for day D = Remaining Hours ÷ Remaining Days
  
  Store/provide for display:
    - Auto-Estimated Time (always calculated)
    - Planned Event Time (if events exist on day D)
    - Completed Event Time (if completed events exist on day D)
```

**Key Principle:**

Auto-estimates are **always calculated** for all remaining working days, regardless of whether they will be displayed. The calculation is:

1. **Remaining Hours**: `project.estimatedHours - SUM(completed_event_hours)`
2. **Remaining Days**: Working days WITHOUT any events (planned OR completed)
3. **Hours per Day**: `Remaining Hours ÷ Remaining Days`

**Why Exclude Event Days from Calculation:**

Days with events (planned or completed) are excluded from the "Remaining Days" denominator to avoid double-counting:
- If you've scheduled 6 hours on Monday (planned event), Monday is excluded from auto-estimate distribution
- The remaining hours are spread across OTHER days
- This prevents the system from suggesting work on days you've already allocated

**Example Calculation:**

```
Project: 120 estimated hours, Jan 1-31
Working days: 22 days
Completed work: 0 hours
Planned events: None

Auto-estimate calculation:
  Remaining hours: 120 - 0 = 120
  Remaining days: 22 (all working days available)
  Per day: 120 ÷ 22 = 5.45 hours/day

Result: Auto-estimate of 5.45 hours calculated for ALL 22 days
```

**Domain Invariant:** Auto-estimates are ONLY calculated for time-limited projects (`continuous = false`). Continuous projects have no end date, so there's no "deadline to work toward" for distribution.

---

### Rule 9.2: Event Day Exclusion (Domain Rule)

### Rule 9.2: Event Day Exclusion (Domain Rule)

**Statement**: Days with calendar events (planned OR completed) are excluded from auto-estimate distribution.

**Formula:**
```
Remaining Working Days =
  Start with: Project working days (user working days + project overrides)
  Filter to: Today → Project end date (exclude past)
  Exclude: Holidays
  Exclude: Days with ANY calendar events for this project (planned OR completed)
```

**Rationale:**

Each calendar event represents a specific time allocation for that day:
- **Planned event** = You've committed to work X hours on that day
- **Completed event** = You've already worked X hours on that day

Including these days in auto-estimate distribution would mean:
- Day shows auto-estimate (e.g., 5 hours)
- Day also has event (e.g., 6 hours)
- Total appears to be 11 hours (incorrect!)

By excluding event days, we ensure:
- Days with events show actual/planned work
- Days without events show calculated suggestions
- No double-counting of time

**Example:**

```
Project: 120 estimated hours, Jan 1-31
Working days: 22

User plans Monday, Jan 5: 6-hour event
  Remaining days: 21 (Jan 5 excluded)
  Auto-estimate per day: 120 ÷ 21 = 5.71 hours
  
User completes Monday, Jan 5: Marks 6-hour event complete
  Remaining hours: 120 - 6 = 114
  Remaining days: Still 21 (Jan 5 still excluded - has event)
  Auto-estimate per day: 114 ÷ 21 = 5.43 hours
```

**Key Point:** Event days are excluded from BOTH numerator (if completed) AND denominator (always).

---

### Rule 9.3: Time Type Definitions (Domain Concepts)

**From App Logic Part 3 - Time Concepts:**

1. **PLANNED TIME** (Calendar Events - Not Completed)
   - **Source**: Calendar events with `projectId = P`, `completed = false`, `type != 'tracked'`
   - **Definition**: Specific time blocks user scheduled for future work
   - **Effect on Domain**: Removes that day from auto-estimate distribution (Rule 9.2)
   - **Display** (view-specific): See View Specifications for visual styling
   - **Example**: "Jan 5, 9am-3pm, Website coding" (6 hours planned)

2. **COMPLETED TIME** (Calendar Events - Completed)
   - **Source**: Calendar events with `projectId = P`, `completed = true` OR `type = 'tracked'`
   - **Definition**: Specific time blocks of work already done
   - **Effect on Domain**: Removes day from auto-estimate distribution AND reduces remaining estimated hours
   - **Display** (view-specific): See View Specifications for visual styling
   - **Example**: "Jan 5, 9am-3pm, Website coding" (6 hours completed)

3. **AUTO-ESTIMATED TIME** (Calculated Distribution - Not an Event)
   - **Source**: NOT a calendar event - calculated from project/phase `estimatedHours` or `timeAllocationHours`
   - **Calculation**: `(Estimated Hours - Completed Hours) ÷ Remaining Working Days`
   - **Appears**: Only for project working days WITHOUT any calendar events
   - **Purpose**: Shows daily work needed to finish on time (time-limited projects only)
   - **Display** (view-specific): See View Specifications for visual styling
   - **Example**: 120 hours ÷ 22 days = 5.45 hours/day
   - **Storage**: NOT stored in database (calculated on-demand)
   - **Properties**: NO start/end times, NO completed status, NO event record

---

### Rule 9.4: Event Filtering (Data Integrity)

**Statement**: Only events explicitly linked to a project count toward that project's time.

**Formula:**
```typescript
FOR event to count toward project P:
  event.projectId === P.id
  AND event.category !== 'habit'  // Habits never count toward projects
  AND event.category !== 'task'   // Tasks never count toward projects
```

**Defensive Rule:**

Even if legacy data has `projectId` set on habits or tasks, these are NEVER counted toward project time. This prevents data inconsistencies from corrupting calculations.

**Events not linked** (no `projectId` or different `projectId`) do NOT:
- Appear in project displays
- Affect project auto-estimates
- Count toward project hours

---

### Rule 9.5: Continuous Projects (Special Case)

**Statement**: Continuous projects (`continuous = true`) do NOT calculate auto-estimates.

**Rationale:**

Auto-estimates are distributed toward a **deadline**:
- "How much per day to finish by end date?"

Continuous projects have **no end date**, therefore:
- No deadline to work toward
- No basis for daily distribution
- Auto-estimates would be undefined (division by infinity)

**Data That Still Exists:**
- ✅ Estimated hours (total budget)
- ✅ Planned events (scheduled work)
- ✅ Completed events (tracked work)
- ❌ Auto-estimated time (not calculated)

**Display Impact:**
- Shows planned and completed events when they exist
- Shows nothing on days without events (no auto-estimates to show)

---

## Implementation & Enforcement

**Calculation Layer:**
- `dayEstimateCalculations.ts` - Implements Rules 9.1, 9.2, 9.5
- `projectCalculations.ts` - Calculates remaining hours (Rule 9.1)

**Domain Rules Layer:**
- `TimelineRules.ts` - Event filtering (Rule 9.4), data classification

**View Layer:** (See `/src/domain/Display Logic.md`)
- Timeline View - Display mutual exclusivity, visual styling
- Calendar View - Integration with calendar events

**Critical Validation Points:**
- Event creation: Validate `projectId` assignment
- Project rendering: Apply event filtering before calculations
- Auto-estimate display: Check for event existence before showing

---

### Examples (Domain Logic)

**Scenario 1: No calendar events yet**
```
Project: 120 hours estimated, Jan 1-31
Project working days: 22
Calendar events: None
Remaining working days: 22 (Rule 9.2)
Auto-estimate per day: 120 ÷ 22 = 5.45 hours/day (Rule 9.1)

Domain State:
  - All 22 days eligible for auto-estimates
  - Each day's contribution: 5.45 hours
  - Total distributed: 22 × 5.45 = 119.9 hours ≈ 120 hours
```

**Scenario 2: User plans one day**
```
User creates event: "Jan 5, 9am-3pm, 6 hours" (planned, not completed)

Domain State After Event Creation:
  - Jan 5 now has calendar event → excluded from auto-estimate days (Rule 9.2)
  - Remaining working days: 21 (Rule 9.2)
  - Remaining hours to distribute: 120 hours (not completed yet)
  - Auto-estimate per day: 120 ÷ 21 = 5.71 hours/day (Rule 9.1)

Data Changes:
  - calendar_events table: New row with projectId, duration=6h, completed=false
  - Project data: Unchanged (event is planned, not completed)
  - Auto-estimates: Recalculated for 21 days instead of 22
```

**Scenario 3: User completes work**
```
User marks Jan 5 event as completed (6 hours completed)

Domain State After Completion:
  - Jan 5 still has calendar event → still excluded from auto-estimate days
  - Remaining working days: 21 (Rule 9.2)
  - Completed hours: 6 hours (reduces remaining work)
  - Remaining hours to distribute: 120 - 6 = 114 hours (Rule 9.1)
  - Auto-estimate per day: 114 ÷ 21 = 5.43 hours/day (Rule 9.1)

Data Changes:
  - calendar_events table: event.completed = true
  - Project calculations: Remaining hours decreased by 6
  - Auto-estimates: Recalculated with new remaining hours
```

**Scenario 4: Mixed day (both planned AND completed events)**
```
Jan 5 has two events:
  - 9am-12pm (3 hours, completed)
  - 2pm-5pm (3 hours, planned)

Domain State:
  - Jan 5 has events → excluded from auto-estimate days (Rule 9.2)
  - Day's total: 6 hours (3 completed + 3 planned)
  - Remaining hours: 120 - 3 = 117 hours (only completed counts)
  - Remaining working days: 21
  - Auto-estimate per day: 117 ÷ 21 = 5.57 hours/day
  
Data Truth:
  - Both events exist in calendar_events table
  - Both linked to same projectId
  - Day contributes 6 hours total, 3 hours completed
  - Display handling: See View Specifications (UI layer decision)
```

**Scenario 5: Continuous project**
```
Project: continuous = true, 120 hours estimated

Domain State:
  - No end date → cannot calculate deadline
  - Auto-estimates: NOT calculated (Rule 9.5)
  - Planned events: Still exist and count
  - Completed events: Still reduce remaining hours
  
Calculation Results:
  - remainingWorkingDays: undefined (no end date)
  - autoEstimatePerDay: 0 (Rule 9.5 - no calculation)
  - Data still tracked: ✅ events, ✅ completed hours
  - Display result: See View Specifications
```

---

### Rule 10: Recurring Pattern Validity
**Statement**: Recurring events/phases must have valid pattern configurations.

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
∀ entity ∈ [projects, phases, clients, groups, labels, events, workSlots, holidays]:
  entity.userId !== null AND entity.userId exists in auth.users
```

**Impact if violated**: Data corruption, security breach

---

### Invariant 2: Parent Entity Existence
**Statement**: Child entities must have valid parent references.

```typescript
∀ phase: phase.projectId exists in projects
∀ project: project.clientId exists in clients
∀ project: project.groupId exists in groups (currently required)
```

**Impact if violated**: Orphaned data, display errors

---

### Invariant 3: Date Ordering
**Statement**: All date ranges must be properly ordered (for entities with end dates).

```typescript
∀ entity with date range (where endDate is not NULL):
  entity.startDate ≤ entity.endDate
```

**Note**: Continuous projects have NULL endDate, so this invariant doesn't apply to them.

**Impact if violated**: Calculation errors, negative durations

---

### Invariant 4: Budget Conservation
**Statement**: Total phase allocation never exceeds project budget (enforced).

```typescript
∀ project:
  SUM(phase.timeAllocationHours WHERE phase.projectId = project.id) 
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

### Invariant 6: Client Name Uniqueness
**Statement**: Client names must be unique per user (case-insensitive).

```typescript
∀ client1, client2 WHERE client1.userId === client2.userId:
  LOWER(client1.name) !== LOWER(client2.name)
```

**Impact if violated**: Duplicate clients, data integrity issues

---

### Invariant 7: Group Name Uniqueness
**Statement**: Group names must be unique per user (case-insensitive).

```typescript
∀ group1, group2 WHERE group1.userId === group2.userId:
  LOWER(group1.name) !== LOWER(group2.name)
```

**Impact if violated**: Duplicate groups, UI confusion

---

### Invariant 8: Label Name Uniqueness
**Statement**: Label names must be unique per user (case-insensitive).

```typescript
∀ label1, label2 WHERE label1.userId === label2.userId:
  LOWER(label1.name) !== LOWER(label2.name)
```

**Impact if violated**: Duplicate labels, filtering issues

---

## Validation Rules

### Client Validation

**Create Client**:
```typescript
✓ name is not empty (required)
✓ name is 1-100 characters
✓ name is unique per user (case-insensitive)
✓ email (if provided) contains '@' and '.', no whitespace
✓ phone (if provided) contains only digits, spaces, hyphens, parentheses, plus signs
```

**Update Client**:
```typescript
✓ All create rules apply
✓ Name change must maintain uniqueness
```

**Delete Client**:
```typescript
✓ Cannot delete if projects exist (ON DELETE RESTRICT)
✓ Must delete or reassign all projects first
```

---

### Project Validation

**Create Project**:
```typescript
✓ name is not empty
✓ estimatedHours >= 0 (can be 0 for no estimate)
✓ startDate is valid date
✓ clientId exists (required)
✓ groupId exists (currently required)
✓ IF time-limited: endDate > startDate
✓ IF continuous: endDate is NULL
✓ color is valid hex code
✓ icon is valid Lucide icon name (or default)
```

**Update Project**:
```typescript
✓ All create rules apply
✓ If changing dates, check phases still within range
✓ If reducing estimatedHours, check phases don't exceed new budget
✓ Cannot change from time-limited to continuous if phases depend on project end date
```

---

### Phase Validation

**Create Phase**:
```typescript
✓ projectId exists
✓ timeAllocationHours > 0
✓ endDate is within project date range (for time-limited projects)
✓ startDate < endDate (if startDate provided)
✓ Adding phase doesn't exceed project budget
✓ No duplicate order values (auto-corrected)
✓ For continuous projects: phase must have end date (absolute deadline)
```

**Update Phase**:
```typescript
✓ All create rules apply
✓ New allocation doesn't exceed project budget
✓ New dates still within project range (for time-limited projects)
```

---

### Group Validation

**Create Group**:
```typescript
✓ name is not empty (required)
✓ name is unique per user (case-insensitive)
```

**Delete Group**:
```typescript
✓ Cannot delete if projects exist (must reassign projects first)
```

---

### Label Validation

**Create Label**:
```typescript
✓ name is not empty (required)
✓ name is unique per user (case-insensitive)
```

**Delete Label**:
```typescript
✓ Can always delete (removes from all projects, no blocking)
```

---

### Event Validation

**Create Event**:
```typescript
✓ startTime < endTime
✓ startTime and endTime on same day (no midnight crossing)
✓ duration > 0
✓ If projectId provided, project exists
✓ Color is valid hex code
✓ Recurring pattern is valid (if provided)
```

---

### Work Slot Validation

**Create/Update Work Slot**:
```typescript
✓ startTime < endTime
✓ startTime and endTime on same day (no midnight crossing)
✓ dayOfWeek is 0-6 (Sunday-Saturday)
✓ No overlap with existing slots on same day
```

**Override Behavior**:
```typescript
✓ User can update all future occurrences OR just specific date
✓ Specific date overrides stored separately from recurring pattern
```

---

## Calculation Rules

### 1. Project Duration
**Formula**:
```typescript
// For time-limited projects only
duration = (endDate - startDate) in days

// For continuous projects
duration = undefined (no end date)
```

**Implementation**: `calculateDurationDays()`

---

### 2. Phase Utilization
**Formula**:
```typescript
utilization = (SUM(phase.timeAllocationHours) / project.estimatedHours) * 100
```

**Implementation**: `UnifiedProjectEntity.analyzeBudget()`

---

### 3. Working Days Calculation (Three Levels)

**Level 1: User Working Days**
```typescript
// Days with work slots, excluding holidays
userWorkingDays = days WHERE hasWorkSlots(day) AND NOT isHoliday(day)
```

**Level 2: Project Working Days**
```typescript
// User working days with optional project-specific overrides
projectWorkingDays = userWorkingDays
  .filter(day => !projectExclusions.includes(day))  // Remove project-excluded days
  .concat(projectInclusions)                         // Add project-included days (rare)
```

**Level 3: Remaining Working Days**
```typescript
// Project working days minus days with planned/completed events
remainingWorkingDays = projectWorkingDays
  .filter(day => day >= today)                       // Only future days
  .filter(day => !hasEventsForProject(day, project)) // No events on this day
```

**Implementation**: `calculateAutoEstimateWorkingDays()`

---

### 4. Auto-Estimate Distribution (Time-Limited Projects Only)
**Formula**:
```typescript
// Step 1: Calculate remaining hours
remainingHours = project.estimatedHours - completedHours

// Step 2: Count remaining working days
remainingDays = COUNT(remainingWorkingDays from today to project.endDate)

// Step 3: Calculate daily hours
dailyHours = remainingHours / remainingDays
```

**For Phase Allocation**:
```typescript
// Distribute phase hours across working days until phase deadline
dailyHours = phase.timeAllocationHours / COUNT(working days until phase.endDate)
```

**Note**: Continuous projects do NOT have auto-estimates (no deadline to distribute toward).

**Implementation**: `UnifiedDayEstimateService`

---

### 5. Budget Remaining
**Formula**:
```typescript
remaining = project.estimatedHours - SUM(phase.timeAllocationHours)
```

---

### 6. Budget Overage
**Formula**:
```typescript
overage = MAX(0, SUM(phase.timeAllocationHours) - project.estimatedHours)
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

### Phase Completion

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
**Scenario**: Event or work slot starts on one day and ends on the next.

**Handling**:
- **Events**: Prevented by validation (events must be within single day)
- **Work Slots**: Prevented by validation (slots must be within single day)
- If legacy data exists: split into two separate events automatically

---

### Edge Case 2: Zero-Day Projects
**Scenario**: Project with startDate === endDate

**Handling**:
- Treated as a 1-day project
- Duration calculation returns 1 (minimum)

---

### Edge Case 3: Phase Reordering
**Scenario**: Changing phase dates causes order conflicts

**Handling**:
- Auto-normalize orders on save
- Orders are relative, not absolute
- `normalizePhaseOrders()` fixes gaps and duplicates

---

### Edge Case 4: Budget Exactly at Limit
**Scenario**: Phase allocation exactly equals project budget

**Handling**:
- Allowed (utilization = 100%)
- Warning shown if trying to add more phases

---

### Edge Case 5: Orphaned Phases
**Scenario**: Project deleted but phases remain (shouldn't happen with cascade)

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

### Edge Case 7: Continuous Project Phase Dates
**Scenario**: How to handle phases in continuous projects (no project endDate)

**Handling**:
- Phases still require endDate (absolute deadlines within ongoing work)
- No upper bound validation from project (project has no end)
- Validate only that phase.endDate is after project.startDate
- Auto-estimates NOT calculated for continuous projects

---

### Edge Case 8: Empty Project (No Phases)
**Scenario**: Project with no phases

**Handling**:
- Perfectly valid
- Timeline shows project bar only
- For time-limited projects: auto-estimate distributes entire estimatedHours across working days
- For continuous projects: no auto-estimates shown

---

### Edge Case 9: Phase Time Exceeds Project Budget
**Scenario**: Single phase allocation > project estimatedHours

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

### Edge Case 11: Client Deletion with Projects
**Scenario**: User tries to delete client that has projects

**Handling**:
- Prevented by database constraint (ON DELETE RESTRICT)
- Error message shown: "Cannot delete client with existing projects"
- User must delete or reassign all projects first

---

### Edge Case 12: Group Deletion with Projects
**Scenario**: User tries to delete group that has projects

**Handling**:
- Prevented by application logic
- Error message shown: "Cannot delete group with existing projects"
- User must reassign all projects to another group first

---

## Implementation Notes

### Where Rules Are Currently Enforced

1. **Type System** (`src/types/core.ts`)
   - Structure definitions
   - No rule enforcement (just types)

2. **Domain Entities** (`src/services/unified/UnifiedProjectService.ts`)
   - `UnifiedProjectEntity` - project-specific rules
   - `UnifiedPhaseService` - phase calculations

3. **Validators** (`src/services/validators/`)
   - `ProjectValidator` - comprehensive project validation
   - `PhaseValidator` - comprehensive phase validation
   - `ClientValidator` - client validation
   - `CrossEntityValidator` - cross-domain validation
   - `WorkSlotValidator` - work slot validation

4. **Contexts** (`src/contexts/`)
   - State management
   - Some business rules scattered in context logic

5. **Database** (`supabase/migrations/`)
   - Foreign key constraints
   - NOT NULL constraints
   - ON DELETE CASCADE / RESTRICT rules

### Gaps Identified

- ❌ No centralized domain model classes
- ❌ Business rules duplicated across layers
- ❌ Validation inconsistently applied

### Resolved (v2.0.0)

- ✅ Client entity now normalized (proper foreign key relationship)
- ✅ Row entity removed (projects belong directly to groups)
- ✅ Milestone terminology standardized to "Phase"
- ✅ Single reference document established

---

## Next Steps

1. ✅ **This document** - establish single source of truth
2. ✅ **Client normalization** - proper entity with foreign key
3. 🔄 **Create domain model layer** (`src/domain/`)
4. 🔄 **Consolidate validators** to reference domain models
5. 🔄 **Update Architecture Guide** to include domain layer
6. 🔄 **Refactor contexts** to use domain layer
7. 🔄 **Add comprehensive tests** based on these rules

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

- **Entity**: A domain object with identity (Project, Phase, Client, etc.)
- **Phase**: A time period within a project (previously called "milestone" in some contexts)
- **Business Rule**: A constraint or calculation that enforces business requirements
- **Invariant**: A condition that must always be true
- **Validation Rule**: A check performed before persisting data
- **Domain Logic**: Core business logic independent of UI/database concerns
- **Continuous Project**: A project with no end date (ongoing work)
- **Time-Limited Project**: A project with a definite end date (deadline)

---

**End of Business Logic Reference v2.0.0**
