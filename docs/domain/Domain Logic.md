# Domain Logic - Time Forecasting Application

**Version:** 1.2  
**Date:** December 29, 2025  
**Status:** IN PROGRESS - Foundation Document  
**Author:** [Your Name]

---

## � QUICK NAVIGATION

**Core Documentation:**
- [What This Document Is](#-what-this-document-is)
- [What Makes This App Unique](#-what-makes-this-app-unique)

**Main Sections:**
- [PART 1: Core Entities](#️-part-1-core-entities-database-objects) - 9 database objects (User, Client, Project, Phase, Group, Label, Calendar Event, Work Slot, Holiday)
- [PART 2: Derived Concepts](#-part-2-derived-concepts-calculated-from-entities) - 5 calculated concepts (Working Days, Work Hours, Capacity, Availability, Overcommitted)
- [PART 3: Time Concepts](#️-part-3-time-concepts-critical-to-this-app) - 5 time types (Capacity, Estimated, Auto-Estimated, Planned, Completed)
- [PART 4: Key Workflows](#-part-4-key-workflows) - 7 user journeys
- [PART 5: Validation Rules](#-part-5-validation-rules-summary) - Consolidated validation tables

**Reference:**
- [Entity Relationships Summary](#entity-relationships-summary)
- [Related Documents](#-related-documents)

---

## �📖 WHAT THIS DOCUMENT IS

This document defines **WHAT the app does** in plain English, independent of code.

### This IS:
- ✅ Business rules and logic
- ✅ Entity definitions and relationships
- ✅ Time concepts (unique to this app)
- ✅ Core calculations and formulas
- ✅ User workflows and scenarios
- ✅ Validation rules

### This is NOT:
- ❌ Technical implementation details
- ❌ Database schema (that's in database docs)
- ❌ UI design specifications (that's in design docs)
- ❌ Code architecture (that's in architecture docs)

**Think of it as:** The rules of the game. Developers figure out how to code it.

**Who should read this:** Product managers, developers, QA, stakeholders, future team members

---

## 🎯 WHAT MAKES THIS APP UNIQUE

### The Problems with Existing Approaches

**1. Bottom-Up Project Management (Task-Based Apps)**

How they work:
- Break work into individual tasks
- Track each task's status
- Build time estimates from individual pieces (brick by brick)

*The problem:* Tasks are hard to estimate accurately. Work expands to fill available time. Unexpected issues—tiredness, bugs, delays—destroy estimates. Users quickly lose sight of the big picture.

---

**2. Backward-Looking Time Tracking**

How they work:
- Track what's already been done
- Record hours after the fact
- No forecasting or planning ahead

*The problem:* Driving by looking in the rearview mirror. Hard to answer forward-looking questions like "Can I take on a new client?" or "Can I take that holiday next month?" Past data doesn't automatically map the future.

---

**3. Static Individual Forecasting Tools**

How they work:
- Built for individuals
- Allow time estimates and planning
- But plans don't adapt to reality

*The problem:* Plans become fiction when reality intervenes. Sleep in once, a task expands, an emergency appointment appears—the forecast is suddenly wrong. The tool doesn't recalculate. A user must manually rebuild the plan.

---

**4. Team-Focused Dynamic Forecasting Tools**

How they work:
- Built for teams and project managers
- More sophisticated, often with dynamic rebalancing
- Enterprise-level complexity and pricing

*The problems:* Can be prohibitively expensive for individuals. UI is not optimised for individuals and makes it hard to quickly see what matters over time. Still build from task.

---

### How This App Is Different

**Built for the individual, BigPicture-down, with dynamic forecasting.**

Instead of managing hundreds of tasks, users work with the big picture:

1. Set your **capacity** (when you can work)
2. Create **projects** with time estimates
3. Watch the app **auto-estimate** your work load across your available days
4. Plan specific work when needed
5. Complete work and watch auto-estimates automatically rebalance.

**Why it solves the problems above:**
- **Big-picture first** - Start with total hours, not individual tasks (solves task-estimation problem)
- **Forward-looking** - See what's ahead, not just what's done (solves rearview-mirror problem)
- **Dynamic** - Plans rebalance automatically when reality changes (solves static-plan problem)
- **Individual-first** - Simple UI optimized for one person, affordable pricing (solves team-tool problem)

**The rest of this document explains:**
- **PART 1-2**: What things are (entities and derived concepts)
- **PART 3**: How time works (the unique time hierarchy)
- **PART 4-5**: How users interact with the system (workflows and validation)

---

<!-- SECTION: PART-1-ENTITIES -->
## 🏗️ PART 1: CORE ENTITIES (Database Objects)

These are concrete objects stored in the database. Each has a unique ID and can be created, updated, and deleted.

**Entity Overview:**
1. User
2. Client
3. Project
4. Phase
5. Group
6. Label
7. Calendar Event
8. Work Slot
9. Holiday

**Future Considerations:** Invoicing/Billing entities (if monetization requires client invoicing), Team/Workspace entities (if multi-user collaboration is added), Notification entities (if alert history needs persistence).

---

### 1. User
**What it is:**
The person using the application.

**Essential Properties:**
- ID (unique identifier)
- Email (for authentication and communication)
- Authentication details (managed by Supabase Auth)

**Key Rules:**
- Each user has completely isolated data (Row Level Security ensures users can only access their own entities)
- User deletion cascades to all owned entities (clients, projects, phases, events, holidays, work slots, groups, labels)
- All other entities in the system MUST belong to exactly one user
- Users cannot access or modify other users' data

**Not Stored Here (Out of Scope):**
- Team/workspace features (individual app only)
- User roles or permissions (all users have equal capabilities)
- Billing or subscription tiers (if applicable, document separately)

**Authentication:**
Managed entirely by Supabase Auth - no custom user table exists.

---

### 2. Client
**What it is:**
The organization or person you're doing work for.

**Essential Properties:**
- Name (required, must be unique per user)
- Status (active, inactive, archived)

**Optional Properties:**
- Contact email (basic format validation if provided)
- Contact phone (basic format validation if provided)
- Billing address (free-form text)
- Notes (free-form text)

**Key Rules:**
- Every project MUST have a client (required relationship)
- Client names must be unique per user, case-insensitive (each user has their own isolated client list - "Acme Corp" and "ACME CORP" are treated as the same client)
- Different users CAN have clients with the same name (data is isolated per user)
- Clients are independent entities (not just text labels)
- Can have multiple projects per client (one-to-many relationship)
- **Cannot delete client if projects exist** (ON DELETE RESTRICT - must delete/reassign all projects first)
- A client can have no projects
- Status determines visibility:
  - Active: shown in project creation dropdowns
  - Inactive: shown in lists but marked as inactive
  - Archived: hidden from most views (can be restored)

**Examples:**
- "Acme Corporation" (external client)
- "University of Edinburgh" (institutional client)
- "Personal Projects" (self - common pattern for personal work)
- "Pro Bono Work" (category as a client)

**Validation:**
- Name: 1-100 characters, leading/trailing whitespace trimmed
- Email (optional): Basic format check - requires `@` and `.`, no whitespace
- Phone (optional): Can contain digits, spaces, hyphens, parentheses, plus signs (e.g., `+1 (555) 123-4567`)

---

### 3. Project
**What it is:**
A piece of work that needs to be completed, with an optional time estimate (expressed in hours). Projects can be **time-limited** (with a deadline) or **continuous** (ongoing with no end date).

**Essential Properties:**
- Name (what is it?)
- Client (who is it for? - REQUIRED)
- Start date (when does work begin?)
- Estimated hours (time estimate/load - can be 0 if no estimate set)

**Conditional Properties:**
- End date (when must it be finished? - REQUIRED for time-limited projects, NULL for continuous projects)

**Organizational Properties (Optional):**
- Group (0 or 1 - currently single group only, may expand to multiple group sets in future, so that a project can belong to multiple group sets, but only 1 group in a set)
- Labels (0, 1, or many - flexible tags)
- Working day overrides (specific dates marked as working/non-working for this project only - see "Project Working Days" in Derived Concepts)

**Project Types:**

| Type | End Date | Auto-Estimates | Use Case |
|------|----------|----------------|----------|
| **Time-Limited** | Required | Distributed across working days until deadline | Projects with deadlines |
| **Continuous** | NULL/None | Not applicable (no deadline to work toward) | Ongoing retainers, maintenance, open-ended work |

**Key Rules:**
- MUST have a client
- MUST have start date
- **Time-limited projects:**
  - MUST have end date
  - End date must be AFTER start date (projects must span at least one day)
  - Auto-estimates distributed across working days within date range
  - If has phases: end date MUST be >= the last phase's end date (auto-synced to last phase)
  - If has phases: end date IS the last phase's end date (auto-synced)
  - If has recurring phase, last phase is truncated to end on the project end date. Or user is given option to update end date to the last full phase cycle.
- **Continuous projects:**
  - End date is NULL/not set
  - No auto-estimates (no deadline to calculate distribution toward)
  - Can still have phases with their own deadlines
  - Phases must have end dates (absolute deadlines within the ongoing project)
  - Progress tracked by completed time vs. estimated time
- Estimated hours must be >= 0 (cannot be negative)
- Start date can be in the past (for historical projects)

**Examples:**
- "Website Redesign" for Acme Corp, Jan 1 - Mar 31, 120 hours (no phases - simple project)
- "App Development" for Tech Startup, Feb 1 - Apr 30, 240 hours with 2 explicit phases:
  - Phase 1: "Design & Planning" (Feb 1 - Feb 28, 80 hours)
  - Phase 2: "Development" (Mar 1 - Apr 30, 160 hours)
- "Ongoing Client Support" for Acme Corp, Jan 1 - Dec 31, 520 hours with recurring phase:
  - Pattern: Weekly, 10 hours per week (distributed across 5 project working days = 2 hrs/day)
  - Continues until project end date (Dec 31)
  - Total: 52 weeks × 10 hours = 520 hours

---

### 4. Phase
**What it is:**
A time period within a project where specific work happens, with a portion of the project's time budget. **Phases are defined by DAYS (date range)**, not hours. Can be individually defined or recurring.

**Essential Properties:**
- Project (which project does this belong to?)
- Type (explicit, recurring)
- Date range (start date and end date for explicit phases; pattern defines dates for recurring phases)

**Type-Specific Properties:**

**Explicit Phase:**
- Start date (calendar date, not time)
- End date (calendar date, not time)

**Recurring Phase:**
- Pattern (daily, weekly, monthly)
- Hours per occurrence
- Specific days (e.g., weekdays only for daily)
- Week of month (for monthly patterns)

**Optional Properties:**
- Name (e.g., "Design Phase", "Development Phase")
- Description

**Key Rules:**
- A project has EITHER explicit phases OR a recurring phase, NEVER both
- **Explicit phases:**
  - Each phase gets a portion of project's estimated hours
  - Phases MUST NOT overlap
  - Phases can have gaps between them
  - Last phase's end date IS the project's end date (synchronized)
- **Recurring phase:**
  - Pattern continues until project end date
  - Distributes hours evenly across occurrences

**Database Note:**
Currently stored in `milestones` table with both `start_date` and `end_date` populated.

**Examples:**
- Explicit: "Discovery Phase" (Jan 1-15, 40 hours)
- Explicit: "Design Phase" (Jan 16-31, 40 hours)
- Recurring: "Client Support" - 2 hours/day, every weekday
- Recurring: "Weekly Review" - 4 hours/week, every Monday

**Important Distinction:**
- **Phases** = TIME PERIODS defined by DAYS (date from → date to) for budgeting work across a date range
- **Events** = TIME BLOCKS defined by HOURS (start time → end time) for specific scheduled work

---

### 5. Group
**What it is:**
The primary way to organize projects by important life areas (e.g., Work, Personal, Health).

**Essential Properties:**
- Name

**Optional Properties:**
- Icon (emoji or icon identifier) - not currently required
- Order (display sequence) - currently required

**Key Rules:**
- **Current State:**
  - Projects MUST belong to exactly 1 group (required)
  - Users create a fixed list of groups
  - Groups represent major life areas or categories
  - Group names must be unique per user (case-insensitive: "Work" and "WORK" are treated as the same)
- **Future State (planned):**
  - Projects may have 0 or 1 group (making groups optional)
  - UI updates needed to support ungrouped projects
  - May expand to support multiple group sets (e.g., a project could belong to "Work" in one set AND "Q1 2026" in another set)
- Deleting a group requires reassigning all projects in that group first
- Users create whatever groups make sense to their workflow

**Examples:**
- "Work" (professional projects)
- "Personal" (personal life projects)
- "Health & Fitness" (wellbeing projects)
- "Side Projects" (hobby or passion projects)
- "Family" (family-related projects)

**Purpose:**
Groups help distribute projects across important life areas, making it easier to see balance and prioritize across different aspects of life.

**Difference from Labels:**
- Groups = Primary categorization by life area (currently required, 1 per project)
- Labels = Flexible tags for filtering (optional, many per project)

---

### 6. Label
**What it is:**
Flexible tags for categorizing and filtering projects.

**Essential Properties:**
- Name

**Key Rules:**
- Projects can have 0, 1, or many labels
- Labels are shared across all projects
- Label names must be unique per user (case-insensitive: "#urgent" and "#URGENT" are treated as the same)
- Labels are for filtering/organizing only (no business logic)
- Deleting a label removes it from all projects

**Examples:**
- #christmas
- #pro-bono
- #q1-2026
- #urgent
- #backend

**Difference from Groups:**
- Groups = Collections you click to view projects
- Labels = Tags you filter by (across any view)

---

### 7. Calendar Event
**What it is:**
A specific time block representing work (planned or completed). **Events are defined by HOURS (specific start and end times)**, not days.

**Essential Properties:**
- Start time (specific time of day, e.g., 9:00 AM)
- End time (specific time of day, e.g., 3:00 PM)
- Type (normal, tracked, completed, habit, task)

**Optional Properties:**
- Project (which project is this for?)
- Title
- Description
- Category (habit, task, meeting, etc.)
- Completed (boolean - is this done?)

**Key Rules:**
- Events linked to a project count toward that project's time
- Events NOT linked to a project don't affect any project
- Habits NEVER count toward project time (even if project field set)
- Tasks NEVER count toward project time (even if project field set)
- Event linked to a project removes that day from auto-estimate calculation for that project (day becomes "used")
- Events may technically span multiple days, but UI does not provide tools for creating multi-day events (single-day events only)

**Examples:**
- "Website work" (Project: Website Redesign, 8 hours, completed = false) → Planned Time
- "Website coding" (Project: Website Redesign, 6 hours, completed = true) → Completed Time
- "Morning exercise" (category: habit, no project) → Not project time
- "Buy groceries" (category: task, no project) → Not project time

---

### 8. Work Slot
**What it is:**
A time block when you're available to work on a specific day of the week (e.g., "Every Monday 9am-5pm"). Work slots define your weekly work schedule and recur by their nature.

**Essential Properties:**
- Start time (e.g., 9:00 AM)
- End time (e.g., 5:00 PM)
- Day of week (Monday, Tuesday, Wednesday, etc.)

**Calculated Property:**
- Duration (calculated from start/end) - this contributes to **work hours**

**Key Rules:**
- Work slots recur weekly (a Monday slot applies to ALL Mondays)
- Work slots CANNOT cross midnight (must be within a single day)
- A day with at least one work slot = a **working day**
- Multiple slots can exist on the same day (e.g., morning + afternoon with lunch break)
- Holidays override work slots (no capacity on holidays even if slots exist)
- Specific dates can have overrides (different hours or no work for that occurrence only)
- When modifying a recurring work slot, user can choose to update all future occurrences or just that specific date

**Examples:**
- "Every Monday 9am-5pm" (8-hour duration)
- "Every Friday 9am-1pm" (4-hour duration)
- "Every Tuesday 9am-12pm" + "Every Tuesday 2pm-5pm" (6 work hours with lunch break)
- Override: "December 30, 2025, no work" (removes Monday slot for that specific date)
- Override: "December 31, 2025, 10am-2pm" (changes Friday hours for that specific date)

---

### 9. Holiday
**What it is:**
A date when normal work hours don't apply.

**Essential Properties:**
- Start date and end date (duration - can be a single day or multiple days)

**Optional Properties:**
- Name (e.g., "Christmas", "New Year's Day")
- Recurs annually (boolean - does this repeat every year?)

**Key Rules:**
- Holidays OVERRIDE work slots (no work capacity on holidays)
- Auto-estimates SKIP holidays (no distribution to holiday dates)
- Users CAN still create manual events on holidays (exceptions/overtime)
- Holiday on a weekend is redundant but harmless
- Recurring holidays automatically appear each year

**Examples:**
- December 25 - December 25, "Christmas", recurs annually (single day)
- July 4 - July 4, "Independence Day", recurs annually (single day)
- June 15, 2026 - June 19, 2026, "Company Retreat" (one-time, 5 days)

**Why This Matters:**
- Auto-estimate calculations exclude holidays
- Capacity warnings account for holidays
- Project duration calculations skip holidays

---

<!-- SECTION: PART-2-DERIVED-CONCEPTS -->
## 🧮 PART 2: DERIVED CONCEPTS (Calculated from Entities)

These are important concepts that don't exist as separate database entities, but are calculated from the entities above. Users need to understand these to use the app effectively.

**Concept Overview:**
1. Working Days
2. Work Hours
3. Capacity
4. Availability
5. Overcommitted

---

### 1. Working Days

**What it is:**
A day considered workable - any day that has at least one work slot.

**Calculated from:**
- Work Slots (if a date has work slot instances, it's a working day for that user)
- Holidays (override: even if work slots exist, holidays are NOT working days)

**Three Levels:**

This app uses "working days" in three different contexts:

| Level | Definition | Calculated From | Example |
|-------|-----------|-----------------|---------|
| **User Working Days** | Days with work slots, excluding holidays (base level) | Work Slots + Holidays | Mon-Fri work slots = User working days Mon-Fri (except holidays) |
| **Project Working Days** | User working days with optional project-specific overrides | User Working Days + Project Overrides (stored as project property) | User: Mon-Fri, Project override: Wed non-working = Mon, Tue, Thu, Fri |
| **Remaining Working Days** | Project working days minus days with planned/completed events (used in auto-estimate calculations) | Project Working Days - Event Days | Project: Mon-Fri, Events on Mon-Tue = Remaining: Wed, Thu, Fri |

**Not Stored Because:**
Work slots are the source of truth. Working days are derived by checking: "Does this date have work slot instances?" or "Does this date have project-level overrides?"

**Project Overrides:**
Projects can override the user's working days in two ways:
1. **Chosen work days** (alternative weekly recurring template): Project specifies which days of the week are working days (e.g., user works Mon-Fri, but this project only has work on Tue-Thu)
2. **Specific date exclusions** (not yet implemented): Mark specific dates as non-working or working exceptions (e.g., "No work on Dec 30 for this project" or "Work on Saturday Jan 4 for this project only")

These overrides are stored as project properties, not separate entities.

**Critical For:**
- **User Working Days**: Determines base availability
- **Project Working Days**: Determines which days can have auto-estimates for a project
- **Remaining Working Days**: Auto-estimate calculations (remaining hours ÷ remaining working days)

---

### 2. Work Hours

**What it is:**
The total duration of work time available, calculated by summing work slot durations.

**Calculated from:**
Work Slots (sum of all slot durations for a given time period)

**Examples:**
- Daily work hours: Mon has two slots (9am-12pm + 2pm-5pm) = 6 work hours for Monday
- Weekly work hours: 5 working days × 8 hours/day = 40 work hours/week
- Project work hours: Sum of all work hours within project date range

**Not Stored Because:**
Work slots already contain start/end times. Duration is calculated on-demand: `end_time - start_time`.

---

### 3. Capacity

**What it is:**
The total amount of work time available to allocate to projects after work slots, working days, and holidays have been determined.

**Calculated from:**
- Work Slots (define when you can work)
- Work Hours (total duration from slots)
- Holidays (days with zero capacity)

**Examples:**
- Base capacity: 40 work hours/week (from work slots)
- Project-specific capacity: Only count work hours on project working days

**Not Stored Because:**
Constantly changing as events are added/completed. Calculated when needed for capacity warnings and availability checks.

**Used For:**
- "Am I overbooked?" warnings
- "Can I take on this project?" forecasting
- Auto-estimate distribution calculations

---

### 4. Availability

**What it is:**
The amount of unallocated work time - capacity that hasn't been committed to planned or auto-estimated work yet. Also called "remaining capacity."

**Calculated from:**
```
Availability = Capacity - Planned Time - Auto-Estimated Time
```

**Examples:**
- Week has 40 work hours capacity
- Planned events: 10 hours
- Auto-estimated time: 18 hours
- **Availability: 12 hours** (40 - 10 - 18)

**When it's different from capacity:**
- **Capacity**: Total work time available (40 hours/week)
- **Availability**: Unallocated work time after commitments (12 hours free)

**Not Stored Because:**
Changes constantly as you add/remove planned events or update project estimates. Calculated on-demand to answer "How much free time do I have?"

**Used For:**
- "Can I take on this new project?" checks
- "Do I have time for this meeting?" decisions
- Answering "How much time is available next week?"

**Key Distinction:**
- **Negative availability** = Overcommitted (committed more than capacity)
- **Zero availability** = Fully booked (no free time)
- **Positive availability** = Time available to allocate

---

### 5. Overcommitted

**What it is:**
When the total committed time (planned events + auto-estimated time) exceeds available capacity.

**Calculated from:**
- Capacity (total work hours available from work slots, minus holidays)
- Planned Time (events scheduled at specific times)
- Auto-Estimated Time (remaining hours distributed across remaining working days)
- Completed Time (already done, fills capacity but doesn't cause overcommitment for future)

**Examples:**
- Week has 40 work hours capacity
- Project A: 20 hours auto-estimated
- Project B: 15 hours auto-estimated
- Planned events: 8 hours
- Total committed: 20 + 15 + 8 = 43 hours
- **Overcommitted by 3 hours** (43 - 40)

**Not Stored Because:**
Constantly recalculating as events are added, completed, or estimates change. Calculated on-demand for warnings and capacity checks.

**Used For:**
- Capacity warnings: "You're overbooked this week"
- Feasibility checks: "Can I take on this new project?"

**Key Point:**
Overcommitment is a **warning**, not a blocker. Users can still add work, but the system alerts them that they've committed more time than they have available.

---

<!-- SECTION: ENTITY-RELATIONSHIPS -->
### Entity Relationships Summary

**Ownership (all entities belong to a user):**
- User → owns → Clients, Projects, Phases, Groups, Labels, Events, Work Slots, Holidays

**Core Hierarchy:**
- Client → has many → Projects (required: every project must have a client)
- Project → has many → Phases (optional: 0, 1, or many explicit phases, OR 1 recurring phase)
- Project → has many → Calendar Events (optional: planned and completed work)

**Organizational:**
- Project → belongs to → 1 Group (currently required)
- Project → has many → Labels (optional: 0, 1, or many)

**Capacity:**
- User → has many → Work Slots (defines time blocks when you can work - database entities with IDs)
- User → has → Work Days (DERIVED from work slots - not stored)
- User → has → Capacity (DERIVED from work slots and holidays - not stored)
- User → has many → Holidays (override work slots on specific dates)

**Deletion Constraints:**
- Cannot delete Client if Projects exist (must reassign/delete projects first)
- Cannot delete Group if Projects exist (must reassign projects first)
- Deleting Label removes it from all projects (no blocking)
- Deleting Project cascades to its Phases and Events

---

<!-- SECTION: PART-3-TIME-CONCEPTS -->
## ⏱️ PART 3: TIME CONCEPTS (Critical to This App)

**This is what makes the app unique.** Most apps just track "time spent", "time estimates", or "deadlines". This app has a sophisticated hierarchy of time concepts.

**Time Concept Overview:**
0. Capacity (The Foundation)
1. Estimated Time
2. Auto-Estimated Time
3. Planned Time
4. Completed Time

---

### The Time Hierarchy

```
CAPACITY (Your Available Time)
  │
  ├─ Work Slots (time blocks: Mon-Fri 9am-5pm)
  ├─ Work Hours (calculated duration: 40 hours/week from slots)
  ├─ User Working Days (Days with work slots, excluding holidays)
  └─ Holidays (Days with no capacity)
      ↓
PROJECT TIME (Time allocated to projects)
  │
  ├─ Project Working Days (User working days with project overrides)
  │     ↓
  ├─ ESTIMATED TIME (120 hours total, Jan 1-31)
  │     ↓
  ├─ AUTO-ESTIMATED TIME (120 hours ÷ 20 remaining working days = 6 hrs/day)
  │     ↓
  ├─ PLANNED TIME (User schedules: Jan 5 9am-3pm = 6 hours)
  │     → Removes Jan 5 from remaining working days
  │     → 120 hours now spread over 19 remaining days
  │     ↓
  └─ COMPLETED TIME (User completes: Jan 5, 5 hours)
        → Reduces total to 115 hours remaining
        → 115 hours spread over 19 remaining days
```

---

### 0. Capacity (The Foundation)

**What it is:**
The total time you have available for work. Not a "type" of project time, but the container everything else fits into.

**Defined by:**
- **Work Slots** - Your schedule blocks (e.g., Mon-Fri 9am-5pm)
- **User Working Days** - Days that have work slots AND aren't holidays
- **Holidays** - Days with zero capacity (override work slots)

**Work Slots vs Work Hours:**
- **Work Slots** = Time blocks when you can work (set in user settings, e.g., "Fri 9am-5pm")
- **Work Hours** = Total duration calculated from work slots (e.g., 8 hours/day × 5 days = 40 hours/week)
- Work slots can have planner overrides (delete a day or change hours without affecting the overall pattern)

**Examples:**
- Standard capacity: Mon-Fri 9am-5pm work slots = 8 hours/day × 5 days = 40 work hours/week
- Mixed arrangement: Mon-Thu 9am-5pm (8 hrs/day), Fri 6am-8am + 11am-3pm (6 hrs/day) = (4 × 8) + 6 = 38 work hours/week (each work slot is on a single day, recurs weekly)
- Holiday override: Dec 25 = 0 hours (even though it's a weekday with work slots)

**Why this matters:**
- Auto-estimates only appear on days with work slot times
- Projects compete for capacity (multiple projects = shared capacity)
- Overbooked warnings compare scheduled time to capacity
- Working days (not calendar days) determine auto-estimate distribution

**User sees this as:**
- Work slot settings
- Calendar showing available/busy time
- Warnings when capacity exceeded

---

### 1. Estimated Time

**What it is:**
The total time budget you allocate to a project (or phase within a project). This is the broadest, highest-level view of project time.

**Where it's stored:**
- `project.estimated_hours` (for whole project)
- `phase.time_allocation` (for phase within project)

**Properties:**
- Assigned to a date range (project start → end, or phase start → end)
- Can be split across phases
- Remains constant until you change it
- The "big picture" allocation

**Examples:**
- "Website project: 120 hours, Jan 1 - Jan 31"
- "Design Phase: 40 hours, Jan 1 - Jan 15"
- "Development Phase: 80 hours, Jan 16 - Jan 31"

**Key Rules:**
- Set when creating project/phase
- Can be updated later
- Represents TOTAL work (not remaining)
- This is the "source" that auto-estimates draw from

**User sees this as:**
- "Project budget: 120 hours"
- "Phase allocation: 40 hours"

---

### 2. Auto-Estimated Time

**What it is:**
The estimated time broken down into individual days - the system automatically distributes your total estimate across working days within a project duration.

**Where it's stored:**
NOT stored - calculated dynamically in real-time

**How it's calculated (simple terms):**
```
Step 1: Calculate remaining hours
  Remaining Hours = Estimated Hours - Completed Hours

Step 2: Count remaining working days
  Start with project working days (user working days with project overrides applied)
  Count from today to project end date
  Remove holidays
  Remove any days that have planned or completed events for this project
  = Remaining Working Days

Step 3: Divide
  Hours Per Day = Remaining Hours ÷ Remaining Working Days
```

**When it appears:**
- Only on remaining working days (project working days without events, not holidays)
- Only during work slot times
- Only today and future dates (never past)

**Examples:**

**Scenario 1: No planned events yet**
- Project: 120 hours, Jan 1-31
- Project working days: 22 (user working days, no project overrides)
- Planned/completed events: None
- Remaining working days: 22
- Calculation: 120 ÷ 22 = 5.45 hours/day
- Shows on ALL 22 remaining working days

**Scenario 2: User plans one day**
- User plans: Jan 5, 9am-3pm (6 hours)
- Remaining working days: 21 (Jan 5 removed - has event)
- Calculation: 120 ÷ 21 = 5.71 hours/day
- Shows on 21 remaining working days (NOT on Jan 5)

**Scenario 3: User completes work**
- User completes: Jan 5, 5 hours
- Remaining hours: 120 - 5 = 115 hours
- Remaining working days: 21 (Jan 5 still removed - has event)
- Calculation: 115 ÷ 21 = 5.48 hours/day
- Shows on 21 remaining working days

**Key Rules:**
- **ANY planned or completed event removes that day from remaining working days count**
- Recalculates dynamically as work progresses
- Only shown for projects with estimated hours > 0
- Never appears in the past
- Never appears on holidays
- Never appears outside work slot times

---

### 3. Planned Time

**What it is:**
Calendar events with specific start and end times when you commit to working on the project. **Total planned time** is the sum of these events' durations across a time period (e.g., weekly, monthly, or for the entire project).

**The key difference:**
- Estimated Time: "120 hours across Jan 1-31" (date range, no specific times)
- Auto-Estimated: "~5 hours per day" (daily distribution, still no specific times)
- **Planned Time: Individual events with specific times on specific days**
  - "Jan 5, 9am-3pm" (6 hours)
  - "Jan 8, 2pm-3pm" (1 hour)
  - **Total planned time for week: 7 hours** (sum of events)

**Where it's stored:**
Calendar events with:
- `project_id` is set (linked to project)
- `start_time` and `end_time` (specific times within a single day - cannot cross midnight)
- `completed = false` (not done yet)
- `type != 'tracked'` and `type != 'completed'`
- Category is NOT 'habit' or 'task'

**Examples:**
- "Website coding" - Jan 5, 9am-3pm (6 hours)
- "Client meeting" - Jan 8, 2pm-3pm (1 hour)
- "Design work" - Jan 10, 10am-4pm (6 hours, with 2-hour lunch break = 4 work hours)
- Total planned time for Jan 5-10: 6 + 1 + 4 = 11 hours

**Key Rules:**
- User manually creates these events
- Must be linked to a project
- Must have specific start/end times within a single day (cannot cross midnight)
- **Each event removes that day from auto-estimate calculation**
- In the future (not completed yet)

**Effect on auto-estimates:**
```
BEFORE planning Jan 5:
  Remaining hours: 120
  Remaining working days: 22
  Auto-estimate per day: 5.45 hours
  Jan 5 shows: ░░░░ 5.45 hrs (auto-estimate)

AFTER planning Jan 5 (9am-3pm, 6 hours):
  Remaining hours: Still 120 (not completed yet)
  Remaining working days: 21 (Jan 5 removed from count)
  Auto-estimate per day: 120 ÷ 21 = 5.71 hours
  Jan 5 shows: Planned event (6 hrs) - no auto-estimate
```

---

### 4. Completed Time

**What it is:**
Work that's actually been done - you've finished the work and recorded the hours.

**Two Ways to Create Completed Time:**

1. **Tracked Time** (via time tracker):
   - User starts a timer on a project
   - Timer runs while working
   - User stops timer when done
   - System creates calendar event with `type = 'tracked'`
   - Exact start/end times recorded automatically

2. **Manually Completed**:
   - User creates an event and marks it complete
   - OR user marks a planned event as completed
   - System sets `completed = true` or `type = 'completed'`
   - User specifies start/end times

**Where it's stored:**
Calendar events with ANY of:
- `completed = true` (manually marked complete)
- `type = 'tracked'` (from time tracker)
- `type = 'completed'` (explicitly completed)

AND:
- `project_id` is set (linked to project)
- Category is NOT 'habit' or 'task'

**Examples:**
- Tracked time: "Website coding" - Jan 5, 9:15am-2:30pm (tracked via timer, 5.25 hours)
- Manually completed: "Client meeting" - Jan 8, 2pm-3pm (manually marked complete, 1 hour)
- Converted planned event: "Design work" was planned 9am-5pm, actually worked 9am-2pm (updated and marked complete, 5 hours)

**Key Rules:**
- Represents actual work done
- **Reduces remaining hours** (affects future auto-estimates)
- **Removes that day from auto-estimate calculation**
- In the past or present (not future)
- Has specific start/end times (when work actually happened)
- Tracked time captures exact duration automatically
- Manual completion lets user adjust hours if needed

**Effect on calculations:**
```
BEFORE completing Jan 5:
  Estimated hours: 120
  Completed hours: 0
  Remaining hours: 120
  Remaining working days: 21 (Jan 5 has planned event)
  Auto-estimate per day: 120 ÷ 21 = 5.71 hours

AFTER completing Jan 5 (5 hours actual):
  Estimated hours: 120 (unchanged)
  Completed hours: 5
  Remaining hours: 115
  Remaining working days: 21 (Jan 5 still excluded - now has completed event)
  Auto-estimate per day: 115 ÷ 21 = 5.48 hours
```

**Progress tracking:**
- Shows exactly when work was done
- Calculates total hours completed
- Shows % complete (completed / estimated × 100)
- Forecasts work hours to complete project with project duration

---

### Critical Rule: Day Calculation Logic

**For each day, for each project:**

```
IF day has ANY events (planned OR completed) linked to this project:
    Day is REMOVED from remaining working days count
    Show event(s) with appropriate styling (planned or completed)
    DO NOT show auto-estimate
ELSE IF day is in the past:
    Show nothing (no estimates for past days without events)
ELSE IF day is not in project working days:
    Show nothing (not a working day for this project)
ELSE IF day is a holiday:
    Show nothing (no work on holidays)
ELSE:
    Day IS a remaining working day
    Show auto-estimate for this day
END IF
```

**Key Points:**
- Events (planned OR completed) **completely remove a day** from remaining working days count
- Auto-estimate redistributes across **remaining** working days only
- One or the other, never both on same day
- Auto-estimates only appear on remaining working days (within work slot times)

**Example Week:**

```
Project: 120 hours total, Jan 1-31
Completed so far: 10 hours
Remaining hours: 110 hours
Remaining working days (no events): 20

Monday (Jan 6):
  - Has planned event: "Website work" 9am-5pm (8 hours)
  - Shows: Planned event (8 hrs)
  - Remaining working days: NOT counted (20 days, not 21)

Tuesday (Jan 7):
  - Has completed event: "Client meeting" 2pm-3pm (1 hour)
  - Shows: Completed event (1 hr)
  - Remaining working days: NOT counted (even though only 1 hour - day is used)

Wednesday (Jan 8):
  - No events
  - Is a project working day (not holiday)
  - Shows: Auto-estimate (5.5 hrs)
  - Remaining working days: COUNTED

Thursday (Jan 9):
  - Holiday
  - Shows: Nothing
  - Remaining working days: NOT counted

Friday (Jan 10):
  - No events
  - Is a project working day
  - Shows: Auto-estimate (5.5 hrs)
  - Remaining working days: COUNTED

Calculation:
  110 remaining hours ÷ 20 remaining working days = 5.5 hours/day
```

---

### Why This Hierarchy Matters

**Traditional apps:**
1. You estimate total time: 120 hours
2. You track actual time: 15 hours done
3. Math: 105 hours remaining
4. That's it - no distribution, no forecasting

**This app:**
1. **Capacity**: You define when you can work (work slots: Mon-Fri 9am-5pm)
2. **Estimated Time**: You allocate 120 hours to project (Jan 1-31)
3. **Auto-Estimated Time**: System shows "~5 hrs/day to finish on time"
4. **Planned Time**: You schedule specific work (Jan 5, 9am-3pm)
   - Auto-estimate removes Jan 5 from remaining working days, redistributes across other days
5. **Completed Time**: You finish work (Jan 5, 5 hours actual)
   - Remaining hours drop to 115
   - Auto-estimate recalculates: 115 ÷ remaining working days

**The benefits:**
- **Capacity awareness**: See if you're overbooked
- **Automatic distribution**: Don't manually schedule every day
- **Dynamic rebalancing**: Auto-estimates adjust as you work
- **Realistic forecasting**: "At current pace, your project will be delayed"
- **Specific planning**: Schedule critical days, auto-fill the rest
- **Progress tracking**: See exactly what's done vs. what's left

**The user experience:**
1. Set work slots (capacity)
2. Create project with estimate (estimated time)
3. See auto-estimated hours distributed across working days
4. Schedule specific days when needed (planned time)
5. Track work as completed (completed time)
6. Watch auto-estimates adjust automatically

---

<!-- SECTION: PART-4-WORKFLOWS -->
## 🔄 PART 4: KEY WORKFLOWS

These are the primary user journeys through the application.

**Workflow Overview:**
1. Initial Setup
2. Create a Client
3. Create a Simple Project
4. Create a Project with Phases
5. Plan Specific Work
6. Track Completed Work
7. Take a Holiday
8. Review Progress

---

### Workflow 1: Initial Setup

**Goal:** Configure the app for first use

**Steps:**
1. User signs up/logs in (Supabase Auth)
2. Create groups for life areas (e.g., "Work", "Personal", "Health")
3. Set work slots (e.g., Mon-Fri, 9am-5pm)
4. Add any known holidays (e.g., Christmas, bank holidays)
5. Create first project with client.

**Result:** App is ready to accept projects with proper capacity calculations.

---

### Workflow 2: Create a Client

**Goal:** Add a client before creating projects for them

**Steps:**
1. User clicks "New Client" (or creates inline during project creation)
2. Enters client name (required, must be unique)
3. Optionally adds contact information:
   - Contact email
   - Contact phone
   - Billing address
   - Notes
4. Saves client

**Result:** Client is available to select when creating projects.

---

### Workflow 3: Create a Simple Project

**Goal:** Add a project without phases

**Steps:**
1. User clicks "New Project"
2. Enters project name
3. Selects or creates a client
4. Selects a group
5. Sets start date and end date
6. Sets estimated hours (optional, can be 0)
7. Adds labels (optional)
8. Saves project

**Result:** Project is created with auto-estimated hours distributed across working days.

---

### Workflow 4: Create a Project with Phases

**Goal:** Add a project broken into time periods

**Steps:**
1. Create project (as above, but don't set estimated hours yet)
2. Add Phase 1: name, start date, end date, hours allocation
3. Add Phase 2: name, start date (must be after Phase 1 end), end date, hours allocation
4. Project end date auto-syncs to last phase's end date
5. Project estimated hours = sum of phase allocations

**Result:** Each phase is treated as a distinct time period with its own auto-estimate allocation.

---

### Workflow 5: Plan Specific Work

**Goal:** Schedule work at specific times

**Steps:**
1. User navigates to a day on the calendar
2. Creates a new event with start time and end time
3. Links event to a project
4. Event appears on calendar

**Result:** Day is removed from auto-estimate calculation; planned hours shown instead.

---

### Workflow 6: Track Completed Work

**Goal:** Record actual work done

**Option A - Mark planned event complete:**
1. User has a planned event
2. User marks it as completed
3. Optionally adjusts actual hours

**Option B - Use time tracker:**
1. User starts timer on a project
2. User works
3. User stops timer
4. Tracked time is recorded as completed event

**Result:** Remaining hours decrease; auto-estimates recalculate for remaining days.

---

### Workflow 7: Take a Holiday

**Goal:** Block out days with no work

**Steps:**
1. User creates a holiday (date, optional name)
2. Optionally marks as recurring annually

**Result:** Holiday date excluded from all auto-estimate calculations; no capacity on that day.

---

### Workflow 8: Review Progress

**Goal:** Understand project status

**User can see:**
- Total estimated hours vs. completed hours
- Percentage complete
- Auto-estimated hours per remaining day
- Forecast finish date (at current pace)
- Whether capacity is overbooked

---

<!-- SECTION: PART-5-VALIDATION -->
## ✅ PART 5: VALIDATION RULES SUMMARY

Consolidated validation rules across all entities.

**Rule Categories:**
- Names and Text
- Contact Information (Client)
- Dates
- Numbers
- Relationships
- Deletion Constraints

---

### Names and Text

| Entity | Field | Rules |
|--------|-------|-------|
| Client | Name | 1-100 chars, required, unique per user (case-insensitive TO FIX), trimmed |
| Project | Name | Required, trimmed |
| Group | Name | Required, unique per user (case-insensitive), trimmed |
| Label | Name | Required, unique per user (case-insensitive), trimmed |
| Phase | Name | Optional |
| Holiday | Name | Optional |

### Contact Information (Client)

| Field | Rules |
|-------|-------|
| Email | Optional; if provided, must contain `@` and `.`, no whitespace |
| Phone | Optional; if provided, can contain digits, spaces, hyphens, parentheses, plus signs |
| Billing Address | Optional; free-form text |
| Notes | Optional; free-form text |

### Dates

| Entity | Rule |
|--------|------|
| Project | End date must be AFTER start date |
| Project | If has phases, end date must be >= last phase's end date |
| Phase | End date must be >= start date |
| Phase | Phases must not overlap within a project |
| Holiday | Single date required |

### Numbers

| Entity | Field | Rules |
|--------|-------|-------|
| Project | Estimated hours | Must be >= 0 |
| Phase | Time allocation | Must be >= 0; sum of all phase allocations must not exceed project estimated hours |
| Event | Duration | Calculated from start/end times, must be > 0 |

### Relationships

| Rule | Enforcement |
|------|-------------|
| Project must have a client | Required on create |
| Project must have a group | Required on create (currently) |
| Phase must have a project | Required on create |
| Event linked to project | Optional |

### Deletion Constraints

| Entity | Constraint |
|--------|------------|
| Client | Cannot delete if has projects (ON DELETE RESTRICT) |
| Group | Cannot delete if has projects (must reassign first) |
| Label | Can delete; removes from all projects |
| Project | Deletes associated phases and events |
| Holiday | Can delete freely |

---

## 📚 RELATED DOCUMENTS

- **Rules Logic** (`rules/Rules Logic.md`) - Detailed business rules, edge cases, state transitions, calculations
- **Architecture Guide** (`../Architecture Guide.md`) - Technical implementation, code structure, data flow
- **User Guide** (`../user/User Guide.md`) - End-user documentation