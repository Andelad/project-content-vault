# Supabase Database Requirements for Time Forecasting Application

## Overview
This document outlines the complete database schema and requirements for the Time Forecasting Application's Supabase backend, including all tables, relationships, and specific configurations needed for the work hours and calendar integration features.

## Database Tables

### 1. `auth.users` (Supabase Auth - Built-in)
- Standard Supabase authentication table
- No custom modifications needed

### 2. `public.settings`
**Purpose**: Store user-specific settings including weekly work hour schedules
```sql
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_work_hours JSONB NOT NULL DEFAULT '{
    "monday": [],
    "tuesday": [],
    "wednesday": [],
    "thursday": [],
    "friday": [],
    "saturday": [],
    "sunday": []
  }'::jsonb,
  default_view VARCHAR(50) DEFAULT 'calendar',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

**Key Features**:
- `weekly_work_hours`: JSONB field storing work schedules for each day
- Each day contains an array of `WorkSlot` objects
- **WorkSlot Structure**:
  ```typescript
  {
    id: string;           // Unique identifier for the slot
    startTime: string;    // Format: "09:00" (24-hour format)
    endTime: string;      // Format: "17:00" (24-hour format)  
    duration: number;     // Calculated hours (supports 15min increments)
  }
  ```

### 3. `public.groups`
**Purpose**: Top-level organization for projects
```sql
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) NOT NULL, -- Hex color code
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 4. `public.rows` 
**Purpose**: Sub-organization within groups
```sql
CREATE TABLE public.rows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 5. `public.projects`
**Purpose**: Individual projects with timeline and resource allocation
```sql
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  row_id UUID NOT NULL REFERENCES public.rows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  client VARCHAR(255),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_hours DECIMAL(10,2) NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color code
  notes TEXT,
  icon VARCHAR(50) DEFAULT 'folder', -- Lucide icon name
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 6. `public.milestones`
**Purpose**: Project milestones with time allocation
```sql
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  time_allocation DECIMAL(10,2) NOT NULL, -- Hours allocated to this milestone
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 7. `public.calendar_events`
**Purpose**: Calendar events linked to projects with time tracking
```sql
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  color VARCHAR(7) NOT NULL,
  completed BOOLEAN DEFAULT false,
  description TEXT,
  duration DECIMAL(10,2), -- Duration in hours
  event_type VARCHAR(50) DEFAULT 'work', -- 'work', 'meeting', 'break', etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 8. `public.holidays`
**Purpose**: Holiday tracking for calendar view
```sql
CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### 9. `public.work_hours` (Optional - Currently Using Settings)
**Purpose**: Individual work hour blocks (currently implemented via settings integration)
```sql
CREATE TABLE work_hours (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start TIMESTAMPTZ NOT NULL,
    "end" TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Row Level Security (RLS) Policies

All tables must have RLS enabled with user-specific access:

```sql
-- Enable RLS on all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Standard RLS policies for each table
CREATE POLICY "Users can view their own data" ON public.{table_name} FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own data" ON public.{table_name} FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own data" ON public.{table_name} FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own data" ON public.{table_name} FOR DELETE USING (auth.uid() = user_id);
```

## Critical Indexes for Performance

```sql
-- Calendar events performance
CREATE INDEX idx_calendar_events_user_time ON public.calendar_events(user_id, start_time, end_time);
CREATE INDEX idx_calendar_events_project ON public.calendar_events(project_id);

-- Project organization
CREATE INDEX idx_projects_user_group ON public.projects(user_id, group_id);
CREATE INDEX idx_rows_group_order ON public.rows(group_id, order_index);
CREATE INDEX idx_milestones_project_order ON public.milestones(project_id, order_index);

-- Settings lookup
CREATE INDEX idx_settings_user ON public.settings(user_id);
```

## Work Hours Integration - Key Implementation Details

### Settings-Based Work Hours System
The application uses a **dual-system approach** for work hours:

1. **Default Schedule (Settings)**: Stored in `settings.weekly_work_hours` as JSONB
2. **Week-Specific Overrides**: Handled in-memory for temporary modifications

### Work Hour ID Format
```typescript
// Settings-based work hours (appear on all weeks)
`settings-${dayName}-${slotId}-${weekTimestamp}`

// Example: "settings-wednesday-1692123456-1724284800000"
```

### Scope-Based Updates
The system supports two update scopes:
- **"this-week"**: Creates temporary overrides (in-memory only)
- **"permanent"**: Updates the settings.weekly_work_hours JSONB field

### JSONB Update Pattern
When updating work hours permanently:
```sql
UPDATE public.settings 
SET weekly_work_hours = jsonb_set(
  weekly_work_hours, 
  '{wednesday}', 
  '[{"id": "123", "startTime": "09:00", "endTime": "17:00", "duration": 8}]'::jsonb
)
WHERE user_id = auth.uid();
```

## Required Supabase Configuration

### Authentication
- Enable email/password authentication
- Optional: Enable Google/GitHub OAuth

### Database Functions
```sql
-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_{table}_updated_at BEFORE UPDATE ON public.{table}
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Edge Functions (Optional)
Consider edge functions for:
- Complex work hour calculations
- Calendar synchronization
- Bulk data operations

## TypeScript Integration

### Key Type Definitions
```typescript
interface WorkSlot {
  id: string;
  startTime: string; // "HH:MM" format
  endTime: string;   // "HH:MM" format  
  duration: number;  // Hours with 15min precision
}

interface Settings {
  weekly_work_hours: {
    monday: WorkSlot[];
    tuesday: WorkSlot[];
    wednesday: WorkSlot[];
    thursday: WorkSlot[];
    friday: WorkSlot[];
    saturday: WorkSlot[];
    sunday: WorkSlot[];
  };
  default_view?: string;
}

interface WorkHour {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO timestamp
  end: string;   // ISO timestamp
}
```

## Migration Notes for Lovable

1. **Existing Data**: Preserve all existing tables and data
2. **Work Hours Table**: Can be optional if using settings-based approach
3. **JSONB Validation**: Consider adding JSON schema validation for weekly_work_hours
4. **Performance**: Monitor JSONB query performance as user base grows
5. **Backup Strategy**: Regular backups especially for settings data

## Testing Requirements

### Database Seed Data
```sql
-- Create test user settings with sample work hours
INSERT INTO public.settings (user_id, weekly_work_hours) VALUES 
('{user_id}', '{
  "monday": [{"id": "1", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
  "tuesday": [{"id": "2", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
  "wednesday": [{"id": "3", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
  "thursday": [{"id": "4", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
  "friday": [{"id": "5", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
  "saturday": [],
  "sunday": []
}'::jsonb);
```

This schema supports the complete time forecasting and work hours integration system with proper user isolation, performance optimization, and extensibility for future features.
