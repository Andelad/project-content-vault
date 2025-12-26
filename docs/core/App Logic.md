# App Logic - Time Forecasting Application

**Version:** 1.0  
**Date:** December 26, 2025  
**Status:** IN PROGRESS - Foundation Document  
**Author:** [Your Name]

---

## 📖 WHAT THIS DOCUMENT IS

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

Most project management apps track:
- Tasks
- Deadlines
- Completion status

**This app is fundamentally different** - it's about **TIME FORECASTING**.

The app helps you:
1. **Estimate** how long work will take
2. **Distribute** that time across your calendar
3. **Plan** specific work sessions
4. **Track** actual time spent
5. **Forecast** when you'll finish

**The core innovation:** Four distinct types of time that work together.

---

## 🏗️ PART 1: CORE ENTITIES (Things That Exist)

These are concrete objects stored in the database. Each has a unique ID and can be created, updated, and deleted.

---

### 1. User
**What it is:**
The person using the application.

**Essential Properties:**
- ID (unique identifier)
- Authentication details (managed by Supabase Auth)

**Key Rules:**
- Each user has completely isolated data (Row Level Security)
- User deletion cascades to all owned entities
- All other entities belong to a user

---

### 2. Client
**What it is:**
The organization or person you're doing work for.

**Essential Properties:**
- Name (required)
- Status (active, inactive, archived)

**Optional Properties:**
- Contact email
- Contact phone
- Billing address
- Notes

**Key Rules:**
- Every project MUST have a client
- Clients are independent entities (not just text)
- Can have multiple projects per client
- Cannot delete client if projects exist (or cascade delete? CLARIFY)

**Examples:**
- "Acme Corporation" (client)
- "University of Edinburgh" (client)
- "Personal Projects" (can be a client for your own work)

---

### 3. Project
**What it is:**
A piece of work that needs to be completed by a deadline, with a time budget.

**Essential Properties:**
- Name (what is it?)
- Client (who is it for? - REQUIRED)
- Start date (when does work begin?)
- End date (when must it be finished?)
- Estimated hours (how much work total?)

**Organizational Properties (Optional):**
- Groups (0, 1, or many - for organizing/filtering)
- Labels (0, 1, or many - flexible tags)

**Key Rules:**
- MUST have a client
- MUST have start date and end date
- End date >= start date
- MUST have estimated hours > 0 (if tracking time)
- Start date can be in the past (for historical projects)
- If has phases: end date IS the last phase's end date (auto-synced)
- If has recurring estimate: [CLARIFY: how does end date work?]

**Examples:**
- "Website Redesign" for Acme Corp, Jan 1 - Mar 31, 120 hours
- "Thesis Research" for University, Sep 1 - Apr 30, 500 hours

---

### 4. Phase
**What it is:**
A time period within a project where specific work happens, with a portion of the project's time budget.

