# Minimal Contexts Implementation - Summary

**Date:** January 8, 2026  
**Status:** ✅ Step 1 Complete - Foundation Laid  

---

## What Was Done

### 1. ✅ Reorganized React Code (Option A)

Moved all React-specific code into `src/react/` folder:

```bash
src/
├── domain/          ← NO React (pure business logic)
├── services/        ← NO React (orchestrators, data services)
├── react/           ← ALL React code ✅ NEW
│   ├── components/  (moved from src/components)
│   ├── hooks/       (moved from src/hooks)
│   └── contexts/    (moved from src/contexts)
├── types/
├── utils/
└── ... (other folders unchanged)
```

**Files changed:**
- `tsconfig.json` - Updated paths to `src/react/components`, etc.
- `tsconfig.app.json` - Updated paths
- Moved 3 folders using `git mv` (preserves history)

**Benefits:**
- Clear separation: React vs framework-agnostic code
- Can extract `domain/` + `services/` as standalone packages
- Easy for new devs: "Is it React? Put it in react/"

### 2. ✅ Created Minimal PlannerUIContext

Created new lightweight context (`~80 lines` vs old `~580 lines`):

**Location:** `src/react/contexts/PlannerUIContext.tsx`

**Contains ONLY UI state:**
```typescript
export interface PlannerUIContextType {
  // Event Selection & Creation
  selectedEventId: string | null;
  setSelectedEventId: (eventId: string | null) => void;
  creatingNewEvent: { startTime?: Date; endTime?: Date } | null;
  setCreatingNewEvent: (times: { startTime: Date; endTime: Date } | null) => void;
  
  // Habit Creation
  creatingNewHabit: { startTime?: Date; endTime?: Date } | null;
  setCreatingNewHabit: (times: { startTime: Date; endTime: Date } | null) => void;
  
  // Holiday UI State
  creatingNewHoliday: { startDate: Date; endDate: Date } | null;
  setCreatingNewHoliday: (creating: { startDate: Date; endDate: Date } | null) => void;
  editingHolidayId: string | null;
  setEditingHolidayId: (holidayId: string | null) => void;
  
  // Planner View Mode
  layerMode: 'events' | 'work-hours' | 'both';
  setLayerMode: (mode: 'events' | 'work-hours' | 'both') => void;
  currentView: 'week' | 'day';
  setCurrentView: (view: 'week' | 'day') => void;
}
```

**Does NOT contain:**
- ❌ Data loading (no events, holidays, workHours arrays)
- ❌ CRUD operations (no addEvent, updateEvent, deleteEvent)
- ❌ Data transformation (no processedEvents, fullCalendarEvents)
- ❌ Complex orchestration logic

**How to use:**
```typescript
import { usePlannerUI } from '@/contexts/PlannerUIContext';

function MyComponent() {
  const { selectedEventId, setSelectedEventId } = usePlannerUI();
  // Just UI state, no data!
}
```

### 3. ✅ Updated Context Exports

**Files updated:**
- `src/react/contexts/index.ts` - Exports `PlannerUIProvider` and `usePlannerUI`
- `src/react/contexts/ContextProviders.tsx` - Wraps app with `<PlannerUIProvider>`

**Context hierarchy:**
```tsx
<SettingsProvider>
  <TimelineProvider>
    <PlannerUIProvider>  {/* NEW - minimal UI state */}
      <PlannerProvider>  {/* OLD - still exists for backwards compat */}
        <ProjectProvider>
          <App />
```

### 4. ✅ Documentation Updated

**Files updated:**
- `.ddd` - Added new section "React Organization & Minimal Contexts"
- `.fullddd` - Created (full DDD migration plan for future)
- `docs/operations/CONTEXT_REFACTORING_PLAN.md` - Detailed migration guide

---

## What This Enables (Next Steps)

### Immediate Benefits

1. **Clear architecture boundary:**
   - `src/react/` = Presentation layer (React-specific)
   - `src/services/` = Application layer (framework-agnostic)
   - `src/domain/` = Domain layer (pure business logic)

2. **Foundation for performance fixes:**
   - Can now migrate components to load only data they need
   - No longer forced to load ALL events from context

### How to Use Going Forward

**OLD way (God Context):**
```typescript
// ❌ Loads ALL events for everyone
function InsightsView() {
  const { events } = usePlannerContext(); // 1000+ events
  return <TimeDistributionCard events={events} />;
}
```

