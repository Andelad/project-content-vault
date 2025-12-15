# Instructions for Lovable: Refresh Supabase Schema Cache

## Purpose
The application is getting a schema cache error for the `auto_estimate_days` column in the `projects` table. The column exists in the migration files but Supabase's schema cache is out of sync.

## Issue
Error: `Could not find the 'autoEstimateDays' column of 'projects' in the schema cache`

## Solution
The `auto_estimate_days` column should already exist from migration `20250902000000_add_auto_estimate_days.sql`. We need to refresh Supabase's schema cache.

## Steps to Fix

1. **In Supabase Dashboard**, go to the SQL Editor
2. Run this command to refresh the schema cache:
```sql
NOTIFY pgrst, 'reload schema';
```

3. **Verify the column exists** by running:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
AND column_name = 'auto_estimate_days';
```

Expected result: Should show one row with `auto_estimate_days` as `jsonb` type.

4. **If the column doesn't exist** (unlikely), run the migration manually:
```sql
ALTER TABLE public.projects 
ADD COLUMN auto_estimate_days JSONB DEFAULT '{
  "monday": true,
  "tuesday": true,
  "wednesday": true,
  "thursday": true,
  "friday": true,
  "saturday": true,
  "sunday": true
}'::jsonb;
```

## Verification
After refreshing the schema:
1. Try creating a new project in the app
2. The error should be gone
3. Projects should save successfully

## Note
This is a schema cache issue, not a missing column issue. The PostgREST server (which Supabase uses) caches the schema and sometimes needs to be told to reload it.
