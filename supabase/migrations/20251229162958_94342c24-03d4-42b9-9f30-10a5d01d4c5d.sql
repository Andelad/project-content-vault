-- ============================================================
-- PR2: Rename work_hour_exceptions → work_slot_exceptions
-- ============================================================
-- This aligns the table name with the domain terminology (WorkSlot)
-- ============================================================

-- Rename the table
ALTER TABLE public.work_hour_exceptions RENAME TO work_slot_exceptions;

-- Verify rename
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_slot_exceptions' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'ERROR: work_slot_exceptions table does not exist!';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_hour_exceptions' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'ERROR: work_hour_exceptions table still exists!';
    END IF;
    
    RAISE NOTICE 'SUCCESS: Table renamed to work_slot_exceptions!';
END $$;