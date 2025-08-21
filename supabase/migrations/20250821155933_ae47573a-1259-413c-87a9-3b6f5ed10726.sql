-- Complete Supabase Database Schema Implementation for Time Forecasting Application
-- Based on SUPABASE_REQUIREMENTS.md

-- First, ensure the update_updated_at_column function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create or update settings table with proper JSONB structure
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings' AND table_schema = 'public') THEN
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
        
        ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view their own settings" ON public.settings FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can create their own settings" ON public.settings FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update their own settings" ON public.settings FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete their own settings" ON public.settings FOR DELETE USING (auth.uid() = user_id);
        
        CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Ensure groups table has correct structure
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'color' AND table_schema = 'public') THEN
        ALTER TABLE public.groups ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#3b82f6';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'description' AND table_schema = 'public') THEN
        ALTER TABLE public.groups ADD COLUMN description TEXT DEFAULT '';
    END IF;
END $$;

-- Ensure projects table has all required columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'icon' AND table_schema = 'public') THEN
        ALTER TABLE public.projects ADD COLUMN icon VARCHAR(50) DEFAULT 'folder';
    END IF;
    
    -- Ensure estimated_hours is DECIMAL(10,2)
    ALTER TABLE public.projects ALTER COLUMN estimated_hours TYPE DECIMAL(10,2);
END $$;

-- Ensure calendar_events table has all required columns and proper structure
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'duration' AND table_schema = 'public') THEN
        ALTER TABLE public.calendar_events ADD COLUMN duration DECIMAL(10,2);
    END IF;
    
    -- Ensure event_type exists with proper constraint (already added in previous migration)
    -- Add any missing columns that might be needed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'completed' AND table_schema = 'public') THEN
        ALTER TABLE public.calendar_events ADD COLUMN completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create work_hours table (optional, as mentioned in requirements)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_hours' AND table_schema = 'public') THEN
        CREATE TABLE public.work_hours (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start TIMESTAMPTZ NOT NULL,
            "end" TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        ALTER TABLE public.work_hours ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view their own work hours" ON public.work_hours FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can create their own work hours" ON public.work_hours FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update their own work hours" ON public.work_hours FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete their own work hours" ON public.work_hours FOR DELETE USING (auth.uid() = user_id);
        
        CREATE TRIGGER update_work_hours_updated_at BEFORE UPDATE ON public.work_hours
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Add missing triggers for existing tables
DO $$
BEGIN
    -- Groups table trigger
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_groups_updated_at') THEN
        CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    -- Rows table trigger
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_rows_updated_at') THEN
        CREATE TRIGGER update_rows_updated_at BEFORE UPDATE ON public.rows
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    -- Projects table trigger
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_projects_updated_at') THEN
        CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    -- Milestones table trigger
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_milestones_updated_at') THEN
        CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    -- Calendar events table trigger
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_calendar_events_updated_at') THEN
        CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
    
    -- Holidays table trigger
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_holidays_updated_at') THEN
        CREATE TRIGGER update_holidays_updated_at BEFORE UPDATE ON public.holidays
            FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Create critical indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_user_time ON public.calendar_events(user_id, start_time, end_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calendar_events_project ON public.calendar_events(project_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_group ON public.projects(user_id, group_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rows_group_order ON public.rows(group_id, order_index);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_milestones_project_order ON public.milestones(project_id, order_index);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settings_user ON public.settings(user_id);

-- Additional indexes for work_hours if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'work_hours' AND table_schema = 'public') THEN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_hours_user_time ON public.work_hours(user_id, start, "end");
    END IF;
END $$;