# 🚀 Implementation Instructions: Client-Group-Label System

**Date:** October 21, 2025  
**Target:** Lovable AI Assistant  
**Project:** Project Content Vault  
**Reference:** See `CLIENT_GROUP_LABEL_SPECIFICATION.md` for full specification

---

## 📋 Overview

This document provides step-by-step instructions to migrate from the current `Groups → Rows → Projects` hierarchy to the new `Clients ⟷ Projects ⟷ Groups ⟷ Labels` system.

**Key Changes:**
- Add `clients` table (required for projects)
- Add `labels` table with many-to-many relationship to projects
- Make `group_id` and `row_id` optional in projects
- Eventually deprecate `rows` table
- Maintain backward compatibility during transition

---

## ⚙️ Phase 1: Create New Database Tables

### Step 1.1: Create Clients Table Migration

Create a new migration file: `supabase/migrations/[timestamp]_add_clients_table.sql`

```sql
-- Create Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Add client_id column to projects (nullable for now)
ALTER TABLE public.projects 
  ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT;

-- Create index for client_id
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
```

### Step 1.2: Create Labels Tables Migration

Create a new migration file: `supabase/migrations/[timestamp]_add_labels_tables.sql`

```sql
-- Create Labels table
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create Project-Labels junction table (many-to-many)
CREATE TABLE public.project_labels (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, label_id)
);

-- Enable Row Level Security
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_labels ENABLE ROW LEVEL SECURITY;

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

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_labels_updated_at
  BEFORE UPDATE ON public.labels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_labels_user_id ON public.labels(user_id);
CREATE INDEX idx_labels_name ON public.labels(user_id, name);
CREATE INDEX idx_project_labels_project_id ON public.project_labels(project_id);
CREATE INDEX idx_project_labels_label_id ON public.project_labels(label_id);
```

---

## 📊 Phase 2: Migrate Existing Data

### Step 2.1: Migrate Client Data

Create a new migration file: `supabase/migrations/[timestamp]_migrate_client_data.sql`

```sql
-- Create clients from existing project.client strings
INSERT INTO public.clients (user_id, name, status)
SELECT DISTINCT 
  p.user_id,
  p.client,
  'active'::TEXT
FROM public.projects p
WHERE p.client IS NOT NULL 
  AND p.client != ''
ON CONFLICT (user_id, name) DO NOTHING;

-- Link projects to their clients
UPDATE public.projects p
SET client_id = c.id
FROM public.clients c
WHERE p.user_id = c.user_id 
  AND p.client = c.name;

-- Verify migration: Check for projects without client_id
-- This query should return 0 rows
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
```

### Step 2.2: Make Group and Row Optional

Create a new migration file: `supabase/migrations/[timestamp]_make_groups_rows_optional.sql`

```sql
-- Make group_id optional in projects
ALTER TABLE public.projects 
  ALTER COLUMN group_id DROP NOT NULL;

-- Make row_id optional in projects
ALTER TABLE public.projects 
  ALTER COLUMN row_id DROP NOT NULL;

-- Make client_id required now that data is migrated
ALTER TABLE public.projects 
  ALTER COLUMN client_id SET NOT NULL;

-- Update the foreign key constraint to prevent client deletion if projects exist
ALTER TABLE public.projects 
  DROP CONSTRAINT IF EXISTS projects_client_id_fkey;

ALTER TABLE public.projects 
  ADD CONSTRAINT projects_client_id_fkey 
  FOREIGN KEY (client_id) 
  REFERENCES public.clients(id) 
  ON DELETE RESTRICT;

-- Simplify groups table (remove description and color if they exist)
-- These columns might not exist yet, so we check first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.groups DROP COLUMN description;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'groups' 
    AND column_name = 'color'
  ) THEN
    ALTER TABLE public.groups DROP COLUMN color;
  END IF;
END $$;
```

---

## 🔧 Phase 3: Update TypeScript Types

### Step 3.1: Update Database Types

Update `src/integrations/supabase/types.ts` (or equivalent):

