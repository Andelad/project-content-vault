# Event Categories Feature Implementation Guide

**Date:** November 1, 2025  
**Status:** Implementation Complete, Migration Pending  
**Purpose:** Add event categories (event, habit, task) with unified modal interface  
**Architecture:** Category-based approach using `category` field with single modal for all types

---

## Overview

This document describes the implementation of event categories in the planner view. The system now supports three event types:

- **Events:** Standard calendar events with project assignment, duration, and colored blocks
- **Habits:** Brown-colored events with croissant icon, no project assignment, separate layer
- **Tasks:** Checkbox-only items with no duration or colored block, just start time

### Design Approach

The implementation uses a **unified modal with category tabs** instead of separate modals. Key design decisions:

- **Single Modal:** One EventModal with tab selector for all three types
- **Category Field:** VARCHAR discriminator instead of multiple boolean flags
- **Conditional Rendering:** UI elements show/hide based on selected category
- **Flexibility:** Easy to add new categories without schema changes
- **Type Safety:** Union types provide better TypeScript support than booleans

---

## What Was Changed

### 1. Database Schema
**File:** `supabase/migrations/20251031000000_add_habits_support.sql` (NEW)

Added `category` VARCHAR column to the `calendar_events` table to categorize different event types.

```sql
ALTER TABLE public.calendar_events 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'event' 
CHECK (category IN ('event', 'habit', 'task'));

CREATE INDEX IF NOT EXISTS idx_calendar_events_category 
ON public.calendar_events(category) WHERE category != 'event';

COMMENT ON COLUMN public.calendar_events.category IS 
'Event category: event (default), habit (separate layer, no project assignment), task (checkbox only), or future types';
```

**Key Design Points:**
- Default value `'event'` ensures backward compatibility
- CHECK constraint validates only allowed categories: 'event', 'habit', 'task'
- Partial index excludes default 'event' category for efficiency
- Comment documents intended usage and extensibility

**To Complete:** Run migration via Supabase dashboard or CLI (see `SUPABASE_MIGRATION_PLAN.md`).

---

### 2. Unified EventModal with Category Tabs

**File:** `src/components/modals/EventModal.tsx`

The EventModal was redesigned to handle all three event types through a single unified interface.

#### Tab Selector (Lines 546-576)
Added a ToggleGroup tab selector with three icons:
- **Calendar icon** (CalendarDays) - for events
- **Croissant icon** (Croissant) - for habits  
- **Checkbox icon** (Square) - for tasks

```typescript
<ToggleGroup 
  type="single" 
  value={category} 
  onValueChange={(value) => {
    if (value) {
      const newCategory = value as 'event' | 'habit' | 'task';
      setCategory(newCategory);
      setFormData(prev => ({ ...prev, category: newCategory }));
    }
  }}
>
  <ToggleGroupItem value="event" aria-label="Event">
    <CalendarDays className="w-5 h-5" />
  </ToggleGroupItem>
  <ToggleGroupItem value="habit" aria-label="Habit">
    <Croissant className="w-5 h-5" />
  </ToggleGroupItem>
  <ToggleGroupItem value="task" aria-label="Task">
    <Square className="w-5 h-5" />
  </ToggleGroupItem>
</ToggleGroup>
```

#### Dynamic Modal Title (Lines 521-524)
Title changes based on selected category:
```typescript
title={isEditing 
  ? `Edit ${category.charAt(0).toUpperCase() + category.slice(1)}` 
  : `Create ${category.charAt(0).toUpperCase() + category.slice(1)}`
}
```

#### Conditional Rendering
Fields show/hide based on category:

**Project Selector** (Lines 590-610) - Only for events:
```typescript
{category === 'event' && (
  <ProjectSearchInput ... />
)}
```

**End Time** (Lines 644-670) - Hidden for tasks:
```typescript
{category !== 'task' && (
  <div className="space-y-1.5">
    <Label htmlFor="endTime">End Time *</Label>
    <Input id="endTime" type="time" ... />
  </div>
)}
```

**Duration Display** (Lines 698-705) - Hidden for tasks:
```typescript
{category !== 'task' && formData.startDate && formData.startTime && formData.endTime && (
  <div>Duration: {formatDuration(...)}</div>
)}
```

