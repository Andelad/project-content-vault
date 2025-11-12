# Work Hours Infinite Recurrence Implementation

## Overview

Work hours now function similarly to RRULE-based recurring events. They are generated infinitely from a weekly pattern stored in settings, with support for individual day exceptions.

## Architecture

### Pattern Storage (Base Schedule)
- **Location**: `settings.weekly_work_hours` (JSONB in Supabase)
- **Structure**: Day-based slots (e.g., Monday: [09:00-17:00, 18:00-20:00])
- **Scope**: Defines the recurring pattern for all future days

### Exception Storage (Individual Day Overrides)
- **Table**: `work_hour_exceptions`
- **Purpose**: Store modifications or deletions for specific dates
- **Types**:
  - `deleted`: Work hour removed for a specific day
  - `modified`: Work hour times changed for a specific day

## Data Flow

### Generating Work Hours for Display

```typescript
1. Fetch settings.weekly_work_hours (pattern)
2. Generate work hours for visible date range based on pattern
3. Fetch exceptions from database for date range
4. Apply exceptions to generated work hours
   - Filter out deleted exceptions
   - Replace times for modified exceptions
5. Display final work hours in calendar
```

### Editing Work Hours

#### From Planner (Individual Days)
1. User drags/resizes work hour
2. System shows `WorkHourScopeDialog`:
   - **"Just this day"**: Creates exception in database
   - **"All future days"**: Updates pattern in settings
3. Calendar refreshes with new data

#### From Settings (Pattern Updates)
1. User modifies work hours in Settings → Work Hours
2. Changes update `settings.weekly_work_hours` directly
3. Affects all future occurrences (except where exceptions exist)
4. Existing exceptions are preserved

## Database Schema

### work_hour_exceptions Table

```sql
CREATE TABLE work_hour_exceptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  exception_date DATE NOT NULL,
  day_of_week TEXT NOT NULL,  -- monday, tuesday, etc.
  slot_id TEXT NOT NULL,       -- WorkSlot ID from settings
  exception_type TEXT NOT NULL, -- 'deleted' | 'modified'
  modified_start_time TEXT,    -- HH:MM format if modified
  modified_end_time TEXT,      -- HH:MM format if modified
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  
  UNIQUE(user_id, exception_date, slot_id)
);
```

## Key Services

### UnifiedWorkHourRecurrenceService
- `createWorkHourException()`: Create exception for specific date
- `getWorkHourExceptions()`: Fetch exceptions for date range
- `updateWorkHourForDate()`: Create modified exception
- `deleteWorkHourForDate()`: Create deleted exception
- `applyExceptionsToWorkHours()`: Apply exceptions to generated work hours

### useWorkHours Hook
- Manages work hours state and exceptions
- Shows scope dialog for edit/delete operations
- Scope options: `'this-day'` | `'all-future'`

### WorkHourCalculationService
- `generateWorkHoursFromSettings()`: Generate work hours from weekly pattern
- `canModifyWorkHour()`: Check if work hour can be edited (not in past)

## User Experience

### Viewing Work Hours
- Work hours display infinitely based on weekly pattern
- Exceptions automatically applied per day
- Visual indicator: Italic text for work hour events

### Editing Individual Days
1. Drag or resize work hour in planner
2. Dialog appears: "Just this day" or "All future days"
3. Choose "Just this day":
   - Exception created in database
   - Only that specific date is affected
   - Weekly pattern unchanged
4. Choose "All future days":
   - Settings pattern updated
   - All future occurrences affected (except existing exceptions)

### Editing Pattern (Settings)
1. Go to Settings → Work Hours
2. Modify work slots (add, edit, delete)
3. Changes immediately affect all future days
4. Exceptions remain untouched

### Deleting Work Hours
- **From Planner**: Show dialog with "Just this day" or note to use Settings
- **From Settings**: Removes from weekly pattern (affects all future days)

## Components

