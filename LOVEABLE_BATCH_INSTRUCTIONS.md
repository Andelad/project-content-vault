# BATCH INSTRUCTIONS: Milestone Feature Implementation

## STEP 1: Run this SQL in Supabase SQL Editor

```sql
-- Create milestones table
CREATE TABLE public.milestones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    due_date timestamp with time zone NOT NULL,
    time_allocation numeric NOT NULL CHECK (time_allocation >= 0 AND time_allocation <= 100),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    order_index integer NOT NULL DEFAULT 0,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_milestones_project_id ON public.milestones(project_id);
CREATE INDEX idx_milestones_user_id ON public.milestones(user_id);
CREATE INDEX idx_milestones_due_date ON public.milestones(due_date);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own milestones" ON public.milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own milestones" ON public.milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own milestones" ON public.milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own milestones" ON public.milestones FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
```

## STEP 2: Add to src/integrations/supabase/types.ts

Add this to the Tables interface:

```typescript
milestones: {
  Row: {
    id: string;
    name: string;
    due_date: string;
    time_allocation: number;
    project_id: string;
    order_index: number;
    user_id: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    name: string;
    due_date: string;
    time_allocation: number;
    project_id: string;
    order_index?: number;
    user_id: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    name?: string;
    due_date?: string;
    time_allocation?: number;
    project_id?: string;
    order_index?: number;
    user_id?: string;
    created_at?: string;
    updated_at?: string;
  };
};
```

## STEP 3: Test These Features

1. Open project modal → "Add Milestones" section should appear
2. Add milestone → should save to database
3. Timeline view → milestone diamonds should appear on project bars
4. Drag milestone → should update due_date
5. Budget validation → should warn when total allocation > 100%

## What This Enables

- ✅ Milestone management in project modals
- ✅ Timeline visualization with diamond shapes
- ✅ Drag & drop milestone positioning
- ✅ Budget validation and warnings
- ✅ Tooltips showing milestone details
- ✅ Proper user security (RLS policies)

All frontend code is already implemented and ready!