#### State Management
Two-state pattern for clean UI code:
- `category` state: Controls conditional rendering
- `formData.category`: Synced value that gets submitted

Both are kept in sync via the tab selector's `onValueChange` handler.

**Key Benefits:**
- ✅ Single modal reduces code duplication
- ✅ Tab selector provides clear visual feedback
- ✅ Conditional rendering keeps UI clean
- ✅ Easy to add new categories in future
- ✅ Maintains separation between UI state and form data

---

### 3. TypeScript Types

#### File: `src/types/core.ts`
**Lines Changed:** 114-140

**What Changed:**
- Added `category?: 'event' | 'habit'` field to `CalendarEvent` interface

**Original:**
```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  projectId?: string;
  color: string;
  completed?: boolean;
  description?: string;
  duration?: number;
  type?: 'planned' | 'tracked' | 'completed';
  recurring?: { /* ... */ };
  originalEventId?: string;
  isSplitEvent?: boolean;
}
```

**Modified:**
```typescript
export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  projectId?: string;
  color: string;
  completed?: boolean;
  description?: string;
  duration?: number;
  type?: 'planned' | 'tracked' | 'completed';
  category?: 'event' | 'habit' | 'task'; // NEW LINE - Event category
  recurring?: { /* ... */ };
  originalEventId?: string;
  isSplitEvent?: boolean;
}
```

**Note:** The `type` field remains for temporal state ('planned'|'tracked'|'completed'), while `category` distinguishes event types ('event'|'habit').

---

#### File: `src/integrations/supabase/types.ts`
**Lines Changed:** 65-140

**What Changed:**
- Added `category: string | null` to `calendar_events` Row, Insert, and Update types

**Changes in Row:**
```typescript
Row: {
  // ... existing fields ...
  category: string | null  // NEW LINE
  project_id: string | null
  // ... remaining fields ...
}
```

**Changes in Insert:**
```typescript
Insert: {
  // ... existing fields ...
  category?: string | null  // NEW LINE
  project_id?: string | null
  // ... remaining fields ...
}
```

**Changes in Update:**
```typescript
Update: {
  // ... existing fields ...
  category?: string | null  // NEW LINE
  project_id?: string | null
  // ... remaining fields ...
}
```

---

### 3. New Habits Hook

**File:** `src/hooks/useHabits.ts` (NEW - 245 lines)

Complete CRUD hook for habits with:
- `fetchHabits()` - Filters `calendar_events` where `category = 'habit'`
- `addHabit()` - Creates habits with `category: 'habit'`, brown color, no project assignment
- `updateHabit()` - Updates habits while preserving habit constraints (`category: 'habit'`)
- `deleteHabit()` - Deletes habits with safety check (`category = 'habit'`)
- Real-time subscriptions for cross-window sync

**Key Filtering Logic:**
```typescript
// Fetch habits
.eq('category', 'habit')

// Create habit
{ category: 'habit', project_id: null, color: HABIT_BROWN_COLOR }

// Update habit (preserve category)
{ ...updates, category: 'habit', project_id: null }

// Delete habit (safety check)
.eq('category', 'habit')
```

**Key Constants:**
```typescript
const HABIT_BROWN_COLOR = '#8B4513';
```

---

### 4. Habits Export

**File:** `src/hooks/index.ts`
**Lines Changed:** 8

**Added:**
```typescript
export * from './useHabits';  // NEW LINE (between useGroups and useHolidays)
```

---

### 5. Icon Constants

**File:** `src/constants/icons.ts`
**Lines Changed:** 1-5

**What Changed:**
- Added `Croissant` to lucide-react imports
- Exported `HABIT_ICON` constant

**Original:**
```typescript
import {
  Folder, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe, Infinity
} from 'lucide-react';
```

**Modified:**
```typescript
import {
  Folder, Briefcase, Zap, Target, Lightbulb, Rocket, Star, Heart, Gift, Music, Camera, Code, Book, Gamepad2, Coffee, Home, Building, Car, Plane, Map, Globe, Infinity, Croissant
} from 'lucide-react';

// Habit icon constant
export const HABIT_ICON = Croissant;
```

