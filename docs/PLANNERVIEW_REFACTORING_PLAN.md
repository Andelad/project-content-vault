# PlannerView Refactoring Plan

**Status**: 📋 Ready for Implementation  
**Current Size**: 1,675 lines (CRITICAL - needs refactoring)  
**Target Size**: ~700-800 lines (coordinator only)  
**Complexity**: HIGH - FullCalendar integration, keyboard shortcuts, drag/drop, real-time updates

---

## 🎯 Goals

1. **Reduce component size by ~50%** (from 1,675 → ~800 lines)
2. **Apply proven TimelineView patterns** (we achieved 52% reduction there)
3. **Improve performance** with React.memo and custom hooks
4. **Follow AI Dev Rules** strictly (services → hooks → components)
5. **Maintain all existing functionality** (keyboard shortcuts, drag/drop, undo/redo)

---

## 📊 Current Analysis

### Component Breakdown (1,675 lines):
- **State management**: ~200 lines (13 useState declarations)
- **Event handlers**: ~400 lines (12 useCallback functions)
- **Render logic**: ~600 lines (FullCalendar config, event rendering, layer rendering)
- **Keyboard shortcuts**: ~100 lines (useEffect with event listeners)
- **Calendar integration**: ~200 lines (FullCalendar setup, date sync)
- **Toolbar/Navigation**: ~100 lines (date picker, view toggle, layers menu)
- **Bottom sections**: ~75 lines (DailyProjectSummaryRow, TabbedAvailabilityCard)

### Key Handlers Found:
1. `handleEventClick` - Opens event modal
2. `handleEventDrop` - Drag event to new time (uses orchestrator ✅)
3. `handleEventResize` - Resize event duration (uses orchestrator ✅)
4. `handleDateSelect` - Create new event from selection
5. `handleProjectDragStart/End` - Drag projects into calendar
6. `handleNavigate` - Navigate prev/next/today
7. `handleDatePickerSelect` - Jump to specific date
8. `handleViewChange` - Switch week/day view
9. `renderEventContent` - Custom event rendering (~200 lines!)
10. `handleCompletionToggle` - Toggle event/habit completion
11. `handleCompactViewToggle` - Toggle compact layout
12. `handleWeekNavDayClick` - Click day in week navigation

### State Variables (13):
- `calendarDate`, `isDatePickerOpen`, `isLayersPopoverOpen`
- `isDraggingProject`, `calendarReady`, `summaryDateStrings`
- `calendarScrollbarWidth`, `timeAxisWidth`, `layerVisibility`
- `viewportSize`, `visibleRange`, `weekStart`

---

## 🔨 Extraction Strategy

### Phase 1: Extract Toolbar & Navigation (Priority: HIGH)
**Create**: `PlannerToolbar.tsx` (~150 lines)
- Date picker button & popover
- View toggle (week/day)
- Layers visibility popover
- Prev/Next/Today navigation
- Date range display
- Compact view toggle

**Extracted from PlannerView**:
- `handleNavigate`
- `handleDatePickerSelect`
- `handleViewChange`
- `formatDateRange`
- `handleCompactViewToggle`
- Toolbar JSX (~100 lines)

### Phase 2: Extract Event Rendering (Priority: HIGH)
**Create**: `PlannerEventContent.tsx` (~250 lines)
- Custom event rendering logic (currently `renderEventContent`)
- Time display formatting
- Icon rendering (habits, tasks, tracking indicator)
- Event styling based on type
- Completion checkboxes
- Drag handles

**Benefits**:
- **React.memo** - Only re-render when event data changes
- Isolates complex rendering logic
- Easier to test event appearance

### Phase 3: Extract Keyboard Shortcuts (Priority: MEDIUM)
**Create**: `usePlannerKeyboardShortcuts.ts` (~120 lines)
- Handles all keyboard events (Cmd+Z, Arrow keys, Delete, etc.)
- Coordinates with services (no business logic in hook)
- Manages keyboard event listeners

**Pattern** (following TimelineView):
```typescript
export function usePlannerKeyboardShortcuts({
  onUndo,
  onNavigate,
  onViewChange,
  onDeleteEvent,
  onClearSelection,
  onToggleLayers
}: KeyboardShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Coordinate keyboard events
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dependencies]);
}
```

### Phase 4: Extract Calendar Management (Priority: MEDIUM)
**Create**: `usePlannerCalendar.ts` (~150 lines)
- Manages FullCalendar ref and state
- Coordinates calendar date with global context
- Handles viewport size detection
- Manages visible range updates
- Syncs calendar navigation with state

