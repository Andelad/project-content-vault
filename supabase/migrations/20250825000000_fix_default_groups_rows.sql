-- Fix for project creation issue: Create default groups and rows when user signs up
-- This migration updates the handle_new_user function to create default groups and rows

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  default_group_id UUID;
  default_row_id UUID;
BEGIN
  -- Create user profile
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  -- Create default settings with weekly work hours
  INSERT INTO public.settings (user_id, weekly_work_hours, default_view)
  VALUES (
    NEW.id,
    '{
      "monday": [{"id": "1", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
      "tuesday": [{"id": "2", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
      "wednesday": [{"id": "3", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
      "thursday": [{"id": "4", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
      "friday": [{"id": "5", "startTime": "09:00", "endTime": "17:00", "duration": 8}],
      "saturday": [],
      "sunday": []
    }'::jsonb,
    'timeline'
  );

  -- Create default "Work" group
  INSERT INTO public.groups (id, user_id, name, description, color)
  VALUES (
    'work-group-' || NEW.id,
    NEW.id,
    'Work',
    'Work-related projects',
    '#3b82f6'
  )
  RETURNING id INTO default_group_id;

  -- Create default "Personal" group
  INSERT INTO public.groups (user_id, name, description, color)
  VALUES (
    NEW.id,
    'Personal',
    'Personal projects and tasks',
    '#10b981'
  );

  -- Create default row in the work group
  INSERT INTO public.rows (id, user_id, group_id, name, order_index)
  VALUES (
    'work-row-1-' || NEW.id,
    NEW.id,
    default_group_id,
    'Projects',
    0
  )
  RETURNING id INTO default_row_id;

  -- Create a second row for variety
  INSERT INTO public.rows (user_id, group_id, name, order_index)
  VALUES (
    NEW.id,
    default_group_id,
    'Maintenance',
    1
  );

  RETURN NEW;
END;
$function$;