**Essential Properties:**
- Project (which project does this belong to?)
- Start date (when does this phase begin?)
- End date (when does this phase end?)
- Time allocation (how many hours of the project's total?)

**Optional Properties:**
- Name (e.g., "Design Phase", "Development Phase")
- Description

**Key Rules:**
- Phases divide a project into time periods
- Each phase gets a portion of project's estimated hours
- Phases MUST NOT overlap (no two phases on same date)
- Phases [CLARIFY: must be continuous? or gaps allowed?]
- Sum of phase allocations [CLARIFY: must equal project hours? can be less? can exceed?]
- Last phase's end date IS the project's end date (synchronized)
- Minimum phase duration = [CLARIFY: 1 day? can be 0 days?]

**Database Note:**
Currently stored in `milestones` table with both `start_date` and `end_date` populated.

**Examples:**
- "Discovery Phase" (Jan 1-15, 40 hours)
- "Design Phase" (Jan 16-31, 40 hours)
- "Development Phase" (Feb 1-28, 40 hours)

**Important Distinction:**
Phases are NOT tasks or milestones in the traditional sense. They're TIME PERIODS for budgeting work.

---

### 5. Recurring Estimate
**What it is:**
An alternative to phases - regular time allocation repeated on a schedule.

**Essential Properties:**
- Project (which project?)
- Pattern (daily, weekly, monthly)
- Hours per occurrence (how much each time?)

**Optional Properties:**
- Specific days (e.g., weekdays only for daily)
- Week of month (for monthly patterns)

**Key Rules:**
- A project has EITHER phases OR recurring estimate, NEVER both
- Recurring continues until project end date
- Distributes hours evenly across pattern

**Examples:**
- "Client Support" - 2 hours/day, every weekday
- "Weekly Review" - 4 hours/week, every Monday
- "Monthly Report" - 8 hours/month, first Monday

**Mutual Exclusivity:**
If project has phases → Cannot add recurring estimate
If project has recurring estimate → Cannot add phases

---

### 6. Calendar Event
**What it is:**
A specific time block representing work (planned or completed).

**Essential Properties:**
- Start time
- End time
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
- Event blocks auto-estimate for that day (if linked to project)

**Examples:**
- "Website work" (Project: Website Redesign, 8 hours, completed = false) → Planned Time
- "Website coding" (Project: Website Redesign, 6 hours, completed = true) → Completed Time
- "Morning exercise" (category: habit, no project) → Not project time
- "Buy groceries" (category: task, no project) → Not project time

---

### 7. Work Hour
**What it is:**
Your availability - when you're able to work.

**Essential Properties:**
- Start time (e.g., 9:00 AM)
- End time (e.g., 5:00 PM)
- Days of week (e.g., Monday-Friday)

**Optional Properties:**
- Duration (calculated from start/end)

**Key Rules:**
- Defines your capacity
- Auto-estimates only appear during work hours
- Events outside work hours are "overtime"
- Holidays override work hours
- Can have multiple work hour blocks per day (e.g., 9-12, 2-5)

**Examples:**
- Monday-Friday, 9:00 AM - 5:00 PM (standard 8-hour day)
- Monday-Thursday, 9:00 AM - 6:00 PM, Friday 9:00 AM - 3:00 PM (flex schedule)

---

### 8. Holiday
**What it is:**
A date when normal work hours don't apply.

**Essential Properties:**
- Date (which day?)

**Optional Properties:**
- Name (e.g., "Christmas", "New Year's Day")
- Recurs annually (boolean - does this repeat every year?)

**Key Rules:**
- Holidays OVERRIDE work hours (no work capacity on holidays)
- Auto-estimates SKIP holidays (no distribution to holiday dates)
- Users CAN still create manual events on holidays (exceptions/overtime)
- Holiday on a weekend is redundant but harmless
- Recurring holidays automatically appear each year

**Examples:**
- December 25, "Christmas", recurs annually
- July 4, "Independence Day", recurs annually
- June 15, 2026, "Company Retreat" (one-time)

**Why This Matters:**
- Timeline calculations exclude holidays
- Capacity warnings account for holidays
- Project duration calculations skip holidays

---

### 9. Group
**What it is:**
A collection for organizing projects (optional organizational tool).

**Essential Properties:**
- Name

**Optional Properties:**
- Icon (emoji or icon identifier)
- Color (for visual distinction)
- Order (display sequence)

**Key Rules:**
- Projects can be in 0, 1, or MANY groups (flexible)
- Groups are for organization only (no business logic)
- Deleting a group doesn't delete projects
- Users create whatever groups make sense to them

**Examples:**
- "Client Work" (organizational group)
- "High Priority" (status-based group)
- "Design Projects" (type-based group)

**Note:** Projects can appear in multiple groups simultaneously (e.g., both "Client Work" AND "High Priority").

---

### 10. Label
**What it is:**
Flexible tags for categorizing and filtering projects.

**Essential Properties:**
- Name

**Optional Properties:**
- Color (for visual distinction)

**Key Rules:**
- Projects can have 0, 1, or many labels
- Labels are shared across all projects
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

## ⏱️ PART 2: TIME CONCEPTS (Critical to This App)

**This is what makes the app unique.** Most apps just track "time spent" or "deadline". This app distinguishes between FOUR different types of time.

---

### The Four Types of Time

```
PROJECT ESTIMATED TIME (120 hours total)
    ↓
    ├─→ AUTO-ESTIMATED TIME (80 hours remaining, distributed by system)
    ├─→ PLANNED TIME (20 hours, user-scheduled future work)
    └─→ COMPLETED TIME (20 hours, actually done work)
```

---

### 1. Estimated Time
**What it is:**
The total time budget for a project.

**Where it's stored:**
`project.estimated_hours` (database field)

**Examples:**
- Website project has 120 estimated hours
- Thesis has 500 estimated hours

**Key Rules:**
- Set when creating project
- Can be updated later
- Represents TOTAL work expected (not remaining)
- This is the "pool" that other time types draw from

**User sees this as:**
"Project budget: 120 hours"

---

### 2. Auto-Estimated Time
**What it is:**
System-calculated distribution of remaining hours across future working days.

**Where it's stored:**
NOT stored - calculated dynamically in real-time

**How it's calculated:**
```
Remaining Hours = Estimated Hours - Completed Hours
Future Working Days = Count(working days from today to end, excluding holidays)
Auto-Estimate Per Day = Remaining Hours / Future Working Days
```

**When it appears:**
- On days WITHOUT manual events (for that project)
- Only today and future dates (never past)
- Only during work hours
- Skips holidays

**Examples:**
- Project: 120 hours total, 20 hours completed = 100 hours remaining
- 25 working days left
- Auto-estimate: 100 / 25 = 4 hours per day

**Key Rules:**
- Blocked by ANY event on that day (planned OR completed)
- Updates dynamically as work is completed
- Only shown for projects with estimated hours > 0
- Never appears in the past

**User sees this as:**
Light color, no border on timeline - represents "what you need to do to finish on time"

---

### 3. Planned Time
**What it is:**
User-scheduled future work - specific time blocks you intend to work.

**Where it's stored:**
Calendar events with:
- `completed = false`
- `type != 'tracked'`
- `type != 'completed'`
- `project_id` is set

**Examples:**
- "Website coding" scheduled for Monday 9am-5pm (8 hours)
- "Client meeting" scheduled for Tuesday 2pm-3pm (1 hour)

**Key Rules:**
- User manually creates these events
- Linked to a project
- In the future (not completed yet)
- Blocks auto-estimate on that day (for that project)

**User sees this as:**
Lighter color, dashed border on timeline - represents "scheduled future work"

**Visual Distinction:**
```
Auto-Estimate:  ░░░░░░░░  (lightest, no border)
Planned Time:   ▒▒▒▒▒▒▒▒  (light, dashed border)
Completed Time: ████████  (dark, solid border)
```

---

### 4. Completed Time
**What it is:**
Work that's actually been done - tracked or marked complete.

**Where it's stored:**
Calendar events with ANY of:
- `completed = true`
- `type = 'tracked'`
- `type = 'completed'`

**Examples:**
- "Website coding" marked as completed (6 hours)
- Tracked time: "Debugging session" (3.5 hours)

**Key Rules:**
- Represents actual work done
- Reduces remaining hours (affects auto-estimates)
- In the past or present (not future)
- Blocks auto-estimate on that day

**User sees this as:**
Darker color, solid border on timeline - represents "work completed"

---

### Critical Rule: Timeline Day Estimate Logic

**For each day, for each project:**

```
IF day has events (planned OR completed) linked to this project:
    Show event time with appropriate styling
    DO NOT show auto-estimate
ELSE IF day is in the past:
    Show nothing (no estimates in past)
ELSE IF day is not a working day OR is a holiday:
    Show nothing (no estimates outside work hours)
ELSE:
    Show auto-estimate
END IF
```

**Key Points:**
- Events BLOCK auto-estimates (one or the other, never both)
- Both planned AND completed events block auto-estimates
- Auto-estimates only fill "empty" working days

**Example Day Breakdown:**

```
Monday: 8 hours planned → Shows 8 hours planned time (light, dashed)
Tuesday: 6 hours completed → Shows 6 hours completed time (dark, solid)
Wednesday: No events → Shows 4 hours auto-estimate (lightest, no border)
Thursday: Holiday → Shows nothing
Friday: No events → Shows 4 hours auto-estimate
```

---

### Why This Matters

**Traditional apps:**
- You estimate total time
- You track actual time
- That's it

**This app:**
- You estimate total time (Estimated Time)
- System distributes remaining time (Auto-Estimate)
- You schedule specific work (Planned Time)
- You track actual work (Completed Time)

**The benefit:**
- See if you're on track to meet deadlines
- Visualize workload across calendar
- Automatically rebalance as work progresses

---

## 🔄 PART 3: ENTITY RELATIONSHIPS

How entities connect to each other.

```
User
  │
  ├─── Clients (many)
  │      └─── Projects (many per client)
  │             ├─── Phases (0 or many, XOR...)
  │             ├─── Recurring Estimate (0 or 1, XOR phases)
  │             ├─── Calendar Events (many)
  │             ├─── Groups (many-to-many)
  │             └─── Labels (many-to-many)
  │
  ├─── Calendar Events (many)
  │      └─── Can link to Project (optional)
  │
  ├─── Work Hours (defines availability)
  │
  ├─── Holidays (dates with no work)
  │
  ├─── Groups (organizational collections)
  │      └─── Projects (many-to-many)
  │
  └─── Labels (flexible tags)
         └─── Projects (many-to-many)
```

---

### Critical Relationships

**1. Project → Client (Many-to-One, REQUIRED)**
- Every project MUST have exactly one client
- A client can have many projects
- Cannot delete client if projects exist (or cascade? CLARIFY)

**2. Project → Phases (One-to-Many, OPTIONAL)**
- A project can have 0, 1, or many phases
- Each phase belongs to exactly one project
- If phases exist, project cannot have recurring estimate (XOR)

**3. Project → Recurring Estimate (One-to-One, OPTIONAL)**
- A project can have 0 or 1 recurring estimate
- If recurring exists, project cannot have phases (XOR)

**4. Project → Calendar Events (One-to-Many, OPTIONAL)**
- A project can have many events
- Events can exist without a project (personal time)
- Only events with project_id count toward project time

**5. Project → Groups (Many-to-Many, OPTIONAL)**
- A project can be in 0, 1, or many groups
- A group can contain many projects
- Junction table: `project_groups`

**6. Project → Labels (Many-to-Many, OPTIONAL)**
- A project can have 0, 1, or many labels
- A label can be on many projects
- Junction table: `project_labels`

**7. Calendar Event → Project (Many-to-One, OPTIONAL)**
- An event can optionally link to a project
- Events without projects don't affect any project's time

**8. User → Everything (One-to-Many, REQUIRED)**
- All entities belong to a user (except User itself)
- Complete data isolation per user (RLS)

---

## ⚖️ PART 4: CORE BUSINESS RULES

What you can and can't do.

---

### Rule 1: Client Required for Projects
**Plain English:**
Every project must belong to a client. You can't create a project without selecting or creating a client.

**Why:**
Projects don't exist in a vacuum - they're always for someone (even if it's yourself).

**What happens:**
- Creating project without client → Error
- Deleting client with projects → [CLARIFY: prevent or cascade?]

---

### Rule 2: Phase-Recurring Mutual Exclusivity
**Plain English:**
A project can split time into phases OR use a recurring estimate, but never both at the same time.

**Why:**
These are two different ways of planning the same thing - they would conflict.

**What happens:**
- If project has phases → Cannot add recurring estimate (error/warning)
- If project has recurring → Cannot add phases (error/warning)
- Can delete all phases to add recurring (switching modes)
- Can delete recurring to add phases (switching modes)

**Edge Cases:**
- Empty phases array + no recurring = Implicit single milestone (auto-estimate to end date)
- Delete last phase → Can now add recurring
- Delete recurring → Can now add phases

---

### Rule 3: Project End Date = Last Phase End Date
**Plain English:**
When a project has phases, the project's end date is automatically the same as the last phase's end date. They stay synchronized.

**Why:**
The last phase represents when work actually finishes, so the project ends then.

**What happens:**
- Change last phase end date → Project end date updates automatically
- Add phase after current last → Project end date extends
- User cannot manually set project end date different from last phase

**Edge Cases:**
- What about recurring estimates? [CLARIFY: end date independent? or controls recurring?]
- What if phases are deleted? [CLARIFY: revert to original end date? or keep current?]

---

### Rule 4: Phase Budget Allocation
**Plain English:**
The hours you allocate to phases [CLARIFY: must/should/can] add up to the project's total estimated hours.

**Current Rules (NEED CLARIFICATION):**
- Option A: Sum MUST equal 100% (strict budget enforcement)
- Option B: Sum CAN be less (allows unallocated buffer)
- Option C: Sum CAN exceed (allows overbudget planning)

**What happens:**
- If total < 100%: [CLARIFY: error? warning? allowed?]
- If total > 100%: [CLARIFY: error? warning? allowed?]
- If total = 100%: Ideal state

**Edge Cases:**
- Change project hours after creating phases: [CLARIFY: auto-adjust phases? or leave as-is?]
- Partial allocation (e.g., 80 of 100 hours allocated): [CLARIFY: valid? shown as warning?]

---

### Rule 5: Phase Continuity
**Plain English:**
Phases [CLARIFY: must be continuous? or can have gaps?]

**Options (NEED CLARIFICATION):**
- Option A: Phases MUST be continuous (end of Phase 1 = start of Phase 2 - 1 day)
- Option B: Gaps are ALLOWED between phases
- Option C: Gaps are allowed but warned about

**What happens:**
- If gap exists: [CLARIFY: error? warning? allowed?]
- If phases overlap: ERROR (definitely not allowed)

**Why this matters:**
- Continuous: Every day assigned to a phase (clear allocation)
- Gaps allowed: Flexibility for breaks, uncertainty

---

### Rule 6: Phase Overlap Forbidden
**Plain English:**
No two phases can have the same date. Each date belongs to exactly zero or one phase.

**Why:**
Can't allocate time to two phases on the same day - the hours would conflict.

**What happens:**
- Try to create overlapping phases → Error with clear message
- Resize phase to overlap another → Error (or snap to boundary? CLARIFY)

**Validation:**
```
For each pair of phases:
  IF phase1.endDate >= phase2.startDate 
  AND phase1.startDate <= phase2.endDate:
    ERROR: Phases overlap
```

---

### Rule 7: No Estimated Time in the Past
**Plain English:**
If a project has estimated hours, auto-estimates only appear on today and future working days, not past dates.

**Why:**
Estimated time represents work you WILL do, not work you DID. Past work is tracked via completed events.

**What happens:**
- Auto-estimates only calculate for today + future
- Past days show only completed events (if any)
- If project entirely in past with estimated hours: [CLARIFY: error? warning? allowed?]

**Edge Cases:**
- Create project with past dates and estimated hours: [CLARIFY: block? auto-adjust dates? allow?]
- Phase partially in past: Only future portion gets auto-estimates

---

### Rule 8: Event-Project Attribution
**Plain English:**
An event only counts toward a project's time if explicitly linked to that project. Habits and tasks NEVER count, even if linked.

**Why:**
Not all calendar events are project work (personal time, habits, admin tasks).

**What happens:**
- Event without project → Doesn't affect any project
- Event with project → Counts toward that project only
- Habit event (even with project) → Never counts
- Task event (even with project) → Never counts

**Types That Count:**
- ✅ Normal events with project
- ✅ Completed events with project
- ✅ Tracked time with project

**Types That DON'T Count:**
- ❌ Events without project
- ❌ Habits (category = 'habit')
- ❌ Tasks (category = 'task')

---

### Rule 9: Timeline Day Estimates (See Part 2 - Time Concepts)

For each day on the timeline, show ONE of:
1. Planned time (if future events exist)
2. Completed time (if past/completed events exist)
3. Auto-estimate (if no events exist and is working day)
4. Nothing (if past with no events, or holiday, or non-working day)

**Covered in detail in Part 2.**

---

### Rule 10: Work Hours Override
**Plain English:**
Holidays override work hours. On a holiday, work hours don't apply.

**What happens:**
- Normal day: Use work hours for capacity/auto-estimates
- Holiday: No work capacity, no auto-estimates
- User CAN still create manual events on holidays (exception work)

**Examples:**
- Monday (work day): 8 hours capacity, auto-estimates appear
- Dec 25 (holiday): 0 hours capacity, no auto-estimates
- Dec 25 with manual event: Event shows, but no auto-estimate

---

## 📊 PART 5: KEY CALCULATIONS

**Note:** This lists core business calculations. Implementation details and UI calculations are handled by developers.

---

### Project Calculations

**Project Duration (Days)**
```
Duration = (End Date - Start Date) + 1

Example: Jan 1 to Jan 5 = 5 days
```

**Project Working Days**
```
Working Days = Count of days between Start and End where:
  - Day is in work hours schedule
  - Day is not a holiday

Example: Jan 1-7 (7 days total)
  - Excludes Sat, Sun (2 days)
  - Excludes Jan 1 holiday (1 day)
  = 4 working days
```

**Project Budget Utilization**
```
Total Allocated = Sum of all phase.timeAllocationHours
Utilization % = (Total Allocated / Project Estimated Hours) × 100

Example: 80 hours allocated / 100 hours project = 80% utilization
```

**Remaining Budget**
```
Remaining = Project Estimated Hours - Total Allocated

Example: 100 hours - 80 hours = 20 hours remaining
```

---

### Time Tracking Calculations

**Completed Hours Total**
```
Completed Hours = Sum of duration for all events where:
  - Event is linked to this project
  - Event.completed = true OR Event.type = 'tracked' OR Event.type = 'completed'

Example: 3 completed events (6h, 4h, 2h) = 12 hours completed
```

**Remaining Project Hours**
```
Remaining = Project Estimated Hours - Completed Hours

Example: 100 hours - 12 hours = 88 hours remaining
```

**Progress Percentage**
```
Progress % = (Completed Hours / Project Estimated Hours) × 100

Example: 12 hours / 100 hours = 12% complete
```

---

### Timeline Calculations

**Daily Auto-Estimate (Phase-Based)**
```
For each day in phase:
  IF day has events for this project:
    Auto-Estimate = 0 (blocked by events)
  ELSE IF day is in the past:
    Auto-Estimate = 0 (no estimates in past)
  ELSE IF day is not a working day OR is a holiday:
    Auto-Estimate = 0 (no work on non-working days)
  ELSE:
    Working Days in Phase = count of eligible days in this phase
    Daily Auto-Estimate = Phase Time Allocation / Working Days in Phase

Example: 40-hour phase over 10 working days = 4 hours/day
```

**Daily Auto-Estimate (Recurring)**
```
For each day until project end:
  IF day matches recurring pattern (e.g., weekday for daily):
    IF day has events for this project:
      Auto-Estimate = 0 (blocked by events)
    ELSE:
      Auto-Estimate = Hours per Occurrence
  ELSE:
    Auto-Estimate = 0 (doesn't match pattern)

Example: 2 hours/day recurring, weekdays only
  - Monday (no event): 2 hours
  - Tuesday (has event): 0 hours (blocked)
  - Saturday: 0 hours (doesn't match weekday pattern)
```

**Daily Auto-Estimate (No Phases/Recurring - Implicit)**
```
Remaining Hours = Project Estimated Hours - Completed Hours
Future Working Days = count(working days from today to project end, excluding holidays)
Daily Auto-Estimate = Remaining Hours / Future Working Days

Example: 88 hours remaining / 22 working days = 4 hours/day
```

---

### Capacity Calculations

**Available Hours Per Day**
```
Available Hours = Total Work Hours - Sum(Event Durations on that day)

Example: 8 hours work - 3 hours of events = 5 hours available
```

**Overbooked Detection**
```
IF Sum(Event Durations) > Total Work Hours:
  Day is overbooked

Example: 10 hours of events scheduled on 8-hour work day = Overbooked
```

**Capacity Utilization**
```
Utilization % = (Scheduled Hours / Available Hours) × 100

Example: 6 hours scheduled / 8 hours available = 75% utilization
```

---

## 🚶 PART 6: USER WORKFLOWS

How people actually use the app.

---

### Workflow 1: Create Project with Phases

**Steps:**
1. User clicks "New Project"
2. Enters: Name, Client, Start/End dates, Estimated hours
3. Chooses "Split into phases"
4. Defines phases:
   - Phase 1: "Research" (Jan 1-15, 40 hours)
   - Phase 2: "Design" (Jan 16-31, 40 hours)
   - Phase 3: "Development" (Feb 1-28, 40 hours)
5. System validates:
   - No overlaps ✓
   - Phases continuous or gaps allowed (based on Rule 5)
   - Budget allocation valid (based on Rule 4)
   - Last phase end = project end (auto-syncs)
6. Saves project + phases
7. Timeline shows auto-estimates distributed across phases

**Result:**
- Project created
- 3 phases exist
- No recurring estimate
- Timeline shows estimated work in each phase

---

### Workflow 2: Create Project with Recurring Estimate

**Steps:**
1. User clicks "New Project"
2. Enters: Name, Client, Start/End dates, Estimated hours
3. Chooses "Recurring estimate"
4. Defines pattern:
   - Daily, 2 hours per day, weekdays only
5. System validates:
   - No phases exist ✓
   - Pattern is valid ✓
6. Saves project + recurring estimate
7. Timeline shows 2-hour blocks on every weekday until end date

**Result:**
- Project created
- Recurring estimate exists
- No phases
- Timeline shows regular pattern

---

### Workflow 3: Add Planned Time

**Steps:**
1. User views timeline
2. Clicks on a day (or drags on calendar)
3. Creates event:
   - Title: "Website coding"
   - Project: Website Redesign
   - Time: 9am - 5pm (8 hours)
   - Completed: false
4. Saves event
5. Timeline updates:
   - That day shows 8 hours planned time (light, dashed)
   - Auto-estimate for that day disappears
   - Future days' auto-estimates recalculate (redistributed)

**Result:**
- Planned time added
- Auto-estimate blocked for that day
- Remaining auto-estimates adjusted

---

### Workflow 4: Track Completed Time

**Steps:**
1. User did work on Monday
2. Two options:
   - Option A: Mark existing planned event as complete
   - Option B: Create new completed event / use time tracker
3. Event becomes "completed time"
4. Timeline shows:
   - Monday: 6 hours completed time (dark, solid)
5. Calculations update:
   - Completed hours increase
   - Remaining hours decrease
   - Future auto-estimates recalculate (lower now)

**Result:**
- Progress tracked
- Timeline updated
- Auto-estimates adjusted for remaining work

---

### Workflow 5: Switch from Phases to Recurring

**Steps:**
1. User has project with 3 phases
2. Decides recurring estimate makes more sense
3. Deletes all 3 phases
4. System allows creation of recurring estimate (mutual exclusivity cleared)
5. User adds recurring estimate
6. Timeline switches from phase-based to recurring pattern

**Validation:**
- Cannot add recurring while phases exist (blocked)
- Must delete all phases first
- Then can add recurring

---

### Workflow 6: Update Phase Dates

**Steps:**
1. User views timeline
2. Drags phase end date to extend it
3. System validates:
   - New date doesn't overlap next phase ✓
   - Maintains continuity (if required by Rule 5)
   - If this is last phase, project end date updates too
4. Saves new dates
5. Timeline recalculates auto-estimates for that phase

**Result:**
- Phase dates updated
- Project end date synced (if last phase)
- Auto-estimates redistributed

---

## ✅ PART 7: VALIDATION RULES SUMMARY

Complete list of validations enforced by the system.

---

### Project Validations

- [ ] Must have name (non-empty string)
- [ ] Must have client (required foreign key)
- [ ] Must have start date
- [ ] Must have end date
- [ ] End date >= start date
- [ ] Must have estimated hours > 0 (if tracking time)
- [ ] If has estimated hours AND project entirely in past: [CLARIFY: block? warn? allow?]
- [ ] If has phases: end date must equal last phase end date (auto-sync)
- [ ] Cannot have both phases AND recurring estimate (mutual exclusivity)

---

### Phase Validations

- [ ] Must have start date
- [ ] Must have end date  
- [ ] End date >= start date
- [ ] Minimum duration = [CLARIFY: 1 day? 0 days allowed?]
- [ ] Must not overlap with other phases (strict enforcement)
- [ ] Must maintain continuity with adjacent phases [CLARIFY: required? or optional?]
- [ ] Must have time allocation > 0
- [ ] Time allocation must not exceed remaining project budget [CLARIFY: hard limit? or warning?]

---

### Phase Collection Validations (All Phases Together)

- [ ] Sum of allocations [CLARIFY: must equal? can be less? can exceed?] project estimated hours
- [ ] No overlaps between any phases
- [ ] Continuous coverage [CLARIFY: required? or gaps allowed?] from project start to end
- [ ] Last phase end date = project end date (auto-synced, not validated)

---

### Recurring Estimate Validations

- [ ] Cannot exist if project has phases (mutual exclusivity)
- [ ] Must have valid pattern (daily/weekly/monthly)
- [ ] Must have hours per occurrence > 0
- [ ] [CLARIFY: any max hours per occurrence limit?]

---

### Calendar Event Validations

- [ ] Must have start time
- [ ] Must have end time
- [ ] End time >= start time (can be same for 0-duration events? CLARIFY)
- [ ] If linked to project: project must exist
- [ ] If category = 'habit': never counts toward project (even if project_id set)
- [ ] If category = 'task': never counts toward project (even if project_id set)

---

### Work Hour Validations

- [ ] Must have start time
- [ ] Must have end time
- [ ] End time > start time (must have positive duration)
- [ ] Must have at least one day of week selected
- [ ] [CLARIFY: can work hours overlap? or must be distinct blocks?]

---

### Holiday Validations

- [ ] Must have date
- [ ] [CLARIFY: can have duplicate holidays on same date? or enforce unique?]
- [ ] If recurring: applies every year on same date

---

## 🤔 PART 8: EDGE CASES & DECISIONS NEEDED

Questions that need definitive answers to complete the logic.

---

### Edge Case 1: Project Entirely in Past with Estimated Hours

**Scenario:** User creates project (Jan 1-15) today (Dec 25), with 40 estimated hours.

**Question:** What should happen?

**Options:**
- A) Block creation (error: "Cannot create project in past with estimated hours")
- B) Allow creation but show no auto-estimates (just allow completed time tracking)
- C) Auto-adjust start date to today
- D) Allow creation and show retroactive auto-estimates (unusual)

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option B (allow for historical tracking, but no estimates)

