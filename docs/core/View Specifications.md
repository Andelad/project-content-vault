# View Specifications

**Last Updated:** December 29, 2025  
**Purpose:** Document UI-specific display rules and presentation constraints for each view

> **Note:** This document covers **view-specific display rules**. For universal domain calculations, see [Business Logic.md](./Business%20Logic.md). For domain concepts, see [App Logic.md](./App%20Logic.md).

---

## Document Scope

**What This Document Contains:**
- How each view displays domain data differently
- View-specific UI constraints and rules
- Display-specific business logic (not universal domain logic)
- Presentation decisions unique to each view

**What This Document Does NOT Contain:**
- Universal domain calculations (see Business Logic.md)
- Domain entity definitions (see App Logic.md)
- Implementation details (colors, pixels, CSS)
- Component structure (see code documentation)

---

## Quick Reference

| View | Purpose | Key Display Constraint |
|------|---------|------------------------|
| **Timeline** | Project-centric horizontal bars over time | Mutual exclusivity: one time type per day per project |
| **Planner** | Day-centric calendar grid with events | Can show multiple items per day cell |
| **Insights** | Analytics dashboard with charts | Aggregated data presentation |
| **Overview** | Master list/CRUD for projects/clients/holidays | Tabular data with filtering |
| **Settings/Profile** | Configuration forms | Standard forms (no special display rules) |

---

## Main Views

### 1. Timeline View

**Purpose:** Project-centric view showing work distribution over time as horizontal bars

**Key Display Constraint:** **Mutual Exclusivity per Day**
- For any given day and project, show **only ONE** time type
- Events (planned or completed) take priority over auto-estimates
- This is a **visual constraint**, not a domain rule (data coexists in domain)

**Display Priority:**
1. Completed events (highest priority - work actually done)
2. Planned events (medium priority - scheduled future work)
3. Auto-estimated time (lowest priority - calculated distribution)

**Visual Styling:**

| Time Type | Visual Treatment | Purpose |
|-----------|------------------|---------|
| **Auto-Estimated Time** | Lightest color, no border, no specific times | "Daily hours needed to finish on time" |
| **Planned Time** | Light color, dashed border, specific times shown | "Scheduled future work" |
| **Completed Time** | Dark color, solid border, specific times shown | "Work already done" |

**Layout Rules:**
- Bars positioned horizontally by date
- Projects arranged in rows (auto-layout by group)
- One project per row
- Bars cannot overlap (time mutual exclusivity)

**Why This Constraint Exists:**
Timeline bars represent time spans. Multiple overlapping bars would create visual confusion:
- "Which time counts?"
- "Are these additive or alternatives?"
- "Is the project overbooked?"

The mutual exclusivity makes it clear: **events are real commitments, auto-estimates are suggestions**

**Data Relationships:**
- Reads: Projects, phases, events, holidays, work hours
- Calculates: Auto-estimates per day (Business Logic Rule 9)
- Displays: Horizontal bars with mutual exclusivity

**Components:**
- Main view: `TimelineView.tsx`
- Time bars: `TimelineCard.tsx`, `TimelineBar.tsx`
- Availability display: `AvailabilityCard.tsx` (shared)

---

### 2. Planner View (Calendar)

**Purpose:** Day-centric calendar grid for planning and tracking events

**Alternative Name:** "Planner" (not "Calendar") because it focuses on **planned** and **completed** time

**Key Display Difference from Timeline:** **Can show multiple items per day**
- Calendar grid cells can contain multiple events
- Auto-estimates can appear alongside events (no mutual exclusivity)
- Events can stack or be listed within a day cell

**Display Modes:**
- Week View: 7-day grid with time slots
- Day View: Single day with hourly breakdown

**Event Types Shown:**
1. **Project Events** (planned & completed)
   - Linked to specific projects
   - Show project color
   - Display start/end times

2. **Work Hours** (work slots)
   - Availability blocks
   - Show as background/context

3. **Habits** (recurring)
   - Recurring activities
   - Special visual treatment (icon-based)

4. **Tasks** (to-dos)
   - One-off tasks
   - Can be scheduled or unscheduled

5. **Holidays**
   - Days off
   - Block out availability

**Layer Visibility:**
Users can toggle visibility of different event types:
- Projects ON/OFF
- Habits ON/OFF
- Tasks ON/OFF
- Work Hours ON/OFF
- Holidays ON/OFF

**Interaction Rules:**
- Click to create new event
- Drag to reschedule event
- Resize to adjust duration
- Double-click to edit

**Why Different from Timeline:**
- Timeline = project-centric (rows are projects)
- Planner = time-centric (cells are days)
- Timeline shows what projects need (auto-estimates)
- Planner shows what's scheduled (events)