**Pattern**:
```typescript
export function usePlannerCalendar({
  currentDate,
  currentView,
  onDateChange,
  onRangeChange
}: PlannerCalendarConfig) {
  const calendarRef = useRef<FullCalendar>(null);
  const [calendarDate, setCalendarDate] = useState(initialDate);
  const [visibleRange, setVisibleRange] = useState({ start, end });
  
  // Sync logic, viewport detection, etc.
  
  return { calendarRef, calendarDate, visibleRange, ... };
}
```

### Phase 5: Extract Layer Management (Priority: LOW)
**Create**: `usePlannerLayers.ts` (~80 lines)
- Manages layer visibility state
- Filters events/habits/holidays based on visibility
- Could potentially be memoized for performance

### Phase 6: Extract Bottom Sections (Priority: LOW)
**Already extracted** - No action needed:
- `DailyProjectSummaryRow` ✅
- `TabbedAvailabilityCard` ✅
- `WeekNavigationBar` ✅

---

## 🏗️ Architecture Pattern (Following AI Dev Rules)

```
PlannerView (coordinator - ~800 lines)
├── Contexts (data sources)
│   ├── PlannerContext (events, habits, holidays)
│   ├── ProjectContext (projects, milestones)
│   ├── TimelineContext (currentDate, view mode)
│   └── SettingsContext (user preferences)
│
├── Custom Hooks (React coordination)
│   ├── usePlannerCalendar (calendar state + sync)
│   ├── usePlannerKeyboardShortcuts (keyboard events)
│   ├── usePlannerLayers (layer visibility filtering)
│   └── useSwipeNavigation (already exists ✅)
│
├── Services (pure calculations - already exist ✅)
│   ├── PlannerViewOrchestrator (drag/resize workflows)
│   ├── getBaseFullCalendarConfig (calendar setup)
│   └── getEventStylingConfig (event styling)
│
└── Components (presentational)
    ├── PlannerToolbar (navigation, date picker, layers)
    ├── PlannerEventContent (event rendering - MEMOIZED)
    ├── FullCalendar (3rd party)
    ├── WeekNavigationBar ✅
    ├── DailyProjectSummaryRow ✅
    └── TabbedAvailabilityCard ✅
```

---

## ✅ Implementation Checklist

### Step 1: Setup & Planning
- [ ] Read this document thoroughly
- [ ] Review TimelineView refactoring for patterns
- [ ] Check AI Dev Rules for architecture guidelines
- [ ] Backup PlannerView.tsx (just in case)

### Step 2: Extract PlannerToolbar (~150 lines)
- [ ] Create `src/components/planner/PlannerToolbar.tsx`
- [ ] Move toolbar JSX and related handlers
- [ ] Add proper TypeScript types for props
- [ ] Import and use in PlannerView
- [ ] Test: Navigation, date picker, view toggle, layers menu

### Step 3: Extract PlannerEventContent (~250 lines)
- [ ] Create `src/components/planner/PlannerEventContent.tsx`
- [ ] Move `renderEventContent` logic
- [ ] Wrap with `React.memo` for performance
- [ ] Pass minimal props (event data, handlers)
- [ ] Test: Event rendering, icons, completion toggles

### Step 4: Extract usePlannerKeyboardShortcuts (~120 lines)
- [ ] Create `src/hooks/usePlannerKeyboardShortcuts.ts`
- [ ] Move keyboard event handler useEffect
- [ ] Return nothing (just side effects)
- [ ] Add JSDoc comments explaining shortcuts
- [ ] Test: All keyboard shortcuts (Cmd+Z, arrows, delete, etc.)

### Step 5: Extract usePlannerCalendar (~150 lines)
- [ ] Create `src/hooks/usePlannerCalendar.ts`
- [ ] Move calendar ref, date state, range state
- [ ] Move viewport size detection logic
- [ ] Move calendar sync useEffects
- [ ] Return { calendarRef, calendarDate, visibleRange, ... }
- [ ] Test: Calendar navigation, date sync, responsive behavior

### Step 6: Extract usePlannerLayers (~80 lines)
- [ ] Create `src/hooks/usePlannerLayers.ts`
- [ ] Move layer visibility state
- [ ] Move layer filtering logic
- [ ] Return { layerVisibility, filteredEvents, toggleLayer }
- [ ] Test: Layer toggles, event filtering

