# Context Refactoring Plan: Minimal Contexts + Targeted Data Loading

**Status:** 📋 PLANNED - Not yet implemented  
**Current Issue:** PlannerContext is a "God Context" that loads ALL events for everyone  
**Goal:** Make contexts lightweight (UI state only), let views load their own targeted data  
**Estimated Effort:** 2-3 hours  

---

## Problem Statement

### Current Architecture (BAD)

```
PlannerContext (God Object)
├── Loads ALL events from database
├── Provides CRUD operations (should be orchestrators)
├── Used by everyone (Insights, Timeline, Planner, Modals)
└── Forces loading unnecessary data

Result: Insights page loads slowly because it gets ALL events
        even though it only needs last 6 months
```

**Example of the problem:**
- **InsightsView** needs: Last 12 months of events (for Availability scrollback)
- **TimelineView** needs: Current viewport + 30 day buffer
- **PlannerView** needs: Current month
- **EventModal** needs: Single event lookup

But they ALL get: **EVERY SINGLE EVENT IN THE DATABASE** 😱

### Why This Is Bad

1. **Performance**: Loading 3+ years of events when you need 1 week
2. **Memory**: Keeping unnecessary data in React state
3. **Network**: Transferring MB of data unnecessarily
4. **Architecture**: Violates DDD (contexts should be UI layer, not data layer)

---

## Proposed Architecture (GOOD)

### Principle: Views Load Their Own Data

```
Domain Layer (Pure Logic)
    ↓
Services Layer (Orchestrators + Data Services)
    ↓
React Hooks (useEvents, useProjects, useHabits)
    ↓
Views (Load exactly what they need)

Contexts ONLY for: Cross-cutting UI state (auth, theme, settings)
```

### What Each View Should Do

**InsightsView:**
```typescript
// Each insight card loads its own data based on current selection
function InsightsView() {
  const { projects } = useProjectContext(); // Just project list, no events!
  const [timeFrame, setTimeFrame] = useState('month'); // User selection
  
  return (
    <TimeDistributionCard timeFrame={timeFrame} />  // Loads own events
    <AvailabilityUsedCard timeFrame={timeFrame} />  // Loads own events
    <AverageDayHeatmapCard period="month" />        // Loads own events
    <FutureCommitmentsCard months={6} />            // Loads own events
  );
}
```

**TimeDistributionCard** (smart component):
```typescript
function TimeDistributionCard({ timeFrame }: { timeFrame: 'week' | 'month' }) {
  // Calculate exact date range needed
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (timeFrame === 'week') {
      return {
        startDate: subDays(now, 7),
        endDate: now
      };
    }
    return {
      startDate: subMonths(now, 1),
      endDate: now
    };
  }, [timeFrame]);
  
  // Load ONLY the events needed for this card
  const { events, loading } = useEvents({ startDate, endDate });
  
  // Calculate distribution from events
  const distribution = useMemo(() => 
    calculateTimeDistribution(events, projects),
    [events, projects]
  );
  
  return <PieChart data={distribution} />;
}
```

**Benefits:**
- ✅ TimeDistributionCard loads 7-30 days of events (not ALL events)
- ✅ When user changes timeFrame dropdown, only refetches what's needed
- ✅ Other cards unaffected (no prop drilling)
- ✅ Clear data ownership (card owns its data)

---

## Migration Steps

### Phase 1: Audit Current Context Usage (30 minutes)

Identify what each context actually provides:

**PlannerContext** (Currently):
- ❌ events: CalendarEvent[] ← Should NOT be in context
- ❌ addEvent, updateEvent, deleteEvent ← Should use orchestrators directly
- ✅ selectedEventId: string | null ← UI state (keep)
- ✅ creatingNewEvent: object | null ← UI state (keep)
- ✅ layerMode: 'events' | 'work-hours' | 'both' ← UI state (keep)
- ❌ habits, holidays, workHours ← Should NOT be in context
- ❌ CRUD operations for habits/holidays/workHours ← Should use orchestrators