**NEW way (Minimal Context + Targeted Hooks):**
```typescript
// ✅ UI state from context, data from hooks
function InsightsView() {
  const { selectedEventId } = usePlannerUI(); // Just UI state
  return <TimeDistributionCard />;
}

function TimeDistributionCard() {
  const [timeFrame, setTimeFrame] = useState('week');
  
  // Load ONLY what this card needs
  const { events } = useEvents({
    startDate: subDays(new Date(), 7),
    endDate: new Date()
  }); // Only 7 days of events
  
  // ... render
}
```

**For modals (use orchestrators directly):**
```typescript
// ❌ OLD: Go through context
function EventModal() {
  const { addEvent } = usePlannerContext();
  await addEvent(data);
}

// ✅ NEW: Use orchestrator directly
import { calendarEventOrchestrator } from '@/services/orchestrators';

function EventModal() {
  await calendarEventOrchestrator.create(data);
}
```

---

## Migration Path

### Phase 1: ✅ DONE (Today)
- Created minimal PlannerUIContext
- Reorganized into src/react/ folder
- Updated documentation

### Phase 2: 🔄 TODO (Incremental)
Migrate components one-by-one to use:
- `usePlannerUI()` for UI state (instead of `usePlannerContext()`)
- `useEvents()` directly with date ranges (instead of getting events from context)
- Orchestrators directly for CRUD (instead of context methods)

**Priority order:**
1. InsightsView cards (biggest performance gain)
2. TimelineView (already mostly migrated)
3. PlannerView (calendar)
4. Modals (EventModal, HolidayModal, etc.)

### Phase 3: ⏸️ FUTURE
- Remove old PlannerContext entirely
- All components use minimal contexts + hooks + orchestrators
- ~500 lines of code deleted

---

## Rules Going Forward

### ✅ Good Use of Context
- Selected item IDs (selectedEventId)
- Modal open/closed state (creatingNewEvent)
- View mode (layerMode: 'events' | 'work-hours')
- User preferences (theme, settings)
- Authentication state

### ❌ Bad Use of Context
- Loading data from database
- CRUD operations (create, update, delete)
- Filtering or transforming data
- Business logic calculations
- API calls

### Where Things Should Live

| What | Where | Example |
|------|-------|---------|
| UI state | Context | `selectedEventId`, `creatingNewEvent` |
| Data loading | Hooks | `useEvents({ startDate, endDate })` |
| CRUD operations | Orchestrators | `calendarEventOrchestrator.create()` |
| Business logic | Domain rules | `ProjectValidation.validate()` |
| View calculations | Services/UI | `ProjectBarPositioning.calculate()` |

---

## Files Created/Modified

### Created
- `src/react/contexts/PlannerUIContext.tsx` - Minimal UI-only context
- `.fullddd` - Full DDD migration plan (for future)
- `docs/operations/CONTEXT_REFACTORING_PLAN.md` - Detailed guide

### Modified
- `src/react/contexts/index.ts` - Export new context
- `src/react/contexts/ContextProviders.tsx` - Add PlannerUIProvider
- `tsconfig.json` - Update paths for react/ folder
- `tsconfig.app.json` - Update paths for react/ folder
- `.ddd` - Document new approach

### Moved (git mv)
- `src/components/` → `src/react/components/`
- `src/hooks/` → `src/react/hooks/`
- `src/contexts/` → `src/react/contexts/`

---

## Testing

✅ TypeScript compiles successfully: `npx tsc --noEmit`  
⏸️ Manual testing: Load app and verify nothing broken  
⏸️ Component migration: Test each component as it's migrated  

---

## Next Actions (When Ready)

1. **Test the reorganization:**
   - Load the app
   - Click through views (Timeline, Insights, Planner)
   - Verify everything works

2. **Start component migration:**
   - Pick one Insights card (e.g., TimeDistributionCard)
   - Make it load its own events via `useEvents()`
   - Remove dependency on PlannerContext
   - Measure performance improvement

3. **Iterate:**
   - Migrate one component per session
   - Test after each migration
   - Document any issues

---

## Success Metrics

We'll know this is successful when:

- ✅ Contexts are < 100 lines each (vs 580 lines)
- ✅ Insights page loads in < 1 second (vs 2-10 seconds)
- ✅ Components import from orchestrators, not contexts
- ✅ Network tab shows targeted date ranges (not ALL events)
- ✅ Can extract domain/services as standalone package

---

## Architecture Alignment

This follows our `.ddd` architecture:

```
Domain Layer (Pure Business Logic)
  ↓
Services Layer (Orchestrators + Data Services)
  ↓
React Hooks (useEvents, useProjects - data fetching)
  ↓
React Components (call hooks directly)

React Contexts (SEPARATE - UI state only)
  ↓
Just modal states, selected items, view preferences
```

**Key principle:** Contexts are presentation layer (UI state), not data layer. Components own their data needs.