**Data Relationships:**
- Reads: Events, habits, tasks, work hours, holidays, projects
- Does NOT calculate: Auto-estimates (not primary focus)
- Displays: Calendar grid with multiple items per cell

**Components:**
- Main view: `PlannerView.tsx`
- Uses: FullCalendar library
- Event rendering: `WorkHourEventContent.tsx`, `HabitEventContent.tsx`, etc.

---

### 3. Insights View

**Purpose:** Analytics dashboard with charts and metrics

**Display Type:** Aggregated data visualization (not granular event lists)

**Key Cards:**

**3.1 Time Distribution Card**
- **Shows:** Pie/bar chart of time spent by project or group
- **Calculation:** Aggregates completed event hours
- **Time Period:** User-selectable (week, month, all time)
- **Display Rule:** Groups small slices into "Other" category

**3.2 Availability Used Card**
- **Shows:** Percentage of capacity used vs available
- **Calculation:** (Planned + Completed hours) / Total capacity
- **Visual:** Progress bar or gauge
- **Display Rule:** Highlights overcommitment in red

**3.3 Average Day Heatmap Card**
- **Shows:** Hourly breakdown of typical workday
- **Calculation:** Averages event hours by time of day
- **Visual:** Heatmap grid (hours × days)
- **Display Rule:** Color intensity shows hour density

**3.4 Future Commitments Card**
- **Shows:** Upcoming planned work by project
- **Calculation:** Sum of planned event hours (future only)
- **Visual:** List or bar chart
- **Display Rule:** Sorted by total hours descending