---

### 6. Habit Modal Component

**File:** `src/components/modals/HabitModal.tsx` (NEW - 622 lines)

Complete modal for creating/editing habits:
- No project selection (major difference from EventModal)
- Croissant icon indicator in header
- All event features: recurring, completion, notes, delete
- Brown color theme throughout

---

### 7. Planner Context Updates

**File:** `src/contexts/PlannerContext.tsx`

#### Import Changes (Line 4):
```typescript
import { useHabits } from '@/hooks/useHabits';  // NEW
```

#### Interface Changes (Lines 17-27):
**Added to PlannerContextType:**
```typescript
// Habits
habits: any[];
isHabitsLoading: boolean;
addHabit: (habit: any) => Promise<any>;
updateHabit: (id: string, updates: any, options?: { silent?: boolean }) => Promise<any>;
deleteHabit: (id: string, options?: { silent?: boolean }) => Promise<void>;
creatingNewHabit: { startTime?: Date; endTime?: Date } | null;
setCreatingNewHabit: (times: { startTime: Date; endTime: Date } | null) => void;
```

#### Hook Initialization (Lines 84-89):
```typescript
const {
  habits: dbHabits,
  loading: habitsLoading,
  addHabit: dbAddHabit,
  updateHabit: dbUpdateHabit,
  deleteHabit: dbDeleteHabit
} = useHabits();  // NEW
```

#### State Addition (Line 102):
```typescript
const [creatingNewHabit, setCreatingNewHabit] = useState<{ startTime?: Date; endTime?: Date } | null>(null);  // NEW
```

#### FullCalendar Integration (Lines 563, 573):
```typescript
// In fullCalendarEvents useMemo:
{ habits: dbHabits }  // NEW option passed

// In getStyledFullCalendarEvents:
{ ...options, habits: dbHabits }  // NEW option passed
```

#### Context Value (Lines 635-641):
```typescript
// Habits
habits: dbHabits || [],
isHabitsLoading: habitsLoading,
addHabit: dbAddHabit,
updateHabit: dbUpdateHabit,
deleteHabit: dbDeleteHabit,
creatingNewHabit,
setCreatingNewHabit,
```

---

### 8. Planner Calculation Service

**File:** `src/services/calculations/insights/plannerInsights.ts`
**Lines Changed:** 47-82

**What Changed:**
Modified `prepareEventsForFullCalendar` to:
1. Accept `habits` in options parameter
2. Filter out habits from regular events (skip if `event.category === 'habit'`)
3. Add dedicated habits rendering section with brown color and special className

**Modified Function Signature:**
```typescript
static prepareEventsForFullCalendar(
  events: CalendarEvent[], 
  workHours: WorkHour[],
  layerMode: 'events' | 'work-hours' | 'both' = 'both',
  options: { selectedEventId?: string | null; projects?: any[]; habits?: any[] } = {}  // Added habits
): EventInput[]
```

**New Habits Rendering Section:**
```typescript
// Add habits (always shown, rendered between events and work hours)
if (habits && habits.length > 0) {
  habits.forEach((habit: any) => {
    const fcEvent = {
      id: habit.id,
      title: habit.title,
      start: habit.start_time,
      end: habit.end_time,
      backgroundColor: habit.color || '#8B4513',
      borderColor: habit.color || '#8B4513',
      textColor: '#ffffff',
      extendedProps: {
        category: 'habit',
        completed: habit.completed || false,
        description: habit.description || '',
        originalHabit: habit
      },
      className: 'habit-event'
    };
    fcEvents.push(fcEvent);
  });
}
```

---

### 9. Planner View Updates

**File:** `src/components/views/PlannerView.tsx`

#### Imports (Lines 12-13, 26):
```typescript
import { ChevronLeft, ChevronRight, MapPin, CalendarSearch, Plus } from 'lucide-react';
import { HABIT_ICON } from '@/constants/icons';
// ...
const HabitModal = React.lazy(() => import('../modals/HabitModal').then(module => ({ default: module.HabitModal })));
```

