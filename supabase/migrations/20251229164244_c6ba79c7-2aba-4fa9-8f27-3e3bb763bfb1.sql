-- PR4: Rename milestones table to phases
-- This is a semantic alignment - phases better represents the concept

-- Step 1: Rename the table
ALTER TABLE public.milestones RENAME TO phases;

-- Step 2: Update RLS policies to use new table name
-- Drop existing policies
DROP POLICY IF EXISTS "Users can only delete their own milestones" ON public.phases;
DROP POLICY IF EXISTS "Users can only insert their own milestones" ON public.phases;
DROP POLICY IF EXISTS "Users can only see their own milestones" ON public.phases;
DROP POLICY IF EXISTS "Users can only update their own milestones" ON public.phases;

-- Create new policies with updated names
CREATE POLICY "Users can delete their own phases" 
ON public.phases 
FOR DELETE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own phases" 
ON public.phases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own phases" 
ON public.phases 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own phases" 
ON public.phases 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Step 3: Rename the index if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'milestones_pkey') THEN
    ALTER INDEX milestones_pkey RENAME TO phases_pkey;
  END IF;
END $$;

-- Note: Foreign key from projects table will automatically follow the rename
-- The constraint name remains but references the renamed table