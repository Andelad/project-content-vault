# Instructions for Lovable: Run Work Hours Migration

## 🎯 Objective
Run the database migration to add the `work_hour_exceptions` table that enables infinite recurring work hours with individual day exceptions.

## 📋 Steps to Execute

### Step 1: Access Supabase Dashboard
1. Go to the Supabase dashboard for this project
2. Navigate to the **SQL Editor** section

### Step 2: Open and Copy Migration File
The migration file is located at:
```
supabase/migrations/20251112140000_add_work_hour_exceptions.sql
```

Copy the entire contents of this file.

### Step 3: Run the Migration

1. In the SQL Editor, create a new query
2. Paste the migration SQL
3. Click **Run** or press `Cmd/Ctrl + Enter`

### Step 4: Verify Success

After running, you should see:
- ✅ Table `work_hour_exceptions` created
- ✅ RLS policies enabled
- ✅ Indexes created
- ✅ Triggers added

You can verify by running this query:
```sql
-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'work_hour_exceptions';

-- Should return one row with 'work_hour_exceptions'
```

## 📝 What This Migration Does

Creates a new table `work_hour_exceptions` with:
- **Purpose**: Store individual day overrides for recurring work hours
- **Fields**:
  - `exception_date` - The specific date of the exception
  - `day_of_week` - Day name (monday, tuesday, etc.)
  - `slot_id` - References the WorkSlot ID from settings
  - `exception_type` - Either 'deleted' or 'modified'
  - `modified_start_time` - New start time if modified (HH:MM)
  - `modified_end_time` - New end time if modified (HH:MM)

- **Security**: RLS policies ensure users can only access their own exceptions
- **Performance**: Indexes on user_id, date, and date ranges

## 🔍 Expected Behavior After Migration

Once the migration is complete:

1. **Work hours will display infinitely** based on the weekly pattern in settings
2. **Users can edit individual days** - creates an exception in this new table
3. **Users can edit all future days** - updates the pattern in settings
4. **Exceptions persist** across page refreshes and calendar navigation

## ⚠️ Important Notes

- This migration is **additive only** - it doesn't modify existing tables
- Existing work hours functionality remains unchanged
- No data migration needed - existing work hours will continue to work
- The new exception system is opt-in (only used when users edit individual days)

## 🧪 Testing After Migration

To verify the migration worked:

1. Go to Settings → Work Hours
2. Add work slots (e.g., Mon-Fri 9:00-17:00)
3. Navigate to Planner view
4. Verify work hours appear for all visible weeks (infinitely)
5. Drag a work hour to different time
6. Dialog should appear: "Just this day" or "All future days"
7. Choose "Just this day"
8. Verify only that specific day changes

## 🐛 Troubleshooting

### If migration fails with "table already exists":
The table may have been created previously. Run:
```sql
DROP TABLE IF EXISTS public.work_hour_exceptions CASCADE;
```
Then re-run the migration.

### If RLS policies fail:
Check if policies with the same name exist:
```sql
SELECT * FROM pg_policies WHERE tablename = 'work_hour_exceptions';
```

## ✅ Confirmation

After running the migration, confirm it's working by checking:
```sql
-- This should return an empty result set (no exceptions yet)
SELECT * FROM work_hour_exceptions LIMIT 1;

-- This should succeed (permissions are set correctly)
INSERT INTO work_hour_exceptions (
  user_id, 
  exception_date, 
  day_of_week, 
  slot_id, 
  exception_type
) VALUES (
  auth.uid(),
  CURRENT_DATE,
  'monday',
  'test-123',
  'deleted'
);

-- Clean up the test
DELETE FROM work_hour_exceptions WHERE slot_id = 'test-123';
```

## 📚 Related Documentation

After migration, refer to:
- `README_WORK_HOURS.md` - Quick start guide
- `docs/WORK_HOURS_IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `docs/WORK_HOURS_TESTING_CHECKLIST.md` - Comprehensive testing guide

---

**Migration File**: `supabase/migrations/20251112140000_add_work_hour_exceptions.sql`  
**Safe to run**: Yes - additive only, no destructive operations  
**Rollback**: Can drop table if needed (see troubleshooting)