---

### Edge Case 2: Phase Gaps

**Scenario:** Phase 1 (Jan 1-10), Phase 2 (Jan 15-20). Gap: Jan 11-14 (4 days).

**Question:** Is this allowed?

**Options:**
- A) No - phases must be continuous (error on gap)
- B) Yes - gaps are fine (flexible planning)
- C) Allowed but warned (shows warning, doesn't block)

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option B or C (flexibility useful for planning uncertainty)

---

### Edge Case 3: Phase Budget Under-Allocation

**Scenario:** Project has 100 hours. User creates 3 phases totaling 80 hours. 20 hours unallocated.

**Question:** Is this valid?

**Options:**
- A) Error - must allocate all hours (strict budget)
- B) Warning - suggest allocating remaining hours
- C) OK - unallocated hours are buffer (no message)

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option B (warn but allow - buffer is sometimes intentional)

---

### Edge Case 4: Phase Budget Over-Allocation

**Scenario:** Project has 100 hours. User creates 3 phases totaling 120 hours.

**Question:** Is this valid?

**Options:**
- A) Error - block save (strict enforcement)
- B) Warning - allow save but flag overbudget
- C) OK - allow overbudget planning (flexible)

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option A or B (should at least warn - overbudget is important)

---

### Edge Case 5: Recurring Estimate + Project End Date