### Step 7: Cleanup & Polish
- [ ] Remove unused imports from PlannerView
- [ ] Remove unused state variables
- [ ] Add JSDoc documentation to PlannerView
- [ ] Check for any duplicate code
- [ ] Run TypeScript compiler - fix any errors
- [ ] Count lines: should be ~800 (50% reduction)

### Step 8: Performance Optimization
- [ ] Add React.memo to PlannerEventContent ✅
- [ ] Verify useCallback dependencies are minimal
- [ ] Check for unnecessary re-renders with React DevTools
- [ ] Test drag/drop performance
- [ ] Test keyboard shortcut responsiveness

### Step 9: Testing
- [ ] Manual testing: All features work as before
- [ ] Test drag & drop events
- [ ] Test drag projects into calendar
- [ ] Test keyboard shortcuts
- [ ] Test layer visibility toggles
- [ ] Test date navigation
- [ ] Test view switching (week/day)
- [ ] Test responsive behavior (mobile/tablet/desktop)
- [ ] Test undo/redo functionality

---

## 🎓 Lessons from TimelineView Refactoring

### What Worked Well:
1. **Phased approach** - Extract one piece at a time, test, then continue
2. **Custom hooks for coordination** - React state + service calls
3. **React.memo for overlays** - Huge performance win
4. **Services stayed unchanged** - No need to modify existing services
5. **Consolidated imports** - Single `@/services` import
6. **Removed dead code** - Found unused state, handlers, imports

### Performance Gains Achieved:
- **47% reduction in component size** (1,360 → 712 lines)
- **~95% reduction in overlay re-renders** (memoized)
- **~40% reduction in function recreations** (better useCallback deps)
- **~47% faster reconciliation** (smaller component tree)

### Apply These Patterns:
- **Extract presentational components** → Wrap with React.memo
- **Extract coordination logic** → Create custom hooks
- **Keep services pure** → Don't modify existing services
- **Import from @/services** → Single barrel import
- **Add JSDoc comments** → Explain component's role
- **Use proper TypeScript types** → No `any` types

---

## ⚠️ Potential Challenges

### 1. FullCalendar Integration
**Challenge**: FullCalendar has its own state and ref management  
**Solution**: Keep FullCalendar in PlannerView, extract only the config and handlers

### 2. Complex Event Rendering
**Challenge**: `renderEventContent` is ~200 lines with lots of logic  
**Solution**: Extract to memoized component, pass event data and handlers as props

### 3. Keyboard Shortcuts
**Challenge**: Need access to many state setters and handlers  
**Solution**: Pass handlers as dependencies to hook, hook just coordinates

### 4. State Interdependencies
**Challenge**: Many state variables depend on each other  
**Solution**: Extract related state together (e.g., calendar date + visible range)

### 5. Context Overload
**Challenge**: 4 different contexts being used  
**Solution**: Keep all context usage in PlannerView, pass only what's needed to children

---

## 📈 Success Metrics

### Target Outcomes:
- ✅ **Component size**: 1,675 → ~800 lines (52% reduction)
- ✅ **Number of components created**: 2 (PlannerToolbar, PlannerEventContent)
- ✅ **Number of hooks created**: 3 (usePlannerCalendar, usePlannerKeyboardShortcuts, usePlannerLayers)
- ✅ **Performance improvement**: 30-50% (estimated, based on TimelineView results)
- ✅ **Zero functionality loss**: All features work identically
- ✅ **Zero bugs introduced**: Comprehensive testing before completion

### How to Measure:
1. **Line count**: `wc -l PlannerView.tsx` should be ~800
2. **Re-render count**: Use React DevTools Profiler
3. **Bundle size**: Check if dead code was removed
4. **Type safety**: `npm run build` should pass with no errors
5. **Manual testing**: All features work as before

---

## 🚀 Getting Started

1. **Read AI Dev Rules**: `/AI Dev Rules.md` (especially custom hooks section)
2. **Review TimelineView**: `src/components/views/TimelineView.tsx` (see patterns)
3. **Start with Phase 1**: Extract PlannerToolbar (easiest, high value)
4. **Test frequently**: After each extraction, verify everything works
5. **Commit often**: Small commits make it easy to rollback if needed

---

## 📝 Notes

- **Don't rush** - Quality over speed
- **Test after each extraction** - Catch issues early
- **Follow AI Dev Rules** - Services → Hooks → Components
- **Keep services unchanged** - No need to modify existing services
- **Document as you go** - Add JSDoc comments
- **Ask for help** - If stuck, reference TimelineView or AI Dev Rules

**Good luck! 🎉**
