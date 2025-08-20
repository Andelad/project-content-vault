# MILESTONE HOURS UPDATE - Instructions for Loveable

## Database Schema Change Required

**Current Issue**: Milestones use percentage allocation (0-100%), but we need actual hours.

### SQL Migration to Run in Supabase:

```sql
-- Update the milestones table to use hours instead of percentages
ALTER TABLE public.milestones 
DROP CONSTRAINT IF EXISTS milestones_time_allocation_check;

-- Update the column comment and remove percentage constraint
COMMENT ON COLUMN public.milestones.time_allocation IS 'Allocated hours for this milestone (not percentage)';

-- Optional: Add a reasonable upper limit for hours (e.g., 10,000 hours)
ALTER TABLE public.milestones 
ADD CONSTRAINT milestones_time_allocation_hours_check 
CHECK (time_allocation >= 0 AND time_allocation <= 10000);
```

### What This Changes:
- ✅ Removes the 0-100 percentage constraint
- ✅ Allows actual hour values (e.g., 20, 50, 100 hours)
- ✅ Adds reasonable upper limit for hours
- ✅ Updates documentation to clarify it's hours, not percentage

### No Type Changes Needed:
The `time_allocation` field remains `numeric` - only the constraint and business logic change.

---

**After this migration**: Milestone allocations will be in actual hours instead of percentages.