**Scenario:** Project with recurring estimate (2 hrs/day). End date is Dec 31.

**Question:** How does end date work?

**Options:**
- A) Recurring stops on end date (end date controls duration)
- B) Recurring continues indefinitely, end date is just for display
- C) End date determines total hours (2hrs/day until end = calculated total)

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option A (end date controls duration - most intuitive)

---

### Edge Case 6: Changing Project Hours After Creating Phases

**Scenario:** Project has 100 hours, 4 phases of 25 hours each (perfectly allocated). User changes project to 120 hours.

**Question:** What happens to phase allocations?

**Options:**
- A) Phases stay at 25 hours each (now under-allocated by 20 hours)
- B) Phases auto-adjust proportionally (now 30 hours each)
- C) User must manually update phases (show warning)

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option A or C (auto-adjustment could be surprising)

---

### Edge Case 7: Zero-Duration Phase

**Scenario:** User tries to create phase where start date = end date (1 day "phase").

**Question:** Is this allowed?

**Options:**
- A) No - minimum 2 days (start != end)
- B) Yes - 1-day phases are valid (single day of work)

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option B (1-day phases are conceptually valid)

---

### Edge Case 8: Deleting Last Phase

**Scenario:** Project has 1 phase. User deletes it.

**Question:** What happens to project end date?

