-- Performance: Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date_range 
ON public.calendar_events(user_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_projects_user_client 
ON public.projects(user_id, client_id);

CREATE INDEX IF NOT EXISTS idx_calendar_events_project_date 
ON public.calendar_events(project_id, start_time) 
WHERE project_id IS NOT NULL;

-- Data Integrity: Add validation constraints
-- Note: Using >= instead of > to allow zero-duration events if needed
ALTER TABLE public.calendar_events 
ADD CONSTRAINT check_event_time_range 
CHECK (end_time >= start_time);

ALTER TABLE public.projects 
ADD CONSTRAINT check_positive_estimated_hours 
CHECK (estimated_hours >= 0);

ALTER TABLE public.milestones 
ADD CONSTRAINT check_valid_time_allocation 
CHECK (time_allocation >= 0 AND time_allocation <= 100);