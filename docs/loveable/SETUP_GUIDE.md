# Loveable Platform Setup Guide

This guide contains all necessary instructions for setting up database tables and features in the Loveable platform.

## 🗄️ Database Setup

### 1. Milestones Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create milestones table
CREATE TABLE public.milestones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    due_date timestamp with time zone NOT NULL,
    time_allocation numeric NOT NULL CHECK (time_allocation >= 0 AND time_allocation <= 10000), -- Hours, not percentage
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    order_index integer NOT NULL DEFAULT 0,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_milestones_project_id ON public.milestones(project_id);
CREATE INDEX idx_milestones_user_id ON public.milestones(user_id);
CREATE INDEX idx_milestones_due_date ON public.milestones(due_date);

-- Enable RLS (Row Level Security)
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only see their own milestones" ON public.milestones
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own milestones" ON public.milestones
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own milestones" ON public.milestones
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own milestones" ON public.milestones
    FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_milestones_updated_at 
    BEFORE UPDATE ON public.milestones 
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
```

### 2. Work Hours Table

```sql
-- Create work_hours table
CREATE TABLE work_hours (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start TIMESTAMPTZ NOT NULL,
    "end" TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS (Row Level Security)
ALTER TABLE work_hours ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view work hours" ON work_hours FOR SELECT USING (true);
CREATE POLICY "Anyone can insert work hours" ON work_hours FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update work hours" ON work_hours FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete work hours" ON work_hours FOR DELETE USING (true);

-- Add indexes for better performance
CREATE INDEX idx_work_hours_start ON work_hours(start);
CREATE INDEX idx_work_hours_end ON work_hours("end");
CREATE INDEX idx_work_hours_start_end ON work_hours(start, "end");

-- Add trigger for updated_at
CREATE TRIGGER update_work_hours_updated_at BEFORE UPDATE ON work_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 🔧 Type Definitions

Add these to `src/integrations/supabase/types.ts`:

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

work_hours: {
  Row: {
    id: string;
    title: string;
    description: string | null;
    start: string;
    end: string;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    title: string;
    description?: string | null;
    start: string;
    end: string;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    title?: string;
    description?: string | null;
    start?: string;
    end?: string;
    created_at?: string;
    updated_at?: string;
  };
};
```

## ✅ Verification

After running the SQL:
1. Check that tables exist in Supabase Dashboard > Table Editor
2. Verify RLS policies are enabled
3. Test milestone creation through the UI
4. Test work hours creation through calendar (Ctrl+click)

## 📝 Notes

- **Milestones use hours**: `time_allocation` field represents actual hours, not percentages
- **Work hours integration**: Appears in calendar view, created via Ctrl+click
- **All features are frontend-ready**: UI components already exist and functional