**ProjectContext** (Currently):
- ✅ projects: Project[] ← Keep (needed everywhere)
- ✅ groups: Group[] ← Keep (needed everywhere)
- ❌ updateProject, deleteProject ← Should use orchestrators directly

**SettingsContext** (Currently):
- ✅ settings: Settings ← Keep (cross-cutting UI preferences)
- ✅ weeklyWorkHours ← Keep (needed for calculations)
- ✅ isTimeTracking ← Keep (global UI state)
- ✅ currentTrackingEventId ← Keep (global UI state)

### Phase 2: Create Targeted Data Hooks (45 minutes)

Instead of contexts providing all data, create specialized hooks:

```typescript
// hooks/data/useEventsForInsights.ts
export function useEventsForTimeDistribution(timeFrame: 'week' | 'month') {
  const { startDate, endDate } = useMemo(() => {
    // Calculate range based on timeFrame
  }, [timeFrame]);
  
  return useEvents({ startDate, endDate });
}

export function useEventsForAvailability(timeFrame: 'week' | 'month' | 'year', offset: number) {
  const { startDate, endDate } = useMemo(() => {
    // Calculate range for 12 periods + offset
  }, [timeFrame, offset]);
  
  return useEvents({ startDate, endDate });
}

export function useEventsForHeatmap(period: 'week' | 'month' | '6months') {
  const { startDate, endDate } = useMemo(() => {
    // Calculate lookback period
  }, [period]);
  
  return useEvents({ startDate, endDate });
}
```

### Phase 3: Update Insight Cards (60 minutes)

**Before:**
```typescript
// InsightsView.tsx
function InsightsView() {
  const { events } = usePlannerContext(); // ALL EVENTS 😱
  
  return (
    <TimeDistributionCard events={events} projects={projects} />
    <AvailabilityUsedCard events={events} projects={projects} />
    <AverageDayHeatmapCard events={events} />
  );
}
```

**After:**
```typescript
// InsightsView.tsx
function InsightsView() {
  const { projects } = useProjectContext(); // Just project list
  
  return (
    <TimeDistributionCard projects={projects} />  // Loads own events
    <AvailabilityUsedCard projects={projects} />  // Loads own events
    <AverageDayHeatmapCard />                     // Loads own events
  );
}

// TimeDistributionCard.tsx
function TimeDistributionCard({ projects }: { projects: Project[] }) {
  const [timeFrame, setTimeFrame] = useState<'week' | 'month'>('week');
  const { events, loading } = useEventsForTimeDistribution(timeFrame);
  
  // ... rest of component
}
```

### Phase 4: Simplify PlannerContext (45 minutes)

**Before (580 lines of complexity):**
```typescript
export function PlannerProvider({ children }) {
  // Load ALL events
  const { events } = useEvents(); // No date range!
  
  // Provide CRUD operations
  const addEvent = async (...) => { /* ... */ };
  const updateEvent = async (...) => { /* ... */ };
  
  // Process and transform data
  const processedEvents = useMemo(() => /* complex mapping */, [events]);
  
  return (
    <PlannerContext.Provider value={{
      events: processedEvents, // ❌ Remove
      addEvent,                // ❌ Remove
      updateEvent,             // ❌ Remove
      // ... 20+ other things
    }}>
      {children}
    </PlannerContext.Provider>
  );
}
```

**After (< 100 lines, UI state only):**
```typescript
export function PlannerProvider({ children }) {
  // ONLY UI state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [creatingNewEvent, setCreatingNewEvent] = useState(null);
  const [layerMode, setLayerMode] = useState<'events' | 'work-hours' | 'both'>('both');
  const [currentView, setCurrentView] = useState<'week' | 'day'>('week');
  
  return (
    <PlannerContext.Provider value={{
      selectedEventId,
      setSelectedEventId,
      creatingNewEvent,
      setCreatingNewEvent,
      layerMode,
      setLayerMode,
      currentView,
      setCurrentView,
    }}>
      {children}
    </PlannerContext.Provider>
  );
}
```