### WorkHourScopeDialog
```tsx
<WorkHourScopeDialog
  isOpen={showWorkHourScopeDialog}
  onClose={cancelWorkHourChange}
  onThisDay={() => confirmWorkHourChange('this-day')}
  onAllFuture={() => confirmWorkHourChange('all-future')}
  action="update" | "delete" | "add"
  workHourDate="Monday, Nov 12, 2025"
/>
```

## Type Definitions

### WorkHour
```typescript
interface WorkHour {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  dayOfWeek?: string;     // NEW: Pattern day (monday, tuesday, etc.)
  slotId?: string;        // NEW: Reference to WorkSlot ID
  isException?: boolean;  // NEW: True if this is an exception
}
```

### WorkHourException
```typescript
interface WorkHourException {
  id: string;
  userId: string;
  exceptionDate: Date;
  dayOfWeek: string;
  slotId: string;
  exceptionType: 'deleted' | 'modified';
  modifiedStartTime?: string;  // HH:MM
  modifiedEndTime?: string;    // HH:MM
  createdAt: Date;
  updatedAt: Date;
}
```

## Implementation Checklist

- [x] Created `work_hour_exceptions` table
- [x] Updated `WorkHour` type with recurrence fields
- [x] Created `UnifiedWorkHourRecurrenceService`
- [x] Updated `useWorkHours` hook for exceptions
- [x] Created `WorkHourScopeDialog` component
- [x] Integrated dialog into PlannerView
- [ ] Updated Settings view to handle pattern updates
- [ ] Tested end-to-end functionality
- [ ] Run database migration

## Migration Steps

### 1. Run Supabase Migration
```bash
# Migration file: 20251112140000_add_work_hour_exceptions.sql
# Run via Supabase CLI or dashboard
```

### 2. Test Workflow
1. Set work hours in Settings (e.g., Mon-Fri 9-5)
2. Verify they appear in planner for all visible weeks
3. Edit a work hour in planner → Choose "Just this day"
4. Verify exception is created and only that day is affected
5. Edit work hours in Settings
6. Verify pattern updates affect future days but preserve exceptions

## Benefits

### For Users
- ✅ Work hours display infinitely (no manual setup per week)
- ✅ Can customize individual days when needed
- ✅ Simple pattern management in Settings
- ✅ Flexible: Both routine and exception handling

### For System
- ✅ Minimal database storage (pattern + exceptions only)
- ✅ Scales infinitely without performance issues
- ✅ Follows proven RRULE pattern architecture
- ✅ Consistent with recurring events implementation
- ✅ Leverages FullCalendar's capabilities

## Future Enhancements

- [ ] Batch exception operations (e.g., remove all exceptions after date)
- [ ] Visual indicator for days with exceptions
- [ ] Exception history/audit log
- [ ] Import/export work patterns
- [ ] Multiple work hour patterns (e.g., summer vs winter schedule)

## Related Files

- `/src/hooks/useWorkHours.ts` - Work hours hook with exception support
- `/src/services/unified/UnifiedWorkHourRecurrenceService.ts` - Exception service
- `/src/services/calculations/availability/workHourGeneration.ts` - Pattern generation
- `/src/components/modals/WorkHourScopeDialog.tsx` - Scope selection dialog
- `/src/components/views/PlannerView.tsx` - Calendar integration
- `/src/components/views/SettingsView.tsx` - Pattern management
- `/supabase/migrations/20251112140000_add_work_hour_exceptions.sql` - Database schema

## Troubleshooting

### Work hours not displaying
- Check `settings.weekly_work_hours` has data
- Verify `useWorkHours` hook is fetching correctly
- Check browser console for errors

### Exceptions not applying
- Verify exception was created in database
- Check exception date matches work hour date
- Ensure slotId matches between exception and pattern

### Scope dialog not showing
- Check `showWorkHourScopeDialog` state in PlannerContext
- Verify `WorkHourScopeDialog` is rendered in PlannerView
- Check `updateWorkHour` is being called correctly
