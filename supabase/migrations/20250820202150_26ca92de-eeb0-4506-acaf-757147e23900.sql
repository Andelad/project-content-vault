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
CREATE TRIGGER handle_milestones_updated_at
    BEFORE UPDATE ON public.milestones
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();