**Why Different from Timeline/Planner:**
- Insights = **aggregated analytics** (summaries, trends)
- Timeline = **project distribution** (what needs doing)
- Planner = **event scheduling** (what's planned)

**Data Relationships:**
- Reads: Events, projects, groups, settings
- Calculates: Aggregations, averages, percentages
- Displays: Charts and summary cards

**Components:**
- Main view: `InsightsView.tsx`
- Cards: `TimeDistributionCard.tsx`, `AvailabilityUsedCard.tsx`, etc.

---

### 4. Overview View

**Purpose:** Master list and CRUD interface for projects, clients, and holidays

**Display Type:** Tabular data with filtering and organization

**Tabs:**

**4.1 Projects Tab**
- **Shows:** All projects in list/card format
- **Filtering:** By status (active, future, past, all)
- **Organization:** By group, tag, or client
- **Display:** Card grid or list view
- **Actions:** Create, edit, archive, delete projects

**4.2 Clients Tab**
- **Shows:** All clients with associated projects
- **Filtering:** Active vs archived clients
- **Display:** List with expand/collapse
- **Shows:** Contact info, notes, project count
- **Actions:** Create, edit, archive, delete clients

**4.3 Holidays Tab**
- **Shows:** All holidays (past and future)
- **Filtering:** By date range or year
- **Display:** List sorted by date
- **Actions:** Create, edit, delete holidays

**Why Different from Other Views:**
- Overview = **management interface** (CRUD operations)
- Timeline/Planner = **working views** (planning and tracking)
- Insights = **analytics** (read-only summaries)

**Data Relationships:**
- Reads: Projects, clients, holidays, groups, labels
- Writes: All CRUD operations
- Displays: Filterable lists and cards

**Components:**
- Main view: `OverviewView.tsx`
- Tabs: `ProjectsTab.tsx`, `ClientsTab.tsx`, `HolidaysTab.tsx`

---

### 5. Settings & Profile Views

**Purpose:** Configuration and user preferences

**Display Type:** Standard forms (no special display rules)

**Settings Categories:**
- Work hours (weekly capacity)
- Default project settings
- Calendar preferences
- Notification settings

**Profile:**
- User information
- Account management

**Note:** These are standard configuration UIs with no special display logic to document.

---

## Key Modals & Components

### Project Modal

**Purpose:** Create/edit projects with phases and settings

**Tabs:**

**Details Tab:**
- Basic project info (name, client, dates, etc.)
- Standard form fields

**Progress Tab:**
- **Shows:** Project completion metrics
- **Calculates:** % complete = (Completed Hours / Estimated Hours) × 100
- **Display Rule:** Shows phase-by-phase breakdown
- **Visual:** Progress bars for overall and per-phase completion

**Phases Tab:**
- **Shows:** List of project phases with time allocations
- **Display Rule:** Phases are ordered sequentially
- **Interaction:** Create, edit, reorder, delete phases
- **Visual:** List with drag handles for reordering

**Display-Specific Rules:**
- Progress calculations use completed events (domain data)
- Phase ordering affects timeline display
- Date validation shows inline errors

---

### Event Modal

**Purpose:** Create/edit calendar events

**Display-Specific Rules:**

**Recurring Events:**
- **Shows:** Recurrence pattern UI (daily, weekly, monthly)
- **Display:** "Edit Series" vs "Edit Instance" choice
- **Validation:** Shows recurrence end date requirement

**Time Tracking Integration:**
- **Shows:** "Start Tracking" button for project events
- **Display:** Running tracker shows elapsed time
- **Auto-completion:** Tracking stop creates completed event

**Project Linking:**
- **Shows:** Project dropdown (filtered to active projects)
- **Display:** Shows project color indicator
- **Validation:** Ensures valid project link

---

### Availability Card (Shared Component)

**Purpose:** Shows capacity vs commitment across days/weeks

**Display Modes:**

**Timeline Context:**
- Shows availability bars aligned with timeline columns
- Fixed column widths (52px for days, 153px for weeks)
- Bars show overcommitment in red

**Planner Context:**
- Shows availability below calendar header
- Flexible column widths (matches calendar cells)
- Interactive hover shows details

**Tabs:**

**Availability Graph:**
- **Shows:** Available hours per day/week
- **Calculation:** Capacity - (Planned + Auto-estimated)
- **Visual:** Bar chart with red for negative (overcommitted)

**Time Spent:**
- **Shows:** Completed hours per day/week
- **Calculation:** Sum of completed event hours
- **Visual:** Bar chart with project color breakdown

**Display Rules:**
- Negative availability = Red bars (overcommitted)
- Positive availability = Green bars (time available)
- Zero availability = Gray bars (fully booked)
- Hover shows detailed breakdown by project

**Why This Component is Special:**
- Appears in **both** Timeline and Planner views
- Adapts layout based on context
- Shows calculated availability (not stored data)
- Highlights overcommitment (capacity warning)

---

## Cross-View Display Rules

### Time Type Display Summary

| Time Type | Timeline | Planner | Insights | Overview |
|-----------|----------|---------|----------|----------|
| **Auto-Estimated** | ✅ Shows (if no events) | ⚠️ Optional | ❌ Not shown | ❌ Not shown |
| **Planned Events** | ✅ Shows (priority) | ✅ Shows | ✅ In future metrics | ✅ Shows in lists |
| **Completed Events** | ✅ Shows (priority) | ✅ Shows | ✅ In analytics | ✅ Shows in lists |

### Mutual Exclusivity

| View | Allows Overlap? | Rationale |
|------|----------------|-----------|
| **Timeline** | ❌ No (one per day) | Horizontal bars can't overlap visually |
| **Planner** | ✅ Yes (multiple per cell) | Calendar cells can stack items |
| **Insights** | N/A (aggregated) | Shows totals, not individual items |
| **Overview** | N/A (list view) | Tabular data, no time visualization |

---

## Relationship to Domain Logic

**Domain Truth** (from Business Logic.md):
- Auto-estimated, planned, and completed time **all coexist**
- Calculations run **regardless of view**
- Data is always available to all views

**View Constraint** (from this document):
- **Timeline chooses** to show only one type per day (UI decision)
- **Planner chooses** to show multiple types per day (UI decision)
- **Insights chooses** to aggregate types (UI decision)

**Example:**
```
Domain State (Jan 5):
  ✅ Auto-estimate: 5.5 hours
  ✅ Planned event: 6 hours (9am-3pm)
  ✅ Completed event: 0 hours
  
Timeline Display (Jan 5):
  Shows: Planned event only (6 hours)
  Hides: Auto-estimate (mutual exclusivity)
  
Planner Display (Jan 5):
  Shows: Planned event (6 hours)
  Can also show: Auto-estimate in different visual style
  
Insights Display:
  Time Distribution: Includes both in different metrics
  Future Commitments: Shows planned 6 hours
```

**Key Point:** The domain data doesn't change. Only the **display decision** changes per view.

---

## Navigation & Consistency

**Shared Navigation:**
- All views use same sidebar
- Current view highlighted
- Quick switcher available

**Shared Components:**
- Availability Card (Timeline + Planner)
- Help Modal (all views)
- Date picker (consistent across views)

**Consistent Patterns:**
- Project colors used everywhere
- Date formats standardized
- Time formatting consistent (24h vs 12h based on settings)

---

## Summary

**View Specifications** document **how** domain data is presented in each view, not **what** the data is or **how** it's calculated.

- **App Logic** = What exists (entities, concepts)
- **Business Logic** = How it's calculated (formulas, rules)
- **View Specifications** = How it's displayed (presentation, constraints)

Each view makes different presentation choices with the same underlying domain data.