**Options:**
- A) Project end date reverts to original value (before phases were added)
- B) Project end date stays at current value (phase end date persists)
- C) Prompt user to set new end date

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option A (revert to original - phases are gone)

---

### Edge Case 9: Events on Holidays

**Scenario:** User creates manual event on a holiday.

**Question:** Is this allowed? Does it count?

**Options:**
- A) Block creation (can't work on holidays)
- B) Allow creation, counts as overtime/exception work
- C) Allow creation but doesn't count toward project

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option B (allow exceptions - sometimes you work holidays)

---

### Edge Case 10: Multiple Work Hour Blocks Same Day

**Scenario:** User has work hours 9am-12pm and 2pm-5pm (split day).

**Question:** How does this work?

**Options:**
- A) Not allowed - one continuous block per day
- B) Allowed - auto-estimates distribute across both blocks
- C) Allowed - capacity is sum of both blocks

**Current State:** UNKNOWN - NEEDS DECISION  
**Recommended:** Option B or C (flexibility for split schedules)

---

## 📝 PART 9: TERMINOLOGY REFERENCE

### Current Terms (Use These)
- **Phase** - Time period within project with budget allocation
- **Recurring Estimate** - Regular time allocation pattern
- **Client** - Organization/person project is for
- **Group** - Organizational collection (many-to-many with projects)
- **Label** - Flexible tag (many-to-many with projects)
- **Estimated Time** - Project's total time budget
- **Auto-Estimated Time** - System-calculated time distribution
- **Planned Time** - User-scheduled future work
- **Completed Time** - Work actually done
- **Work Hours** - User's availability schedule
- **Holiday** - Date with no normal work capacity

