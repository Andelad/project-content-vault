-- ============================================================
-- Drop unused work_hours table
-- ============================================================
-- This table is NOT used in the codebase. Work slots are stored in:
--   - settings.weekly_work_hours (JSONB) for recurring work slot patterns
--   - work_hour_exceptions table for instance overrides
-- ============================================================

-- Drop the table (CASCADE drops dependent objects like indexes, triggers, RLS policies)
DROP TABLE IF EXISTS public.work_hours CASCADE;

-- Verify table is dropped
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_hours' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'ERROR: work_hours table still exists!';
    END IF;
    
    RAISE NOTICE 'SUCCESS: work_hours table dropped!';
END $$;