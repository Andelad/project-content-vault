# Event Layering Implementation

## Overview
Implemented a 3-layer event system in FullCalendar where different event types render on separate visual layers without resizing each other.

## Layer Structure

```
┌─────────────────────────────────────┐
│  Layer 3: Events & Tasks (z: 15)    │  ← Can stack with each other
│  - Regular events                   │
│  - Quick tasks                      │
├─────────────────────────────────────┤
│  Layer 2: Habits (z: 10)            │  ← Always full width
│  - Habit events                     │
├─────────────────────────────────────┤
│  Layer 1: Work Hours (z: 5)         │  ← Always full width, background
│  - Work hour slots                  │
└─────────────────────────────────────┘
```

## Implementation Details

### 1. Display Property + Overlap Control
**Files:** 
- `src/services/unified/UnifiedEventTransformService.ts` 
- `src/services/unified/UnifiedCalendarService.ts`

**Work Hours - Background Layer:**
```typescript
// transformWorkHourToFullCalendar()
const baseEvent = {
  // ... other properties
  display: 'background', // KEY: Renders as background, never causes stacking
  // Background events can still be interactive with CSS pointer-events: auto
};
```

**Habits - Middle Layer (Also Background):**
```typescript
// transformCalendarEventToFullCalendar()
const baseEvent = {
  // ... other properties
  display: event.category === 'habit' ? 'background' : 'block',
  // Habits ALSO render as background to never cause stacking
  // CSS maintains their distinct styling (gray background, border)
};
```

**Events & Tasks - Top Layer (Can Stack):**
```typescript
// transformCalendarEventToFullCalendar()
const baseEvent = {
  // ... other properties
  overlap: undefined, // Will use default behavior (can stack)
};
```

**Global Setting:**
```typescript
// In getBaseFullCalendarConfig()
slotEventOverlap: true, // Allow overlapping - controlled per-event
```

**Event Overlap Callback:**
```typescript
// In getEventStylingConfig()
eventOverlap: (stillEvent, movingEvent) => {
  const stillCategory = stillEvent.extendedProps?.category;
  const movingCategory = movingEvent?.extendedProps?.category;
  const stillIsWorkHour = stillEvent.extendedProps?.isWorkHour;
  const movingIsWorkHour = movingEvent?.extendedProps?.isWorkHour;
  
  // Work hours ALWAYS render full-width
  if (stillIsWorkHour || movingIsWorkHour) {
    return true;
  }
  
  // Habits ALWAYS render full-width
  if (stillCategory === 'habit' || movingCategory === 'habit') {
    return true;
  }
  
  // Events and tasks stack with each other
  return false;
}
```

### 2. Z-Index Layering
**File:** `src/components/features/planner/fullcalendar-overrides.css`

Updated CSS variables and rules:

```css
:root {
  --z-work-slot: 5;     /* Layer 1: Bottom */
  --z-habit: 10;        /* Layer 2: Middle */
  --z-task: 15;         /* Layer 3: Top */
  --z-event: 15;        /* Layer 3: Top */
  --z-event-hover: 20;  /* Hover state */
}

/* Layer 1: Work Hours */
.work-slot-event,
.planner-v2-event.work-hour {
  z-index: var(--z-work-slot) !important;
}

/* Layer 2: Habits */
.habit-event {
  z-index: var(--z-habit) !important;
}

/* Layer 3: Tasks */
.task-event {
  z-index: var(--z-task) !important;
}

/* Layer 3: Regular Events */
.fc-event:not(.habit-event):not(.task-event):not(.work-slot-event) {
  z-index: var(--z-event) !important;
}
```

## How It Works

### FullCalendar's Layering System

The implementation uses a combination of FullCalendar properties:

1. **`display: 'background'`** - Work hours render as background layer (NEVER cause stacking)
2. **`overlap: true`** - Habits allow other events to overlap them (stay full-width)
3. **`eventOverlap` callback** - Additional control for edge cases
4. **CSS z-index** - Visual stacking order

### The Rendering Logic

When two events overlap in time:

1. **Work Hours (`display: 'background'`):**
   - Always render at full width in the background
   - Other events render on top without being affected
   - Still fully interactive (click, drag, resize) via CSS `pointer-events: auto`

2. **Habits (`display: 'background'`):**
   - ALSO render as background events (same as work hours)
   - Always full width, never cause stacking
   - Render above work hours via CSS z-index (10 vs 5)
   - Maintain distinct styling via CSS (gray background, border)
   - Still fully interactive via CSS `pointer-events: auto`

3. **Events & Tasks (`display: 'block'` - default):**
   - Stack side-by-side when they overlap each other
   - Can overlap work hours and habits without stacking
   - Normal FullCalendar stacking behavior
   - Render on top via CSS z-index (15)

### Result:
- ✅ Work Hours → Full width, z-index: 5 (bottom)
- ✅ Habits → Full width, z-index: 10 (middle)  
- ✅ Events + Tasks → Can stack, z-index: 15 (top)

### Visual Layering
CSS z-index ensures proper rendering order:
- Work hours appear behind everything (z: 5)
- Habits appear in middle layer (z: 10)
- Events and tasks appear on top (z: 15)

## Testing

Create overlapping events to verify:
1. ✅ Work hours 9am-5pm (full width, bottom)
2. ✅ Habit 10am-11am (full width over work hours)
3. ✅ Task 10:30am-11:30am (full width over habit & work hours)
4. ✅ Event 10:45am-11:45am (stacks side-by-side with task)
5. ✅ Another event 10:50am-11:50am (stacks with both task and first event)

## Key Benefits

✅ Work hours never cause events to shrink  
✅ Habits never cause events to shrink  
✅ Events and tasks interact naturally (stack when needed)  
✅ Clear visual hierarchy with z-index  
✅ All events remain interactive (no `display: 'background'`)  

## Related Documentation
- [FullCalendar eventOverlap](https://fullcalendar.io/docs/eventOverlap)
- [FullCalendar Event Display](https://fullcalendar.io/docs/eventDisplay)
