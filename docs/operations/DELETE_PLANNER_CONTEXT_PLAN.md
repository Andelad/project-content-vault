# Proper Context Refactoring - Delete PlannerContext Entirely

**Status:** 📋 READY TO IMPLEMENT  
**Problem:** PlannerContext is a God Context trying to serve everyone  
**Solution:** Delete it. Each view manages its own data.  

---

## The Real Problem

```
PlannerContext (580 lines) tries to be everything:
├── Event CRUD for EventModal ❌ (should use orchestrator)
├── Habit CRUD for TimeTracker ❌ (should use orchestrator)
├── Holiday CRUD for HolidayModal ❌ (should use orchestrator)
├── WorkHour CRUD for PlannerView ❌ (should use orchestrator)
├── ALL events for InsightsView ❌ (should load own data)
├── ALL events for TimelineView ❌ (should load own data)
├── FullCalendar styling for PlannerView ❌ (should be in PlannerView)
└── UI state (selectedEventId, etc.) ⚠️ (only part that's valid)
```

**Result:** Everyone loads ALL data even if they only need a small subset.

---

## Who Actually Uses What

| Component | What They Get from PlannerContext | What They Should Do Instead |
|-----------|----------------------------------|------------------------------|
| **PlannerView** | events, habits, workHours, holidays, addEvent, updateEvent, deleteEvent, fullCalendarEvents | Load own data via `useEvents()`, use orchestrators for CRUD, have own FullCalendar logic |
| **TimelineView** | events, holidays | Load own events via `useEvents({ viewport })`, holidays via `useHolidays()` |
| **InsightsView** | events | Each card loads own data via `useEvents({ dateRange })` |
| **EventModal** | addEvent, updateEvent, deleteEvent, getRecurringGroupEvents | Use `calendarEventOrchestrator` directly |
| **HolidayModal** | holidays, addHoliday, updateHoliday, deleteHoliday | Use `holidayOrchestrator` directly (or create one) |
| **TimeTracker** | events, addEvent, updateEvent, deleteEvent | Use `timeTrackingOrchestrator` directly |
| **ProjectModal** | events, holidays | Load own data via hooks (for validation/display) |
| **HolidayBar** | holidays, addHoliday, setCreatingNewHoliday | Use `useHolidays()` + UI state from new HolidayUIContext |
| **ProjectBar** | events, holidays | Load from TimelineView (passed as props) |
| **AvailabilityCard** | events, holidays | Load own data via hooks |

---

## The Correct Architecture

### Views Own Their Data

```
PlannerView:
  ├── useEvents() with current month range
  ├── useHabits()
  ├── useHolidays()
  ├── useWorkHours()
  └── Local FullCalendar styling logic

TimelineView:
  ├── TimelineContext (UI state: viewport, collapsed groups)
  ├── useEvents({ viewportStart, viewportEnd })
  ├── useHolidays()
  └── Pass data down to ProjectBar, HolidayBar as props

InsightsView:
  ├── NO context needed
  ├── Each card loads its own:
  │   ├── TimeDistributionCard: useEvents({ last 7-30 days })
  │   ├── AvailabilityUsedCard: useEvents({ 12 periods })
  │   └── AverageDayHeatmapCard: useEvents({ last 6 months })
```

### Modals Use Orchestrators

```
EventModal:
  ├── import { calendarEventOrchestrator } from '@/services/orchestrators'
  ├── await calendarEventOrchestrator.create(data)
  ├── await calendarEventOrchestrator.update(id, data)
  └── await calendarEventOrchestrator.delete(id)

HolidayModal:
  ├── import { holidayOrchestrator } from '@/services/orchestrators'  (create this)
  └── Use orchestrator directly

TimeTracker:
  ├── import { timeTrackingOrchestrator } from '@/services/orchestrators'
  └── Already exists, just use it directly
```

### UI State in Targeted Contexts

```
HolidayUIContext (NEW - for holiday modal state):
  ├── creatingNewHoliday: { startDate, endDate } | null
  ├── setCreatingNewHoliday()
  ├── editingHolidayId: string | null
  └── setEditingHolidayId()

EventUIContext (NEW - for event modal state):
  ├── selectedEventId: string | null
  ├── setSelectedEventId()
  ├── creatingNewEvent: { startTime, endTime } | null
  └── setCreatingNewEvent()

(Or just use local state in components - do we even need contexts for this?)
```

---

## Migration Plan

### Step 1: Create HolidayOrchestrator (15 min)

```typescript
// services/orchestrators/holidayOrchestrator.ts
export const holidayOrchestrator = {
  async create(holiday: Omit<Holiday, 'id'>): Promise<Holiday> {
    const { data, error } = await supabase
      .from('holidays')
      .insert(holiday)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  
  async update(id: string, updates: Partial<Holiday>): Promise<Holiday> {
    const { data, error } = await supabase
      .from('holidays')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('holidays')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
```

### Step 2: Update HolidayModal (10 min)

**Before:**
```typescript
const { holidays, addHoliday, updateHoliday, deleteHoliday } = usePlannerContext();
```

**After:**
```typescript
import { holidayOrchestrator } from '@/services/orchestrators';
const { holidays } = useHolidays(); // Just for list
const [localHolidays, setLocalHolidays] = useState(holidays);

const handleSave = async () => {
  if (editingHoliday) {
    await holidayOrchestrator.update(editingHoliday.id, formData);
  } else {
    await holidayOrchestrator.create(formData);
  }
  // Optimistic update or refetch
  const updated = await supabase.from('holidays').select();
  setLocalHolidays(updated.data);
};
```

