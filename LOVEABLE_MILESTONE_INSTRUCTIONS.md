# Loveable Implementation Instructions: Milestone Feature

## Overview
I need you to implement a milestone feature for projects in our time tracking application. All the frontend code has been prepared and is working. You need to:
1. Create the database table and policies
2. Update the Supabase types
3. Verify the integration works

## 1. Database Migration (CRITICAL)

Please run this SQL in the Supabase SQL Editor:

```sql
-- Create milestones table
CREATE TABLE public.milestones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    due_date timestamp with time zone NOT NULL,
    time_allocation numeric NOT NULL CHECK (time_allocation >= 0 AND time_allocation <= 100), -- Percentage of total project budget
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
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
```

## 2. Type Definitions Update

Make sure the file `src/integrations/supabase/types.ts` includes these definitions:

```typescript
export interface Tables {
  // ... existing tables ...
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
}
```

## 3. Feature Description

The milestone feature allows users to:

### Milestone Properties:
- **Name**: Text description of the milestone
- **Due Date**: When the milestone should be completed
- **Time Allocation**: Percentage of the total project budget (0-100%)
- **Order**: Milestones maintain order along the project timeline

### UI Features:
1. **Project Modal**: Under the project title, there's an expandable "Add Milestones" section
2. **Milestone Management**: Users can add, edit, delete milestones
3. **Budget Validation**: If total milestone time allocation exceeds 100%, user is asked to update project budget
4. **Timeline Visualization**: Milestones appear as diamonds on project bars
5. **Drag & Drop**: Milestones can be dragged left/right along the timeline (with constraints)
6. **Tooltips**: Hover over milestones shows name, time allocation, and date

### Business Logic:
- Milestones cannot overlap or jump over each other when dragging
- Total time allocation is validated against project budget
- Milestones are ordered by due date
- Each milestone belongs to a specific project and user

## 4. Implementation Status

✅ **COMPLETED** (Frontend Ready):
- `src/types/core.ts` - Milestone interface defined
- `src/hooks/useMilestones.ts` - Complete CRUD operations hook
- `src/components/MilestoneManager.tsx` - Modal interface for milestone management
- `src/components/timeline/ProjectMilestones.tsx` - Timeline visualization component
- `src/contexts/AppContext.tsx` - Milestone state management integrated
- All TypeScript compilation verified ✓

⏳ **NEEDS LOVEABLE**:
- Database table creation (run the SQL above)
- Supabase type definitions update
- Connection verification

## 5. Testing Checklist

After you implement the database changes, please verify:

1. **Database Access**: 
   - Can create milestones via the API
   - RLS policies work (users only see their own milestones)
   - Foreign key constraints work (milestones link to projects)

2. **Frontend Integration**:
   - Open a project modal → "Add Milestones" section appears
   - Add a milestone → saves to database successfully
   - Timeline view → milestone diamonds appear on project bars
   - Drag milestone → updates due_date in database
   - Budget validation → warns when total allocation > 100%

3. **Error Handling**:
   - Invalid time allocation (>100% or <0%) rejected
   - Milestone without project_id rejected
   - Unauthorized access blocked by RLS

## 6. Expected User Flow

1. User opens project modal
2. Expands "Add Milestones" section
3. Adds milestone with name, date, and time allocation percentage
4. Milestone appears as diamond on timeline bar
5. User can drag milestone to adjust due date
6. Tooltip shows milestone details on hover
7. Budget validation warns if milestones exceed 100% of project budget

## 7. Database Relationships

```
projects (existing)
├── id (uuid, primary key)
├── name (text)
├── budget_time (numeric)
└── user_id (uuid)

milestones (new)
├── id (uuid, primary key)
├── name (text)
├── due_date (timestamptz)
├── time_allocation (numeric, 0-100)
├── project_id (uuid, foreign key → projects.id)
├── order_index (integer)
├── user_id (uuid, foreign key → auth.users.id)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

The frontend code is complete and ready. Once you create the database table and update the types, the milestone feature should work immediately!
