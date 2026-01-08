# Orchestrator Reorganization Analysis

**Created:** January 7, 2026  
**Purpose:** Analyze orchestrator organization and propose cleaner structure

---

## 🎯 CURRENT STATE ANALYSIS

### Current Orchestrators (14 files)

```
Entity-Based (8):
├── CalendarEventOrchestrator.ts    - Calendar event CRUD operations
├── ClientOrchestrator.ts           - Client entity operations
├── GroupOrchestrator.ts            - Group entity operations
├── HolidayOrchestrator.ts          - Holiday entity operations
├── PhaseOrchestrator.ts            - Phase/milestone operations
├── ProjectOrchestrator.ts          - Project entity operations
├── WorkSlotOrchestrator.ts         - Work slot operations
└── CalendarImportOrchestrator.ts   - iCal import workflow

View-Specific (2):
├── PlannerViewOrchestrator.ts      - Planner drag/drop interactions
└── TimelineOrchestrator.ts         - Timeline view data aggregation

Feature-Specific (3):
├── recurringEventsOrchestrator.ts  - Recurring event maintenance
├── timeTrackingOrchestrator.ts     - Time tracking state machine
└── SettingsOrchestrator.ts         - Settings persistence

Infrastructure (1):
└── index.ts                        - Barrel exports
```

---

## ❌ PROBLEMS IDENTIFIED

### **Problem 1: Event Orchestrators Are Fragmented**

**Three separate orchestrators for events:**

1. **CalendarEventOrchestrator** (372 lines)
   - Event CRUD (create, update, delete)
   - Form validation
   - Event-to-database transformation
   - Used by: EventModal, event forms

2. **PlannerViewOrchestrator** (238 lines)
   - Drag/drop event updates
   - Event resizing
   - Event completion toggle
   - Used by: PlannerView component only

3. **recurringEventsOrchestrator** (254 lines)
   - Recurring event series maintenance
   - Future event generation
   - Recurring pattern detection
   - Used by: Background tasks, event views

**Why This Is Confusing:**
- When fixing an event bug, which orchestrator do you check?
- Drag/drop uses different update path than modal edit
- Recurring logic separated from event creation logic
- PlannerViewOrchestrator is view-specific, others are entity-specific

**Where They Should Be:**
- **ONE CalendarEventOrchestrator** handling:
  - All event CRUD (create, update, delete)
  - Recurring series management (merged from recurringEventsOrchestrator)
  - Drag/drop updates (merged from PlannerViewOrchestrator)
  - The view shouldn't matter - events are events

---

### **Problem 2: TimelineOrchestrator Is Not An Orchestrator**

**What it actually does:**
```typescript
export class UnifiedTimelineService {
  // Data aggregation (not orchestration)
  static getProjectTimelineData(project: Project): TimelineProjectData { ... }
  
  // Delegation to other services
  static calculateProjectDuration = calculateProjectDuration;
  static isProjectActiveOnDate = PhaseOrchestrator.isProjectActiveOnDate;
  
  // Business logic aggregation (should be in domain rules)
  static buildDaySummaries(dayEstimates: DayEstimate[]) { ... }
}
```

**Why It's Misnamed:**
- **Orchestrators coordinate workflows** (create/update/delete with side effects)
- **This is a VIEW ADAPTER** (aggregates data for Timeline component)
- No database writes, no state changes, no side effects
- Pure data transformation for display

**Where It Should Be:**
- This is **`services/ui/TimelineViewAdapter.ts`** or **`services/data/aggregators/TimelineAggregator.ts`**
- NOT an orchestrator

---

### **Problem 3: timeTrackingOrchestrator Has Dual Responsibilities**

**Current scope (1,058 lines!):**

1. **State Machine Management** (500+ lines)
   - Start/stop/pause tracking
   - Timer intervals
   - Cross-tab synchronization
   - localStorage persistence
   - Database sync