### Step 3: Update EventModal (15 min)

**Before:**
```typescript
const { addEvent, updateEvent, deleteEvent, getRecurringGroupEvents } = usePlannerContext();
```

**After:**
```typescript
import { calendarEventOrchestrator } from '@/services/orchestrators';

const handleSave = async () => {
  if (editing) {
    await calendarEventOrchestrator.update(eventId, formData);
  } else {
    await calendarEventOrchestrator.create(formData);
  }
};

const handleDelete = async () => {
  await calendarEventOrchestrator.delete(eventId);
};

// Recurring already handled by orchestrator
const series = await calendarEventOrchestrator.fetchRecurringSeries(groupId);
```

### Step 4: Update TimeTracker (10 min)

**Before:**
```typescript
const { events, addEvent, updateEvent, deleteEvent } = usePlannerContext();
```

**After:**
```typescript
import { timeTrackingOrchestrator } from '@/services/orchestrators/timeTrackingOrchestrator';

// Already has the methods we need!
await timeTrackingOrchestrator.start(projectId);
await timeTrackingOrchestrator.stop();
```

### Step 5: Update PlannerView (30 min)

**Before:**
```typescript
const {
  events,
  habits,
  workHours,
  holidays,
  addEvent,
  updateEvent,
  deleteEvent,
  fullCalendarEvents,
  getStyledFullCalendarEvents,
  selectedEventId,
  setSelectedEventId,
  layerMode,
  setLayerMode,
  currentView,
  setCurrentView,
} = usePlannerContext();
```

**After:**
```typescript
// Load own data
const currentMonth = useMemo(() => new Date(), []);
const { events } = useEvents({
  startDate: startOfMonth(currentMonth),
  endDate: endOfMonth(currentMonth)
});
const { habits } = useHabits();
const { workHours } = useWorkHours();
const { holidays } = useHolidays();

// Local UI state (or create PlannerViewUIContext if needed)
const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
const [layerMode, setLayerMode] = useState<'events' | 'work-hours' | 'both'>('both');
const [currentView, setCurrentView] = useState<'week' | 'day'>('week');

// Local FullCalendar styling (move from PlannerContext)
const fullCalendarEvents = useMemo(() => {
  return prepareEventsForFullCalendar(events, projects, holidays);
}, [events, projects, holidays]);

// Use orchestrators for CRUD
import { calendarEventOrchestrator } from '@/services/orchestrators';
const handleAddEvent = async (data) => {
  await calendarEventOrchestrator.create(data);
  refetchEvents(); // From useEvents hook
};
```

### Step 6: Update TimelineView (20 min)

**Before:**
```typescript
const { events, holidays } = usePlannerContext();
```

**After:**
```typescript
const { viewportStart, viewportEnd } = useTimelineContext();

const { events } = useEvents({
  startDate: subDays(viewportStart, 30),
  endDate: addDays(viewportEnd, 30)
});

const { holidays } = useHolidays(); // All holidays (not many)

// Pass to child components as props
<ProjectBar events={events} holidays={holidays} />
<HolidayBar holidays={holidays} />
```

### Step 7: Update InsightsView (15 min)

Already planned - each card loads its own data.

### Step 8: Delete PlannerContext + PlannerUIContext (5 min)

```bash
rm src/react/contexts/PlannerContext.tsx
rm src/react/contexts/PlannerUIContext.tsx
```

Update `src/react/contexts/index.ts` - remove exports
Update `src/react/contexts/ContextProviders.tsx` - remove providers

---

## What Contexts Should Exist

### Keep These (Valid Contexts)

1. **AuthContext** - Cross-cutting: Current user, authentication state
2. **SettingsContext** - Cross-cutting: User preferences, theme, work hours
3. **ProjectContext** - Cross-cutting: Project/group lists (used everywhere)
4. **TimelineContext** - Timeline-specific UI: Viewport, collapsed groups, navigation

### Maybe Keep (Evaluate)

5. **EventUIContext** - Event modal state (or just use local state in EventModal?)
6. **HolidayUIContext** - Holiday modal state (or just use local state in HolidayModal?)

If modal state is only used by one component, use **local state** instead of context!

### Delete These

7. ❌ **PlannerContext** - God context, does everything
8. ❌ **PlannerUIContext** - Band-aid I created (my mistake)

---

## Timeline

| Step | Duration | Cumulative |
|------|----------|------------|
| 1. Create HolidayOrchestrator | 15 min | 15 min |
| 2. Update HolidayModal | 10 min | 25 min |
| 3. Update EventModal | 15 min | 40 min |
| 4. Update TimeTracker | 10 min | 50 min |
| 5. Update PlannerView | 30 min | 80 min |
| 6. Update TimelineView | 20 min | 100 min |
| 7. Update InsightsView | 15 min | 115 min |
| 8. Delete PlannerContext | 5 min | 120 min |
| **Total** | **2 hours** | |

---

## Success Metrics

- ✅ Zero contexts with data loading (only UI state)
- ✅ Zero contexts with CRUD operations (use orchestrators)
- ✅ Each view loads only data it needs
- ✅ Modals use orchestrators directly
- ✅ < 5 contexts total (Auth, Settings, Project, Timeline, maybe 1-2 UI contexts)
- ✅ All contexts < 150 lines each

---

## Next Steps

1. **Create HolidayOrchestrator** (new file)
2. **Update one component at a time** (test after each)
3. **Delete PlannerContext when last usage removed**
4. **Delete PlannerUIContext** (my band-aid)
5. **Update documentation**

Ready to start?