### Deprecated Terms (Don't Use)
- ~~Milestone~~ → Use "Phase" instead
- ~~Row~~ → Removed (use "Group" for organizing)
- ~~Number of Milestones~~ → Use "Phase count" or describe phases

### Terms That May Cause Confusion
- **Event** - Can mean calendar event OR occurrence of recurring pattern (clarify in context)
- **Estimate** - Can mean project total OR daily auto-estimate (use full term: "Estimated Time" vs "Auto-Estimated Time")
- **Group** - Don't confuse with "group set" concept (we're using simple groups, not sets)

---

## 🎯 PART 10: DOCUMENT COMPLETION CHECKLIST

**Before considering this document "complete," answer all [CLARIFY] questions:**

### Critical Decisions Needed:

**Phase Rules:**
- [ ] Must phases be continuous, or can gaps exist? (Rule 5)
- [ ] Must phase allocations equal 100% of project hours? (Rule 4)
- [ ] What's minimum phase duration? (1 day? 0 days?)
- [ ] What happens when changing project hours after phases created?

**End Date Rules:**
- [ ] How does project end date work with recurring estimates?
- [ ] What happens to end date when last phase deleted?

**Edge Cases:**
- [ ] Can create projects entirely in past with estimated hours?
- [ ] What happens with phase budget under/over allocation?
- [ ] Are events allowed on holidays?
- [ ] Can work hours have multiple blocks per day?