2. **Calendar Event CRUD** (200+ lines)
   - Transform event to/from database
   - Create tracked events
   - Update tracked events
   - Duplicate of CalendarEventOrchestrator logic

**Why This Is Confusing:**
- It's doing calendar event operations that CalendarEventOrchestrator should handle
- The state machine part IS legitimate orchestration
- The event CRUD part is duplicate logic

**Where They Should Be:**
1. **Keep timeTrackingOrchestrator** for state machine only
2. **Move event operations** to CalendarEventOrchestrator
3. **State machine calls** CalendarEventOrchestrator for persistence

---

### **Problem 4: SettingsOrchestrator Is Trivial**

**Current scope (149 lines):**
```typescript
static async updateSetting(key, value, context) {
  context.setLocalSettings(prev => ({ ...prev, [key]: value }));
  if (key === 'defaultView' && context.setDefaultView) {
    context.setDefaultView(viewValue);
    context.updateSettings({ defaultView: viewValue });
  }
  return { success: true };
}
```

**Why This Exists:**
- Just wraps SettingsContext calls
- No business logic
- No complex workflows
- No validation (could be added)

**Options:**
1. **DELETE** - Use SettingsContext directly from components
2. **EXPAND** - Add validation rules for settings (domain/rules/settings/)
3. **KEEP** - If we plan to add complex settings workflows

**Recommendation:** DELETE for now (settings are simple key-value updates)

---

## ✅ PROPOSED REORGANIZATION

### **Tier 1: Entity Orchestrators (Core CRUD)**

**Purpose:** Handle entity lifecycle (create, read, update, delete) with validation

```
Entity Orchestrators (8):
├── CalendarEventOrchestrator.ts    ← MERGED (events + recurring + planner interactions)
├── ClientOrchestrator.ts           ← Keep as-is
├── GroupOrchestrator.ts            ← Keep as-is
├── HolidayOrchestrator.ts          ← Keep as-is
├── PhaseOrchestrator.ts            ← Keep as-is
├── ProjectOrchestrator.ts          ← Keep as-is
├── WorkSlotOrchestrator.ts         ← Keep as-is
└── CalendarImportOrchestrator.ts   ← Keep as-is (workflow orchestrator)
```

**CalendarEventOrchestrator responsibilities:**
- ✅ Event CRUD (create, update, delete)
- ✅ Recurring series management (from recurringEventsOrchestrator)
- ✅ Drag/drop updates (from PlannerViewOrchestrator)
- ✅ Event resizing (from PlannerViewOrchestrator)
- ✅ Event completion (from PlannerViewOrchestrator)
- ✅ Form validation (delegates to domain/rules/events/EventValidation)

---

### **Tier 2: Feature Orchestrators (Complex Workflows)**

**Purpose:** Coordinate multi-step workflows with state management

```
Feature Orchestrators (1):
└── TimeTrackingOrchestrator.ts     ← SIMPLIFIED (state machine only)
```

