# Work Hours Infinite Recurrence - Testing Checklist

## Pre-Testing Setup

- [ ] Run database migration: `supabase db push` or via dashboard
- [ ] (Optional) Regenerate types: `supabase gen types typescript --local > src/integrations/supabase/types.ts`
- [ ] Start dev server: `npm run dev`

## Test 1: Pattern Creation (Settings)

### Steps
1. [ ] Go to Settings → Work Hours
2. [ ] Click "Add Work Slot" for Monday
3. [ ] Set time: 09:00 - 17:00
4. [ ] Save
5. [ ] Repeat for Tuesday through Friday
6. [ ] Navigate to Planner view

### Expected Results
- [ ] Work hours appear for Monday-Friday in current week
- [ ] Work hours appear for next week (scroll or navigate)
- [ ] Work hours appear for all visible weeks going forward
- [ ] Each work hour shows in italic text
- [ ] Saturday and Sunday have no work hours

## Test 2: Individual Day Exception (This Day Only)

### Steps
1. [ ] In Planner, find a work hour on any Wednesday
2. [ ] Drag the work hour to start at 10:00 instead of 09:00
3. [ ] **Dialog should appear** with two options

### Expected Results
- [ ] WorkHourScopeDialog displays
- [ ] Dialog shows: "Just this day (Wednesday, Nov XX, 2025)"
- [ ] Dialog shows: "All future days"
- [ ] Dialog shows: "Cancel" option

### Choose "Just this day"
4. [ ] Click "Just this day"
5. [ ] Check that specific Wednesday

### Expected Results
- [ ] That Wednesday now shows 10:00-17:00
- [ ] All other Wednesdays still show 09:00-17:00
- [ ] Other days unaffected (Mon, Tue, Thu, Fri still 09:00-17:00)

## Test 3: Pattern Update (All Future Days)

### Steps
1. [ ] In Planner, find a work hour on any Thursday
2. [ ] Resize the work hour to end at 18:00 instead of 17:00
3. [ ] Dialog appears

### Choose "All future days"
4. [ ] Click "All future days"
5. [ ] Check multiple Thursdays (current, next week, etc.)

### Expected Results
- [ ] All visible Thursdays now show 09:00-18:00
- [ ] Other days unaffected (Mon, Tue, Wed, Fri still original times)
- [ ] If you go to Settings → Work Hours, Thursday slot shows 09:00-18:00

## Test 4: Verify Exception Persistence

### Steps
1. [ ] Refresh the page (F5 or Cmd+R)
2. [ ] Navigate to Planner
3. [ ] Check the Wednesday you modified in Test 2
4. [ ] Check the Thursdays you modified in Test 3

### Expected Results
- [ ] Exception on Wednesday persists (still shows 10:00-17:00)
- [ ] Pattern update on Thursday persists (all show 09:00-18:00)
- [ ] No data loss after refresh

## Test 5: Delete Work Hour (This Day Only)

### Steps
1. [ ] In Planner, find a work hour on any Friday
2. [ ] Click to select the work hour
3. [ ] Press Delete key or right-click → Delete
4. [ ] Dialog should appear

### Choose "Just this day"
5. [ ] Click "Just this day" (or see note about deletion)
6. [ ] Check that Friday and other Fridays

### Expected Results
- [ ] That specific Friday has no work hour
- [ ] Other Fridays still show 09:00-17:00
- [ ] Exception created in database

**Note**: If delete from planner shows "Go to settings", that's expected. Delete exceptions may be created differently.

## Test 6: Settings Pattern Update Preserves Exceptions

### Steps
1. [ ] Go to Settings → Work Hours
2. [ ] Find the Monday slot (currently 09:00-17:00)
3. [ ] Edit it to 08:00-16:00
4. [ ] Save
5. [ ] Go to Planner

### Expected Results
- [ ] All Mondays now show 08:00-16:00 (pattern updated)
- [ ] Wednesday exception from Test 2 still exists (10:00-17:00)
- [ ] Thursday pattern from Test 3 still exists (09:00-18:00)
- [ ] Friday exception from Test 5 still exists (deleted)

## Test 7: Multiple Slots Per Day

### Steps
1. [ ] Go to Settings → Work Hours
2. [ ] Add second slot to Tuesday: 19:00-21:00
3. [ ] Save
4. [ ] Go to Planner and check Tuesday

### Expected Results
- [ ] Tuesday shows two work hour blocks
- [ ] First: 09:00-17:00 (original)
- [ ] Second: 19:00-21:00 (new)
- [ ] Both appear on all Tuesdays going forward

## Test 8: Edit Second Slot Individual Day

### Steps
1. [ ] In Planner, find the 19:00-21:00 Tuesday slot
2. [ ] Drag it to 20:00-22:00
3. [ ] Choose "Just this day"

### Expected Results
- [ ] That Tuesday shows 20:00-22:00 for second slot
- [ ] Other Tuesdays still show 19:00-21:00 for second slot
- [ ] First slot unaffected on all Tuesdays (09:00-17:00)

## Test 9: Calendar Navigation

### Steps
1. [ ] Navigate backward one week (arrow or date picker)
2. [ ] Navigate forward two weeks
3. [ ] Switch to Day view
4. [ ] Switch back to Week view

### Expected Results
- [ ] Work hours render correctly in all views
- [ ] Exceptions persist across navigation
- [ ] Pattern applies to all visible dates
- [ ] No performance issues or lag

## Test 10: Work Hour Layers Toggle

### Steps
1. [ ] Click the Layers button (if available)
2. [ ] Toggle "Work Hours" off
3. [ ] Toggle "Work Hours" on

### Expected Results
- [ ] Work hours hide when toggled off
- [ ] Work hours reappear when toggled on
- [ ] Other layers (events, habits) unaffected

## Database Verification (Optional)

### Check Exceptions Table
```sql
-- In Supabase SQL Editor
SELECT * FROM work_hour_exceptions 
WHERE user_id = auth.uid() 
ORDER BY exception_date;
```

### Expected Results
- [ ] Exceptions for Wednesday (modified times)
- [ ] Exceptions for Friday (deleted)
- [ ] Exception for Tuesday (modified second slot)
- [ ] All have correct dates, slotIds, and types

## Edge Cases

### Past Dates
- [ ] Try to edit work hour in the past
- [ ] Should be disabled or show error message

### Weekend Work Hours
- [ ] Add Saturday work hours in Settings
- [ ] Verify they appear in Planner for all Saturdays

### Long-Term Future
- [ ] Navigate to 6 months from now
- [ ] Verify pattern still applies
- [ ] Verify no performance issues

## Cleanup (Optional)

### Remove Test Exceptions
1. [ ] Go to Supabase dashboard
2. [ ] SQL Editor: `DELETE FROM work_hour_exceptions WHERE user_id = auth.uid();`
3. [ ] Refresh Planner
4. [ ] All work hours revert to pattern

---

## Issues Encountered

Document any issues here:

| Test # | Issue | Severity | Notes |
|--------|-------|----------|-------|
|        |       |          |       |

---

## Sign-off

- [ ] All tests passed
- [ ] No critical issues
- [ ] Ready for production

**Tested by**: _______________
**Date**: _______________
**Version**: _______________
