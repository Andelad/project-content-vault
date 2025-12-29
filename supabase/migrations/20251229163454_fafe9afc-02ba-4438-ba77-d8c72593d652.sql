-- ============================================================
-- PR3: Rename auto_estimate_days → working_day_overrides
-- ============================================================
-- This aligns the column name with domain terminology
-- The column stores per-project overrides of which days are working days
-- ============================================================

-- Rename the column
ALTER TABLE public.projects 
RENAME COLUMN auto_estimate_days TO working_day_overrides;

-- Verify rename
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND table_schema = 'public' 
        AND column_name = 'working_day_overrides'
    ) THEN
        RAISE EXCEPTION 'ERROR: working_day_overrides column does not exist!';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND table_schema = 'public' 
        AND column_name = 'auto_estimate_days'
    ) THEN
        RAISE EXCEPTION 'ERROR: auto_estimate_days column still exists!';
    END IF;
    
    RAISE NOTICE 'SUCCESS: Column renamed to working_day_overrides!';
END $$;