**TimeTrackingOrchestrator responsibilities:**
- ✅ Start/stop/pause tracking workflow
- ✅ Timer management
- ✅ Cross-tab synchronization
- ✅ State persistence (localStorage + database)
- ✅ **CALLS CalendarEventOrchestrator** for event CRUD (doesn't duplicate)

---

### **Tier 3: View Adapters (Data Aggregation)**

**Purpose:** Aggregate data for specific views (NO orchestration, NO mutations)

```
MOVE to services/data/aggregators/:
└── TimelineAggregator.ts           ← RENAMED from TimelineOrchestrator
```

**TimelineAggregator responsibilities:**
- ✅ Aggregate project data for timeline display
- ✅ Build day summaries
- ✅ Delegate to domain rules for classification
- ❌ NO database writes
- ❌ NO state changes

---

### **Tier 4: DELETED**

```
DELETED:
├── PlannerViewOrchestrator.ts      → MERGED into CalendarEventOrchestrator
├── recurringEventsOrchestrator.ts  → MERGED into CalendarEventOrchestrator
└── SettingsOrchestrator.ts         → DELETED (use SettingsContext directly)
```

---

## 📊 BEFORE vs AFTER

| Category | Before | After | Change |
|----------|--------|-------|--------|
| **Entity Orchestrators** | 8 | 8 | Same (but CalendarEvent is merged) |
| **View Orchestrators** | 2 | 0 | -2 (moved to aggregators) |
| **Feature Orchestrators** | 3 | 1 | -2 (1 merged, 1 deleted) |
| **Data Aggregators** | 0 | 1 | +1 (TimelineAggregator) |
| **Total Files** | 14 | 10 | **-4 files** |

---

## 🔄 MIGRATION PLAN

### **Step 1: Merge Event Orchestrators** (4 hours)

**1.1 Create New CalendarEventOrchestrator Structure**

```typescript
// src/services/orchestrators/CalendarEventOrchestrator.ts

export class CalendarEventOrchestrator {
  // ========================================================================
  // EVENT CRUD (existing CalendarEventOrchestrator)
  // ========================================================================
  static async createEvent(formData: EventFormData) { ... }
  static async updateEvent(id: string, updates: Partial<CalendarEvent>) { ... }
  static async deleteEvent(id: string) { ... }
  
  // ========================================================================
  // RECURRING EVENT MANAGEMENT (from recurringEventsOrchestrator)
  // ========================================================================
  static async ensureRecurringEventsExist(groupId: string, originalEvent: CalendarEvent) { ... }
  static async generateRecurringSeries(event: CalendarEvent, endDate: Date) { ... }
  static async updateRecurringSeries(groupId: string, updates: Partial<CalendarEvent>) { ... }
  
  // ========================================================================
  // INTERACTIVE UPDATES (from PlannerViewOrchestrator)
  // ========================================================================
  static async handleEventDragDrop(eventId: string, newStart: Date, newEnd: Date) { ... }
  static async handleEventResize(eventId: string, newEnd: Date) { ... }
  static async handleEventCompletionToggle(eventId: string, completed: boolean) { ... }
  
  // ========================================================================
  // VALIDATION (delegates to domain rules)
  // ========================================================================
  private static validateEventForm(...) {
    return EventValidation.validateEventForm(...); // domain/rules/events/
  }
}
```

**1.2 Update Component Imports**

```typescript
// BEFORE (PlannerView.tsx):
import { PlannerViewOrchestrator } from '@/services/orchestrators/PlannerViewOrchestrator';
const orchestrator = new PlannerViewOrchestrator(context);
await orchestrator.handleEventDragDrop(...);

// AFTER:
import { CalendarEventOrchestrator } from '@/services/orchestrators/CalendarEventOrchestrator';
await CalendarEventOrchestrator.handleEventDragDrop(...);
```

**1.3 Delete Old Files**
- ❌ `PlannerViewOrchestrator.ts`
- ❌ `recurringEventsOrchestrator.ts`

---

### **Step 2: Rename TimelineOrchestrator** (2 hours)

**2.1 Create TimelineAggregator**

```typescript
// src/services/data/aggregators/TimelineAggregator.ts

/**
 * Timeline View Data Aggregator
 * 
 * Aggregates project data for Timeline view display.
 * This is NOT an orchestrator (no mutations, no workflows).
 */
export class TimelineAggregator {
  /**
   * Build comprehensive timeline data for a project
   */
  static buildProjectTimelineData(
    project: Project,
    phases: PhaseDTO[],
    settings: Settings,
    holidays: Holiday[],
    events: CalendarEvent[]
  ): TimelineProjectData {
    // All the existing logic from UnifiedTimelineService
    // But clearly labeled as data aggregation, not orchestration
  }
  
  /**
   * Build day summaries for timeline display
   * Delegates classification to domain/rules/timeline/TimelineDisplay
   */
  static buildDaySummaries(dayEstimates: DayEstimate[]): Map<string, DaySummary> {
    // Use TimelineDisplay.classifyDayAllocationType from domain rules
  }
}
```

**2.2 Update Component Imports**

```typescript
// BEFORE (TimelineBar.tsx):
import { UnifiedTimelineService } from '@/services/orchestrators/TimelineOrchestrator';
const data = UnifiedTimelineService.getProjectTimelineData(project);

// AFTER:
import { TimelineAggregator } from '@/services/data/aggregators/TimelineAggregator';
const data = TimelineAggregator.buildProjectTimelineData(project, phases, settings, holidays, events);
```

**2.3 Delete Old File**
- ❌ `TimelineOrchestrator.ts`

---

### **Step 3: Simplify TimeTrackingOrchestrator** (3 hours)

**3.1 Refactor to Use CalendarEventOrchestrator**

```typescript
// src/services/orchestrators/TimeTrackingOrchestrator.ts

export class TimeTrackingOrchestrator {
  // ========================================================================
  // STATE MACHINE (keep all this)
  // ========================================================================
  async startTracking(projectId: string, context: TimeTrackerContext) {
    // 1. Create event via CalendarEventOrchestrator (not inline)
    const event = await CalendarEventOrchestrator.createEvent({
      title: 'Time Tracking',
      startTime: new Date(),
      endTime: new Date(),
      projectId,
      type: 'tracked'
    });
    
    // 2. Start timer (state machine)
    context.setCurrentEventId(event.id);
    context.setIsTimeTracking(true);
    this.startTimer(context);
    
    // 3. Sync state to database
    await this.saveState(...);
  }
  
  async stopTracking(context: TimeTrackerContext) {
    // 1. Stop timer (state machine)
    this.stopTimer(context);
    
    // 2. Update event via CalendarEventOrchestrator (not inline)
    await CalendarEventOrchestrator.updateEvent(context.currentEventId, {
      endTime: new Date(),
      completed: true
    });
    
    // 3. Clear state
    context.setIsTimeTracking(false);
    await this.clearState(...);
  }
  
  // ========================================================================
  // TIMER MANAGEMENT (keep all this)
  // ========================================================================
  private startTimer(context: TimeTrackerContext) { ... }
  private stopTimer(context: TimeTrackerContext) { ... }
  
  // ========================================================================
  // STATE PERSISTENCE (keep all this)
  // ========================================================================
  async saveState(state: TimeTrackingState) { ... }
  async loadState(): Promise<TimeTrackingState> { ... }
  
  // ========================================================================
  // DELETE THESE (now in CalendarEventOrchestrator)
  // ========================================================================
  // ❌ transformCalendarEventFromDatabase
  // ❌ transformCalendarEventToDatabase
  // ❌ inline event CRUD operations
}
```

---

### **Step 4: Delete SettingsOrchestrator** (1 hour)

**4.1 Update Components to Use SettingsContext Directly**

```typescript
// BEFORE (SettingsView.tsx):
import { SettingsOrchestrator } from '@/services/orchestrators/SettingsOrchestrator';
await SettingsOrchestrator.updateSetting('defaultView', 'timeline', {
  setLocalSettings,
  updateSettings,
  setDefaultView
});

// AFTER:
import { useSettings } from '@/contexts/SettingsContext';
const { updateSettings, setDefaultView } = useSettings();
setLocalSettings(prev => ({ ...prev, defaultView: 'timeline' }));
updateSettings({ defaultView: 'timeline' });
setDefaultView('timeline');
```

**4.2 Delete File**
- ❌ `SettingsOrchestrator.ts`

**4.3 Future: Add Settings Validation**
- If settings validation becomes complex, create `domain/rules/settings/SettingsValidation.ts`
- Keep orchestrator deleted unless multi-step workflows emerge

---

## 📋 VERIFICATION CHECKLIST

After reorganization:

### Architecture Clarity
- [ ] All **entity CRUD** in entity orchestrators
- [ ] All **view data aggregation** in `services/data/aggregators/`
- [ ] All **feature workflows** in feature orchestrators
- [ ] **NO view-specific orchestrators** (PlannerView, Timeline)

### File Organization
- [ ] CalendarEventOrchestrator handles ALL event operations
- [ ] TimelineAggregator handles timeline data (not TimelineOrchestrator)
- [ ] TimeTrackingOrchestrator is state machine only (calls CalendarEventOrchestrator)
- [ ] SettingsOrchestrator deleted

### Component Imports
- [ ] PlannerView uses CalendarEventOrchestrator (not PlannerViewOrchestrator)
- [ ] Timeline components use TimelineAggregator (not TimelineOrchestrator)
- [ ] TimeTracker uses CalendarEventOrchestrator for events
- [ ] Settings use SettingsContext directly

### Tests
- [ ] All tests updated for new imports
- [ ] No broken references
- [ ] All tests pass

---

## 🎯 DECISION FRAMEWORK

**When creating a new "orchestrator", ask:**

### ✅ Create Entity Orchestrator If:
- Managing lifecycle of a domain entity (Client, Project, Event)
- Coordinating CREATE/UPDATE/DELETE workflows
- Calling domain rules for validation
- Persisting to database

**Example:** `ClientOrchestrator`, `PhaseOrchestrator`

### ✅ Create Feature Orchestrator If:
- Complex multi-step workflow with state management
- Cross-tab/multi-window coordination
- Timer/interval management
- Background job coordination

**Example:** `TimeTrackingOrchestrator`, `CalendarImportOrchestrator`

### ❌ Create Data Aggregator Instead If:
- NO mutations (read-only)
- Aggregating data for view display
- Transforming data for UI consumption
- NO side effects

**Example:** `TimelineAggregator`, `ReportAggregator`

### ❌ Use Context Directly If:
- Simple key-value updates
- No validation needed
- No complex workflows
- Just wrapping context methods

**Example:** Settings, UI preferences

---

## 📊 FINAL STATE

```
services/
├── orchestrators/                  ← WORKFLOWS ONLY
│   ├── CalendarEventOrchestrator.ts    (events + recurring + interactions)
│   ├── CalendarImportOrchestrator.ts   (iCal import workflow)
│   ├── ClientOrchestrator.ts           (client entity CRUD)
│   ├── GroupOrchestrator.ts            (group entity CRUD)
│   ├── HolidayOrchestrator.ts          (holiday entity CRUD)
│   ├── PhaseOrchestrator.ts            (phase entity CRUD)
│   ├── ProjectOrchestrator.ts          (project entity CRUD)
│   ├── TimeTrackingOrchestrator.ts     (time tracking state machine)
│   └── WorkSlotOrchestrator.ts         (work slot entity CRUD)
│
└── data/
    └── aggregators/                ← DATA ONLY (no mutations)
        └── TimelineAggregator.ts   (timeline view data)
```

**Total:** 9 orchestrators + 1 aggregator = 10 files (down from 14)

**Clarity:** Each file has ONE clear responsibility

---

## 🚀 EXECUTION ORDER

1. **Step 1:** Merge event orchestrators (4h) - Biggest impact
2. **Step 2:** Rename TimelineOrchestrator (2h) - Clarifies architecture
3. **Step 3:** Simplify TimeTracking (3h) - Removes duplication
4. **Step 4:** Delete Settings (1h) - Cleanup

**Total Time:** 10 hours (~1.5 days)

**Can be done BEFORE or AFTER Stage 2** (they're independent)

---

## ✅ RECOMMENDATION

**Do this reorganization FIRST** (before Stage 2 business logic extraction).

**Why:**
- Clearer structure makes Stage 2 easier
- You'll know exactly which orchestrator to extract logic FROM
- Event orchestrators consolidation eliminates confusion
- Sets up correct patterns for future development

**Result:** When you encounter an event bug, you check **ONE** orchestrator, not three.