#### Context Destructuring (Lines 42-46, 53-54):
```typescript
const { 
  events,
  isEventsLoading,
  habits,              // NEW
  isHabitsLoading,     // NEW
  updateHabit,         // NEW
  // ... existing fields ...
  setCreatingNewHabit, // NEW
  creatingNewHabit,    // NEW
} = usePlannerContext();
```

#### Event Click Handler (Lines 148-164):
**Added habit click handling:**
```typescript
// Handle habit clicks - open habit modal
if (info.event.extendedProps.category === 'habit') {
  setCreatingNewHabit({
    startTime: info.event.start,
    endTime: info.event.end
  });
  (window as any).__editingHabitId = info.event.id;
  return;
}
```

#### Event Drop Handler (Lines 175-195):
**Added habit drag/drop handling:**
```typescript
// Handle habit drag/drop
if (extendedProps.category === 'habit') {
  const newStart = dropInfo.event.start;
  const newEnd = dropInfo.event.end;
  
  if (!newStart || !newEnd) {
    dropInfo.revert();
    return;
  }
  
  try {
    await updateHabit(eventId, {
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString()
    }, { silent: true });
  } catch (error) {
    console.error('Failed to update habit:', error);
    dropInfo.revert();
  }
  return;
}
```

#### Event Resize Handler (Lines 270-290):
**Added habit resize handling:**
```typescript
// Handle habit resize
if (extendedProps.category === 'habit') {
  const newStart = resizeInfo.event.start;
  const newEnd = resizeInfo.event.end;
  
  if (!newStart || !newEnd) {
    resizeInfo.revert();
    return;
  }
  
  try {
    await updateHabit(eventId, {
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString()
    }, { silent: true });
  } catch (error) {
    console.error('Failed to resize habit:', error);
    resizeInfo.revert();
  }
  return;
}
```

#### Event Content Renderer (Lines 525-641):
**Added habit rendering with croissant icon:**
```typescript
// Render habits with croissant icon
if (extendedProps.category === 'habit') {
  const start = moment(event.start).format('HH:mm');
  const end = moment(event.end).format('HH:mm');
  const isCompleted = extendedProps.completed;
  
  // Croissant SVG icon
  const croissantSvg = '<svg width="14" height="14" viewBox="0 0 24 24"...>';
  
  // Check icon for completion
  const checkIconSvg = isCompleted ? '...' : '...';
  
  const iconHtml = `<button... onclick="...plannerToggleHabitCompletion('${event.id}')">...`;
  
  // Layout based on height
  return { html: `...` };
}
```

#### Completion Toggle Handlers (Lines 717-740):
**Added habit completion toggle:**
```typescript
// Handle completion toggle for habits
const handleHabitCompletionToggle = useCallback(async (habitId: string) => {
  try {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    await updateHabit(habitId, { completed: !habit.completed }, { silent: true });
  } catch (error) {
    console.error('Failed to toggle habit completion:', error);
  }
}, [habits, updateHabit]);

// Set up global completion toggle functions
useEffect(() => {
  (window as any).plannerToggleCompletion = handleCompletionToggle;
  (window as any).plannerToggleHabitCompletion = handleHabitCompletionToggle;  // NEW
  return () => {
    delete (window as any).plannerToggleCompletion;
    delete (window as any).plannerToggleHabitCompletion;  // NEW
  };
}, [handleCompletionToggle, handleHabitCompletionToggle]);
```

#### Add Habit Button (Lines 1378-1387):
**Added button in toolbar:**
```typescript
<Button 
  variant="outline" 
  onClick={() => setCreatingNewHabit({ startTime: new Date(), endTime: new Date(Date.now() + 60*60*1000) })} 
  className="h-9 gap-2"
  style={{ color: '#8B4513', borderColor: '#8B4513' }}
>
  {React.createElement(HABIT_ICON, { className: "w-4 h-4" })}
  <Plus className="w-3 h-3" />
</Button>
```

#### Habit Modal (Lines 1496-1505):
**Added modal rendering:**
```typescript
<HabitModal
  isOpen={!!creatingNewHabit}
  onClose={() => {
    setCreatingNewHabit(null);
    delete (window as any).__editingHabitId;
  }}
  habitId={(window as any).__editingHabitId}
  defaultStartTime={creatingNewHabit?.startTime}
  defaultEndTime={creatingNewHabit?.endTime}
/>
```

