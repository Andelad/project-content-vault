# Instructions for Lovable: Allow Zero-Hour Phase Allocations

## Purpose
Allow project phases/milestones to be saved with a 0h allocation (placeholder while planning). The current `milestones_time_allocation_hours_check` constraint enforces `> 0`, which blocks users who want one phase at 7h and another at 0h.

## Migration SQL
```sql
-- Relax constraint to allow zero hours
ALTER TABLE public.milestones
  DROP CONSTRAINT IF EXISTS milestones_time_allocation_hours_check;

ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_time_allocation_hours_check
  CHECK (time_allocation_hours >= 0);
```

## Verification
1. Update an existing milestone/phase to `time_allocation_hours = 0` (e.g., via Supabase SQL editor):
```sql
UPDATE public.milestones
SET time_allocation_hours = 0, time_allocation = 0
WHERE id = '<a-valid-milestone-id>'
LIMIT 1;
```
2. Confirm the update succeeds (no constraint violation).
3. Optional: set `time_allocation_hours` to a positive value to confirm standard behavior still works.

## Rollback (if needed)
```sql
ALTER TABLE public.milestones
  DROP CONSTRAINT IF EXISTS milestones_time_allocation_hours_check;

ALTER TABLE public.milestones
  ADD CONSTRAINT milestones_time_allocation_hours_check
  CHECK (time_allocation_hours > 0);
```
