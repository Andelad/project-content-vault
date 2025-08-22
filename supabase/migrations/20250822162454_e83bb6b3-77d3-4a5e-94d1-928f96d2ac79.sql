-- Add continuous column to projects table
ALTER TABLE public.projects 
ADD COLUMN continuous BOOLEAN DEFAULT false;

-- Add a comment to explain the column
COMMENT ON COLUMN public.projects.continuous IS 'Indicates if the project is continuous (has no end date)';