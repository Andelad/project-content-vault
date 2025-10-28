-- Make group_id NOT NULL in projects table
ALTER TABLE public.projects
ALTER COLUMN group_id SET NOT NULL;

-- Add foreign key constraint if it doesn't exist (ensures referential integrity)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'projects_group_id_fkey'
  ) THEN
    ALTER TABLE public.projects
    ADD CONSTRAINT projects_group_id_fkey 
    FOREIGN KEY (group_id) 
    REFERENCES public.groups(id) 
    ON DELETE CASCADE;
  END IF;
END $$;