```typescript
export interface Database {
  public: {
    Tables: {
      // NEW: Clients table
      clients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          status: 'active' | 'inactive' | 'archived';
          contact_email: string | null;
          contact_phone: string | null;
          billing_address: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          status?: 'active' | 'inactive' | 'archived';
          contact_email?: string | null;
          contact_phone?: string | null;
          billing_address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          status?: 'active' | 'inactive' | 'archived';
          contact_email?: string | null;
          contact_phone?: string | null;
          billing_address?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      
      // NEW: Labels table
      labels: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      
      // NEW: Project-Labels junction table
      project_labels: {
        Row: {
          project_id: string;
          label_id: string;
          created_at: string;
        };
        Insert: {
          project_id: string;
          label_id: string;
          created_at?: string;
        };
        Update: {
          project_id?: string;
          label_id?: string;
          created_at?: string;
        };
      };
      
      // UPDATED: Projects table
      projects: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;              // NEW: Required
          group_id: string | null;         // CHANGED: Now optional
          row_id: string | null;           // CHANGED: Now optional (deprecated)
          name: string;
          client: string;                  // DEPRECATED: Keep for now
          start_date: string;
          end_date: string;
          estimated_hours: number;
          color: string;
          notes: string | null;
          icon: string | null;
          continuous: boolean | null;
          status: string | null;
          auto_estimate_days: Record<string, boolean> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;               // NEW: Required
          group_id?: string | null;        // CHANGED: Now optional
          row_id?: string | null;          // CHANGED: Now optional
          name: string;
          client?: string;                 // DEPRECATED
          start_date: string;
          end_date: string;
          estimated_hours: number;
          color: string;
          notes?: string | null;
          icon?: string | null;
          continuous?: boolean | null;
          status?: string | null;
          auto_estimate_days?: Record<string, boolean> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          // ... same as Insert but all optional
        };
      };
      
      // UPDATED: Groups table (simplified)
      groups: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}
```

### Step 3.2: Create Domain Entities

Create `src/types/entities.ts`:

```typescript
export type ClientStatus = 'active' | 'inactive' | 'archived';

export interface Client {
  id: string;
  userId: string;
  name: string;
  status: ClientStatus;
  contactEmail?: string;
  contactPhone?: string;
  billingAddress?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Group {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  userId: string;
  clientId: string;           // NEW: Required
  groupId?: string | null;     // CHANGED: Optional
  rowId?: string | null;       // DEPRECATED
  name: string;
  client?: string;             // DEPRECATED: Keep for backward compatibility
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  color: string;
  notes?: string;
  icon?: string;
  continuous?: boolean;
  status?: string;
  autoEstimateDays?: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
  
  // Populated by joins
  clientData?: Client;
  groupData?: Group;
  labels?: Label[];
}
```

---

## 🎯 Phase 4: Create Service Functions

### Step 4.1: Client Service

Create `src/services/clientService.ts`:

```typescript
import { supabase } from '@/integrations/supabase/client';
import type { Client } from '@/types/entities';

export const clientService = {
  // Get all clients for current user
  async getClients(includeArchived = false): Promise<Client[]> {
    let query = supabase
      .from('clients')
      .select('*')
      .order('name');
    
    if (!includeArchived) {
      query = query.neq('status', 'archived');
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },
  
  // Get active clients only
  async getActiveClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('status', 'active')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },
  
  // Get single client
  async getClient(id: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Create new client
  async createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .insert({
        user_id: client.userId,
        name: client.name,
        status: client.status || 'active',
        contact_email: client.contactEmail,
        contact_phone: client.contactPhone,
        billing_address: client.billingAddress,
        notes: client.notes,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Update client
  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const { data, error } = await supabase
      .from('clients')
      .update({
        name: updates.name,
        status: updates.status,
        contact_email: updates.contactEmail,
        contact_phone: updates.contactPhone,
        billing_address: updates.billingAddress,
        notes: updates.notes,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Delete client (will fail if projects exist due to RESTRICT constraint)
  async deleteClient(id: string): Promise<void> {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // Archive client (soft delete)
  async archiveClient(id: string): Promise<Client> {
    return this.updateClient(id, { status: 'archived' });
  },
  
  // Get project count for client
  async getProjectCount(clientId: string): Promise<number> {
    const { count, error } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);
    
    if (error) throw error;
    return count || 0;
  },
};
```

### Step 4.2: Label Service

Create `src/services/labelService.ts`:

```typescript
import { supabase } from '@/integrations/supabase/client';
import type { Label } from '@/types/entities';

export const labelService = {
  // Get all labels for current user
  async getLabels(): Promise<Label[]> {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return data || [];
  },
  
  // Get single label
  async getLabel(id: string): Promise<Label | null> {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Create new label
  async createLabel(label: Omit<Label, 'id' | 'createdAt' | 'updatedAt'>): Promise<Label> {
    const { data, error } = await supabase
      .from('labels')
      .insert({
        user_id: label.userId,
        name: label.name,
        color: label.color || '#6B7280',
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Update label
  async updateLabel(id: string, updates: Partial<Label>): Promise<Label> {
    const { data, error } = await supabase
      .from('labels')
      .update({
        name: updates.name,
        color: updates.color,
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Delete label (safe - cascade removes project associations)
  async deleteLabel(id: string): Promise<void> {
    const { error } = await supabase
      .from('labels')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
  
  // Get labels for a project
  async getProjectLabels(projectId: string): Promise<Label[]> {
    const { data, error } = await supabase
      .from('project_labels')
      .select('label_id, labels(*)')
      .eq('project_id', projectId);
    
    if (error) throw error;
    return data?.map(pl => pl.labels).filter(Boolean) || [];
  },
  
  // Add label to project
  async addLabelToProject(projectId: string, labelId: string): Promise<void> {
    const { error } = await supabase
      .from('project_labels')
      .insert({
        project_id: projectId,
        label_id: labelId,
      });
    
    if (error) throw error;
  },
  
  // Remove label from project
  async removeLabelFromProject(projectId: string, labelId: string): Promise<void> {
    const { error } = await supabase
      .from('project_labels')
      .delete()
      .eq('project_id', projectId)
      .eq('label_id', labelId);
    
    if (error) throw error;
  },
  
  // Get usage count for label
  async getLabelUsageCount(labelId: string): Promise<number> {
    const { count, error } = await supabase
      .from('project_labels')
      .select('*', { count: 'exact', head: true })
      .eq('label_id', labelId);
    
    if (error) throw error;
    return count || 0;
  },
};
```

### Step 4.3: Update Project Service

Update existing `src/services/projectService.ts` to include client and label support:

```typescript
// Add to existing project queries
async getProjectsWithDetails(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      clientData:clients(*),
      groupData:groups(*),
      labels:project_labels(label_id, labels(*))
    `)
    .order('start_date');
  
  if (error) throw error;
  
  // Transform the data to flatten labels
  return data?.map(project => ({
    ...project,
    labels: project.labels?.map(pl => pl.labels).filter(Boolean) || [],
  })) || [];
}

// Update create project to require clientId
async createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
  // Validate clientId exists
  if (!project.clientId) {
    throw new Error('Client is required for new projects');
  }
  
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: project.userId,
      client_id: project.clientId,
      group_id: project.groupId || null,
      row_id: project.rowId || null,
      name: project.name,
      start_date: project.startDate,
      end_date: project.endDate,
      estimated_hours: project.estimatedHours,
      color: project.color,
      notes: project.notes,
      icon: project.icon,
      continuous: project.continuous,
      status: project.status,
      auto_estimate_days: project.autoEstimateDays,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

---

## 🎨 Phase 5: Create Basic UI Components (Later)

This phase will come after database is fully migrated and tested. For now, focus on:

1. **Database migrations** (Phases 1-2)
2. **Type definitions** (Phase 3)
3. **Service functions** (Phase 4)

Once these are complete and tested, we'll build:
- Client management UI
- Label management UI
- Updated project creation flow
- Timeline view updates

---

## ✅ Verification Steps

After each phase, run these checks:

### After Phase 1:
```sql
-- Verify tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('clients', 'labels', 'project_labels');

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('clients', 'labels', 'project_labels');
```

### After Phase 2:
```sql
-- Verify all projects have client_id
SELECT COUNT(*) as orphaned_projects 
FROM projects 
WHERE client_id IS NULL;  -- Should return 0

-- Verify client count matches unique project clients
SELECT 
  (SELECT COUNT(DISTINCT client) FROM projects WHERE client IS NOT NULL) as old_client_count,
  (SELECT COUNT(*) FROM clients) as new_client_count;
  -- These should match
```

### After Phase 3-4:
```bash
# TypeScript compilation check
npx tsc --noEmit

# Test service functions in browser console
# (after implementing services)
```

---

## 🚨 Important Notes

1. **Backup First**: Create a database backup before running migrations
2. **Test in Development**: Test all migrations in a development environment first
3. **No Rollback Needed**: Per specification, we're moving forward without formal rollback
4. **Existing UI Works**: During Phases 1-2, the current UI will continue to work
5. **Gradual Migration**: Projects can exist with or without groups during transition
6. **Client Required**: After Phase 2, all new projects MUST have a client

---

## 📞 Next Steps

1. **Run Phase 1 migrations** - Create new tables
2. **Run Phase 2 migrations** - Migrate data and make groups optional
3. **Update TypeScript types** - Add new entity types
4. **Create service functions** - Add CRUD operations
5. **Test thoroughly** - Verify all data migrated correctly
6. **Update UI** - Build client/label management (separate task)

---

**Status:** Ready for Implementation  
**Estimated Time:** 
- Phase 1: 30 minutes
- Phase 2: 30 minutes  
- Phase 3: 1 hour
- Phase 4: 2 hours
- Phase 5: TBD (separate task)

**Questions?** Refer to `CLIENT_GROUP_LABEL_SPECIFICATION.md` for detailed business logic and requirements.