**Deletion Behavior:**
- [ ] Delete client with projects: prevent or cascade?
- [ ] Delete group: remove from projects or prevent?
- [ ] Delete last phase: what happens to project end date?

### Sections to Expand (As Needed):

- [ ] Add more user workflows (based on actual user research)
- [ ] Add more edge cases (discover through testing)
- [ ] Refine calculations (add any missing formulas)
- [ ] Update validation rules (based on decisions above)

---

## 📚 PART 11: HOW TO USE THIS DOCUMENT

### For Product Managers:
1. Read "Core Entities" to understand structure
2. Read "Time Concepts" to understand unique value
3. Read "Business Rules" to understand constraints
4. Answer all [CLARIFY] questions to finalize logic
5. Review with stakeholders for sign-off

### For Developers:
1. Read entire document for context
2. Reference "Validation Rules" when implementing
3. Reference "Calculations" for formulas
4. Check "Edge Cases" for tricky scenarios
5. **This defines WHAT (logic), not HOW (code)**

### For QA/Testers:
1. Read "Business Rules" for what to test
2. Reference "Validation Rules" for test cases
3. Check "Edge Cases" for edge case testing
4. Use "User Workflows" for scenario testing

### For Future Team Members:
1. Read "What Makes This App Unique" first
2. Read "Core Entities" and "Time Concepts"
3. Skim "Business Rules" to understand constraints
4. Refer back as needed during development

