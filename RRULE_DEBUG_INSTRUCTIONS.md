# RRULE Events Debug Instructions for Lovable

## ⚠️ DEPRECATED - SEE RRULE_FIX_INSTRUCTIONS.md FOR SOLUTION

## Problem (SOLVED)
RRULE-based recurring events were showing "infinitely" because old pre-generated instances weren't deleted during migration.

**Solution:** Run the cleanup migration in `20251112120000_cleanup_legacy_recurring_instances.sql`

---

## Original Problem Description
RRULE-based recurring events are not showing into the future, even though the null date crash has been fixed.

## Step 1: Check Database for RRULE Data
First, verify if any events actually have RRULE data in the database:

```sql
-- Check for events with RRULE data
SELECT id, title, start_time, end_time, rrule, recurring_type, recurring_interval
FROM calendar_events
WHERE rrule IS NOT NULL
LIMIT 10;

-- Check for legacy recurring events that haven't been migrated
SELECT id, title, recurring_type, recurring_interval, recurring_end_date, recurring_count
FROM calendar_events
WHERE recurring_type IS NOT NULL AND rrule IS NULL
LIMIT 10;
```

## Step 2: Validate RRULE Format
Check the RRULE format. FullCalendar expects RFC 5545 compliant RRULE strings. The migration script generates formats like:
- `FREQ=DAILY;INTERVAL=1`
- `FREQ=WEEKLY;INTERVAL=1`

But FullCalendar might need additional parameters like `DTSTART`. Test with a simple RRULE and see if it expands.

## Step 3: Debug FullCalendar RRULE Processing
Add console logging to see what FullCalendar receives:

In `UnifiedEventTransformService.ts`, add logging before the RRULE assignment:
```typescript
// Add RRULE support for FullCalendar expansion
if (event.rrule) {
  console.log('RRULE event:', event.id, event.title, event.rrule);
}
```

In `PlannerView.tsx`, add logging in the `renderEventContent` function:
```typescript
const renderEventContent = useCallback((eventInfo: any) => {
  const event = eventInfo.event;
  console.log('Rendering event:', event.id, event.title, event.start, event.end, event.extendedProps.rrule);
  // ... rest of function
```

## Step 4: Check Event Filtering
Verify that RRULE events aren't being filtered out. Check the `PlannerContext.tsx` processedEvents logic and ensure RRULE events are included in date range queries.

## Step 5: Test RRULE Event Creation
Create a test RRULE event directly in the database to verify the full flow:

```sql
-- Insert a test daily recurring event
INSERT INTO calendar_events (
  id, title, start_time, end_time, rrule, category, user_id
) VALUES (
  gen_random_uuid(),
  'Test Daily Event',
  '2025-11-12 09:00:00+00',
  '2025-11-12 10:00:00+00',
  'FREQ=DAILY;INTERVAL=1',
  'event',
  '[USER_ID]'
);
```

## Step 6: Check FullCalendar Configuration
Verify the RRULE plugin is properly loaded. In the browser console, check:
```javascript
// After calendar loads, check if rrulePlugin is available
console.log('FullCalendar plugins:', calendar.getOption('plugins'));
```

## Potential Issues to Check:
1. **RRULE Format**: FullCalendar might need `DTSTART` parameter
2. **Date Range**: RRULE events might be filtered by date range logic
3. **Plugin Loading**: RRULE plugin might not be loading correctly
4. **Event Processing**: Events with RRULE might be processed differently

## Expected Behavior:
- Events with RRULE should show as recurring instances throughout the calendar
- FullCalendar should automatically expand RRULE into individual event instances
- No manual instance creation should be needed in the database

## Next Steps:
Please run these checks and report back what you find. The most likely issue is either missing RRULE data in the database or incorrect RRULE format.

---

## Instructions for Reporting Results to GitHub Copilot

After completing the debugging steps above, please provide a comprehensive report in the following format:

### Database Analysis Results:
```
RRULE Events Found: [number]
- Event 1: [id] - [title] - RRULE: [rrule_string]
- Event 2: [id] - [title] - RRULE: [rrule_string]

Legacy Events Found: [number]
- Event 1: [id] - [title] - Type: [recurring_type] - Interval: [interval]
```

### RRULE Format Analysis:
```
Current Format: [example RRULE string]
FullCalendar Compatible: [YES/NO]
Issues Found: [list any format issues]
Suggested Fix: [corrected RRULE format if needed]
```

### Console Logging Results:
```
UnifiedEventTransformService logs:
[copy relevant console output showing RRULE events being processed]

PlannerView renderEventContent logs:
[copy relevant console output showing events being rendered]
```

### FullCalendar Plugin Check:
```
Plugins loaded: [list of plugins from console]
RRULE Plugin Present: [YES/NO]
```

### Test Event Results:
```
Test Event Created: [YES/NO]
Test Event ID: [id if created]
Test Event Visible: [YES/NO - after creation]
Error Messages: [any errors seen]
```

### Root Cause Analysis:
```
Most Likely Issue: [database/rrule-format/plugin-loading/filtering/other]
Confidence Level: [HIGH/MEDIUM/LOW]
Next Steps Recommended: [what should be fixed first]
```

### Code Changes Needed:
```
File: [filename]
Change: [specific code change needed]
Reason: [why this change is needed]
```

Please provide this report after running through all debugging steps. This will help GitHub Copilot quickly identify and fix the RRULE event display issue.