### Phase 5: Update Modals to Use Orchestrators (30 minutes)

**Before:**
```typescript
// EventModal.tsx
function EventModal() {
  const { addEvent, updateEvent, deleteEvent } = usePlannerContext(); // ❌
  
  const handleSave = async () => {
    await addEvent(formData); // Goes through context
  };
}
```

**After:**
```typescript
// EventModal.tsx
import { calendarEventOrchestrator } from '@/services/orchestrators';

function EventModal() {
  const { refetch } = useEvents(); // Optional: trigger refetch after mutation
  
  const handleSave = async () => {
    await calendarEventOrchestrator.create(formData); // Direct orchestrator call
    refetch(); // Refresh events in views that need them
  };
}
```

---

## Data Loading Strategy Per View

### InsightsView

**Requirements:**
- Time Distribution: Last 7 days (default) or last 30 days
- Availability Used: Shows 12 periods, can scroll back 5 years
- Average Day Heatmap: Last 7 days, 30 days, or 6 months
- Future Commitments: Next 6 months of projects (NO events needed!)

**Strategy:** Each card loads its own data
```typescript
<TimeDistributionCard />       // useEvents({ last 7-30 days })
<AvailabilityUsedCard />        // useEvents({ 12 periods based on timeFrame + offset })
<AverageDayHeatmapCard />       // useEvents({ last 7 days to 6 months })
<FutureCommitmentsCard />       // NO events needed (just projects)
```

### TimelineView

**Requirements:**
- Current viewport (visible date range)
- +30 day buffer for smooth scrolling

**Strategy:** Viewport-aware loading (already implemented!)
```typescript
const { viewportStart, viewportEnd } = useTimelineViewport();
const { events } = useEvents({ 
  startDate: subDays(viewportStart, 30),
  endDate: addDays(viewportEnd, 30)
});
```

### PlannerView (Calendar)

**Requirements:**
- Current month view
- +/- 1 week buffer for month boundaries

**Strategy:** Month-aware loading
```typescript
const { currentMonth } = usePlannerState();
const { events } = useEvents({
  startDate: startOfMonth(subDays(currentMonth, 7)),
  endDate: endOfMonth(addDays(currentMonth, 7))
});
```

### EventModal

**Requirements:**
- Single event lookup by ID
- Recurring series lookup (if editing series)

**Strategy:** Direct orchestrator call (no hook needed)
```typescript
const event = await calendarEventOrchestrator.fetchById(eventId);
const series = await calendarEventOrchestrator.fetchRecurringSeries(groupId);
```

---

## Performance Gains

### Before (Current)

```
PlannerContext loads ALL events on app boot
├── 3+ years of historical data
├── All recurring instances
├── ~1000-5000 events loaded
└── Takes 2-10 seconds

InsightsView receives ALL events
├── Filters down to last 7 days
├── Throws away 99% of data
└── Still slow because processing ALL events first
```

### After (Proposed)

```
Views load only what they need on demand

InsightsView:
├── TimeDistributionCard: 7-30 days (10-50 events)
├── AvailabilityUsedCard: 12 periods (~50-200 events)
├── AverageDayHeatmapCard: 7 days to 6 months (50-500 events)
└── FutureCommitmentsCard: 0 events (just projects)

Total: ~100-750 events (vs 1000-5000)
Load time: < 500ms (vs 2-10 seconds)
```

**Estimated improvement:** 4-20x faster page loads

---

## Architecture Alignment

### Current (Violates DDD)

```
React Context (Presentation Layer)
    ↓
  Loads ALL data from database
    ↓
  Provides to all components
    ↓
Components filter what they need

❌ Presentation layer doing data layer's job
❌ No separation of concerns
❌ Can't reuse logic in API/mobile/CLI
```

### Proposed (Follows DDD)