---

### 10. CSS Styling

**File:** `src/components/planner/fullcalendar-overrides.css`
**Lines Added:** 511-536

**New Styles:**
```css
/* Habit Event Styles */
.habit-event {
  opacity: 0.95 !important;
  border-left-width: 3px !important;
  cursor: pointer;
}

.habit-event:hover {
  opacity: 1 !important;
  transform: scale(1.02);
  transition: all 0.15s ease;
  z-index: 10 !important;
}

.habit-event .fc-event-main {
  color: white !important;
}

/* Ensure habits render between events and work hours */
.habit-event {
  z-index: 5 !important; /* Below events (10) but above work hours (1) */
}
```

---

## How to Complete the Implementation

### Step 1: Apply Database Migration
When Docker Desktop is running:

```bash
cd /Users/andyjohnston/project-content-vault
npx supabase db reset
```

This will:
- Apply all migrations including the new `category` column
- Create the partial index for efficient category queries
- Reset your local development database

**Alternative (Production):**
If you need to apply only the habits migration without resetting:
```bash
npx supabase db push
```

### Step 2: Test the Feature
1. Start the development server
2. Navigate to the Planner view
3. Click the brown croissant + plus button
4. Create a habit (e.g., "Morning meditation")
5. Test interactions:
   - Drag to reschedule
   - Resize to change duration
   - Click to edit
   - Toggle completion
   - Create recurring habits

---

## How to Roll Back All Changes

If you need to completely remove the habits feature, follow these steps in order:

### 1. Remove Database Migration
**Delete file:**
```bash
rm supabase/migrations/20251031000000_add_habits_support.sql
```

### 2. Revert TypeScript Core Types
**File:** `src/types/core.ts` (Line 124)

**Remove this line:**
```typescript
  category?: 'event' | 'habit'; // Event category: 'event' (default) or 'habit' (separate layer, no project assignment)
```

### 3. Revert Supabase Types
**File:** `src/integrations/supabase/types.ts`

**In Row (around line 79):**
Remove: `category: string | null`

**In Insert (around line 106):**
Remove: `category?: string | null`

**In Update (around line 132):**
Remove: `category?: string | null`

### 4. Delete Habits Hook
**Delete file:**
```bash
rm src/hooks/useHabits.ts
```

### 5. Remove Habits Export
**File:** `src/hooks/index.ts` (Line 8)

**Remove:**
```typescript
export * from './useHabits';
```

### 6. Revert Icon Constants
**File:** `src/constants/icons.ts`

**Line 3:** Remove `Croissant` from imports
**Lines 5-6:** Remove:
```typescript
// Habit icon constant
export const HABIT_ICON = Croissant;
```

### 7. Delete Habit Modal
**Delete file:**
```bash
rm src/components/modals/HabitModal.tsx
```

### 8. Revert Planner Context
**File:** `src/contexts/PlannerContext.tsx`

**Line 4:** Remove `import { useHabits } from '@/hooks/useHabits';`

**Lines 17-27:** Remove habits-related interface properties:
```typescript
// Habits
habits: any[];
isHabitsLoading: boolean;
addHabit: (habit: any) => Promise<any>;
updateHabit: (id: string, updates: any, options?: { silent?: boolean }) => Promise<any>;
deleteHabit: (id: string, options?: { silent?: boolean }) => Promise<void>;
creatingNewHabit: { startTime?: Date; endTime?: Date } | null;
setCreatingNewHabit: (times: { startTime: Date; endTime: Date } | null) => void;
```

**Lines 84-89:** Remove habits hook initialization

**Line 102:** Remove `const [creatingNewHabit, setCreatingNewHabit] = useState...`

**Lines 563, 573:** Remove `habits: dbHabits` from options

**Lines 635-641:** Remove habits from context value

### 9. Revert Planner Calculation Service
**File:** `src/services/calculations/insights/plannerInsights.ts`

**Line 51:** Remove `habits?: any[]` from options parameter