---

## 📊 DOCUMENT MAINTENANCE

**When to Update:**
- Adding new entities or features
- Changing business rules or constraints
- Discovering edge cases in production
- Finalizing [CLARIFY] decisions
- After stakeholder reviews

**Review Frequency:**
- After every major feature addition
- When business requirements change
- Before starting new development cycles
- When confusion arises about "how it should work"

**Version Control:**
- Update version number at top when making changes
- Add to change log (below)
- Get stakeholder approval for rule changes

---

## 📅 CHANGE LOG

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-12-25 | 2.0 | Complete restructure: separated entities from time concepts, added holidays, clarified time types, added edge cases | [Your Name] |
| | | | |
| | | | |

---

## ✅ DOCUMENT STATUS

**Current State:** Foundation complete, decisions needed

**What's Done:**
- ✅ Core entities defined
- ✅ Time concepts explained (unique value)
- ✅ Entity relationships mapped
- ✅ Business rules documented
- ✅ Key calculations listed
- ✅ User workflows outlined
- ✅ Edge cases identified

**What's Needed:**
- ⏳ Answer all [CLARIFY] questions (critical decisions)
- ⏳ Stakeholder review and approval
- ⏳ Developer technical review
- ⏳ Add any missing workflows (as discovered)
- ⏳ Add any missing edge cases (as discovered)

**When This is "Done":**
1. All [CLARIFY] sections have decisions
2. Stakeholders agree this reflects how app should work
3. Developers understand what to build
4. QA understands what to test

**This document is the source of truth for business logic.**

---

**END OF APP LOGIC SPECIFICATION v2.0**

Next step: Fill in all [CLARIFY] decisions, then move to implementation (Domain Rules → Code).