```
Domain Layer
    ↓
Services Layer (Orchestrators)
    ↓
React Hooks (useEvents with date range)
    ↓
Components (call hooks directly)

Contexts (Separate)
    ↓
  Just UI state (selected items, modal state, preferences)

✅ Clean layer separation
✅ Components own their data needs
✅ Orchestrators reusable outside React
✅ Testable (mock useEvents hook)
```

---

## Migration Checklist

- [ ] **Phase 1:** Audit contexts (identify what to keep/remove)
- [ ] **Phase 2:** Create specialized data hooks
  - [ ] `useEventsForTimeDistribution(timeFrame)`
  - [ ] `useEventsForAvailability(timeFrame, offset)`
  - [ ] `useEventsForHeatmap(period)`
  - [ ] `useEventsForTimeline(viewport)`
  - [ ] `useEventsForPlanner(month)`
- [ ] **Phase 3:** Update Insight cards to load own data
  - [ ] TimeDistributionCard
  - [ ] AvailabilityUsedCard
  - [ ] AverageDayHeatmapCard
  - [ ] FutureCommitmentsCard (remove events dependency)
- [ ] **Phase 4:** Simplify PlannerContext
  - [ ] Remove `events` from context
  - [ ] Remove CRUD operations from context
  - [ ] Keep only UI state
  - [ ] Reduce from ~580 lines to < 100 lines
- [ ] **Phase 5:** Update modals to use orchestrators
  - [ ] EventModal → calendarEventOrchestrator
  - [ ] ProjectModal → projectOrchestrator
  - [ ] HolidayModal → holidayOrchestrator
- [ ] **Phase 6:** Update other views
  - [ ] TimelineView (verify viewport loading still works)
  - [ ] PlannerView (add month-aware loading)
  - [ ] OverviewView (tabs load own data)
- [ ] **Phase 7:** Remove PlannerContext from views that don't need it
  - [ ] InsightsView (done in Phase 3)
  - [ ] TimelineView (use hooks directly)
  - [ ] Modals (use orchestrators directly)
- [ ] **Phase 8:** Test & verify performance
  - [ ] Measure Insights page load time (before/after)
  - [ ] Verify no regressions in other views
  - [ ] Check network tab (fewer events loaded)
  - [ ] Verify smooth scrolling/navigation

---

## Rollback Plan

If migration causes issues:

1. **Incremental rollback:** Revert one view/component at a time
2. **Git branches:** Each phase in separate branch
3. **Feature flags:** Toggle new data loading on/off

**Low risk because:**
- Each view can be updated independently
- Old PlannerContext still works while migrating
- Can test each component in isolation

---

## Expected Timeline

| Phase | Duration | Can Pause? |
|-------|----------|------------|
| Phase 1: Audit | 30 min | ✅ Yes |
| Phase 2: Create hooks | 45 min | ✅ Yes |
| Phase 3: Update Insights | 60 min | ⚠️ Per card (15 min each) |
| Phase 4: Simplify context | 45 min | ❌ No (breaks things half-done) |
| Phase 5: Update modals | 30 min | ✅ Yes (per modal) |
| Phase 6: Update other views | 30 min | ✅ Yes (per view) |
| Phase 7: Cleanup | 15 min | ✅ Yes |
| Phase 8: Test | 30 min | ✅ Yes |
| **Total** | **4-5 hours** | |

**Recommendation:** Can be done incrementally over 1-2 weeks (1 hour per day)

---

## Success Metrics

Migration is successful when:

- ✅ Insights page loads in < 1 second (currently 2-10 seconds)
- ✅ Network requests show targeted date ranges (not ALL events)
- ✅ PlannerContext < 100 lines (currently ~580 lines)
- ✅ All tests pass
- ✅ No user-facing regressions
- ✅ Components import from orchestrators, not contexts

---

## Next Steps

1. **Create Phase 1 audit** in separate doc
2. **Implement Phase 2 hooks** (can be done in parallel with current work)
3. **Update ONE insight card** as proof of concept
4. **Measure performance improvement**
5. **If successful, proceed with remaining phases**

**Do NOT attempt all phases at once** - incremental migration is safer!
