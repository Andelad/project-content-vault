-- ============================================================
-- Phase 1: Create Clients, Labels, and Project-Labels Tables
-- ============================================================

-- Create Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  contact_email TEXT,
  contact_phone TEXT,
  billing_address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Clients
CREATE POLICY "Users can view their own clients" 
  ON public.clients FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own clients" 
  ON public.clients FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clients" 
  ON public.clients FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clients" 
  ON public.clients FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_clients_status ON public.clients(status);
CREATE INDEX idx_clients_name ON public.clients(user_id, name);

-- Create Labels table
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Labels
CREATE POLICY "Users can view their own labels" 
  ON public.labels FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own labels" 
  ON public.labels FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels" 
  ON public.labels FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels" 
  ON public.labels FOR DELETE 
  USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_labels_updated_at
  BEFORE UPDATE ON public.labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_labels_user_id ON public.labels(user_id);
CREATE INDEX idx_labels_name ON public.labels(user_id, name);

-- Create Project-Labels junction table (many-to-many)
CREATE TABLE public.project_labels (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, label_id)
);

-- Enable Row Level Security
ALTER TABLE public.project_labels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Project-Labels junction
CREATE POLICY "Users can view their own project labels" 
  ON public.project_labels FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_labels.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own project labels" 
  ON public.project_labels FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_labels.project_id 
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own project labels" 
  ON public.project_labels FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_labels.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_project_labels_project_id ON public.project_labels(project_id);
CREATE INDEX idx_project_labels_label_id ON public.project_labels(label_id);

-- ============================================================
-- Phase 2: Migrate Existing Client Data
-- ============================================================

-- Create Client entities from existing project.client strings
INSERT INTO public.clients (user_id, name, status)
SELECT DISTINCT 
  p.user_id,
  p.client,
  'active'::TEXT
FROM public.projects p
WHERE p.client IS NOT NULL 
  AND p.client != ''
ON CONFLICT (user_id, name) DO NOTHING;

-- Add client_id column to projects (nullable for now)
ALTER TABLE public.projects 
  ADD COLUMN client_id UUID;

-- Create index for client_id
CREATE INDEX idx_projects_client_id ON public.projects(client_id);

-- Link projects to their clients
UPDATE public.projects p
SET client_id = c.id
FROM public.clients c
WHERE p.user_id = c.user_id 
  AND p.client = c.name;

-- Verify migration: Check for projects without client_id
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM public.projects
  WHERE client_id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % projects without client_id', orphaned_count;
  ELSE
    RAISE NOTICE 'All projects successfully linked to clients';
  END IF;
END $$;

-- ============================================================
-- Phase 3: Update Projects Table Constraints
-- ============================================================

-- Make client_id required now that data is migrated
ALTER TABLE public.projects 
  ALTER COLUMN client_id SET NOT NULL;

-- Add foreign key constraint with RESTRICT to prevent client deletion with projects
ALTER TABLE public.projects 
  ADD CONSTRAINT projects_client_id_fkey 
  FOREIGN KEY (client_id) 
  REFERENCES public.clients(id) 
  ON DELETE RESTRICT;

-- Make group_id optional (keep for backward compatibility)
ALTER TABLE public.projects 
  ALTER COLUMN group_id DROP NOT NULL;

-- Make row_id optional (keep for current timeline functionality)
ALTER TABLE public.projects 
  ALTER COLUMN row_id DROP NOT NULL;

-- Simplify groups table (remove description and color if they exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'groups' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.groups DROP COLUMN description;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'groups' 
    AND column_name = 'color'
  ) THEN
    ALTER TABLE public.groups DROP COLUMN color;
  END IF;
END $$;