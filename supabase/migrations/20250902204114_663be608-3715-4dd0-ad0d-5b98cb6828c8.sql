-- Add auto_estimate_days column to projects table
-- This column stores which days of the week should be included in auto-estimation

DO $$
BEGIN
    -- Add auto_estimate_days column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' 
                   AND column_name = 'auto_estimate_days' 
                   AND table_schema = 'public') THEN
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
    END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN public.projects.auto_estimate_days IS 'JSONB object defining which days of the week are included in auto-estimation calculations. Each day key maps to a boolean value.';