**Lines 54:** Remove `, habits = []` from destructuring

**Lines 58-60:** Remove the check:
```typescript
// Skip habits - they're rendered separately
if (event.category === 'habit') return;
```

**Lines 67-86:** Remove entire habits rendering block:
```typescript
// Add habits (always shown, rendered between events and work hours)
if (habits && habits.length > 0) {
  // ... entire block
}
```

### 10. Revert Planner View
**File:** `src/components/views/PlannerView.tsx`

**Line 12:** Remove `, Plus` from lucide-react imports
**Line 13:** Remove `import { HABIT_ICON } from '@/constants/icons';`
**Line 26:** Remove HabitModal lazy import

**Lines 44-46, 53-54:** Remove habits-related context destructuring

**Lines 157-164:** Remove habit click handling

**Lines 177-195:** Remove habit drag/drop handling

**Lines 272-290:** Remove habit resize handling

**Lines 527-641:** Remove habit rendering section (starts with `// Render habits with croissant icon`)

**Lines 719-733:** Remove `handleHabitCompletionToggle` function

**Line 738:** Remove `plannerToggleHabitCompletion` setup

**Lines 1380-1387:** Remove "Add Habit" button

**Lines 1498-1507:** Remove HabitModal component

### 11. Revert CSS
**File:** `src/components/planner/fullcalendar-overrides.css`

**Remove lines 513-536** (entire "Habit Event Styles" section)

### 12. Clean Up Database (if migration was applied)
If you already ran the migration, remove the column:

```sql
ALTER TABLE public.calendar_events DROP COLUMN IF EXISTS category;
DROP INDEX IF EXISTS idx_calendar_events_category;
```

---

## Summary of Files

### New Files (Delete to roll back):
1. `supabase/migrations/20251031000000_add_habits_support.sql`
2. `src/hooks/useHabits.ts`
3. `src/components/modals/HabitModal.tsx`

### Modified Files (Revert changes):
1. `src/types/core.ts`
2. `src/integrations/supabase/types.ts`
3. `src/hooks/index.ts`
4. `src/constants/icons.ts`
5. `src/contexts/PlannerContext.tsx`
6. `src/services/calculations/insights/plannerInsights.ts`
7. `src/components/views/PlannerView.tsx`
8. `src/components/planner/fullcalendar-overrides.css`

---

## Testing Checklist

After completing or rolling back:

- [ ] TypeScript compiles without errors
- [ ] Database migration applies successfully
- [ ] Planner view loads without errors
- [ ] Can create habits (if keeping feature)
- [ ] Can edit habits (if keeping feature)
- [ ] Can delete habits (if keeping feature)
- [ ] Drag and drop works (if keeping feature)
- [ ] Resize works (if keeping feature)
- [ ] Completion toggle works (if keeping feature)
- [ ] Recurring habits work (if keeping feature)
- [ ] Regular events still work normally
- [ ] Work hours still work normally
- [ ] No console errors

---

## Notes

### Architecture
- **Category-based design:** Uses `category` field instead of boolean flag for better extensibility
- **Same table storage:** Habits stored in `calendar_events` table, filtered by `category = 'habit'`
- **Type safety:** TypeScript union type `'event' | 'habit'` provides compile-time validation
- **Future-proof:** Easy to add new categories (e.g., 'reminder', 'goal') without schema changes

### Styling
- Habits always render in brown (#8B4513) regardless of any color settings
- Z-index layering: Events (10) > Habits (5) > Work Hours (1)
- Croissant icon distinguishes habits visually from events

### Constraints
- Habits cannot be assigned to projects (enforced in useHabits hook and HabitModal)
- Category field defaults to 'event' for backward compatibility
- All event features (recurring, completion, drag/drop, resize) work with habits

### Benefits Over Boolean Approach
1. **Removability:** Category field can be removed without affecting core functionality
2. **Scalability:** Single discriminator field vs multiple boolean columns
3. **Filtering:** Cleaner query logic (`category = 'habit'` vs `is_habit = true`)
4. **View Logic:** Easy to create category-specific views or hide entire categories
5. **Calculations:** Simple to filter by category in analytics and insights
