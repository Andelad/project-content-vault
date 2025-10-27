# Domain Definitions
## Plain-English Reference for What Things Are

**Document Version**: 1.0.0  
**Last Updated**: October 27, 2025  
**Purpose**: Plain-English definitions for all domain entities, their purpose, and what they do/don't do

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Project](#project)
3. [Milestone](#milestone)
4. [Calendar Event](#calendar-event)
5. [Day Estimates](#day-estimates)
6. [Client](#client)
7. [Group](#group)
8. [Label](#label)
9. [Work Hours](#work-hours)
10. [Availability](#availability)
11. [Working Days](#working-days)
12. [Common Confusions](#common-confusions)

---

## Core Concepts

### The Big Picture

This application helps you **forecast time** needed for projects and **track actual work**. It separates:

- **Planning** (projects, milestones, estimates) - "What work needs doing?"
- **Scheduling** (calendar events) - "When will I do this work?"
- **Tracking** (completed events) - "What work did I actually do?"

**Key Principle**: Milestones are NOT tasks. They're budget allocations that drive day estimates.

---

## Project

### What is a Project?

A project is **a work initiative with a time boundary and resource budget**.

Think of it as: *"I need to deliver X for Client Y, estimated at Z hours, between Date A and Date B"*

### A Project IS:

✅ **A container for related work**
- Groups milestones, events, and time tracking together
- Represents a client engagement or internal initiative

✅ **Time-bounded OR continuous**
- Time-limited: Has start date AND end date (e.g., "Website Redesign: Jan 1 - Mar 31")
- Continuous: Has start date, no end date (e.g., "Ongoing Support")

✅ **Budget-defined**
- Has `estimatedHours` (total hours allocated)
- Example: "This project has 120 hours budget"

✅ **Client-owned**
- Every project MUST belong to a Client
- Clients are required (you can't create a project without one)

✅ **Optionally organized**
- Can belong to a Group (e.g., "Web Development")
- Can have many Labels (e.g., "urgent", "design", "backend")

### A Project IS NOT:

❌ **A task** - Use Calendar Events for tasks
❌ **Completable by itself** - Track completion via Calendar Events
❌ **A milestone** - Projects contain milestones
❌ **Independent of a client** - All projects require a client

### Project Properties

**Required:**
- `name` - Project title
- `clientId` - Which client owns this work
- `startDate` - When project begins
- `estimatedHours` - Total budget in hours (must be > 0)

**Conditional:**
- `endDate` - Required UNLESS `continuous = true`

**Optional:**
- `groupId` - Organization category
- `labels` - Flexible tags (many-to-many)
- `color` - Display color (hex code)
- `icon` - Lucide icon name
- `notes` - Free-form description
- `autoEstimateDays` - Which days of week to include in estimates
- `status` - 'current', 'future', or 'archived'

### Project Constraints

1. **Date validity**: `endDate > startDate` (for time-limited projects)
2. **Positive budget**: `estimatedHours > 0`
3. **Budget constraint**: Sum of milestone allocations ≤ `estimatedHours`
4. **Client exists**: Referenced client must be valid

### What Projects Control

Projects control:
- **Total time budget** available for allocation
- **Date boundaries** for milestones
- **Working days** used for day estimates (via `autoEstimateDays`)
- **Display organization** (via group, labels, color)

Projects do NOT control:
- Individual task scheduling (that's Calendar Events)
- Milestone completion (milestones aren't completable)
- User availability (that's Work Hours)

---

## Milestone

### What is a Milestone?

A milestone is **a budget allocation segment that drives day estimate calculations**.

Think of it as: *"I need to allocate X hours of the project budget to be used by Date Y"*

**CRITICAL**: Milestones are NOT tasks. They're forecasting tools.

### A Milestone IS:

✅ **A time budget allocation**
- Has `timeAllocationHours` (portion of project budget)
- Example: "Allocate 40 hours for this phase"

✅ **A deadline-driven forecast**
- Has `endDate` (when this budget should be used by)
- Has optional `startDate` (when allocation begins)

✅ **A day estimate driver**
- System calculates: "To meet this deadline, you need X hours per day"
- Distributes hours across working days between start and end

✅ **Part of a project**
- Must belong to exactly one project
- Constrained by project dates and budget

✅ **Single OR recurring**
- Single: One-time allocation (e.g., "Launch deadline: March 31")
- Recurring: Pattern-based (e.g., "Weekly review: every Monday")

### A Milestone IS NOT:

❌ **A task** - It's a budget allocation, not work itself
❌ **Completable** - Only Calendar Events can be marked complete
❌ **A calendar event** - It doesn't appear on your calendar
❌ **Actual work** - It's a forecast of work needed
❌ **Independent** - Must always belong to a project

### Milestone Properties

**Required:**
- `name` - Milestone title
- `projectId` - Parent project
- `endDate` - Deadline (when budget should be used by)
- `timeAllocationHours` - Hours allocated (must be > 0)

**Optional:**
- `startDate` - When allocation begins (defaults to previous milestone's endDate or project start)
- `isRecurring` - Whether this follows a pattern
- `recurringConfig` - Pattern details (type, interval, etc.)

**Never present:**
- ❌ `completed` - Milestones don't have completion status
- ❌ `progress` - Track progress via Calendar Events

### Milestone Constraints

1. **Positive allocation**: `timeAllocationHours > 0`
2. **Within project dates**: `project.startDate ≤ endDate ≤ project.endDate`
3. **Date ordering**: If `startDate` exists, `startDate < endDate`
4. **Budget constraint**: Sum of all milestones ≤ `project.estimatedHours`
5. **Natural ordering**: Milestones are ordered by `endDate` (no manual ordering)

### How Milestones Drive Day Estimates

**Single Milestone Example:**
```
Project: Website Redesign (120 hours, Jan 1 - Mar 31)
Milestone: "Design Phase" (40 hours, due Feb 15)
  startDate: Jan 1
  endDate: Feb 15
  timeAllocationHours: 40

System calculates:
  - Working days between Jan 1 and Feb 15: 30 days
  - Daily estimate: 40 hours / 30 days = 1.33 hours/day
  - Timeline shows: "You need 1.33h on each working day to meet Feb 15 deadline"
```

**Recurring Milestone Example:**
```
Project: Ongoing Support (continuous)
Milestone: "Weekly Check-in" (2 hours per occurrence, every Monday)
  isRecurring: true
  recurringConfig: { type: 'weekly', interval: 1, weeklyDayOfWeek: 1 }
  timeAllocationHours: 2

System generates:
  - Virtual occurrence every Monday
  - Each Monday shows: 2 hours in day estimates
```

### Milestones vs Calendar Events

| Aspect | Milestone | Calendar Event |
|--------|-----------|----------------|
| **Purpose** | Budget allocation / Forecast | Actual work block |
| **Shows on calendar** | No | Yes |
| **Can be completed** | No | Yes |
| **Drives estimates** | Yes | No (blocks estimates) |
| **User creates** | During planning | During scheduling |

**Workflow:**
1. Create project with budget (120 hours)
2. Create milestones to allocate budget (40h, 50h, 30h)
3. System calculates day estimates: "You need 2.5h on March 10th"
4. User creates Calendar Event: "I'll schedule 2.5h on March 10th"
5. User completes Calendar Event: "I finished that work"

---

## Calendar Event

### What is a Calendar Event?

A calendar event is **actual work you plan to do or have done**.

Think of it as: *"I will work on X from Time A to Time B"*

### A Calendar Event IS:

✅ **Actual scheduled time**
- Appears on your calendar as a time block
- Has specific start and end times (not just dates)

✅ **Completable work**
- Can be marked complete (unlike milestones)
- Tracks actual work done

✅ **Optionally linked to a project**
- Can be associated with a project
- Or can be unassigned (personal time, meetings, etc.)

✅ **The truth of what happened**
- When completed, represents actual time spent
- Used for time tracking and progress

### A Calendar Event IS NOT:

❌ **A forecast** - It's actual scheduled time, not an estimate
❌ **A milestone** - It's work, not a budget allocation
❌ **A day estimate** - It's actual calendar time, not projected need

### Calendar Event Properties

**Required:**
- `title` - Event name
- `startTime` - When event starts (date + time)
- `endTime` - When event ends (date + time)

**Optional:**
- `projectId` - Link to project (if project-related)
- `completed` - Whether work is done
- `description` - Notes
- `color` - Display color
- `type` - 'planned', 'tracked', or 'completed'
- `recurring` - Pattern for repeating events

### Calendar Event Constraints

1. **Valid time range**: `endTime > startTime`
2. **Automatic splitting**: Events crossing midnight are split into separate events
3. **Project link**: If `projectId` provided, project must exist

### How Events Relate to Day Estimates

**Critical Rule**: Calendar Events BLOCK day estimates.

```
On any given day for a project:
  IF day has ANY calendar events for that project THEN
    Show: Event time (actual scheduled work)
    Do NOT show: Day estimates
  ELSE
    Show: Day estimate (projected work needed)
  END IF
```

**Why?** Once you've scheduled actual work, you don't need to see the estimate anymore.

**Example:**
```
March 10th for "Website Redesign" project:
  - Day estimate says: "You need 2.5 hours today"
  - You create calendar event: "Design work 9am-11:30am (2.5 hours)"
  - Timeline now shows: Your calendar event (lighter color with dashed border)
  - Day estimate no longer appears (you've scheduled the work)
```

### Visual Distinction

Timeline shows events differently based on status:

- **Planned Event** (future work not yet done)
  - Lighter color with dashed border
  - Shows `completed === false` OR `type === 'planned'`

- **Completed Event** (actual work done)
  - Darker solid color
  - Shows `completed === true` OR `type === 'tracked'` OR `type === 'completed'`

- **Day Estimate** (not an event!)
  - Lightest color, no border
  - Only appears when NO events exist for that day

---

## Day Estimates

### What are Day Estimates?

Day estimates are **calculated projections showing how much work you need to do each day to meet deadlines**.

Think of it as: *"To finish on time, you need X hours today"*

### Day Estimates ARE:

✅ **Calculations, not events**
- Computed from milestone allocations
- NOT stored in database
- Generated on-demand for display

✅ **Forecasts of needed work**
- Shows what you SHOULD do to stay on track
- Based on project/milestone budgets and deadlines

✅ **Distributed across working days**
- Only appear on days you've configured as working days
- Exclude holidays
- Respect project's `autoEstimateDays` settings

✅ **Blocked by calendar events**
- Disappear when you schedule actual work (calendar events)
- Reappear if you delete the event

### Day Estimates ARE NOT:

❌ **Calendar events** - They're not actual time blocks
❌ **Completable** - They're calculations, not tasks
❌ **Stored data** - They're computed on the fly
❌ **Actual work** - They're projections of work needed

### How Day Estimates Are Calculated

**For Milestone-Based Projects:**
```
For each milestone:
  1. Find working days between startDate and endDate
  2. Distribute timeAllocationHours evenly: hours / working days
  3. Show result on each working day until deadline
```

**For Auto-Estimate Projects (no milestones):**
```
1. Find working days between project startDate and endDate
2. Distribute project.estimatedHours evenly: hours / working days
3. Show result on each working day across project
```

**Working Day Definition:**
- Day of week is enabled in `project.autoEstimateDays` (or settings if not specified)
- Day is not a holiday
- Day has work hours configured (optional check)

### Day Estimate Display Rules

**Rule 1: Events block estimates**
```
IF any calendar event exists for project on date THEN
  Display: Event hours (actual scheduled work)
  Do NOT display: Day estimate
END IF
```

**Rule 2: Only show on working days**
```
IF date is not a working day THEN
  Do NOT display day estimate
END IF
```

**Rule 3: Milestone segments**
```
Each day shows estimate from its active milestone:
  - If before all milestones: Use project auto-estimate
  - If within milestone range: Use that milestone's estimate
  - If after all milestones: No estimate shown
```

### Example Scenario

```
Project: Website Redesign
  estimatedHours: 120
  startDate: Jan 1
  endDate: Mar 31
  autoEstimateDays: Mon-Fri only

Milestones:
  1. Design Phase: 40 hours, due Feb 15
  2. Development: 60 hours, due Mar 20
  3. Testing: 20 hours, due Mar 31

Day Estimates shown:
  Jan 1 - Feb 15:  40h / 30 working days = 1.33 h/day (Design Phase)
  Feb 16 - Mar 20: 60h / 25 working days = 2.40 h/day (Development)
  Mar 21 - Mar 31: 20h / 8 working days = 2.50 h/day (Testing)

If you create calendar event on Jan 15:
  Jan 15 now shows: Your event time (e.g., 2 hours)
  Jan 15 NO LONGER shows: 1.33h estimate
```

---

## Client

### What is a Client?

A client is **an organization or individual that commissions work**.

Think of it as: *"Who am I doing this work for?"*

### A Client IS:

✅ **Required for all projects**
- Every project must belong to a client
- Cannot create project without selecting/creating a client

✅ **An organizational entity**
- Has name, contact info, billing details
- Can have multiple projects

✅ **Status-based**
- Active: Available for new projects
- Inactive: Hidden from project creation
- Archived: Historical record

### A Client IS NOT:

❌ **A project** - Clients own projects
❌ **Deletable if it has projects** - Protected by constraint
❌ **Optional** - Required for all work

### Client Properties

**Required:**
- `name` - Client name (unique per user)

**Optional:**
- `status` - 'active', 'inactive', or 'archived'
- `contactEmail` - Primary contact
- `contactPhone` - Phone number
- `billingAddress` - Billing information
- `notes` - Free-form notes

### Client Constraints

1. **Unique name**: Client name must be unique per user
2. **Delete protection**: Cannot delete if client has projects
3. **Required**: Projects cannot exist without a client

---

## Group

### What is a Group?

A group is **an optional high-level organizational category**.

Think of it as: *"What type of work is this?"* (e.g., "Web Development", "Consulting")

### A Group IS:

✅ **Optional organization**
- Projects can belong to a group OR be ungrouped
- Used for visual organization in UI

✅ **Simple categorization**
- Just has a name
- No description, no color (simplified in Oct 2025)

✅ **One-to-many with projects**
- Group can have many projects
- Project can belong to at most one group

### A Group IS NOT:

❌ **Required** - Projects can exist without groups
❌ **Complex** - No hierarchies or nesting
❌ **Delete-protected** - Can be deleted (prompts for project handling)

---

## Label

### What is a Label?

A label is **a flexible tag for categorization and filtering**.

Think of it as: *"How do I want to filter or tag this?"* (e.g., "urgent", "design", "backend")

### A Label IS:

✅ **Flexible tagging**
- Projects can have zero or many labels
- Labels can be applied to many projects (many-to-many)

✅ **User-defined**
- Users create their own labels
- Name and optional color

✅ **Safe to delete**
- Deleting a label removes associations but not projects

### A Label IS NOT:

❌ **Hierarchical** - No parent/child relationships
❌ **Required** - Projects can exist without labels
❌ **Exclusive** - Projects can have multiple labels

---

## Work Hours

### What are Work Hours?

Work hours are **your daily availability slots**.

Think of it as: *"When am I available to work?"*

### Work Hours ARE:

✅ **Time slots on specific days**
- Defined per day of week
- Multiple slots per day allowed (e.g., 9-12, 1-5)

✅ **Capacity definitions**
- Define total available hours per day
- Used for availability calculations

✅ **Non-overlapping**
- Slots on same day cannot overlap
- Validated on save

### Work Hours ARE NOT:

❌ **Calendar events** - They're availability, not scheduled work
❌ **Linked to projects** - They're general availability

### Work Hour Properties

**Required:**
- `startTime` - When slot starts (time only, e.g., "09:00")
- `endTime` - When slot ends (e.g., "17:00")

**Calculated:**
- `duration` - Hours in slot (auto-calculated)

### Work Hour Constraints

1. **No overlap**: Slots on same day cannot overlap
2. **Minimum duration**: 15 minutes (0.25 hours)
3. **Valid time range**: `endTime > startTime`

---

## Availability

### What is Availability?

Availability is **your capacity to do work on a given day**.

Think of it as: *"How much work can I fit today?"*

### Availability IS:

✅ **Calculated from work hours**
- Sum of all work hour durations for a day
- Example: 9-12 (3h) + 1-5 (4h) = 7 hours available

✅ **Reduced by scheduled events**
- Calendar events reduce available capacity
- Holidays block availability entirely

✅ **Visual indicators**
- Availability circles show capacity vs. scheduled work
- Red indicators show overbooking

### Availability IS NOT:

❌ **A stored value** - It's calculated on demand
❌ **Project-specific** - It's your total daily capacity

### How Availability is Calculated

```
For a given day:
  1. Total capacity = SUM(work hour slot durations)
  2. Scheduled time = SUM(calendar event durations)
  3. Available = Capacity - Scheduled
  4. If Available < 0: Day is overbooked
```

---

## Working Days

### What is a Working Day?

A working day is **a day on which you plan to work**.

### A Working Day IS:

✅ **Defined by multiple factors**
- Day of week is enabled (Mon-Fri typically)
- Day is not a holiday
- Day has work hours configured (optional)

✅ **Project-specific** (optionally)
- Projects can override with `autoEstimateDays`
- Example: Some projects only on Mon/Wed/Fri

✅ **Used for calculations**
- Day estimate distribution
- Project duration calculation
- Deadline feasibility

### A Working Day IS NOT:

❌ **The same as a calendar day** - Working days are a subset
❌ **Always Mon-Fri** - Configurable per user/project

### Working Day Determination

**For Day Estimates:**
```
Day is a working day IF:
  1. Day of week is in project.autoEstimateDays (OR settings if not specified)
  AND
  2. Day is not a holiday
```

**For Capacity Calculations:**
```
Day is a working day IF:
  1. Day has work hour slots configured
  AND
  2. Day is not a holiday
```

---

## Common Confusions

### Confusion 1: Milestones vs Events

**Question**: "Why can't I mark a milestone complete?"

**Answer**: Milestones are budget allocations, not tasks. They drive day estimates. To track completion:
1. Create calendar events based on the estimate
2. Mark those events complete
3. Progress is tracked through completed events, not milestones

### Confusion 2: Day Estimates vs Calendar Events

**Question**: "Why did my day estimate disappear when I added an event?"

**Answer**: Day estimates are forecasts ("you need X hours"). Once you schedule actual work (calendar event), the forecast is replaced by reality. Think of it as:
- Estimate = "You SHOULD work 2.5h"
- Event = "You WILL/DID work 2.5h"

You don't need both on the same day.

### Confusion 3: Project Budget vs Milestone Allocation

**Question**: "Can milestone hours exceed project hours?"

**Answer**: No. The sum of all milestone allocations cannot exceed the project's estimatedHours. Think of it as:
- Project budget = Total money you have
- Milestone allocations = How you divide that money
- You can't allocate more than you have

### Confusion 4: Continuous Projects

**Question**: "Why doesn't my continuous project show day estimates?"

**Answer**: Continuous projects (no end date) still need milestones with deadlines to drive estimates. The project being continuous just means it has no overall end date, but individual milestones still have deadlines.

### Confusion 5: Working Days vs Calendar Days

**Question**: "Why is my project 60 days but only 42 working days?"

**Answer**: Working days exclude:
- Weekends (if not in autoEstimateDays)
- Holidays
- Days without work hours configured

Calendar days count everything. Working days count only days you plan to work.

---

## Quick Reference

### Entity Relationships

```
User
  └─ Clients (has many)
  └─ Groups (has many, optional)
  └─ Labels (has many, optional)
  └─ Projects (has many)
      ├─ belongs to ONE Client (required)
      ├─ belongs to ONE Group (optional)
      ├─ has many Labels (many-to-many)
      ├─ has many Milestones
      └─ has many Calendar Events (optional link)
```

### What Drives What

```
Projects + Milestones → Day Estimates
Day Estimates + User Decisions → Calendar Events
Calendar Events → Time Tracking
Work Hours → Availability
Availability + Calendar Events → Capacity Planning
```

### Decision Tree: What Should I Create?

```
Do you want to...
  └─ Define a new client engagement?
      → Create a PROJECT
  
  └─ Allocate budget with a deadline?
      → Create a MILESTONE
  
  └─ Schedule actual work time?
      → Create a CALENDAR EVENT
  
  └─ Track when you're available?
      → Configure WORK HOURS
  
  └─ Organize projects visually?
      → Create a GROUP or LABEL
  
  └─ See how much work you need to do?
      → Let the system calculate DAY ESTIMATES
```

---

**End of Domain Definitions v1.0.0**
